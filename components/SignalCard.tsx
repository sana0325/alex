import React from 'react';
import { GoldSignal } from '../types';

interface Props {
  signal: GoldSignal;
  currentPrice: number;
}

export const SignalCard: React.FC<Props> = ({ signal, currentPrice }) => {
  const { direction, longVotes, shortVotes, confidence, filterReasons, filtersOk, isContrarian } = signal;

  const bgColor = direction === 'LONG'
    ? 'bg-gradient-to-br from-green-900/60 to-green-800/30 border-green-500/50'
    : direction === 'SHORT'
    ? 'bg-gradient-to-br from-red-900/60 to-red-800/30 border-red-500/50'
    : 'bg-gradient-to-br from-gray-900/60 to-gray-800/30 border-gray-600/50';

  const dirLabel = direction === 'LONG' ? '▲ ЛОНГ' : direction === 'SHORT' ? '▼ ШОРТ' : '— ОЧІКУЄМО';
  const dirColor = direction === 'LONG' ? 'text-green-400' : direction === 'SHORT' ? 'text-red-400' : 'text-gray-400';

  const longPct = (longVotes / 26) * 100;
  const shortPct = (shortVotes / 26) * 100;

  return (
    <div className={`rounded-2xl border p-5 ${bgColor} shadow-lg`}>
      {/* Contrarian badge */}
      {isContrarian && (
        <div className="flex justify-center mb-3">
          <span className="bg-purple-900/60 border border-purple-500/50 text-purple-300 text-xs font-bold px-3 py-1 rounded-full tracking-widest">
            ⟳ КОНТР-РЕЖИМ — ТОРГУЄМО ПРОТИ
          </span>
        </div>
      )}

      {/* Direction */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">
            {isContrarian ? 'Наш вхід (проти індикаторів)' : 'Торговий сигнал'}
          </p>
          <p className={`text-4xl font-black ${dirColor}`}>{dirLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 mb-1">Впевненість</p>
          <p className={`text-2xl font-bold ${dirColor}`}>{confidence.toFixed(0)}%</p>
        </div>
      </div>

      {/* Price */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 mb-0.5">{signal.symbol.replace('/', '')}</p>
        <p className="text-3xl font-mono font-bold text-yellow-400">
          {currentPrice > 0 ? currentPrice.toFixed(2) : signal.entryPrice.toFixed(2)}
        </p>
      </div>

      {/* Vote bars */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{isContrarian ? 'Індик. ЛОНГ' : 'ЛОНГ'}: {longVotes}/26</span>
          <span>{isContrarian ? 'Індик. ШОРТ' : 'ШОРТ'}: {shortVotes}/26</span>
        </div>
        <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-gray-800">
          <div className="bg-green-500 rounded-l-full transition-all duration-700"
               style={{ width: `${longPct}%` }} />
          <div className="bg-red-500 rounded-r-full transition-all duration-700 ml-auto"
               style={{ width: `${shortPct}%` }} />
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-green-400 font-semibold">{longPct.toFixed(0)}%</span>
          <span className="text-gray-500">Нейтральні: {signal.neutralVotes}</span>
          <span className="text-red-400 font-semibold">{shortPct.toFixed(0)}%</span>
        </div>
      </div>

      {/* SL/TP */}
      {direction !== 'NONE' && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-black/30 rounded-lg p-2 text-center">
            <p className="text-xs text-gray-500">Вхід</p>
            <p className="text-sm font-mono text-yellow-300">{signal.entryPrice.toFixed(2)}</p>
          </div>
          <div className="bg-black/30 rounded-lg p-2 text-center">
            <p className="text-xs text-red-400">Стоп</p>
            <p className="text-sm font-mono text-red-300">{signal.stopLoss.toFixed(2)}</p>
          </div>
          <div className="bg-black/30 rounded-lg p-2 text-center">
            <p className="text-xs text-green-400">Тейк</p>
            <p className="text-sm font-mono text-green-300">{signal.takeProfit.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* RR + filters */}
      {direction !== 'NONE' && (
        <p className="text-xs text-gray-400 text-center mb-3">
          RR 1:{signal.riskReward.toFixed(2)} · ATR {signal.support.atr.toFixed(2)}
        </p>
      )}

      {/* Filter warnings */}
      {!filtersOk && (
        <div className="bg-orange-900/30 border border-orange-700/40 rounded-lg p-3">
          <p className="text-xs text-orange-400 font-semibold mb-1">⚠ Фільтри не пройдено:</p>
          {filterReasons.map((r, i) => (
            <p key={i} className="text-xs text-orange-300">• {r}</p>
          ))}
        </div>
      )}

      {/* Timestamp */}
      <p className="text-xs text-gray-600 text-right mt-3">
        {new Date(signal.timestamp).toLocaleTimeString('uk-UA')}
      </p>
    </div>
  );
};
