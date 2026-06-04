package com.goldscalp.bot.indicators.trend

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Signal 5: MACD histogram direction (growing bullish / falling bearish) */
class MACDHistogramIndicator : BaseIndicator() {
    override val name = "MACD Histogram"
    override val isSignal = true

    override fun calculate(candles: List<Candle>): IndicatorVote {
        if (candles.size < 42) return vote(SignalDirection.NONE)
        val closes = candles.map { it.close }
        val ema12 = ema(closes, 12)
        val ema26 = ema(closes, 26)
        val offset = ema12.size - ema26.size
        val macdLine = ema26.indices.map { ema12[it + offset] - ema26[it] }
        if (macdLine.size < 9) return vote(SignalDirection.NONE)
        val signal = ema(macdLine, 9)
        if (signal.size < 3) return vote(SignalDirection.NONE)

        val histCurr = macdLine.last() - signal.last()
        val histPrev = macdLine[macdLine.size - 2] - signal[signal.size - 2]
        return when {
            histCurr > 0 && histCurr > histPrev -> vote(SignalDirection.LONG, histCurr, "Histogram growing bullish")
            histCurr < 0 && histCurr < histPrev -> vote(SignalDirection.SHORT, histCurr, "Histogram growing bearish")
            histCurr > 0 -> vote(SignalDirection.LONG, histCurr, "Histogram positive")
            histCurr < 0 -> vote(SignalDirection.SHORT, histCurr, "Histogram negative")
            else -> vote(SignalDirection.NONE)
        }
    }
}
