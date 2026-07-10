import { registerPlugin } from '@capacitor/core';

// Bridges to android/.../TradingServicePlugin.java + TradingWatchService.java —
// a native foreground service that keeps watching the ONE open trade slot
// even after Android throttles the WebView's own JS timers in the
// background. Works for both a real BingX position/order (signed HTTP
// calls) and a paper/demo trade (public price polling, same SL/TP math as
// the JS simulator) — background behavior is the same either way.

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
  simulated: boolean;
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

export async function drainTradingWatchEvents(): Promise<TradingWatchClosedEvent[]> {
  try {
    const res = await TradingWatch.pollClosedEvents();
    const parsed = JSON.parse(res.eventsJson || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
