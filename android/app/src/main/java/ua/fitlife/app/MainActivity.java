package ua.fitlife.app;

import android.app.Activity;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.util.Locale;

public class MainActivity extends Activity {
    private WebView web;
    private TextToSpeech tts;
    private boolean ttsReady = false;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        web = new WebView(this);
        web.setBackgroundColor(0xFF07070C);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setTextZoom(100);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        setContentView(web);

        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int r = tts.setLanguage(new Locale("uk", "UA"));
                if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) {
                    tts.setLanguage(new Locale("uk"));
                }
                ttsReady = true;
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String id) {}
                    @Override public void onDone(String id) { done(id); }
                    @Override public void onError(String id) { done(id); }
                    @Override public void onStop(String id, boolean interrupted) { done(id); }
                });
            }
        });
        web.loadUrl("file:///android_asset/www/index.html");
    }

    private void done(final String id) {
        runOnUiThread(() -> web.evaluateJavascript("window.__ttsDone&&window.__ttsDone('" + id.replace("'", "") + "')", null));
    }

    class Bridge {
        @JavascriptInterface
        public void speak(String text, String id, float rate, float pitch) {
            if (!ttsReady) { done(id); return; }
            tts.setSpeechRate(rate);
            tts.setPitch(pitch);
            if (tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, id) != TextToSpeech.SUCCESS) done(id);
        }
        @JavascriptInterface
        public void stopSpeak() { if (tts != null) tts.stop(); }
        @JavascriptInterface
        public boolean hasUkrainian() {
            if (!ttsReady) return false;
            int r = tts.isLanguageAvailable(new Locale("uk", "UA"));
            return r >= TextToSpeech.LANG_AVAILABLE;
        }
        @JavascriptInterface
        public void keepAwake(final boolean on) {
            runOnUiThread(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.appBack&&window.appBack())?'1':'0'", v -> {
            if (v == null || !v.contains("1")) MainActivity.super.onBackPressed();
        });
    }

    @Override protected void onPause() { super.onPause(); web.evaluateJavascript("window.appPause&&window.appPause()", null); }
    @Override protected void onResume() { super.onResume(); web.evaluateJavascript("(typeof Audio2!=='undefined')&&Audio2.init()", null); }
    @Override protected void onDestroy() { if (tts != null) { tts.stop(); tts.shutdown(); } web.destroy(); super.onDestroy(); }
}
