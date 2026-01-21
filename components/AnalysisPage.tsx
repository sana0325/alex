import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Clock, Volume2, VolumeX } from 'lucide-react';
import { ChartContainer } from './ChartContainer';
import { OrderBook } from './OrderBook';
import { SignalPanel } from './SignalPanel';
import { NotesPanel } from './NotesPanel';
import { NewsPanel } from './NewsPanel';
import { fetchCandles, fetchOrderBook } from '../services/binance';
import { analyzePair } from '../services/analysis';
import { Candle, AnalysisResult, NewsItem } from '../types';
import { TIMEFRAMES, MOCK_NEWS } from '../constants';

interface AnalysisPageProps {
  symbol: string;
  user: any;
  onBack: () => void;
}

export const AnalysisPage: React.FC<AnalysisPageProps> = ({ symbol, user, onBack }) => {
  const [candles15m, setCandles15m] = useState<Candle[]>([]);
  const [candlesTrend, setCandlesTrend] = useState<Candle[]>([]);
  const [trendTimeframe, setTrendTimeframe] = useState<'30m' | '1h'>('1h');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  const prevRecRef = useRef<string>('NO_TRADE');

  const playAlertSound = useCallback((type: 'LONG' | 'SHORT') => {
    if (!soundEnabled) return;
    try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        if (type === 'LONG') {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(1000, audioCtx.currentTime + 0.1);
        } else {
            oscillator.type = 'sawtooth'; 
            oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
        }

        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
        console.error("Audio play failed", e);
    }
  }, [soundEnabled]);

  const loadData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    
    try {
      const [c15, cTrend] = await Promise.all([
        fetchCandles(symbol, TIMEFRAMES.SHORT, 200),
        fetchCandles(symbol, trendTimeframe, 200)
      ]);

      setCandles15m(c15);
      setCandlesTrend(cTrend);

      const orderBookSnapshot = await fetchOrderBook(symbol);
      
      const newsContext: NewsItem[] = MOCK_NEWS.map(n => ({
        id: n.id,
        title: n.title,
        url: n.url,
        source: n.source,
        published_at: n.published_at,
        sentiment: n.sentiment as any
      }));

      if (c15.length > 50 && cTrend.length > 50) {
        const result = analyzePair(c15, cTrend, orderBookSnapshot, newsContext);
        setAnalysis(result);
        setLastUpdate(Date.now());

        if (result.status === 'ACTIVE' && result.status !== prevRecRef.current) {
            playAlertSound(result.direction === 'LONG' ? 'LONG' : 'SHORT');
        }
        prevRecRef.current = result.status;

        document.title = `${result.status === 'ACTIVE' ? `[${result.direction}] ` : ''}${result.price.toFixed(2)} ${symbol} | CryptoScalp`;
      }
    } catch (e) {
      console.error("Failed to update analysis data", e);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [symbol, trendTimeframe, playAlertSound]);

  useEffect(() => {
    loadData(false);
    const interval = setInterval(() => {
      loadData(true);
    }, 30000);

    return () => {
        clearInterval(interval);
        document.title = "CryptoScalp Pro"; 
    };
  }, [loadData]);

  return (
    <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-colors active:scale-95"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-100 flex items-center gap-2">
              {symbol}
              {analysis && (
                  <span className={`text-xs md:text-sm px-2 py-0.5 rounded border font-bold ${
                    analysis.status === 'ACTIVE' 
                        ? (analysis.direction === 'LONG' ? 'border-green-500 text-green-500' : 'border-red-500 text-red-500')
                        : 'border-gray-600 text-gray-500'
                  }`}>
                    {analysis.status === 'NO_TRADE' ? 'SCANNING' : analysis.status}
                  </span>
              )}
            </h1>
            <div className="flex items-center gap-3 text-[10px] md:text-xs text-gray-500">
               <span className="flex items-center gap-1"><Clock size={12} /> Live System</span>
               {analysis && (
                 <span className={`px-1.5 rounded bg-gray-800 ${
                   analysis.confidenceScore > 80 ? 'text-green-400' : 
                   analysis.confidenceScore > 50 ? 'text-yellow-400' : 'text-gray-400'
                 }`}>
                   Confidence: {analysis.confidenceScore}%
                 </span>
               )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-3">
             <button 
               onClick={() => setSoundEnabled(!soundEnabled)}
               className={`p-2 rounded-lg transition-colors border active:scale-95 ${soundEnabled ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : 'bg-gray-800 border-gray-700 text-gray-500'}`}
               title={soundEnabled ? "Mute Alerts" : "Enable Alerts"}
             >
                {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
             </button>

            <div className="flex bg-gray-800 rounded-lg p-1">
            <button 
                onClick={() => setTrendTimeframe('30m')}
                className={`px-4 py-2 text-xs font-medium rounded transition-colors ${trendTimeframe === '30m' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}
            >
                30m
            </button>
            <button 
                onClick={() => setTrendTimeframe('1h')}
                className={`px-4 py-2 text-xs font-medium rounded transition-colors ${trendTimeframe === '1h' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}
            >
                1h
            </button>
            </div>
        </div>
      </div>

      {/* Main Grid - ADAPTIVE LAYOUT 
          Mobile: Signal Panel First (order-1), then Charts (order-2)
          Desktop: Charts Left (Col 1-2), Signal Right (Col 3)
      */}
      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6">
        
        {/* Signal & OrderBook Column */}
        {/* On Mobile: Order 1 (Top). On Desktop: Order 2 (Right Column) */}
        <div className="flex flex-col gap-6 order-1 lg:order-2 lg:col-span-1">
          <SignalPanel 
            analysis={analysis} 
            onRefresh={() => loadData(false)} 
            loading={loading}
            lastUpdate={lastUpdate} 
          />
          <div className="hidden lg:block">
             <OrderBook symbol={symbol} />
          </div>
        </div>

        {/* Charts Column */}
        {/* On Mobile: Order 2. On Desktop: Order 1 (Left 2 Columns) */}
        <div className="flex flex-col gap-6 order-2 lg:order-1 lg:col-span-2">
           <div className="space-y-2">
             <div className="flex justify-between items-center px-1">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Trend Context ({trendTimeframe})</h3>
                <span className="text-xs text-gray-500">EMA9/21 Structure</span>
             </div>
             <ChartContainer data={candlesTrend} height={350} />
           </div>

           <div className="space-y-2">
             <div className="flex justify-between items-center px-1">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Execution & Triggers (15m)</h3>
                <span className="text-xs text-gray-500">Entry Confirmation</span>
             </div>
             <ChartContainer data={candles15m} height={250} />
           </div>
        </div>

        {/* Mobile Only OrderBook (Shown after charts on mobile) */}
        <div className="block lg:hidden order-3">
           <OrderBook symbol={symbol} />
        </div>

      </div>

      {/* Bottom Grid: News & Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 order-4">
        <NotesPanel symbol={symbol} user={user} />
        <NewsPanel />
      </div>
    </div>
  );
};