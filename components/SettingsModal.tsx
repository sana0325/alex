import React, { useState } from 'react';
import { AppSettings } from '../types';
import { TIMEFRAME_OPTIONS } from '../constants';
import { getKeyStatus } from '../services/goldApi';

interface Props {
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<Props> = ({ settings, onSave, onClose }) => {
  const [s, setS] = useState<AppSettings>({ ...settings });
  const keyStatus = getKeyStatus();

  const field = (label: string, key: keyof AppSettings, type: 'text' | 'number' = 'text', hint?: string) => (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={s[key] as string | number}
        onChange={e => setS(prev => ({
          ...prev,
          [key]: type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value
        }))}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-500"
      />
      {hint && <p className="text-xs text-gray-600 mt-1">{hint}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end">
      <div className="w-full bg-gray-950 border-t border-gray-800 rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-950 flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-lg font-bold text-yellow-400">⚙ Налаштування</h2>
          <button onClick={onClose} className="text-gray-400 text-2xl w-8 h-8 flex items-center justify-center">✕</button>
        </div>

        <div className="p-5 space-y-6">
          {/* Built-in keys status */}
          <div>
            <p className="text-xs font-bold text-yellow-500 uppercase tracking-widest mb-3">📡 Вбудовані API ключі</p>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-300 font-medium">8 ключів TwelveData</span>
                <span className="text-xs text-green-400 font-bold">● Активний #{keyStatus.active + 1}</span>
              </div>
              {/* Key bars */}
              <div className="flex gap-1 mb-2">
                {keyStatus.calls.map((calls, i) => {
                  const pct = Math.min(100, (calls / 790) * 100);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                      <div className="w-full h-8 bg-gray-800 rounded relative overflow-hidden">
                        <div
                          className={`absolute bottom-0 left-0 right-0 transition-all ${
                            i === keyStatus.active ? 'bg-yellow-500' : pct > 80 ? 'bg-red-600' : 'bg-green-700'
                          }`}
                          style={{ height: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600">{i + 1}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 text-center">
                Сьогодні: {keyStatus.total} / {keyStatus.limit} запитів
              </p>
            </div>
          </div>

          {/* Optional custom key */}
          <div>
            <p className="text-xs font-bold text-yellow-500 uppercase tracking-widest mb-2">🔑 Свій ключ (необов'язково)</p>
            <div className="space-y-1">
              {field('Власний TwelveData API Key (має пріоритет)', 'apiKey', 'text')}
              <p className="text-xs text-gray-600">
                Залишіть порожнім — використовуються вбудовані ключі автоматично
              </p>
            </div>
          </div>

          {/* Timeframe */}
          <div>
            <p className="text-xs font-bold text-yellow-500 uppercase tracking-widest mb-3">⏱ Таймфрейм</p>
            <div className="flex gap-2">
              {TIMEFRAME_OPTIONS.map(tf => (
                <button
                  key={tf.value}
                  onClick={() => setS(prev => ({ ...prev, timeframe: tf.value as AppSettings['timeframe'] }))}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    s.timeframe === tf.value ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>

          {/* Thresholds */}
          <div>
            <p className="text-xs font-bold text-yellow-500 uppercase tracking-widest mb-3">🎯 Поріг сигналу (з 26)</p>
            <div className="grid grid-cols-2 gap-3">
              {field('Лонг (мін. голосів)', 'longThreshold', 'number')}
              {field('Шорт (мін. голосів)', 'shortThreshold', 'number')}
            </div>
          </div>

          {/* Risk */}
          <div>
            <p className="text-xs font-bold text-yellow-500 uppercase tracking-widest mb-3">💰 Ризик-менеджмент</p>
            <div className="grid grid-cols-2 gap-3">
              {field('Стоп = ATR ×', 'slMultiplier', 'number')}
              {field('Тейк = ATR ×', 'tpMultiplier', 'number')}
            </div>
          </div>

          {/* Session */}
          <div>
            <p className="text-xs font-bold text-yellow-500 uppercase tracking-widest mb-3">🕐 Сесія (UTC годин)</p>
            <div className="grid grid-cols-2 gap-3">
              {field('Початок', 'sessionStartUTC', 'number')}
              {field('Кінець', 'sessionEndUTC', 'number')}
            </div>
            <p className="text-xs text-gray-600 mt-2">Лондон: 7–16 · Нью-Йорк: 12–20 · Рекомендовано: 7–20</p>
          </div>

          {/* Filters */}
          <div>
            <p className="text-xs font-bold text-yellow-500 uppercase tracking-widest mb-3">🔍 Фільтри</p>
            <div className="grid grid-cols-2 gap-3">
              {field('Мін. ADX', 'minAdx', 'number')}
              {field('Оновлення (сек.)', 'refreshSeconds', 'number')}
            </div>
          </div>

          {/* Contrarian mode */}
          <div>
            <p className="text-xs font-bold text-yellow-500 uppercase tracking-widest mb-3">⟳ Режим торгівлі</p>
            <button
              onClick={() => setS(prev => ({ ...prev, contrarian: !prev.contrarian }))}
              className={`w-full py-4 rounded-xl text-sm font-bold border-2 transition-colors ${
                s.contrarian
                  ? 'bg-purple-900/50 border-purple-500 text-purple-300'
                  : 'bg-gray-800 border-gray-700 text-gray-400'
              }`}
            >
              {s.contrarian ? '⟳ КОНТР-РЕЖИМ: ПРОТИ ІНДИКАТОРІВ' : '→ ЗВИЧАЙНИЙ: ЗА ІНДИКАТОРАМИ'}
            </button>
            <p className="text-xs text-gray-600 mt-2 text-center">
              {s.contrarian
                ? 'Індикатори кажуть ЛОНГ → ми у ШОРТІ, і навпаки'
                : 'Торгуємо за напрямком більшості індикаторів'}
            </p>
          </div>

          <button
            onClick={() => { onSave(s); onClose(); }}
            className="w-full bg-yellow-500 text-black font-bold py-4 rounded-xl text-base"
          >
            ✓ Зберегти налаштування
          </button>
        </div>
      </div>
    </div>
  );
};