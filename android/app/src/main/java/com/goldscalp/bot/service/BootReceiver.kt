package com.goldscalp.bot.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.goldscalp.bot.data.repository.ConfigRepository

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            val config = ConfigRepository.getConfig(context) ?: return
            if (config.autoRestart && config.isActive) {
                val serviceIntent = Intent(context, TradingService::class.java).apply {
                    action = TradingService.ACTION_START
                }
                context.startForegroundService(serviceIntent)
            }
        }
    }
}
