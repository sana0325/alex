import { Candle } from '../types';

export function computePocPrice(candles: Candle[], lookback = 120, bins = 24): number | null {
  const sample = candles.slice(-lookback);
  if (sample.length === 0) return null;

  const lo = Math.min(...sample.map(c => c.low));
  const hi = Math.max(...sample.map(c => c.high));
  if (hi <= lo) return lo;

  const step = (hi - lo) / bins;
  const volumes = new Array(bins).fill(0);

  for (const c of sample) {
    const first = Math.max(0, Math.min(bins - 1, Math.floor((c.low - lo) / step)));
    const last = Math.max(0, Math.min(bins - 1, Math.floor((c.high - lo) / step)));
    const touched = last - first + 1;
    const share = c.volume / touched;
    for (let b = first; b <= last; b++) volumes[b] += share;
  }

  const maxVol = Math.max(...volumes);
  const pocIndex = maxVol > 0 ? volumes.indexOf(maxVol) : Math.floor(bins / 2);
  return lo + (pocIndex + 0.5) * step;
}
