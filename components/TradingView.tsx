import React, { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { Candle, AiSignal, OpenTrade, PendingOrder, TradedSymbol } from '../types';

export interface LiveTrade extends OpenTrade {
  markPrice: number;
  unrealizedPnlUSDT: number;
}

interface Props {
  symbols: TradedSymbol[];
  prices: Record<string, number | null>;
  activeSymbol: string;
  onSelectSymbol: (s: string) => void;
  candles: Candle[];
  signal: AiSignal | null;
  pocPrice: number | null;
  liveTrades: LiveTrade[];
  pendingOrder: PendingOrder | null;
  onCloseTrade: (tradeId: string) => void;
  onCancelPendingOrder: () => void;
  aiStatus: string;
  stakeUSDT: number;
  leverage: number;
  live: boolean;
}

const fmt = (v: number | null | undefined, digits: number) =>
  v !== null && v !== undefined ? `$${v.toFixed(digits)}` : '—';

export function TradingView({
  symbols, prices, activeSymbol, onSelectSymbol, candles, signal, pocPrice,
  liveTrades, pendingOrder, onCloseTrade, onCancelPendingOrder, aiStatus, stakeUSDT, leverage, live,
}: Props) {
  const activeMeta = symbols.find(s => s.symbol === activeSymbol) ?? symbols[0];
  const chartRef = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lines = useRef<{ poc: any; res: any; sup: any }>({ poc: null, res: null, sup: null });

  useEffect(() => {
    if (!chartRef.current) return;
    if (chart.current) chart.current.remove();
    lines.current = { poc: null, res: null, sup: null };
    chart.current = createChart(chartRef.current, {
      width: chartRef.current.clientWidth,
      height: 380,
      layout: { background: { color: '#07070c' }, textColor: '#a1a1aa' },
      grid: { vertLines: { color: '#11111f' }, horzLines: { color: '#11111f' } },
      timeScale: { timeVisible: true },
    });
    series.current = chart.current.addCandlestickSeries({
      upColor: '#10b981', downColor: '#ef4444', borderUpColor: '#10b981',
      borderDownColor: '#ef4444', wickUpColor: '#10b981', wickDownColor: '#ef4444',
    });
  }, [activeSymbol]);

  useEffect(() => {
    if (!series.current || candles.length === 0) return;
    series.current.setData(candles.map(c => ({ time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close })));

    if (lines.current.poc) { series.current.removePriceLine(lines.current.poc); lines.current.poc = null; }
    if (lines.current.res) { series.current.removePriceLine(lines.current.res); lines.current.res = null; }
    if (lines.current.sup) { series.current.removePriceLine(lines.current.sup); lines.current.sup = null; }

    if (pocPrice) lines.current.poc = series.current.createPriceLine({ price: pocPrice, color: '#eab308', lineWidth: 2, lineStyle: 0, axisLabelVisible: true, title: 'POC' });
    if (signal?.resLine) lines.current.res = series.current.createPriceLine({ price: signal.resLine, color: '#ef4444', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'OPIR' });
    if (signal?.supLine) lines.current.sup = series.current.createPriceLine({ price: signal.supLine, color: '#10b981', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'ПІДТРИМКА' });
  }, [candles, signal, pocPrice]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {symbols.map(s => {
            const trade = liveTrades.find(t => t.symbol === s.symbol);
            const pending = pendingOrder?.symbol === s.symbol;
            return (
              <button
                key={s.symbol}
                onClick={() => onSelectSymbol(s.symbol)}
                className={`px-3 py-2 rounded border text-xs font-bold font-mono flex items-center gap-2 transition-all ${
                  activeSymbol === s.symbol ? 'bg-[#111128] border-blue-600/50 text-white' : 'bg-[#0a0a12] border-[#1a1a2e] text-gray-500 hover:text-white'
                }`}
              >
                <span>{s.icon} {s.symbol}</span>
                <span className="text-yellow-500">{prices[s.symbol] ? prices[s.symbol]!.toFixed(s.digits) : '—'}</span>
                {trade && <span className={`w-2 h-2 rounded-full animate-pulse ${trade.side === 'LONG' ? 'bg-green-500' : 'bg-red-500'}`} />}
                {pending && <span className="w-2 h-2 rounded-full animate-pulse bg-yellow-500" />}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="text-gray-500">Ставка: <span className="text-yellow-500 font-bold">${stakeUSDT}</span></span>
          <span className="text-gray-500">Плече: <span className="text-blue-400 font-bold">{leverage}x</span></span>
          <span className={`px-2 py-1 rounded font-bold ${live ? 'bg-red-950 text-red-400' : 'bg-gray-800 text-gray-500'}`}>{live ? '● LIVE' : 'НЕ ПІДКЛЮЧЕНО'}</span>
        </div>
      </div>

      <div className="border border-[#131322] rounded-lg overflow-hidden bg-[#07070d]">
        <div className="p-3 bg-[#0a0a15] border-b border-[#1a1a2e] flex justify-between items-center">
          <span className="text-sm font-black text-white uppercase tracking-wider">{activeMeta?.icon} {activeMeta?.label}</span>
          <span className="text-xl font-mono font-black text-yellow-400">{fmt(prices[activeSymbol], activeMeta?.digits ?? 2)}</span>
        </div>
        <div ref={chartRef} className="w-full h-[380px] bg-[#07070c]" />
        <div className="px-4 py-3 text-sm font-mono text-gray-300 border-t border-[#121220] min-h-[50px] bg-[#0b0b14]">
          {signal ? signal.reason : aiStatus}
        </div>
      </div>

      {pendingOrder && (() => {
        const meta = symbols.find(s => s.symbol === pendingOrder.symbol);
        return (
          <div className="p-4 bg-[#0f0d05] border border-yellow-600/30 rounded-lg flex justify-between items-center font-mono text-sm flex-wrap gap-3">
            <div>
              <span className="px-2 py-1 rounded text-xs font-bold bg-yellow-950 text-yellow-400">
                {meta?.icon} {pendingOrder.symbol} {pendingOrder.side} — очікує виконання лімітного ордера
              </span>
              <div className="text-gray-400 mt-2 text-xs">
                Ціна входу: {fmt(pendingOrder.price, meta?.digits ?? 2)} | SL: <span className="text-red-400">{fmt(pendingOrder.sl, meta?.digits ?? 2)}</span> | TP: <span className="text-green-400 font-bold">{fmt(pendingOrder.tp1, meta?.digits ?? 2)}</span>
              </div>
              <div className="text-gray-500 mt-1 text-xs">Мейкер-ордер (менше спреду й комісії) · ставка ${pendingOrder.stakeUSDT} · {pendingOrder.leverage}x</div>
            </div>
            <button onClick={onCancelPendingOrder} className="px-4 py-2 bg-[#151522] border border-[#232336] rounded text-xs hover:bg-red-950/40 hover:text-red-400 transition-all">
              Скасувати ордер
            </button>
          </div>
        );
      })()}

      {liveTrades.length === 0 && !pendingOrder && (
        <div className="p-4 bg-[#090912] border border-[#1a1a2e] rounded-lg text-center text-xs text-gray-500">
          Немає відкритих угод. Бот шукає сетап...
        </div>
      )}

      {liveTrades.map(t => {
        const meta = symbols.find(s => s.symbol === t.symbol);
        return (
          <div key={t.id} className="p-4 bg-[#090912] border border-green-600/20 rounded-lg flex justify-between items-center font-mono text-sm flex-wrap gap-3">
            <div>
              <span className={`px-2 py-1 rounded text-xs font-bold ${t.side === 'LONG' ? 'bg-green-950 text-green-400' : 'bg-red-950 text-red-400'}`}>
                {meta?.icon} {t.symbol} {t.side} [{t.setup}]
              </span>
              {t.simulated && <span className="ml-2 px-2 py-1 rounded text-[10px] font-bold bg-blue-950 text-blue-400">ДЕМО</span>}
              <div className="text-gray-400 mt-2 text-xs">
                Вхід: {fmt(t.entry, meta?.digits ?? 2)} | SL: <span className="text-red-400">{fmt(t.sl, meta?.digits ?? 2)}</span> | TP: <span className="text-green-400 font-bold">{fmt(t.tp1, meta?.digits ?? 2)}</span>
              </div>
              <div className="text-gray-500 mt-1 text-xs">
                Ставка ${t.stakeUSDT} · {t.leverage}x · PnL: <span className={t.unrealizedPnlUSDT >= 0 ? 'text-green-400' : 'text-red-400'}>{t.unrealizedPnlUSDT >= 0 ? '+' : ''}{t.unrealizedPnlUSDT.toFixed(2)}$</span>
              </div>
            </div>
            <button onClick={() => onCloseTrade(t.id)} className="px-4 py-2 bg-[#151522] border border-[#232336] rounded text-xs hover:bg-red-950/40 hover:text-red-400 transition-all">
              {t.simulated ? 'Закрити демо-угоду' : 'Закрити на біржі'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
