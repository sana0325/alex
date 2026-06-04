package com.goldscalp.bot.ui

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.goldscalp.bot.api.MT5ApiClient
import com.goldscalp.bot.data.repository.ConfigRepository
import com.goldscalp.bot.databinding.ActivityLoginBinding
import com.goldscalp.bot.models.BotConfig
import kotlinx.coroutines.launch

class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // If already configured, go to main
        if (ConfigRepository.getConfig(this)?.mt5Login != 0L) {
            startMain(); return
        }

        binding.btnConnect.setOnClickListener { attemptConnection() }
    }

    private fun attemptConnection() {
        val url = binding.etApiUrl.text.toString().trim()
        val server = binding.etServer.text.toString().trim()
        val login = binding.etLogin.text.toString().toLongOrNull() ?: 0L
        val password = binding.etPassword.text.toString()

        if (url.isEmpty() || login == 0L || password.isEmpty()) {
            Toast.makeText(this, "Fill all fields", Toast.LENGTH_SHORT).show()
            return
        }

        binding.btnConnect.isEnabled = false
        binding.tvStatus.text = "Connecting to broker..."

        lifecycleScope.launch {
            val config = BotConfig(
                brokerApiUrl = url, mt5Server = server,
                mt5Login = login, mt5Password = password
            )
            val client = MT5ApiClient(config)
            client.initialize(url)
            val ok = client.authenticate()
            if (ok) {
                val account = client.getAccount()
                ConfigRepository.saveConfig(this@LoginActivity,
                    config.copy(symbol = "XAUUSD", timeframe = "M5")
                )
                Toast.makeText(this@LoginActivity,
                    "Connected! Account: ${account?.name}", Toast.LENGTH_LONG).show()
                startMain()
            } else {
                binding.tvStatus.text = "Connection failed. Check credentials."
                binding.btnConnect.isEnabled = true
            }
        }
    }

    private fun startMain() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}
