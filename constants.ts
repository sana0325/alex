import { AppSettings, TradedSymbol } from './types';

export const SYMBOL = 'XAU/USD';
export const SYMBOL_DISPLAY = 'XAUUSD';

export const TIMEFRAME_OPTIONS = [
  { value: 'M5',  label: '5 min',  api: '5min' },
  { value: 'M15', label: '15 min', api: '15min' },
  { value: 'M30', label: '30 min', api: '30min' },
];

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  apiProvider: 'twelvedata',
  timeframe: 'M5',
  longThreshold: 15,
  shortThreshold: 15,
  slMultiplier: 1.5,
  tpMultiplier: 2.5,
  sessionStartUTC: 7,
  sessionEndUTC: 20,
  minAdx: 18,
  notificationsEnabled: true,
  refreshSeconds: 30,
  contrarian: true,
};

export const SETTINGS_KEY = 'gold_scalp_settings';

export const CANDLES_NEEDED = 250;

export const INDICATOR_GROUPS = {
  trend: { label: 'Тренд', color: '#60A5FA' },
  momentum: { label: 'Моментум', color: '#A78BFA' },
  oscillator: { label: 'Осцилятор', color: '#F472B6' },
  channel: { label: 'Канал/Обсяг', color: '#34D399' },
  support: { label: 'Фільтри', color: '#9CA3AF' },
};

// ─── Multi-market scalp bot (BingX) ─────────────────────────────────────────

// PAXG-USDT (Pax Gold, ~1 token = 1 oz gold) is used as the gold proxy since
// BingX's public trading API only covers its USDT-M perpetual swap market —
// there is no scriptable classic XAUUSD forex/metals endpoint on that API.
// A wide, liquid basket so the bot has many places to look for a setup
// instead of waiting on a single pair — it rotates the AI scan across all of
// them and only ever acts on the single best one (see MAX_OPEN_POSITIONS).
export const DEFAULT_SYMBOLS: TradedSymbol[] = [
  { symbol: 'PAXG-USDT', label: 'GOLD (PAXG)', icon: '🥇', market: 'gold', digits: 2 },
  { symbol: 'BTC-USDT', label: 'BITCOIN', icon: '₿', market: 'crypto', digits: 1 },
  { symbol: 'ETH-USDT', label: 'ETHEREUM', icon: 'Ξ', market: 'crypto', digits: 2 },
  { symbol: 'SOL-USDT', label: 'SOLANA', icon: '◎', market: 'crypto', digits: 3 },
  { symbol: 'BNB-USDT', label: 'BNB', icon: '🔶', market: 'crypto', digits: 2 },
  { symbol: 'XRP-USDT', label: 'XRP', icon: '✕', market: 'crypto', digits: 4 },
  { symbol: 'DOGE-USDT', label: 'DOGECOIN', icon: '🐕', market: 'crypto', digits: 5 },
  { symbol: 'ADA-USDT', label: 'CARDANO', icon: '🔷', market: 'crypto', digits: 4 },
  { symbol: 'LINK-USDT', label: 'CHAINLINK', icon: '🔗', market: 'crypto', digits: 3 },
  { symbol: 'AVAX-USDT', label: 'AVALANCHE', icon: '🔺', market: 'crypto', digits: 2 },
  { symbol: 'LTC-USDT', label: 'LITECOIN', icon: 'Ł', market: 'crypto', digits: 2 },
  { symbol: 'TON-USDT', label: 'TON', icon: '💎', market: 'crypto', digits: 3 },
];

export const DEFAULT_LEVERAGE = 20;

// Strictly sequential: the bot never opens a new trade until the current one
// (filled position OR a still-pending limit order) is fully done. One thing
// at a time, however many pairs it's scanning across.
export const MAX_OPEN_POSITIONS = 1;

// A resting limit entry that hasn't filled within this window, or whose
// price has drifted too far from the market, gets cancelled so the bot can
// look elsewhere instead of leaving a stale order hanging over the one slot.
export const LIMIT_ORDER_TIMEOUT_MS = 3 * 60 * 1000;
export const LIMIT_ORDER_MAX_DRIFT_PCT = 0.4; // % move away from the limit price

// Starting virtual balance for paper/demo trading when BingX isn't connected
// or LIVE is switched off — the bot still trades (on paper) and learns.
export const PAPER_START_BALANCE = 200;
export const PAPER_BALANCE_KEY = 'scalp_bot_paper_balance_v1';
export const PENDING_ORDER_KEY = 'scalp_bot_pending_order_v1';

// Stake ladder: how much USDT margin goes into a single trade, tied to the
// current account balance. Grows as the account grows, resets down if the
// balance drops back into a lower tier — never risk more than the tier allows.
export const STAKE_LADDER: { maxBalance: number; stakeUSDT: number }[] = [
  { maxBalance: 200, stakeUSDT: 2 },
  { maxBalance: 500, stakeUSDT: 10 },
  { maxBalance: 1500, stakeUSDT: 20 },
  { maxBalance: 5000, stakeUSDT: 50 },
  { maxBalance: 15000, stakeUSDT: 100 },
  { maxBalance: 50000, stakeUSDT: 250 },
  { maxBalance: Infinity, stakeUSDT: 500 },
];

export function getStakeUSDT(balance: number | null): number {
  if (!balance || balance <= 0) return STAKE_LADDER[0].stakeUSDT;
  const tier = STAKE_LADDER.find(t => balance < t.maxBalance);
  return tier ? tier.stakeUSDT : STAKE_LADDER[STAKE_LADDER.length - 1].stakeUSDT;
}

export const JOURNAL_KEY = 'scalp_bot_journal_v1';
export const REVIEWS_KEY = 'scalp_bot_reviews_v1';
export const TRADE_SETTINGS_KEY = 'scalp_bot_settings_v1';
export const REVIEW_INTERVAL_MS = 2 * 24 * 60 * 60 * 1000; // 2 days
export const GREETING_SEEN_KEY = 'scalp_bot_greeting_seen_v1';
