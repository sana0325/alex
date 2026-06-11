const BASE = 'https://finnhub.io/api/v1';
const KEY  = 'd50tnk9r01qm94qo7engd50tnk9r01qm94qo7eo0';

// ── Types ────────────────────────────────────────────────────────────────────

export interface FinnhubEvent {
  actual:    number | null;
  country:   string;      // 'US', 'EU', 'GB', ...
  estimate:  number | null;
  event:     string;
  impact:    'high' | 'medium' | 'low';
  prev:      number | null;
  time:      string;      // 'YYYY-MM-DD HH:MM:SS' UTC
  unit:      string;
  // computed
  timestamp: number;
  signal:    'BEAT' | 'MISS' | 'INLINE' | 'PENDING';
  deviation: number;      // actual - estimate
  deviationPct: number;   // %
  strength:  number;      // 0-100
}

export interface NewsArticle {
  id:       number;
  headline: string;
  summary:  string;
  source:   string;
  datetime: number;
  url:      string;
  image:    string;
  category: string;
}

export interface PairSignal {
  pair:      string;
  direction: 'LONG' | 'SHORT';
  stars:     number; // 1-3
}

export interface TradeSignal {
  event:      FinnhubEvent;
  currency:   string;
  direction:  'LONG' | 'SHORT' | 'NONE'; // for the currency
  pairs:      PairSignal[];
  strength:   number; // 0-100
  label:      'СИЛЬНИЙ БИТ' | 'СЛАБКИЙ БИТ' | 'СИЛЬНИЙ МІС' | 'СЛАБКИЙ МІС' | 'В МЕЖАХ' | 'НЕМАЄ ДАНИХ';
  reasoning:  string;
}

// ── Country → Currency ───────────────────────────────────────────────────────

export const COUNTRY_CCY: Record<string, string> = {
  US: 'USD', EU: 'EUR', EA: 'EUR', DE: 'EUR', FR: 'EUR', IT: 'EUR',
  GB: 'GBP', UK: 'GBP',
  JP: 'JPY',
  CH: 'CHF',
  AU: 'AUD',
  CA: 'CAD',
  NZ: 'NZD',
  CN: 'CNY',
};

// When currency is BULLISH, these are the pair directions (flip for BEARISH)
export const CCY_PAIRS: Record<string, PairSignal[]> = {
  USD: [
    { pair: 'XAU/USD', direction: 'SHORT', stars: 3 },
    { pair: 'BTC/USD', direction: 'SHORT', stars: 3 },
    { pair: 'EUR/USD', direction: 'SHORT', stars: 3 },
    { pair: 'GBP/USD', direction: 'SHORT', stars: 3 },
    { pair: 'USD/JPY', direction: 'LONG',  stars: 2 },
    { pair: 'AUD/USD', direction: 'SHORT', stars: 2 },
    { pair: 'NZD/USD', direction: 'SHORT', stars: 2 },
    { pair: 'USD/CHF', direction: 'LONG',  stars: 2 },
    { pair: 'USD/CAD', direction: 'LONG',  stars: 1 },
    { pair: 'ETH/USD', direction: 'SHORT', stars: 2 },
  ],
  EUR: [
    { pair: 'EUR/USD', direction: 'LONG',  stars: 3 },
    { pair: 'GBP/USD', direction: 'LONG',  stars: 1 },
  ],
  GBP: [
    { pair: 'GBP/USD', direction: 'LONG',  stars: 3 },
  ],
  JPY: [
    { pair: 'USD/JPY', direction: 'SHORT', stars: 3 },
  ],
  CHF: [
    { pair: 'USD/CHF', direction: 'SHORT', stars: 3 },
  ],
  AUD: [
    { pair: 'AUD/USD', direction: 'LONG',  stars: 3 },
  ],
  CAD: [
    { pair: 'USD/CAD', direction: 'SHORT', stars: 3 },
  ],
  NZD: [
    { pair: 'NZD/USD', direction: 'LONG',  stars: 3 },
  ],
};

// ── Utils ─────────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return (html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ').trim();
}

// ── API helpers ──────────────────────────────────────────────────────────────

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const q = new URLSearchParams({ ...params, token: KEY }).toString();
  const res = await fetch(`${BASE}${path}?${q}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`);
  return res.json();
}

// ── Economic calendar ────────────────────────────────────────────────────────

