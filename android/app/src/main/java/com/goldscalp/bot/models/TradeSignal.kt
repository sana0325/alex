package com.goldscalp.bot.models

import androidx.room.Entity
import androidx.room.PrimaryKey

enum class SignalDirection { LONG, SHORT, NONE }

data class IndicatorVote(
    val name: String,
    val direction: SignalDirection,
    val value: Double = 0.0,
    val description: String = ""
)

data class TradeSignal(
    val direction: SignalDirection,
    val score: Int,               // positive = long votes, negative = short votes
    val totalVotes: Int,
    val votes: List<IndicatorVote>,
    val entryPrice: Double,
    val stopLoss: Double,
    val takeProfit: Double,
    val atr: Double,
    val timestamp: Long = System.currentTimeMillis(),
    val timeframe: String = "M5",
    val confidence: Double = score.toDouble() / totalVotes
) {
    val isValid: Boolean get() = direction != SignalDirection.NONE
    val riskRewardRatio: Double get() {
        val risk = Math.abs(entryPrice - stopLoss)
        val reward = Math.abs(takeProfit - entryPrice)
        return if (risk > 0) reward / risk else 0.0
    }
}
