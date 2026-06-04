package com.goldscalp.bot.indicators.momentum

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Signal 11: Stochastic %K cross above/below %D */
class StochasticIndicator(
    private val kPeriod: Int = 14,
    private val dPeriod: Int = 3,
    private val smooth: Int = 3
) : BaseIndicator() {
    override val name = "Stochastic %K/%D"
    override val isSignal = true

    override fun calculate(candles: List<Candle>): IndicatorVote {
        if (candles.size < kPeriod + dPeriod + smooth) return vote(SignalDirection.NONE)

        val rawK = candles.indices.drop(kPeriod - 1).map { i ->
            val slice = candles.subList(i - kPeriod + 1, i + 1)
            val highest = slice.maxOf { it.high }
            val lowest = slice.minOf { it.low }
            if (highest == lowest) 50.0
            else (candles[i].close - lowest) / (highest - lowest) * 100.0
        }
        val kSmooth = sma(rawK, smooth)
        val d = sma(kSmooth, dPeriod)
        if (kSmooth.isEmpty() || d.isEmpty()) return vote(SignalDirection.NONE)

        val k = kSmooth.last()
        val dVal = d.last()
        return when {
            k > dVal && k < 80 -> vote(SignalDirection.LONG, k - dVal, "%K(${"%.1f".format(k)}) > %D — bullish")
            k < dVal && k > 20 -> vote(SignalDirection.SHORT, k - dVal, "%K < %D — bearish")
            k > dVal && k >= 80 -> vote(SignalDirection.SHORT, k, "Stochastic overbought")
            k < dVal && k <= 20 -> vote(SignalDirection.LONG, k, "Stochastic oversold")
            else -> vote(SignalDirection.NONE)
        }
    }
}
