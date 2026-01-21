import { Candle, AnalysisResult, MarketRegime, TrendDirection, OrderBookState, NewsItem } from '../types';

// --- TECHNICAL INDICATORS ---

export const calculateEMA = (candles: Candle[], period: number): number[] => {
  const k = 2 / (period + 1);
  const emaArray: number[] = [];
  let ema = candles[0].close;
  emaArray.push(ema);

  for (let i = 1; i < candles.length; i++) {
    ema = (candles[i].close - ema) * k + ema;
    emaArray.push(ema);
  }
  return emaArray;
};

export const calculateRSI = (candles: Candle[], period: number = 14): number[] => {
  const rsiArray: number[] = [];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  rsiArray.push(100 - (100 / (1 + avgGain / avgLoss)));

  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs = avgGain / avgLoss;
    rsiArray.push(100 - (100 / (1 + rs)));
  }

  return rsiArray;
};

// --- QUANTITATIVE ANALYSIS ---

const calculateOrderBookBias = (book: OrderBookState | null): number => {
  if (!book) return 0;
  const bidVol = book.bids.reduce((sum, b) => sum + b.total, 0);
  const askVol = book.asks.reduce((sum, a) => sum + a.total, 0);
  const totalVol = bidVol + askVol;
  if (totalVol === 0) return 0;
  return (bidVol - askVol) / totalVol;
};

