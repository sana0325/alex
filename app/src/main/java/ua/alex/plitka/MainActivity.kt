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

    /** Manual pieces: length, width, cut (subtracted). */
    private data class Piece(val l: Double, val w: Double, val cut: Boolean)
    private val pieces = mutableListOf<Piece>()
    private lateinit var piecesText: TextView

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
        root.addView(Ui.text(this,
            "Складна форма — став точку на кожному куті по черзі. Будинок посередині — «− Виріз».",
            13f, color = Ui.GRAY), Ui.lp(this, 4))

        root.addView(Ui.text(this, "Ручний ввід частинами", 18f, true), Ui.lp(this, 28))
        root.addView(Ui.text(this,
            "Розбий ділянку на прямокутники. Будинок, клумбу, колодязь — віднімай.",
            13f, color = Ui.GRAY), Ui.lp(this, 2))
        val lenE = Ui.number(this, "Довжина, м")
        val widE = Ui.number(this, "Ширина, м")
        root.addView(Ui.row(this, "Довжина, м", lenE), Ui.lp(this, 6))
        root.addView(Ui.row(this, "Ширина, м", widE), Ui.lp(this, 2))

        val btns = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        fun half() = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
            marginEnd = Ui.dp(this@MainActivity, 6)
        }
        fun addPiece(cut: Boolean) {
            val l = Ui.parse(lenE)
            val w = Ui.parse(widE)
            if (l <= 0 || w <= 0) {
                Toast.makeText(this, "Введи довжину і ширину", Toast.LENGTH_SHORT).show()
                return
            }
            pieces.add(Piece(l, w, cut))
            lenE.setText("")
            widE.setText("")
            lenE.requestFocus()
            refreshPieces()
        }
        btns.addView(Ui.button(this, "＋ Додати") { addPiece(false) }, half())
        btns.addView(Ui.button(this, "− Відняти", 0xFFC62828.toInt()) { addPiece(true) }, half())
        root.addView(btns, Ui.lp(this, 10))

        piecesText = Ui.text(this, "", 15f)
        root.addView(piecesText, Ui.lp(this, 8))

        val actions = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        actions.addView(Ui.button(this, "↶ Прибрати", Ui.GRAY) {
            if (pieces.isNotEmpty()) { pieces.removeAt(pieces.size - 1); refreshPieces() }
        }, half())
        actions.addView(Ui.button(this, "Розрахувати", Ui.ORANGE) {
            // A single rectangle typed in without pressing "Add" also counts
            if (pieces.isEmpty() && Ui.parse(lenE) > 0 && Ui.parse(widE) > 0) addPiece(false)
            val (area, perim) = totals()
            if (area <= 0) Toast.makeText(this, "Додай хоча б один прямокутник", Toast.LENGTH_SHORT).show()
            else CalcActivity.start(this, area, perim)
        }, half())
        root.addView(actions, Ui.lp(this, 8))

        root.addView(Ui.button(this, "✏️  Ввести площу вручну", Ui.GRAY) {
            CalcActivity.start(this, 0.0, 0.0)
        }, Ui.lp(this, 24))

        setContentView(ScrollView(this).apply {
            setBackgroundColor(0xFFF5F3EE.toInt())
            addView(root)
        })
        refreshPieces()
        checkAr()
    }

    /** Net area and an approximate curb perimeter (sum of added rectangles' perimeters). */
    private fun totals(): Pair<Double, Double> {
        var area = 0.0
        var perim = 0.0
        for (pc in pieces) {
            if (pc.cut) area -= pc.l * pc.w
            else { area += pc.l * pc.w; perim += 2 * (pc.l + pc.w) }
        }
        return Pair(area.coerceAtLeast(0.0), perim)
    }

    private fun refreshPieces() {
        if (pieces.isEmpty()) {
            piecesText.text = "Поки що нічого не додано"
            return
        }
        val sb = StringBuilder()
        pieces.forEachIndexed { i, pc ->
            val a = pc.l * pc.w
            sb.append("${i + 1}. ${if (pc.cut) "−" else "+"} ${Ui.fmt(pc.l)} × ${Ui.fmt(pc.w)} = ${if (pc.cut) "−" else ""}${Ui.fmt(a)} м²\n")
        }
        val (area, _) = totals()
        sb.append("Разом: ${Ui.fmt(area)} м²")
        piecesText.text = sb.toString()
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
