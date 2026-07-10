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
import java.util.List;
import java.util.Locale;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Watches ONE open BingX trade (or a still-resting limit order) natively,
 * completely independent of the Capacitor WebView — the WebView's JS timers
 * get throttled/paused by Android as soon as the app is backgrounded, but
 * this Service keeps its own thread and makes its own signed HTTP calls, so
 * the bot doesn't "fall asleep" the moment the screen locks.
 *
 * Only ever watches real (live) trades — paper/demo trades only exist inside
 * the JS simulation and have nothing on the exchange to poll.
 */
public class TradingWatchService extends Service {

    public static final String EXTRA_PAYLOAD = "payload";
    public static final String PREFS_NAME = "trading_watch_prefs";
    public static final String QUEUE_KEY = "closed_queue";

    private static final String TAG = "TradingWatchService";
    private static final String BASE_URL = "https://open-api.bingx.com";
    private static final String SERVICE_CHANNEL = "trading_watch_service";
    private static final String ALERT_CHANNEL = "trading_watch_alerts";
    private static final int SERVICE_NOTIF_ID = 5501;
    private static final long POLL_INTERVAL_MS = 12000;

    private Thread worker;
    private volatile boolean running = false;

    // Watched state. "mode" flips from "order" to "position" in-memory once a
    // resting limit order fills, no need to persist the transition anywhere —
    // the JS side independently re-discovers a fill via its own poll on resume.
    private String apiKey = "";
    private String apiSecret = "";
    private String mode = "position";
    private String symbol = "";
    private String side = "LONG";
    private String orderId = "";
    private String tradeId = "";
    private String setup = "";
    private String aiReason = "";
    private double entry;
    private double sl;
    private double tp1;
    private double stakeUSDT;
    private int leverage = 20;
    private long openedAt;

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createChannels();
        Notification notification = buildServiceNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(SERVICE_NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(SERVICE_NOTIF_ID, notification);
        }

        String payload = intent != null ? intent.getStringExtra(EXTRA_PAYLOAD) : null;
        if (payload != null) {
            try {
                JSONObject p = new JSONObject(payload);
                apiKey = p.optString("apiKey", "");
                apiSecret = p.optString("apiSecret", "");
                mode = p.optString("mode", "position");
                symbol = p.optString("symbol", "");
                side = p.optString("side", "LONG");
                orderId = p.optString("orderId", "");
                tradeId = p.optString("tradeId", "");
                entry = p.optDouble("entry", 0);
                sl = p.optDouble("sl", 0);
                tp1 = p.optDouble("tp1", 0);
                stakeUSDT = p.optDouble("stakeUSDT", 0);
                leverage = p.optInt("leverage", 20);
                setup = p.optString("setup", "");
                aiReason = p.optString("aiReason", "");
                openedAt = p.optLong("openedAt", System.currentTimeMillis());
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

    @Override
    public void onDestroy() {
        running = false;
        if (worker != null) worker.interrupt();
        super.onDestroy();
    }

    private void watchLoop() {
        while (running) {
            try {
                if ("order".equals(mode)) {
                    checkOrder();
                } else {
                    checkPosition();
                }
            } catch (Exception e) {
                Log.e(TAG, "watch loop tick failed, will retry", e);
            }
            if (!running) break;
            try {
                Thread.sleep(POLL_INTERVAL_MS);
            } catch (InterruptedException e) {
                break;
            }
        }
    }

    private void checkOrder() throws Exception {
        JSONObject data = requestJsonObject("/openApi/swap/v2/trade/order", new String[][]{
            {"symbol", symbol}, {"orderId", orderId}
        }, true);
        if (data == null) return;

        JSONObject order = data.optJSONObject("order");
        if (order == null) order = data;
        String status = order.optString("status", "NEW");

        if ("FILLED".equals(status)) {
            double avg = order.optDouble("avgPrice", entry);
            if (avg > 0) entry = avg;
            mode = "position"; // keep watching the resulting position, no need to stop
            showOpenedNotification();
        } else if ("CANCELLED".equals(status) || "REJECTED".equals(status) || "EXPIRED".equals(status)) {
            pushEvent(buildCancelledEvent());
            stopSelf();
        }
    }

    private void checkPosition() throws Exception {
        JSONArray positions = requestJsonArray("/openApi/swap/v2/user/positions", new String[][]{
            {"symbol", symbol}
        });
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
        if (!stillOpen) {
            double exit = fetchMarkPrice();
            JSONObject event = buildClosedEvent(exit);
            pushEvent(event);
            showCloseNotification(event);
            stopSelf();
        }
    }

    private double fetchMarkPrice() {
        try {
            JSONObject data = requestJsonObject("/openApi/swap/v2/quote/price", new String[][]{{"symbol", symbol}}, false);
            if (data == null) return entry;
            double price = data.optDouble("price", 0);
            if (price <= 0) price = data.optDouble("markPrice", entry);
            return price > 0 ? price : entry;
        } catch (Exception e) {
            return entry;
        }
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

    // ── BingX signed REST (mirrors services/bingx.ts exactly) ────────────────

    private JSONObject requestJsonObject(String path, String[][] params, boolean signed) throws Exception {
        JSONObject raw = requestRaw(path, params, signed);
        Object data = raw.opt("data");
        return data instanceof JSONObject ? (JSONObject) data : null;
    }

    private JSONArray requestJsonArray(String path, String[][] params) throws Exception {
        JSONObject raw = requestRaw(path, params, true);
        Object data = raw.opt("data");
        return data instanceof JSONArray ? (JSONArray) data : new JSONArray();
    }

    private JSONObject requestRaw(String path, String[][] params, boolean signed) throws Exception {
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
        conn.setRequestMethod("GET");
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
            serviceChannel.setDescription("Стеження за відкритою угодою, поки застосунок згорнутий");
            nm.createNotificationChannel(serviceChannel);

            NotificationChannel alertChannel = new NotificationChannel(
                ALERT_CHANNEL, "Результати угод", NotificationManager.IMPORTANCE_HIGH);
            alertChannel.setDescription("Сповіщення про закриття угоди");
            nm.createNotificationChannel(alertChannel);
        }
    }

    private Notification buildServiceNotification() {
        return new NotificationCompat.Builder(this, SERVICE_CHANNEL)
            .setContentTitle("Бот стежить за угодою")
            .setContentText(symbol != null && !symbol.isEmpty() ? symbol : "Відкрита позиція на BingX")
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setOngoing(true)
            .setContentIntent(openAppIntent())
            .build();
    }

    private void showOpenedNotification() {
        try {
            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, ALERT_CHANNEL)
                .setContentTitle("📡 Сигнал " + side + ": " + symbol)
                .setContentText("Угода відкрита (LIVE режим)")
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
            String title = "WIN".equals(outcome) ? ("✅ Угода в плюсі: " + symbol)
                : "LOSS".equals(outcome) ? ("🔻 Угода в мінусі: " + symbol)
                : ("➖ Угода в нулі: " + symbol);
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