export const analyzePair = (
  candlesShort: Candle[], // 15m (Entry)
  candlesTrend: Candle[], // 1h (Context)
  orderBook: OrderBookState | null,
  news: NewsItem[]
): AnalysisResult => {
  const confirmations: string[] = [];
  const blockingReasons: string[] = [];
  
  // 1. DATA PREP
  const trendEMA9 = calculateEMA(candlesTrend, 9);
  const trendEMA21 = calculateEMA(candlesTrend, 21);
  
  const currentPrice = candlesShort[candlesShort.length - 1].close;
  const lastTrendEMA9 = trendEMA9[trendEMA9.length - 1];
  const lastTrendEMA21 = trendEMA21[trendEMA21.length - 1];

  const shortRSI = calculateRSI(candlesShort, 14);
  const currentShortRSI = shortRSI[shortRSI.length - 1];
  const shortEMA21 = calculateEMA(candlesShort, 21)[candlesShort.length - 1];

  const obBias = calculateOrderBookBias(orderBook);

  // 2. REGIME DETECTION
  let regime: MarketRegime = 'RANGE_CHOP';
  let trendDirection: TrendDirection = 'NEUTRAL';

  const emaDiff = (lastTrendEMA9 - lastTrendEMA21) / lastTrendEMA21;
  const absDiff = Math.abs(emaDiff);

  if (absDiff > 0.003) { 
    regime = absDiff > 0.008 ? 'STRONG_TREND' : 'NORMAL_TREND';
    trendDirection = emaDiff > 0 ? 'BULLISH' : 'BEARISH';
  } else {
    regime = 'RANGE_CHOP';
    trendDirection = emaDiff > 0 ? 'BULLISH' : (emaDiff < 0 ? 'BEARISH' : 'NEUTRAL');
  }

  // 3. STRICT SIGNAL LOGIC
  let direction: 'LONG' | 'SHORT' | 'NONE' = 'NONE';
  let confidenceScore = 0;

  // 3.1 Check Filters
  const isVolumeSupporting = candlesShort[candlesShort.length - 1].volume > (candlesShort.slice(-21, -1).reduce((a, b) => a + b.volume, 0) / 20);
  const isPriceNearEMA = Math.abs((currentPrice - shortEMA21) / currentPrice) < 0.008; // Within 0.8% of EMA21
  
  // --- LONG LOGIC ---
  if (trendDirection === 'BULLISH' || (regime === 'RANGE_CHOP' && obBias > 0.15)) {
    if (currentShortRSI < 30) {
        confirmations.push("RSI Oversold (Good Entry)");
        confidenceScore += 20;
    } else if (currentShortRSI > 70) {
        blockingReasons.push("RSI Overbought (Risk of pullback)");
    } else {
        confirmations.push("RSI in Value Zone");
        confidenceScore += 10;
    }

    if (currentPrice > shortEMA21) {
        confirmations.push("Price above 15m EMA21");
        confidenceScore += 20;
    } else {
        // Only block if we are significantly below
        if(currentPrice < shortEMA21 * 0.99) blockingReasons.push("Price lost 15m EMA21 structure");
    }

    if (obBias > 0.05) {
        confirmations.push("Order Book Bid Support");
        confidenceScore += 15;
    } else if (obBias < -0.2) {
        blockingReasons.push("Heavy Sell Walls Overhead");
    }

    if(blockingReasons.length === 0) {
        direction = 'LONG';
        confidenceScore += 35; // Base Trend Score
    }
  }

  // --- SHORT LOGIC ---
  else if (trendDirection === 'BEARISH' || (regime === 'RANGE_CHOP' && obBias < -0.15)) {
    if (currentShortRSI > 70) {
        confirmations.push("RSI Overbought (Good Entry)");
        confidenceScore += 20;
    } else if (currentShortRSI < 30) {
        blockingReasons.push("RSI Oversold (Risk of bounce)");
    } else {
        confirmations.push("RSI in Value Zone");
        confidenceScore += 10;
    }

    if (currentPrice < shortEMA21) {
        confirmations.push("Price below 15m EMA21");
        confidenceScore += 20;
    } else {
        if(currentPrice > shortEMA21 * 1.01) blockingReasons.push("Price broke 15m EMA21 structure");
    }

    if (obBias < -0.05) {
        confirmations.push("Order Book Ask Pressure");
        confidenceScore += 15;
    } else if (obBias > 0.2) {
        blockingReasons.push("Heavy Buy Walls Below");
    }

    if(blockingReasons.length === 0) {
        direction = 'SHORT';
        confidenceScore += 35;
    }
  } else {
      blockingReasons.push("Market structure undefined / Choppy");
  }

  // 4. PRICE TARGETS & RISK MANAGEMENT
  let entryPrice = currentPrice;
  let stopLoss = 0;
  let takeProfits: number[] = [];
  let riskReward = 0;

  if (direction !== 'NONE') {
      // Find Swing High/Low of last 10 candles
      const swingLow = Math.min(...candlesShort.slice(-10).map(c => c.low));
      const swingHigh = Math.max(...candlesShort.slice(-10).map(c => c.high));
      
      const atrSim = (swingHigh - swingLow) / 2; // Rough volatility proxy

      if (direction === 'LONG') {
          // SL: Below Swing Low or min 0.8% away
          const structureSL = swingLow * 0.998;
          // Fallback if volatility is tiny
          const minSL = entryPrice * 0.992; 
          stopLoss = structureSL < entryPrice ? Math.min(structureSL, minSL) : minSL;

          const risk = entryPrice - stopLoss;
          takeProfits = [
              entryPrice + (risk * 1.5), // TP1 Conservative
              entryPrice + (risk * 2.5), // TP2 Main
              entryPrice + (risk * 4.0), // TP3 Runner
          ];
      } else {
          // SL: Above Swing High or min 0.8% away
          const structureSL = swingHigh * 1.002;
          const minSL = entryPrice * 1.008;
          stopLoss = structureSL > entryPrice ? Math.max(structureSL, minSL) : minSL;

          const risk = stopLoss - entryPrice;
          takeProfits = [
              entryPrice - (risk * 1.5),
              entryPrice - (risk * 2.5),
              entryPrice - (risk * 4.0),
          ];
      }
      
      // Calculate R:R based on TP2 (Main Target)
      riskReward = Math.abs(takeProfits[1] - entryPrice) / Math.abs(entryPrice - stopLoss);
  }

  // 5. DETERMINE FINAL STATUS
  let status: 'ACTIVE' | 'POTENTIAL' | 'NO_TRADE' = 'NO_TRADE';

  if (blockingReasons.length > 0) {
      status = 'NO_TRADE';
  } else if (confidenceScore > 65) {
      status = 'ACTIVE';
  } else if (confidenceScore > 40) {
      status = 'POTENTIAL';
      blockingReasons.push("Confidence Score too low (< 65%)");
  } else {
      status = 'NO_TRADE';
      blockingReasons.push("Insufficient technical confluence");
  }

  return {
    regime,
    trend: trendDirection,
    rsi: currentShortRSI,
    ema9: lastTrendEMA9,
    ema21: lastTrendEMA21,
    orderBookBias: parseFloat(obBias.toFixed(2)),
    status,
    direction,
    confidenceScore: Math.min(100, confidenceScore),
    price: currentPrice,
    entryPrice,
    stopLoss,
    takeProfits,
    riskReward: parseFloat(riskReward.toFixed(2)),
    confirmations,
    blockingReasons
  };
};