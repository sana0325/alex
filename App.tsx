import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoldSignal, AppSettings, Candle } from './types';
import { DEFAULT_SETTINGS, SETTINGS_KEY, SYMBOL_DISPLAY } from './constants';
import { analyzeGold } from './services/indicators';
import { fetchGoldCandles, fetchCurrentPrice } from './services/goldApi';
import { SignalCard } from './components/SignalCard';
import { IndicatorVotes } from './components/IndicatorVotes';
import { SupportPanel } from './components/SupportPanel';
import { SettingsModal } from './components/SettingsModal';

type Tab = 'signal' | 'indicators' | 'support';

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [signal, setSignal] = useState<GoldSignal | null>(null);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [tab, setTab] = useState<Tab>('signal');
  const [showSettings, setShowSettings] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const analyze = useCallback(async (s: AppSettings) => {
    if (!s.apiKey) {
      setStatus('error');
      setErrorMsg('Введіть API ключ TwelveData в налаштуваннях');
      return;
    }
    setStatus('loading');
    setErrorMsg('');
    try {
      const candles: Candle[] = await fetchGoldCandles(s);
      const result = analyzeGold(candles, s);
      setSignal(result);
      setCurrentPrice(result.entryPrice);
      setLastUpdate(new Date());
      setStatus('ok');

      // Also fetch live price
      fetchCurrentPrice(s.apiKey).then(p => { if (p) setCurrentPrice(p); });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus('error');
      setErrorMsg(msg);
    }
  }, []);

  const startInterval = useCallback((s: AppSettings) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (countRef.current) clearInterval(countRef.current);

    analyze(s);
    setCountdown(s.refreshSeconds);

    intervalRef.current = setInterval(() => {
      analyze(s);
      setCountdown(s.refreshSeconds);
    }, s.refreshSeconds * 1000);

    countRef.current = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
  }, [analyze]);

  useEffect(() => {
    startInterval(settings);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countRef.current) clearInterval(countRef.current);
    };
  }, []);

  const handleSaveSettings = (s: AppSettings) => {
    saveSettings(s);
    setSettings(s);
    startInterval(s);
  };

  const dirColor = signal?.direction === 'LONG' ? 'text-green-400'
    : signal?.direction === 'SHORT' ? 'text-red-400' : 'text-gray-500';

  const tabs: { id: Tab; label: string }[] = [
    { id: 'signal', label: 'Сигнал' },
    { id: 'indicators', label: 'Індикатори' },
    { id: 'support', label: 'Фільтри' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-800/60 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <span className="text-yellow-400 text-xl">◈</span>
            <div>
              <p className="text-xs text-gray-500 leading-none">{SYMBOL_DISPLAY}</p>
              <p className={`text-lg font-black leading-tight ${dirColor}`}>
                {signal
                  ? signal.direction === 'LONG' ? '▲ ЛОНГ'
                  : signal.direction === 'SHORT' ? '▼ ШОРТ'
                  : '— ОЧІКУВАННЯ'
                  : 'Gold Scalp'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Status indicator */}
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${
                status === 'loading' ? 'bg-yellow-400 animate-pulse'
                : status === 'ok' ? 'bg-green-400'
                : status === 'error' ? 'bg-red-400'
                : 'bg-gray-600'
              }`} />
              <span className="text-xs text-gray-500">
                {status === 'loading' ? 'Оновлення…'
                : status === 'ok' ? `${countdown}с`
                : status === 'error' ? 'Помилка'
                : '—'}
              </span>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="text-gray-400 text-xl px-1"
            >⚙</button>
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <div className="sticky top-[57px] z-30 bg-gray-950/95 backdrop-blur border-b border-gray-800/40">
        <div className="flex max-w-lg mx-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors border-b-2 ${
                tab === t.id
                  ? 'border-yellow-400 text-yellow-400'
                  : 'border-transparent text-gray-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-4 pb-8">

        {/* Error banner */}
        {status === 'error' && (
          <div className="bg-red-900/30 border border-red-800/50 rounded-xl p-4 mb-4 text-sm text-red-300">
            <p className="font-semibold mb-1">⚠ {errorMsg}</p>
            {!settings.apiKey && (
              <button
                onClick={() => setShowSettings(true)}
                className="text-yellow-400 underline text-xs mt-1"
              >
                → Відкрити налаштування
              </button>
            )}
          </div>
        )}

        {/* No API key prompt */}
        {!settings.apiKey && status !== 'loading' && (
          <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-5 mb-4 text-center">
            <p className="text-yellow-400 text-4xl mb-2">◈</p>
            <p className="text-white font-bold mb-1">Gold Scalp Signals</p>
            <p className="text-gray-400 text-sm mb-4">
              32 індикатори · XAUUSD · Скальпінг 5-10хв
            </p>
            <button
              onClick={() => setShowSettings(true)}
              className="bg-yellow-500 text-black font-bold px-6 py-3 rounded-xl text-sm"
            >
              Ввести API ключ TwelveData
            </button>
            <p className="text-gray-600 text-xs mt-3">
              Безкоштовно на twelvedata.com
            </p>
          </div>
        )}

        {/* Loading skeleton */}
        {status === 'loading' && !signal && (
          <div className="animate-pulse space-y-3">
            <div className="h-48 bg-gray-800 rounded-2xl" />
            <div className="h-16 bg-gray-800 rounded-xl" />
            <div className="h-16 bg-gray-800 rounded-xl" />
          </div>
        )}

        {/* Main content */}
        {signal && (
          <>
            {tab === 'signal' && (
              <div className="space-y-4">
                <SignalCard signal={signal} currentPrice={currentPrice} />
                {/* Manual refresh */}
                <button
                  onClick={() => analyze(settings)}
                  disabled={status === 'loading'}
                  className="w-full bg-gray-900 border border-gray-800 hover:border-yellow-700/50 text-gray-300 font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-50"
                >
                  {status === 'loading' ? 'Оновлення…' : '↻ Оновити зараз'}
                </button>
                {lastUpdate && (
                  <p className="text-xs text-gray-600 text-center">
                    Останнє оновлення: {lastUpdate.toLocaleTimeString('uk-UA')}
                  </p>
                )}
              </div>
            )}
            {tab === 'indicators' && <IndicatorVotes votes={signal.votes} />}
            {tab === 'support' && <SupportPanel support={signal.support} />}
          </>
        )}
      </div>

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
