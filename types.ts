export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorData {
  time: number;
  value: number;
}

export type MarketRegime = 'STRONG_TREND' | 'NORMAL_TREND' | 'RANGE_CHOP' | 'ACCUMULATION_DISTRIBUTION';
export type TrendDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type SignalStatus = 'ACTIVE' | 'POTENTIAL' | 'NO_TRADE';

export interface AnalysisResult {
  // Market Context
  regime: MarketRegime;
  trend: TrendDirection;
  rsi: number;
  ema9: number;
  ema21: number;
  orderBookBias: number;
  
  // Signal Specifics
  status: SignalStatus;
  direction: 'LONG' | 'SHORT' | 'NONE';
  confidenceScore: number; // 0 to 100
  
  // Trade Parameters
  price: number;
  entryPrice: number;
  stopLoss: number;
  takeProfits: number[]; // [TP1 (Conservative), TP2 (Target), TP3 (Extended)]
  riskReward: number; // Based on TP2
  
  // Reasoning
  confirmations: string[]; // Why we are taking it
  blockingReasons: string[]; // Why we are NOT taking it
}

export interface OrderBookEntry {
  price: number;
  quantity: number;
  total: number;
}

export interface OrderBookState {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  lastUpdate: number;
}

export interface WatchedPair {
  id?: number;
  user_id?: string;
  symbol: string;
}

export interface Note {
  id: number;
  user_id: string;
  symbol: string;
  content: string;
  created_at: string;
}

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  published_at: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export type ExchangeName = 'BINANCE' | 'BYBIT' | 'OKX';

export interface ExchangeConfig {
  name: ExchangeName;
  apiKey: string;
  apiSecret: string;
  passphrase?: string; // Required for OKX
  isTestnet?: boolean;
}