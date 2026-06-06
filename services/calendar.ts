export interface EconEvent {
  id: string;
  title: string;
  country: string;
  impact: 'High' | 'Medium' | 'Low' | 'Holiday' | 'Non-Economic';
  timestamp: number;
  forecast: string;
  previous: string;
  actual: string;
}

const CACHE_KEY = 'econ_cal_v1';
const TTL = 30 * 60 * 1000;

export async function fetchCalendar(): Promise<EconEvent[]> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts < TTL) return data as EconEvent[];
    }
  } catch {}

  try {
    const res = await fetch(
      'https://nfs.faireconomy.media/ff_calendar_thisweek.json?v=' + Date.now(),
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const raw: any[] = await res.json();

    const events: EconEvent[] = raw
      .filter(e => e.country && e.title && e.date)
      .map((e, i) => ({
        id: `${e.country}-${i}`,
        title:    e.title,
        country:  (e.country as string).toUpperCase(),
        impact:   e.impact as EconEvent['impact'],
        timestamp: new Date(e.date).getTime(),
        forecast: e.forecast  ?? '',
        previous: e.previous  ?? '',
        actual:   e.actual    ?? '',
      }))
      .filter(e => !isNaN(e.timestamp));

    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: events }));
    return events;
  } catch {
    return [];
  }
}

export function symbolCurrencies(symbol: string): string[] {
  const CRYPTO = ['BTC', 'ETH', 'XRP', 'LTC', 'XAU', 'XAG'];
  return symbol.split('/').map(p =>
    CRYPTO.includes(p) ? 'USD' : p
  );
}

export function getUpcomingEvents(events: EconEvent[], symbol: string, hours = 12): EconEvent[] {
  const now = Date.now();
  const curs = symbolCurrencies(symbol);
  return events
    .filter(e =>
      e.timestamp >= now - 900_000 &&
      e.timestamp <= now + hours * 3_600_000 &&
      curs.includes(e.country)
    )
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function getNewsBlackout(events: EconEvent[], symbol: string, before = 15, after = 15): EconEvent | null {
  const now = Date.now();
  const curs = symbolCurrencies(symbol);
  return events.find(e =>
    e.impact === 'High' &&
    curs.includes(e.country) &&
    e.timestamp >= now - after * 60_000 &&
    e.timestamp <= now + before * 60_000
  ) ?? null;
}

export function relativeTime(ts: number): string {
  const diff = ts - Date.now();
  const abs  = Math.abs(diff);
  const mins = Math.round(abs / 60_000);
  const hrs  = Math.floor(abs / 3_600_000);
  if (abs < 60_000)  return diff > 0 ? 'зараз' : 'щойно';
  if (abs < 3_600_000) return diff > 0 ? `за ${mins} хв` : `${mins} хв тому`;
  return diff > 0 ? `за ${hrs}г ${Math.round((abs % 3_600_000) / 60_000)} хв` : `${hrs}г тому`;
}
