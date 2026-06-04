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
  isSignal: boolean; // true = one of 26 signal indicators
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
  totalSignalIndicators: number;    // always 26
  score: number;                    // longVotes - shortVotes
  confidence: number;               // 0–100 %
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
  apiKey: string;           // TwelveData API key (free: 800/day)
  apiProvider: 'twelvedata' | 'manual';
  timeframe: 'M5' | 'M15' | 'M30';
  longThreshold: number;    // default 15
  shortThreshold: number;   // default 15
  slMultiplier: number;     // ATR × this
  tpMultiplier: number;     // ATR × this
  sessionStartUTC: number;  // 7
  sessionEndUTC: number;    // 20
  minAdx: number;           // 20
  notificationsEnabled: boolean;
  refreshSeconds: number;   // 30
  contrarian: boolean;      // trade against indicators
}

export interface PriceBar {
  time: number;
  price: number;
}
