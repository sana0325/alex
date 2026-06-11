import React, { useState, useEffect, useCallback } from 'react';
import {
  FinnhubEvent, NewsArticle, TradeSignal, PairSignal,
  fetchNews, computeTradeSignal, COUNTRY_CCY, CCY_PAIRS,
  relTime, fmtTime, fmtDay,
} from './services/finnhub';
import { EconEvent, fetchCalendar } from './services/calendar';

// ── ForexFactory → FinnhubEvent adapter ──────────────────────────────────────

interface FFEvent extends FinnhubEvent {
  rawActual:   string;
  rawForecast: string;
  rawPrev:     string;
}

function parseNum(s: string): number | null {
  if (!s) return null;
  const c = s.replace(/,/g, '');
  if (c.endsWith('%')) { const n = parseFloat(c.slice(0, -1)); return isNaN(n) ? null : n; }
  const m = c.match(/^(-?\d+(?:\.\d+)?)(K|M|B|T)?$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const mult = m[2] ? (({ K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[m[2].toUpperCase()] ?? 1)) : 1;
  return isNaN(n) ? null : n * mult;
}

function adaptEconEvent(e: EconEvent): FFEvent {
  const actual   = parseNum(e.actual);
  const estimate = parseNum(e.forecast);
  const prev     = parseNum(e.previous);
  const impRaw   = e.impact.toLowerCase();
  const impact: FinnhubEvent['impact'] =
    (impRaw === 'high' || impRaw === 'medium' || impRaw === 'low')
      ? impRaw as FinnhubEvent['impact'] : 'low';

  let signal: FinnhubEvent['signal'] = 'PENDING';
  let deviation = 0, deviationPct = 0, strength = 0;
  if (actual !== null && estimate !== null) {
    deviation    = actual - estimate;
    deviationPct = estimate !== 0 ? (deviation / Math.abs(estimate)) * 100 : 0;
    strength     = Math.min(100, Math.abs(deviationPct) * 3);
    signal = Math.abs(deviationPct) < 2 ? 'INLINE' : deviation > 0 ? 'BEAT' : 'MISS';
  } else if (actual !== null) {
    signal = 'BEAT';
  }

  return {
    actual, estimate, prev,
    country:   e.country,
    event:     e.title,
    impact,
    time:      new Date(e.timestamp).toISOString().slice(0, 19).replace('T', ' '),
    unit:      '',
    timestamp: e.timestamp,
    signal, deviation, deviationPct, strength,
    rawActual:   e.actual,
    rawForecast: e.forecast,
    rawPrev:     e.previous,
  };
}

type Tab = 'signal' | 'calendar' | 'news';

// ── Colour palette ────────────────────────────────────────────────────────────
const C = {
  bg:     '#020c1b',
  card:   'rgba(5,22,50,.9)',
  border: 'rgba(0,245,255,.12)',
  cyan:   '#00F5FF',
  green:  '#00FF88',
  red:    '#FF2D55',
  gold:   '#FFB800',
  purple: '#B347FF',
};

const IMPACT_COLOR: Record<string, string> = {
  high: C.red, medium: C.gold, low: '#ffffff25',
};

// ── Main component ────────────────────────────────────────────────────────────
export default function AppNews({ onBack }: { onBack: () => void }) {
  const [tab, setTab]             = useState<Tab>('signal');
  const [events, setEvents]       = useState<FFEvent[]>([]);
  const [news, setNews]           = useState<NewsArticle[]>([]);
  const [newsCategory, setNewsCat] = useState<'forex'|'crypto'|'general'>('forex');
  const [loading, setLoading]     = useState(true);
  const [newsLoading, setNewsLoad] = useState(false);
  const [error, setError]         = useState('');
  const [lastSync, setLastSync]   = useState<Date|null>(null);

  const loadCalendar = useCallback(async (force = false) => {
    try {
      setError('');
      const ev = await fetchCalendar(force);
      setEvents(ev.map(adaptEconEvent));
      setLastSync(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadNews = useCallback(async (cat: typeof newsCategory) => {
    setNewsLoad(true);
    try {
      const articles = await fetchNews(cat);
      setNews(articles);
    } catch { /* silent */ }
    setNewsLoad(false);
  }, []);

  useEffect(() => {
    loadCalendar();
    // Poll every 30s — cache returns stored data unless event is hot (2-min TTL)
    const t = setInterval(() => loadCalendar(), 30_000);
    return () => clearInterval(t);
  }, [loadCalendar]);

  useEffect(() => {
    loadNews(newsCategory);
  }, [newsCategory, loadNews]);

  // Find the best active signal: most recent HIGH-impact released event
  const now = Date.now();
  const activeEvent = events
    .filter(e => e.impact === 'high' && e.signal !== 'PENDING' && e.timestamp >= now - 3_600_000)
    .sort((a, b) => b.timestamp - a.timestamp)[0] ?? null;

  const activeSignal: TradeSignal | null = activeEvent
    ? computeTradeSignal(activeEvent)
    : null;

  // Next upcoming high-impact event
  const nextHigh = events.find(e => e.impact === 'high' && e.signal === 'PENDING' && e.timestamp > now);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'signal',   label: '⚡ Сигнал'  },
    { id: 'calendar', label: '📅 Календар' },
    { id: 'news',     label: '📰 Стрічка'  },
  ];

  return (
    <div className="min-h-screen text-white font-sans" style={{ background: C.bg }}>

      {/* ── Top bar ─── */}
      <div className="sticky top-0 z-40 backdrop-blur-md px-4 py-2"
           style={{ background: 'rgba(2,12,27,.97)', borderBottom: `1px solid rgba(0,245,255,.12)` }}>
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <button onClick={onBack}
                    className="font-tech text-xs px-2 py-1 rounded mr-1"
                    style={{ color: C.cyan, border: `1px solid rgba(0,245,255,.25)` }}>
              ← НАЗАД
            </button>
            <div className="w-8 h-8 flex items-center justify-center rounded"
                 style={{ border: `1px solid ${C.red}60`, background: `${C.red}15` }}>
              <span className="font-orbitron text-xs font-black" style={{ color: C.red }}>N</span>
            </div>
            <div>
              <p className="font-tech text-xs leading-none" style={{ color: 'rgba(0,245,255,.4)' }}>
                FINNHUB · ECONOMIC
              </p>
              <p className="font-orbitron text-sm font-black leading-tight" style={{ color: C.red, textShadow: `0 0 10px ${C.red}80` }}>
                NEWS TRADER
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {loading && <span className="font-tech text-xs animate-pulse" style={{ color: C.gold }}>⟳ SYNC</span>}
            {lastSync && !loading && (
              <span className="font-tech text-xs" style={{ color: 'rgba(255,255,255,.2)' }}>
                {lastSync.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button onClick={() => loadCalendar(true)}
                    className="font-tech text-xs px-2 py-1 rounded"
                    style={{ color: C.cyan, border: `1px solid rgba(0,245,255,.2)` }}>⟳</button>
          </div>
        </div>
      </div>

      {/* ── Tab nav ─── */}
      <div className="sticky top-[57px] z-30"
           style={{ background: 'rgba(2,12,27,.95)', borderBottom: `1px solid rgba(0,245,255,.06)` }}>
        <div className="flex max-w-lg mx-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
                    className="flex-1 py-2.5 font-tech text-xs transition-all border-b-2"
                    style={{
                      borderColor: tab === t.id ? C.red : 'transparent',
                      color: tab === t.id ? C.red : 'rgba(255,255,255,.3)',
                      textShadow: tab === t.id ? `0 0 10px ${C.red}` : '',
                    }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ─── */}
      <div className="max-w-lg mx-auto px-4 py-4 pb-10">
        {error && (
          <div className="rounded-xl p-4 mb-4 font-tech text-xs"
               style={{ background: 'rgba(255,45,85,.1)', border: `1px solid rgba(255,45,85,.3)`, color: C.red }}>
            ⚠ {error}
            <button onClick={loadCalendar} className="underline ml-2" style={{ color: C.gold }}>Retry</button>
          </div>
        )}

        {tab === 'signal'   && <SignalTab   signal={activeSignal} nextHigh={nextHigh} events={events} />}
        {tab === 'calendar' && <CalendarTab events={events} loading={loading} />}
        {tab === 'news'     && (
          <NewsTab news={news} loading={newsLoading}
                   category={newsCategory} onCategory={setNewsCat} />
        )}
      </div>
    </div>
  );
}

// ── Signal Tab ────────────────────────────────────────────────────────────────
const SignalTab: React.FC<{
  signal: TradeSignal | null;
  nextHigh: FFEvent | undefined;
  events: FFEvent[];
}> = ({ signal, nextHigh }) => {

  // Active signal — show immediately after news release
  if (signal && signal.direction !== 'NONE' && signal.pairs.length > 0) {
    const isLong  = signal.direction === 'LONG';
    const accent  = isLong ? C.green : C.red;
    const arrow   = isLong ? '↑' : '↓';
    const dir     = isLong ? 'LONG' : 'SHORT';
    const msSince = Date.now() - signal.event.timestamp;
    const secsSince = Math.round(msSince / 1000);
    const timeStr = secsSince < 60
      ? `+${secsSince}с`
      : `+${Math.round(msSince / 60000)}хв`;

    return (
      <div className="space-y-3">
        {/* Direction header */}
        <div className="rounded-2xl relative overflow-hidden scanlines px-5 py-5"
             style={{
               background: `linear-gradient(145deg, #020c1b, ${accent}18)`,
               border: `2px solid ${accent}`,
               boxShadow: `0 0 40px ${accent}35`,
             }}>
          <div className="absolute left-0 right-0 h-px animate-scan"
               style={{ background: `linear-gradient(90deg,transparent,${accent}50,transparent)` }} />

          <div className="flex items-center justify-between mb-4">
            <p className="font-tech text-xs" style={{ color: `${accent}70` }}>
              {signal.event.event} · {fmtTime(signal.event.timestamp)}
            </p>
            <span className="font-tech text-xs px-2 py-0.5 rounded"
                  style={{ background: `${accent}18`, color: `${accent}90`, border: `1px solid ${accent}40` }}>
              {timeStr}
            </span>
          </div>

          {/* Big direction */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                 style={{ background: `${accent}20`, border: `2px solid ${accent}`, boxShadow: `0 0 20px ${accent}50` }}>
              <span className="font-orbitron text-4xl font-black" style={{ color: accent }}>{arrow}</span>
            </div>
            <div>
              <p className="font-orbitron text-5xl font-black leading-none"
                 style={{ color: accent, textShadow: `0 0 25px ${accent}` }}>
                {dir}
              </p>
              <p className="font-tech text-sm mt-1" style={{ color: `${accent}70` }}>
                {signal.currency} {isLong ? 'росте' : 'падає'}
              </p>
            </div>
          </div>

          {msSince < 30_000 && (
            <div className="mt-4 rounded-lg px-3 py-2 text-center"
                 style={{ background: 'rgba(255,68,68,.15)', border: '1px solid rgba(255,68,68,.4)' }}>
              <p className="font-orbitron text-xs font-bold animate-blink" style={{ color: '#ff4444' }}>
                ⛔ ЧЕКАЙТЕ — СПРЕД РОЗШИРЕНИЙ
              </p>
            </div>
          )}
        </div>

        {/* Pairs list */}
        <div className="rounded-xl overflow-hidden"
             style={{ background: C.card, border: `1px solid ${accent}25` }}>
          <div className="px-4 py-2.5" style={{ background: `${accent}0d`, borderBottom: `1px solid ${accent}18` }}>
            <p className="font-orbitron text-xs font-bold" style={{ color: accent }}>ПАРИ ДЛЯ ТОРГІВЛІ</p>
          </div>
          {signal.pairs.slice(0, 6).map(p => (
            <PairRow key={p.pair} ps={p} />
          ))}
        </div>
      </div>
    );
  }

  // Waiting — no active signal
  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-6 text-center relative overflow-hidden"
           style={{ background: C.card, border: `1px solid rgba(0,245,255,.1)` }}>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {[0,1,2].map(i => (
            <div key={i} className={`absolute rounded-full border ${
              i===0?'animate-radar':i===1?'animate-radar-2':'animate-radar-3'
            }`} style={{ width:80,height:80,borderColor:'rgba(0,245,255,.15)' }} />
          ))}
        </div>
        <p className="font-orbitron text-2xl font-black mb-2" style={{ color: 'rgba(0,245,255,.5)' }}>
          ОЧІКУВАННЯ
        </p>
        <p className="font-tech text-xs" style={{ color: 'rgba(255,255,255,.3)' }}>
          Немає актуальних HIGH-impact подій
        </p>
      </div>

      {nextHigh && <PreTradeCard event={nextHigh} />}
    </div>
  );
};

// ── Entry window widget ───────────────────────────────────────────────────────
const PHASE_INFO = {
  spread:  { color: '#FF2D55', icon: '⛔', title: 'ЗОНА СПРЕДУ',     desc: 'Спред розширений у 5-20x. Чекайте 30 секунд.' },
  enter:   { color: '#00FF88', icon: '⚡', title: 'ОПТИМАЛЬНИЙ ВХІД', desc: 'Кращий момент. Перший рух визначений. Входьте.' },
  confirm: { color: '#FFB800', icon: '✓',  title: 'ВХІД З ПІДТВЕРДЖЕННЯМ', desc: 'Безпечніше. Дочекайтесь закриття свічки.' },
  late:    { color: '#00F5FF', icon: '○',  title: 'ПІЗНІЙ ВХІД',     desc: 'Сигнал слабшає. Тільки з підтвердженням тренду.' },
  expired: { color: '#ffffff30', icon: '—', title: 'ВІКНО ЗАКРИТО',   desc: 'Більше 1 години. Сигнал застарів.' },
};

const EntryWindow: React.FC<{ phase: string; msSince: number }> = ({ phase, msSince }) => {
  const info = PHASE_INFO[phase as keyof typeof PHASE_INFO] ?? PHASE_INFO.expired;
  return (
    <div className="rounded-xl p-4"
         style={{ background: `${info.color}10`, border: `1px solid ${info.color}30` }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
             style={{ border: `2px solid ${info.color}50`, boxShadow: `0 0 12px ${info.color}40` }}>
          {info.icon}
        </div>
        <div>
          <p className="font-orbitron text-xs font-bold" style={{ color: info.color }}>{info.title}</p>
          <p className="font-tech text-xs mt-0.5" style={{ color: `${info.color}80` }}>{info.desc}</p>
        </div>
      </div>
      <div className="mt-3">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.06)' }}>
          <div className="h-full rounded-full transition-all"
               style={{
                 width: `${Math.min(100, Math.max(0, 100 - msSince/3600))}%`,
                 background: info.color,
                 boxShadow: `0 0 6px ${info.color}`,
               }} />
        </div>
        <p className="font-tech text-xs mt-1 text-right" style={{ color: 'rgba(255,255,255,.2)' }}>
          {msSince < Infinity ? `+${Math.round(msSince/1000)}с від виходу` : '—'}
        </p>
      </div>
    </div>
  );
};

// ── Pair row ──────────────────────────────────────────────────────────────────
const PairRow: React.FC<{ ps: PairSignal }> = ({ ps }) => {
  const isLong  = ps.direction === 'LONG';
  const color   = isLong ? C.green : C.red;
  return (
    <div className="flex items-center justify-between px-4 py-3"
         style={{ borderBottom: '1px solid rgba(255,255,255,.03)' }}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded flex items-center justify-center font-orbitron text-xs font-bold"
             style={{ background: `${color}15`, border: `1px solid ${color}35`, color }}>
          {isLong ? '▲' : '▼'}
        </div>
        <div>
          <p className="font-orbitron text-sm font-bold" style={{ color: 'rgba(255,255,255,.9)' }}>
            {ps.pair.replace('/','')}
          </p>
          <p className="font-tech text-xs" style={{ color }}>
            {ps.direction}
          </p>
        </div>
      </div>
      <div className="flex gap-1">
        {Array.from({length:3},(_,i) => (
          <div key={i} className="w-3 h-3 rounded-sm"
               style={{ background: i < ps.stars ? color : 'rgba(255,255,255,.1)',
                        boxShadow: i < ps.stars ? `0 0 4px ${color}` : '' }} />
        ))}
      </div>
    </div>
  );
};

// ── Strategy guide ────────────────────────────────────────────────────────────
const StrategyGuide: React.FC<{ isBeat: boolean; isStrong: boolean }> = ({ isBeat, isStrong }) => (
  <div className="rounded-xl p-4"
       style={{ background: C.card, border: 'rgba(0,245,255,.08) solid 1px' }}>
    <p className="font-orbitron text-xs font-bold mb-3" style={{ color: C.cyan }}>
      ⚙ СТРАТЕГІЯ ВХОДУ
    </p>
    {[
      {
        name: '⚡ Агресивна',
        time: '5-30 сек після виходу',
        desc: isStrong ? 'Вхід одразу при виході числа. Максимальний рух, але широкий спред.' : 'Не рекомендується при слабкому відхиленні.',
        color: isStrong ? C.red : 'rgba(255,255,255,.2)',
      },
      {
        name: '↩ Відкат',
        time: '1-3 хвилини',
        desc: 'Дочекайтесь першого відкату після спайку. Кращий RR, менший ризик спреду.',
        color: C.gold,
        recommended: true,
      },
      {
        name: '✓ Підтвердження',
        time: '3-10 хвилин',
        desc: 'Вхід після закриття сильної свічки в напрямку сигналу. Найбезпечніше.',
        color: C.green,
      },
    ].map(st => (
      <div key={st.name} className="mb-3 last:mb-0 rounded-lg p-3"
           style={{ background: `${st.color}08`, border: `1px solid ${st.color}20` }}>
        <div className="flex items-center justify-between mb-1">
          <span className="font-tech text-sm font-bold" style={{ color: st.color }}>{st.name}</span>
          {st.recommended && (
            <span className="font-tech text-xs px-2 py-0.5 rounded"
                  style={{ background: `${st.color}20`, color: st.color }}>РЕКОМЕНДОВАНО</span>
          )}
        </div>
        <p className="font-tech text-xs" style={{ color: `${st.color}60` }}>{st.time}</p>
        <p className="font-tech text-xs mt-1" style={{ color: 'rgba(255,255,255,.4)' }}>{st.desc}</p>
      </div>
    ))}
  </div>
);

// ── Pre-trade setup card ──────────────────────────────────────────────────────
const PreTradeCard: React.FC<{ event: FFEvent }> = ({ event: e }) => {
  const minsLeft = Math.round((e.timestamp - Date.now()) / 60000);
  const secsLeft = Math.round((e.timestamp - Date.now()) / 1000);
  const isClose  = minsLeft <= 15;
  const accent   = isClose ? C.red : C.gold;

  const ccy          = COUNTRY_CCY[e.country] ?? null;
  const bullishPairs = ccy ? (CCY_PAIRS[ccy] ?? []) : [];
  const bearishPairs: PairSignal[] = bullishPairs.map(p => ({
    ...p,
    direction: p.direction === 'LONG' ? 'SHORT' : 'LONG',
  }));
  const mainBull = bullishPairs[0] ?? null;
  const mainBear = bearishPairs[0] ?? null;

  const timeStr = secsLeft > 60
    ? `${minsLeft}хв`
    : `${secsLeft}с`;

  return (
    <div className="rounded-2xl relative overflow-hidden scanlines"
         style={{
           background: `linear-gradient(145deg, #020c1b, ${accent}14)`,
           border: `1px solid ${accent}55`,
           boxShadow: `0 0 30px ${accent}20`,
         }}>
      {(['tl','tr','bl','br'] as const).map(pos => (
        <div key={pos} className={`absolute w-5 h-5 z-10 ${
          pos==='tl'?'top-0 left-0':pos==='tr'?'top-0 right-0':pos==='bl'?'bottom-0 left-0':'bottom-0 right-0'
        }`} style={{
          borderTop:    pos.startsWith('t') ? `2px solid ${accent}` : undefined,
          borderBottom: pos.startsWith('b') ? `2px solid ${accent}` : undefined,
          borderLeft:   pos.endsWith('l')   ? `2px solid ${accent}` : undefined,
          borderRight:  pos.endsWith('r')   ? `2px solid ${accent}` : undefined,
        }} />
      ))}

      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-4 pb-2 relative z-10">
        <div className="flex-1 mr-3">
          <p className="font-tech text-xs mb-0.5" style={{ color: `${accent}80` }}>⚡ PRE-TRADE SETUP</p>
          <p className="font-orbitron text-base font-black leading-tight text-white">{e.event}</p>
          <p className="font-tech text-xs mt-0.5" style={{ color: 'rgba(255,255,255,.35)' }}>
            {ccy ?? e.country} · {fmtTime(e.timestamp)} · HIGH IMPACT
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-orbitron text-3xl font-black leading-none"
             style={{ color: accent, textShadow: `0 0 14px ${accent}` }}>
            {timeStr}
          </p>
          {isClose
            ? <p className="font-tech text-xs animate-blink mt-1" style={{ color: C.red }}>ГОТУЙТЕСЬ!</p>
            : <p className="font-tech text-xs mt-1" style={{ color: `${accent}60` }}>до виходу</p>
          }
        </div>
      </div>

      {/* Forecast vs Previous */}
      {(e.rawForecast || e.rawPrev) && (
        <div className="mx-5 grid grid-cols-2 gap-3 mb-3 relative z-10">
          <div className="rounded-lg p-2 text-center"
               style={{ background: `${accent}0d`, border: `1px solid ${accent}25` }}>
            <p className="font-tech text-xs mb-0.5" style={{ color: `${accent}60` }}>ПРОГНОЗ</p>
            <p className="font-orbitron text-base font-bold" style={{ color: accent }}>{e.rawForecast || '—'}</p>
          </div>
          <div className="rounded-lg p-2 text-center"
               style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)' }}>
            <p className="font-tech text-xs mb-0.5" style={{ color: 'rgba(255,255,255,.3)' }}>ПОПЕРЕДНІЙ</p>
            <p className="font-orbitron text-base font-bold" style={{ color: 'rgba(255,255,255,.6)' }}>{e.rawPrev || '—'}</p>
          </div>
        </div>
      )}

      <div className="mx-5 h-px mb-3" style={{ background: `linear-gradient(90deg,transparent,${accent}30,transparent)` }} />

      {/* Scenarios — plain language */}
      {ccy && mainBull && (
        <div className="px-5 mb-3 space-y-2 relative z-10">
          <p className="font-tech text-xs mb-1" style={{ color: 'rgba(0,245,255,.45)' }}>КУДИ ВХОДИТИ</p>

          {/* If higher than forecast → long ccy pairs */}
          <div className="rounded-xl p-3" style={{ background: 'rgba(0,255,136,.08)', border: '1px solid rgba(0,255,136,.3)' }}>
            <p className="font-tech text-xs mb-2" style={{ color: 'rgba(0,255,136,.6)' }}>
              Якщо вийде більше прогнозу:
            </p>
            <div className="flex flex-wrap gap-2">
              {bullishPairs.slice(0, 5).map(p => (
                <div key={p.pair} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                     style={{ background: 'rgba(0,255,136,.12)', border: '1px solid rgba(0,255,136,.35)' }}>
                  <span className="font-orbitron text-base font-black" style={{ color: C.green }}>
                    {p.direction === 'LONG' ? '↑' : '↓'}
                  </span>
                  <span className="font-orbitron text-sm font-bold" style={{ color: C.green }}>
                    {p.pair.replace('/', '')}
                  </span>
                  <span className="font-tech text-xs" style={{ color: `${C.green}60` }}>
                    {p.direction}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* If lower than forecast → short ccy pairs */}
          <div className="rounded-xl p-3" style={{ background: 'rgba(255,45,85,.08)', border: '1px solid rgba(255,45,85,.3)' }}>
            <p className="font-tech text-xs mb-2" style={{ color: 'rgba(255,45,85,.6)' }}>
              Якщо вийде менше прогнозу:
            </p>
            <div className="flex flex-wrap gap-2">
              {bearishPairs.slice(0, 5).map(p => (
                <div key={p.pair} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                     style={{ background: 'rgba(255,45,85,.12)', border: '1px solid rgba(255,45,85,.35)' }}>
                  <span className="font-orbitron text-base font-black" style={{ color: C.red }}>
                    {p.direction === 'LONG' ? '↑' : '↓'}
                  </span>
                  <span className="font-orbitron text-sm font-bold" style={{ color: C.red }}>
                    {p.pair.replace('/', '')}
                  </span>
                  <span className="font-tech text-xs" style={{ color: `${C.red}60` }}>
                    {p.direction}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Entry reminder */}
      <div className="mx-5 mb-4 rounded-xl overflow-hidden relative z-10"
           style={{ border: '1px solid rgba(255,255,255,.08)' }}>
        <div className="flex items-center gap-3 px-3 py-2.5"
             style={{ background: 'rgba(255,68,68,.08)', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
          <span className="font-orbitron text-xs w-14" style={{ color: 'rgba(255,68,68,.7)' }}>0–30с</span>
          <span className="font-tech text-xs" style={{ color: '#ff6666' }}>⛔ СПРЕД РОЗШИРЕНИЙ — ЧЕКАЙТЕ</span>
        </div>
        <div className="flex items-center gap-3 px-3 py-2.5"
             style={{ background: 'rgba(0,255,136,.08)' }}>
          <span className="font-orbitron text-xs w-14" style={{ color: `${C.green}70` }}>30с+</span>
          <span className="font-tech text-xs flex-1" style={{ color: C.green }}>⚡ ВХІД ОДРАЗУ за напрямком</span>
          <span className="font-tech text-xs px-1.5 py-0.5 rounded"
                style={{ background: `${C.green}20`, color: C.green, border: `1px solid ${C.green}40` }}>★</span>
        </div>
      </div>
    </div>
  );
};

// ── Medium event row ──────────────────────────────────────────────────────────
const MediumEventRow: React.FC<{ event: FFEvent }> = ({ event: e }) => {
  const isBeat = e.signal === 'BEAT';
  const isMiss = e.signal === 'MISS';
  const color  = isBeat ? C.green : isMiss ? C.red : 'rgba(255,255,255,.3)';
  return (
    <div className="rounded-xl px-4 py-3 mb-2 flex items-center justify-between"
         style={{ background: C.card, border: '1px solid rgba(255,255,255,.05)' }}>
      <div>
        <p className="font-tech text-sm text-white">{e.event}</p>
        <p className="font-tech text-xs" style={{ color: 'rgba(255,255,255,.3)' }}>{e.country} · {fmtTime(e.timestamp)}</p>
      </div>
      {e.signal !== 'PENDING' && (
        <span className="font-orbitron text-xs font-bold px-2 py-1 rounded"
              style={{ color, background: `${color}15`, border: `1px solid ${color}30` }}>
          {e.signal}
        </span>
      )}
    </div>
  );
};

// ── Calendar Tab ──────────────────────────────────────────────────────────────
const CalendarTab: React.FC<{ events: FFEvent[]; loading: boolean }> = ({ events, loading }) => {
  const now = Date.now();
  // Show entire week — past events dimmed, future events highlighted
  const relevant = events;

  const days: Record<string, FFEvent[]> = {};
  for (const e of relevant) {
    const key = fmtDay(e.timestamp);
    if (!days[key]) days[key] = [];
    days[key].push(e);
  }

  return (
    <div className="space-y-4">
      <p className="font-tech text-xs px-1" style={{ color: 'rgba(0,245,255,.4)' }}>
        📅 ECONOMIC CALENDAR · FOREXFACTORY
      </p>
      {loading && (
        <p className="font-tech text-xs text-center animate-pulse py-8" style={{ color: 'rgba(0,245,255,.4)' }}>
          ⟳ ЗАВАНТАЖЕННЯ…
        </p>
      )}
      {!loading && relevant.length === 0 && (
        <p className="font-tech text-xs text-center py-8" style={{ color: 'rgba(255,255,255,.25)' }}>
          Дані недоступні — перевірте інтернет або спробуйте пізніше
        </p>
      )}
      {Object.entries(days).map(([day, evs]) => (
        <div key={day}>
          <p className="font-orbitron text-xs font-bold mb-2 px-1" style={{ color: 'rgba(0,245,255,.5)' }}>
            ── {day}
          </p>
          <div className="space-y-2">
            {evs.map(e => <CalEventRow key={e.time+e.event} event={e} />)}
          </div>
        </div>
      ))}
    </div>
  );
};

const CalEventRow: React.FC<{ event: FFEvent }> = ({ event: e }) => {
  const now    = Date.now();
  const isPast = e.timestamp < now;
  const isNow  = Math.abs(e.timestamp - now) < 900_000;
  const iColor = IMPACT_COLOR[e.impact] ?? '#ffffff20';
  const sColor = e.signal==='BEAT' ? C.green : e.signal==='MISS' ? C.red : e.signal==='INLINE' ? C.gold : 'transparent';

  return (
    <div className="rounded-xl px-4 py-3"
         style={{
           background: isNow ? `rgba(255,45,85,.08)` : C.card,
           border: `1px solid ${isNow ? 'rgba(255,45,85,.3)' : iColor+'20'}`,
           opacity: isPast && !isNow ? 0.55 : 1,
         }}>
      <div className="flex items-start gap-3">
        {/* Time + impact */}
        <div className="flex flex-col items-center gap-1 w-14 flex-shrink-0">
          <span className="font-tech text-xs" style={{ color: iColor, textShadow: e.impact==='high' ? `0 0 6px ${iColor}` : '' }}>
            {e.impact === 'high' ? '●●●' : e.impact === 'medium' ? '●●○' : '●○○'}
          </span>
          <span className="font-tech text-xs" style={{ color: 'rgba(255,255,255,.35)' }}>
            {fmtTime(e.timestamp)}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-orbitron text-xs font-bold px-1.5 py-0.5 rounded"
                  style={{ background: `${iColor}15`, color: iColor, fontSize:'10px' }}>
              {e.country}
            </span>
            {isNow && <span className="font-tech text-xs animate-blink" style={{ color: C.red }}>● ЗАРАЗ</span>}
          </div>
          <p className="font-tech text-sm" style={{ color: isPast ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.9)' }}>
            {e.event}
          </p>
          {e.rawForecast && (
            <p className="font-tech text-xs mt-0.5" style={{ color: 'rgba(255,255,255,.3)' }}>
              Прогноз: <span style={{ color: C.gold }}>{e.rawForecast}</span>
              {e.rawPrev && <span> · Попер: {e.rawPrev}</span>}
            </p>
          )}
        </div>

        {/* Result */}
        <div className="flex-shrink-0 text-right">
          {e.rawActual ? (
            <div>
              <p className="font-orbitron text-sm font-bold" style={{ color: sColor !== 'transparent' ? sColor : 'rgba(255,255,255,.6)' }}>
                {e.rawActual}
              </p>
              {e.signal !== 'PENDING' && e.signal !== 'INLINE' && (
                <p className="font-tech text-xs" style={{ color: sColor }}>
                  {e.signal === 'BEAT' ? '▲ BEAT' : '▼ MISS'}
                </p>
              )}
            </div>
          ) : (
            <p className="font-tech text-xs" style={{ color: 'rgba(255,255,255,.25)' }}>
              {relTime(e.timestamp)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ── News Tab ──────────────────────────────────────────────────────────────────
const NewsTab: React.FC<{
  news: NewsArticle[];
  loading: boolean;
  category: string;
  onCategory: (c: 'forex'|'crypto'|'general') => void;
}> = ({ news, loading, category, onCategory }) => {
  const cats: { id: 'forex'|'crypto'|'general'; label: string }[] = [
    { id: 'forex',   label: 'Форекс'  },
    { id: 'crypto',  label: 'Крипто'  },
    { id: 'general', label: 'Загальні' },
  ];

  return (
    <div className="space-y-4">
      {/* Category switcher */}
      <div className="flex gap-2">
        {cats.map(c => (
          <button key={c.id} onClick={() => onCategory(c.id)}
                  className="flex-1 py-2 rounded-lg font-tech text-xs transition-all"
                  style={{
                    background: category===c.id ? 'rgba(0,245,255,.12)' : 'rgba(255,255,255,.04)',
                    border: `1px solid ${category===c.id ? 'rgba(0,245,255,.4)' : 'rgba(255,255,255,.08)'}`,
                    color: category===c.id ? C.cyan : 'rgba(255,255,255,.4)',
                  }}>
            {c.label}
          </button>
        ))}
      </div>

      {loading && (
        <p className="font-tech text-xs text-center animate-pulse py-4" style={{ color: 'rgba(0,245,255,.4)' }}>
          ⟳ ЗАВАНТАЖЕННЯ НОВИН…
        </p>
      )}

      {news.map(a => (
        <div key={a.id} className="rounded-xl p-4"
             style={{ background: C.card, border: '1px solid rgba(255,255,255,.06)' }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-tech text-xs" style={{ color: 'rgba(0,245,255,.5)' }}>{a.source}</span>
            <span className="font-tech text-xs" style={{ color: 'rgba(255,255,255,.2)' }}>·</span>
            <span className="font-tech text-xs" style={{ color: 'rgba(255,255,255,.2)' }}>
              {relTime(a.datetime)}
            </span>
          </div>
          <p className="font-tech text-sm text-white leading-snug mb-1">{a.headline}</p>
          {a.summary && (
            <p className="font-tech text-xs leading-relaxed"
               style={{ color: 'rgba(255,255,255,.35)', display: '-webkit-box',
                        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {a.summary}
            </p>
          )}
        </div>
      ))}
    </div>
  );
};
