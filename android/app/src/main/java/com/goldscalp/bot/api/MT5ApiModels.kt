package com.goldscalp.bot.api

import com.google.gson.annotations.SerializedName

data class MT5AuthRequest(
    @SerializedName("login") val login: Long,
    @SerializedName("password") val password: String,
    @SerializedName("server") val server: String
)

data class MT5AuthResponse(
    @SerializedName("token") val token: String?,
    @SerializedName("error") val error: String?,
    @SerializedName("account") val account: MT5Account?
)

data class MT5Account(
    @SerializedName("login") val login: Long,
    @SerializedName("name") val name: String,
    @SerializedName("balance") val balance: Double,
    @SerializedName("equity") val equity: Double,
    @SerializedName("margin") val margin: Double,
    @SerializedName("freeMargin") val freeMargin: Double,
    @SerializedName("currency") val currency: String
)

data class MT5Quote(
    @SerializedName("symbol") val symbol: String,
    @SerializedName("bid") val bid: Double,
    @SerializedName("ask") val ask: Double,
    @SerializedName("time") val time: Long
)

data class MT5CandleResponse(
    @SerializedName("candles") val candles: List<MT5CandleData>?
)

data class MT5CandleData(
    @SerializedName("time") val time: Long,
    @SerializedName("open") val open: Double,
    @SerializedName("high") val high: Double,
    @SerializedName("low") val low: Double,
    @SerializedName("close") val close: Double,
    @SerializedName("volume") val volume: Double = 0.0
)

data class MT5OrderRequest(
    @SerializedName("symbol") val symbol: String,
    @SerializedName("type") val type: String,       // "BUY" or "SELL"
    @SerializedName("volume") val volume: Double,
    @SerializedName("price") val price: Double = 0.0, // 0 = market order
    @SerializedName("sl") val stopLoss: Double,
    @SerializedName("tp") val takeProfit: Double,
    @SerializedName("comment") val comment: String = "GoldScalpBot"
)

data class MT5OrderResponse(
    @SerializedName("ticket") val ticket: Long?,
    @SerializedName("error") val error: String?,
    @SerializedName("price") val price: Double?
)

data class MT5ModifyRequest(
    @SerializedName("ticket") val ticket: Long,
    @SerializedName("sl") val stopLoss: Double,
    @SerializedName("tp") val takeProfit: Double
)

data class MT5CloseRequest(
    @SerializedName("ticket") val ticket: Long,
    @SerializedName("volume") val volume: Double = 0.0 // 0 = close all
)

data class MT5PositionData(
    @SerializedName("ticket") val ticket: Long,
    @SerializedName("symbol") val symbol: String,
    @SerializedName("type") val type: String,
    @SerializedName("volume") val volume: Double,
    @SerializedName("openPrice") val openPrice: Double,
    @SerializedName("sl") val stopLoss: Double,
    @SerializedName("tp") val takeProfit: Double,
    @SerializedName("profit") val profit: Double,
    @SerializedName("openTime") val openTime: Long
)
