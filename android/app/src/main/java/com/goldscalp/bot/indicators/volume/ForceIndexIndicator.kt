package com.goldscalp.bot.indicators.volume

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Signal 21: Force Index(13) — Elder's force index */
class ForceIndexIndicator(private val period: Int = 13) : BaseIndicator() {
    override val name = "Force Index($period)"
    override val isSignal = true

    override fun calculate(candles: List<Candle>): IndicatorVote {
        if (candles.size < period + 2) return vote(SignalDirection.NONE)

        val rawFI = (1 until candles.size).map { i ->
            (candles[i].close - candles[i - 1].close) * candles[i].volume
        }
        val smoothed = ema(rawFI, period)
        if (smoothed.isEmpty()) return vote(SignalDirection.NONE)
        val fi = smoothed.last()

        return when {
            fi > 0 -> vote(SignalDirection.LONG, fi, "Force Index positive — buying pressure")
            fi < 0 -> vote(SignalDirection.SHORT, fi, "Force Index negative — selling pressure")
            else -> vote(SignalDirection.NONE)
        }
    }
}
