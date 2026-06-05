import { Candle, IndicatorVote, VoteDirection, SupportData, GoldSignal, AppSettings } from '../types';

// ── Math helpers ─────────────────────────────────────────────────────────────

function ema(data: number[], period: number): number[] {
  if (data.length < period) return [];
  const k = 2 / (period + 1);
  const result: number[] = [data.slice(0, period).reduce((a, b) => a + b) / period];
  for (let i = period; i < data.length; i++) {
    result.push(data[i] * k + result[result.length - 1] * (1 - k));
  }
  return result;
}

function sma(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < data.length; i++) {
    result.push(data.slice(i - period + 1, i + 1).reduce((a, b) => a + b) / period);
  }
  return result;
}

function atr(candles: Candle[], period: number): number[] {
  const tr = candles.slice(1).map((c, i) => {
    const p = candles[i];
    return Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
  });
  return sma(tr, period);
}

function vote(id: number, name: string, group: IndicatorVote['group'], isSignal: boolean,
              direction: VoteDirection, value: number, description: string): IndicatorVote {
  return { id, name, group, direction, value, description, isSignal };
}

const f2 = (v: number) => v.toFixed(2);
const f3 = (v: number) => v.toFixed(3);

// ── 26 Signal Indicators ─────────────────────────────────────────────────────

function s01_EMA9_21(c: Candle[]): IndicatorVote {
  const closes = c.map(x => x.close);
  const e9 = ema(closes, 9); const e21 = ema(closes, 21);
  if (!e9.length || !e21.length) return vote(1, 'EMA 9/21', 'trend', true, 'NONE', 0, 'Недостатньо даних');
  const diff = e9[e9.length - 1] - e21[e21.length - 1];
  const dir: VoteDirection = diff > 0 ? 'LONG' : diff < 0 ? 'SHORT' : 'NONE';
  return vote(1, 'EMA 9/21 Крос', 'trend', true, dir, diff,
    `EMA9=${f2(e9[e9.length-1])} ${diff>0?'>':'<'} EMA21=${f2(e21[e21.length-1])}`);
}

function s02_EMA21_50(c: Candle[]): IndicatorVote {
  const closes = c.map(x => x.close);
  const e21 = ema(closes, 21); const e50 = ema(closes, 50);
  if (!e21.length || !e50.length) return vote(2, 'EMA 21/50', 'trend', true, 'NONE', 0, 'Недостатньо даних');
  const diff = e21[e21.length - 1] - e50[e50.length - 1];
  const dir: VoteDirection = diff > 0 ? 'LONG' : diff < 0 ? 'SHORT' : 'NONE';
  return vote(2, 'EMA 21/50 Тренд', 'trend', true, dir, diff,
    `EMA21 ${diff>0?'вище':'нижче'} EMA50 — ${diff>0?'бичачий':'ведмежий'} тренд`);
}

function s03_EMA200(c: Candle[]): IndicatorVote {
  if (c.length < 205) return vote(3, 'Ціна vs EMA200', 'trend', true, 'NONE', 0, 'Недостатньо даних');
  const closes = c.map(x => x.close);
  const e200 = ema(closes, 200);
  const price = closes[closes.length - 1];
  const e = e200[e200.length - 1];
  const diff = price - e;
  const dir: VoteDirection = diff > 0 ? 'LONG' : 'SHORT';
  return vote(3, 'Ціна vs EMA200', 'trend', true, dir, diff,
    `Ціна ${f2(price)} ${diff>0?'вище':'нижче'} EMA200 ${f2(e)}`);
}

function s04_MACD_Signal(c: Candle[]): IndicatorVote {
  const closes = c.map(x => x.close);
  const e12 = ema(closes, 12); const e26 = ema(closes, 26);
  const off = e12.length - e26.length;
  const macd = e26.map((v, i) => e12[i + off] - v);
  const sig = ema(macd, 9);
  if (!sig.length) return vote(4, 'MACD Сигнал', 'trend', true, 'NONE', 0, '');
  const diff = macd[macd.length - 1] - sig[sig.length - 1];
  const dir: VoteDirection = diff > 0 ? 'LONG' : 'SHORT';
  return vote(4, 'MACD Сигнал Лінія', 'trend', true, dir, diff,
    `MACD ${diff>0?'>':'<'} Signal (${f3(diff)})`);
}

