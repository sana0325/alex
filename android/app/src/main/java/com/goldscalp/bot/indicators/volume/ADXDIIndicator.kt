package com.goldscalp.bot.indicators.volume

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Signal 26: ADX with DI+/DI- — directional signal */
class ADXDIIndicator(private val period: Int = 14) : BaseIndicator() {
    override val name = "ADX DI+/DI-"
    override val isSignal = true

    override fun calculate(candles: List<Candle>): IndicatorVote {
        if (candles.size < period * 2) return vote(SignalDirection.NONE)

        val dmPlus = mutableListOf<Double>()
        val dmMinus = mutableListOf<Double>()
        val trValues = mutableListOf<Double>()

        for (i in 1 until candles.size) {
            val c = candles[i]
            val p = candles[i - 1]
            val upMove = c.high - p.high
            val downMove = p.low - c.low
            dmPlus.add(if (upMove > downMove && upMove > 0) upMove else 0.0)
            dmMinus.add(if (downMove > upMove && downMove > 0) downMove else 0.0)
            trValues.add(maxOf(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)))
        }

        fun smooth(list: List<Double>): List<Double> {
            if (list.size < period) return emptyList()
            val result = mutableListOf(list.take(period).sum())
            for (i in period until list.size) result.add(result.last() - result.last() / period + list[i])
            return result
        }

        val str = smooth(trValues)
        val sdp = smooth(dmPlus)
        val sdm = smooth(dmMinus)
        if (str.isEmpty() || sdp.isEmpty() || sdm.isEmpty()) return vote(SignalDirection.NONE)

        val diPlus = sdp.last() / str.last() * 100
        val diMinus = sdm.last() / str.last() * 100

        return when {
            diPlus > diMinus + 2 -> vote(SignalDirection.LONG, diPlus - diMinus, "DI+(${"%.1f".format(diPlus)}) > DI-(${"%.1f".format(diMinus)})")
            diMinus > diPlus + 2 -> vote(SignalDirection.SHORT, diPlus - diMinus, "DI- > DI+ bearish")
            else -> vote(SignalDirection.NONE, diPlus - diMinus)
        }
    }
}
