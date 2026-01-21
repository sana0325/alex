import React, { useState, useEffect } from 'react';
import { DEFAULT_PAIRS } from '../constants';
import { fetch24hTicker } from '../services/binance';
import { Plus, Trash2, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';

interface TickerData {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  volume: string;
}

interface DashboardProps {
  onSelectPair: (pair: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectPair }) => {
  const [pairs, setPairs] = useState<string[]>(DEFAULT_PAIRS);
  const [tickers, setTickers] = useState<Record<string, TickerData>>({});
  const [newPair, setNewPair] = useState('');

  useEffect(() => {
    const updateTickers = async () => {
      const promises = pairs.map(p => fetch24hTicker(p));
      const results = await Promise.all(promises);
      
      const nextTickers: Record<string, TickerData> = {};
      results.forEach((res) => {
        if (res && res.symbol) nextTickers[res.symbol] = res;
      });
      setTickers(nextTickers);
    };

    updateTickers();
    const interval = setInterval(updateTickers, 5000);
    return () => clearInterval(interval);
  }, [pairs]);

  const addPair = () => {
    const formatted = newPair.toUpperCase();
    if (formatted && !pairs.includes(formatted)) {
      setPairs([...pairs, formatted]);
      setNewPair('');
    }
  };

  const removePair = (pair: string) => {
    setPairs(pairs.filter(p => p !== pair));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-100">Market Overview</h2>
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Add Pair (e.g. BTCUSDT)" 
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 outline-none focus:border-blue-500"
            value={newPair}
            onChange={(e) => setNewPair(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPair()}
          />
          <button 
            onClick={addPair}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded transition-colors"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pairs.map(pair => {
          const ticker = tickers[pair];
          const isUp = ticker && parseFloat(ticker.priceChangePercent) >= 0;

          return (
            <div key={pair} className="bg-[#1f2937] rounded-xl border border-gray-700 p-5 hover:border-gray-500 transition-all shadow-lg group">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-100">{pair}</h3>
                  <span className="text-xs text-gray-400">Perpetual / Spot</span>
                </div>
                {ticker ? (
                  <div className={`text-right ${isUp ? 'text-trade-up' : 'text-trade-down'}`}>
                    <div className="text-2xl font-mono font-medium">${parseFloat(ticker.lastPrice).toLocaleString()}</div>
                    <div className="flex items-center justify-end gap-1 text-sm font-semibold">
                      {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {parseFloat(ticker.priceChangePercent).toFixed(2)}%
                    </div>
                  </div>
                ) : (
                  <div className="animate-pulse h-10 w-24 bg-gray-700 rounded"></div>
                )}
              </div>

              <div className="flex justify-between items-center mt-4">
                <button 
                  onClick={() => removePair(pair)}
                  className="text-gray-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
                <button 
                  onClick={() => onSelectPair(pair)}
                  className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-blue-400 px-4 py-2 rounded-lg font-medium text-sm transition-colors border border-gray-700"
                >
                  Analysis <ArrowRight size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