function s05_MACD_Histogram(c: Candle[]): IndicatorVote {
  const closes = c.map(x => x.close);
  const e12 = ema(closes, 12); const e26 = ema(closes, 26);
  const off = e12.length - e26.length;
  const macd = e26.map((v, i) => e12[i + off] - v);
  const sig = ema(macd, 9);
  if (sig.length < 2) return vote(5, 'MACD Гістограма', 'trend', true, 'NONE', 0, '');
  const h1 = macd[macd.length - 1] - sig[sig.length - 1];
  const h2 = macd[macd.length - 2] - sig[sig.length - 2];
  const growing = h1 > h2;
  const dir: VoteDirection = h1 > 0 && growing ? 'LONG' : h1 < 0 && !growing ? 'SHORT' : h1 > 0 ? 'LONG' : 'SHORT';
  return vote(5, 'MACD Гістограма', 'trend', true, dir, h1,
    `Hist=${f3(h1)} ${growing?'зростає':'падає'}`);
}

function s06_ParabolicSAR(c: Candle[]): IndicatorVote {
  if (c.length < 10) return vote(6, 'Parabolic SAR', 'trend', true, 'NONE', 0, '');
  const step = 0.02, maxStep = 0.2;
  let isLong = c[1].close > c[0].close;
  let af = step, ep = isLong ? c[0].high : c[0].low, sar = isLong ? c[0].low : c[0].high;
  for (let i = 1; i < c.length - 1; i++) {
    sar = sar + af * (ep - sar);
    if (isLong) {
      sar = Math.min(sar, c[i-1].low, i > 1 ? c[i-2].low : c[i].low);
      if (c[i].high > ep) { ep = c[i].high; af = Math.min(af + step, maxStep); }
      if (c[i].low < sar) { isLong = false; sar = ep; ep = c[i].low; af = step; }
    } else {
      sar = Math.max(sar, c[i-1].high, i > 1 ? c[i-2].high : c[i].high);
      if (c[i].low < ep) { ep = c[i].low; af = Math.min(af + step, maxStep); }
      if (c[i].high > sar) { isLong = true; sar = ep; ep = c[i].high; af = step; }
    }
  }
  const price = c[c.length - 1].close;
  const dir: VoteDirection = isLong ? 'LONG' : 'SHORT';
  return vote(6, 'Parabolic SAR', 'trend', true, dir, price - sar,
    `SAR=${f2(sar)} ${isLong?'нижче':'вище'} ціни — ${isLong?'бичачий':'ведмежий'}`);
}

function s07_IchimokuTK(c: Candle[]): IndicatorVote {
  if (c.length < 52) return vote(7, 'Ichimoku TK', 'trend', true, 'NONE', 0, '');
  const mid = (arr: Candle[], n: number) => {
    const sl = arr.slice(-n);
    return (Math.max(...sl.map(x=>x.high)) + Math.min(...sl.map(x=>x.low))) / 2;
  };
  const tk = mid(c, 9), kj = mid(c, 26);
  const diff = tk - kj;
  const dir: VoteDirection = diff > 0 ? 'LONG' : diff < 0 ? 'SHORT' : 'NONE';
  return vote(7, 'Ichimoku TK Крос', 'trend', true, dir, diff,
    `Tenkan=${f2(tk)} ${diff>0?'>':'<'} Kijun=${f2(kj)}`);
}

