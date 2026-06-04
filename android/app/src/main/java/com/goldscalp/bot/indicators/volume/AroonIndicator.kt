package com.goldscalp.bot.indicators.volume

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Signal 22: Aroon Oscillator(25) */
class AroonIndicator(private val period: Int = 25) : BaseIndicator() {
    override val name = "Aroon($period)"
    override val isSignal = true

    override fun calculate(candles: List<Candle>): IndicatorVote {
        if (candles.size < period + 1) return vote(SignalDirection.NONE)
        val slice = candles.takeLast(period + 1)

        val highs = slice.map { it.high }
        val lows = slice.map { it.low }
        val periodsSinceHigh = period - highs.indices.maxByOrNull { highs[it] }!!
        val periodsSinceLow = period - lows.indices.minByOrNull { lows[it] }!!

        val aroonUp = ((period - periodsSinceHigh).toDouble() / period) * 100.0
        val aroonDown = ((period - periodsSinceLow).toDouble() / period) * 100.0
        val oscillator = aroonUp - aroonDown

        return when {
            oscillator > 30 -> vote(SignalDirection.LONG, oscillator, "Aroon=${"%.1f".format(oscillator)} bullish")
            oscillator < -30 -> vote(SignalDirection.SHORT, oscillator, "Aroon=${"%.1f".format(oscillator)} bearish")
            else -> vote(SignalDirection.NONE, oscillator)
        }
    }
}
