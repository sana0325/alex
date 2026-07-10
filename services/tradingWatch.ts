import { registerPlugin } from '@capacitor/core';

// Bridges to android/.../TradingServicePlugin.java + TradingWatchService.java —
// the bot's whole trading brain (scan symbols -> ask DeepSeek -> validate ->
// open -> watch -> close -> scan again), running natively so it keeps going
// whether the app is open, backgrounded, or the screen is locked. The
// WebView hands this off on backgrounding (with a snapshot of settings,
// symbols, stake ladder, learning context, and whatever's already open) and
// reclaims it — stopping the service — whenever the app is opened, draining
// whatever happened while away into the same journal.

export interface TradingWatchSymbol {
  symbol: string;
  market: 'crypto' | 'gold';
}

export interface TradingWatchStakeTier {
  maxBalance: number;
  stakeUSDT: number;
}

export interface TradingWatchActiveTrade {
  tradeId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entry: number;
  sl: number;
  tp1: number;
  stakeUSDT: number;
  leverage: number;
  setup: string;
  aiReason: string;
  openedAt: number;
  simulated: boolean;
  quantity?: number;
}

export interface TradingWatchActivePending {
  tradeId: string;
  orderId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  price: number;
  sl: number;
  tp1: number;
  stakeUSDT: number;
  leverage: number;
  setup: string;
  aiReason: string;
  placedAt: number;
}

export interface TradingWatchPayload {
  apiKey: string;
  apiSecret: string;
  deepseekKey: string;
  leverage: number;
  live: boolean;
  symbols: TradingWatchSymbol[];
  stakeLadder: TradingWatchStakeTier[];
  paperBalance: number;
  lessons: string;
  statsJson: string;
  activeTrade?: TradingWatchActiveTrade;
  activePending?: TradingWatchActivePending;
}

export interface TradingWatchEvent {
  type: 'entry' | 'filled' | 'closed' | 'cancelled';
  filled?: boolean; // for type "entry": true = demo instant fill, false = live resting limit order
  tradeId: string;
  orderId?: string;
  symbol: string;
  side?: 'LONG' | 'SHORT';
  price?: number;   // "entry" (unfilled) uses this for the limit price
  entry?: number;
  exit?: number;
  sl?: number;
  tp1?: number;
  stakeUSDT?: number;
  leverage?: number;
  pnlUSDT?: number;
  pnlPercent?: number;
  outcome?: 'WIN' | 'LOSS' | 'BREAKEVEN';
  setup?: string;
  aiReason?: string;
  openedAt?: number;
  placedAt?: number;
  closedAt?: number;
  simulated?: boolean;
}

interface TradingWatchPlugin {
  start(options: { payload: string }): Promise<void>;
  stop(): Promise<void>;
  pollClosedEvents(): Promise<{ eventsJson: string }>;
}

const TradingWatch = registerPlugin<TradingWatchPlugin>('TradingWatch');

export async function startTradingWatch(payload: TradingWatchPayload): Promise<void> {
  try {
    await TradingWatch.start({ payload: JSON.stringify(payload) });
  } catch {
    /* not on a native Android build (e.g. browser dev) — ignore */
  }
}

export async function stopTradingWatch(): Promise<void> {
  try {
    await TradingWatch.stop();
  } catch {
    /* ignore */
  }
}

export async function drainTradingWatchEvents(): Promise<TradingWatchEvent[]> {
  try {
    const res = await TradingWatch.pollClosedEvents();
    const parsed = JSON.parse(res.eventsJson || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
