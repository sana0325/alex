package com.goldscalp.bot.indicators.volume

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Signal 24: Bollinger Bands(20,2) position signal */
class BollingerBandsSignalIndicator(
    private val period: Int = 20,
    private val stdDev: Double = 2.0
) : BaseIndicator() {
    override val name = "Bollinger Bands"
    override val isSignal = true

    override fun calculate(candles: List<Candle>): IndicatorVote {
        if (candles.size < period) return vote(SignalDirection.NONE)
        val closes = candles.takeLast(period).map { it.close }
        val middle = closes.average()
        val std = Math.sqrt(closes.map { (it - middle).let { d -> d * d } }.average())
        val upper = middle + stdDev * std
        val lower = middle - stdDev * std
        val price = candles.last().close

        return when {
            price > middle && price < upper -> vote(SignalDirection.LONG, price - middle, "Price above BB mid, trending up")
            price > upper -> vote(SignalDirection.SHORT, price - upper, "Price above BB upper — overbought")
            price < middle && price > lower -> vote(SignalDirection.SHORT, price - middle, "Price below BB mid")
            price < lower -> vote(SignalDirection.LONG, lower - price, "Price below BB lower — oversold")
            else -> vote(SignalDirection.NONE)
        }
    }
}
