package com.goldscalp.bot.ui.dashboard

import android.app.Application
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import com.goldscalp.bot.engine.BotState
import com.goldscalp.bot.engine.BotStatus
import com.goldscalp.bot.models.BotConfig
import com.goldscalp.bot.models.TradeSignal
import com.goldscalp.bot.service.TradingService
import com.goldscalp.bot.data.repository.ConfigRepository
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class DashboardViewModel(app: Application) : AndroidViewModel(app) {

    private val _botState = MutableLiveData<BotState>()
    val botState: LiveData<BotState> = _botState

    private val _accountInfo = MutableLiveData<String>()
    val accountInfo: LiveData<String> = _accountInfo

    private val _isConnected = MutableLiveData(false)
    val isConnected: LiveData<Boolean> = _isConnected

    private var tradingService: TradingService? = null
    private var bound = false

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            tradingService = (binder as? TradingService.LocalBinder)?.getService()
            bound = true
            observeEngineState()
            refreshAccount()
        }
        override fun onServiceDisconnected(name: ComponentName?) {
            tradingService = null
            bound = false
        }
    }

    fun bindToService(context: Context) {
        val intent = Intent(context, TradingService::class.java)
        context.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
    }

    fun unbindFromService(context: Context) {
        if (bound) {
            context.unbindService(serviceConnection)
            bound = false
        }
    }

    private fun observeEngineState() {
        viewModelScope.launch {
            tradingService?.getEngine()?.state?.collectLatest { state ->
                _botState.postValue(state)
            }
        }
    }

    fun startBot(context: Context) {
        val intent = Intent(context, TradingService::class.java).apply {
            action = TradingService.ACTION_START
        }
        context.startForegroundService(intent)
        val config = ConfigRepository.getOrDefault(context)
        ConfigRepository.saveConfig(context, config.copy(isActive = true))
        bindToService(context)
    }

    fun stopBot(context: Context) {
        val intent = Intent(context, TradingService::class.java).apply {
            action = TradingService.ACTION_STOP
        }
        context.startService(intent)
        val config = ConfigRepository.getOrDefault(context)
        ConfigRepository.saveConfig(context, config.copy(isActive = false))
    }

    fun pauseBot(context: Context) {
        Intent(context, TradingService::class.java).apply {
            action = TradingService.ACTION_PAUSE
            context.startService(this)
        }
    }

    fun resumeBot(context: Context) {
        Intent(context, TradingService::class.java).apply {
            action = TradingService.ACTION_RESUME
            context.startService(this)
        }
    }

    private fun refreshAccount() {
        viewModelScope.launch {
            val account = tradingService?.getApiClient()?.getAccount()
            if (account != null) {
                _accountInfo.postValue(
                    "Balance: ${"%.2f".format(account.balance)} ${account.currency} | " +
                    "Equity: ${"%.2f".format(account.equity)} | " +
                    "Free Margin: ${"%.2f".format(account.freeMargin)}"
                )
                _isConnected.postValue(true)
            }
        }
    }

    fun getLastSignal(): TradeSignal? = _botState.value?.lastSignal
}
