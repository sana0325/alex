import React, { useState } from 'react';
import { EconEvent, symbolCurrencies, relativeTime } from '../services/calendar';

interface Props {
  events: EconEvent[];
  symbol: string;
  loading: boolean;
}

const IMPACT_COLOR: Record<string, string> = {
  High:          '#FF2D55',
  Medium:        '#FFB800',
  Low:           '#ffffff30',
  Holiday:       '#ffffff20',
  'Non-Economic':'#ffffff15',
};

const IMPACT_LABEL: Record<string, string> = {
  High: '●●●', Medium: '●●○', Low: '●○○', Holiday: '—', 'Non-Economic': '—',
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

function formatDay(ts: number): string {
  const d = new Date(ts);
  const today    = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);
  if (d >= today && d < tomorrow)    return 'СЬОГОДНІ';
  if (d >= tomorrow && d < new Date(tomorrow.getTime() + 86400000)) return 'ЗАВТРА';
  return d.toLocaleDateString('uk-UA', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
}

export const CalendarTab: React.FC<Props> = ({ events, symbol, loading }) => {
  const [showAll, setShowAll] = useState(false);
  const curs = symbolCurrencies(symbol);

  const now = Date.now();
  const filtered = showAll
    ? events.filter(e => e.timestamp >= now - 3_600_000)
    : events.filter(e => e.timestamp >= now - 3_600_000 && curs.includes(e.country));

  // Group by day
  const days: Record<string, EconEvent[]> = {};
  for (const e of filtered) {
    const key = formatDay(e.timestamp);
    if (!days[key]) days[key] = [];
    days[key].push(e);
  }

  // Next high-impact for current pair
  const nextHigh = events.find(e =>
    e.impact === 'High' && curs.includes(e.country) && e.timestamp > now
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="font-tech text-xs" style={{ color: '#00F5FF50' }}>
          ⚑ ECONOMIC CALENDAR
        </p>
        <button
          onClick={() => setShowAll(v => !v)}
          className="font-tech text-xs px-3 py-1 rounded transition-all"
          style={{
            background: showAll ? 'rgba(0,245,255,.12)' : 'rgba(255,255,255,.04)',
            border: `1px solid ${showAll ? '#00F5FF50' : 'rgba(255,255,255,.08)'}`,
            color: showAll ? '#00F5FF' : '#ffffff40',
          }}
        >
          {showAll ? 'Лише пара' : 'Всі пари'}
        </button>
      </div>

      {/* Countdown to next HIGH */}
      {nextHigh && (
        <div className="rounded-xl p-3 relative overflow-hidden"
             style={{
               background: 'rgba(255,45,85,.1)',
               border: '1px solid rgba(255,45,85,.35)',
               boxShadow: '0 0 20px rgba(255,45,85,.15)',
             }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-tech text-xs mb-0.5" style={{ color: '#FF2D5580' }}>
                ⚠ НАСТУПНА ВАЖЛИВА НОВИНА
              </p>
              <p className="font-orbitron text-sm font-bold" style={{ color: '#FF2D55' }}>
                {nextHigh.title}
              </p>
              <p className="font-tech text-xs mt-0.5" style={{ color: '#FF2D5570' }}>
                {nextHigh.country} · {formatTime(nextHigh.timestamp)}
              </p>
            </div>
            <div className="text-right">
              <p className="font-orbitron text-xl font-black" style={{ color: '#FF2D55', textShadow: '0 0 12px #FF2D55' }}>
                {relativeTime(nextHigh.timestamp)}
              </p>
            </div>
          </div>
          <div className="absolute left-0 right-0 h-0.5 animate-scan"
               style={{ background: 'linear-gradient(90deg,transparent,#FF2D5550,transparent)' }} />
        </div>
      )}

      {loading && (
        <div className="text-center py-8">
          <p className="font-tech text-xs animate-pulse" style={{ color: '#00F5FF50' }}>
            ⟳ ЗАВАНТАЖЕННЯ КАЛЕНДАРЯ…
          </p>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="rounded-xl p-6 text-center"
             style={{ background: 'rgba(5,20,45,.8)', border: '1px solid rgba(0,245,255,.08)' }}>
          <p className="font-tech text-sm" style={{ color: '#ffffff30' }}>
            {showAll ? 'Немає подій' : `Немає подій для ${curs.join('/')}`}
          </p>
          {!showAll && (
            <button onClick={() => setShowAll(true)}
                    className="font-tech text-xs mt-2 underline" style={{ color: '#00F5FF50' }}>
              Показати всі пари
            </button>
          )}
        </div>
      )}

      {/* Day groups */}
      {Object.entries(days).map(([day, dayEvents]) => (
        <div key={day}>
          <p className="font-orbitron text-xs font-bold mb-2 px-1" style={{ color: '#00F5FF60' }}>
            ── {day}
          </p>
          <div className="space-y-2">
            {dayEvents.map(e => <EventRow key={e.id} event={e} isPast={e.timestamp < now} />)}
          </div>
        </div>
      ))}
    </div>
  );
};

const EventRow: React.FC<{ event: EconEvent; isPast: boolean }> = ({ event: e, isPast }) => {
  const color  = IMPACT_COLOR[e.impact] ?? '#ffffff20';
  const isHigh = e.impact === 'High';
  const isNow  = Math.abs(e.timestamp - Date.now()) < 900_000; // within 15 min

  return (
    <div className="rounded-xl px-4 py-3 transition-all"
         style={{
           background: isNow
             ? 'rgba(255,45,85,.12)'
             : isPast ? 'rgba(255,255,255,.02)' : 'rgba(5,20,45,.85)',
           border: `1px solid ${isNow ? '#FF2D5540' : isHigh ? `${color}25` : 'rgba(255,255,255,.06)'}`,
           opacity: isPast ? 0.55 : 1,
           boxShadow: isNow ? '0 0 16px rgba(255,45,85,.15)' : '',
         }}>
      <div className="flex items-start gap-3">
        {/* Impact + time */}
        <div className="flex flex-col items-center gap-1 pt-0.5 flex-shrink-0 w-14">
          <p className="font-tech text-xs" style={{ color, textShadow: isHigh ? `0 0 8px ${color}` : '' }}>
            {IMPACT_LABEL[e.impact]}
          </p>
          <p className="font-tech text-xs" style={{ color: '#ffffff40' }}>
            {new Date(e.timestamp).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {/* Event info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-orbitron text-xs font-bold px-1.5 py-0.5 rounded"
                  style={{ background: `${color}18`, color, fontSize: '10px' }}>
              {e.country}
            </span>
            {isNow && (
              <span className="font-tech text-xs animate-blink" style={{ color: '#FF2D55' }}>● ЗАРАЗ</span>
            )}
          </div>
          <p className="font-tech text-sm" style={{ color: isPast ? '#ffffff50' : '#ffffff90' }}>
            {e.title}
          </p>
          {/* Forecast / Actual */}
          {(e.forecast || e.previous || e.actual) && (
            <div className="flex gap-3 mt-1">
              {e.actual && (
                <span className="font-tech text-xs">
                  <span style={{ color: '#ffffff30' }}>Факт: </span>
                  <span style={{ color: '#00FF88', fontWeight: 'bold' }}>{e.actual}</span>
                </span>
              )}
              {e.forecast && (
                <span className="font-tech text-xs">
                  <span style={{ color: '#ffffff30' }}>Прогноз: </span>
                  <span style={{ color: '#FFB800' }}>{e.forecast}</span>
                </span>
              )}
              {e.previous && (
                <span className="font-tech text-xs">
                  <span style={{ color: '#ffffff30' }}>Попер: </span>
                  <span style={{ color: '#ffffff50' }}>{e.previous}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Relative time */}
        <div className="flex-shrink-0 text-right">
          <p className="font-tech text-xs" style={{ color: isPast ? '#ffffff20' : isHigh ? color : '#ffffff30' }}>
            {relativeTime(e.timestamp)}
          </p>
        </div>
      </div>
    </div>
  );
};
