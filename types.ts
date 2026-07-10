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
