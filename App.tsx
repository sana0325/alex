import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { TradeBotSettings, TradedSymbol, Candle, AiSignal, OpenTrade, PendingOrder, JournalReview, JournalEntry, JournalOutcome } from './types';
import {
  DEFAULT_SYMBOLS, DEFAULT_LEVERAGE, MAX_OPEN_POSITIONS, TRADE_SETTINGS_KEY,
  GREETING_SEEN_KEY, REVIEW_INTERVAL_MS, LIMIT_ORDER_TIMEOUT_MS, LIMIT_ORDER_MAX_DRIFT_PCT,
  getStakeUSDT,
} from './constants';
import * as bingx from './services/bingx';
import { fetchTradingSignal, generateJournalReview } from './services/aiTrader';
import { computePocPrice } from './services/marketUtils';
import {
  getJournal, computeStats, getReviews, saveReview, isReviewDue, entriesSince,
  lastReviewAt, latestLessons, recordClosedTrade, getOpenTrades, addOpenTrade, removeOpenTrade,
  getPendingOrder, savePendingOrder, getPaperBalance, adjustPaperBalance, appendPrecomputedJournalEntry,
} from './services/journal';
import { ensureNotificationPermission, notifyTradeClosed, notifyTradeOpened } from './services/notifications';
import { startTradingWatch, stopTradingWatch, drainTradingWatchEvents } from './services/tradingWatch';
import { Greeting } from './components/Greeting';
import { TradingView, LiveTrade } from './components/TradingView';
import { JournalView } from './components/JournalView';
import { SettingsModal } from './components/SettingsModal';

interface MarketState {
  candles: Candle[];
  price: number | null;
  signal: AiSignal | null;
}

const emptyMarket = (): MarketState => ({ candles: [], price: null, signal: null });

const DEFAULT_SETTINGS: TradeBotSettings = {
  bingxApiKey: '', bingxApiSecret: '', deepseekKey: '', leverage: DEFAULT_LEVERAGE, liveTradingEnabled: true,
};

