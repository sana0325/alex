import CryptoJS from 'crypto-js';
import { ExchangeConfig, ExchangeName } from '../types';

const STORAGE_KEY = 'crypto_scalp_keys_v1';

// --- Secure Storage Abstraction ---

// FUTURE INTEGRATION: When wrapping with Capacitor or Electron, 
// replace the localStorage implementation below with native Keychain/SecureStorage.

const isNativePlatform = () => {
    // Check for Capacitor or Electron context
    // return window?.Capacitor?.isNativePlatform() || window?.process?.type === 'renderer';
    return false; // Default to Web for this codebase
};

export const saveExchangeConfig = async (config: ExchangeConfig) => {
  const current = await loadExchangeConfig();
  const updated = { ...current, [config.name]: config };
  
  if (isNativePlatform()) {
      // Example: await SecureStoragePlugin.set({ key: STORAGE_KEY, value: JSON.stringify(updated) });
      console.log("Native storage not yet implemented, falling back to local");
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }
};

export const loadExchangeConfig = async (): Promise<Record<string, ExchangeConfig>> => {
  if (isNativePlatform()) {
      // Example: const { value } = await SecureStoragePlugin.get({ key: STORAGE_KEY });
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
  } else {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
  }
};

export const clearExchangeConfig = async (name: ExchangeName) => {
    const current = await loadExchangeConfig();
    delete current[name];
    
    if (isNativePlatform()) {
         localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } else {
         localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    }
};

// --- Execution Logic ---

interface TradeParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price?: number; // Optional for limit
  stopLoss?: number;
  takeProfit?: number;
}

export const executeTrade = async (exchangeName: ExchangeName, params: TradeParams): Promise<{ success: boolean; message: string }> => {
  const configs = await loadExchangeConfig();
  const config = configs[exchangeName];

  if (!config) {
    return { success: false, message: `No API configuration found for ${exchangeName}. Please configure in settings.` };
  }

  try {
    switch (exchangeName) {
      case 'BINANCE':
        return await executeBinanceTrade(config, params);
      case 'BYBIT':
        return await executeBybitTrade(config, params);
      case 'OKX':
        return await executeOkxTrade(config, params);
      default:
        return { success: false, message: 'Exchange not supported' };
    }
  } catch (error: any) {
    console.error("Trade Execution Error:", error);
    return { success: false, message: error.message || 'Unknown execution error' };
  }
};

// --- BINANCE IMPLEMENTATION ---
const executeBinanceTrade = async (config: ExchangeConfig, params: TradeParams): Promise<any> => {
  const baseUrl = config.isTestnet ? 'https://testnet.binancefuture.com' : 'https://fapi.binance.com';
  const endpoint = '/fapi/v1/order';
  
  // Binance Futures Order Params
  const queryParams: any = {
    symbol: params.symbol.replace('/', ''),
    side: params.side,
    type: 'MARKET', // Using Market for immediate execution in this scalper
    quantity: params.quantity,
    timestamp: Date.now(),
    recvWindow: 5000
  };

  // Generate Query String
  const queryString = Object.keys(queryParams)
    .map(key => `${key}=${queryParams[key]}`)
    .join('&');

  // Sign
  const signature = CryptoJS.HmacSHA256(queryString, config.apiSecret).toString(CryptoJS.enc.Hex);
  
  const url = `${baseUrl}${endpoint}?${queryString}&signature=${signature}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-MBX-APIKEY': config.apiKey,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.msg || 'Binance API Error');
  }

  return { success: true, message: `Order Executed! ID: ${data.orderId}` };
};

// --- BYBIT IMPLEMENTATION ---
const executeBybitTrade = async (config: ExchangeConfig, params: TradeParams): Promise<any> => {
  const baseUrl = config.isTestnet ? 'https://api-testnet.bybit.com' : 'https://api.bybit.com';
  const endpoint = '/v5/order/create';
  
  const timestamp = Date.now().toString();
  const recvWindow = '5000';
  
  const body = JSON.stringify({
    category: 'linear',
    symbol: params.symbol.replace('/', ''),
    side: params.side === 'BUY' ? 'Buy' : 'Sell',
    orderType: 'Market',
    qty: params.quantity.toString(),
    stopLoss: params.stopLoss?.toString(),
    takeProfit: params.takeProfit?.toString(),
    timeInForce: 'GTC'
  });

  // Signature: hmac_sha256(timestamp + apiKey + recvWindow + payload, secret)
  const signPayload = timestamp + config.apiKey + recvWindow + body;
  const signature = CryptoJS.HmacSHA256(signPayload, config.apiSecret).toString(CryptoJS.enc.Hex);

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'X-BAPI-API-KEY': config.apiKey,
      'X-BAPI-TIMESTAMP': timestamp,
      'X-BAPI-SIGN': signature,
      'X-BAPI-RECV-WINDOW': recvWindow,
      'Content-Type': 'application/json'
    },
    body: body
  });

  const data = await response.json();

  if (data.retCode !== 0) {
    throw new Error(data.retMsg || 'Bybit API Error');
  }

  return { success: true, message: `Order Placed! ID: ${data.result.orderId}` };
};

// --- OKX IMPLEMENTATION ---
const executeOkxTrade = async (config: ExchangeConfig, params: TradeParams): Promise<any> => {
  const baseUrl = 'https://www.okx.com';
  const endpoint = '/api/v5/trade/order';
  const method = 'POST';
  
  const timestamp = new Date().toISOString(); // ISO format for OKX
  
  const body = JSON.stringify({
    instId: params.symbol.replace('/', '-SWAP'), // Assuming Perp Swap
    tdMode: 'cross',
    side: params.side.toLowerCase(),
    ordType: 'market',
    sz: params.quantity.toString(), // Note: OKX size is in contracts, not coin amount usually. Simple mapping for demo.
    slOrdPx: params.stopLoss?.toString(),
    slTriggerPx: params.stopLoss?.toString(),
    tpOrdPx: params.takeProfit?.toString(),
    tpTriggerPx: params.takeProfit?.toString()
  });

  // Signature: hmac_sha256(timestamp + method + requestPath + body, secret)
  const signPayload = timestamp + method + endpoint + body;
  const signature = CryptoJS.HmacSHA256(signPayload, config.apiSecret).toString(CryptoJS.enc.Base64);

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'OK-ACCESS-KEY': config.apiKey,
      'OK-ACCESS-SIGN': signature,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': config.passphrase || '',
      'Content-Type': 'application/json'
    },
    body: body
  });

  const data = await response.json();

  if (data.code !== '0') {
    throw new Error(data.msg || 'OKX API Error');
  }

  return { success: true, message: `Order Placed! ID: ${data.data[0].ordId}` };
};