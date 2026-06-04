package com.goldscalp.bot.api

import android.util.Log
import com.goldscalp.bot.models.BotConfig
import com.goldscalp.bot.models.Candle
import com.google.gson.GsonBuilder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

class MT5ApiClient(private val config: BotConfig) {
    private val TAG = "MT5ApiClient"
    private var authToken: String? = null
    private var service: MT5ApiService? = null

    fun initialize(baseUrl: String) {
        val logging = HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC }
        val client = OkHttpClient.Builder()
            .addInterceptor(logging)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .build()

        val gson = GsonBuilder().setLenient().create()
        val retrofit = Retrofit.Builder()
            .baseUrl(if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/")
            .client(client)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()

        service = retrofit.create(MT5ApiService::class.java)
    }

    suspend fun authenticate(): Boolean = withContext(Dispatchers.IO) {
        try {
            val svc = service ?: return@withContext false
            val response = svc.login(MT5AuthRequest(config.mt5Login, config.mt5Password, config.mt5Server))
            if (response.isSuccessful) {
                authToken = response.body()?.token
                Log.i(TAG, "MT5 auth success, token=${authToken?.take(8)}...")
                authToken != null
            } else {
                Log.e(TAG, "Auth failed: ${response.code()} ${response.errorBody()?.string()}")
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Auth exception: ${e.message}")
            false
        }
    }

    suspend fun getCurrentPrice(symbol: String): Double? = withContext(Dispatchers.IO) {
        try {
            val token = bearerToken() ?: return@withContext null
            val response = service?.getQuote(symbol, token)
            if (response?.isSuccessful == true) {
                val quote = response.body()
                (quote?.ask!! + quote.bid) / 2.0
            } else null
        } catch (e: Exception) {
            Log.e(TAG, "GetPrice error: ${e.message}")
            null
        }
    }

    suspend fun getCandles(symbol: String, timeframe: String, count: Int): List<Candle>? =
        withContext(Dispatchers.IO) {
            try {
                val token = bearerToken() ?: return@withContext null
                val response = service?.getCandles(symbol, timeframe, count, token)
                if (response?.isSuccessful == true) {
                    response.body()?.candles?.map {
                        Candle(it.time, it.open, it.high, it.low, it.close, it.volume)
                    }
                } else null
            } catch (e: Exception) {
                Log.e(TAG, "GetCandles error: ${e.message}")
                null
            }
        }

    suspend fun openPosition(
        symbol: String, direction: String, volume: Double,
        stopLoss: Double, takeProfit: Double, comment: String
    ): Long? = withContext(Dispatchers.IO) {
        try {
            val token = bearerToken() ?: return@withContext null
            val response = service?.openOrder(
                MT5OrderRequest(symbol, direction, volume, 0.0, stopLoss, takeProfit, comment), token
            )
            if (response?.isSuccessful == true) {
                val ticket = response.body()?.ticket
                Log.i(TAG, "Opened position ticket=$ticket")
                ticket
            } else {
                Log.e(TAG, "OpenPosition failed: ${response?.errorBody()?.string()}")
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "OpenPosition exception: ${e.message}")
            null
        }
    }

    suspend fun modifyPosition(ticket: Long, stopLoss: Double, takeProfit: Double): Boolean =
        withContext(Dispatchers.IO) {
            try {
                val token = bearerToken() ?: return@withContext false
                val response = service?.modifyPosition(MT5ModifyRequest(ticket, stopLoss, takeProfit), token)
                response?.isSuccessful == true
            } catch (e: Exception) {
                Log.e(TAG, "ModifyPosition error: ${e.message}")
                false
            }
        }

    suspend fun closePosition(ticket: Long): Boolean = withContext(Dispatchers.IO) {
        try {
            val token = bearerToken() ?: return@withContext false
            val response = service?.closePosition(MT5CloseRequest(ticket), token)
            response?.isSuccessful == true
        } catch (e: Exception) {
            Log.e(TAG, "ClosePosition error: ${e.message}")
            false
        }
    }

    suspend fun getAccount(): MT5Account? = withContext(Dispatchers.IO) {
        try {
            val token = bearerToken() ?: return@withContext null
            val response = service?.getAccount(token)
            if (response?.isSuccessful == true) response.body() else null
        } catch (e: Exception) {
            null
        }
    }

    private suspend fun bearerToken(): String? {
        if (authToken == null) authenticate()
        return authToken?.let { "Bearer $it" }
    }

    fun isAuthenticated() = authToken != null
}
