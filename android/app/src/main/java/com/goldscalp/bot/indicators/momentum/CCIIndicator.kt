package com.goldscalp.bot.indicators.momentum

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Signal 12: CCI(20) above/below zero line */
class CCIIndicator(private val period: Int = 20) : BaseIndicator() {
    override val name = "CCI($period)"
    override val isSignal = true

    override fun calculate(candles: List<Candle>): IndicatorVote {
        if (candles.size < period) return vote(SignalDirection.NONE)
        val slice = candles.takeLast(period)
        val tp = slice.map { (it.high + it.low + it.close) / 3.0 }
        val tpMean = tp.average()
        val meanDev = tp.map { Math.abs(it - tpMean) }.average()
        if (meanDev == 0.0) return vote(SignalDirection.NONE)
        val cci = (tp.last() - tpMean) / (0.015 * meanDev)

        return when {
            cci > 100 -> vote(SignalDirection.LONG, cci, "CCI=${"%.1f".format(cci)} overbought momentum")
            cci > 0 -> vote(SignalDirection.LONG, cci, "CCI=${"%.1f".format(cci)} positive")
            cci < -100 -> vote(SignalDirection.SHORT, cci, "CCI=${"%.1f".format(cci)} oversold momentum")
            cci < 0 -> vote(SignalDirection.SHORT, cci, "CCI negative")
            else -> vote(SignalDirection.NONE)
        }
    }
}