function s08_IchimokuCloud(c: Candle[]): IndicatorVote {
  if (c.length < 78) return vote(8, 'Ichimoku Хмара', 'trend', true, 'NONE', 0, '');
  const mid = (arr: Candle[], n: number) => {
    const sl = arr.slice(-n);
    return (Math.max(...sl.map(x=>x.high)) + Math.min(...sl.map(x=>x.low))) / 2;
  };
  const tk = mid(c, 9), kj = mid(c, 26), sb = mid(c, 52);
  const sa = (tk + kj) / 2;
  const cloudTop = Math.max(sa, sb), cloudBot = Math.min(sa, sb);
  const price = c[c.length - 1].close;
  if (price > cloudTop) return vote(8, 'Ichimoku Хмара', 'trend', true, 'LONG', price - cloudTop, 'Ціна вище хмари Kumo');
  if (price < cloudBot) return vote(8, 'Ichimoku Хмара', 'trend', true, 'SHORT', cloudBot - price, 'Ціна нижче хмари Kumo');
  return vote(8, 'Ichimoku Хмара', 'trend', true, 'NONE', 0, 'Ціна всередині хмари');
}

function s09_RSI14(c: Candle[]): IndicatorVote {
  const rsi = calcRSI(c, 14);
  if (rsi === null) return vote(9, 'RSI(14)', 'momentum', true, 'NONE', 0, '');
  const dir: VoteDirection = rsi > 55 ? 'LONG' : rsi < 45 ? 'SHORT' : 'NONE';
  return vote(9, 'RSI(14) Мідлайн', 'momentum', true, dir, rsi,
    `RSI=${rsi.toFixed(1)} ${rsi>55?'бичачий':rsi<45?'ведмежий':'нейтральний'}`);
}

function s10_RSI7(c: Candle[]): IndicatorVote {
  const rsi = calcRSI(c, 7);
  if (rsi === null) return vote(10, 'RSI(7)', 'momentum', true, 'NONE', 0, '');
  let dir: VoteDirection = 'NONE';
  let desc = '';
  if (rsi < 30) { dir = 'LONG'; desc = 'Перепроданий — розворот вгору'; }
  else if (rsi > 70) { dir = 'SHORT'; desc = 'Перекуплений — розворот вниз'; }
  else if (rsi >= 50) { dir = 'LONG'; desc = `RSI7=${rsi.toFixed(1)} бичачий`; }
  else { dir = 'SHORT'; desc = `RSI7=${rsi.toFixed(1)} ведмежий`; }
  return vote(10, 'RSI(7) Моментум', 'momentum', true, dir, rsi, desc);
}

function s11_Stochastic(c: Candle[]): IndicatorVote {
  if (c.length < 20) return vote(11, 'Stochastic', 'momentum', true, 'NONE', 0, '');
  const rawK = c.slice(14).map((_, i) => {
    const sl = c.slice(i, i + 14);
    const h = Math.max(...sl.map(x=>x.high)), l = Math.min(...sl.map(x=>x.low));
    return h === l ? 50 : (c[i+13].close - l) / (h - l) * 100;
  });
  const kSmooth = sma(rawK, 3); const d = sma(kSmooth, 3);
  if (!kSmooth.length || !d.length) return vote(11, 'Stochastic', 'momentum', true, 'NONE', 0, '');
  const k = kSmooth[kSmooth.length - 1], dv = d[d.length - 1];
  let dir: VoteDirection = 'NONE';
  if (k > dv && k < 80) dir = 'LONG';
  else if (k < dv && k > 20) dir = 'SHORT';
  else if (k <= 20) dir = 'LONG';
  else if (k >= 80) dir = 'SHORT';
  return vote(11, 'Stochastic %K/%D', 'momentum', true, dir, k - dv,
    `%K=${k.toFixed(1)} %D=${dv.toFixed(1)}`);
}

function s12_CCI(c: Candle[]): IndicatorVote {
  if (c.length < 20) return vote(12, 'CCI(20)', 'momentum', true, 'NONE', 0, '');
  const tp = c.slice(-20).map(x => (x.high + x.low + x.close) / 3);
  const mean = tp.reduce((a,b)=>a+b) / 20;
  const md = tp.map(v => Math.abs(v - mean)).reduce((a,b)=>a+b) / 20;
  if (md === 0) return vote(12, 'CCI(20)', 'momentum', true, 'NONE', 0, '');
  const cci = (tp[19] - mean) / (0.015 * md);
  const dir: VoteDirection = cci > 0 ? 'LONG' : 'SHORT';
  return vote(12, 'CCI(20)', 'momentum', true, dir, cci,
    `CCI=${cci.toFixed(1)} ${cci>100?'сильний бичачий':cci<-100?'сильний ведмежий':cci>0?'позитивний':'негативний'}`);
}

