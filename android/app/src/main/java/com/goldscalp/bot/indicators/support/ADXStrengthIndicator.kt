package com.goldscalp.bot.indicators.support

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Support 29: ADX(14) strength — trade only when ADX > minStrength */
class ADXStrengthIndicator(private val period: Int = 14) : BaseIndicator() {
    override val name = "ADX Strength"
    override val isSignal = false

    override fun calculate(candles: List<Candle>): IndicatorVote {
        if (candles.size < period * 2) return IndicatorVote(name, SignalDirection.NONE, 0.0, "Insufficient data")

        val trValues = mutableListOf<Double>()
        val dm = mutableListOf<Double>()
        for (i in 1 until candles.size) {
            val c = candles[i]; val p = candles[i - 1]
            val up = c.high - p.high; val down = p.low - c.low
            dm.add(if (Math.abs(up - down) < 0.001) 0.0 else if (up > down) maxOf(up, 0.0) else maxOf(down, 0.0))
            trValues.add(maxOf(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)))
        }

        fun smth(l: List<Double>): Double {
            if (l.size < period) return 0.0
            var s = l.take(period).sum()
            for (i in period until l.size) s = s - s / period + l[i]
            return s
        }

        val strTR = smth(trValues)
        val strDM = smth(dm)
        if (strTR == 0.0) return IndicatorVote(name, SignalDirection.NONE, 0.0)
        val di = strDM / strTR * 100
        return IndicatorVote(name, SignalDirection.NONE, di, "ADX≈${"%.1f".format(di)}")
    }
}
