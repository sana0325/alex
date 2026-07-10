import { registerPlugin } from '@capacitor/core';

// Bridges to android/.../TradingServicePlugin.java + TradingWatchService.java —
// a native foreground service that keeps polling BingX for the ONE live trade
// slot even after Android throttles the WebView's own JS timers in the
// background. Only meaningful for real (non-simulated) trades: paper trades
// only exist inside the JS simulation, nothing to poll on the exchange.

export interface TradingWatchPayload {
  apiKey: string;
  apiSecret: string;
  mode: 'order' | 'position';
  symbol: string;
  side: 'LONG' | 'SHORT';
  orderId?: string;
  tradeId: string;
  entry: number;
  sl: number;
  tp1: number;
  stakeUSDT: number;
  leverage: number;
  setup: string;
  aiReason: string;
  openedAt: number;
}

export interface TradingWatchClosedEvent {
  type: 'closed' | 'cancelled';
  tradeId: string;
  symbol: string;
  side?: 'LONG' | 'SHORT';
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
  closedAt?: number;
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

export async function drainTradingWatchEvents(): Promise<TradingWatchClosedEvent[]> {
  try {
    const res = await TradingWatch.pollClosedEvents();
    const parsed = JSON.parse(res.eventsJson || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
