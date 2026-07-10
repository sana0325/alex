package com.goldscalp.signals;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Thin bridge to TradingWatchService. Everything is passed/returned as a
 * single JSON string ("payload" / "eventsJson") to keep the JS<->native
 * surface tiny and avoid relying on less-common PluginCall getters.
 */
@CapacitorPlugin(name = "TradingWatch")
public class TradingServicePlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        String payload = call.getString("payload", "{}");
        Context ctx = getContext();
        Intent intent = new Intent(ctx, TradingWatchService.class);
        intent.putExtra(TradingWatchService.EXTRA_PAYLOAD, payload);
        ContextCompat.startForegroundService(ctx, intent);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Context ctx = getContext();
        ctx.stopService(new Intent(ctx, TradingWatchService.class));
        call.resolve();
    }

    @PluginMethod
    public void pollClosedEvents(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(TradingWatchService.PREFS_NAME, Context.MODE_PRIVATE);
        String json = prefs.getString(TradingWatchService.QUEUE_KEY, "[]");
        prefs.edit().remove(TradingWatchService.QUEUE_KEY).apply();

        JSObject ret = new JSObject();
        ret.put("eventsJson", json);
        call.resolve(ret);
    }
}
