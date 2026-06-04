package com.goldscalp.bot.indicators.oscillator

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Signal 15: DeMarker(14) — demand oscillator */
class DeMarkerIndicator(private val period: Int = 14) : BaseIndicator() {
    override val name = "DeMarker($period)"
    override val isSignal = true

    override fun calculate(candles: List<Candle>): IndicatorVote {
        if (candles.size < period + 1) return vote(SignalDirection.NONE)

        val deMax = (1 until candles.size).takeLast(period).map { i ->
            maxOf(candles[i].high - candles[i - 1].high, 0.0)
        }
        val deMin = (1 until candles.size).takeLast(period).map { i ->
            maxOf(candles[i - 1].low - candles[i].low, 0.0)
        }
        val smaMax = deMax.average()
        val smaMin = deMin.average()
        if (smaMax + smaMin == 0.0) return vote(SignalDirection.NONE)
        val dem = smaMax / (smaMax + smaMin)

        return when {
            dem > 0.6 -> vote(SignalDirection.LONG, dem, "DeMarker=${"%.3f".format(dem)} bullish")
            dem < 0.4 -> vote(SignalDirection.SHORT, dem, "DeMarker=${"%.3f".format(dem)} bearish")
            else -> vote(SignalDirection.NONE, dem)
        }
    }
}
