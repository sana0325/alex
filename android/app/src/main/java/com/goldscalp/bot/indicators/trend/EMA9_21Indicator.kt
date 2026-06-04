package com.goldscalp.bot.indicators.trend

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Signal 1: EMA9 cross above/below EMA21 */
class EMA9_21Indicator : BaseIndicator() {
    override val name = "EMA9/21 Cross"
    override val isSignal = true

    override fun calculate(candles: List<Candle>): IndicatorVote {
        if (candles.size < 25) return vote(SignalDirection.NONE)
        val closes = candles.map { it.close }
        val ema9 = ema(closes, 9)
        val ema21 = ema(closes, 21)
        if (ema9.size < 2 || ema21.size < 2) return vote(SignalDirection.NONE)

        val diff = ema9.last() - ema21.last()
        return when {
            diff > 0 -> vote(SignalDirection.LONG, diff, "EMA9(${f(ema9.last())}) > EMA21(${f(ema21.last())})")
            diff < 0 -> vote(SignalDirection.SHORT, diff, "EMA9(${f(ema9.last())}) < EMA21(${f(ema21.last())})")
            else -> vote(SignalDirection.NONE)
        }
    }
    private fun f(v: Double) = "%.2f".format(v)
}
