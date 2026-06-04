package com.goldscalp.bot.indicators.support

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Support 27: ATR(14) — for SL/TP calculation, returns value via vote.value */
class ATRSupportIndicator(private val period: Int = 14) : BaseIndicator() {
    override val name = "ATR($period) RiskCalc"
    override val isSignal = false

    override fun calculate(candles: List<Candle>): IndicatorVote {
        val atrValues = atr(candles, period)
        if (atrValues.isEmpty()) return vote(SignalDirection.NONE)
        return IndicatorVote(name, SignalDirection.NONE, atrValues.last(), "ATR=${"%.4f".format(atrValues.last())}")
    }

    fun getATR(candles: List<Candle>): Double {
        val atrValues = atr(candles, period)
        return if (atrValues.isEmpty()) 0.0 else atrValues.last()
    }
}
