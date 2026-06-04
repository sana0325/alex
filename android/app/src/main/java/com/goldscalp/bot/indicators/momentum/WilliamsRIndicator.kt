package com.goldscalp.bot.indicators.momentum

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Signal 13: Williams %R(14) — momentum oscillator */
class WilliamsRIndicator(private val period: Int = 14) : BaseIndicator() {
    override val name = "Williams %R($period)"
    override val isSignal = true

    override fun calculate(candles: List<Candle>): IndicatorVote {
        if (candles.size < period) return vote(SignalDirection.NONE)
        val slice = candles.takeLast(period)
        val highest = slice.maxOf { it.high }
        val lowest = slice.minOf { it.low }
        if (highest == lowest) return vote(SignalDirection.NONE)
        val wr = ((highest - slice.last().close) / (highest - lowest)) * -100.0

        return when {
            wr > -20 -> vote(SignalDirection.SHORT, wr, "Williams %R=${"%.1f".format(wr)} overbought")
            wr < -80 -> vote(SignalDirection.LONG, wr, "Williams %R=${"%.1f".format(wr)} oversold")
            wr > -50 -> vote(SignalDirection.LONG, wr, "Williams %R bullish zone")
            else -> vote(SignalDirection.SHORT, wr, "Williams %R bearish zone")
        }
    }
}
