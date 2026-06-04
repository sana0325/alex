package com.goldscalp.bot.indicators.support

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Support 31: Volume filter — current volume vs average */
class VolumeFilterIndicator(private val period: Int = 20, private val minRatio: Double = 0.8) : BaseIndicator() {
    override val name = "Volume Filter"
    override val isSignal = false

    override fun calculate(candles: List<Candle>): IndicatorVote {
        if (candles.size < period) return IndicatorVote(name, SignalDirection.NONE, 0.0)
        val avgVol = candles.takeLast(period).map { it.volume }.average()
        val currVol = candles.last().volume
        val ratio = if (avgVol > 0) currVol / avgVol else 1.0
        val sufficient = ratio >= minRatio
        return IndicatorVote(name, SignalDirection.NONE, ratio, "Vol ratio=${"%.2f".format(ratio)} sufficient=$sufficient")
    }
}
