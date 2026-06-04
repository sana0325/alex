package com.goldscalp.bot.indicators.oscillator

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Signal 19: Elder Ray — Bull Power and Bear Power vs EMA13 */
class ElderRayIndicator(private val period: Int = 13) : BaseIndicator() {
    override val name = "Elder Ray"
    override val isSignal = true

    override fun calculate(candles: List<Candle>): IndicatorVote {
        if (candles.size < period + 2) return vote(SignalDirection.NONE)
        val closes = candles.map { it.close }
        val ema13 = ema(closes, period)
        if (ema13.isEmpty()) return vote(SignalDirection.NONE)
        val e = ema13.last()

        val bullPower = candles.last().high - e
        val bearPower = candles.last().low - e

        return when {
            bullPower > 0 && bearPower > 0 -> vote(SignalDirection.LONG, bullPower, "Bull=${"%.2f".format(bullPower)} Bear=${"%.2f".format(bearPower)} strong bull")
            bullPower > 0 && bearPower < 0 -> vote(SignalDirection.LONG, bullPower, "Bull Power positive")
            bullPower < 0 && bearPower < 0 -> vote(SignalDirection.SHORT, bearPower, "Both negative — bearish")
            else -> vote(SignalDirection.NONE)
        }
    }
}
