package com.goldscalp.bot.indicators.momentum

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Signal 14: Momentum(10) — price change rate */
class MomentumIndicator(private val period: Int = 10) : BaseIndicator() {
    override val name = "Momentum($period)"
    override val isSignal = true

    override fun calculate(candles: List<Candle>): IndicatorVote {
        if (candles.size < period + 1) return vote(SignalDirection.NONE)
        val current = candles.last().close
        val past = candles[candles.size - 1 - period].close
        val momentum = (current / past) * 100.0

        return when {
            momentum > 100.5 -> vote(SignalDirection.LONG, momentum - 100, "Momentum=${"%.2f".format(momentum)} bullish")
            momentum < 99.5 -> vote(SignalDirection.SHORT, momentum - 100, "Momentum=${"%.2f".format(momentum)} bearish")
            else -> vote(SignalDirection.NONE, momentum - 100, "Momentum neutral")
        }
    }
}
