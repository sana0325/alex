import { Candle, OrderBookState } from '../types';
import { BINANCE_API_BASE } from '../constants';

// Helper for robust fetching with exponential backoff
const fetchWithRetry = async (url: string, retries = 3, delay = 1000): Promise<Response> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 429) {
        // Rate limit hit, wait longer
        await new Promise(res => setTimeout(res, delay * 5));
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      await new Promise(res => setTimeout(res, delay));
      return fetchWithRetry(url, retries - 1, delay * 2);
    }
    throw error;
  }
};

export const fetchCandles = async (symbol: string, interval: string, limit: number = 500): Promise<Candle[]> => {
  try {
    const response = await fetchWithRetry(`${BINANCE_API_BASE}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    const data = await response.json();
    
    // Map Binance format [time, open, high, low, close, volume, ...] to Candle
    return data.map((d: any) => ({
      time: d[0] / 1000, // Lightweight charts uses seconds
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5]),
    }));
  } catch (error) {
    console.warn(`Error fetching candles for ${symbol} (retries failed):`, error);
    return [];
  }
};

export const fetch24hTicker = async (symbol: string) => {
  try {
    const response = await fetchWithRetry(`${BINANCE_API_BASE}/ticker/24hr?symbol=${symbol}`, 1); // Less retries for dashboard
    return await response.json();
  } catch (error) {
    console.error(error);
    return null;
  }
};

export const fetchOrderBook = async (symbol: string, limit: number = 20): Promise<OrderBookState | null> => {
  try {
    const response = await fetchWithRetry(`${BINANCE_API_BASE}/depth?symbol=${symbol}&limit=${limit}`, 2);
    const data = await response.json();
    
    return {
      bids: data.bids.map((b: any) => ({ price: parseFloat(b[0]), quantity: parseFloat(b[1]), total: parseFloat(b[0]) * parseFloat(b[1]) })),
      asks: data.asks.map((a: any) => ({ price: parseFloat(a[0]), quantity: parseFloat(a[1]), total: parseFloat(a[0]) * parseFloat(a[1]) })),
      lastUpdate: Date.now()
    };
  } catch (error) {
    console.error(error);
    return null;
  }
};