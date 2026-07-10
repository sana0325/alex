import React, { useState, useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time } from 'lightweight-charts';
import { SmcSettingsModal } from './components/SmcSettingsModal';

interface Candle extends CandlestickData<Time> { volume: number; }
interface VolumeBin { price_start: number; price_end: number; volume: number; relative_volume: number; }
interface VolumeProfileData { bins: VolumeBin[]; poc_price: number; }
interface IndicatorVote { name: string; value: string; status: 'bullish' | 'bearish' | 'neutral'; }
interface SignalAnalysis {
  type: 'LONG' | 'SHORT' | 'WAIT'; entry?: number; tp1?: number; sl?: number;
  reason: string; setup?: string; resLine?: number; supLine?: number;
  votes: { s1: { bullish: number; bearish: number; list: IndicatorVote[] }; };
}
interface Trade { id: number; type: 'LONG' | 'SHORT'; entry: number; tp1: number; sl: number; openTime: string; breakevenSet: boolean; setup?: string; }
interface MarketState { candles: Candle[]; vp: VolumeProfileData | null; signal: SignalAnalysis | null; price: number | null; trades: Trade[]; lastTrade: number; }

const SYMBOLS: { sym: string; label: string; icon: string; digits: number }[] = [
  { sym: 'XAUUSD', label: 'GOLD / USD', icon: '🥇', digits: 2 },
  { sym: 'EURUSD', label: 'EUR / USD', icon: '💶', digits: 5 },
  { sym: 'GBPUSD', label: 'GBP / USD', icon: '💷', digits: 5 },
  { sym: 'USDJPY', label: 'USD / JPY', icon: '💴', digits: 3 },
];
const MAX_OPEN_POSITIONS = 2; // Стеля одночасних позицій сумарно по всіх парах

const emptyMarket = (): MarketState => ({ candles: [], vp: null, signal: null, price: null, trades: [], lastTrade: 0 });

const getSafeLot = (balance: number | null): number => {
  if (!balance) return 0.00;
  if (balance < 500) return 0.02; // Драбина чітко стартує з 0.02 лота
  if (balance < 1000) return 0.04;
  if (balance < 5000) return 0.1;
  if (balance < 10000) return 0.5;
  if (balance < 20000) return 1.0;
  return 2.0;
};

const BRIDGE_HOST_KEY = 'smc_bridge_host';
const DEEPSEEK_KEY_KEY = 'smc_deepseek_key';
const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";

function loadStr(key: string): string {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}