function s13_WilliamsR(c: Candle[]): IndicatorVote {
  if (c.length < 14) return vote(13, 'Williams %R', 'momentum', true, 'NONE', 0, '');
  const sl = c.slice(-14);
  const h = Math.max(...sl.map(x=>x.high)), l = Math.min(...sl.map(x=>x.low));
  if (h === l) return vote(13, 'Williams %R', 'momentum', true, 'NONE', 0, '');
  const wr = ((h - sl[sl.length-1].close) / (h - l)) * -100;
  let dir: VoteDirection;
  if (wr < -80) dir = 'LONG';
  else if (wr > -20) dir = 'SHORT';
  else if (wr > -50) dir = 'LONG';
  else dir = 'SHORT';
  return vote(13, 'Williams %R', 'momentum', true, dir, wr,
    `%R=${wr.toFixed(1)} ${wr<-80?'перепроданий':wr>-20?'перекуплений':wr>-50?'бичача зона':'ведмежа зона'}`);
}

function s14_Momentum(c: Candle[]): IndicatorVote {
  if (c.length < 11) return vote(14, 'Momentum', 'momentum', true, 'NONE', 0, '');
  const curr = c[c.length-1].close, past = c[c.length-11].close;
  const mom = (curr / past) * 100;
  const dir: VoteDirection = mom > 100.3 ? 'LONG' : mom < 99.7 ? 'SHORT' : 'NONE';
  return vote(14, 'Momentum(10)', 'momentum', true, dir, mom - 100,
    `Mom=${(mom-100).toFixed(2)}% ${mom>100?'↑':'↓'}`);
}

function s15_DeMarker(c: Candle[]): IndicatorVote {
  if (c.length < 15) return vote(15, 'DeMarker', 'oscillator', true, 'NONE', 0, '');
  const deMax = c.slice(-14).map((x,i,a) => i===0?0: Math.max(x.high - a[i-1].high, 0));
  const deMin = c.slice(-14).map((x,i,a) => i===0?0: Math.max(a[i-1].low - x.low, 0));
  const sm = deMax.reduce((a,b)=>a+b) / 14, sl2 = deMin.reduce((a,b)=>a+b) / 14;
  if (sm + sl2 === 0) return vote(15, 'DeMarker', 'oscillator', true, 'NONE', 0, '');
  const dem = sm / (sm + sl2);
  const dir: VoteDirection = dem > 0.6 ? 'LONG' : dem < 0.4 ? 'SHORT' : 'NONE';
  return vote(15, 'DeMarker(14)', 'oscillator', true, dir, dem,
    `DeMark=${dem.toFixed(3)} ${dem>0.7?'перекуплений':dem<0.3?'перепроданий':dem>0.5?'бичачий':'ведмежий'}`);
}

function s16_TRIX(c: Candle[]): IndicatorVote {
  const closes = c.map(x=>x.close);
  const e1 = ema(closes, 14); if (e1.length < 14) return vote(16, 'TRIX', 'oscillator', true, 'NONE', 0, '');
  const e2 = ema(e1, 14); if (e2.length < 14) return vote(16, 'TRIX', 'oscillator', true, 'NONE', 0, '');
  const e3 = ema(e2, 14); if (e3.length < 2) return vote(16, 'TRIX', 'oscillator', true, 'NONE', 0, '');
  const trix = (e3[e3.length-1] - e3[e3.length-2]) / e3[e3.length-2] * 100;
  const dir: VoteDirection = trix > 0 ? 'LONG' : 'SHORT';
  return vote(16, 'TRIX(14)', 'oscillator', true, dir, trix,
    `TRIX=${trix.toFixed(4)}% ${trix>0?'позитивний':'негативний'}`);
}

