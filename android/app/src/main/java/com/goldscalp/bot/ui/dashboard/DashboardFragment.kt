package com.goldscalp.bot.ui.dashboard

import android.graphics.Color
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import com.goldscalp.bot.R
import com.goldscalp.bot.databinding.FragmentDashboardBinding
import com.goldscalp.bot.engine.BotStatus
import com.goldscalp.bot.models.SignalDirection

class DashboardFragment : Fragment() {

    private var _binding: FragmentDashboardBinding? = null
    private val binding get() = _binding!!
    private val viewModel: DashboardViewModel by viewModels()

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentDashboardBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupButtons()
        observeViewModel()
        viewModel.bindToService(requireContext())
    }

    private fun setupButtons() {
        binding.btnStart.setOnClickListener { viewModel.startBot(requireContext()) }
        binding.btnStop.setOnClickListener { viewModel.stopBot(requireContext()) }
        binding.btnPause.setOnClickListener {
            val state = viewModel.botState.value
            if (state?.status == BotStatus.PAUSED) viewModel.resumeBot(requireContext())
            else viewModel.pauseBot(requireContext())
        }
    }

    private fun observeViewModel() {
        viewModel.botState.observe(viewLifecycleOwner) { state ->
            updateStatusCard(state.status)
            updatePriceDisplay(state.currentPrice)
            updatePnLDisplay(state.dailyPnL, state.todayTrades)
            updatePositionCard(state)

            state.lastSignal?.let { signal ->
                updateSignalCard(signal.score, signal.totalVotes, signal.direction)
                updateIndicatorVotes(signal)
            }

            binding.tvLastError.visibility = if (state.lastError != null) View.VISIBLE else View.GONE
            binding.tvLastError.text = state.lastError

            // Button states
            binding.btnStart.isEnabled = state.status != BotStatus.RUNNING
            binding.btnStop.isEnabled = state.status != BotStatus.IDLE
            binding.btnPause.text = if (state.status == BotStatus.PAUSED) "Resume" else "Pause"
            binding.btnPause.isEnabled = state.status == BotStatus.RUNNING || state.status == BotStatus.PAUSED
        }

        viewModel.accountInfo.observe(viewLifecycleOwner) { info ->
            binding.tvAccountInfo.text = info
        }

        viewModel.isConnected.observe(viewLifecycleOwner) { connected ->
            binding.ivConnectionStatus.setColorFilter(
                if (connected) Color.GREEN else Color.RED
            )
        }
    }

    private fun updateStatusCard(status: BotStatus) {
        val (text, color) = when (status) {
            BotStatus.RUNNING -> "RUNNING" to Color.parseColor("#00C851")
            BotStatus.PAUSED -> "PAUSED" to Color.parseColor("#FF8800")
            BotStatus.ERROR -> "ERROR" to Color.RED
            BotStatus.IDLE -> "IDLE" to Color.GRAY
        }
        binding.tvBotStatus.text = text
        binding.tvBotStatus.setTextColor(color)
        binding.cardStatus.strokeColor = color
    }

    private fun updatePriceDisplay(price: Double) {
        if (price > 0) {
            binding.tvCurrentPrice.text = "${"%.2f".format(price)}"
            binding.tvSymbol.text = "XAUUSD"
        }
    }

    private fun updatePnLDisplay(pnl: Double, trades: Int) {
        binding.tvDailyPnL.text = "${if (pnl >= 0) "+" else ""}${"%.2f".format(pnl)} USD"
        binding.tvDailyPnL.setTextColor(if (pnl >= 0) Color.parseColor("#00C851") else Color.RED)
        binding.tvTodayTrades.text = "Trades today: $trades"
    }

    private fun updatePositionCard(state: com.goldscalp.bot.engine.BotState) {
        val pos = state.openPosition
        if (pos != null) {
            binding.cardPosition.visibility = View.VISIBLE
            binding.tvPositionDir.text = pos.direction
            binding.tvPositionDir.setTextColor(if (pos.direction == "BUY") Color.parseColor("#00C851") else Color.RED)
            binding.tvPositionEntry.text = "Entry: ${"%.2f".format(pos.openPrice)}"
            binding.tvPositionSL.text = "SL: ${"%.2f".format(pos.stopLoss)}"
            binding.tvPositionTP.text = "TP: ${"%.2f".format(pos.takeProfit)}"
            val pnl = when (pos.direction) {
                "BUY" -> (state.currentPrice - pos.openPrice) * 100
                "SELL" -> (pos.openPrice - state.currentPrice) * 100
                else -> 0.0
            }
            binding.tvPositionPnL.text = "${if (pnl >= 0) "+" else ""}${"%.2f".format(pnl)}"
            binding.tvPositionPnL.setTextColor(if (pnl >= 0) Color.parseColor("#00C851") else Color.RED)
        } else {
            binding.cardPosition.visibility = View.GONE
        }
    }

    private fun updateSignalCard(score: Int, total: Int, direction: SignalDirection) {
        val longVotes = (score + total) / 2
        val shortVotes = total - longVotes

        binding.tvSignalScore.text = "Score: $score / $total"
        binding.tvSignalLong.text = "LONG: $longVotes"
        binding.tvSignalShort.text = "SHORT: $shortVotes"

        binding.progressSignalLong.max = total
        binding.progressSignalLong.progress = longVotes
        binding.progressSignalShort.max = total
        binding.progressSignalShort.progress = shortVotes

        val (signalText, signalColor) = when (direction) {
            SignalDirection.LONG -> "▲ LONG SIGNAL" to Color.parseColor("#00C851")
            SignalDirection.SHORT -> "▼ SHORT SIGNAL" to Color.RED
            SignalDirection.NONE -> "— NO SIGNAL" to Color.GRAY
        }
        binding.tvSignalDirection.text = signalText
        binding.tvSignalDirection.setTextColor(signalColor)
    }

    private fun updateIndicatorVotes(signal: com.goldscalp.bot.models.TradeSignal) {
        val sb = StringBuilder()
        signal.votes.forEach { vote ->
            val icon = when (vote.direction) {
                SignalDirection.LONG -> "▲"
                SignalDirection.SHORT -> "▼"
                SignalDirection.NONE -> "—"
            }
            sb.appendLine("$icon ${vote.name}: ${vote.description.take(40)}")
        }
        binding.tvIndicatorVotes.text = sb.toString()
    }

    override fun onDestroyView() {
        viewModel.unbindFromService(requireContext())
        super.onDestroyView()
        _binding = null
    }
}
