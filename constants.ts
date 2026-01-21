export const DEFAULT_PAIRS = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'BNBUSDT',
  'XRPUSDT',
  'ADAUSDT',
  'DOGEUSDT'
];

export const TIMEFRAMES = {
  SHORT: '15m',
  MEDIUM: '1h', // Default trend timeframe
  LONG: '4h'
};

// Binance Websocket Base
export const BINANCE_WS_BASE = 'wss://stream.binance.com:9443/ws';
export const BINANCE_API_BASE = 'https://api.binance.com/api/v3';

// Mock news if API not available
export const MOCK_NEWS = [
  { id: '1', title: 'Bitcoin Reclaims Key Level Amidst Spot ETF Inflows', source: 'CoinDesk', url: '#', published_at: new Date().toISOString(), sentiment: 'positive' },
  { id: '2', title: 'Ethereum Foundation Update: Roadmap Adjustments', source: 'TheBlock', url: '#', published_at: new Date(Date.now() - 3600000).toISOString(), sentiment: 'neutral' },
  { id: '3', title: 'Solana Activity Surges to New Highs', source: 'Decrypt', url: '#', published_at: new Date(Date.now() - 7200000).toISOString(), sentiment: 'positive' },
  { id: '4', title: 'Regulatory Uncertainties Continue to Weigh on Alts', source: 'Reuters', url: '#', published_at: new Date(Date.now() - 10800000).toISOString(), sentiment: 'negative' },
  { id: '5', title: 'Whale Movement Detected: 5000 BTC Transferred', source: 'WhaleAlert', url: '#', published_at: new Date(Date.now() - 14400000).toISOString(), sentiment: 'neutral' }
] as const;