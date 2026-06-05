import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoldSignal, AppSettings } from './types';
import { DEFAULT_SETTINGS, SETTINGS_KEY, SYMBOL_OPTIONS } from './constants';
import { analyzeGold } from './services/indicators';
import { fetchGoldCandles, fetchCurrentPrice, getKeyStatus } from './services/goldApi';
import { fetchCalendar, getUpcomingEvents, getNewsBlackout, EconEvent } from './services/calendar';
import { SignalCard } from './components/SignalCard';
import { IndicatorVotes } from './components/IndicatorVotes';
import { SupportPanel } from './components/SupportPanel';
import { CalendarTab } from './components/CalendarTab';
import { SettingsModal } from './components/SettingsModal';

type Tab = 'signal' | 'indicators' | 'support' | 'calendar';

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
}
function saveSettings(s: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [signal, setSignal]     = useState<GoldSignal | null>(null);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [status, setStatus]     = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [tab, setTab]           = useState<Tab>('signal');
  const [showSettings, setShowSettings] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [calEvents, setCalEvents]   = useState<EconEvent[]>([]);
  const [calLoading, setCalLoading] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const analyze = useCallback(async (s: AppSettings) => {
    setStatus('loading');
    setErrorMsg('');
    try {
      const candles = await fetchGoldCandles(s);
      const result  = analyzeGold(candles, s);
      setSignal(result);
      setCurrentPrice(result.entryPrice);
      setLastUpdate(new Date());
      setStatus('ok');
      fetchCurrentPrice(s).then(p => { if (p) setCurrentPrice(p); });
    } catch (e: unknown) {
      setStatus('error');
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const startInterval = useCallback((s: AppSettings) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (countRef.current)    clearInterval(countRef.current);
    analyze(s);
    setCountdown(s.refreshSeconds);
    intervalRef.current = setInterval(() => { analyze(s); setCountdown(s.refreshSeconds); }, s.refreshSeconds * 1000);
    countRef.current    = setInterval(() => { setCountdown(prev => Math.max(0, prev - 1)); }, 1000);
  }, [analyze]);

  useEffect(() => {
    startInterval(settings);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countRef.current)    clearInterval(countRef.current);
    };
  }, []);

  // Calendar: fetch on mount then every 30 min
  useEffect(() => {
    const load = async () => {
      setCalLoading(true);
      const ev = await fetchCalendar();
      setCalEvents(ev);
      setCalLoading(false);
    };
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const handleSaveSettings = (s: AppSettings) => { saveSettings(s); setSettings(s); startInterval(s); };

  const dir = signal?.direction;
  const dirAccent = dir === 'LONG' ? '#00FF88' : dir === 'SHORT' ? '#FF2D55' : '#00F5FF';

  const keyStatus  = getKeyStatus();
  const keyUsedPct = Math.round((keyStatus.total / keyStatus.limit) * 100);
  const activeSym  = SYMBOL_OPTIONS.find(s => s.value === settings.symbol);

  const blackout    = getNewsBlackout(calEvents, settings.symbol);
  const upcoming    = getUpcomingEvents(calEvents, settings.symbol, 1); // next 1 hour
  const nextEvent   = upcoming[0] ?? null;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'signal',     label: '◉ Сигнал' },
    { id: 'indicators', label: '≡ Індикатори' },
    { id: 'support',    label: '⬡ Фільтри' },
    { id: 'calendar',   label: `⚑ Новини${blackout ? ' ⚠' : ''}` },
  ];

  return (
    <div className="min-h-screen text-white font-sans" style={{ background: '#020c1b' }}>

      {/* ── Top bar ─────────────────────────────────── */}
      <div className="sticky top-0 z-40 backdrop-blur-md px-4 py-2"
           style={{ background: 'rgba(2,12,27,.97)', borderBottom: '1px solid rgba(0,245,255,.12)' }}>
        <div className="flex items-center justify-between max-w-lg mx-auto">

          {/* Logo + signal label */}
          <div className="flex items-center gap-2">
            {/* Spinning hex logo */}
            <div className="relative w-9 h-9 flex items-center justify-center">
              <svg className="absolute animate-hud-spin" width="36" height="36" viewBox="0 0 36 36">
                <polygon points="18,2 32,10 32,26 18,34 4,26 4,10"
                  fill="none" stroke={dirAccent} strokeWidth="1.5"
                  style={{ filter: `drop-shadow(0 0 4px ${dirAccent})` }} />
              </svg>
              <span className="font-orbitron text-xs font-black" style={{ color: dirAccent }}>FX</span>
            </div>
            <div>
              <p className="font-tech text-xs leading-none" style={{ color: '#00F5FF60' }}>
                {activeSym?.display ?? settings.symbol.replace('/','')}&nbsp;·&nbsp;{settings.timeframe}
              </p>
              <p className="font-orbitron text-base font-black leading-tight"
                 style={{ color: dirAccent, textShadow: `0 0 12px ${dirAccent}80` }}>
                {dir === 'LONG' ? '▲ LONG' : dir === 'SHORT' ? '▼ SHORT' : signal ? '— WAIT' : 'SCALP BOT'}
              </p>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Live status */}
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${
                status === 'loading' ? 'animate-pulse' : ''
              }`} style={{
                background: status === 'loading' ? '#FFB800'
                  : status === 'ok' ? '#00FF88' : status === 'error' ? '#FF2D55' : '#444',
                boxShadow: status === 'ok' ? '0 0 6px #00FF88' : '',
              }} />
              <span className="font-tech text-xs" style={{ color: '#ffffff40' }}>
                {status === 'loading' ? 'SYNC…' : status === 'ok' ? `${countdown}s` : status === 'error' ? 'ERR' : '—'}
              </span>
            </div>

            {/* API key bars */}
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-1"
              title={`Key ${keyStatus.active + 1}/8 · ${keyStatus.total} calls today`}
            >
              <div className="flex gap-0.5 items-end h-4">
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} className="w-1 rounded-sm transition-all"
                       style={{
                         height: i === keyStatus.active ? 14 : 8,
                         background: i === keyStatus.active ? '#FFB800'
                           : i < keyStatus.active ? '#ffffff15' : '#ffffff25',
                         boxShadow: i === keyStatus.active ? '0 0 6px #FFB800' : '',
                       }} />
                ))}
              </div>
              <span className="font-tech text-xs" style={{ color: '#ffffff30' }}>{keyUsedPct}%</span>
            </button>

            <button onClick={() => setShowSettings(true)}
                    className="font-orbitron text-sm px-1"
                    style={{ color: '#00F5FF60' }}>⚙</button>
          </div>
        </div>
      </div>

      {/* ── Symbol strip ────────────────────────────── */}
      <div className="sticky top-[57px] z-30 overflow-x-auto"
           style={{ background: 'rgba(2,12,27,.95)', borderBottom: '1px solid rgba(0,245,255,.08)' }}>
        <div className="flex gap-2 px-4 py-2 w-max min-w-full">
          {SYMBOL_OPTIONS.map(sym => {
            const active = settings.symbol === sym.value;
            return (
              <button
                key={sym.value}
                onClick={() => {
                  const next = { ...settings, symbol: sym.value };
                  saveSettings(next); setSettings(next); setSignal(null); startInterval(next);
                }}
                className="flex-shrink-0 px-3 py-1 rounded font-tech text-xs transition-all"
                style={{
                  background: active ? `${dirAccent}20` : 'rgba(255,255,255,.04)',
                  border: `1px solid ${active ? dirAccent : 'rgba(255,255,255,.08)'}`,
                  color: active ? dirAccent : '#ffffff50',
                  boxShadow: active ? `0 0 10px ${dirAccent}40` : '',
                  textShadow: active ? `0 0 8px ${dirAccent}` : '',
                }}
              >
                {sym.icon} {sym.display}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab nav ─────────────────────────────────── */}
      <div className="sticky top-[94px] z-20"
           style={{ background: 'rgba(2,12,27,.95)', borderBottom: '1px solid rgba(0,245,255,.06)' }}>
        <div className="flex max-w-lg mx-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 py-2.5 font-tech text-xs transition-all border-b-2"
              style={{
                borderColor: tab === t.id ? '#00F5FF' : 'transparent',
                color: tab === t.id ? '#00F5FF' : '#ffffff35',
                textShadow: tab === t.id ? '0 0 10px #00F5FF' : '',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────── */}
      <div className="max-w-lg mx-auto px-4 py-4 pb-10">

        {status === 'error' && (
          <div className="rounded-xl p-4 mb-4 font-tech text-sm"
               style={{ background: 'rgba(255,45,85,.1)', border: '1px solid rgba(255,45,85,.3)', color: '#FF2D55' }}>
            <p className="font-bold mb-1">⚠ {errorMsg}</p>
            <button onClick={() => analyze(settings)}
                    className="underline text-xs" style={{ color: '#FFB800' }}>
              ↻ RETRY
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {status === 'loading' && !signal && (
          <div className="space-y-3">
            {[280, 80, 80].map((h, i) => (
              <div key={i} className="rounded-2xl animate-pulse"
                   style={{ height: h, background: 'rgba(0,245,255,.04)', border: '1px solid rgba(0,245,255,.08)' }} />
            ))}
          </div>
        )}

        {signal && (
          <>
            {tab === 'signal' && (
              <div className="space-y-4">
                <SignalCard signal={signal} currentPrice={currentPrice}
                           blackout={blackout} nextEvent={nextEvent} />

                <button
                  onClick={() => analyze(settings)}
                  disabled={status === 'loading'}
                  className="w-full py-3 rounded-xl font-tech text-xs transition-all disabled:opacity-40"
                  style={{
                    background: 'rgba(0,245,255,.05)',
                    border: '1px solid rgba(0,245,255,.15)',
                    color: '#00F5FF80',
                  }}
                >
                  {status === 'loading' ? '⟳ SYNCING…' : '⟳ REFRESH NOW'}
                </button>

                {lastUpdate && (
                  <p className="font-tech text-xs text-center" style={{ color: '#ffffff20' }}>
                    LAST SYNC · {lastUpdate.toLocaleTimeString('uk-UA')}
                  </p>
                )}
              </div>
            )}
            {tab === 'indicators' && <IndicatorVotes votes={signal.votes} />}
            {tab === 'support'    && <SupportPanel support={signal.support} symbol={signal.symbol} />}
            {tab === 'calendar'   && <CalendarTab events={calEvents} symbol={settings.symbol} loading={calLoading} />}
          </>
        )}
      </div>

      {showSettings && (
        <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
