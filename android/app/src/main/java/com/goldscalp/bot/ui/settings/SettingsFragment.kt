package com.goldscalp.bot.ui.settings

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.goldscalp.bot.api.MT5ApiClient
import com.goldscalp.bot.data.repository.ConfigRepository
import com.goldscalp.bot.databinding.FragmentSettingsBinding
import com.goldscalp.bot.models.BotConfig
import kotlinx.coroutines.launch

class SettingsFragment : Fragment() {

    private var _binding: FragmentSettingsBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentSettingsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        loadConfig()
        setupSaveButton()
        setupTestConnectionButton()
    }

    private fun loadConfig() {
        val config = ConfigRepository.getOrDefault(requireContext())
        binding.apply {
            etBrokerApiUrl.setText(config.brokerApiUrl)
            etMt5Server.setText(config.mt5Server)
            etMt5Login.setText(if (config.mt5Login > 0) config.mt5Login.toString() else "")
            etMt5Password.setText(config.mt5Password)
            etLotSize.setText(config.lotSize.toString())
            etLongThreshold.setText(config.longThreshold.toString())
            etShortThreshold.setText(config.shortThreshold.toString())
            etSlMultiplier.setText(config.slMultiplier.toString())
            etTpMultiplier.setText(config.tpMultiplier.toString())
            etMaxDailyLoss.setText(config.maxDailyLoss.toString())
            etMaxDailyProfit.setText(config.maxDailyProfit.toString())
            etSessionStart.setText(config.sessionStartHour.toString())
            etSessionEnd.setText(config.sessionEndHour.toString())
            etMinAdx.setText(config.minAdx.toString())
            switchAutoRestart.isChecked = config.autoRestart
        }
    }

    private fun setupSaveButton() {
        binding.btnSave.setOnClickListener {
            try {
                val config = buildConfig()
                ConfigRepository.saveConfig(requireContext(), config)
                Toast.makeText(requireContext(), "Settings saved", Toast.LENGTH_SHORT).show()
            } catch (e: NumberFormatException) {
                Toast.makeText(requireContext(), "Invalid number format", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun setupTestConnectionButton() {
        binding.btnTestConnection.setOnClickListener {
            binding.btnTestConnection.isEnabled = false
            binding.tvConnectionResult.text = "Connecting..."

            lifecycleScope.launch {
                try {
                    val config = buildConfig()
                    val client = MT5ApiClient(config)
                    client.initialize(config.brokerApiUrl)
                    val ok = client.authenticate()
                    if (ok) {
                        val account = client.getAccount()
                        binding.tvConnectionResult.text = if (account != null)
                            "✓ Connected! Balance: ${"%.2f".format(account.balance)} ${account.currency}"
                        else "✓ Auth OK but no account data"
                    } else {
                        binding.tvConnectionResult.text = "✗ Connection failed. Check credentials."
                    }
                } catch (e: Exception) {
                    binding.tvConnectionResult.text = "✗ Error: ${e.message}"
                }
                binding.btnTestConnection.isEnabled = true
            }
        }
    }

    private fun buildConfig(): BotConfig {
        return binding.run {
            BotConfig(
                brokerApiUrl = etBrokerApiUrl.text.toString().trim(),
                mt5Server = etMt5Server.text.toString().trim(),
                mt5Login = etMt5Login.text.toString().toLongOrNull() ?: 0L,
                mt5Password = etMt5Password.text.toString(),
                lotSize = etLotSize.text.toString().toDouble(),
                longThreshold = etLongThreshold.text.toString().toInt().coerceIn(1, 26),
                shortThreshold = etShortThreshold.text.toString().toInt().coerceIn(1, 26),
                slMultiplier = etSlMultiplier.text.toString().toDouble(),
                tpMultiplier = etTpMultiplier.text.toString().toDouble(),
                maxDailyLoss = etMaxDailyLoss.text.toString().toDouble(),
                maxDailyProfit = etMaxDailyProfit.text.toString().toDouble(),
                sessionStartHour = etSessionStart.text.toString().toInt().coerceIn(0, 23),
                sessionEndHour = etSessionEnd.text.toString().toInt().coerceIn(0, 23),
                minAdx = etMinAdx.text.toString().toDouble(),
                autoRestart = switchAutoRestart.isChecked
            )
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
