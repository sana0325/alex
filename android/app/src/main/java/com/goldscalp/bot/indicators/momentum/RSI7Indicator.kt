package com.goldscalp.bot.indicators.momentum

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

/** Signal 10: RSI(7) — short-term momentum, avoid extremes */
class RSI7Indicator : BaseIndicator() {
    override val name = "RSI(7) Momentum"
    override val isSignal = true

    override fun calculate(candles: List<Candle>): IndicatorVote {
        val rsi = RSI14Indicator.calcRsi(candles, 7) ?: return vote(SignalDirection.NONE)
        return when {
            rsi in 50.0..70.0 -> vote(SignalDirection.LONG, rsi, "RSI7=${"%.1f".format(rsi)} bullish momentum")
            rsi in 30.0..50.0 -> vote(SignalDirection.SHORT, rsi, "RSI7=${"%.1f".format(rsi)} bearish momentum")
            rsi > 70 -> vote(SignalDirection.SHORT, rsi, "RSI7 overbought — potential reversal")
            rsi < 30 -> vote(SignalDirection.LONG, rsi, "RSI7 oversold — potential reversal")
            else -> vote(SignalDirection.NONE)
        }
    }
}
