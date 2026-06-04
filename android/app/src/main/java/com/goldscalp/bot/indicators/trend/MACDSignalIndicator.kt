package com.goldscalp.bot.indicators.trend

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Signal 4: MACD line cross above/below signal line */
class MACDSignalIndicator : BaseIndicator() {
    override val name = "MACD Signal Cross"
    override val isSignal = true

    override fun calculate(candles: List<Candle>): IndicatorVote {
        if (candles.size < 40) return vote(SignalDirection.NONE)
        val closes = candles.map { it.close }
        val ema12 = ema(closes, 12)
        val ema26 = ema(closes, 26)
        val offset = ema12.size - ema26.size
        val macdLine = ema26.indices.map { ema12[it + offset] - ema26[it] }
        if (macdLine.size < 9) return vote(SignalDirection.NONE)
        val signal = ema(macdLine, 9)
        if (signal.size < 2) return vote(SignalDirection.NONE)

        val macdVal = macdLine.last()
        val signalVal = signal.last()
        val diff = macdVal - signalVal
        return when {
            diff > 0 -> vote(SignalDirection.LONG, diff, "MACD(${"%.4f".format(macdVal)}) > Signal(${"%.4f".format(signalVal)})")
            diff < 0 -> vote(SignalDirection.SHORT, diff, "MACD below Signal")
            else -> vote(SignalDirection.NONE)
        }
    }
}
