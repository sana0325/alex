import { Candle, AppSettings } from '../types';
import { CANDLES_NEEDED } from '../constants';

// ── Built-in API keys with automatic rotation ────────────────────────────────
const BUILTIN_KEYS = [
  'e01ad68c60f54836b38a2fd49314754b',
  '50d1e5d8a661495f928deb8a65bca5c8',
  'fa0e95ad760e4c87b346cbca87b0df6f',
  '94dfce08f47b4e739df5b6778ac43831',
  '3ef04b97821748799f7d8ca2b8a01f2c',
  '3e74c424bdab4346a19d918145ef966b',
  '6bdc51c0c24344109aa1b51492bc77fc',
  '08999d4474f74a1799039cb1ee64b09f',
];

const KEY_STATE_KEY = 'gss_key_state';

interface KeyState {
  index: number;         // current key index
  callsToday: number[];  // calls count per key today
  dayStr: string;        // 'YYYY-MM-DD' to reset counts daily
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadKeyState(): KeyState {
  try {
    const raw = localStorage.getItem(KEY_STATE_KEY);
    if (raw) {
      const s: KeyState = JSON.parse(raw);
      // Reset counts on new day
      if (s.dayStr !== todayStr()) {
        return { index: 0, callsToday: new Array(BUILTIN_KEYS.length).fill(0), dayStr: todayStr() };
      }
      // Ensure array length matches keys
      while (s.callsToday.length < BUILTIN_KEYS.length) s.callsToday.push(0);
      return s;
    }
  } catch { /* ignore */ }
  return { index: 0, callsToday: new Array(BUILTIN_KEYS.length).fill(0), dayStr: todayStr() };
}

function saveKeyState(s: KeyState) {
  localStorage.setItem(KEY_STATE_KEY, JSON.stringify(s));
}

const DAILY_LIMIT = 790; // leave 10 calls buffer per key

function getActiveKey(userKey?: string): string {
  // User's own key takes priority
  if (userKey && userKey.trim().length > 10) return userKey.trim();

  const state = loadKeyState();

  // Find a key that hasn't hit the daily limit, starting from current index
  for (let i = 0; i < BUILTIN_KEYS.length; i++) {
    const idx = (state.index + i) % BUILTIN_KEYS.length;
    if (state.callsToday[idx] < DAILY_LIMIT) {
      // Move to this key if different
      if (idx !== state.index) {
        state.index = idx;
        saveKeyState(state);
      }
      return BUILTIN_KEYS[idx];
    }
  }

  // All keys exhausted for today — reset and try from 0
  state.callsToday = new Array(BUILTIN_KEYS.length).fill(0);
  state.index = 0;
  saveKeyState(state);
  return BUILTIN_KEYS[0];
}

function recordCall(userKey?: string) {
  if (userKey && userKey.trim().length > 10) return; // user's own key, don't track
  const state = loadKeyState();
  state.callsToday[state.index] = (state.callsToday[state.index] ?? 0) + 1;
  saveKeyState(state);
}

function markKeyFailed(userKey?: string) {
  if (userKey && userKey.trim().length > 10) return;
  const state = loadKeyState();
  state.callsToday[state.index] = DAILY_LIMIT; // exhaust this key
  // Move to next
  state.index = (state.index + 1) % BUILTIN_KEYS.length;
  saveKeyState(state);
}

// ── Public API ───────────────────────────────────────────────────────────────

const TF_MAP: Record<string, string> = { M5: '5min', M15: '15min', M30: '30min' };

export function getKeyStatus(): { active: number; calls: number[]; total: number; limit: number } {
  const state = loadKeyState();
  return {
    active: state.index,
    calls: state.callsToday,
    total: state.callsToday.reduce((a, b) => a + b, 0),
    limit: BUILTIN_KEYS.length * DAILY_LIMIT,
  };
}

export async function fetchGoldCandles(settings: AppSettings): Promise<Candle[]> {
  const key = getActiveKey(settings.apiKey);
  const interval = TF_MAP[settings.timeframe] ?? '5min';
  const url = `https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=${interval}&outputsize=${CANDLES_NEEDED}&apikey=${key}&format=JSON&order=ASC`;

  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    if (res.status === 429 || res.status === 403) {
      markKeyFailed(settings.apiKey);
      throw new Error(`Ключ вичерпано (${res.status}), переходимо на наступний`);
    }
    throw new Error(`TwelveData HTTP ${res.status}`);
  }

  const data = await res.json();

  if (data.status === 'error') {
    if (data.code === 429 || (data.message ?? '').includes('limit')) {
      markKeyFailed(settings.apiKey);
      throw new Error('Ліміт запитів — переходимо на наступний ключ');
    }
    throw new Error(data.message ?? 'TwelveData помилка');
  }

  if (!data.values || !Array.isArray(data.values)) {
    throw new Error('Немає даних від TwelveData');
  }

  recordCall(settings.apiKey);

  return data.values.map((v: Record<string, string>) => ({
    time: Math.floor(new Date(v.datetime).getTime() / 1000),
    open: parseFloat(v.open),
    high: parseFloat(v.high),
    low: parseFloat(v.low),
    close: parseFloat(v.close),
    volume: parseFloat(v.volume ?? '0'),
  }));
}

export async function fetchCurrentPrice(settings: AppSettings): Promise<number | null> {
  try {
    const key = getActiveKey(settings.apiKey);
    const url = `https://api.twelvedata.com/price?symbol=XAU/USD&apikey=${key}`;
    const res = await fetch(url);
    const data = await res.json();
    recordCall(settings.apiKey);
    return data.price ? parseFloat(data.price) : null;
  } catch {
    return null;
  }
}
