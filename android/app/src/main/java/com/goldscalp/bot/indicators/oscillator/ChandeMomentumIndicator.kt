package com.goldscalp.bot.indicators.oscillator

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Signal 17: Chande Momentum Oscillator(14) */
class ChandeMomentumIndicator(private val period: Int = 14) : BaseIndicator() {
    override val name = "Chande CMO($period)"
    override val isSignal = true

    override fun calculate(candles: List<Candle>): IndicatorVote {
        if (candles.size < period + 1) return vote(SignalDirection.NONE)
        val closes = candles.takeLast(period + 1).map { it.close }
        val changes = (1 until closes.size).map { closes[it] - closes[it - 1] }
        val sumUp = changes.filter { it > 0 }.sum()
        val sumDown = changes.filter { it < 0 }.let { if (it.isEmpty()) 0.0 else Math.abs(it.sum()) }
        if (sumUp + sumDown == 0.0) return vote(SignalDirection.NONE)
        val cmo = ((sumUp - sumDown) / (sumUp + sumDown)) * 100.0

        return when {
            cmo > 20 -> vote(SignalDirection.LONG, cmo, "CMO=${"%.1f".format(cmo)} bullish")
            cmo < -20 -> vote(SignalDirection.SHORT, cmo, "CMO=${"%.1f".format(cmo)} bearish")
            else -> vote(SignalDirection.NONE, cmo)
        }
    }
}
