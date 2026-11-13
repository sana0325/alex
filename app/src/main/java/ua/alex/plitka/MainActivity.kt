package ua.alex.plitka

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import com.google.ar.core.ArCoreApk

class MainActivity : Activity() {
    private lateinit var arBtn: Button
    private lateinit var arStatus: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val p = Ui.dp(this, 20)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(p, p, p, p)
            setBackgroundColor(0xFFF5F3EE.toInt())
        }

        root.addView(Ui.text(this, "🧱 Плитка AR", 28f, true, Ui.GREEN))
        root.addView(Ui.text(this, "Замір площі та розрахунок щебеню, відсіву, цементу й плитки", 15f, color = Ui.GRAY), Ui.lp(this, 4))

        arBtn = Ui.button(this, "📐  AR замір камерою") {
            startActivity(Intent(this, ArMeasureActivity::class.java))
        }
        root.addView(arBtn, Ui.lp(this, 24))
        arStatus = Ui.text(this, "Перевірка підтримки AR…", 14f, color = Ui.GRAY)
        root.addView(arStatus, Ui.lp(this, 6))

        root.addView(Ui.text(this, "Прямокутна ділянка", 18f, true), Ui.lp(this, 28))
        val lenE = Ui.number(this, "Довжина, м")
        val widE = Ui.number(this, "Ширина, м")
        root.addView(Ui.row(this, "Довжина, м", lenE), Ui.lp(this, 6))
        root.addView(Ui.row(this, "Ширина, м", widE), Ui.lp(this, 2))
        root.addView(Ui.button(this, "Розрахувати матеріали") {
            val l = Ui.parse(lenE)
            val w = Ui.parse(widE)
            if (l <= 0 || w <= 0) {
                Toast.makeText(this, "Введи довжину і ширину", Toast.LENGTH_SHORT).show()
            } else {
                CalcActivity.start(this, l * w, 2 * (l + w))
            }
        }, Ui.lp(this, 10))

        root.addView(Ui.button(this, "✏️  Ввести площу вручну", Ui.GRAY) {
            CalcActivity.start(this, 0.0, 0.0)
        }, Ui.lp(this, 20))

        setContentView(ScrollView(this).apply {
            setBackgroundColor(0xFFF5F3EE.toInt())
            addView(root)
        })
        checkAr()
    }

    private fun checkAr() {
        val a = ArCoreApk.getInstance().checkAvailability(this)
        if (a.isTransient) {
            Handler(Looper.getMainLooper()).postDelayed({ checkAr() }, 300)
            return
        }
        if (a.isSupported) {
            arBtn.isEnabled = true
            arBtn.alpha = 1f
            arStatus.text = if (a == ArCoreApk.Availability.SUPPORTED_INSTALLED)
                "AR доступний ✅"
            else
                "Знадобиться «Сервіси Google Play для AR» — додаток запропонує встановити"
        } else {
            arBtn.isEnabled = false
            arBtn.alpha = 0.4f
            arStatus.text = "⚠ Цей телефон не підтримує ARCore. Користуйся ручним вводом нижче."
        }
    }
}
