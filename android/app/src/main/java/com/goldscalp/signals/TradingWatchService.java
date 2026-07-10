package com.goldscalp.signals;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * The bot's whole trading brain, running natively so it keeps scanning for
 * signals AND opening/watching/closing trades whether the app is open,
 * backgrounded, or the screen is locked — the Capacitor WebView's own JS
 * timers get throttled by Android the moment the app isn't visible, so this
 * used to only be able to watch an already-open trade in the background.
 * Now it runs the full loop itself: pick a symbol, ask DeepSeek, validate
 * the setup, open (real limit order or a simulated demo fill), watch it
 * through to close, then go back to scanning — for as long as the service
 * is running. The WebView hands this off on backgrounding and reclaims it
 * (stopping the service) whenever the app is opened.
 */
public class TradingWatchService extends Service {

    public static final String EXTRA_PAYLOAD = "payload";
    public static final String PREFS_NAME = "trading_watch_prefs";
    public static final String QUEUE_KEY = "closed_queue";

    private static final String TAG = "TradingWatchService";
    private static final String BASE_URL = "https://open-api.bingx.com";
    private static final String DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
    private static final String SERVICE_CHANNEL = "trading_watch_service";
    private static final String ALERT_CHANNEL = "trading_watch_alerts";
    private static final int SERVICE_NOTIF_ID = 5501;

    private static final long WATCH_INTERVAL_MS = 12000;
    private static final long SCAN_INTERVAL_MS = 20000;
    private static final long SYMBOL_COOLDOWN_MS = 5 * 60 * 1000;
    private static final long LIMIT_ORDER_TIMEOUT_MS = 3 * 60 * 1000;
    private static final double LIMIT_ORDER_MAX_DRIFT_PCT = 0.4;

    private enum Mode { SCANNING, WATCH_ORDER, WATCH_POSITION }

    private Thread worker;
    private volatile boolean running = false;
    private volatile Mode mode = Mode.SCANNING;

    // ── Account / engine context (from the handoff payload) ─────────────────
    private String apiKey = "";
    private String apiSecret = "";
    private String deepseekKey = "";
    private int leverage = 20;
    private boolean live = false;
    private double paperBalance = 200;
    private String lessons = "";
    private String statsJson = "{}";
    private final List<String[]> symbols = new ArrayList<>(); // [symbol, market]
    private final List<double[]> stakeLadder = new ArrayList<>(); // [maxBalance, stakeUSDT]

    // ── Active trade / order being watched ───────────────────────────────────
    private String tradeId = "";
    private String orderId = "";
    private String symbol = "";
    private String side = "LONG";
    private String setup = "";
    private String aiReason = "";
    private double entry, sl, tp1, stakeUSDT, quantity;
    private long openedAt;
    private long placedAt;
    private boolean simulated;

    // ── In-memory scan state ─────────────────────────────────────────────────
    private int scanIndex = 0;
    private final Map<String, Long> lastTradeAtBySymbol = new HashMap<>();
    private final Map<String, Integer> qtyPrecisionCache = new HashMap<>();
    private final Set<String> leverageSetCache = new HashSet<>();

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createChannels();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(SERVICE_NOTIF_ID, buildServiceNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(SERVICE_NOTIF_ID, buildServiceNotification());
        }

        String payload = intent != null ? intent.getStringExtra(EXTRA_PAYLOAD) : null;
        if (payload != null) {
            try {
                applyPayload(new JSONObject(payload));
            } catch (Exception e) {
                Log.e(TAG, "Bad payload, stopping", e);
                stopSelf();
                return START_NOT_STICKY;
            }
        }

