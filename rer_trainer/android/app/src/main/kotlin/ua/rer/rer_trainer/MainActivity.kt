package ua.rer.rer_trainer

import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.util.Locale
import java.util.UUID

/**
 * Озвучка відеоуроків через системний синтез мови Android (офлайн).
 * Канал "rer/tts": init → чи є український голос, speak → завершується,
 * коли фразу дочитано, stop → зупинити.
 */
class MainActivity : FlutterActivity() {
    private var tts: TextToSpeech? = null
    private val pending = HashMap<String, MethodChannel.Result>()

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "rer/tts").setMethodCallHandler { call, result ->
            when (call.method) {
                "init" -> init(result)
                "speak" -> speak(call.argument<String>("text") ?: "", result)
                "stop" -> {
                    tts?.stop()
                    finishAll()
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }
    }

    private fun init(result: MethodChannel.Result) {
        var replied = false
        try {
            tts?.shutdown()
            tts = TextToSpeech(this) { status ->
                if (replied) return@TextToSpeech
                replied = true
                val engine = tts
                if (status != TextToSpeech.SUCCESS || engine == null) {
                    result.success(false)
                    return@TextToSpeech
                }
                val lang = engine.setLanguage(Locale("uk", "UA"))
                engine.setSpeechRate(0.95f)
                engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(id: String?) {}
                    override fun onDone(id: String?) = finish(id)
                    @Deprecated("Deprecated in Java")
                    override fun onError(id: String?) = finish(id)
                    override fun onError(id: String?, errorCode: Int) = finish(id)
                })
                result.success(lang != TextToSpeech.LANG_MISSING_DATA && lang != TextToSpeech.LANG_NOT_SUPPORTED)
            }
        } catch (e: Exception) {
            if (!replied) {
                replied = true
                result.success(false)
            }
        }
    }

    private fun speak(text: String, result: MethodChannel.Result) {
        val engine = tts
        if (engine == null) {
            result.success(null)
            return
        }
        val id = UUID.randomUUID().toString()
        synchronized(pending) { pending[id] = result }
        if (engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, id) != TextToSpeech.SUCCESS) finish(id)
    }

    private fun finish(id: String?) {
        val r = synchronized(pending) { pending.remove(id) } ?: return
        runOnUiThread { r.success(null) }
    }

    private fun finishAll() {
        val all = synchronized(pending) { pending.values.toList().also { pending.clear() } }
        all.forEach { it.success(null) }
    }

    override fun onDestroy() {
        finishAll()
        tts?.shutdown()
        tts = null
        super.onDestroy()
    }
}
