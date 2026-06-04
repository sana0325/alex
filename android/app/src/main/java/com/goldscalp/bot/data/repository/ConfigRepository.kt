package com.goldscalp.bot.data.repository

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.goldscalp.bot.models.BotConfig
import com.google.gson.Gson

object ConfigRepository {
    private const val PREFS_FILE = "gold_scalp_secure_prefs"
    private const val KEY_CONFIG = "bot_config"
    private val gson = Gson()

    private fun getPrefs(context: Context): SharedPreferences {
        return try {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()
            EncryptedSharedPreferences.create(
                context, PREFS_FILE, masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            context.getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE)
        }
    }

    fun saveConfig(context: Context, config: BotConfig) {
        getPrefs(context).edit().putString(KEY_CONFIG, gson.toJson(config)).apply()
    }

    fun getConfig(context: Context): BotConfig? {
        val json = getPrefs(context).getString(KEY_CONFIG, null) ?: return null
        return try { gson.fromJson(json, BotConfig::class.java) } catch (e: Exception) { null }
    }

    fun getOrDefault(context: Context) = getConfig(context) ?: BotConfig()
}