function s17_CMO(c: Candle[]): IndicatorVote {
  if (c.length < 16) return vote(17, 'Chande CMO', 'oscillator', true, 'NONE', 0, '');
  const changes = c.slice(-15).map((x,i,a) => i===0?0:x.close-a[i-1].close).slice(1);
  const up = changes.filter(x=>x>0).reduce((a,b)=>a+b,0);
  const dn = Math.abs(changes.filter(x=>x<0).reduce((a,b)=>a+b,0));
  if (up + dn === 0) return vote(17, 'Chande CMO', 'oscillator', true, 'NONE', 0, '');
  const cmo = (up - dn) / (up + dn) * 100;
  const dir: VoteDirection = cmo > 20 ? 'LONG' : cmo < -20 ? 'SHORT' : 'NONE';
  return vote(17, 'Chande CMO(14)', 'oscillator', true, dir, cmo,
    `CMO=${cmo.toFixed(1)}`);
}

function s18_ROC(c: Candle[]): IndicatorVote {
  if (c.length < 13) return vote(18, 'ROC', 'oscillator', true, 'NONE', 0, '');
  const curr = c[c.length-1].close, past = c[c.length-13].close;
  const roc = ((curr - past) / past) * 100;
  const dir: VoteDirection = roc > 0.1 ? 'LONG' : roc < -0.1 ? 'SHORT' : 'NONE';
  return vote(18, 'ROC(12)', 'oscillator', true, dir, roc,
    `ROC=${roc.toFixed(2)}%`);
}

function s19_ElderRay(c: Candle[]): IndicatorVote {
  const closes = c.map(x=>x.close);
  const e13 = ema(closes, 13);
  if (!e13.length) return vote(19, 'Elder Ray', 'oscillator', true, 'NONE', 0, '');
  const last = c[c.length-1], eVal = e13[e13.length-1];
  const bull = last.high - eVal, bear = last.low - eVal;
  let dir: VoteDirection;
  if (bull > 0 && bear > 0) dir = 'LONG';
  else if (bull > 0) dir = 'LONG';
  else if (bull < 0 && bear < 0) dir = 'SHORT';
  else dir = 'SHORT';
  return vote(19, 'Elder Ray', 'oscillator', true, dir, bull,
    `Bull=${f2(bull)} Bear=${f2(bear)}`);
}

function s20_VWAP(c: Candle[]): IndicatorVote {
  const sess = c.slice(-50);
  const totalVol = sess.reduce((a,x)=>a+x.volume, 0);
  const vwap = totalVol > 0
    ? sess.reduce((a,x)=>a + ((x.high+x.low+x.close)/3)*x.volume, 0) / totalVol
    : sess.map(x=>(x.high+x.low+x.close)/3).reduce((a,b)=>a+b)/sess.length;
  const price = c[c.length-1].close;
  const dir: VoteDirection = price > vwap * 1.001 ? 'LONG' : price < vwap * 0.999 ? 'SHORT' : 'NONE';
  return vote(20, 'VWAP', 'channel', true, dir, price - vwap,
    `Ціна ${price>vwap?'вище':'нижче'} VWAP ${f2(vwap)}`);
}

function s21_ForceIndex(c: Candle[]): IndicatorVote {
  if (c.length < 15) return vote(21, 'Force Index', 'channel', true, 'NONE', 0, '');
  const raw = c.slice(1).map((x,i)=>(x.close-c[i].close)*x.volume);
  const fi = ema(raw, 13);
  if (!fi.length) return vote(21, 'Force Index', 'channel', true, 'NONE', 0, '');
  const v = fi[fi.length-1];
  const dir: VoteDirection = v > 0 ? 'LONG' : 'SHORT';
  return vote(21, 'Force Index(13)', 'channel', true, dir, v,
    `${v > 0 ? 'Тиск купівлі' : 'Тиск продажу'} (${v.toFixed(0)})`);
}

function s22_Aroon(c: Candle[]): IndicatorVote {
  if (c.length < 27) return vote(22, 'Aroon', 'channel', true, 'NONE', 0, '');
  const sl = c.slice(-26);
  const highs = sl.map(x=>x.high), lows = sl.map(x=>x.low);
  const hiIdx = highs.indexOf(Math.max(...highs));
  const loIdx = lows.indexOf(Math.min(...lows));
  const au = (25 - (25 - hiIdx)) / 25 * 100;
  const ad = (25 - (25 - loIdx)) / 25 * 100;
  const osc = au - ad;
  const dir: VoteDirection = osc > 30 ? 'LONG' : osc < -30 ? 'SHORT' : 'NONE';
  return vote(22, 'Aroon(25)', 'channel', true, dir, osc,
    `Aroon Osc=${osc.toFixed(1)}`);
}

