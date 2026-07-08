"""MT5 <-> SMC AI Trader (Android) WebSocket bridge.

Run this on the Windows PC where the MetaTrader 5 terminal is logged in
(with "Algo Trading" / AutoTrading enabled). It streams M5 candles, a volume
profile and account state to the Android app every couple of seconds, and
executes the OPEN_SPLIT / PARTIAL_CLOSE_AND_BU / CLOSE commands the app
sends back over the same WebSocket connection.

Setup:
    pip install -r requirements.txt
    python mt5_bridge.py

Then, in the Android app's settings, enter this PC's LAN IP and the port
below (find the IP with `ipconfig` on Windows), e.g. 192.168.1.50:8765.
Phone and PC must be on the same network unless you set up port forwarding
or a tunnel (e.g. Tailscale) yourself.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

import MetaTrader5 as mt5
import websockets

# ── Configuration ────────────────────────────────────────────────────────────

HOST = "0.0.0.0"
PORT = 8765

# App-facing symbol -> broker symbol. If your broker uses suffixes
# (e.g. "XAUUSD.m", "EURUSD_i"), resolve_symbol() will auto-detect a match;
# override here only if auto-detection picks the wrong one.
SYMBOL_MAP = {
    "XAUUSD": "XAUUSD",
    "EURUSD": "EURUSD",
    "GBPUSD": "GBPUSD",
    "USDJPY": "USDJPY",
}

TIMEFRAME = mt5.TIMEFRAME_M5
CANDLE_COUNT = 300
VP_LOOKBACK = 120
VP_BINS = 24
PUSH_INTERVAL_SEC = 2.0
MAGIC = 990022  # tags every order this bot places, so it never touches manual trades

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("mt5_bridge")

_resolved_symbols: dict[str, str] = {}


def resolve_symbol(app_symbol: str) -> Optional[str]:
    if app_symbol in _resolved_symbols:
        return _resolved_symbols[app_symbol]

    candidate = SYMBOL_MAP.get(app_symbol, app_symbol)
    if mt5.symbol_info(candidate) is not None:
        mt5.symbol_select(candidate, True)
        _resolved_symbols[app_symbol] = candidate
        return candidate

    # Broker uses a suffix/prefix — search for a close match.
    for info in mt5.symbols_get() or ():
        if info.name.upper().startswith(app_symbol.upper()):
            mt5.symbol_select(info.name, True)
            _resolved_symbols[app_symbol] = info.name
            log.info("Resolved %s -> %s", app_symbol, info.name)
            return info.name

    log.warning("Could not resolve broker symbol for %s", app_symbol)
    return None


def get_safe_lot(balance: Optional[float]) -> float:
    if not balance:
        return 0.0
    if balance < 500:
        return 0.02
    if balance < 1000:
        return 0.04
    if balance < 5000:
        return 0.1
    if balance < 10000:
        return 0.5
    if balance < 20000:
        return 1.0
    return 2.0


# ── Market data ──────────────────────────────────────────────────────────────

def build_candles(broker_symbol: str) -> list[dict]:
    rates = mt5.copy_rates_from_pos(broker_symbol, TIMEFRAME, 0, CANDLE_COUNT)
    if rates is None:
        return []
    return [
        {
            "time": int(r["time"]),
            "open": float(r["open"]),
            "high": float(r["high"]),
            "low": float(r["low"]),
            "close": float(r["close"]),
            "volume": float(r["tick_volume"]),
        }
        for r in rates
    ]


def build_volume_profile(candles: list[dict]) -> dict:
    sample = candles[-VP_LOOKBACK:]
    if not sample:
        return {"bins": [], "poc_price": 0}

    lo = min(c["low"] for c in sample)
    hi = max(c["high"] for c in sample)
    if hi <= lo:
        return {"bins": [], "poc_price": lo}

    step = (hi - lo) / VP_BINS
    volumes = [0.0] * VP_BINS

    for c in sample:
        first_bin = max(0, min(VP_BINS - 1, int((c["low"] - lo) / step)))
        last_bin = max(0, min(VP_BINS - 1, int((c["high"] - lo) / step)))
        touched = list(range(first_bin, last_bin + 1))
        share = c["volume"] / len(touched)
        for b in touched:
            volumes[b] += share

    max_vol = max(volumes)
    poc_index = volumes.index(max_vol) if max_vol > 0 else VP_BINS // 2

    bins_ = [
        {
            "price_start": lo + i * step,
            "price_end": lo + (i + 1) * step,
            "volume": volumes[i],
            "relative_volume": (volumes[i] / max_vol) if max_vol > 0 else 0,
        }
        for i in range(VP_BINS)
    ]
    poc_price = (bins_[poc_index]["price_start"] + bins_[poc_index]["price_end"]) / 2
    return {"bins": bins_, "poc_price": poc_price}


def get_active_positions() -> list[dict]:
    positions = mt5.positions_get() or ()
    app_by_broker = {v: k for k, v in _resolved_symbols.items()}
    return [
        {"ticket": p.ticket, "symbol": app_by_broker.get(p.symbol, p.symbol)}
        for p in positions
        if p.magic == MAGIC
    ]


def build_snapshot() -> dict:
    account = mt5.account_info()
    balance = account.balance if account else None

    symbols_payload = {}
    for app_symbol in SYMBOL_MAP:
        broker_symbol = resolve_symbol(app_symbol)
        if not broker_symbol:
            continue
        candles = build_candles(broker_symbol)
        if not candles:
            continue
        symbols_payload[app_symbol] = {
            "candles": candles,
            "volume_profile": build_volume_profile(candles),
        }

    return {
        "type": "MULTI_CANDLES",
        "balance": balance,
        "active_positions": get_active_positions(),
        "symbols": symbols_payload,
    }


# ── Order execution ──────────────────────────────────────────────────────────

def _filling_type(broker_symbol: str) -> int:
    info = mt5.symbol_info(broker_symbol)
    mode = info.filling_mode if info else 0
    if mode & mt5.SYMBOL_FILLING_IOC:
        return mt5.ORDER_FILLING_IOC
    if mode & mt5.SYMBOL_FILLING_FOK:
        return mt5.ORDER_FILLING_FOK
    return mt5.ORDER_FILLING_RETURN


def _bot_position(broker_symbol: str):
    for p in mt5.positions_get(symbol=broker_symbol) or ():
        if p.magic == MAGIC:
            return p
    return None


def open_split(app_symbol: str, side: str, sl: float, tp1: float) -> None:
    broker_symbol = resolve_symbol(app_symbol)
    if not broker_symbol:
        log.warning("OPEN_SPLIT: unknown symbol %s", app_symbol)
        return
    if _bot_position(broker_symbol) is not None:
        log.info("OPEN_SPLIT: %s already has an open bot position, skipping", app_symbol)
        return

    tick = mt5.symbol_info_tick(broker_symbol)
    if tick is None:
        log.warning("OPEN_SPLIT: no tick for %s", broker_symbol)
        return

    account = mt5.account_info()
    lot = get_safe_lot(account.balance if account else None)
    if lot <= 0:
        log.warning("OPEN_SPLIT: lot size resolved to 0, skipping")
        return

    order_type = mt5.ORDER_TYPE_BUY if side == "LONG" else mt5.ORDER_TYPE_SELL
    price = tick.ask if side == "LONG" else tick.bid

    result = mt5.order_send({
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": broker_symbol,
        "volume": lot,
        "type": order_type,
        "price": price,
        "sl": sl,
        "tp": tp1,
        "deviation": 20,
        "magic": MAGIC,
        "comment": "SMC_AI_BOT",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": _filling_type(broker_symbol),
    })
    if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
        log.error("OPEN_SPLIT failed for %s: %s", app_symbol, result)
    else:
        log.info("Opened %s %s lot=%s sl=%s tp=%s", side, app_symbol, lot, sl, tp1)


def partial_close_and_breakeven(app_symbol: str, new_sl: float) -> None:
    broker_symbol = resolve_symbol(app_symbol)
    if not broker_symbol:
        return
    position = _bot_position(broker_symbol)
    if position is None:
        return

    info = mt5.symbol_info(broker_symbol)
    step = info.volume_step if info else 0.01
    min_vol = info.volume_min if info else 0.01

    close_volume = round((position.volume * 0.5) / step) * step
    close_volume = max(close_volume, min_vol) if position.volume > min_vol else 0
    close_volume = min(close_volume, position.volume - min_vol)

    if close_volume >= min_vol:
        tick = mt5.symbol_info_tick(broker_symbol)
        opposite = mt5.ORDER_TYPE_SELL if position.type == mt5.POSITION_TYPE_BUY else mt5.ORDER_TYPE_BUY
        price = tick.bid if position.type == mt5.POSITION_TYPE_BUY else tick.ask
        result = mt5.order_send({
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": broker_symbol,
            "volume": close_volume,
            "type": opposite,
            "position": position.ticket,
            "price": price,
            "deviation": 20,
            "magic": MAGIC,
            "comment": "SMC_AI_BOT_PARTIAL",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": _filling_type(broker_symbol),
        })
        if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
            log.error("Partial close failed for %s: %s", app_symbol, result)

    # Move stop loss to breakeven on whatever volume remains open.
    position = _bot_position(broker_symbol)
    if position is not None:
        result = mt5.order_send({
            "action": mt5.TRADE_ACTION_SLTP,
            "symbol": broker_symbol,
            "position": position.ticket,
            "sl": new_sl,
            "tp": position.tp,
        })
        if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
            log.error("Breakeven SL update failed for %s: %s", app_symbol, result)
        else:
            log.info("Breakeven set for %s at %s", app_symbol, new_sl)


def close_symbol(app_symbol: str) -> None:
    broker_symbol = resolve_symbol(app_symbol)
    if not broker_symbol:
        return
    position = _bot_position(broker_symbol)
    if position is None:
        return

    tick = mt5.symbol_info_tick(broker_symbol)
    opposite = mt5.ORDER_TYPE_SELL if position.type == mt5.POSITION_TYPE_BUY else mt5.ORDER_TYPE_BUY
    price = tick.bid if position.type == mt5.POSITION_TYPE_BUY else tick.ask
    result = mt5.order_send({
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": broker_symbol,
        "volume": position.volume,
        "type": opposite,
        "position": position.ticket,
        "price": price,
        "deviation": 20,
        "magic": MAGIC,
        "comment": "SMC_AI_BOT_CLOSE",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": _filling_type(broker_symbol),
    })
    if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
        log.error("Close failed for %s: %s", app_symbol, result)
    else:
        log.info("Closed %s", app_symbol)


# ── WebSocket server ─────────────────────────────────────────────────────────

CLIENTS: set = set()


async def handle_client(websocket, _path=None):
    CLIENTS.add(websocket)
    peer = websocket.remote_address
    log.info("Client connected: %s", peer)
    try:
        async for raw in websocket:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            action = msg.get("action")
            symbol = msg.get("symbol")
            try:
                if action == "OPEN_SPLIT":
                    open_split(symbol, msg.get("type"), float(msg.get("sl")), float(msg.get("tp1")))
                elif action == "PARTIAL_CLOSE_AND_BU":
                    partial_close_and_breakeven(symbol, float(msg.get("new_sl")))
                elif action == "CLOSE":
                    close_symbol(symbol)
            except Exception:
                log.exception("Failed to handle command: %s", msg)
    except websockets.ConnectionClosed:
        pass
    finally:
        CLIENTS.discard(websocket)
        log.info("Client disconnected: %s", peer)


async def broadcast_loop():
    while True:
        if CLIENTS:
            try:
                payload = json.dumps(build_snapshot())
                await asyncio.gather(*(c.send(payload) for c in list(CLIENTS)), return_exceptions=True)
            except Exception:
                log.exception("Failed to build/send snapshot")
        await asyncio.sleep(PUSH_INTERVAL_SEC)


async def main():
    if not mt5.initialize():
        raise SystemExit(f"MetaTrader5 initialize() failed: {mt5.last_error()}")
    log.info("Connected to MT5 terminal. Account: %s", mt5.account_info())

    async with websockets.serve(handle_client, HOST, PORT, max_size=2**22):
        log.info("Bridge listening on ws://%s:%s", HOST, PORT)
        await broadcast_loop()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    finally:
        mt5.shutdown()