        if (!running) {
            running = true;
            worker = new Thread(this::watchLoop, "TradingWatchLoop");
            worker.start();
        }
        return START_REDELIVER_INTENT;
    }

    private void applyPayload(JSONObject p) throws Exception {
        apiKey = p.optString("apiKey", "");
        apiSecret = p.optString("apiSecret", "");
        deepseekKey = p.optString("deepseekKey", "");
        leverage = p.optInt("leverage", 20);
        live = p.optBoolean("live", false);
        paperBalance = p.optDouble("paperBalance", 200);
        lessons = p.optString("lessons", "");
        statsJson = p.optString("statsJson", "{}");

        symbols.clear();
        JSONArray symArr = p.optJSONArray("symbols");
        if (symArr != null) {
            for (int i = 0; i < symArr.length(); i++) {
                JSONObject s = symArr.optJSONObject(i);
                if (s == null) continue;
                symbols.add(new String[]{s.optString("symbol", ""), s.optString("market", "crypto")});
            }
        }

        stakeLadder.clear();
        JSONArray ladderArr = p.optJSONArray("stakeLadder");
        if (ladderArr != null) {
            for (int i = 0; i < ladderArr.length(); i++) {
                JSONObject t = ladderArr.optJSONObject(i);
                if (t == null) continue;
                stakeLadder.add(new double[]{t.optDouble("maxBalance", Double.MAX_VALUE), t.optDouble("stakeUSDT", 2)});
            }
        }

        JSONObject activeTrade = p.optJSONObject("activeTrade");
        JSONObject activePending = p.optJSONObject("activePending");
        if (activeTrade != null) {
            tradeId = activeTrade.optString("tradeId", "");
            symbol = activeTrade.optString("symbol", "");
            side = activeTrade.optString("side", "LONG");
            entry = activeTrade.optDouble("entry", 0);
            sl = activeTrade.optDouble("sl", 0);
            tp1 = activeTrade.optDouble("tp1", 0);
            stakeUSDT = activeTrade.optDouble("stakeUSDT", 0);
            quantity = activeTrade.optDouble("quantity", 0);
            setup = activeTrade.optString("setup", "");
            aiReason = activeTrade.optString("aiReason", "");
            openedAt = activeTrade.optLong("openedAt", System.currentTimeMillis());
            simulated = activeTrade.optBoolean("simulated", false);
            mode = Mode.WATCH_POSITION;
        } else if (activePending != null) {
            tradeId = activePending.optString("tradeId", "");
            orderId = activePending.optString("orderId", "");
            symbol = activePending.optString("symbol", "");
            side = activePending.optString("side", "LONG");
            entry = activePending.optDouble("price", 0);
            sl = activePending.optDouble("sl", 0);
            tp1 = activePending.optDouble("tp1", 0);
            stakeUSDT = activePending.optDouble("stakeUSDT", 0);
            setup = activePending.optString("setup", "");
            aiReason = activePending.optString("aiReason", "");
            placedAt = activePending.optLong("placedAt", System.currentTimeMillis());
            simulated = false;
            mode = Mode.WATCH_ORDER;
        } else {
            mode = Mode.SCANNING;
        }
    }

    @Override
    public void onDestroy() {
        running = false;
        if (worker != null) worker.interrupt();
        super.onDestroy();
    }

    private void watchLoop() {
        while (running) {
            try {
                switch (mode) {
                    case WATCH_ORDER:
                        checkOrderTick();
                        break;
                    case WATCH_POSITION:
                        checkPositionTick();
                        break;
                    default:
                        scanTick();
                }
            } catch (Exception e) {
                Log.e(TAG, "loop tick failed, will retry", e);
            }
            if (!running) break;
            try {
                Thread.sleep(mode == Mode.SCANNING ? SCAN_INTERVAL_MS : WATCH_INTERVAL_MS);
            } catch (InterruptedException e) {
                break;
            }
        }
    }

    // ── Watching a resting limit order ───────────────────────────────────────

    private void checkOrderTick() throws Exception {
        JSONObject data = requestJsonObject("GET", "/openApi/swap/v2/trade/order", new String[][]{
            {"symbol", symbol}, {"orderId", orderId}
        }, true);

        String status = "NEW";
        double avgPrice = 0;
        if (data != null) {
            JSONObject order = data.optJSONObject("order");
            if (order == null) order = data;
            status = order.optString("status", "NEW");
            avgPrice = order.optDouble("avgPrice", 0);
        }

        if ("FILLED".equals(status)) {
            if (avgPrice > 0) entry = avgPrice;
            pushEvent(buildFilledEvent());
            mode = Mode.WATCH_POSITION;
            showOpenedNotification();
            updateServiceNotification();
            return;
        }
        if ("CANCELLED".equals(status) || "REJECTED".equals(status) || "EXPIRED".equals(status)) {
            pushEvent(buildCancelledEvent());
            mode = Mode.SCANNING;
            updateServiceNotification();
            return;
        }

        double price = fetchMarkPrice(symbol, entry);
        double driftPct = entry > 0 ? Math.abs(price - entry) / entry * 100 : 0;
        boolean timedOut = System.currentTimeMillis() - placedAt > LIMIT_ORDER_TIMEOUT_MS;
        if (timedOut || driftPct > LIMIT_ORDER_MAX_DRIFT_PCT) {
            try {
                requestRaw("POST", "/openApi/swap/v2/trade/order/cancel", new String[][]{
                    {"symbol", symbol}, {"orderId", orderId}
                }, true);
            } catch (Exception ignored) { /* best-effort */ }
            pushEvent(buildCancelledEvent());
            mode = Mode.SCANNING;
            updateServiceNotification();
        }
    }

    // ── Watching an open position (real or simulated) ───────────────────────

    private void checkPositionTick() throws Exception {
        Double exitPrice = null;

        if (simulated) {
            double price = fetchMarkPrice(symbol, entry);
            if (price > 0) {
                if ("LONG".equals(side)) {
                    if (price <= sl) exitPrice = sl;
                    else if (price >= tp1) exitPrice = tp1;
                } else {
                    if (price >= sl) exitPrice = sl;
                    else if (price <= tp1) exitPrice = tp1;
                }
            }
        } else {
            JSONArray positions = requestJsonArray("/openApi/swap/v2/user/positions", new String[][]{{"symbol", symbol}});
            boolean stillOpen = false;
            if (positions != null) {
                for (int i = 0; i < positions.length(); i++) {
                    JSONObject p = positions.optJSONObject(i);
                    if (p == null) continue;
                    double amt = Math.abs(p.optDouble("positionAmt", 0));
                    if (amt > 0 && side.equals(p.optString("positionSide"))) {
                        stillOpen = true;
                        break;
                    }
                }
            }
            if (!stillOpen) exitPrice = fetchMarkPrice(symbol, entry);
        }

        if (exitPrice != null) {
            JSONObject event = buildClosedEvent(exitPrice);
            pushEvent(event);
            if (simulated) paperBalance += event.optDouble("pnlUSDT", 0);
            showCloseNotification(event);
            mode = Mode.SCANNING;
            updateServiceNotification();
        }
    }

    // ── Scanning for a new setup and (maybe) entering ────────────────────────

    private void scanTick() throws Exception {
        if (symbols.isEmpty() || deepseekKey.isEmpty()) return;

        String[] target = symbols.get(scanIndex % symbols.size());
        scanIndex++;
        String targetSymbol = target[0];
        String market = target[1];

        List<double[]> candles = fetchKlines(targetSymbol); // [time,open,high,low,close,volume]
        if (candles.size() < 60) return;

        long now = System.currentTimeMillis();
        Long last = lastTradeAtBySymbol.get(targetSymbol);
        if (last != null && now - last < SYMBOL_COOLDOWN_MS) return;

        Double poc = computePoc(candles);
        String systemPrompt = buildSystemPrompt(targetSymbol, market, lessons, statsJson);
        String userPrompt = buildUserPrompt(targetSymbol, candles, poc);
        JSONObject ai = callDeepSeek(systemPrompt, userPrompt);
        if (ai == null) return;

        String type = ai.optString("type", "WAIT");
        if (!"LONG".equals(type) && !"SHORT".equals(type)) return;

        double sigEntry = ai.optDouble("entry", 0);
        double sigSl = ai.optDouble("sl", 0);
        double sigTp1 = ai.optDouble("tp1", 0);
        if (sigEntry <= 0 || sigSl <= 0 || sigTp1 <= 0) return;

        if ("LONG".equals(type) && (sigSl >= sigEntry || sigTp1 <= sigEntry)) return;
        if ("SHORT".equals(type) && (sigSl <= sigEntry || sigTp1 >= sigEntry)) return;
        double slDist = Math.abs(sigEntry - sigSl);
        double tpDist = Math.abs(sigTp1 - sigEntry);
        if (tpDist <= slDist) return;

        double lastClose = candles.get(candles.size() - 1)[4];
        double driftPct = Math.abs(lastClose - sigEntry) / sigEntry * 100;
        if (driftPct > LIMIT_ORDER_MAX_DRIFT_PCT) return;

        String setupName = ai.optString("setup", "SMC Scalp");
        String reason = ai.optString("reason", "");

        if (live) {
            double balance = fetchBingxBalance();
            double stake = stakeFromLadder(balance);
            int precision = getQuantityPrecision(targetSymbol);
            double qtyRaw = (stake * leverage) / sigEntry;
            double qty = roundToPrecision(qtyRaw, precision);
            if (qty <= 0) return;

            String positionSide = type;
            String orderSide = "LONG".equals(type) ? "BUY" : "SELL";
            String leverageKey = targetSymbol + "-" + positionSide;
            if (!leverageSetCache.contains(leverageKey)) {
                try {
                    requestRaw("POST", "/openApi/swap/v2/trade/leverage", new String[][]{
                        {"symbol", targetSymbol}, {"side", positionSide}, {"leverage", String.valueOf(leverage)}
                    }, true);
                    leverageSetCache.add(leverageKey);
                } catch (Exception ignored) { /* best-effort, order may still succeed */ }
            }

            String newOrderId = placeLimitOrder(targetSymbol, orderSide, positionSide, qty, sigEntry, sigSl, sigTp1);
            if (newOrderId == null) return;

            tradeId = java.util.UUID.randomUUID().toString();
            orderId = newOrderId;
            symbol = targetSymbol;
            side = type;
            entry = sigEntry;
            sl = sigSl;
            tp1 = sigTp1;
            stakeUSDT = stake;
            setup = setupName;
            aiReason = reason;
            placedAt = now;
            simulated = false;
            lastTradeAtBySymbol.put(targetSymbol, now);
            mode = Mode.WATCH_ORDER;
            pushEvent(buildPendingEvent());
        } else {
            double stake = stakeFromLadder(paperBalance);
            tradeId = java.util.UUID.randomUUID().toString();
            symbol = targetSymbol;
            side = type;
            entry = lastClose;
            sl = sigSl;
            tp1 = sigTp1;
            stakeUSDT = stake;
            quantity = 0;
            setup = setupName;
            aiReason = reason;
            openedAt = now;
            simulated = true;
            lastTradeAtBySymbol.put(targetSymbol, now);
            mode = Mode.WATCH_POSITION;
            pushEvent(buildOpenedEvent());
            showOpenedNotification();
        }
        updateServiceNotification();
    }

    private double stakeFromLadder(double balance) {
        if (stakeLadder.isEmpty()) return 2;
        if (balance <= 0) return stakeLadder.get(0)[1];
        for (double[] tier : stakeLadder) {
            if (balance < tier[0]) return tier[1];
        }
        return stakeLadder.get(stakeLadder.size() - 1)[1];
    }

    private int getQuantityPrecision(String sym) {
        if (qtyPrecisionCache.containsKey(sym)) return qtyPrecisionCache.get(sym);
        try {
            JSONArray contracts = (JSONArray) requestRaw("GET", "/openApi/swap/v2/quote/contracts", new String[][]{}, false).opt("data");
            if (contracts != null) {
                for (int i = 0; i < contracts.length(); i++) {
                    JSONObject c = contracts.optJSONObject(i);
                    if (c == null) continue;
                    qtyPrecisionCache.put(c.optString("symbol"), c.optInt("quantityPrecision", 3));
                }
            }
        } catch (Exception ignored) { /* fall back below */ }
        Integer p = qtyPrecisionCache.get(sym);
        return p != null ? p : 3;
    }

    private static double roundToPrecision(double value, int precision) {
        double f = Math.pow(10, precision);
        return Math.floor(value * f) / f;
    }

    // ── Event building ────────────────────────────────────────────────────────

    private JSONObject buildPendingEvent() throws Exception {
        JSONObject e = new JSONObject();
        e.put("type", "entry");
        e.put("filled", false);
        e.put("tradeId", tradeId);
        e.put("orderId", orderId);
        e.put("symbol", symbol);
        e.put("side", side);
        e.put("price", entry);
        e.put("sl", sl);
        e.put("tp1", tp1);
        e.put("stakeUSDT", stakeUSDT);
        e.put("leverage", leverage);
        e.put("setup", setup);
        e.put("aiReason", aiReason);
        e.put("placedAt", placedAt);
        return e;
    }

    private JSONObject buildOpenedEvent() throws Exception {
        JSONObject e = new JSONObject();
        e.put("type", "entry");
        e.put("filled", true);
        e.put("tradeId", tradeId);
        e.put("symbol", symbol);
        e.put("side", side);
        e.put("entry", entry);
        e.put("sl", sl);
        e.put("tp1", tp1);
        e.put("stakeUSDT", stakeUSDT);
        e.put("leverage", leverage);
        e.put("setup", setup);
        e.put("aiReason", aiReason);
        e.put("openedAt", openedAt);
        e.put("simulated", simulated);
        return e;
    }

    private JSONObject buildFilledEvent() throws Exception {
        JSONObject e = new JSONObject();
        e.put("type", "filled");
        e.put("tradeId", tradeId);
        e.put("symbol", symbol);
        e.put("side", side);
        e.put("entry", entry);
        e.put("sl", sl);
        e.put("tp1", tp1);
        e.put("stakeUSDT", stakeUSDT);
        e.put("leverage", leverage);
        e.put("setup", setup);
        e.put("aiReason", aiReason);
        e.put("openedAt", System.currentTimeMillis());
        openedAt = System.currentTimeMillis();
        return e;
    }

    private JSONObject buildClosedEvent(double exit) throws Exception {
        int directionSign = "LONG".equals(side) ? 1 : -1;
        double priceDelta = (exit - entry) * directionSign;
        double pnlPercent = entry > 0 ? (priceDelta / entry) * leverage * 100 : 0;
        double pnlUSDT = stakeUSDT * (pnlPercent / 100);
        String outcome = "BREAKEVEN";
        if (pnlUSDT > stakeUSDT * 0.01) outcome = "WIN";
        else if (pnlUSDT < -stakeUSDT * 0.01) outcome = "LOSS";

        JSONObject event = new JSONObject();
        event.put("type", "closed");
        event.put("tradeId", tradeId);
        event.put("symbol", symbol);
        event.put("side", side);
        event.put("entry", entry);
        event.put("exit", exit);
        event.put("sl", sl);
        event.put("tp1", tp1);
        event.put("stakeUSDT", stakeUSDT);
        event.put("leverage", leverage);
        event.put("pnlUSDT", pnlUSDT);
        event.put("pnlPercent", pnlPercent);
        event.put("outcome", outcome);
        event.put("setup", setup);
        event.put("aiReason", aiReason);
        event.put("openedAt", openedAt);
        event.put("closedAt", System.currentTimeMillis());
        event.put("simulated", simulated);
        return event;
    }

    private JSONObject buildCancelledEvent() throws Exception {
        JSONObject event = new JSONObject();
        event.put("type", "cancelled");
        event.put("tradeId", tradeId);
        event.put("symbol", symbol);
        return event;
    }

    private void pushEvent(JSONObject event) {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            JSONArray arr = new JSONArray(prefs.getString(QUEUE_KEY, "[]"));
            arr.put(event);
            prefs.edit().putString(QUEUE_KEY, arr.toString()).apply();
        } catch (Exception e) {
            Log.e(TAG, "pushEvent failed", e);
        }
    }

    // ── Market data ───────────────────────────────────────────────────────────

    private List<double[]> fetchKlines(String sym) throws Exception {
        JSONArray data = (JSONArray) requestRaw("GET", "/openApi/swap/v3/quote/klines", new String[][]{
            {"symbol", sym}, {"interval", "5m"}, {"limit", "150"}
        }, false).opt("data");

        List<double[]> out = new ArrayList<>();
        if (data == null) return out;
        for (int i = 0; i < data.length(); i++) {
            JSONObject k = data.optJSONObject(i);
            if (k == null) continue;
            out.add(new double[]{
                k.optDouble("time", 0), k.optDouble("open", 0), k.optDouble("high", 0),
                k.optDouble("low", 0), k.optDouble("close", 0), k.optDouble("volume", 0)
            });
        }
        java.util.Collections.sort(out, new Comparator<double[]>() {
            @Override
            public int compare(double[] a, double[] b) {
                return Double.compare(a[0], b[0]);
            }
        });
        return out;
    }

    private Double computePoc(List<double[]> candles) {
        int lookback = 120, bins = 24;
        int from = Math.max(0, candles.size() - lookback);
        List<double[]> sample = candles.subList(from, candles.size());
        if (sample.isEmpty()) return null;

        double lo = Double.MAX_VALUE, hi = -Double.MAX_VALUE;
        for (double[] c : sample) { lo = Math.min(lo, c[3]); hi = Math.max(hi, c[2]); }
        if (hi <= lo) return lo;

        double step = (hi - lo) / bins;
        double[] volumes = new double[bins];
        for (double[] c : sample) {
            int first = Math.max(0, Math.min(bins - 1, (int) Math.floor((c[3] - lo) / step)));
            int last = Math.max(0, Math.min(bins - 1, (int) Math.floor((c[2] - lo) / step)));
            int touched = last - first + 1;
            double share = c[5] / touched;
            for (int b = first; b <= last; b++) volumes[b] += share;
        }
        double maxVol = 0;
        int pocIndex = bins / 2;
        for (int i = 0; i < bins; i++) if (volumes[i] > maxVol) { maxVol = volumes[i]; pocIndex = i; }
        return lo + (pocIndex + 0.5) * step;
    }

    private double fetchMarkPrice(String sym, double fallback) {
        try {
            JSONObject data = requestJsonObject("GET", "/openApi/swap/v2/quote/price", new String[][]{{"symbol", sym}}, false);
            if (data == null) return fallback;
            double price = data.optDouble("price", 0);
            if (price <= 0) price = data.optDouble("markPrice", 0);
            return price > 0 ? price : fallback;
        } catch (Exception e) {
            return fallback;
        }
    }

    private double fetchBingxBalance() {
        try {
            JSONObject data = requestJsonObject("GET", "/openApi/swap/v2/user/balance", new String[][]{}, true);
            if (data == null) return 0;
            JSONObject b = data.optJSONObject("balance");
            if (b == null) b = data;
            return b.optDouble("balance", 0);
        } catch (Exception e) {
            return 0;
        }
    }

    private String placeLimitOrder(String sym, String side, String positionSide, double qty, double price, double sl, double tp1) {
        try {
            JSONObject slJson = new JSONObject();
            slJson.put("type", "STOP_MARKET");
            slJson.put("stopPrice", sl);
            slJson.put("workingType", "MARK_PRICE");
            JSONObject tpJson = new JSONObject();
            tpJson.put("type", "TAKE_PROFIT_MARKET");
            tpJson.put("stopPrice", tp1);
            tpJson.put("workingType", "MARK_PRICE");

            JSONObject data = requestJsonObject("POST", "/openApi/swap/v2/trade/order", new String[][]{
                {"symbol", sym}, {"side", side}, {"positionSide", positionSide}, {"type", "LIMIT"},
                {"quantity", String.valueOf(qty)}, {"price", String.valueOf(price)}, {"timeInForce", "PostOnly"},
                {"stopLoss", slJson.toString()}, {"takeProfit", tpJson.toString()}
            }, true);
            if (data == null) return null;
            JSONObject order = data.optJSONObject("order");
            if (order == null) order = data;
            String id = order.optString("orderId", null);
            return id;
        } catch (Exception e) {
            Log.e(TAG, "placeLimitOrder failed", e);
            return null;
        }
    }

    // ── DeepSeek ─────────────────────────────────────────────────────────────

    private JSONObject callDeepSeek(String systemPrompt, String userPrompt) {
        HttpURLConnection conn = null;
        try {
            JSONObject sysMsg = new JSONObject().put("role", "system").put("content", systemPrompt);
            JSONObject userMsg = new JSONObject().put("role", "user").put("content", userPrompt);
            JSONObject body = new JSONObject();
            body.put("model", "deepseek-chat");
            body.put("messages", new JSONArray().put(sysMsg).put(userMsg));
            body.put("response_format", new JSONObject().put("type", "json_object"));
            body.put("temperature", 0.35);

            URL url = new URL(DEEPSEEK_URL);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(20000);
            conn.setReadTimeout(20000);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Authorization", "Bearer " + deepseekKey);
            conn.setDoOutput(true);
            byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
            conn.getOutputStream().write(bytes);

            int code = conn.getResponseCode();
            InputStream is = (code >= 200 && code < 300) ? conn.getInputStream() : conn.getErrorStream();
            String respBody = is != null ? readStream(is) : "{}";
            if (code < 200 || code >= 300) {
                Log.e(TAG, "DeepSeek HTTP " + code + ": " + respBody);
                return null;
            }
            JSONObject result = new JSONObject(respBody);
            String content = result.getJSONArray("choices").getJSONObject(0)
                .getJSONObject("message").getString("content");
            return new JSONObject(content);
        } catch (Exception e) {
            Log.e(TAG, "callDeepSeek failed", e);
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private String buildSystemPrompt(String sym, String market, String lessonsText, String statsJsonText) {
        String learningBlock = "";
        try {
            JSONObject stats = new JSONObject(statsJsonText);
            if (stats.optInt("total", 0) > 0) {
                learningBlock = "\n=== LEARNING FROM YOUR OWN TRADE JOURNAL (self-updating every day) ===\n"
                    + "Track record so far: " + stats.optInt("total", 0) + " closed trades, win rate "
                    + String.format(Locale.US, "%.1f", stats.optDouble("winRate", 0)) + "%, net P/L "
                    + String.format(Locale.US, "%.2f", stats.optDouble("netPnlUSDT", 0)) + " USDT.\n"
                    + "Per-setup performance: " + stats.optJSONObject("bySetup") + ".\n"
                    + "Distilled lessons from the last retrospective: " + (lessonsText.isEmpty() ? "none yet" : lessonsText) + ".\n"
                    + "Weight setups that have historically won higher, and be stricter (raise your internal bar) on setups that have been losing.";
            }
        } catch (Exception ignored) { /* no stats yet */ }

        return "You are an adaptive " + sym + " (" + market + ") M5 scalping engine using Smart Money Concepts, trading with 20x leverage. You do not follow one rigid pattern — you first read the market regime, then apply the matching playbook, then score the setup. You trade whenever the score threshold is met, in ANY regime.\n" +
            "\n=== FORMAL DEFINITIONS ===\n" +
            "- AB = mean absolute candle body of the last 20 candles.\n" +
            "- ATR = average (high - low) of the last 14 candles. ALL distances below are ATR-relative — they auto-scale with volatility.\n" +
            "- Impulse = body >= 1.5 * AB. Swing = 5-candle fractal.\n" +
            "- BOS = close beyond last swing WITH trend. CHoCH = close beyond last swing AGAINST it.\n" +
            "- OB = last opposite candle before the impulse causing BOS/CHoCH (full range).\n" +
            "- FVG = 3-candle gap >= 0.4 * ATR. Filled once price trades through 50% of it.\n" +
            "- Sweep = wick beyond a swing that closes back inside within 1-2 candles.\n" +
            "\n=== STEP 1: CLASSIFY MARKET REGIME ===\n" +
            "- TREND (up/down): last two swings form HH+HL or LH+LL and price is making progress (net move of last 30 candles > 2 * ATR).\n" +
            "- RANGE: swings alternate inside a box; net move of last 30 candles < 2 * ATR.\n" +
            "- VOLATILE: any of last 3 candles has body > 3 * ATR (news shock / liquidation cascade).\n" +
            "\n=== STEP 2: APPLY THE MATCHING PLAYBOOK ===\n" +
            "TREND playbook:\n" +
            "- Trade continuation: pullbacks into OB/FVG in trend direction after BOS.\n" +
            "- Countertrend only after sweep + CHoCH.\n" +
            "- TP: next liquidity in trend direction.\n" +
            "RANGE playbook (do NOT wait out ranges — trade them):\n" +
            "- Fade the edges: LONG from lower third of the box, SHORT from upper third, best with a sweep of the box boundary.\n" +
            "- TP: POC or the opposite edge, whichever is closer.\n" +
            "- Never enter in the middle third of the box.\n" +
            "VOLATILE playbook:\n" +
            "- WAIT until 3 consecutive candles with body < 1.5 * AB before re-entering, unless a clear CHoCH already confirmed the new direction.\n" +
            "ANTI-FADE RULE (applies to ALL playbooks):\n" +
            "- NEVER SHORT while the last 3-4 candles are consecutive strong bullish bodies (> AB), and never LONG against the mirror case. An active impulse must first print a CHoCH or at least 2 corrective candles before you may trade against it.\n" +
            "\n=== STEP 3: SCORE THE SETUP (flexible, factors compensate each other) ===\n" +
            "+2  entry zone matches the active playbook (OB/FVG in trend; box edge in range)\n" +
            "+2  liquidity sweep into the zone\n" +
            "+2  fresh CHoCH/BOS confirms direction (within last 15 candles)\n" +
            "+1  POC confluence (zone within 0.8 * ATR of POC)\n" +
            "+1  unfilled FVG overlapping the entry zone\n" +
            "+1  rejection wick / impulse candle off the zone on the last 1-3 candles\n" +
            "+1  entry in the direction of the larger structure (last 60 candles)\n" +
            "-2  zone already mitigated before (stale)\n" +
            "-1  entry in the middle of the recent range (no man's land)\n" +
            "\nThreshold: trade at score >= 2 (leverage is 20x — a mediocre setup gets liquidated fast, be selective). Below threshold -> WAIT and state the score in \"reason\".\n" +
            learningBlock +
            "\n\n=== SL / TP (ATR-relative, self-adjusting) ===\n" +
            "- SL goes beyond the nearest LIQUIDITY POOL (recent swing extreme including wicks) plus 0.5 * ATR buffer. Never place SL just beyond the entry candle — that's the stop-hunt zone.\n" +
            "- SL distance: min 1 * ATR, max 3 * ATR (tight, because of 20x leverage).\n" +
            "- TP: nearest realistic target (liquidity / POC / box edge) whose distance is GREATER than the SL distance.\n" +
            "\n=== HARD SAFETY RULES (never bend these) ===\n" +
            "1. LONG: sl < entry < tp1. SHORT: tp1 < entry < sl.\n" +
            "2. SKIP every trade where |tp1 - entry| <= |entry - sl|. Pick a further TP or output WAIT.\n" +
            "3. entry within 1 * ATR of the last close.\n" +
            "\n=== OUTPUT ===\n" +
            "STRICTLY raw JSON, no fences, no text outside:\n" +
            "{\n" +
            "  \"type\": \"LONG\" | \"SHORT\" | \"WAIT\",\n" +
            "  \"entry\": <float>, \"sl\": <float>, \"tp1\": <float>,\n" +
            "  \"regime\": \"TREND_UP\" | \"TREND_DOWN\" | \"RANGE\" | \"VOLATILE\",\n" +
            "  \"score\": <int>,\n" +
            "  \"setup\": \"<setup name>\",\n" +
            "  \"reason\": \"<українською: режим ринку, зона, набрані бали по факторах, логіка SL/TP; для WAIT — скільки балів не вистачило>\",\n" +
            "  \"estimated_resistance\": <float>, \"estimated_support\": <float>\n" +
            "}\n" +
            "For WAIT: entry, sl, tp1 = 0.";
    }

    private String buildUserPrompt(String sym, List<double[]> candles, Double poc) {
        List<double[]> recent = candles.subList(Math.max(0, candles.size() - 80), candles.size());
        JSONArray arr = new JSONArray();
        for (double[] c : recent) {
            JSONObject o = new JSONObject();
            try {
                o.put("time", (long) c[0]).put("open", c[1]).put("high", c[2]).put("low", c[3]).put("close", c[4]).put("volume", c[5]);
            } catch (Exception ignored) { /* fields always valid */ }
            arr.put(o);
        }
        return "[MARKET DATA FEED - " + sym + " M5]\n" +
            "RAW OHLCV CANDLES (Last 80): " + arr + "\n" +
            "VOLUME PROFILE POINT OF CONTROL (POC): " + (poc != null ? poc : "Unknown") + "\n\n" +
            "Task: Classify the regime, apply the matching playbook, score the setup and decide LONG, SHORT or WAIT. Return the raw JSON object.";
    }

    // ── BingX signed REST (mirrors services/bingx.ts exactly) ────────────────

    private JSONObject requestJsonObject(String method, String path, String[][] params, boolean signed) throws Exception {
        JSONObject raw = requestRaw(method, path, params, signed);
        Object data = raw.opt("data");
        return data instanceof JSONObject ? (JSONObject) data : null;
    }

    private JSONArray requestJsonArray(String path, String[][] params) throws Exception {
        JSONObject raw = requestRaw("GET", path, params, true);
        Object data = raw.opt("data");
        return data instanceof JSONArray ? (JSONArray) data : new JSONArray();
    }

    private JSONObject requestRaw(String method, String path, String[][] params, boolean signed) throws Exception {
        List<String[]> all = new ArrayList<>();
        for (String[] kv : params) all.add(kv);
        if (signed) {
            all.add(new String[]{"timestamp", String.valueOf(System.currentTimeMillis())});
            all.add(new String[]{"recvWindow", "5000"});
        }
        java.util.Collections.sort(all, new Comparator<String[]>() {
            @Override
            public int compare(String[] a, String[] b) {
                return a[0].compareTo(b[0]);
            }
        });

        StringBuilder qs = new StringBuilder();
        for (String[] kv : all) {
            if (qs.length() > 0) qs.append('&');
            qs.append(kv[0]).append('=').append(URLEncoder.encode(kv[1], "UTF-8"));
        }

        String query = qs.toString();
        if (signed) {
            query += "&signature=" + hmacSha256Hex(apiSecret, query);
        }

        URL url = new URL(BASE_URL + path + "?" + query);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod(method);
        conn.setConnectTimeout(10000);
        conn.setReadTimeout(10000);
        if (signed) conn.setRequestProperty("X-BX-APIKEY", apiKey);

        try {
            int code = conn.getResponseCode();
            InputStream is = (code >= 200 && code < 300) ? conn.getInputStream() : conn.getErrorStream();
            String body = is != null ? readStream(is) : "{}";
            return new JSONObject(body);
        } finally {
            conn.disconnect();
        }
    }

    private String readStream(InputStream is) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) sb.append(line);
        reader.close();
        return sb.toString();
    }

    private String hmacSha256Hex(String secret, String message) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] hash = mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
        StringBuilder hex = new StringBuilder();
        for (byte b : hash) hex.append(String.format(Locale.US, "%02x", b & 0xFF));
        return hex.toString();
    }

    // ── Notifications ─────────────────────────────────────────────────────────

    private void createChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            NotificationChannel serviceChannel = new NotificationChannel(
                SERVICE_CHANNEL, "Бот у фоні", NotificationManager.IMPORTANCE_LOW);
            serviceChannel.setDescription("Сканування ринку й стеження за угодою, поки застосунок згорнутий");
            nm.createNotificationChannel(serviceChannel);

            NotificationChannel alertChannel = new NotificationChannel(
                ALERT_CHANNEL, "Результати угод", NotificationManager.IMPORTANCE_HIGH);
            alertChannel.setDescription("Сповіщення про вхід і закриття угоди");
            nm.createNotificationChannel(alertChannel);
        }
    }

    private Notification buildServiceNotification() {
        String text;
        if (mode == Mode.SCANNING) {
            text = "Шукаю сигнали серед " + symbols.size() + " пар" + (live ? "" : " (демо)");
        } else {
            text = symbol + (simulated ? " (демо)" : "") + (mode == Mode.WATCH_ORDER ? " — очікую виконання ордера" : " — стежу за угодою");
        }
        return new NotificationCompat.Builder(this, SERVICE_CHANNEL)
            .setContentTitle("Бот працює у фоні")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setOngoing(true)
            .setContentIntent(openAppIntent())
            .build();
    }

    private void updateServiceNotification() {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(SERVICE_NOTIF_ID, buildServiceNotification());
        } catch (Exception ignored) { /* not critical */ }
    }

    private void showOpenedNotification() {
        try {
            String demoTag = simulated ? " (демо)" : " (LIVE режим)";
            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, ALERT_CHANNEL)
                .setContentTitle("📡 Сигнал " + side + ": " + symbol)
                .setContentText("Угода відкрита" + demoTag)
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setAutoCancel(true)
                .setContentIntent(openAppIntent())
                .setPriority(NotificationCompat.PRIORITY_HIGH);
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.notify((int) (System.currentTimeMillis() % Integer.MAX_VALUE), builder.build());
        } catch (Exception e) {
            Log.e(TAG, "showOpenedNotification failed", e);
        }
    }

    private void showCloseNotification(JSONObject event) {
        try {
            double pnl = event.optDouble("pnlUSDT", 0);
            double pnlPct = event.optDouble("pnlPercent", 0);
            String outcome = event.optString("outcome", "BREAKEVEN");
            String sign = pnl >= 0 ? "+" : "";
            String demoTag = simulated ? " (демо)" : "";
            String title = "WIN".equals(outcome) ? ("✅ Угода в плюсі" + demoTag + ": " + symbol)
                : "LOSS".equals(outcome) ? ("🔻 Угода в мінусі" + demoTag + ": " + symbol)
                : ("➖ Угода в нулі" + demoTag + ": " + symbol);
            String body = side + " " + sign + String.format(Locale.US, "%.2f", pnl) + "$ ("
                + sign + String.format(Locale.US, "%.1f", pnlPct) + "%)";

            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, ALERT_CHANNEL)
                .setContentTitle(title)
                .setContentText(body)
                .setSmallIcon(android.R.drawable.stat_sys_download_done)
                .setAutoCancel(true)
                .setContentIntent(openAppIntent())
                .setPriority(NotificationCompat.PRIORITY_HIGH);

            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.notify((int) (System.currentTimeMillis() % Integer.MAX_VALUE), builder.build());
        } catch (Exception e) {
            Log.e(TAG, "showCloseNotification failed", e);
        }
    }

    private PendingIntent openAppIntent() {
        Intent launch = new Intent(this, MainActivity.class);
        launch.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