export default function App() {
  const [mt5Balance, setMt5Balance] = useState<number | null>(null);
  const [riskMode, setRiskMode] = useState<'SAFE' | 'AGGRESSIVE'>('SAFE');
  const [loading, setLoading] = useState(true);
  const [markets, setMarkets] = useState<Record<string, MarketState>>(() => Object.fromEntries(SYMBOLS.map(s => [s.sym, emptyMarket()])));
  const [activeSymbol, setActiveSymbol] = useState<string>('XAUUSD');
  const [aiStatus, setAiStatus] = useState<string>("Очікування даних...");
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bridgeHost, setBridgeHost] = useState<string>(() => loadStr(BRIDGE_HOST_KEY));
  const [deepseekKey, setDeepseekKey] = useState<string>(() => loadStr(DEEPSEEK_KEY_KEY));

  const chartRef = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi|null>(null);
  const series = useRef<ISeriesApi<'Candlestick'>|null>(null);
  const lines = useRef<any>({poc: null, res: null, sup: null});
  const wsRef = useRef<WebSocket | null>(null);

  const isAiLoading = useRef<boolean>(false);
  const lastAiCall = useRef<number>(0);
  const scanIndex = useRef<number>(0);
  const COOLDOWN_MS = 300000; // 5 хвилин між угодами по одній парі
  const AI_THROTTLE_MS = 15000; // Пауза між ШІ-запитами (ротація пар ~1 хв на повне коло)

  const activeMeta = SYMBOLS.find(s => s.sym === activeSymbol)!;
  const active = markets[activeSymbol];

  const saveSettings = (host: string, key: string) => {
    try {
      localStorage.setItem(BRIDGE_HOST_KEY, host);
      localStorage.setItem(DEEPSEEK_KEY_KEY, key);
    } catch { /* ignore storage errors */ }
    setBridgeHost(host);
    setDeepseekKey(key);
  };

  const fetchDeepSeekSignal = async (sym: string, candles: Candle[], vp: VolumeProfileData | null) => {
    if (!deepseekKey) { setAiStatus("Додайте DeepSeek API ключ у налаштуваннях (⚙)"); return; }
    if (candles.length < 60 || isAiLoading.current) return;
    if (Date.now() - lastAiCall.current < AI_THROTTLE_MS) return;

    const recentCandles = candles.slice(-80).map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));

    isAiLoading.current = true;
    setAiStatus(`SMC Аналіз ${sym} через ШІ...`);

    // АДАПТИВНИЙ СИСТЕМНИЙ ПРОМПТ: РЕЖИМ РИНКУ -> PLAYBOOK -> БАЛЬНА ОЦІНКА СЕТАПУ
    const systemPrompt = `You are an adaptive ${sym} M5 scalping engine using Smart Money Concepts.
You do not follow one rigid pattern — you first read the market regime,
then apply the matching playbook, then score the setup. You trade whenever
the score threshold is met, in ANY regime.

=== FORMAL DEFINITIONS ===
- AB = mean absolute candle body of the last 20 candles.
- ATR = average (high - low) of the last 14 candles. ALL distances below are
  ATR-relative — they auto-scale with volatility.
- Impulse = body >= 1.5 * AB. Swing = 5-candle fractal.
- BOS = close beyond last swing WITH trend. CHoCH = close beyond last swing AGAINST it.
- OB = last opposite candle before the impulse causing BOS/CHoCH (full range).
- FVG = 3-candle gap >= 0.4 * ATR. Filled once price trades through 50% of it.
- Sweep = wick beyond a swing that closes back inside within 1-2 candles.

=== STEP 1: CLASSIFY MARKET REGIME ===
- TREND (up/down): last two swings form HH+HL or LH+LL and price is making
  progress (net move of last 30 candles > 2 * ATR).
- RANGE: swings alternate inside a box; net move of last 30 candles < 2 * ATR.
- VOLATILE: any of last 3 candles has body > 3 * ATR (news shock).

=== STEP 2: APPLY THE MATCHING PLAYBOOK ===
TREND playbook:
- Trade continuation: pullbacks into OB/FVG in trend direction after BOS.
- Countertrend only after sweep + CHoCH (AGGRESSIVE mode only).
- TP: next liquidity in trend direction.
RANGE playbook (do NOT wait out ranges — trade them):
- Fade the edges: LONG from lower third of the box, SHORT from upper third,
  best with a sweep of the box boundary.
- TP: POC or the opposite edge, whichever is closer.
- Never enter in the middle third of the box.
VOLATILE playbook:
- SAFE mode: WAIT until 3 consecutive candles with body < 1.5 * AB.
- AGGRESSIVE mode: momentum entries allowed in the direction of the shock
  after the first pullback; SL = 1.2 * ATR minimum.
ANTI-FADE RULE (applies to ALL playbooks and BOTH modes):
- NEVER SHORT while the last 3-4 candles are consecutive strong bullish
  bodies (> AB), and never LONG against the mirror case. An active impulse
  must first print a CHoCH or at least 2 corrective candles before you may
  trade against it. Selling into a vertical rally = donating a stop.

=== STEP 3: SCORE THE SETUP (flexible, factors compensate each other) ===
+2  entry zone matches the active playbook (OB/FVG in trend; box edge in range)
+2  liquidity sweep into the zone
+2  fresh CHoCH/BOS confirms direction (within last 15 candles)
+1  POC confluence (zone within 0.8 * ATR of POC)
+1  unfilled FVG overlapping the entry zone
+1  rejection wick / impulse candle off the zone on the last 1-3 candles
+1  entry in the direction of the larger structure (last 60 candles)
-2  zone already mitigated before (stale)
-1  entry in the middle of the recent range (no man's land)

Thresholds: SAFE — trade at score >= 1. AGGRESSIVE — trade at score >= 1.
Below threshold -> WAIT and state the score in "reason".

=== SL / TP (ATR-relative, self-adjusting) ===
- SL goes beyond the nearest LIQUIDITY POOL — the recent swing extreme
  INCLUDING wicks — plus 0.5 * ATR buffer. A stop placed just beyond the
  entry candle sits inside the stop-hunt zone and gets swept before the
  move. NEVER place SL there.
- SL distance: min 1 * ATR, max 4 * ATR.
- TP: nearest realistic target (liquidity / POC / box edge) whose distance is
  GREATER than the SL distance. If the nearest target is too close, take the
  NEXT one further away.

=== HARD SAFETY RULES (never bend these) ===
1. LONG: sl < entry < tp1. SHORT: tp1 < entry < sl.
2. SKIP every trade where the TP distance is smaller than or equal to the SL
   distance. |tp1 - entry| MUST be strictly greater than |entry - sl|.
   NEVER output such a signal — pick a further TP or output WAIT
   (the executor rejects violations anyway).
3. entry within 1 * ATR of the last close.

=== OUTPUT ===
STRICTLY raw JSON, no fences, no text outside:
{
  "type": "LONG" | "SHORT" | "WAIT",
  "entry": <float>, "sl": <float>, "tp1": <float>,
  "regime": "TREND_UP" | "TREND_DOWN" | "RANGE" | "VOLATILE",
  "score": <int>,
  "setup": "<setup name>",
  "reason": "<українською: режим ринку, зона, набрані бали по факторах, логіка SL/TP; для WAIT — скільки балів не вистачило>",
  "estimated_resistance": <float>, "estimated_support": <float>
}
For WAIT: entry, sl, tp1 = 0.`;

    const userPrompt = `[MARKET DATA FEED - ${sym} M5]
RAW OHLCV CANDLES (Last 80): ${JSON.stringify(recentCandles)}
VOLUME PROFILE POINT OF CONTROL (POC): ${vp ? vp.poc_price : "Unknown"}
EXECUTION MODE: ${riskMode === 'SAFE' ? 'SAFE (Conservative)' : 'AGGRESSIVE (SMC Impulse scalp)'}

Task: Classify the regime, apply the matching playbook, score the setup and decide LONG, SHORT or WAIT. Return the raw JSON object.`;

    try {
      const response = await fetch(DEEPSEEK_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${deepseekKey}` },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
          response_format: { type: "json_object" },
          temperature: 0.35
        })
      });

      const result = await response.json();
      const aiResponse = JSON.parse(result.choices[0].message.content);

      const formattedSignal: SignalAnalysis = {
        type: aiResponse.type || 'WAIT',
        entry: aiResponse.entry || (candles.length > 0 ? +candles[candles.length - 1].close! : 0),
        sl: aiResponse.sl,
        tp1: aiResponse.tp1,
        reason: `✨ [${aiResponse.setup || 'SMC Concept'}] [${aiResponse.regime || '?'} | ${aiResponse.score ?? '?'} балів] ${aiResponse.reason}`,
        setup: aiResponse.setup || 'SMC Scalp',
        resLine: aiResponse.estimated_resistance,
        supLine: aiResponse.estimated_support,
        votes: { s1: { bullish: aiResponse.type === 'LONG' ? 2 : 0, bearish: aiResponse.type === 'SHORT' ? 2 : 0, list: [{ name: "SMC Strategy", value: aiResponse.type, status: aiResponse.type === 'LONG' ? 'bullish' : aiResponse.type === 'SHORT' ? 'bearish' : 'neutral' }] } }
      };

      setMarkets(prev => ({ ...prev, [sym]: { ...prev[sym], signal: formattedSignal } }));
      setAiStatus(aiResponse.type === 'WAIT' ? `${sym}: WAIT (${aiResponse.score ?? '?'} балів)` : `${sym}: сетап ${aiResponse.type} (${aiResponse.score ?? '?'} балів)`);
      lastAiCall.current = Date.now();

    } catch (error) {
      console.error("DeepSeek API Error:", error);
      setAiStatus(`Помилка SMC сканування ${sym}`);
    } finally {
      isAiLoading.current = false;
    }
  };

  useEffect(() => {
    if (!bridgeHost) {
      setLoading(false);
      setBridgeConnected(false);
      setAiStatus("Налаштуйте адресу MT5 бриджа (⚙)");
      return;
    }

    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connectWS = () => {
      if (stopped) return;
      const url = /^wss?:\/\//.test(bridgeHost) ? bridgeHost : `ws://${bridgeHost}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => { setLoading(false); setBridgeConnected(true); setAiStatus("З'єднано з MT5. Сканую ринки..."); };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'MULTI_CANDLES') {
            if (msg.balance !== undefined) setMt5Balance(msg.balance);
            const activePos: { ticket: number; symbol: string }[] = msg.active_positions || [];

            setMarkets(prev => {
              const next = { ...prev };
              for (const s of SYMBOLS) {
                const d = msg.symbols?.[s.sym];
                if (!d) continue;
                const currentPrice = d.candles.length > 0 ? +d.candles[d.candles.length - 1].close! : null;
                let currentTrades = prev[s.sym].trades;
                // Позиція по парі закрилась у MT5 (TP/SL/вручну) — чистимо локальний трек
                if (!activePos.some(p => p.symbol === s.sym) && currentTrades.length > 0) {
                  currentTrades = [];
                }
                next[s.sym] = { ...prev[s.sym], candles: d.candles, vp: d.volume_profile, price: currentPrice, trades: currentTrades };
              }
              return next;
            });
          }
        } catch (err) {}
      };
      ws.onclose = () => {
        setBridgeConnected(false);
        if (!stopped) reconnectTimer = setTimeout(connectWS, 5000);
      };
      ws.onerror = () => { ws.close(); };
    };

    connectWS();
    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [bridgeHost]);

  // Ротація ШІ-сканера по парах без відкритих позицій
  useEffect(() => {
    const candidates = SYMBOLS.filter(s => markets[s.sym].candles.length >= 60 && markets[s.sym].trades.length === 0);
    if (candidates.length === 0) return;
    const nextSym = candidates[scanIndex.current % candidates.length];
    scanIndex.current += 1;
    fetchDeepSeekSignal(nextSym.sym, markets[nextSym.sym].candles, markets[nextSym.sym].vp);
  }, [markets]);

  useEffect(() => {
    if (!chartRef.current || loading) return;
    if (chart.current) chart.current.remove();
    lines.current = { poc: null, res: null, sup: null };
    chart.current = createChart(chartRef.current, { width: chartRef.current.clientWidth, height: 450, layout: { background: { color: '#07070c' }, textColor: '#a1a1aa' }, grid: { vertLines: { color: '#11111f' }, horzLines: { color: '#11111f' } }, timeScale: { timeVisible: true } });
    series.current = chart.current.addCandlestickSeries({ upColor: '#10b981', downColor: '#ef4444', borderUpColor: '#10b981', borderDownColor: '#ef4444', wickUpColor: '#10b981', wickDownColor: '#ef4444' });
  }, [loading, activeSymbol]);

  useEffect(() => {
    if (!series.current || active.candles.length === 0) return;
    series.current.setData(active.candles);
    if (lines.current.poc) { series.current.removePriceLine(lines.current.poc); lines.current.poc = null; }
    if (lines.current.res) { series.current.removePriceLine(lines.current.res); lines.current.res = null; }
    if (lines.current.sup) { series.current.removePriceLine(lines.current.sup); lines.current.sup = null; }
    if (active.vp && active.vp.poc_price > 0) lines.current.poc = series.current.createPriceLine({ price: active.vp.poc_price, color: '#eab308', lineWidth: 2, lineStyle: 0, axisLabelVisible: true, title: 'POC' });
    if (active.signal?.resLine) lines.current.res = series.current.createPriceLine({ price: active.signal.resLine, color: '#ef4444', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'SMC RESIST' });
    if (active.signal?.supLine) lines.current.sup = series.current.createPriceLine({ price: active.signal.supLine, color: '#10b981', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'SMC SUPPORT' });
  }, [active.candles, active.signal, active.vp, activeSymbol]);

  const executeTradeLogic = () => {
    const totalOpen = SYMBOLS.reduce((n, s) => n + markets[s.sym].trades.length, 0);

    for (const s of SYMBOLS) {
      const m = markets[s.sym];
      if (!m.signal || m.signal.type === 'WAIT' || !m.signal.sl || !m.signal.tp1) continue;
      if (m.trades.length > 0) continue; // Одна позиція на пару
      if (totalOpen >= MAX_OPEN_POSITIONS) return; // Стеля по всіх парах

      const tradeEntry = m.signal.entry || (m.candles.length > 0 ? +m.candles[m.candles.length - 1].close! : 0);
      // Валідуємо по живій ринковій ціні, бо саме по ній виконує місток
      const execPrice = m.price || tradeEntry;

      // Перевірка напрямку стопів: для LONG SL нижче / TP вище ціни, для SHORT — навпаки
      if (m.signal.type === 'LONG' && (m.signal.sl >= execPrice || m.signal.tp1 <= execPrice)) {
        if (!isAiLoading.current) setAiStatus(`${s.sym}: відхилено — невалідні стопи для LONG`);
        continue;
      }
      if (m.signal.type === 'SHORT' && (m.signal.sl <= execPrice || m.signal.tp1 >= execPrice)) {
        if (!isAiLoading.current) setAiStatus(`${s.sym}: відхилено — невалідні стопи для SHORT`);
        continue;
      }

      const slDistance = Math.abs(execPrice - m.signal.sl);
      const tpDistance = Math.abs(m.signal.tp1 - execPrice);

      if (tpDistance <= slDistance) {
        if (!isAiLoading.current) setAiStatus(`${s.sym}: відхилено — малий RR (TP <= SL)`);
        continue;
      }

      const now = Date.now();
      if (now - m.lastTrade < COOLDOWN_MS) continue;

      const newTrade: Trade = { id: Date.now(), type: m.signal.type, entry: tradeEntry, tp1: m.signal.tp1!, sl: m.signal.sl!, openTime: new Date().toLocaleTimeString(), breakevenSet: false, setup: m.signal.setup };
      setMarkets(prev => ({ ...prev, [s.sym]: { ...prev[s.sym], trades: [newTrade], lastTrade: now } }));

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'OPEN_SPLIT', symbol: s.sym, type: m.signal.type, sl: m.signal.sl, tp1: m.signal.tp1, entry: tradeEntry, risk_mode: riskMode }));
      }
      return; // Один вхід за тік — місток і стеля контролюють решту
    }
  };

  const executeBreakevenLogic = () => {
    if (riskMode === 'AGGRESSIVE') return; // Скальп-режим: тримаємо повний обсяг до TP/SL, без БУ

    for (const s of SYMBOLS) {
      const m = markets[s.sym];
      if (m.trades.length === 0 || !m.price) continue;
      const t = m.trades[0]; if (t.breakevenSet) continue;

      let shouldLock = false;
      // Фіксація на 50% від відстані до ТР1
      if (t.type === 'LONG' && m.price >= (t.entry + (t.tp1 - t.entry) * 0.5)) shouldLock = true;
      if (t.type === 'SHORT' && m.price <= (t.entry - (t.entry - t.tp1) * 0.5)) shouldLock = true;

      if (shouldLock) {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ action: 'PARTIAL_CLOSE_AND_BU', symbol: s.sym, new_sl: t.entry }));
        }
        setMarkets(prev => ({ ...prev, [s.sym]: { ...prev[s.sym], trades: [{ ...prev[s.sym].trades[0], breakevenSet: true }] } }));
      }
    }
  };

  useEffect(() => { executeTradeLogic(); }, [markets, riskMode]);
  useEffect(() => { executeBreakevenLogic(); }, [markets, riskMode]);

  const handleClose = (sym: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'CLOSE', symbol: sym }));
    }
    setMarkets(prev => ({ ...prev, [sym]: { ...prev[sym], trades: [] } }));
  };

  const fmt = (v: number | null | undefined, digits: number) => v !== null && v !== undefined ? `$${v.toFixed(digits)}` : '$0.00';

  return (
    <div className="max-w-7xl mx-auto pb-12 bg-[#05050a] text-white min-h-screen font-sans antialiased">
      <div className="p-4 border-b border-[#121220] bg-[#07070d] sticky top-0 z-50 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${bridgeConnected ? 'bg-blue-500 animate-pulse' : 'bg-gray-600'}`} />
            <h1 className="text-sm font-black uppercase tracking-widest text-blue-400">MULTI-PAIR AI SMC BOT</h1>
          </div>
          <div className="flex bg-[#111122] rounded p-0.5 border border-[#22223a]">
            <button onClick={() => setRiskMode('SAFE')} className={`px-4 py-1.5 rounded text-xs font-bold ${riskMode === 'SAFE' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}>SAFE RISK</button>
            <button onClick={() => setRiskMode('AGGRESSIVE')} className={`px-4 py-1.5 rounded text-xs font-bold ${riskMode === 'AGGRESSIVE' ? 'bg-red-600 text-white animate-pulse' : 'text-gray-400 hover:text-white'}`}>СКАЛЬП (SMC Impulse)</button>
          </div>
        </div>
        <div className="flex items-center gap-6 text-right">
          <div>
            <div className="text-[10px] text-gray-500 uppercase font-bold">Аналітика ШІ</div>
            <div className="text-sm font-mono font-bold text-blue-400">{aiStatus}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase font-bold">Сайзинг (Safe Lot)</div>
            <div className="text-sm font-mono font-bold text-yellow-500">{getSafeLot(mt5Balance)} LOT</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase font-bold">MT5 Balance</div>
            <div className="text-sm font-mono font-bold text-gray-300">{mt5Balance !== null ? `$${mt5Balance.toLocaleString()}` : '...'}</div>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-9 h-9 rounded bg-[#111122] border border-[#22223a] text-gray-400 hover:text-white flex items-center justify-center text-base"
            title="Налаштування"
          >
            ⚙
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {!bridgeHost && (
          <div className="p-4 bg-yellow-950/30 border border-yellow-700/40 rounded-lg text-sm text-yellow-300">
            Бот не підключений до MT5. Натисніть ⚙ і вкажіть адресу бриджа (IP:порт комп'ютера з MT5 у тій самій Wi-Fi мережі).
          </div>
        )}
        {bridgeHost && !deepseekKey && (
          <div className="p-4 bg-yellow-950/30 border border-yellow-700/40 rounded-lg text-sm text-yellow-300">
            ШІ-аналіз вимкнено — додайте DeepSeek API ключ у налаштуваннях (⚙).
          </div>
        )}

        {/* Вкладки пар */}
        <div className="flex gap-2">
          {SYMBOLS.map(s => {
            const m = markets[s.sym];
            const hasTrade = m.trades.length > 0;
            return (
              <button key={s.sym} onClick={() => setActiveSymbol(s.sym)}
                className={`px-4 py-2 rounded border text-xs font-bold font-mono flex items-center gap-2 transition-all ${activeSymbol === s.sym ? 'bg-[#111128] border-blue-600/50 text-white' : 'bg-[#0a0a12] border-[#1a1a2e] text-gray-500 hover:text-white'}`}>
                <span>{s.icon} {s.sym}</span>
                <span className="text-yellow-500">{m.price ? m.price.toFixed(s.digits) : '—'}</span>
                {hasTrade && <span className={`w-2 h-2 rounded-full animate-pulse ${m.trades[0].type === 'LONG' ? 'bg-green-500' : 'bg-red-500'}`} />}
              </button>
            );
          })}
        </div>

        <div className="border border-[#131322] rounded-lg overflow-hidden bg-[#07070d]">
          <div className="p-3 bg-[#0a0a15] border-b border-[#1a1a2e] flex justify-between items-center">
            <span className="text-sm font-black text-white uppercase tracking-wider">{activeMeta.icon} {activeMeta.label} (M5 + SMC Advice)</span>
            <span className="text-xl font-mono font-black text-yellow-400">{fmt(active.price, activeMeta.digits)}</span>
          </div>

          <div className="p-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3">
              {loading ? <div className="w-full h-[450px] bg-[#07070c] flex items-center justify-center text-gray-600 text-sm">СИНХРОНІЗАЦІЯ З MT5 ENGINE...</div> : <div ref={chartRef} className="w-full h-[450px] bg-[#07070c] rounded overflow-hidden" />}
            </div>
            <div className="bg-[#07070d] border border-[#131322] rounded p-3 flex flex-col h-[450px]">
              <span className="text-[10px] font-bold text-gray-500 uppercase border-b border-[#19192c] pb-2 mb-3">Volume Profile</span>
              <div className="flex-1 flex flex-col justify-between overflow-y-hidden">
                {active.vp ? [...active.vp.bins].reverse().map((bin, i) => {
                  const isPoc = Math.abs((bin.price_start + bin.price_end)/2 - active.vp!.poc_price) < (bin.price_end - bin.price_start);
                  return (<div key={i} className="flex items-center text-[10px] font-mono h-3"><span className={`w-16 z-10 ${isPoc ? 'text-yellow-400 font-bold' : 'text-gray-600'}`}>{bin.price_start.toFixed(activeMeta.digits === 2 ? 1 : activeMeta.digits)}</span><div className="flex-1 h-full bg-[#10101f] rounded-sm overflow-hidden"><div className={`h-full ${isPoc ? 'bg-yellow-500/60' : 'bg-blue-600/30'}`} style={{ width: `${bin.relative_volume * 100}%` }} /></div></div>);
                }) : <div className="text-center text-gray-700 text-xs my-auto">Очікування...</div>}
              </div>
            </div>
          </div>

          {active.signal && <div className="px-4 py-3 text-sm font-mono text-gray-300 border-t border-[#121220] min-h-[50px] bg-[#0b0b14]">{active.signal.reason}</div>}
        </div>

        {SYMBOLS.flatMap(s => markets[s.sym].trades.map(t => (
          <div key={`${s.sym}-${t.id}`} className="p-4 bg-[#090912] border border-green-600/20 rounded-lg flex justify-between items-center font-mono text-sm">
            <div>
              <span className={`px-2 py-1 rounded text-xs font-bold ${t.type === 'LONG' ? 'bg-green-950 text-green-400' : 'bg-red-950 text-red-400'}`}>
                {s.icon} {s.sym} {t.type} ACTIVE [{t.setup}] {t.breakevenSet && "💸 ФІКС 70% + БУ ЗАФІКСОВАНО"}
              </span>
              <div className="text-gray-400 mt-2 text-xs">Вхід: {fmt(t.entry, s.digits)} | SL: <span className="text-red-400">{fmt(t.sl, s.digits)}</span> | TP1: <span className="text-green-400 font-bold">{fmt(t.tp1, s.digits)}</span></div>
            </div>
            <button onClick={() => handleClose(s.sym)} className="px-4 py-2 bg-[#151522] border border-[#232336] rounded text-xs hover:bg-red-950/40 hover:text-red-400 transition-all">Закрити у MT5</button>
          </div>
        )))}
      </div>

      <SmcSettingsModal
        open={settingsOpen}
        bridgeHost={bridgeHost}
        deepseekKey={deepseekKey}
        onClose={() => setSettingsOpen(false)}
        onSave={saveSettings}
      />
    </div>
  );
}
