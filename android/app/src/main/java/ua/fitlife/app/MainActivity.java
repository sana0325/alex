package ua.fitlife.app;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import org.json.JSONArray;
import org.json.JSONObject;
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
    private static final int PICK_MUSIC = 4242;

    private File musicDir() { File d = new File(getFilesDir(), "music"); if (!d.exists()) d.mkdirs(); return d; }

    private String nameOf(Uri uri) {
        String n = null;
        try (Cursor c = getContentResolver().query(uri, null, null, null, null)) {
            if (c != null && c.moveToFirst()) { int i = c.getColumnIndex(OpenableColumns.DISPLAY_NAME); if (i >= 0) n = c.getString(i); }
        } catch (Exception ignored) {}
        if (n == null) n = "track_" + System.currentTimeMillis() + ".mp3";
        return n.replaceAll("[^\\p{L}\\p{N}._ -]", "_");
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req != PICK_MUSIC || res != RESULT_OK || data == null) return;
        final java.util.List<Uri> uris = new java.util.ArrayList<>();
        if (data.getClipData() != null) for (int i = 0; i < data.getClipData().getItemCount(); i++) uris.add(data.getClipData().getItemAt(i).getUri());
        else if (data.getData() != null) uris.add(data.getData());
        new Thread(() -> {
            int ok = 0;
            for (Uri u : uris) {
                try (InputStream in = getContentResolver().openInputStream(u);
                     OutputStream out = new FileOutputStream(new File(musicDir(), nameOf(u)))) {
                    byte[] buf = new byte[65536]; int r;
                    while ((r = in.read(buf)) > 0) out.write(buf, 0, r);
                    ok++;
                } catch (Exception ignored) {}
            }
            final int added = ok;
            runOnUiThread(() -> web.evaluateJavascript("window.onMusicAdded&&window.onMusicAdded(" + added + ")", null));
        }).start();
    }

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
        s.setAllowFileAccessFromFileURLs(true);
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
        public void pickMusic() {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("audio/*");
                i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                try { startActivityForResult(i, PICK_MUSIC); }
                catch (Exception e) {
                    Intent g = new Intent(Intent.ACTION_GET_CONTENT); g.setType("audio/*"); g.addCategory(Intent.CATEGORY_OPENABLE);
                    startActivityForResult(Intent.createChooser(g, "Музика"), PICK_MUSIC);
                }
            });
        }
        @JavascriptInterface
        public String listMusic() {
            JSONArray a = new JSONArray();
            File[] fs = musicDir().listFiles();
            if (fs != null) {
                java.util.Arrays.sort(fs, (x, y) -> x.getName().compareToIgnoreCase(y.getName()));
                for (File f : fs) {
                    try { JSONObject o = new JSONObject(); o.put("name", f.getName()); o.put("url", Uri.fromFile(f).toString()); o.put("size", f.length()); a.put(o); }
                    catch (Exception ignored) {}
                }
            }
            return a.toString();
        }
        @JavascriptInterface
        public boolean deleteMusic(String name) {
            File f = new File(musicDir(), name);
            return f.getParentFile().equals(musicDir()) && f.delete();
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
