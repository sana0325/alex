package com.goldscalp.bot.indicators.volume

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Signal 25: Keltner Channel(20, ATR×2) position */
class KeltnerChannelIndicator(private val period: Int = 20, private val mult: Double = 2.0) : BaseIndicator() {
    override val name = "Keltner Channel"
    override val isSignal = true

    override fun calculate(candles: List<Candle>): IndicatorVote {
        if (candles.size < period + 1) return vote(SignalDirection.NONE)
        val closes = candles.map { it.close }
        val ema20 = ema(closes, period)
        if (ema20.isEmpty()) return vote(SignalDirection.NONE)
        val atr20 = atr(candles, period)
        if (atr20.isEmpty()) return vote(SignalDirection.NONE)

        val middle = ema20.last()
        val atrVal = atr20.last()
        val upper = middle + mult * atrVal
        val lower = middle - mult * atrVal
        val price = candles.last().close

        return when {
            price > middle -> vote(SignalDirection.LONG, price - middle, "Above Keltner mid(${"%.2f".format(middle)})")
            price < middle -> vote(SignalDirection.SHORT, middle - price, "Below Keltner mid")
            else -> vote(SignalDirection.NONE)
        }
    }
}
