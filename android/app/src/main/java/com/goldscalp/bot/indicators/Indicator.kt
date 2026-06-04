package com.goldscalp.bot.indicators

import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection

interface Indicator {
    val name: String
    val isSignal: Boolean  // true = signal indicator (26), false = support indicator (6)
    fun calculate(candles: List<Candle>): IndicatorVote
}

abstract class BaseIndicator : Indicator {
    protected fun vote(
        direction: SignalDirection,
        value: Double = 0.0,
        desc: String = ""
    ) = IndicatorVote(name, direction, value, desc)

    protected fun ema(data: List<Double>, period: Int): List<Double> {
        if (data.size < period) return emptyList()
        val k = 2.0 / (period + 1)
        val result = mutableListOf<Double>()
        var ema = data.take(period).average()
        result.add(ema)
        for (i in period until data.size) {
            ema = data[i] * k + ema * (1 - k)
            result.add(ema)
        }
        return result
    }

    protected fun sma(data: List<Double>, period: Int): List<Double> {
        if (data.size < period) return emptyList()
        return (period..data.size).map { i ->
            data.subList(i - period, i).average()
        }
    }

    protected fun atr(candles: List<Candle>, period: Int): List<Double> {
        if (candles.size < period + 1) return emptyList()
        val trValues = (1 until candles.size).map { i ->
            val c = candles[i]
            val prev = candles[i - 1]
            maxOf(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close))
        }
        return sma(trValues, period)
    }
}
