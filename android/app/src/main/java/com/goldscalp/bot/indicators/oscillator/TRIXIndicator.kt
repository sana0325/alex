package com.goldscalp.bot.indicators.oscillator

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Signal 16: TRIX(14) — triple exponential smoothed momentum */
class TRIXIndicator(private val period: Int = 14) : BaseIndicator() {
    override val name = "TRIX($period)"
    override val isSignal = true

    override fun calculate(candles: List<Candle>): IndicatorVote {
        if (candles.size < period * 3 + 2) return vote(SignalDirection.NONE)
        val closes = candles.map { it.close }
        val ema1 = ema(closes, period)
        if (ema1.size < period) return vote(SignalDirection.NONE)
        val ema2 = ema(ema1, period)
        if (ema2.size < period) return vote(SignalDirection.NONE)
        val ema3 = ema(ema2, period)
        if (ema3.size < 2) return vote(SignalDirection.NONE)

        val trix = (ema3.last() - ema3[ema3.size - 2]) / ema3[ema3.size - 2] * 100.0
        return when {
            trix > 0 -> vote(SignalDirection.LONG, trix, "TRIX=${"%.4f".format(trix)} positive")
            trix < 0 -> vote(SignalDirection.SHORT, trix, "TRIX=${"%.4f".format(trix)} negative")
            else -> vote(SignalDirection.NONE)
        }
    }
}
