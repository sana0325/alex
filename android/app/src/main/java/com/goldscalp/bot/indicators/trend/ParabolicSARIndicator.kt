package com.goldscalp.bot.indicators.trend

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Signal 6: Parabolic SAR above/below price */
class ParabolicSARIndicator(
    private val step: Double = 0.02,
    private val maxStep: Double = 0.2
) : BaseIndicator() {
    override val name = "Parabolic SAR"
    override val isSignal = true

    override fun calculate(candles: List<Candle>): IndicatorVote {
        if (candles.size < 10) return vote(SignalDirection.NONE)

        var isLong = candles[1].close > candles[0].close
        var af = step
        var ep = if (isLong) candles[0].high else candles[0].low
        var sar = if (isLong) candles[0].low else candles[0].high

        for (i in 1 until candles.size - 1) {
            val c = candles[i]
            sar = sar + af * (ep - sar)
            if (isLong) {
                sar = minOf(sar, candles[i - 1].low, if (i > 1) candles[i - 2].low else c.low)
                if (c.high > ep) { ep = c.high; af = minOf(af + step, maxStep) }
                if (c.low < sar) { isLong = false; sar = ep; ep = c.low; af = step }
            } else {
                sar = maxOf(sar, candles[i - 1].high, if (i > 1) candles[i - 2].high else c.high)
                if (c.low < ep) { ep = c.low; af = minOf(af + step, maxStep) }
                if (c.high > sar) { isLong = true; sar = ep; ep = c.high; af = step }
            }
        }

        val price = candles.last().close
        return when {
            isLong && sar < price -> vote(SignalDirection.LONG, price - sar, "SAR(${"%.2f".format(sar)}) below price — bullish")
            !isLong && sar > price -> vote(SignalDirection.SHORT, price - sar, "SAR(${"%.2f".format(sar)}) above price — bearish")
            else -> vote(SignalDirection.NONE)
        }
    }
}
