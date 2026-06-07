import React, { useState } from 'react';
import { EarningEntry, Currency } from '../types';

interface Props {
  earnings: EarningEntry[];
  onUpdate: (entries: EarningEntry[]) => void;
}

const CURRENCIES: Currency[] = ['USD', 'EUR', 'UAH'];

function toUSD(amount: number, currency: Currency) {
  if (currency === 'USD') return amount;
  if (currency === 'EUR') return amount * 1.08;
  return amount / 41;
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function monthLabel(key: string) {
  const [y, m] = key.split('-');
  const months = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

export function EarningsTracker({ earnings, onUpdate }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [platform, setPlatform] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [task, setTask] = useState('');

  const add = () => {
    const num = parseFloat(amount);
    if (!platform || isNaN(num) || num <= 0) return;
    const entry: EarningEntry = {
      id: Date.now().toString(),
      platform,
      amount: num,
      currency,
      date,
      task,
    };
    onUpdate([...earnings, entry]);
    setPlatform('');
    setAmount('');
    setTask('');
    setDate(new Date().toISOString().slice(0, 10));
    setShowForm(false);
  };

  const remove = (id: string) => {
    onUpdate(earnings.filter(e => e.id !== id));
  };

  const totalUSD = earnings.reduce((s, e) => s + toUSD(e.amount, e.currency), 0);

  // Group by month
  const byMonth: Record<string, EarningEntry[]> = {};
  earnings.forEach(e => {
    const k = monthKey(e.date);
    if (!byMonth[k]) byMonth[k] = [];
    byMonth[k].push(e);
  });
  const months = Object.keys(byMonth).sort().reverse();

  // Chart data — last 6 months
  const now = new Date();
  const chartMonths = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const chartValues = chartMonths.map(m =>
    (byMonth[m] || []).reduce((s, e) => s + toUSD(e.amount, e.currency), 0)
  );
  const maxVal = Math.max(...chartValues, 1);

  // By platform
  const byPlatform: Record<string, number> = {};
  earnings.forEach(e => {
    byPlatform[e.platform] = (byPlatform[e.platform] || 0) + toUSD(e.amount, e.currency);
  });
  const platformList = Object.entries(byPlatform).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      {/* Total */}
      <div className="bg-gradient-to-br from-green-900/30 to-emerald-950/20 border border-green-800/40 rounded-2xl p-5">
        <p className="text-xs text-gray-400 mb-1">Загальний заробіток (USD)</p>
        <p className="text-4xl font-black text-green-400">${totalUSD.toFixed(2)}</p>
        <p className="text-xs text-gray-500 mt-1">{earnings.length} транзакцій</p>
      </div>

      {/* Chart */}
      {earnings.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-sm font-bold text-white mb-3">Заробіток по місяцях</p>
          <div className="flex items-end gap-1.5 h-24">
            {chartMonths.map((m, i) => {
              const val = chartValues[i];
              const heightPct = (val / maxVal) * 100;
              const isNow = m === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
              return (
                <div key={m} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center" style={{ height: '80px' }}>
                    <div
                      className={`w-full rounded-t-md transition-all ${isNow ? 'bg-green-400' : 'bg-gray-700'}`}
                      style={{ height: `${Math.max(heightPct, val > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-gray-600">{monthLabel(m).slice(0, 3)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* By platform */}
      {platformList.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-sm font-bold text-white mb-3">По платформах</p>
          <div className="space-y-2">
            {platformList.map(([name, usd]) => {
              const pct = (usd / totalUSD) * 100;
              return (
                <div key={name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-300">{name}</span>
                    <span className="text-green-400">${usd.toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add button */}
      <button
        onClick={() => setShowForm(!showForm)}
        className="w-full bg-green-500 hover:bg-green-400 text-black font-bold py-3 rounded-xl text-sm transition-colors"
      >
        {showForm ? '✕ Скасувати' : '+ Додати надходження'}
      </button>

      {/* Add form */}
      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-bold text-white">Нове надходження</p>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Платформа *</label>
            <input
              type="text"
              value={platform}
              onChange={e => setPlatform(e.target.value)}
              placeholder="Upwork, Fiverr..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">Сума *</label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500"
              />
            </div>
            <div className="w-24">
              <label className="text-xs text-gray-400 mb-1 block">Валюта</label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value as Currency)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Опис завдання</label>
            <input
              type="text"
              value={task}
              onChange={e => setTask(e.target.value)}
              placeholder="Дизайн логотипу, SEO-текст..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Дата</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"
            />
          </div>

          <button
            onClick={add}
            disabled={!platform || !amount}
            className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-40 text-black font-bold py-2.5 rounded-xl text-sm transition-colors"
          >
            Зберегти
          </button>
        </div>
      )}

      {/* History */}
      {months.length > 0 && (
        <div className="space-y-3">
          {months.map(m => {
            const mes = byMonth[m];
            const mTotal = mes.reduce((s, e) => s + toUSD(e.amount, e.currency), 0);
            return (
              <div key={m} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-sm font-bold text-white">{monthLabel(m)}</p>
                  <p className="text-green-400 font-bold text-sm">${mTotal.toFixed(2)}</p>
                </div>
                <div className="space-y-2">
                  {mes.slice().reverse().map(e => (
                    <div key={e.id} className="flex items-center justify-between group">
                      <div>
                        <p className="text-sm text-white">{e.task || '—'}</p>
                        <p className="text-xs text-gray-500">{e.platform} · {e.date}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-green-400 font-bold text-sm">+{e.amount} {e.currency}</span>
                        <button
                          onClick={() => remove(e.id)}
                          className="text-gray-700 hover:text-red-400 transition-colors text-sm opacity-0 group-hover:opacity-100"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {earnings.length === 0 && !showForm && (
        <div className="text-center py-8 text-gray-600">
          <p className="text-4xl mb-2">💸</p>
          <p className="text-sm">Ще немає записів. Додай свій перший заробіток!</p>
        </div>
      )}
    </div>
  );
}
