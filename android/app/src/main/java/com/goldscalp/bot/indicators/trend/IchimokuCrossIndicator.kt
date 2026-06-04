package com.goldscalp.bot.indicators.trend

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Signal 7: Ichimoku Tenkan-sen / Kijun-sen cross (TK cross) */
class IchimokuCrossIndicator : BaseIndicator() {
    override val name = "Ichimoku TK Cross"
    override val isSignal = true

    override fun calculate(candles: List<Candle>): IndicatorVote {
        if (candles.size < 52) return vote(SignalDirection.NONE)
        val tenkan = donchianMid(candles, 9)
        val kijun = donchianMid(candles, 26)
        if (tenkan == null || kijun == null) return vote(SignalDirection.NONE)

        return when {
            tenkan > kijun -> vote(SignalDirection.LONG, tenkan - kijun, "Tenkan(${"%.2f".format(tenkan)}) > Kijun(${"%.2f".format(kijun)})")
            tenkan < kijun -> vote(SignalDirection.SHORT, tenkan - kijun, "Tenkan < Kijun — bearish")
            else -> vote(SignalDirection.NONE)
        }
    }

    private fun donchianMid(candles: List<Candle>, period: Int): Double? {
        if (candles.size < period) return null
        val slice = candles.takeLast(period)
        return (slice.maxOf { it.high } + slice.minOf { it.low }) / 2.0
    }
}
