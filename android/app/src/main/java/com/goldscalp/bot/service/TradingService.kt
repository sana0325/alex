package com.goldscalp.bot.service

import android.app.*
import android.content.Intent
import android.os.Binder
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.lifecycle.LifecycleService
import com.goldscalp.bot.R
import com.goldscalp.bot.api.MT5ApiClient
import com.goldscalp.bot.data.repository.ConfigRepository
import com.goldscalp.bot.engine.BotState
import com.goldscalp.bot.engine.BotStatus
import com.goldscalp.bot.engine.TradingEngine
import com.goldscalp.bot.models.BotConfig
import com.goldscalp.bot.ui.MainActivity
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.collectLatest

class TradingService : LifecycleService() {

    private val CHANNEL_ID = "gold_scalp_trading"
    private val NOTIFICATION_ID = 1001

    private var engine: TradingEngine? = null
    private var apiClient: MT5ApiClient? = null
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    inner class LocalBinder : Binder() {
        fun getService() = this@TradingService
    }

    private val binder = LocalBinder()

    override fun onBind(intent: Intent): IBinder {
        super.onBind(intent)
        return binder
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        when (intent?.action) {
            ACTION_START -> startTrading()
            ACTION_STOP -> stopTrading()
            ACTION_PAUSE -> engine?.pause()
            ACTION_RESUME -> engine?.resume()
        }
        return START_STICKY
    }

    private fun startTrading() {
        val config = ConfigRepository.getConfig(this) ?: return
        apiClient = MT5ApiClient(config).also {
            it.initialize(config.brokerApiUrl)
        }
        engine = TradingEngine(config, apiClient!!).also { eng ->
            scope.launch {
                eng.state.collectLatest { state ->
                    updateNotification(state)
                }
            }
            eng.start()
        }
        startForeground(NOTIFICATION_ID, buildNotification("Bot starting..."))
    }

    private fun stopTrading() {
        engine?.stop()
        engine?.destroy()
        engine = null
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    fun getEngine() = engine
    fun getApiClient() = apiClient

    private fun updateNotification(state: BotState) {
        val statusText = when (state.status) {
            BotStatus.RUNNING -> {
                val pos = if (state.openPosition != null)
                    "📊 ${state.openPosition.direction} @ ${"%.2f".format(state.openPosition.openPrice)}"
                else "Watching market..."
                val pnl = if (state.dailyPnL >= 0) "+${"%.2f".format(state.dailyPnL)}"
                else "${"%.2f".format(state.dailyPnL)}"
                "▶ Running | PnL: $pnl | $pos"
            }
            BotStatus.PAUSED -> "⏸ Paused | Trades: ${state.todayTrades}"
            BotStatus.ERROR -> "⚠ Error: ${state.lastError?.take(30)}"
            BotStatus.IDLE -> "⏹ Idle"
        }
        val notificationManager = getSystemService(NotificationManager::class.java)
        notificationManager?.notify(NOTIFICATION_ID, buildNotification(statusText))
    }

    private fun buildNotification(text: String): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pi = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE)

        val stopIntent = Intent(this, TradingService::class.java).apply { action = ACTION_STOP }
        val stopPi = PendingIntent.getService(this, 1, stopIntent, PendingIntent.FLAG_IMMUTABLE)

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Gold Scalp Bot — XAUUSD")
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_bot_notification)
            .setContentIntent(pi)
            .setOngoing(true)
            .addAction(R.drawable.ic_stop, "Stop", stopPi)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID, "Gold Scalp Bot Trading",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Background trading notifications"
        }
        getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
    }

    override fun onDestroy() {
        scope.cancel()
        engine?.destroy()
        super.onDestroy()
    }

    companion object {
        const val ACTION_START = "com.goldscalp.bot.ACTION_START"
        const val ACTION_STOP = "com.goldscalp.bot.ACTION_STOP"
        const val ACTION_PAUSE = "com.goldscalp.bot.ACTION_PAUSE"
        const val ACTION_RESUME = "com.goldscalp.bot.ACTION_RESUME"
    }
}
