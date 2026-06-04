package com.goldscalp.bot.indicators.trend

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Signal 3: Price vs EMA200 — macro trend filter */
class EMA200Indicator : BaseIndicator() {
    override val name = "Price vs EMA200"
    override val isSignal = true

    override fun calculate(candles: List<Candle>): IndicatorVote {
        if (candles.size < 205) return vote(SignalDirection.NONE)
        val closes = candles.map { it.close }
        val ema200 = ema(closes, 200)
        if (ema200.isEmpty()) return vote(SignalDirection.NONE)
        val price = closes.last()
        val e200 = ema200.last()
        return when {
            price > e200 -> vote(SignalDirection.LONG, price - e200, "Price above EMA200 (${"%.2f".format(e200)})")
            price < e200 -> vote(SignalDirection.SHORT, price - e200, "Price below EMA200 (${"%.2f".format(e200)})")
            else -> vote(SignalDirection.NONE)
        }
    }
}
