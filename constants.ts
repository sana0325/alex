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
export const DEFAULT_SYMBOLS: TradedSymbol[] = [
  { symbol: 'PAXG-USDT', label: 'GOLD (PAXG)', icon: '🥇', market: 'gold', digits: 2 },
  { symbol: 'BTC-USDT', label: 'BITCOIN', icon: '₿', market: 'crypto', digits: 1 },
  { symbol: 'ETH-USDT', label: 'ETHEREUM', icon: 'Ξ', market: 'crypto', digits: 2 },
  { symbol: 'SOL-USDT', label: 'SOLANA', icon: '◎', market: 'crypto', digits: 3 },
];

export const DEFAULT_LEVERAGE = 20;

export const MAX_OPEN_POSITIONS = 2;

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