function loadSettings(): TradeBotSettings {
  try {
    const raw = localStorage.getItem(TRADE_SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}

function persistSettings(s: TradeBotSettings) {
  try { localStorage.setItem(TRADE_SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

const POLL_MS = 8000;
const AI_SCAN_COOLDOWN_MS = 20000;
const SYMBOL_TRADE_COOLDOWN_MS = 5 * 60 * 1000;
const symbols: TradedSymbol[] = DEFAULT_SYMBOLS;

export default function App() {
  const [showGreeting, setShowGreeting] = useState<boolean>(() => {
    try { return localStorage.getItem(GREETING_SEEN_KEY) !== '1'; } catch { return true; }
  });
  const [tab, setTab] = useState<'trading' | 'journal'>('trading');
  const [settings, setSettings] = useState<TradeBotSettings>(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [activeSymbol, setActiveSymbol] = useState(symbols[0].symbol);
  const [markets, setMarkets] = useState<Record<string, MarketState>>(
    () => Object.fromEntries(symbols.map(s => [s.symbol, emptyMarket()]))
  );
  const [balance, setBalance] = useState<bingx.BingXBalance | null>(null);
  const [positions, setPositions] = useState<bingx.BingXPosition[]>([]);
  const [openTrades, setOpenTrades] = useState<OpenTrade[]>(() => getOpenTrades());
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(() => getPendingOrder());
  const [paperBalance, setPaperBalance] = useState<number>(() => getPaperBalance());
  const [aiStatus, setAiStatus] = useState('Очікування даних...');
  const [analyzing, setAnalyzing] = useState(false);
  const [journalEntries, setJournalEntries] = useState(() => getJournal());
  const [reviews, setReviews] = useState<JournalReview[]>(() => getReviews());

  const contractsRef = useRef<Record<string, bingx.BingXContract>>({});
  const isAiLoadingRef = useRef(false);
  const lastAiCallRef = useRef(0);
  const scanIndexRef = useRef(0);
  const lastTradeAtRef = useRef<Record<string, number>>({});
  const leverageSetRef = useRef<Set<string>>(new Set());
  const marketsRef = useRef(markets);
  const openTradesRef = useRef(openTrades);
  const pendingOrderRef = useRef(pendingOrder);
  const paperBalanceRef = useRef(paperBalance);
  const journalRef = useRef(journalEntries);
  const settingsRef = useRef(settings);
  const balanceRef = useRef(balance);
  const pollNowRef = useRef<() => void>(() => {});

  useEffect(() => { marketsRef.current = markets; }, [markets]);
  useEffect(() => { journalRef.current = journalEntries; }, [journalEntries]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { balanceRef.current = balance; }, [balance]);

  // Open trades / pending order / paper balance are mutated synchronously
  // through these helpers so the same tick that closes a trade can also see
  // the freed-up slot (React state updates alone would lag a render behind).
  const updateOpenTrades = useCallback((updater: (prev: OpenTrade[]) => OpenTrade[]) => {
    const next = updater(openTradesRef.current);
    openTradesRef.current = next;
    setOpenTrades(next);
  }, []);
  const updatePendingOrder = useCallback((order: PendingOrder | null) => {
    pendingOrderRef.current = order;
    savePendingOrder(order);
    setPendingOrder(order);
  }, []);
  const updatePaperBalance = useCallback((deltaUSDT: number) => {
    const next = adjustPaperBalance(deltaUSDT);
    paperBalanceRef.current = next;
    setPaperBalance(next);
    return next;
  }, []);

  const creds: bingx.BingXCreds = { apiKey: settings.bingxApiKey, apiSecret: settings.bingxApiSecret };
  const hasCreds = !!(settings.bingxApiKey && settings.bingxApiSecret);
  const live = hasCreds && settings.liveTradingEnabled;
  const referenceBalance = live ? balance?.balance ?? null : paperBalance;
  const stakeUSDT = getStakeUSDT(referenceBalance);
  const slotOccupied = openTrades.length >= MAX_OPEN_POSITIONS || pendingOrder !== null;

  const dismissGreeting = () => {
    try { localStorage.setItem(GREETING_SEEN_KEY, '1'); } catch { /* ignore */ }
    setShowGreeting(false);
  };

  const saveSettings = (s: TradeBotSettings) => {
    persistSettings(s);
    setSettings(s);
  };

  useEffect(() => { ensureNotificationPermission(); }, []);

  // ── Hand off trade watching to the native foreground service while backgrounded ──
  // Android throttles the WebView's JS timers as soon as the app isn't
  // visible, so this app's own poll loop effectively "falls asleep" — the
  // native TradingWatchService keeps its own thread running and fires the
  // close notification independent of the WebView, for a real BingX
  // position/order (signed calls) or a paper/demo trade (public price
  // polling) alike — background behavior is the same in both modes.
  useEffect(() => {
    const listenerPromise = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        // The WebView's own timers were throttled/paused while backgrounded —
        // any in-flight request may have hung rather than failed, and the
        // scan cooldown may now be stale. Clear both so the app recovers in
        // one tick instead of leaving an old error status sitting on screen.
        isAiLoadingRef.current = false;
        lastAiCallRef.current = 0;
        setAiStatus('Відновлення після фону...');
        pollNowRef.current();

        stopTradingWatch();
        drainTradingWatchEvents().then(events => {
          for (const ev of events) {
            if (ev.type === 'cancelled') {
              if (pendingOrderRef.current && pendingOrderRef.current.id === ev.tradeId) {
                updatePendingOrder(null);
              }
              continue;
            }
            if (ev.type === 'closed' && ev.entry !== undefined && ev.exit !== undefined) {
              const trade = openTradesRef.current.find(t => t.id === ev.tradeId);
              const entry: JournalEntry = {
                id: ev.tradeId,
                symbol: ev.symbol,
                side: ev.side ?? trade?.side ?? 'LONG',
                entry: ev.entry,
                exit: ev.exit,
                sl: ev.sl ?? trade?.sl ?? 0,
                tp1: ev.tp1 ?? trade?.tp1 ?? 0,
                stakeUSDT: ev.stakeUSDT ?? trade?.stakeUSDT ?? 0,
                leverage: ev.leverage ?? trade?.leverage ?? settingsRef.current.leverage,
                pnlUSDT: ev.pnlUSDT ?? 0,
                pnlPercent: ev.pnlPercent ?? 0,
                outcome: (ev.outcome as JournalOutcome) ?? 'BREAKEVEN',
                setup: ev.setup ?? trade?.setup ?? '',
                aiReason: ev.aiReason ?? trade?.aiReason ?? '',
                openedAt: ev.openedAt ?? trade?.openedAt ?? Date.now(),
                closedAt: ev.closedAt ?? Date.now(),
                simulated: ev.simulated ?? trade?.simulated,
              };
              appendPrecomputedJournalEntry(entry);
              removeOpenTrade(ev.tradeId);
              updateOpenTrades(prev => prev.filter(t => t.id !== ev.tradeId));
              updatePendingOrder(null);
              setJournalEntries(prev => [entry, ...prev]);
              if (entry.simulated) updatePaperBalance(entry.pnlUSDT);
              // Already notified natively in real time — no duplicate notification here.
            }
          }
        });
      } else {
        // Hand the single active trade slot off to the native watcher —
        // works the same for a real BingX position/order and a paper/demo
        // trade (the service polls the public price for demo instead of a
        // signed position lookup).
        const trade = openTradesRef.current[0];
        const pending = pendingOrderRef.current;
        if (trade) {
          startTradingWatch({
            apiKey: settingsRef.current.bingxApiKey, apiSecret: settingsRef.current.bingxApiSecret,
            mode: 'position', symbol: trade.symbol, side: trade.side, tradeId: trade.id,
            entry: trade.entry, sl: trade.sl, tp1: trade.tp1, stakeUSDT: trade.stakeUSDT,
            leverage: trade.leverage, setup: trade.setup, aiReason: trade.aiReason, openedAt: trade.openedAt,
            simulated: !!trade.simulated,
          });
        } else if (pending) {
          startTradingWatch({
            apiKey: settingsRef.current.bingxApiKey, apiSecret: settingsRef.current.bingxApiSecret,
            mode: 'order', symbol: pending.symbol, side: pending.side, orderId: pending.orderId, tradeId: pending.id,
            entry: pending.price, sl: pending.sl, tp1: pending.tp1, stakeUSDT: pending.stakeUSDT,
            leverage: pending.leverage, setup: pending.setup, aiReason: pending.aiReason, openedAt: pending.placedAt,
            simulated: false,
          });
        }
      }
    });
    return () => { listenerPromise.then(handle => handle.remove()); };
  }, [updateOpenTrades, updatePendingOrder, updatePaperBalance]);

  // ── Contract precision (fetched once, public endpoint) ──────────────────
  useEffect(() => {
    bingx.getContracts().then(list => {
      const map: Record<string, bingx.BingXContract> = {};
      for (const c of list) map[c.symbol] = c;
      contractsRef.current = map;
    }).catch(() => { /* ignore, fall back to default precision */ });
  }, []);

  const closeTradeAndJournal = useCallback((trade: OpenTrade, exitPrice: number) => {
    const entry = recordClosedTrade(trade, exitPrice);
    removeOpenTrade(trade.id);
    updateOpenTrades(prev => prev.filter(t => t.id !== trade.id));
    setJournalEntries(prev => [entry, ...prev]);

    let updatedBalance: number | null = null;
    if (entry.simulated) {
      updatedBalance = updatePaperBalance(entry.pnlUSDT);
    } else {
      updatedBalance = balanceRef.current ? balanceRef.current.balance + entry.pnlUSDT : null;
    }
    notifyTradeClosed(entry, updatedBalance);
    return entry;
  }, [updateOpenTrades, updatePaperBalance]);

  // ── Reconcile: a locally tracked LIVE trade whose BingX position vanished (TP/SL/manual) ──
  const reconcileClosedTrades = useCallback((livePositions: bingx.BingXPosition[], latestMarkets: Record<string, MarketState>) => {
    const openSymbols = new Set(livePositions.map(p => p.symbol));
    for (const t of openTradesRef.current.filter(t => !t.simulated)) {
      if (openSymbols.has(t.symbol)) continue;
      const exitPrice = latestMarkets[t.symbol]?.price ?? marketsRef.current[t.symbol]?.price ?? t.entry;
      closeTradeAndJournal(t, exitPrice);
    }
  }, [closeTradeAndJournal]);

  // ── Pending limit order: poll for fill, or cancel on timeout/drift ───────
  const pollPendingOrder = useCallback(async (latestMarkets: Record<string, MarketState>) => {
    const pending = pendingOrderRef.current;
    if (!pending) return;

    try {
      const status = await bingx.getOrder(creds, pending.symbol, pending.orderId);
      if (status?.status === 'FILLED') {
        const trade: OpenTrade = {
          id: pending.id, symbol: pending.symbol, side: pending.side,
          entry: status.avgPrice || pending.price, sl: pending.sl, tp1: pending.tp1,
          quantity: status.executedQty || pending.quantity, stakeUSDT: pending.stakeUSDT,
          leverage: pending.leverage, setup: pending.setup, aiReason: pending.aiReason, openedAt: Date.now(),
        };
        addOpenTrade(trade);
        updateOpenTrades(prev => [...prev, trade]);
        updatePendingOrder(null);
        setAiStatus(`${pending.symbol}: лімітний ордер виконано, позиція відкрита`);
        notifyTradeOpened(pending.symbol, pending.side, false);
        return;
      }
      if (status?.status === 'CANCELLED' || status?.status === 'REJECTED' || status?.status === 'EXPIRED') {
        updatePendingOrder(null);
        return;
      }

      const price = latestMarkets[pending.symbol]?.price ?? marketsRef.current[pending.symbol]?.price;
      const driftPct = price ? Math.abs(price - pending.price) / pending.price * 100 : 0;
      const timedOut = Date.now() - pending.placedAt > LIMIT_ORDER_TIMEOUT_MS;

      if (timedOut || driftPct > LIMIT_ORDER_MAX_DRIFT_PCT) {
        await bingx.cancelOrder(creds, pending.symbol, pending.orderId);
        updatePendingOrder(null);
        setAiStatus(`${pending.symbol}: лімітний ордер скасовано (${timedOut ? 'час вийшов' : 'ціна пішла'}) — шукаю далі`);
      }
    } catch {
      /* transient API error — try again next poll */
    }
  }, [creds, updateOpenTrades, updatePendingOrder]);

  // ── Paper trading: simulate exits off real market prices when not live ──
  const checkPaperExits = useCallback((latestMarkets: Record<string, MarketState>) => {
    for (const t of openTradesRef.current.filter(t => t.simulated)) {
      const price = latestMarkets[t.symbol]?.price ?? marketsRef.current[t.symbol]?.price;
      if (!price) continue;
      let exit: number | null = null;
      if (t.side === 'LONG') { if (price <= t.sl) exit = t.sl; else if (price >= t.tp1) exit = t.tp1; }
      else { if (price >= t.sl) exit = t.sl; else if (price <= t.tp1) exit = t.tp1; }
      if (exit !== null) closeTradeAndJournal(t, exit);
    }
  }, [closeTradeAndJournal]);

  // ── Poll market data + account state ─────────────────────────────────────
  useEffect(() => {
    let stopped = false;

    const poll = async () => {
      const nextMarkets: Record<string, MarketState> = {};
      for (const s of symbols) {
        try {
          const candles = await bingx.getKlines(s.symbol, 'M5', 150);
          const price = candles.length > 0 ? candles[candles.length - 1].close : null;
          nextMarkets[s.symbol] = { candles, price, signal: marketsRef.current[s.symbol]?.signal ?? null };
        } catch {
          nextMarkets[s.symbol] = marketsRef.current[s.symbol] ?? emptyMarket();
        }
      }
      if (stopped) return;
      setMarkets(prev => ({ ...prev, ...nextMarkets }));
      marketsRef.current = { ...marketsRef.current, ...nextMarkets };

      if (hasCreds) {
        try {
          const bal = await bingx.getBalance(creds);
          if (!stopped && bal) setBalance(bal);
        } catch { /* keep last known balance */ }

        try {
          const pos = await bingx.getPositions(creds);
          if (!stopped) {
            setPositions(pos);
            reconcileClosedTrades(pos, nextMarkets);
          }
        } catch { /* keep last known positions */ }

        if (!stopped) await pollPendingOrder(nextMarkets);
      } else {
        checkPaperExits(nextMarkets);
      }
    };

    pollNowRef.current = () => { poll(); };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { stopped = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCreds, settings.bingxApiKey, settings.bingxApiSecret]);

  // ── AI scan rotation — keeps looking across ALL symbols, even mid-trade ──
  const runAiScan = useCallback(async (s: TradedSymbol) => {
    isAiLoadingRef.current = true;
    lastAiCallRef.current = Date.now();
    setAiStatus(`Аналізую ${s.symbol}...`);
    try {
      const m = marketsRef.current[s.symbol];
      const pocPrice = computePocPrice(m.candles);
      const stats = computeStats(journalRef.current);
      const lessons = latestLessons();
      const signal = await fetchTradingSignal(settingsRef.current.deepseekKey, s.symbol, s.market, m.candles, pocPrice, lessons, stats);
      setMarkets(prev => ({ ...prev, [s.symbol]: { ...prev[s.symbol], signal } }));
      marketsRef.current = { ...marketsRef.current, [s.symbol]: { ...marketsRef.current[s.symbol], signal } };
      setAiStatus(signal.type === 'WAIT' ? `${s.symbol}: WAIT (${signal.score} балів)` : `${s.symbol}: сетап ${signal.type} (${signal.score} балів)`);
    } catch {
      setAiStatus(`Помилка ШІ-аналізу ${s.symbol}`);
    } finally {
      isAiLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!settings.deepseekKey) { setAiStatus('Додайте DeepSeek API ключ у налаштуваннях (⚙)'); return; }
    if (isAiLoadingRef.current) return;
    if (Date.now() - lastAiCallRef.current < AI_SCAN_COOLDOWN_MS) return;

    // Scans every pair on rotation regardless of the trade slot, so the bot
    // keeps building a live picture of the whole market instead of sitting
    // idle — only ENTRY is gated by slotOccupied, not analysis.
    const candidates = symbols.filter(s => (markets[s.symbol]?.candles.length ?? 0) >= 60);
    if (candidates.length === 0) return;

    const target = candidates[scanIndexRef.current % candidates.length];
    scanIndexRef.current += 1;
    runAiScan(target);
  }, [markets, settings.deepseekKey, runAiScan]);

  // ── Live entry: resting maker-only limit order (less spread/fees than market) ──
  const openLimitOrderOnBingx = useCallback(async (s: TradedSymbol, sig: AiSignal) => {
    const stake = getStakeUSDT(balanceRef.current?.balance ?? null);
    const contract = contractsRef.current[s.symbol];
    const qtyRaw = (stake * settingsRef.current.leverage) / sig.entry;
    const qty = contract ? bingx.roundToPrecision(qtyRaw, contract.quantityPrecision) : Number(qtyRaw.toFixed(3));
    if (qty <= 0) { setAiStatus(`${s.symbol}: ставка занадто мала для мінімального розміру контракту`); return; }

    const positionSide: 'LONG' | 'SHORT' = sig.type === 'LONG' ? 'LONG' : 'SHORT';
    const side: bingx.OrderSide = sig.type === 'LONG' ? 'BUY' : 'SELL';
    const leverageKey = `${s.symbol}-${positionSide}`;

    try {
      if (!leverageSetRef.current.has(leverageKey)) {
        await bingx.setLeverage(creds, s.symbol, positionSide, settingsRef.current.leverage);
        leverageSetRef.current.add(leverageKey);
      }
      const { orderId } = await bingx.placeLimitOrder(creds, {
        symbol: s.symbol, side, positionSide, quantity: qty, price: sig.entry,
        stopLossPrice: sig.sl, takeProfitPrice: sig.tp1,
      });

      const pending: PendingOrder = {
        id: crypto.randomUUID(), orderId, symbol: s.symbol, side: sig.type as 'LONG' | 'SHORT',
        price: sig.entry, sl: sig.sl, tp1: sig.tp1, quantity: qty, stakeUSDT: stake,
        leverage: settingsRef.current.leverage, setup: sig.setup, aiReason: sig.reason, placedAt: Date.now(),
      };
      updatePendingOrder(pending);
      lastTradeAtRef.current[s.symbol] = Date.now();
      setAiStatus(`${s.symbol}: лімітний ордер ${sig.type} виставлено @ ${sig.entry} (ставка $${stake}, ${settingsRef.current.leverage}x)`);
    } catch (e: any) {
      setAiStatus(`${s.symbol}: помилка виставлення ордера — ${e?.message ?? e}`);
    }
  }, [creds, updatePendingOrder]);

  // ── Paper entry: simulate a fill immediately at market for continuous learning ──
  const openPaperTrade = useCallback((s: TradedSymbol, sig: AiSignal, execPrice: number) => {
    const stake = getStakeUSDT(paperBalanceRef.current);
    const trade: OpenTrade = {
      id: crypto.randomUUID(), symbol: s.symbol, side: sig.type as 'LONG' | 'SHORT',
      entry: execPrice, sl: sig.sl, tp1: sig.tp1, quantity: 0, stakeUSDT: stake,
      leverage: settingsRef.current.leverage, setup: sig.setup, aiReason: sig.reason,
      openedAt: Date.now(), simulated: true,
    };
    addOpenTrade(trade);
    updateOpenTrades(prev => [...prev, trade]);
    lastTradeAtRef.current[s.symbol] = Date.now();
    setAiStatus(`${s.symbol}: демо-угода ${sig.type} відкрита (без підключення до біржі — бот навчається)`);
    notifyTradeOpened(s.symbol, sig.type as 'LONG' | 'SHORT', true);
  }, [updateOpenTrades]);

  useEffect(() => {
    if (slotOccupied) return; // sequential-only: never a second trade while one is still working

    for (const s of symbols) {
      const m = marketsRef.current[s.symbol];
      const sig = m?.signal;
      if (!sig || sig.type === 'WAIT' || !sig.sl || !sig.tp1) continue;

      const now = Date.now();
      if (now - (lastTradeAtRef.current[s.symbol] ?? 0) < SYMBOL_TRADE_COOLDOWN_MS) continue;

      if (sig.type === 'LONG' && (sig.sl >= sig.entry || sig.tp1 <= sig.entry)) continue;
      if (sig.type === 'SHORT' && (sig.sl <= sig.entry || sig.tp1 >= sig.entry)) continue;
      const slDist = Math.abs(sig.entry - sig.sl);
      const tpDist = Math.abs(sig.tp1 - sig.entry);
      if (tpDist <= slDist) continue;

      if (live) {
        const price = m.price ?? sig.entry;
        const driftPct = Math.abs(price - sig.entry) / sig.entry * 100;
        if (driftPct > LIMIT_ORDER_MAX_DRIFT_PCT) continue; // already ran away, wait for a fresh signal
        openLimitOrderOnBingx(s, sig);
      } else {
        openPaperTrade(s, sig, m.price ?? sig.entry);
      }
      break; // one entry attempt per tick, the slot itself enforces sequencing
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markets, live, slotOccupied, openLimitOrderOnBingx, openPaperTrade]);

  const handleCloseTrade = async (tradeId: string) => {
    const trade = openTrades.find(t => t.id === tradeId);
    if (!trade) return;
    try {
      if (!trade.simulated) {
        const pos = positions.find(p => p.symbol === trade.symbol);
        if (pos) await bingx.closePosition(creds, pos);
      }
      const exitPrice = markets[trade.symbol]?.price ?? trade.entry;
      closeTradeAndJournal(trade, exitPrice);
    } catch (e: any) {
      setAiStatus(`Помилка закриття ${trade.symbol}: ${e?.message ?? e}`);
    }
  };

  const handleCancelPendingOrder = async () => {
    const pending = pendingOrderRef.current;
    if (!pending) return;
    try {
      await bingx.cancelOrder(creds, pending.symbol, pending.orderId);
    } catch { /* best-effort */ }
    updatePendingOrder(null);
  };

  // ── 2-day AI journal review ────────────────────────────────────────────────
  const runReview = useCallback(async () => {
    if (!settings.deepseekKey) return;
    setAnalyzing(true);
    try {
      const from = lastReviewAt() || (Date.now() - REVIEW_INTERVAL_MS);
      const entries = entriesSince(from);
      const result = await generateJournalReview(settings.deepseekKey, entries);
      const review: JournalReview = {
        id: crypto.randomUUID(), createdAt: Date.now(), periodFrom: from, periodTo: Date.now(),
        tradesAnalyzed: result.tradesAnalyzed, winRate: result.winRate,
        summary: result.summary, lessons: result.lessons,
      };
      saveReview(review);
      setReviews(prev => [review, ...prev]);
    } catch {
      setAiStatus('Помилка аналізу журналу');
    } finally {
      setAnalyzing(false);
    }
  }, [settings.deepseekKey]);

  useEffect(() => {
    if (!settings.deepseekKey) return;
    if (isReviewDue()) runReview();
    const id = setInterval(() => { if (isReviewDue()) runReview(); }, 60 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.deepseekKey]);

  const nextReviewLabel = useMemo(() => {
    const diff = lastReviewAt() + REVIEW_INTERVAL_MS - Date.now();
    if (diff <= 0) return 'Авто-розбір ось-ось запуститься';
    const hours = Math.max(1, Math.round(diff / (60 * 60 * 1000)));
    return `Наступний авто-розбір через ~${hours} год`;
  }, [reviews]);

  const stats = useMemo(() => computeStats(journalEntries), [journalEntries]);

  const prices = useMemo(
    () => Object.fromEntries(symbols.map(s => [s.symbol, markets[s.symbol]?.price ?? null])),
    [markets]
  );

  const liveTrades: LiveTrade[] = useMemo(() => openTrades.map(t => {
    const markPrice = markets[t.symbol]?.price ?? t.entry;
    const directionSign = t.side === 'LONG' ? 1 : -1;
    const pnlPercent = ((markPrice - t.entry) * directionSign / t.entry) * t.leverage;
    return { ...t, markPrice, unrealizedPnlUSDT: t.stakeUSDT * pnlPercent };
  }), [openTrades, markets]);

  const active = markets[activeSymbol] ?? emptyMarket();
  const activePoc = useMemo(() => computePocPrice(active.candles), [active.candles]);

  return (
    <div className="max-w-5xl mx-auto pb-12 bg-[#05050a] text-white min-h-screen font-sans antialiased">
      {showGreeting && <Greeting onEnter={dismissGreeting} />}

      <div className="p-4 border-b border-[#121220] bg-[#07070d] sticky top-0 z-50 flex justify-between items-center flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${hasCreds ? 'bg-blue-500 animate-pulse' : 'bg-gray-600'}`} />
          <h1 className="text-sm font-black uppercase tracking-widest text-blue-400">Мульти-ринок ШІ Скальп-бот</h1>
        </div>
        <div className="flex bg-[#111122] rounded p-0.5 border border-[#22223a]">
          <button onClick={() => setTab('trading')} className={`px-4 py-1.5 rounded text-xs font-bold ${tab === 'trading' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>Торгівля</button>
          <button onClick={() => setTab('journal')} className={`px-4 py-1.5 rounded text-xs font-bold ${tab === 'journal' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>Журнал</button>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <div className="text-[10px] text-gray-500 uppercase font-bold">{live ? 'Баланс BingX' : 'Демо-баланс'}</div>
            <div className="text-sm font-mono font-bold text-gray-300">
              {live ? (balance ? `$${balance.balance.toLocaleString()}` : '...') : `$${paperBalance.toFixed(2)}`}
            </div>
          </div>
          <button onClick={() => setSettingsOpen(true)} className="w-9 h-9 rounded bg-[#111122] border border-[#22223a] text-gray-400 hover:text-white flex items-center justify-center text-base" title="Налаштування">
            ⚙
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {!hasCreds && (
          <div className="p-4 bg-yellow-950/30 border border-yellow-700/40 rounded-lg text-sm text-yellow-300">
            Бот не підключений до BingX — торгує на демо-рахунку (справжні дані ринку, віртуальний баланс), веде журнал і вчиться. Натисніть ⚙, щоб підключити реальний BingX.
          </div>
        )}
        {hasCreds && !settings.deepseekKey && (
          <div className="p-4 bg-yellow-950/30 border border-yellow-700/40 rounded-lg text-sm text-yellow-300">
            ШІ-аналіз вимкнено — додайте DeepSeek API ключ у налаштуваннях (⚙).
          </div>
        )}
        {hasCreds && !settings.liveTradingEnabled && (
          <div className="p-4 bg-blue-950/30 border border-blue-700/40 rounded-lg text-sm text-blue-300">
            Реальна торгівля вимкнена — бот на демо-рахунку, ордери на BingX не відправляються.
          </div>
        )}

        {tab === 'trading' ? (
          <TradingView
            symbols={symbols}
            prices={prices}
            activeSymbol={activeSymbol}
            onSelectSymbol={setActiveSymbol}
            candles={active.candles}
            signal={active.signal}
            pocPrice={activePoc}
            liveTrades={liveTrades}
            pendingOrder={pendingOrder}
            onCloseTrade={handleCloseTrade}
            onCancelPendingOrder={handleCancelPendingOrder}
            aiStatus={aiStatus}
            stakeUSDT={stakeUSDT}
            leverage={settings.leverage}
            live={live}
          />
        ) : (
          <JournalView
            entries={journalEntries}
            stats={stats}
            reviews={reviews}
            onAnalyzeNow={runReview}
            analyzing={analyzing}
            nextReviewLabel={nextReviewLabel}
            deepseekKeyPresent={!!settings.deepseekKey}
          />
        )}
      </div>

      <SettingsModal open={settingsOpen} settings={settings} onClose={() => setSettingsOpen(false)} onSave={saveSettings} />
    </div>
  );
}
