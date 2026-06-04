import { AppSettings } from './types';

export const SYMBOL_OPTIONS = [
  { value: 'XAU/USD', display: 'XAUUSD', label: 'Gold',    icon: '🥇' },
  { value: 'EUR/USD', display: 'EURUSD', label: 'EUR/USD', icon: '€'  },
  { value: 'GBP/USD', display: 'GBPUSD', label: 'GBP/USD', icon: '£'  },
  { value: 'USD/JPY', display: 'USDJPY', label: 'USD/JPY', icon: '¥'  },
  { value: 'USD/CHF', display: 'USDCHF', label: 'USD/CHF', icon: '₣'  },
  { value: 'AUD/USD', display: 'AUDUSD', label: 'AUD/USD', icon: 'A'  },
  { value: 'USD/CAD', display: 'USDCAD', label: 'USD/CAD', icon: 'C'  },
  { value: 'NZD/USD', display: 'NZDUSD', label: 'NZD/USD', icon: 'N'  },
];

export const TIMEFRAME_OPTIONS = [
  { value: 'M5',  label: '5 min',  api: '5min' },
  { value: 'M15', label: '15 min', api: '15min' },
  { value: 'M30', label: '30 min', api: '30min' },
];

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  apiProvider: 'twelvedata',
  symbol: 'XAU/USD',
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
  contrarian: false,
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
