package com.goldscalp.bot.indicators.volume

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Signal 23: Donchian Channel(20) position */
class DonchianChannelIndicator(private val period: Int = 20) : BaseIndicator() {
    override val name = "Donchian($period)"
    override val isSignal = true

    override fun calculate(candles: List<Candle>): IndicatorVote {
        if (candles.size < period) return vote(SignalDirection.NONE)
        val slice = candles.takeLast(period)
        val upper = slice.maxOf { it.high }
        val lower = slice.minOf { it.low }
        val mid = (upper + lower) / 2.0
        val price = candles.last().close

        return when {
            price > mid + (upper - mid) * 0.3 -> vote(SignalDirection.LONG, price - mid, "Price in upper Donchian zone")
            price < mid - (mid - lower) * 0.3 -> vote(SignalDirection.SHORT, price - mid, "Price in lower Donchian zone")
            else -> vote(SignalDirection.NONE, price - mid)
        }
    }
}
