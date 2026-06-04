import { AppSettings } from './types';

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
