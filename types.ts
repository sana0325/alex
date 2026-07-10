export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type VoteDirection = 'LONG' | 'SHORT' | 'NONE';

export interface IndicatorVote {
  id: number;
  name: string;
  group: 'trend' | 'momentum' | 'oscillator' | 'channel' | 'support';
  direction: VoteDirection;
  value: number;
  description: string;
  isSignal: boolean;
}

export interface SupportData {
  atr: number;
  bbWidth: number;
  adxStrength: number;
  pivotPP: number;
  pivotR1: number;
  pivotS1: number;
  volumeRatio: number;
  inSession: boolean;
  sessionName: string;
}

export interface GoldSignal {
  direction: VoteDirection;
  longVotes: number;
  shortVotes: number;
  neutralVotes: number;
  totalSignalIndicators: number;
  score: number;
  confidence: number;
  votes: IndicatorVote[];
  support: SupportData;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  timestamp: number;
  timeframe: string;
  filtersOk: boolean;
  filterReasons: string[];
  isContrarian: boolean;
}

export interface AppSettings {
  apiKey: string;
  apiProvider: 'twelvedata' | 'manual';
  timeframe: 'M5' | 'M15' | 'M30';
  longThreshold: number;
  shortThreshold: number;
  slMultiplier: number;
  tpMultiplier: number;
  sessionStartUTC: number;
  sessionEndUTC: number;
  minAdx: number;
  notificationsEnabled: boolean;
  refreshSeconds: number;
  contrarian: boolean;
}

export interface PriceBar {
  time: number;
  price: number;
}

// ─── Freelance Hub types ────────────────────────────────────────────────────

export type PlatformCategory = 'dev' | 'design' | 'writing' | 'microtask' | 'content' | 'data' | 'general';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Currency = 'USD' | 'UAH' | 'EUR';

export interface FreelancePlatform {
  id: string;
  name: string;
  category: PlatformCategory;
  description: string;
  earning: string;
  difficulty: Difficulty;
  pros: string[];
  icon: string;
  color: string;
}

export interface EarningEntry {
  id: string;
  platform: string;
  amount: number;
  currency: Currency;
  date: string;
  task: string;
}

export interface FreelanceProfile {
  name: string;
  title: string;
  bio: string;
  skills: string[];
  hourlyRate: number;
  currency: Currency;
}

// ─── Multi-market scalp bot (BingX) types ───────────────────────────────────

export interface TradedSymbol {
  symbol: string;   // BingX contract symbol, e.g. "BTC-USDT"
  label: string;
  icon: string;
  market: 'crypto' | 'gold';
  digits: number;
}

export interface AiSignal {
  type: 'LONG' | 'SHORT' | 'WAIT';
  entry: number;
  sl: number;
  tp1: number;
  regime: string;
  score: number;
  setup: string;
  reason: string;
  resLine?: number;
  supLine?: number;
  timestamp: number;
}

export interface OpenTrade {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entry: number;
  sl: number;
  tp1: number;
  quantity: number;
  stakeUSDT: number;
  leverage: number;
  setup: string;
  aiReason: string;
  openedAt: number;
  simulated?: boolean; // paper trade — no real order was ever placed
}

// A resting maker-only limit entry, waiting to fill on BingX. Occupies the
// single trade slot just like a filled OpenTrade — the bot won't consider
// another symbol until this fills or gets cancelled.
export interface PendingOrder {
  id: string;
  orderId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  price: number;
  sl: number;
  tp1: number;
  quantity: number;
  stakeUSDT: number;
  leverage: number;
  setup: string;
  aiReason: string;
  placedAt: number;
}

export type JournalOutcome = 'WIN' | 'LOSS' | 'BREAKEVEN';

export interface JournalEntry {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entry: number;
  exit: number;
  sl: number;
  tp1: number;
  stakeUSDT: number;
  leverage: number;
  pnlUSDT: number;
  pnlPercent: number;
  outcome: JournalOutcome;
  setup: string;
  aiReason: string;
  openedAt: number;
  closedAt: number;
  simulated?: boolean;
}

export interface JournalReview {
  id: string;
  createdAt: number;
  periodFrom: number;
  periodTo: number;
  tradesAnalyzed: number;
  winRate: number;
  summary: string;      // AI-written breakdown: what worked, what didn't
  lessons: string;       // distilled rules fed back into the next trading prompt
}

export interface TradeBotSettings {
  bingxApiKey: string;
  bingxApiSecret: string;
  deepseekKey: string;
  leverage: number;
  liveTradingEnabled: boolean;
}
