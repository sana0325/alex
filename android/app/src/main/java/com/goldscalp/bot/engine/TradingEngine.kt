package com.goldscalp.bot.engine

import android.util.Log
import com.goldscalp.bot.api.MT5ApiClient
import com.goldscalp.bot.models.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

enum class BotStatus { IDLE, RUNNING, PAUSED, ERROR }

data class BotState(
    val status: BotStatus = BotStatus.IDLE,
    val lastSignal: TradeSignal? = null,
    val openPosition: Position? = null,
    val dailyPnL: Double = 0.0,
    val todayTrades: Int = 0,
    val lastError: String? = null,
    val currentPrice: Double = 0.0,
    val lastUpdateMs: Long = 0
)

class TradingEngine(
    private val config: BotConfig,
    private val mt5Client: MT5ApiClient
) {
    private val TAG = "TradingEngine"
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val aggregator = SignalAggregator(config)

    private val _state = MutableStateFlow(BotState())
    val state: StateFlow<BotState> = _state

    private var monitorJob: Job? = null
    private var dailyPnL = 0.0
    private var todayTrades = 0

    fun start() {
        if (_state.value.status == BotStatus.RUNNING) return
        updateStatus(BotStatus.RUNNING)
        monitorJob = scope.launch { tradingLoop() }
        Log.i(TAG, "Trading engine started")
    }

    fun stop() {
        monitorJob?.cancel()
        updateStatus(BotStatus.IDLE)
        Log.i(TAG, "Trading engine stopped")
    }

    fun pause() {
        updateStatus(BotStatus.PAUSED)
    }

    fun resume() {
        if (_state.value.status == BotStatus.PAUSED) {
            updateStatus(BotStatus.RUNNING)
        }
    }

    private suspend fun tradingLoop() {
        while (isActive) {
            try {
                if (_state.value.status == BotStatus.RUNNING) {
                    tick()
                }
                // Check every 30 seconds, act on 5-min candle close
                delay(30_000L)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.e(TAG, "Trading loop error: ${e.message}")
                updateStatus(BotStatus.ERROR, e.message)
                delay(60_000L)
                updateStatus(BotStatus.RUNNING)
            }
        }
    }

    private suspend fun tick() {
        // Guard: daily limits
        if (dailyPnL <= -config.maxDailyLoss) {
            Log.w(TAG, "Daily loss limit reached: $dailyPnL")
            stop(); return
        }
        if (dailyPnL >= config.maxDailyProfit) {
            Log.i(TAG, "Daily profit target reached: $dailyPnL")
            stop(); return
        }

        // Fetch current price
        val price = mt5Client.getCurrentPrice(config.symbol) ?: return
        updateCurrentPrice(price)

        // Manage open position first
        val openPos = _state.value.openPosition
        if (openPos != null) {
            managePosition(openPos, price)
            return
        }

        // Only trade on new candle close (align to 5-min boundary ±5s)
        if (!isNearCandleClose()) return

        // Fetch candles and calculate signal
        val candles = mt5Client.getCandles(config.symbol, config.timeframe, 250) ?: return
        val signal = aggregator.evaluate(candles)

        _state.value = _state.value.copy(lastSignal = signal, lastUpdateMs = System.currentTimeMillis())

        if (signal.direction == SignalDirection.NONE) {
            Log.d(TAG, "No signal — score=${signal.score}/${signal.totalVotes}")
            return
        }

        // Enter trade
        val ticket = mt5Client.openPosition(
            symbol = config.symbol,
            direction = if (signal.direction == SignalDirection.LONG) "BUY" else "SELL",
            volume = config.lotSize,
            stopLoss = signal.stopLoss,
            takeProfit = signal.takeProfit,
            comment = "GSB_${signal.direction}_${signal.score}v"
        )

        if (ticket != null) {
            val position = Position(
                ticket = ticket,
                symbol = config.symbol,
                direction = if (signal.direction == SignalDirection.LONG) "BUY" else "SELL",
                volume = config.lotSize,
                openPrice = signal.entryPrice,
                stopLoss = signal.stopLoss,
                takeProfit = signal.takeProfit,
                openTime = System.currentTimeMillis()
            )
            todayTrades++
            _state.value = _state.value.copy(openPosition = position, todayTrades = todayTrades)
            Log.i(TAG, "Opened ${signal.direction} at ${signal.entryPrice} SL=${signal.stopLoss} TP=${signal.takeProfit}")
        }
    }

    private suspend fun managePosition(pos: Position, currentPrice: Double) {
        val atr = aggregator.atrIndicator.getATR(
            mt5Client.getCandles(config.symbol, config.timeframe, 20) ?: return
        )

        val profitPips = when (pos.direction) {
            "BUY" -> currentPrice - pos.openPrice
            "SELL" -> pos.openPrice - currentPrice
            else -> 0.0
        }

        // Check if SL or TP hit (MT5 handles it, but we sync)
        val slHit = when (pos.direction) {
            "BUY" -> currentPrice <= pos.stopLoss
            "SELL" -> currentPrice >= pos.stopLoss
            else -> false
        }
        val tpHit = when (pos.direction) {
            "BUY" -> currentPrice >= pos.takeProfit
            "SELL" -> currentPrice <= pos.takeProfit
            else -> false
        }

        if (slHit || tpHit) {
            val profit = if (tpHit) Math.abs(pos.takeProfit - pos.openPrice) else -Math.abs(pos.openPrice - pos.stopLoss)
            dailyPnL += profit
            _state.value = _state.value.copy(openPosition = null, dailyPnL = dailyPnL)
            return
        }

        // Trailing stop: activate when profit >= ATR * trailingActivation
        val trailActivation = atr * config.trailingActivation
        val trailStep = atr * config.trailingStep
        if (profitPips >= trailActivation && atr > 0) {
            val newSL = when (pos.direction) {
                "BUY" -> maxOf(pos.stopLoss, currentPrice - trailStep)
                "SELL" -> minOf(pos.stopLoss, currentPrice + trailStep)
                else -> pos.stopLoss
            }
            if (newSL != pos.stopLoss) {
                mt5Client.modifyPosition(pos.ticket, newSL, pos.takeProfit)
                _state.value = _state.value.copy(
                    openPosition = pos.copy(stopLoss = newSL, trailingStopLevel = newSL)
                )
                Log.d(TAG, "Trailing stop moved to $newSL")
            }
        }
    }

    private fun isNearCandleClose(): Boolean {
        val ms = System.currentTimeMillis()
        val secondsInMinute = (ms / 1000) % 60
        val minuteOfHour = (ms / 60000) % 60
        // M5 candle closes at minutes 0,5,10,15,...
        val secondsToClose = (5 - (minuteOfHour % 5).toInt()) * 60 - secondsInMinute.toInt()
        return secondsToClose in 0..35 || secondsToClose > 290
    }

    private fun updateStatus(status: BotStatus, error: String? = null) {
        _state.value = _state.value.copy(status = status, lastError = error)
    }

    private fun updateCurrentPrice(price: Double) {
        _state.value = _state.value.copy(currentPrice = price, lastUpdateMs = System.currentTimeMillis())
    }

    fun resetDailyStats() {
        dailyPnL = 0.0
        todayTrades = 0
        _state.value = _state.value.copy(dailyPnL = 0.0, todayTrades = 0)
    }

    fun destroy() {
        scope.cancel()
    }
}
