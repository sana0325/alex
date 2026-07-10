// ── BingX USDT-M Perpetual Swap API client ──────────────────────────────────
// Docs: https://bingx-api.github.io/docs/#/en-us/swapV2/
// All private endpoints are signed with HMAC-SHA256 over the sorted query
// string, using the account's API secret. Signing happens on-device (Web
// Crypto API) — the secret never leaves the phone. Placing real orders
// requires the API key to have "Perpetual Futures" trading permission
// enabled on bingx.com.

const BASE_URL = 'https://open-api.bingx.com';

export interface BingXCreds {
  apiKey: string;
  apiSecret: string;
}

export interface BingXBalance {
  asset: string;
  balance: number;
  equity: number;
  availableMargin: number;
  unrealizedProfit: number;
}

export interface BingXContract {
  symbol: string;
  pricePrecision: number;
  quantityPrecision: number;
  tradeMinQuantity: number;
  tradeMinUSDT: number;
}

export interface BingXKline {
  time: number; // seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BingXPosition {
  symbol: string;
  positionSide: 'LONG' | 'SHORT';
  positionAmt: number;
  avgPrice: number;
  markPrice: number;
  unrealizedProfit: number;
  leverage: number;
  positionId: string;
}

export type OrderSide = 'BUY' | 'SELL';
export type PositionSide = 'LONG' | 'SHORT';

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const keys = Object.keys(params).filter(k => params[k] !== undefined).sort();
  return keys.map(k => `${k}=${encodeURIComponent(String(params[k]))}`).join('&');
}

class BingXError extends Error {
  constructor(message: string, public code?: number) {
    super(message);
    this.name = 'BingXError';
  }
}

async function request<T = any>(
  creds: BingXCreds | null,
  method: 'GET' | 'POST',
  path: string,
  params: Record<string, string | number | undefined> = {},
  signed = true
): Promise<T> {
  const query: Record<string, string | number | undefined> = { ...params };
  if (signed) {
    query.timestamp = Date.now();
    query.recvWindow = 5000;
  }

  let queryString = buildQuery(query);

  if (signed) {
    if (!creds?.apiSecret) throw new BingXError('Немає BingX API ключа/секрету');
    const signature = await hmacSha256Hex(creds.apiSecret, queryString);
    queryString += `&signature=${signature}`;
  }

  const url = `${BASE_URL}${path}?${queryString}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (signed && creds?.apiKey) headers['X-BX-APIKEY'] = creds.apiKey;

  const res = await fetch(url, { method, headers });
  const json = await res.json().catch(() => null);

  if (!res.ok || !json || (json.code !== undefined && json.code !== 0)) {
    const msg = json?.msg || `BingX HTTP ${res.status}`;
    throw new BingXError(msg, json?.code);
  }
  return json.data as T;
}

// ── Public endpoints ─────────────────────────────────────────────────────────

export async function getContracts(): Promise<BingXContract[]> {
  const data = await request<any[]>(null, 'GET', '/openApi/swap/v2/quote/contracts', {}, false);
  return (data || []).map(c => ({
    symbol: c.symbol,
    pricePrecision: Number(c.pricePrecision ?? 2),
    quantityPrecision: Number(c.quantityPrecision ?? 3),
    tradeMinQuantity: Number(c.tradeMinQuantity ?? 0),
    tradeMinUSDT: Number(c.tradeMinUSDT ?? 5),
  }));
}

const INTERVAL_MAP: Record<string, string> = { M5: '5m', M15: '15m', M30: '30m' };

export async function getKlines(symbol: string, timeframe: string, limit = 150): Promise<BingXKline[]> {
  const interval = INTERVAL_MAP[timeframe] ?? '5m';
  const data = await request<any[]>(null, 'GET', '/openApi/swap/v3/quote/klines', { symbol, interval, limit }, false);
  return (data || [])
    .map(k => ({
      time: Math.floor(Number(k.time) / 1000),
      open: Number(k.open),
      high: Number(k.high),
      low: Number(k.low),
      close: Number(k.close),
      volume: Number(k.volume),
    }))
    .sort((a, b) => a.time - b.time);
}

export async function getMarkPrice(symbol: string): Promise<number | null> {
  const data = await request<any>(null, 'GET', '/openApi/swap/v2/quote/price', { symbol }, false);
  const price = data?.price ?? data?.markPrice;
  return price ? Number(price) : null;
}

// ── Private (signed) endpoints ──────────────────────────────────────────────

export async function getBalance(creds: BingXCreds): Promise<BingXBalance | null> {
  const data = await request<any>(creds, 'GET', '/openApi/swap/v2/user/balance', {});
  const b = data?.balance ?? data;
  if (!b) return null;
  return {
    asset: b.asset ?? 'USDT',
    balance: Number(b.balance ?? 0),
    equity: Number(b.equity ?? b.balance ?? 0),
    availableMargin: Number(b.availableMargin ?? 0),
    unrealizedProfit: Number(b.unrealizedProfit ?? 0),
  };
}

export async function getPositions(creds: BingXCreds, symbol?: string): Promise<BingXPosition[]> {
  const data = await request<any[]>(creds, 'GET', '/openApi/swap/v2/user/positions', { symbol });
  return (data || [])
    .filter(p => Math.abs(Number(p.positionAmt ?? 0)) > 0)
    .map(p => ({
      symbol: p.symbol,
      positionSide: p.positionSide,
      positionAmt: Math.abs(Number(p.positionAmt)),
      avgPrice: Number(p.avgPrice),
      markPrice: Number(p.markPrice),
      unrealizedProfit: Number(p.unrealizedProfit),
      leverage: Number(p.leverage),
      positionId: String(p.positionId ?? `${p.symbol}-${p.positionSide}`),
    }));
}

export async function setLeverage(creds: BingXCreds, symbol: string, side: PositionSide, leverage: number): Promise<void> {
  await request(creds, 'POST', '/openApi/swap/v2/trade/leverage', { symbol, side, leverage });
}

interface PlaceOrderParams {
  symbol: string;
  side: OrderSide;
  positionSide: PositionSide;
  quantity: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
}

export async function placeMarketOrder(creds: BingXCreds, p: PlaceOrderParams): Promise<any> {
  const params: Record<string, string | number | undefined> = {
    symbol: p.symbol,
    side: p.side,
    positionSide: p.positionSide,
    type: 'MARKET',
    quantity: p.quantity,
  };
  if (p.stopLossPrice) {
    params.stopLoss = JSON.stringify({ type: 'STOP_MARKET', stopPrice: p.stopLossPrice, workingType: 'MARK_PRICE' });
  }
  if (p.takeProfitPrice) {
    params.takeProfit = JSON.stringify({ type: 'TAKE_PROFIT_MARKET', stopPrice: p.takeProfitPrice, workingType: 'MARK_PRICE' });
  }
  return request(creds, 'POST', '/openApi/swap/v2/trade/order', params);
}

export async function closePosition(creds: BingXCreds, position: BingXPosition): Promise<any> {
  const side: OrderSide = position.positionSide === 'LONG' ? 'SELL' : 'BUY';
  return request(creds, 'POST', '/openApi/swap/v2/trade/order', {
    symbol: position.symbol,
    side,
    positionSide: position.positionSide,
    type: 'MARKET',
    quantity: position.positionAmt,
  });
}

export function roundToPrecision(value: number, precision: number): number {
  const f = Math.pow(10, precision);
  return Math.floor(value * f) / f;
}

export { BingXError };