export async function fetchEconomicCalendar(): Promise<FinnhubEvent[]> {
  const from = dateStr(new Date(Date.now() - 86400000)); // yesterday
  const to   = dateStr(new Date(Date.now() + 7 * 86400000)); // +7 days
  const raw  = await get<{ economicCalendar: any[] }>('/calendar/economic', { from, to });

  return (raw.economicCalendar ?? [])
    .filter((e: any) => e.country && e.event && e.time)
    .map((e: any): FinnhubEvent => {
      const timestamp = new Date(e.time + ' UTC').getTime();
      const actual    = e.actual  != null ? Number(e.actual)   : null;
      const estimate  = e.estimate!= null ? Number(e.estimate) : null;
      const prev      = e.prev    != null ? Number(e.prev)     : null;

      let signal: FinnhubEvent['signal'] = 'PENDING';
      let deviation = 0;
      let deviationPct = 0;
      let strength = 0;

      if (actual !== null && estimate !== null) {
        deviation    = actual - estimate;
        deviationPct = estimate !== 0 ? (deviation / Math.abs(estimate)) * 100 : 0;
        strength     = Math.min(100, Math.abs(deviationPct) * 3);

        if      (Math.abs(deviationPct) < 2) signal = 'INLINE';
        else if (deviation > 0)              signal = 'BEAT';
        else                                 signal = 'MISS';
      } else if (actual !== null) {
        signal = 'BEAT'; // can't compare without estimate
      }

      return {
        actual, estimate, prev,
        country:  (e.country as string).toUpperCase(),
        event:    e.event,
        impact:   e.impact ?? 'low',
        time:     e.time,
        unit:     e.unit ?? '',
        timestamp, signal, deviation, deviationPct, strength,
      };
    })
    .filter(e => !isNaN(e.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
}

// ── News feed ────────────────────────────────────────────────────────────────

export async function fetchNews(category: 'forex' | 'crypto' | 'general' = 'forex'): Promise<NewsArticle[]> {
  const raw = await get<any[]>('/news', { category });
  return (raw ?? []).slice(0, 30).map((a: any) => ({
    id:       a.id,
    headline: a.headline,
    summary:  stripHtml(a.summary ?? ''),
    source:   a.source   ?? '',
    datetime: a.datetime * 1000, // seconds → ms
    url:      a.url      ?? '',
    image:    a.image    ?? '',
    category: a.category ?? category,
  }));
}

// ── Signal computation ───────────────────────────────────────────────────────

export function computeTradeSignal(event: FinnhubEvent): TradeSignal {
  const ccy = COUNTRY_CCY[event.country] ?? null;

  if (!ccy || event.signal === 'PENDING' || event.signal === 'INLINE') {
    return {
      event, currency: ccy ?? event.country,
      direction: 'NONE', pairs: [], strength: event.strength,
      label: event.signal === 'INLINE' ? 'В МЕЖАХ' : 'НЕМАЄ ДАНИХ',
      reasoning: event.signal === 'INLINE'
        ? 'Відхилення в межах норми — нема чіткого сигналу'
        : 'Дані ще не вийшли або не можна порівняти',
    };
  }

  const isBeat = event.signal === 'BEAT';
  const bullishPairs = CCY_PAIRS[ccy] ?? [];

  // Flip direction for MISS
  const pairs: PairSignal[] = bullishPairs.map(p => ({
    ...p,
    direction: isBeat
      ? p.direction
      : (p.direction === 'LONG' ? 'SHORT' : 'LONG'),
  }));

  const strength = event.strength;
  const label: TradeSignal['label'] =
    isBeat  && strength > 40 ? 'СИЛЬНИЙ БИТ' :
    isBeat                   ? 'СЛАБКИЙ БИТ' :
    !isBeat && strength > 40 ? 'СИЛЬНИЙ МІС' : 'СЛАБКИЙ МІС';

  const deviationStr = `${event.deviation > 0 ? '+' : ''}${event.deviationPct.toFixed(1)}%`;
  const reasoning =
    `${event.event}: факт ${event.actual}${event.unit} vs прогноз ${event.estimate}${event.unit} ` +
    `(відхилення ${deviationStr}). ${ccy} ${isBeat ? 'підсилюється' : 'слабшає'}.`;

  return {
    event, currency: ccy,
    direction: isBeat ? 'LONG' : 'SHORT',
    pairs, strength, label, reasoning,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function relTime(ts: number): string {
  const d = ts - Date.now();
  const a = Math.abs(d);
  const m = Math.round(a / 60000);
  const h = Math.floor(a / 3600000);
  if (a < 60000)    return d > 0 ? 'зараз' : 'щойно';
  if (a < 3600000)  return d > 0 ? `за ${m} хв` : `${m} хв тому`;
  return d > 0 ? `за ${h}г ${Math.round((a % 3600000) / 60000)} хв` : `${h}г тому`;
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

export function fmtDay(ts: number): string {
  const d = new Date(ts);
  const t = new Date(); t.setHours(0,0,0,0);
  const tm = new Date(t); tm.setDate(t.getDate()+1);
  if (d >= t && d < tm)  return 'СЬОГОДНІ';
  if (d >= tm && d < new Date(tm.getTime()+86400000)) return 'ЗАВТРА';
  return d.toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
}
