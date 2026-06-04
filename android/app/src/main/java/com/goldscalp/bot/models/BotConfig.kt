package com.goldscalp.bot.models

data class BotConfig(
    // MT5 connection
    val mt5Server: String = "",
    val mt5Login: Long = 0,
    val mt5Password: String = "",
    val brokerApiUrl: String = "",
    val brokerApiKey: String = "",

    // Trading params
    val symbol: String = "XAUUSD",
    val timeframe: String = "M5",
    val lotSize: Double = 0.01,
    val maxPositions: Int = 1,
    val maxDailyLoss: Double = 50.0,
    val maxDailyProfit: Double = 150.0,

    // Signal thresholds (out of 26 signal indicators)
    val longThreshold: Int = 15,
    val shortThreshold: Int = 15,

    // Risk management
    val slMultiplier: Double = 1.5,    // Stop Loss = ATR * slMultiplier
    val tpMultiplier: Double = 2.5,    // Take Profit = ATR * tpMultiplier
    val trailingActivation: Double = 1.5, // Activate trailing at ATR * this
    val trailingStep: Double = 0.8,    // Trail by ATR * this

    // Session filter (UTC hours)
    val sessionStartHour: Int = 7,
    val sessionEndHour: Int = 20,

    // Filters
    val minAdx: Double = 20.0,
    val minVolatilityPips: Double = 5.0,

    // Bot state
    val isActive: Boolean = false,
    val autoRestart: Boolean = true
)