function s23_Donchian(c: Candle[]): IndicatorVote {
  if (c.length < 20) return vote(23, 'Donchian', 'channel', true, 'NONE', 0, '');
  const sl = c.slice(-20);
  const up = Math.max(...sl.map(x=>x.high)), dn = Math.min(...sl.map(x=>x.low));
  const mid = (up + dn) / 2, price = c[c.length-1].close;
  const dir: VoteDirection = price > mid + (up-mid)*0.3 ? 'LONG' : price < mid - (mid-dn)*0.3 ? 'SHORT' : 'NONE';
  return vote(23, 'Donchian(20)', 'channel', true, dir, price - mid,
    `Ціна в ${price>mid?'верхній':'нижній'} зоні каналу`);
}

function s24_BollingerBands(c: Candle[]): IndicatorVote {
  if (c.length < 20) return vote(24, 'Bollinger Bands', 'channel', true, 'NONE', 0, '');
  const closes = c.slice(-20).map(x=>x.close);
  const mid = closes.reduce((a,b)=>a+b)/20;
  const std = Math.sqrt(closes.map(v=>(v-mid)**2).reduce((a,b)=>a+b)/20);
  const upper = mid + 2*std, lower = mid - 2*std, price = c[c.length-1].close;
  let dir: VoteDirection;
  let desc = '';
  if (price > upper) { dir = 'SHORT'; desc = 'Вище верхньої BB — перекуплений'; }
  else if (price > mid) { dir = 'LONG'; desc = `Вище серединної BB (${f2(mid)})`; }
  else if (price < lower) { dir = 'LONG'; desc = 'Нижче нижньої BB — перепроданий'; }
  else { dir = 'SHORT'; desc = `Нижче серединної BB`; }
  return vote(24, 'Bollinger Bands', 'channel', true, dir, price - mid, desc);
}

function s25_Keltner(c: Candle[]): IndicatorVote {
  if (c.length < 22) return vote(25, 'Keltner Channel', 'channel', true, 'NONE', 0, '');
  const closes = c.map(x=>x.close);
  const e20 = ema(closes, 20);
  const atrV = atr(c, 20);
  if (!e20.length || !atrV.length) return vote(25, 'Keltner', 'channel', true, 'NONE', 0, '');
  const mid = e20[e20.length-1], price = c[c.length-1].close;
  const dir: VoteDirection = price > mid ? 'LONG' : 'SHORT';
  return vote(25, 'Keltner Channel', 'channel', true, dir, price - mid,
    `Ціна ${price>mid?'вище':'нижче'} середини ${f2(mid)}`);
}

function s26_ADX_DI(c: Candle[]): IndicatorVote {
  if (c.length < 30) return vote(26, 'ADX DI±', 'channel', true, 'NONE', 0, '');
  const dmP: number[] = [], dmM: number[] = [], trArr: number[] = [];
  for (let i = 1; i < c.length; i++) {
    const up = c[i].high - c[i-1].high, dn = c[i-1].low - c[i].low;
    dmP.push(up > dn && up > 0 ? up : 0);
    dmM.push(dn > up && dn > 0 ? dn : 0);
    trArr.push(Math.max(c[i].high-c[i].low, Math.abs(c[i].high-c[i-1].close), Math.abs(c[i].low-c[i-1].close)));
  }
  const sm14 = (arr: number[]) => {
    let s = arr.slice(0,14).reduce((a,b)=>a+b,0);
    for (let i=14;i<arr.length;i++) s = s - s/14 + arr[i];
    return s;
  };
  const str = sm14(trArr), sdp = sm14(dmP), sdm = sm14(dmM);
  if (str === 0) return vote(26, 'ADX DI±', 'channel', true, 'NONE', 0, '');
  const diP = sdp/str*100, diM = sdm/str*100;
  const diff = diP - diM;
  const dir: VoteDirection = diff > 2 ? 'LONG' : diff < -2 ? 'SHORT' : 'NONE';
  return vote(26, 'ADX DI+ / DI−', 'channel', true, dir, diff,
    `DI+=${diP.toFixed(1)} DI−=${diM.toFixed(1)}`);
}

