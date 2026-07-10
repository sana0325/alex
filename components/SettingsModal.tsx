import React, { useState } from 'react';
import { TradeBotSettings } from '../types';

interface Props {
  open: boolean;
  settings: TradeBotSettings;
  onClose: () => void;
  onSave: (settings: TradeBotSettings) => void;
}

export function SettingsModal({ open, settings, onClose, onSave }: Props) {
  const [form, setForm] = useState<TradeBotSettings>(settings);
  const [showSecret, setShowSecret] = useState(false);
  const [showKey, setShowKey] = useState(false);

  if (!open) return null;

  const handleSave = () => {
    onSave(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#0a0a12] border border-[#22223a] rounded-lg w-full max-w-md p-5 font-mono max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-black uppercase tracking-widest text-blue-400 mb-4">Налаштування</h2>

        <label className="block text-[11px] text-gray-500 uppercase font-bold mb-1">BingX API Key</label>
        <div className="flex gap-2 mb-1">
          <input
            type={showKey ? 'text' : 'password'}
            value={form.bingxApiKey}
            onChange={(e) => setForm(f => ({ ...f, bingxApiKey: e.target.value }))}
            placeholder="API Key"
            className="flex-1 bg-[#111122] border border-[#22223a] rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
          />
          <button onClick={() => setShowKey(s => !s)} className="px-3 py-2 bg-[#151522] border border-[#232336] rounded text-xs text-gray-400 hover:text-white">
            {showKey ? '🙈' : '👁'}
          </button>
        </div>

        <label className="block text-[11px] text-gray-500 uppercase font-bold mb-1 mt-3">BingX API Secret</label>
        <div className="flex gap-2 mb-1">
          <input
            type={showSecret ? 'text' : 'password'}
            value={form.bingxApiSecret}
            onChange={(e) => setForm(f => ({ ...f, bingxApiSecret: e.target.value }))}
            placeholder="API Secret"
            className="flex-1 bg-[#111122] border border-[#22223a] rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
          />
          <button onClick={() => setShowSecret(s => !s)} className="px-3 py-2 bg-[#151522] border border-[#232336] rounded text-xs text-gray-400 hover:text-white">
            {showSecret ? '🙈' : '👁'}
          </button>
        </div>
        <p className="text-[10px] text-gray-600 mb-3">
          Створіть ключ на bingx.com з правом торгівлі на ф'ючерсах (Perpetual Futures). Зберігається лише на цьому телефоні.
        </p>

        <label className="block text-[11px] text-gray-500 uppercase font-bold mb-1">DeepSeek API ключ</label>
        <input
          type="password"
          value={form.deepseekKey}
          onChange={(e) => setForm(f => ({ ...f, deepseekKey: e.target.value }))}
          placeholder="sk-..."
          className="w-full bg-[#111122] border border-[#22223a] rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500 mb-3"
        />

        <label className="block text-[11px] text-gray-500 uppercase font-bold mb-1">Плече</label>
        <input
          type="number"
          min={1}
          max={50}
          value={form.leverage}
          onChange={(e) => setForm(f => ({ ...f, leverage: Number(e.target.value) || 1 }))}
          className="w-full bg-[#111122] border border-[#22223a] rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500 mb-4"
        />

        <div className="flex items-center justify-between bg-[#111122] border border-[#22223a] rounded px-3 py-2.5 mb-5">
          <div>
            <div className="text-xs font-bold text-white">Реальна торгівля (LIVE)</div>
            <div className="text-[10px] text-gray-500">Вимкнено = бот тільки читає ринок і рахує сигнали, ордери не відправляються.</div>
          </div>
          <button
            onClick={() => setForm(f => ({ ...f, liveTradingEnabled: !f.liveTradingEnabled }))}
            className={`w-12 h-6 rounded-full flex items-center px-0.5 transition-all shrink-0 ${form.liveTradingEnabled ? 'bg-red-600 justify-end' : 'bg-gray-700 justify-start'}`}
          >
            <span className="w-5 h-5 rounded-full bg-white block" />
          </button>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded bg-[#151522] border border-[#232336] text-xs font-bold text-gray-400 hover:text-white">
            Скасувати
          </button>
          <button onClick={handleSave} className="flex-1 py-2.5 rounded bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white">
            Зберегти
          </button>
        </div>
      </div>
    </div>
  );
}
