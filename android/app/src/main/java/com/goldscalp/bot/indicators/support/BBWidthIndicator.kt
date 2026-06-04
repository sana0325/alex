package com.goldscalp.bot.indicators.support

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Support 28: Bollinger Band Width — volatility filter */
class BBWidthIndicator(private val period: Int = 20) : BaseIndicator() {
    override val name = "BB Width Volatility"
    override val isSignal = false

    override fun calculate(candles: List<Candle>): IndicatorVote {
        if (candles.size < period) return vote(SignalDirection.NONE)
        val closes = candles.takeLast(period).map { it.close }
        val middle = closes.average()
        val std = Math.sqrt(closes.map { (it - middle).let { d -> d * d } }.average())
        val width = (4 * std) / middle * 100.0
        return IndicatorVote(name, SignalDirection.NONE, width, "BBWidth=${"%.2f".format(width)}%")
    }
}