// ── Support calculations ──────────────────────────────────────────────────────

function calcRSI(c: Candle[], period: number): number | null {
  if (c.length < period + 2) return null;
  const closes = c.map(x=>x.close);
  const changes = closes.slice(1).map((v,i)=>v-closes[i]);
  let avgG = changes.slice(-period-1,-1).filter(x=>x>0).reduce((a,b)=>a+b,0)/period;
  let avgL = Math.abs(changes.slice(-period-1,-1).filter(x=>x<0).reduce((a,b)=>a+b,0))/period;
  const last = changes[changes.length-1];
  avgG = (avgG*(period-1)+Math.max(last,0))/period;
  avgL = (avgL*(period-1)+Math.abs(Math.min(last,0)))/period;
  if (avgL === 0) return 100;
  return 100 - 100/(1 + avgG/avgL);
}

function calcSupport(c: Candle[], settings: AppSettings): SupportData {
  const atrV = atr(c, 14);
  const atrVal = atrV.length ? atrV[atrV.length-1] : 0;

  const closes20 = c.slice(-20).map(x=>x.close);
  const mid20 = closes20.reduce((a,b)=>a+b)/20;
  const std20 = Math.sqrt(closes20.map(v=>(v-mid20)**2).reduce((a,b)=>a+b)/20);
  const bbWidth = (4*std20)/mid20*100;

  // ADX strength
  const dmP: number[] = [], dmM: number[] = [], trArr: number[] = [];
  for (let i=1;i<c.length;i++) {
    const up=c[i].high-c[i-1].high, dn=c[i-1].low-c[i].low;
    dmP.push(up>dn&&up>0?up:0); dmM.push(dn>up&&dn>0?dn:0);
    trArr.push(Math.max(c[i].high-c[i].low,Math.abs(c[i].high-c[i-1].close),Math.abs(c[i].low-c[i-1].close)));
  }
  const sm14=(arr:number[])=>{
    if(arr.length<14)return 0;
    let s=arr.slice(0,14).reduce((a,b)=>a+b,0);
    for(let i=14;i<arr.length;i++)s=s-s/14+arr[i];
    return s;
  };
  const str=sm14(trArr),sdp=sm14(dmP),sdm=sm14(dmM);
  const diP=str>0?sdp/str*100:0, diM=str>0?sdm/str*100:0;
  const dx=diP+diM>0?Math.abs(diP-diM)/(diP+diM)*100:0;
  const adxStrength=dx;

  // Pivot points from previous session candle
  const prev = c.length > 1 ? c[c.length-2] : c[0];
  const pp = (prev.high+prev.low+prev.close)/3;
  const r1 = 2*pp - prev.low;
  const s1 = 2*pp - prev.high;

  // Volume ratio
  const avgVol = c.slice(-20).map(x=>x.volume).reduce((a,b)=>a+b)/20;
  const volRatio = avgVol>0 ? c[c.length-1].volume/avgVol : 1;

  // Session check (local device time)
  const hourLocal = new Date().getHours();
  const inSession = hourLocal >= settings.sessionStartUTC && hourLocal < settings.sessionEndUTC;
  let sessionName = 'Закрита';
  if (inSession) {
    if (hourLocal >= 9 && hourLocal < 13) sessionName = 'Ранок';
    else if (hourLocal >= 13 && hourLocal < 17) sessionName = 'День';
    else if (hourLocal >= 17 && hourLocal < 21) sessionName = 'Вечір';
    else sessionName = 'Відкрита';
  }

  return { atr: atrVal, bbWidth, adxStrength, pivotPP: pp, pivotR1: r1, pivotS1: s1,
    volumeRatio: volRatio, inSession, sessionName };
}

