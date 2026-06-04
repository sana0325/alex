import React, { useState } from 'react';
import { AppSettings } from '../types';
import { TIMEFRAME_OPTIONS } from '../constants';

interface Props {
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<Props> = ({ settings, onSave, onClose }) => {
  const [s, setS] = useState<AppSettings>({ ...settings });

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
          {/* API */}
          <div>
            <p className="text-xs font-bold text-yellow-500 uppercase tracking-widest mb-3">📡 Джерело даних</p>
            <div className="space-y-3">
              {field('TwelveData API Key', 'apiKey', 'text',
                'Безкоштовний ключ: twelvedata.com → Sign Up → Dashboard → API Keys (800 запитів/день)')}
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