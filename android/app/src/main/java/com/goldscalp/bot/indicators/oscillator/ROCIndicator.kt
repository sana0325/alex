package com.goldscalp.bot.indicators.oscillator

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Signal 18: Rate of Change(12) — price velocity */
class ROCIndicator(private val period: Int = 12) : BaseIndicator() {
    override val name = "ROC($period)"
    override val isSignal = true

    override fun calculate(candles: List<Candle>): IndicatorVote {
        if (candles.size < period + 1) return vote(SignalDirection.NONE)
        val current = candles.last().close
        val past = candles[candles.size - 1 - period].close
        if (past == 0.0) return vote(SignalDirection.NONE)
        val roc = ((current - past) / past) * 100.0

        return when {
            roc > 0.1 -> vote(SignalDirection.LONG, roc, "ROC=${"%.2f".format(roc)}% positive")
            roc < -0.1 -> vote(SignalDirection.SHORT, roc, "ROC=${"%.2f".format(roc)}% negative")
            else -> vote(SignalDirection.NONE, roc)
        }
    }
}
