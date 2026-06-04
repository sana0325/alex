package com.goldscalp.bot.models

data class Candle(
    val time: Long,
    val open: Double,
    val high: Double,
    val low: Double,
    val close: Double,
    val volume: Double = 0.0
) {
    val isbullish: Boolean get() = close > open
    val body: Double get() = Math.abs(close - open)
    val range: Double get() = high - low
    val midpoint: Double get() = (high + low) / 2.0
}
