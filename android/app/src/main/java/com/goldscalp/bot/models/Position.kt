package com.goldscalp.bot.models

import androidx.room.Entity
import androidx.room.PrimaryKey

enum class PositionState { OPEN, CLOSED, PENDING }

@Entity(tableName = "positions")
data class Position(
    @PrimaryKey val ticket: Long,
    val symbol: String = "XAUUSD",
    val direction: String,        // "BUY" or "SELL"
    val volume: Double,
    val openPrice: Double,
    val stopLoss: Double,
    val takeProfit: Double,
    val openTime: Long,
    val closePrice: Double = 0.0,
    val closeTime: Long = 0,
    val profit: Double = 0.0,
    val state: String = PositionState.OPEN.name,
    val comment: String = "GoldScalpBot",
    val trailingStopLevel: Double = 0.0
)
