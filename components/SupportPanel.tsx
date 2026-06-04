import React from 'react';
import { SupportData } from '../types';

interface Props {
  support: SupportData;
}

export const SupportPanel: React.FC<Props> = ({ support }) => {
  const items = [
    {
      label: 'ATR(14)',
      value: support.atr.toFixed(2),
      sub: 'Волатильність',
      color: 'text-blue-400',
    },
    {
      label: 'BB Width',
      value: `${support.bbWidth.toFixed(2)}%`,
      sub: support.bbWidth > 0.1 ? 'Достатня' : 'Низька',
      color: support.bbWidth > 0.1 ? 'text-green-400' : 'text-orange-400',
    },
    {
      label: 'ADX',
      value: support.adxStrength.toFixed(1),
      sub: support.adxStrength > 25 ? 'Сильний' : support.adxStrength > 15 ? 'Помірний' : 'Слабкий',
      color: support.adxStrength > 25 ? 'text-green-400' : support.adxStrength > 15 ? 'text-yellow-400' : 'text-red-400',
    },
    {
      label: 'Pivot PP',
      value: support.pivotPP.toFixed(2),
      sub: `R1: ${support.pivotR1.toFixed(2)} · S1: ${support.pivotS1.toFixed(2)}`,
      color: 'text-purple-400',
    },
    {
      label: 'Обсяг',
      value: `×${support.volumeRatio.toFixed(2)}`,
      sub: support.volumeRatio > 1.2 ? 'Підвищений' : support.volumeRatio > 0.8 ? 'Нормальний' : 'Низький',
      color: support.volumeRatio > 1.2 ? 'text-green-400' : 'text-gray-400',
    },
    {
      label: 'Сесія',
      value: support.inSession ? support.sessionName : 'Закрита',
      sub: 'UTC сесія',
      color: support.inSession ? 'text-green-400' : 'text-red-400',
    },
  ];

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1">
        Допоміжні індикатори (6)
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {items.map(item => (
          <div key={item.label} className="bg-gray-900/70 border border-gray-800 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1">{item.label}</p>
            <p className={`text-lg font-bold font-mono ${item.color}`}>{item.value}</p>
            <p className="text-xs text-gray-600 mt-0.5">{item.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
