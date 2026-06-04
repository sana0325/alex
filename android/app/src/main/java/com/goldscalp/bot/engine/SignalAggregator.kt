package com.goldscalp.bot.engine

import com.goldscalp.bot.indicators.Indicator
import com.goldscalp.bot.indicators.momentum.*
import com.goldscalp.bot.indicators.oscillator.*
import com.goldscalp.bot.indicators.support.*
import com.goldscalp.bot.indicators.trend.*
import com.goldscalp.bot.indicators.volume.*
import com.goldscalp.bot.models.*

class SignalAggregator(private val config: BotConfig) {

    // 26 signal indicators (voted for direction)
    private val signalIndicators: List<Indicator> = listOf(
        // Trend (8)
        EMA9_21Indicator(),
        EMA21_50Indicator(),
        EMA200Indicator(),
        MACDSignalIndicator(),
        MACDHistogramIndicator(),
        ParabolicSARIndicator(),
        IchimokuCrossIndicator(),
        IchimokuCloudIndicator(),
        // Momentum (6)
        RSI14Indicator(),
        RSI7Indicator(),
        StochasticIndicator(),
        CCIIndicator(),
        WilliamsRIndicator(),
        MomentumIndicator(),
        // Oscillators (5)
        DeMarkerIndicator(),
        TRIXIndicator(),
        ChandeMomentumIndicator(),
        ROCIndicator(),
        ElderRayIndicator(),
        // Volume/Channel (7)
        VWAPIndicator(),
        ForceIndexIndicator(),
        AroonIndicator(),
        DonchianChannelIndicator(),
        BollingerBandsSignalIndicator(),
        KeltnerChannelIndicator(),
        ADXDIIndicator()
    )

    // 6 support indicators
    val atrIndicator = ATRSupportIndicator(14)
    private val bbWidthIndicator = BBWidthIndicator()
    private val adxStrengthIndicator = ADXStrengthIndicator()
    private val pivotPointsIndicator = PivotPointsIndicator()
    private val volumeFilterIndicator = VolumeFilterIndicator()
    val sessionFilterIndicator = SessionFilterIndicator(config.sessionStartHour, config.sessionEndHour)

    fun evaluate(candles: List<Candle>): TradeSignal {
        val votes = signalIndicators.map { it.calculate(candles) }
        val longVotes = votes.count { it.direction == SignalDirection.LONG }
        val shortVotes = votes.count { it.direction == SignalDirection.SHORT }
        val score = longVotes - shortVotes

        val atr = atrIndicator.getATR(candles)
        val price = candles.last().close

        // Support checks
        val adxVote = adxStrengthIndicator.calculate(candles)
        val bbWidthVote = bbWidthIndicator.calculate(candles)
        val sessionVote = sessionFilterIndicator.calculate(candles)
        val volumeVote = volumeFilterIndicator.calculate(candles)
        val pivotVote = pivotPointsIndicator.calculate(candles)

        val adxOk = adxVote.value >= config.minAdx
        val bbWidthOk = bbWidthVote.value >= 0.05
        val inSession = sessionVote.value > 0

        // Determine direction based on thresholds
        val direction = when {
            !inSession -> SignalDirection.NONE
            !adxOk -> SignalDirection.NONE
            !bbWidthOk -> SignalDirection.NONE
            longVotes >= config.longThreshold -> SignalDirection.LONG
            shortVotes >= config.shortThreshold -> SignalDirection.SHORT
            else -> SignalDirection.NONE
        }

        val (sl, tp) = when (direction) {
            SignalDirection.LONG -> Pair(price - atr * config.slMultiplier, price + atr * config.tpMultiplier)
            SignalDirection.SHORT -> Pair(price + atr * config.slMultiplier, price - atr * config.tpMultiplier)
            SignalDirection.NONE -> Pair(price, price)
        }

        return TradeSignal(
            direction = direction,
            score = score,
            totalVotes = signalIndicators.size,
            votes = votes,
            entryPrice = price,
            stopLoss = sl,
            takeProfit = tp,
            atr = atr
        )
    }

    fun getSupportSummary(candles: List<Candle>): Map<String, String> {
        return mapOf(
            "ATR" to "%.4f".format(atrIndicator.getATR(candles)),
            "ADX" to "%.1f".format(adxStrengthIndicator.calculate(candles).value),
            "BBWidth" to "%.2f%%".format(bbWidthIndicator.calculate(candles).value),
            "Session" to if (sessionFilterIndicator.isInSession()) "OPEN" else "CLOSED",
            "Volume" to "%.2f×".format(volumeFilterIndicator.calculate(candles).value),
            "Pivot" to "%.2f".format(pivotPointsIndicator.calculate(candles).value)
        )
    }
}
