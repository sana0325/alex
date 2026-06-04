package com.goldscalp.bot.indicators.volume

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Signal 20: VWAP — intraday volume-weighted average price */
class VWAPIndicator : BaseIndicator() {
    override val name = "VWAP Position"
    override val isSignal = true

    override fun calculate(candles: List<Candle>): IndicatorVote {
        // Use last 50 candles as session VWAP approximation
        val session = candles.takeLast(minOf(50, candles.size))
        if (session.isEmpty()) return vote(SignalDirection.NONE)

        val totalVol = session.sumOf { it.volume }
        val vwap = if (totalVol > 0) {
            session.sumOf { ((it.high + it.low + it.close) / 3.0) * it.volume } / totalVol
        } else {
            session.map { (it.high + it.low + it.close) / 3.0 }.average()
        }

        val price = candles.last().close
        return when {
            price > vwap * 1.001 -> vote(SignalDirection.LONG, price - vwap, "Price above VWAP(${"%.2f".format(vwap)})")
            price < vwap * 0.999 -> vote(SignalDirection.SHORT, price - vwap, "Price below VWAP")
            else -> vote(SignalDirection.NONE, price - vwap)
        }
    }
}
