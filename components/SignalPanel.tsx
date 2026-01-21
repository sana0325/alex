import React, { useEffect, useState } from 'react';
import { AnalysisResult, ExchangeName } from '../types';
import { executeTrade, loadExchangeConfig } from '../services/trade';
import { 
  ArrowUpRight, ArrowDownRight, RefreshCw, Activity, 
  Target, Shield, PlayCircle, Loader, Ban, CheckCircle2, AlertTriangle, Copy
} from 'lucide-react';

interface SignalPanelProps {
  analysis: AnalysisResult | null;
  onRefresh: () => void;
  loading: boolean;
  lastUpdate?: number;
}

export const SignalPanel: React.FC<SignalPanelProps> = ({ analysis, onRefresh, loading, lastUpdate }) => {
  const [progress, setProgress] = useState(100);
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<{success: boolean, message: string} | null>(null);
  const [selectedExchange, setSelectedExchange] = useState<ExchangeName>('BINANCE');
  const [availableExchanges, setAvailableExchanges] = useState<ExchangeName[]>([]);

  useEffect(() => {
    if (loading) {
        setProgress(0);
        return;
    }
    setProgress(100);
    const startTime = Date.now();
    const duration = 30000;
    const timer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
        setProgress(remaining);
    }, 100);
    return () => clearInterval(timer);
  }, [lastUpdate, loading]);

  useEffect(() => {
    const loadConfigs = async () => {
        const configs = await loadExchangeConfig();
        const avail = Object.keys(configs) as ExchangeName[];
        setAvailableExchanges(avail);
        if (avail.length > 0 && !avail.includes(selectedExchange)) {
            setSelectedExchange(avail[0]);
        }
    };
    loadConfigs();
  }, [loading]);

  const handleExecute = async () => {
    if (!analysis || analysis.status !== 'ACTIVE') return;
    setExecuting(true);
    setExecResult(null);

    // Default to TP2 for automated execution
    const quantity = (1000 * 0.1) / analysis.price; 

    const result = await executeTrade(selectedExchange, {
        symbol: 'BTCUSDT', 
        side: analysis.direction === 'LONG' ? 'BUY' : 'SELL',
        quantity: parseFloat(quantity.toFixed(3)),
        stopLoss: parseFloat(analysis.stopLoss.toFixed(2)),
        takeProfit: parseFloat(analysis.takeProfits[1].toFixed(2))
    });

    setExecResult(result);
    setExecuting(false);
  };

  const copySignal = () => {
      if(!analysis) return;
      const text = `SIGNAL: ${analysis.direction}\nPAIR: BTC/USDT\nENTRY: ${analysis.entryPrice.toFixed(2)}\nSTOP: ${analysis.stopLoss.toFixed(2)}\nTP1: ${analysis.takeProfits[0].toFixed(2)}\nTP2: ${analysis.takeProfits[1].toFixed(2)}`;
      navigator.clipboard.writeText(text);
      alert("Signal copied to clipboard");
  }

  if (!analysis) return null;

  const isLong = analysis.direction === 'LONG';
  const isShort = analysis.direction === 'SHORT';
  const isActive = analysis.status === 'ACTIVE';

  const statusColor = isActive ? (isLong ? 'bg-green-500' : 'bg-red-500') : 'bg-gray-600';
  const statusBorder = isActive ? (isLong ? 'border-green-500' : 'border-red-500') : 'border-gray-600';
  const textColor = isActive ? (isLong ? 'text-green-400' : 'text-red-400') : 'text-gray-400';

  return (
    <div className={`rounded-xl border ${isActive ? 'border-opacity-50' : 'border-opacity-30'} ${statusBorder} bg-[#111827] relative overflow-hidden flex flex-col`}>
      {/* Progress Bar */}
      <div className="absolute top-0 left-0 h-0.5 bg-gray-800 w-full z-10">
        <div className={`h-full ${isActive ? (isLong ? 'bg-green-500' : 'bg-red-500') : 'bg-gray-500'} transition-all duration-100 ease-linear`} style={{ width: `${progress}%` }} />
      </div>

      {/* --- HEADER: STATUS & DIRECTION --- */}
      <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/40">
        <div className="flex items-center gap-3">
            <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest text-white ${statusColor} bg-opacity-20 border border-opacity-40 ${statusBorder}`}>
                {analysis.status.replace('_', ' ')}
            </div>
            {analysis.status !== 'NO_TRADE' && (
                <div className={`flex items-center gap-1 font-bold text-lg ${textColor}`}>
                    {isLong ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
                    {analysis.direction}
                </div>
            )}
        </div>
        
        <div className="flex items-center gap-2">
            <button onClick={copySignal} className="p-2 text-gray-500 hover:text-white transition-colors active:scale-95" title="Copy Signal">
                <Copy size={16} />
            </button>
            <button onClick={onRefresh} className={`p-2 rounded-full hover:bg-gray-800 transition-all active:scale-95 ${loading ? 'animate-spin text-blue-400' : 'text-gray-400'}`}>
                <RefreshCw size={16} />
            </button>
        </div>
      </div>

      {/* --- MAIN GRID: ENTRY / SL / TP --- */}
      {analysis.status !== 'NO_TRADE' ? (
        <div className="p-4 grid grid-cols-2 gap-4 relative">
             {/* Confidence Watermark */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[80px] font-black opacity-5 text-gray-600 select-none pointer-events-none">
                 {analysis.confidenceScore}%
             </div>

             {/* Entry */}
             <div className="col-span-2 bg-gray-900/50 p-3 rounded-lg border border-gray-700/50 flex justify-between items-center">
                 <div>
                     <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Entry Zone</div>
                     <div className="text-xl font-mono font-bold text-white tracking-tight">${analysis.entryPrice.toFixed(2)}</div>
                 </div>
                 <div className="text-right">
                     <div className="text-[10px] text-gray-500 uppercase font-bold">Risk/Reward</div>
                     <div className="text-sm font-mono text-yellow-500">1:{analysis.riskReward}</div>
                 </div>
             </div>

             {/* Stop Loss */}
             <div className="bg-red-900/10 p-3 rounded-lg border border-red-900/30">
                 <div className="flex items-center gap-1.5 text-[10px] text-red-400 uppercase font-bold tracking-wider mb-1">
                     <Shield size={10} /> Stop Loss
                 </div>
                 <div className="text-lg font-mono font-bold text-red-400">${analysis.stopLoss.toFixed(2)}</div>
                 <div className="text-[10px] text-red-500/70">
                     {((Math.abs(analysis.entryPrice - analysis.stopLoss) / analysis.entryPrice) * 100).toFixed(2)}% Risk
                 </div>
             </div>

             {/* Take Profit (Main) */}
             <div className="bg-green-900/10 p-3 rounded-lg border border-green-900/30">
                 <div className="flex items-center gap-1.5 text-[10px] text-green-400 uppercase font-bold tracking-wider mb-1">
                     <Target size={10} /> Main Target (TP2)
                 </div>
                 <div className="text-lg font-mono font-bold text-green-400">${analysis.takeProfits[1]?.toFixed(2)}</div>
                 <div className="text-[10px] text-green-500/70">
                     +2.5R Gain
                 </div>
             </div>

             {/* Extended Targets */}
             <div className="col-span-2 flex justify-between px-2 pt-2 border-t border-gray-800 text-xs font-mono text-gray-500">
                 <span>TP1: <span className="text-gray-300">${analysis.takeProfits[0]?.toFixed(2)}</span></span>
                 <span>TP3: <span className="text-gray-300">${analysis.takeProfits[2]?.toFixed(2)}</span></span>
             </div>
        </div>
      ) : (
        /* NO TRADE STATE */
        <div className="p-8 flex flex-col items-center justify-center text-center opacity-70">
            <Ban size={48} className="text-gray-600 mb-3" />
            <h3 className="text-gray-300 font-bold mb-1">No Valid Setup</h3>
            <p className="text-xs text-gray-500 max-w-[200px]">Market conditions do not meet the strict criteria for a high-probability trade.</p>
        </div>
      )}

      {/* --- FOOTER: REASONING & EXECUTION --- */}
      <div className="bg-gray-900 p-4 border-t border-gray-800 space-y-4">
          
          {/* Reasons List */}
          <div className="space-y-2">
              {analysis.status === 'NO_TRADE' ? (
                  <>
                     <div className="text-[10px] uppercase text-red-500 font-bold">Blocking Reasons</div>
                     <ul className="space-y-1">
                        {analysis.blockingReasons.map((reason, i) => (
                            <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                                <AlertTriangle size={12} className="text-red-500 mt-0.5 shrink-0" />
                                {reason}
                            </li>
                        ))}
                     </ul>
                  </>
              ) : (
                  <>
                     <div className="text-[10px] uppercase text-green-500 font-bold">Confluence Factors</div>
                     <ul className="space-y-1">
                        {analysis.confirmations.map((reason, i) => (
                            <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                                <CheckCircle2 size={12} className="text-green-500 mt-0.5 shrink-0" />
                                {reason}
                            </li>
                        ))}
                     </ul>
                  </>
              )}
          </div>

          {/* Execution Button (Only if Active) */}
          {analysis.status === 'ACTIVE' && (
             <div className="pt-2">
                {availableExchanges.length > 0 ? (
                    <div className="flex gap-2">
                        <select 
                            value={selectedExchange}
                            onChange={(e) => setSelectedExchange(e.target.value as ExchangeName)}
                            className="bg-gray-800 text-xs text-gray-300 rounded px-2 outline-none border border-gray-700"
                        >
                            {availableExchanges.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                        </select>
                        
                        <button 
                            onClick={handleExecute}
                            disabled={executing}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 md:py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all shadow-lg active:scale-95 ${
                                executing 
                                ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                                : isActive && isLong 
                                    ? 'bg-green-600 hover:bg-green-500 text-white shadow-green-900/20' 
                                    : 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/20'
                            }`}
                        >
                            {executing ? <Loader className="animate-spin" size={16} /> : <PlayCircle size={16} />}
                            {isLong ? 'Long' : 'Short'} Market (TP2)
                        </button>
                    </div>
                ) : (
                    <div className="text-center p-2 bg-gray-800/50 rounded border border-dashed border-gray-700 text-[10px] text-gray-500">
                        Configure API Keys to Execute
                    </div>
                )}
                
                {execResult && (
                    <div className={`mt-2 text-xs p-2 rounded border text-center ${execResult.success ? 'bg-green-900/20 border-green-800 text-green-400' : 'bg-red-900/20 border-red-800 text-red-400'}`}>
                        {execResult.message}
                    </div>
                )}
             </div>
          )}
      </div>
    </div>
  );
};