import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { TradeBotSettings, TradedSymbol, Candle, AiSignal, OpenTrade, JournalReview } from './types';
import {
  DEFAULT_SYMBOLS, DEFAULT_LEVERAGE, MAX_OPEN_POSITIONS, TRADE_SETTINGS_KEY,
  GREETING_SEEN_KEY, REVIEW_INTERVAL_MS, getStakeUSDT,
} from './constants';
import * as bingx from './services/bingx';
import { fetchTradingSignal, generateJournalReview } from './services/aiTrader';
import { computePocPrice } from './services/marketUtils';
import {
  getJournal, computeStats, getReviews, saveReview, isReviewDue, entriesSince,
  lastReviewAt, latestLessons, recordClosedTrade, getOpenTrades, addOpenTrade, removeOpenTrade,
} from './services/journal';
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
  const journalRef = useRef(journalEntries);

  useEffect(() => { marketsRef.current = markets; }, [markets]);
  useEffect(() => { openTradesRef.current = openTrades; }, [openTrades]);
  useEffect(() => { journalRef.current = journalEntries; }, [journalEntries]);

  const creds: bingx.BingXCreds = { apiKey: settings.bingxApiKey, apiSecret: settings.bingxApiSecret };
  const hasCreds = !!(settings.bingxApiKey && settings.bingxApiSecret);
  const live = hasCreds && settings.liveTradingEnabled;
  const stakeUSDT = getStakeUSDT(balance?.balance ?? null);

  const dismissGreeting = () => {
    try { localStorage.setItem(GREETING_SEEN_KEY, '1'); } catch { /* ignore */ }
    setShowGreeting(false);
  };

  const saveSettings = (s: TradeBotSettings) => {
    persistSettings(s);
    setSettings(s);
  };

  // ── Contract precision (fetched once, public endpoint) ──────────────────
  useEffect(() => {
    bingx.getContracts().then(list => {
      const map: Record<string, bingx.BingXContract> = {};
      for (const c of list) map[c.symbol] = c;
      contractsRef.current = map;
    }).catch(() => { /* ignore, fall back to default precision */ });
  }, []);

  // ── Reconcile: a locally tracked trade whose BingX position vanished (TP/SL/manual) ──
  const reconcileClosedTrades = useCallback((livePositions: bingx.BingXPosition[], latestMarkets: Record<string, MarketState>) => {
    const openSymbols = new Set(livePositions.map(p => p.symbol));
    const trades = openTradesRef.current;
    const remaining: OpenTrade[] = [];
    let changed = false;
    for (const t of trades) {
      if (openSymbols.has(t.symbol)) { remaining.push(t); continue; }
      changed = true;
      const exitPrice = latestMarkets[t.symbol]?.price ?? marketsRef.current[t.symbol]?.price ?? t.entry;
      const entry = recordClosedTrade(t, exitPrice);
      removeOpenTrade(t.id);
      setJournalEntries(prev => [entry, ...prev]);
    }
    if (changed) setOpenTrades(remaining);
  }, []);

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
      }
    };

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { stopped = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCreds, settings.bingxApiKey, settings.bingxApiSecret]);

  // ── AI scan rotation across symbols without an open trade ────────────────
  const runAiScan = useCallback(async (s: TradedSymbol) => {
    isAiLoadingRef.current = true;
    lastAiCallRef.current = Date.now();
    setAiStatus(`Аналізую ${s.symbol}...`);
    try {
      const m = marketsRef.current[s.symbol];
      const pocPrice = computePocPrice(m.candles);
      const stats = computeStats(journalRef.current);
      const lessons = latestLessons();
      const signal = await fetchTradingSignal(settings.deepseekKey, s.symbol, s.market, m.candles, pocPrice, lessons, stats);
      setMarkets(prev => ({ ...prev, [s.symbol]: { ...prev[s.symbol], signal } }));
      setAiStatus(signal.type === 'WAIT' ? `${s.symbol}: WAIT (${signal.score} балів)` : `${s.symbol}: сетап ${signal.type} (${signal.score} балів)`);
    } catch {
      setAiStatus(`Помилка ШІ-аналізу ${s.symbol}`);
    } finally {
      isAiLoadingRef.current = false;
    }
  }, [settings.deepseekKey]);

  useEffect(() => {
    if (!settings.deepseekKey) { setAiStatus('Додайте DeepSeek API ключ у налаштуваннях (⚙)'); return; }
    if (isAiLoadingRef.current) return;
    if (Date.now() - lastAiCallRef.current < AI_SCAN_COOLDOWN_MS) return;

    const candidates = symbols.filter(s => (markets[s.symbol]?.candles.length ?? 0) >= 60 && !openTrades.some(t => t.symbol === s.symbol));
    if (candidates.length === 0) return;

    const target = candidates[scanIndexRef.current % candidates.length];
    scanIndexRef.current += 1;
    runAiScan(target);
  }, [markets, openTrades, settings.deepseekKey, runAiScan]);

  // ── Trade execution ───────────────────────────────────────────────────────
  const openTradeOnBingx = useCallback(async (s: TradedSymbol, sig: AiSignal, execPrice: number) => {
    const stake = getStakeUSDT(balance?.balance ?? null);
    const contract = contractsRef.current[s.symbol];
    const qtyRaw = (stake * settings.leverage) / execPrice;
    const qty = contract ? bingx.roundToPrecision(qtyRaw, contract.quantityPrecision) : Number(qtyRaw.toFixed(3));
    if (qty <= 0) { setAiStatus(`${s.symbol}: ставка занадто мала для мінімального розміру контракту`); return; }

    const positionSide: 'LONG' | 'SHORT' = sig.type === 'LONG' ? 'LONG' : 'SHORT';
    const side: bingx.OrderSide = sig.type === 'LONG' ? 'BUY' : 'SELL';
    const leverageKey = `${s.symbol}-${positionSide}`;

    try {
      if (!leverageSetRef.current.has(leverageKey)) {
        await bingx.setLeverage(creds, s.symbol, positionSide, settings.leverage);
        leverageSetRef.current.add(leverageKey);
      }
      await bingx.placeMarketOrder(creds, {
        symbol: s.symbol, side, positionSide, quantity: qty,
        stopLossPrice: sig.sl, takeProfitPrice: sig.tp1,
      });

      const trade: OpenTrade = {
        id: crypto.randomUUID(), symbol: s.symbol, side: sig.type as 'LONG' | 'SHORT',
        entry: execPrice, sl: sig.sl, tp1: sig.tp1, quantity: qty, stakeUSDT: stake,
        leverage: settings.leverage, setup: sig.setup, aiReason: sig.reason, openedAt: Date.now(),
      };
      addOpenTrade(trade);
      setOpenTrades(prev => [...prev, trade]);
      lastTradeAtRef.current[s.symbol] = Date.now();
      setAiStatus(`${s.symbol}: відкрито ${sig.type} на BingX (ставка $${stake}, ${settings.leverage}x)`);
    } catch (e: any) {
      setAiStatus(`${s.symbol}: помилка відкриття ордера — ${e?.message ?? e}`);
    }
  }, [balance, creds, settings.leverage]);

  useEffect(() => {
    if (!live) return;
    if (openTradesRef.current.length >= MAX_OPEN_POSITIONS) return;

    for (const s of symbols) {
      if (openTradesRef.current.some(t => t.symbol === s.symbol)) continue;
      const m = marketsRef.current[s.symbol];
      const sig = m?.signal;
      if (!sig || sig.type === 'WAIT' || !sig.sl || !sig.tp1) continue;

      const now = Date.now();
      if (now - (lastTradeAtRef.current[s.symbol] ?? 0) < SYMBOL_TRADE_COOLDOWN_MS) continue;

      const execPrice = m.price ?? sig.entry;
      if (sig.type === 'LONG' && (sig.sl >= execPrice || sig.tp1 <= execPrice)) continue;
      if (sig.type === 'SHORT' && (sig.sl <= execPrice || sig.tp1 >= execPrice)) continue;

      const slDist = Math.abs(execPrice - sig.sl);
      const tpDist = Math.abs(sig.tp1 - execPrice);
      if (tpDist <= slDist) continue;

      lastTradeAtRef.current[s.symbol] = now; // reserve slot before await to avoid double-fire
      openTradeOnBingx(s, sig, execPrice);
      break; // one entry per tick, cap + cooldown control the rest
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markets, live, openTradeOnBingx]);

  const handleCloseTrade = async (tradeId: string) => {
    const trade = openTrades.find(t => t.id === tradeId);
    if (!trade) return;
    try {
      const pos = positions.find(p => p.symbol === trade.symbol);
      if (pos) await bingx.closePosition(creds, pos);
      const exitPrice = markets[trade.symbol]?.price ?? trade.entry;
      const entry = recordClosedTrade(trade, exitPrice);
      removeOpenTrade(trade.id);
      setOpenTrades(prev => prev.filter(t => t.id !== tradeId));
      setJournalEntries(prev => [entry, ...prev]);
    } catch (e: any) {
      setAiStatus(`Помилка закриття ${trade.symbol}: ${e?.message ?? e}`);
    }
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
            <div className="text-[10px] text-gray-500 uppercase font-bold">Баланс BingX</div>
            <div className="text-sm font-mono font-bold text-gray-300">{balance ? `$${balance.balance.toLocaleString()}` : '...'}</div>
          </div>
          <button onClick={() => setSettingsOpen(true)} className="w-9 h-9 rounded bg-[#111122] border border-[#22223a] text-gray-400 hover:text-white flex items-center justify-center text-base" title="Налаштування">
            ⚙
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {!hasCreds && (
          <div className="p-4 bg-yellow-950/30 border border-yellow-700/40 rounded-lg text-sm text-yellow-300">
            Бот не підключений до BingX. Натисніть ⚙ і додайте API ключ та секрет.
          </div>
        )}
        {hasCreds && !settings.deepseekKey && (
          <div className="p-4 bg-yellow-950/30 border border-yellow-700/40 rounded-lg text-sm text-yellow-300">
            ШІ-аналіз вимкнено — додайте DeepSeek API ключ у налаштуваннях (⚙).
          </div>
        )}
        {hasCreds && !settings.liveTradingEnabled && (
          <div className="p-4 bg-blue-950/30 border border-blue-700/40 rounded-lg text-sm text-blue-300">
            Реальна торгівля вимкнена — бот тільки рахує сигнали, ордери на BingX не відправляються.
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
            onCloseTrade={handleCloseTrade}
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
