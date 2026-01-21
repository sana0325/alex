import React, { useEffect, useState, useRef } from 'react';
import { OrderBookState, OrderBookEntry } from '../types';
import { fetchOrderBook } from '../services/binance';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

interface OrderBookProps {
  symbol: string;
}

export const OrderBook: React.FC<OrderBookProps> = ({ symbol }) => {
  const [book, setBook] = useState<OrderBookState | null>(null);
  const [spoofAlert, setSpoofAlert] = useState<string | null>(null);
  const wallTracker = useRef<Map<number, number>>(new Map()); // Price -> Timestamp seen

  useEffect(() => {
    let interval: any;
    
    const updateBook = async () => {
      const data = await fetchOrderBook(symbol);
      if (data) {
        setBook(data);
        detectSpoofing(data);
      }
    };

    updateBook();
    interval = setInterval(updateBook, 5000); 

    return () => clearInterval(interval);
  }, [symbol]);

  const detectSpoofing = (currentBook: OrderBookState) => {
    // 300 BTC threshold approx 20M USD. 
    const SPOOF_THRESHOLD_USD = 1000000; // 1M USD for detection in this demo
    
    const allOrders = [...currentBook.bids, ...currentBook.asks];
    const currentWalls = new Set<number>();

    allOrders.forEach(order => {
      if (order.total > SPOOF_THRESHOLD_USD) {
        currentWalls.add(order.price);
        if (!wallTracker.current.has(order.price)) {
          wallTracker.current.set(order.price, Date.now());
        }
      }
    });

    // Check for walls that disappeared quickly (< 15 seconds)
    wallTracker.current.forEach((startTime, price) => {
      if (!currentWalls.has(price)) {
        const duration = Date.now() - startTime;
        if (duration < 15000 && duration > 2000) { 
           setSpoofAlert(`Spoof Alert: Huge wall at ${price.toFixed(2)} pulled in ${(duration/1000).toFixed(1)}s`);
           setTimeout(() => setSpoofAlert(null), 5000);
        }
        wallTracker.current.delete(price);
      }
    });
  };

  const renderRow = (entry: OrderBookEntry, type: 'bid' | 'ask', maxTotal: number) => {
    // Visual thresholds
    const isWhale = entry.total > 500000; // > $500k
    // The "Great Wall" > 300 BTC (~$20M)
    const isMegaWall = entry.total > 20000000; 

    const percent = Math.min((entry.total / maxTotal) * 100, 100);
    // Heatmap intensity: 0.1 to 0.9 based on percent
    const intensity = 0.1 + (percent / 100) * 0.8;

    // Gradient logic: Bids (Green), Asks (Red)
    // We use a gradient that fades slightly to transparent to give a smooth look
    const bgGradient = type === 'bid'
        ? `linear-gradient(to left, rgba(16, 185, 129, ${intensity}), rgba(16, 185, 129, ${intensity * 0.2}))`
        : `linear-gradient(to right, rgba(239, 68, 68, ${intensity}), rgba(239, 68, 68, ${intensity * 0.2}))`;

    const borderColor = type === 'bid' ? `rgba(16, 185, 129, ${intensity})` : `rgba(239, 68, 68, ${intensity})`;

    return (
      <div key={entry.price} className={`relative flex justify-between text-xs py-0.5 px-2 group hover:bg-gray-800/80 transition-colors`}>
        {/* Heatmap Depth Bar */}
        <div 
          className={`absolute top-0 bottom-0 ${type === 'bid' ? 'right-0' : 'left-0'} transition-all duration-500 ease-out`} 
          style={{ 
            width: `${percent}%`,
            background: bgGradient,
            // Add a solid line at the edge for clarity
            borderLeft: type === 'bid' ? `2px solid ${borderColor}` : 'none',
            borderRight: type === 'ask' ? `2px solid ${borderColor}` : 'none',
          }}
        />
        
        {/* Price & Icons */}
        <div className="z-10 flex gap-2 items-center">
             {isMegaWall && <ShieldAlert size={12} className="text-yellow-400 animate-pulse drop-shadow-[0_0_3px_rgba(250,204,21,0.8)]" />}
             <span className={`font-mono ${type === 'bid' ? 'text-trade-up' : 'text-trade-down'} ${isWhale ? 'font-extrabold text-shadow-sm' : 'font-medium'}`}>
               {entry.price.toFixed(2)}
             </span>
        </div>
        
        {/* Quantity */}
        <span className={`z-10 font-mono ${isWhale ? 'text-white font-bold' : 'text-gray-500 group-hover:text-gray-300'}`}>
            {entry.quantity.toFixed(3)}
        </span>
      </div>
    );
  };

  if (!book) return <div className="animate-pulse h-[400px] bg-gray-800/50 rounded-lg border border-gray-800 flex items-center justify-center text-gray-500">Loading Order Book...</div>;

  const maxTotal = Math.max(
    ...book.bids.map(b => b.total),
    ...book.asks.map(a => a.total),
    1 // Prevent division by zero
  );

  return (
    <div className="bg-[#111827] rounded-lg border border-gray-800 overflow-hidden h-[400px] flex flex-col shadow-xl">
      <div className="p-3 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur">
        <h3 className="font-semibold text-gray-200 flex items-center gap-2">
          Order Book 
          <span className="text-[10px] px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">Depth Heatmap</span>
        </h3>
        <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Binance Live</span>
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse box-shadow-[0_0_5px_#22c55e]"></div>
        </div>
      </div>
      
      {spoofAlert && (
        <div className="bg-red-500/20 border-b border-red-500/30 text-red-200 text-xs p-2 flex items-center gap-2 animate-pulse font-medium">
          <AlertTriangle size={14} />
          {spoofAlert}
        </div>
      )}

      <div className="flex-1 overflow-y-auto grid grid-cols-2 divide-x divide-gray-800 scrollbar-thin scrollbar-thumb-gray-700">
        {/* Bids (Buy) - Right aligned visually in standard books, but here keeping consistent with columns */}
        <div className="flex flex-col relative">
           <div className="sticky top-0 bg-[#111827]/95 backdrop-blur z-20 text-[10px] uppercase text-gray-500 flex justify-between px-2 py-1 border-b border-gray-800">
             <span>Price</span>
             <span>Qty</span>
           </div>
           {book.bids.slice(0, 20).map(b => renderRow(b, 'bid', maxTotal))}
        </div>
        
        {/* Asks (Sell) */}
        <div className="flex flex-col relative">
           <div className="sticky top-0 bg-[#111827]/95 backdrop-blur z-20 text-[10px] uppercase text-gray-500 flex justify-between px-2 py-1 border-b border-gray-800">
             <span>Price</span>
             <span>Qty</span>
           </div>
           {book.asks.slice(0, 20).map(a => renderRow(a, 'ask', maxTotal))}
        </div>
      </div>
    </div>
  );
};