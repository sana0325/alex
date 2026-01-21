import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { Candle } from '../types';
import { calculateEMA } from '../services/analysis';

interface ChartContainerProps {
  data: Candle[];
  height: number;
  showIndicators?: boolean;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({ data, height, showIndicators = true }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  
  // Series Refs to update data instead of recreating chart
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const ema9SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema21SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    if (data.length === 0) return;

    // 1. Initialize Chart if it doesn't exist
    if (!chartRef.current) {
        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#111827' },
                textColor: '#9ca3af',
            },
            grid: {
                vertLines: { color: '#1f2937' },
                horzLines: { color: '#1f2937' },
            },
            width: chartContainerRef.current.clientWidth,
            height: height,
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
            },
        });
        chartRef.current = chart;

        // Add Series
        try {
            const candleSeries = chart.addCandlestickSeries({
                upColor: '#0ecb81',
                downColor: '#f6465d',
                borderVisible: false,
                wickUpColor: '#0ecb81',
                wickDownColor: '#f6465d',
            });
            candleSeriesRef.current = candleSeries;

            if (showIndicators) {
                const ema9Series = chart.addLineSeries({ color: '#3b82f6', lineWidth: 1, title: 'EMA9' });
                ema9SeriesRef.current = ema9Series;

                const ema21Series = chart.addLineSeries({ color: '#f59e0b', lineWidth: 1, title: 'EMA21' });
                ema21SeriesRef.current = ema21Series;
            }
        } catch (err) {
            console.error("Error creating chart series:", err);
        }
    }

    // 2. Update Data
    if (candleSeriesRef.current) {
        const formattedData = data.map(d => ({
            time: d.time as Time,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
        }));
        candleSeriesRef.current.setData(formattedData);
    }

    if (showIndicators && ema9SeriesRef.current && ema21SeriesRef.current) {
        const ema9 = calculateEMA(data, 9);
        const ema21 = calculateEMA(data, 21);
        
        const ema9Data = data.map((d, i) => ({ time: d.time as Time, value: ema9[i] }));
        const ema21Data = data.map((d, i) => ({ time: d.time as Time, value: ema21[i] }));

        ema9SeriesRef.current.setData(ema9Data);
        ema21SeriesRef.current.setData(ema21Data);
    }

    // Resize Observer
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      // We do NOT remove the chart here to allow updates. 
      // Clean up is handled if the component unmounts entirely (which in React 18 strict mode might happen).
    };
  }, [data, height, showIndicators]);

  // Cleanup on unmount (separate effect with empty dependency)
  useEffect(() => {
    return () => {
        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
            candleSeriesRef.current = null;
            ema9SeriesRef.current = null;
            ema21SeriesRef.current = null;
        }
    }
  }, []);

  return (
    <div className="relative w-full rounded-lg overflow-hidden shadow-lg border border-gray-800">
      <div ref={chartContainerRef} />
    </div>
  );
};