import React, { useState } from 'react';

interface Props {
  open: boolean;
  bridgeHost: string;
  deepseekKey: string;
  onClose: () => void;
  onSave: (bridgeHost: string, deepseekKey: string) => void;
}

export function SmcSettingsModal({ open, bridgeHost, deepseekKey, onClose, onSave }: Props) {
  const [host, setHost] = useState(bridgeHost);
  const [key, setKey] = useState(deepseekKey);
  const [showKey, setShowKey] = useState(false);

  if (!open) return null;

  const handleSave = () => {
    onSave(host.trim(), key.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#0a0a12] border border-[#22223a] rounded-lg w-full max-w-md p-5 font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-black uppercase tracking-widest text-blue-400 mb-4">Налаштування</h2>

        <label className="block text-[11px] text-gray-500 uppercase font-bold mb-1">
          Адреса MT5 бриджа (LAN IP:порт)
        </label>
        <input
          type="text"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          placeholder="192.168.1.50:8765"
          className="w-full bg-[#111122] border border-[#22223a] rounded px-3 py-2 text-sm text-white mb-1 outline-none focus:border-blue-500"
        />
        <p className="text-[10px] text-gray-600 mb-4">
          IP комп'ютера, де запущений MT5 і скрипт-міст (той самий Wi-Fi). Приклад: 192.168.1.50:8765
        </p>

        <label className="block text-[11px] text-gray-500 uppercase font-bold mb-1">DeepSeek API ключ</label>
        <div className="flex gap-2 mb-1">
          <input
            type={showKey ? 'text' : 'password'}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-..."
            className="flex-1 bg-[#111122] border border-[#22223a] rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
          />
          <button
            onClick={() => setShowKey(s => !s)}
            className="px-3 py-2 bg-[#151522] border border-[#232336] rounded text-xs text-gray-400 hover:text-white"
          >
            {showKey ? '🙈' : '👁'}
          </button>
        </div>
        <p className="text-[10px] text-gray-600 mb-5">
          Зберігається лише на цьому телефоні (не входить у код застосунку).
        </p>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded bg-[#151522] border border-[#232336] text-xs font-bold text-gray-400 hover:text-white"
          >
            Скасувати
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white"
          >
            Зберегти
          </button>
        </div>
      </div>
    </div>
  );
}
