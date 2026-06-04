package com.goldscalp.bot.indicators.trend

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Signal 8: Price position relative to Ichimoku cloud (Kumo) */
class IchimokuCloudIndicator : BaseIndicator() {
    override val name = "Ichimoku Cloud"
    override val isSignal = true

    override fun calculate(candles: List<Candle>): IndicatorVote {
        if (candles.size < 78) return vote(SignalDirection.NONE)
        val price = candles.last().close

        val tenkan = donchianMid(candles, 9)
        val kijun = donchianMid(candles, 26)
        if (tenkan == null || kijun == null) return vote(SignalDirection.NONE)

        // Senkou Span A = (Tenkan + Kijun) / 2 shifted 26 periods forward
        val senkouA = (tenkan + kijun) / 2.0
        // Senkou Span B = 52-period donchian midpoint shifted 26 forward
        val senkouB = donchianMid(candles, 52) ?: return vote(SignalDirection.NONE)

        val cloudTop = maxOf(senkouA, senkouB)
        val cloudBottom = minOf(senkouA, senkouB)

        return when {
            price > cloudTop -> vote(SignalDirection.LONG, price - cloudTop, "Price above Kumo cloud")
            price < cloudBottom -> vote(SignalDirection.SHORT, cloudBottom - price, "Price below Kumo cloud")
            else -> vote(SignalDirection.NONE, 0.0, "Price inside cloud — neutral")
        }
    }

    private fun donchianMid(candles: List<Candle>, period: Int): Double? {
        if (candles.size < period) return null
        val slice = candles.takeLast(period)
        return (slice.maxOf { it.high } + slice.minOf { it.low }) / 2.0
    }
}