// ── Main export ───────────────────────────────────────────────────────────────

export function analyzeGold(candles: Candle[], settings: AppSettings): GoldSignal {
  const signalFns = [
    s01_EMA9_21, s02_EMA21_50, s03_EMA200, s04_MACD_Signal, s05_MACD_Histogram,
    s06_ParabolicSAR, s07_IchimokuTK, s08_IchimokuCloud,
    s09_RSI14, s10_RSI7, s11_Stochastic, s12_CCI, s13_WilliamsR, s14_Momentum,
    s15_DeMarker, s16_TRIX, s17_CMO, s18_ROC, s19_ElderRay,
    s20_VWAP, s21_ForceIndex, s22_Aroon, s23_Donchian,
    s24_BollingerBands, s25_Keltner, s26_ADX_DI
  ];

  const votes = signalFns.map(fn => fn(candles));
  const longVotes = votes.filter(v=>v.direction==='LONG').length;
  const shortVotes = votes.filter(v=>v.direction==='SHORT').length;
  const neutralVotes = 26 - longVotes - shortVotes;
  const score = longVotes - shortVotes;

  const support = calcSupport(candles, settings);
  const price = candles[candles.length-1].close;

  // Filter checks
  const filterReasons: string[] = [];
  if (!support.inSession) filterReasons.push(`Сесія закрита (місцевий час ${new Date().getHours()}:${String(new Date().getMinutes()).padStart(2,'0')})`);
  if (support.adxStrength < settings.minAdx) filterReasons.push(`ADX слабкий (${support.adxStrength.toFixed(1)} < ${settings.minAdx})`);
  if (support.bbWidth < 0.03) filterReasons.push('Низька волатильність (BB занадто вузький)');
  const filtersOk = filterReasons.length === 0;

  let rawDirection: VoteDirection = 'NONE';
  if (filtersOk) {
    if (longVotes >= settings.longThreshold) rawDirection = 'LONG';
    else if (shortVotes >= settings.shortThreshold) rawDirection = 'SHORT';
  }

  const isContrarian = settings.contrarian ?? false;
  let direction: VoteDirection = rawDirection;
  if (isContrarian && rawDirection !== 'NONE') {
    direction = rawDirection === 'LONG' ? 'SHORT' : 'LONG';
  }

  // Structural SL: place behind recent swing high/low (last 10 candles)
  // This avoids "stop hunting" where price briefly pierces ATR-based SL then reverses.
  const swing = candles.slice(-10);
  const swingLow  = Math.min(...swing.map(c => c.low));
  const swingHigh = Math.max(...swing.map(c => c.high));
  const buf = support.atr * 0.25; // small buffer beyond the swing level

  let sl = 0;
  if (direction === 'LONG') {
    const structuralSL = swingLow - buf;
    const atrSL        = price - support.atr * settings.slMultiplier;
    sl = Math.min(structuralSL, atrSL); // take the wider (lower) stop
  } else if (direction === 'SHORT') {
    const structuralSL = swingHigh + buf;
    const atrSL        = price + support.atr * settings.slMultiplier;
    sl = Math.max(structuralSL, atrSL); // take the wider (higher) stop
  }

  // TP maintains user's desired RR from the actual risk distance
  const risk = direction !== 'NONE' ? Math.abs(price - sl) : 0;
  const tp = direction === 'LONG'  ? price + risk * settings.tpMultiplier
           : direction === 'SHORT' ? price - risk * settings.tpMultiplier : 0;
  const reward = Math.abs(tp - price);
  const rr = risk > 0 ? reward / risk : 0;

  const maxVotes = Math.max(longVotes, shortVotes);
  const confidence = (maxVotes / 26) * 100;

  return {
    direction, longVotes, shortVotes, neutralVotes, totalSignalIndicators: 26,
    score, confidence, votes, support,
    entryPrice: price, stopLoss: sl, takeProfit: tp, riskReward: rr,
    timestamp: Date.now(), timeframe: settings.timeframe, symbol: settings.symbol ?? 'XAU/USD',
    filtersOk, filterReasons, isContrarian
  };
}
