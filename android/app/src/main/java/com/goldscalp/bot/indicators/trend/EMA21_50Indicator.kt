package com.goldscalp.bot.indicators.trend

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Signal 2: EMA21 vs EMA50 — mid-term trend */
class EMA21_50Indicator : BaseIndicator() {
    override val name = "EMA21/50 Trend"
    override val isSignal = true

    override fun calculate(candles: List<Candle>): IndicatorVote {
        if (candles.size < 55) return vote(SignalDirection.NONE)
        val closes = candles.map { it.close }
        val ema21 = ema(closes, 21)
        val ema50 = ema(closes, 50)
        if (ema21.isEmpty() || ema50.isEmpty()) return vote(SignalDirection.NONE)
        val diff = ema21.last() - ema50.last()
        return when {
            diff > 0 -> vote(SignalDirection.LONG, diff, "EMA21 > EMA50 — uptrend")
            diff < 0 -> vote(SignalDirection.SHORT, diff, "EMA21 < EMA50 — downtrend")
            else -> vote(SignalDirection.NONE)
        }
    }
}
