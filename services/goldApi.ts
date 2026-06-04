import { Candle } from '../types';
import { AppSettings, CANDLES_NEEDED } from '../constants';

const TF_MAP: Record<string, string> = { M5: '5min', M15: '15min', M30: '30min' };

export async function fetchGoldCandles(settings: AppSettings): Promise<Candle[]> {
  if (settings.apiProvider === 'twelvedata' && settings.apiKey) {
    return fetchTwelveData(settings);
  }
  throw new Error('Введіть API ключ TwelveData в налаштуваннях');
}

async function fetchTwelveData(settings: AppSettings): Promise<Candle[]> {
  const interval = TF_MAP[settings.timeframe] ?? '5min';
  const url = `https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=${interval}&outputsize=${CANDLES_NEEDED}&apikey=${settings.apiKey}&format=JSON&order=ASC`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`TwelveData HTTP ${res.status}`);
  const data = await res.json();
  if (data.status === 'error') throw new Error(data.message || 'TwelveData помилка');
  if (!data.values || !Array.isArray(data.values)) throw new Error('Немає даних від TwelveData');

  return data.values.map((v: Record<string, string>) => ({
    time: Math.floor(new Date(v.datetime).getTime() / 1000),
    open: parseFloat(v.open),
    high: parseFloat(v.high),
    low: parseFloat(v.low),
    close: parseFloat(v.close),
    volume: parseFloat(v.volume ?? '0'),
  }));
}

export async function fetchCurrentPrice(apiKey: string): Promise<number | null> {
  try {
    const url = `https://api.twelvedata.com/price?symbol=XAU/USD&apikey=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.price ? parseFloat(data.price) : null;
  } catch {
    return null;
  }
}
