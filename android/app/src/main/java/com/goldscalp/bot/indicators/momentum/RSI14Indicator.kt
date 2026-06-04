package com.goldscalp.bot.indicators.momentum

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Signal 9: RSI(14) above/below 50 midline */
class RSI14Indicator : BaseIndicator() {
    override val name = "RSI(14) Midline"
    override val isSignal = true

    override fun calculate(candles: List<Candle>): IndicatorVote {
        val rsi = calcRsi(candles, 14) ?: return vote(SignalDirection.NONE)
        return when {
            rsi > 55 -> vote(SignalDirection.LONG, rsi, "RSI14=${"%.1f".format(rsi)} > 55")
            rsi < 45 -> vote(SignalDirection.SHORT, rsi, "RSI14=${"%.1f".format(rsi)} < 45")
            else -> vote(SignalDirection.NONE, rsi, "RSI14 neutral")
        }
    }

    companion object {
        fun calcRsi(candles: List<Candle>, period: Int): Double? {
            if (candles.size < period + 2) return null
            val closes = candles.map { it.close }
            val changes = (1 until closes.size).map { closes[it] - closes[it - 1] }
            var avgGain = changes.takeLast(period + 1).take(period).filter { it > 0 }.let {
                if (it.isEmpty()) 0.0 else it.average()
            }
            var avgLoss = changes.takeLast(period + 1).take(period).filter { it < 0 }.let {
                if (it.isEmpty()) 0.0 else Math.abs(it.average())
            }
            val lastChange = changes.last()
            avgGain = (avgGain * (period - 1) + maxOf(lastChange, 0.0)) / period
            avgLoss = (avgLoss * (period - 1) + Math.abs(minOf(lastChange, 0.0))) / period
            if (avgLoss == 0.0) return 100.0
            val rs = avgGain / avgLoss
            return 100.0 - (100.0 / (1.0 + rs))
        }
    }
}
