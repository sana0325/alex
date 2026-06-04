package com.goldscalp.bot.indicators.support

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Support 30: Pivot Points — S/R levels to avoid entering at key zones */
class PivotPointsIndicator : BaseIndicator() {
    override val name = "Pivot Points"
    override val isSignal = false

    data class Pivots(val pp: Double, val r1: Double, val s1: Double, val r2: Double, val s2: Double)

    fun getPivots(candles: List<Candle>): Pivots? {
        if (candles.size < 2) return null
        val prev = candles[candles.size - 2]
        val pp = (prev.high + prev.low + prev.close) / 3.0
        return Pivots(
            pp = pp,
            r1 = 2 * pp - prev.low,
            s1 = 2 * pp - prev.high,
            r2 = pp + (prev.high - prev.low),
            s2 = pp - (prev.high - prev.low)
        )
    }

    override fun calculate(candles: List<Candle>): IndicatorVote {
        val pivots = getPivots(candles) ?: return IndicatorVote(name, SignalDirection.NONE)
        val price = candles.last().close
        val nearZone = pivots.let { p ->
            listOf(p.pp, p.r1, p.s1, p.r2, p.s2).any { Math.abs(price - it) < 0.5 }
        }
        return IndicatorVote(name, SignalDirection.NONE, pivots.pp, "PP=${"%.2f".format(pivots.pp)} nearZone=$nearZone")
    }
}
