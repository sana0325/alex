package ua.alex.plitka

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

class CalcActivity : Activity() {

    companion object {
        private const val EXTRA_AREA = "area"
        private const val EXTRA_PERIM = "perim"
        private const val EXTRA_CUT_PERIM = "cutPerim"

        fun start(c: Context, area: Double, perimeter: Double, cutPerimeter: Double = 0.0) {
            c.startActivity(Intent(c, CalcActivity::class.java)
                .putExtra(EXTRA_AREA, area)
                .putExtra(EXTRA_PERIM, perimeter)
                .putExtra(EXTRA_CUT_PERIM, cutPerimeter))
        }

        /** Load presets: tile mm, stone 20–40 cm, stone 5–20 cm, sand cm, mix cm, cement 1:N */
        private val LOADS = listOf(
            Triple("🚶 Пішохідна", "Плитка 40 мм — лише пішохідні доріжки",
                listOf(40.0, 10.0, 5.0, 0.0, 4.0, 6.0)),
            Triple("🚗 Двір + авто", "Плитка 60 мм — пішоходи і легкові авто час від часу",
                listOf(60.0, 20.0, 10.0, 0.0, 5.0, 5.0)),
            Triple("🚚 Проїзд", "Плитка 80 мм — постійний рух легкових і вантажних авто",
                listOf(80.0, 30.0, 10.0, 0.0, 5.0, 4.0)),
        )
        /** Laying pattern: name, reserve %, diagonal */
        private val PATTERNS = listOf(
            Triple("Пряма", 5.0, false),
            Triple("Складна форма", 8.0, false),
            Triple("Діагональ / ялинка", 12.0, true),
        )
    }

    private val prefs by lazy { getSharedPreferences("calc2", MODE_PRIVATE) }
    private val fields = linkedMapOf<String, EditText>()
    private lateinit var areaE: EditText
    private lateinit var perimE: EditText
    private lateinit var cutPerimE: EditText
    private lateinit var curbAtCuts: CheckBox
    private lateinit var loadHint: TextView
    private val loadBtns = mutableListOf<Button>()
    private val patternBtns = mutableListOf<Button>()
    private lateinit var result: TextView
    private var lastReport = ""
    private var diagonal = false
    private var ready = false

    private val layerDefs = listOf(
        Triple("tile", "Товщина плитки, мм", "60"),
        Triple("s2040", "Щебінь 20–40, шар см", "20"),
        Triple("s520", "Щебінь 5–20, шар см", "10"),
        Triple("sand", "Пісок (за потреби), шар см", "0"),
        Triple("mix", "Відсів+цемент (ЦПС), шар см", "5"),
        Triple("ratio", "Цемент : відсів = 1 : N (0 — без цементу)", "5"),
        Triple("reserve", "Запас плитки, %", "5"),
        Triple("pallet", "Плитки на піддоні, м²", "10"),
        Triple("curbLen", "Довжина бордюру, м/шт", "1"),
    )
    private val priceDefs = listOf(
        Triple("pS2040", "Щебінь 20–40, грн/т", "0"),
        Triple("pS520", "Щебінь 5–20, грн/т", "0"),
        Triple("pSand", "Пісок, грн/т", "0"),
        Triple("pScreen", "Відсів, грн/т", "0"),
        Triple("pCement", "Цемент, грн/мішок 25 кг", "0"),
        Triple("pTile", "Плитка, грн/м²", "0"),
        Triple("pCurb", "Бордюр, грн/шт", "0"),
        Triple("pGeo", "Геотекстиль, грн/м²", "0"),
        Triple("pLay", "Робота: укладання, грн/м²", "0"),
        Triple("pCurbWork", "Робота: бордюр, грн/м.п.", "0"),
        Triple("pCut", "Робота: підрізка, грн/м.п.", "0"),
        Triple("pDig", "Земляні роботи + вивіз, грн/м³", "0"),
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val p = Ui.dp(this, 18)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(p, p, p, p)
        }
        root.addView(Ui.text(this, "Розрахунок матеріалів", 24f, true, Ui.GREEN))

        // --- Area ---
        val area = intent.getDoubleExtra(EXTRA_AREA, 0.0)
        val perim = intent.getDoubleExtra(EXTRA_PERIM, 0.0)
        val cutPerim = intent.getDoubleExtra(EXTRA_CUT_PERIM, 0.0)
        areaE = Ui.number(this, "м²", if (area > 0) Ui.fmt(area) else "")
        perimE = Ui.number(this, "м", if (perim > 0) Ui.fmt(perim) else "")
        cutPerimE = Ui.number(this, "м", if (cutPerim > 0) Ui.fmt(cutPerim) else "0")
        root.addView(Ui.row(this, "Площа, м²", areaE), Ui.lp(this, 12))
        root.addView(Ui.row(this, "Зовнішній периметр, м", perimE), Ui.lp(this, 2))
        root.addView(Ui.row(this, "Периметр вирізів (будинок, клумби), м", cutPerimE), Ui.lp(this, 2))
        curbAtCuts = CheckBox(this).apply {
            text = "Бордюр і навколо вирізів (клумби). Біля стіни будинку зазвичай не потрібен"
            isChecked = prefs.getBoolean("curbAtCuts", false)
            setOnCheckedChangeListener { _, _ -> recalc() }
        }
        root.addView(curbAtCuts, Ui.lp(this, 2))

        // --- Load type ---
        root.addView(Ui.text(this, "Навантаження", 18f, true), Ui.lp(this, 16))
        val loadRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        LOADS.forEachIndexed { idx, item ->
            val b = Ui.button(this, item.first, Ui.GREEN) { applyLoad(idx) }.apply { textSize = 14f }
            loadBtns.add(b)
            loadRow.addView(b, third())
        }
        root.addView(loadRow, Ui.lp(this, 6))
        loadHint = Ui.text(this, "", 13f, color = Ui.GRAY)
        root.addView(loadHint, Ui.lp(this, 4))

        // --- Pattern ---
        root.addView(Ui.text(this, "Укладка", 18f, true), Ui.lp(this, 16))
        val patRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        PATTERNS.forEachIndexed { idx, item ->
            val b = Ui.button(this, item.first, Ui.ORANGE) { applyPattern(idx) }.apply { textSize = 14f }
            patternBtns.add(b)
            patRow.addView(b, third())
        }
        root.addView(patRow, Ui.lp(this, 6))
        diagonal = prefs.getBoolean("diagonal", false)

        // --- Layers ---
        root.addView(Ui.text(this, "Шари та параметри", 18f, true), Ui.lp(this, 16))
        for ((k, label, def) in layerDefs) {
            val e = Ui.number(this, label, prefs.getString(k, def) ?: def)
            fields[k] = e
            root.addView(Ui.row(this, label, e), Ui.lp(this, 2))
        }

        // --- Prices ---
        root.addView(Ui.text(this, "Ціни (необов'язково — для кошторису)", 18f, true), Ui.lp(this, 16))
        for ((k, label, def) in priceDefs) {
            val e = Ui.number(this, label, prefs.getString(k, def) ?: def)
            fields[k] = e
            root.addView(Ui.row(this, label, e), Ui.lp(this, 2))
        }

        result = Ui.text(this, "", 15f).apply {
            setBackgroundColor(0xFFEEF5EE.toInt())
            val q = Ui.dp(this@CalcActivity, 14)
            setPadding(q, q, q, q)
            setTextIsSelectable(true)
        }
        root.addView(result, Ui.lp(this, 18))
        root.addView(Ui.button(this, "📤 Поділитися кошторисом") { share() }, Ui.lp(this, 14))

        setContentView(ScrollView(this).apply { addView(root) })

        val watcher = object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
            override fun afterTextChanged(s: Editable?) { recalc() }
        }
        areaE.addTextChangedListener(watcher)
        perimE.addTextChangedListener(watcher)
        cutPerimE.addTextChangedListener(watcher)
        fields.values.forEach { it.addTextChangedListener(watcher) }

        val load = prefs.getInt("load", 1).coerceIn(0, LOADS.size - 1)
        highlight(loadBtns, load)
        loadHint.text = LOADS[load].second
        highlight(patternBtns, prefs.getInt("pattern", 0))
        ready = true
        recalc()
    }

    private fun third() = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
        marginEnd = Ui.dp(this@CalcActivity, 4)
    }

    private fun highlight(btns: List<Button>, sel: Int) {
        btns.forEachIndexed { i, b -> b.alpha = if (i == sel) 1f else 0.4f }
    }

    private fun applyLoad(idx: Int) {
        val v = LOADS[idx].third
        ready = false
        fields["tile"]?.setText(Ui.fmt(v[0]))
        fields["s2040"]?.setText(Ui.fmt(v[1]))
        fields["s520"]?.setText(Ui.fmt(v[2]))
        fields["sand"]?.setText(Ui.fmt(v[3]))
        fields["mix"]?.setText(Ui.fmt(v[4]))
        fields["ratio"]?.setText(Ui.fmt(v[5]))
        ready = true
        prefs.edit().putInt("load", idx).apply()
        highlight(loadBtns, idx)
        loadHint.text = LOADS[idx].second
        recalc()
    }

    private fun applyPattern(idx: Int) {
        val item = PATTERNS[idx]
        diagonal = item.third
        prefs.edit().putInt("pattern", idx).putBoolean("diagonal", item.third).apply()
        highlight(patternBtns, idx)
        ready = false
        fields["reserve"]?.setText(Ui.fmt(item.second))
        ready = true
        recalc()
    }

    private fun v(k: String) = fields[k]?.let { Ui.parse(it) } ?: 0.0

    private fun f(x: Double, d: Int) = Ui.fmt(x, d)

    private fun recalc() {
        if (!ready) return
        val ed = prefs.edit()
        fields.forEach { (k, e) -> ed.putString(k, e.text.toString()) }
        ed.putBoolean("curbAtCuts", curbAtCuts.isChecked)
        ed.apply()

        val area = Ui.parse(areaE)
        if (area <= 0) {
            result.text = "Введи площу, щоб побачити розрахунок"
            lastReport = ""
            return
        }
        val i = MatInput(
            area = area, perimeter = Ui.parse(perimE), cutPerimeter = Ui.parse(cutPerimE),
            curbAtCuts = curbAtCuts.isChecked,
            tileMm = v("tile"), stone2040Cm = v("s2040"), stone520Cm = v("s520"), sandCm = v("sand"),
            mixCm = v("mix"), cementRatio = v("ratio"), reservePct = v("reserve"), diagonal = diagonal,
            curbLenM = v("curbLen"), m2PerPallet = v("pallet"),
            pStone2040T = v("pS2040"), pStone520T = v("pS520"), pSandT = v("pSand"), pScreenT = v("pScreen"),
            pCementBag = v("pCement"), pTileM2 = v("pTile"), pCurbPc = v("pCurb"), pGeoM2 = v("pGeo"),
            pLayM2 = v("pLay"), pCurbWorkM = v("pCurbWork"), pCutM = v("pCut"), pDigM3 = v("pDig"),
        )
        val r = Materials.calc(i)

        val sb = StringBuilder()
        sb.append("Площа ${f(area, 2)} м², периметр ${f(i.perimeter, 2)} м")
        if (i.cutPerimeter > 0) sb.append(" + вирізи ${f(i.cutPerimeter, 2)} м")
        sb.append("\n\n⛏ ЗЕМЛЯНІ РОБОТИ\n")
        sb.append("Глибина котловану: ${f(r.digDepthCm, 0)} см\n")
        sb.append("Ґрунт на вивіз: ${f(r.soilM3, 1)} м³ (з розпушенням)\n")
        sb.append("Геотекстиль 150–200 г/м²: ${f(r.geoM2, 1)} м²\n")

        sb.append("\n🪨 ОСНОВА\n")
        if (r.stone2040M3 > 0) sb.append("Щебінь 20–40: ${f(r.stone2040M3, 2)} м³ ≈ ${f(r.stone2040T, 1)} т\n")
        if (r.stone520M3 > 0) sb.append("Щебінь 5–20: ${f(r.stone520M3, 2)} м³ ≈ ${f(r.stone520T, 1)} т\n")
        if (r.sandM3 > 0) sb.append("Пісок: ${f(r.sandM3, 2)} м³ ≈ ${f(r.sandT, 1)} т\n")
        sb.append("Відсів (ЦПС): ${f(r.screenM3, 2)} м³ ≈ ${f(r.screenT, 1)} т\n")
        if (r.cementMixKg > 0) sb.append("Цемент у ЦПС: ${f(r.cementMixKg, 0)} кг\n")

        sb.append("\n▦ ПЛИТКА\n")
        sb.append("Плитка: ${f(r.tileM2, 2)} м² (запас ${f(i.reservePct, 0)}%)\n")
        if (r.pallets > 0) sb.append("Піддонів: ${r.pallets} • вага ≈ ${f(r.tileT, 1)} т\n")
        sb.append("Пісок у шви: ≈ ${f(r.jointSandKg, 0)} кг\n")
        sb.append("Підрізка: ≈ ${f(r.cutM, 1)} м.п.${if (diagonal) " (діагональ)" else ""}\n")

        if (r.curbM > 0) {
            sb.append("\n▬ БОРДЮР\n")
            sb.append("Довжина: ${f(r.curbM, 1)} м → ${r.curbPcs} шт\n")
            sb.append("Бетон М200 під бордюр: ${f(r.curbConcreteM3, 2)} м³ (цемент ${f(r.curbCementKg, 0)} кг)\n")
        }

        sb.append("\n🧱 ЦЕМЕНТ РАЗОМ: ${r.cementBags} міш. по 25 кг\n")

        if (r.costTotal > 0) {
            sb.append("\n💰 КОШТОРИС\n")
            for ((name, c) in r.costs) sb.append("$name: ${f(c, 0)} грн\n")
            sb.append("ВСЬОГО: ${f(r.costTotal, 0)} грн\n")
            sb.append("За 1 м²: ${f(r.costTotal / area, 0)} грн\n")
        }

        sb.append("\n📌 ПАМ'ЯТКА\n")
        sb.append("• Ухил 1–2% від будинку: 10–20 см перепаду на кожні 10 м\n")
        sb.append("• Шви між плитками 2–3 мм, засипати сухим піском\n")
        sb.append("• Щебінь трамбувати шарами по 10–15 см віброплитою\n")
        sb.append("• Плитку ущільнювати віброплитою тільки з гумовим килимком\n")
        sb.append("• Брати плитку одночасно з 3–5 піддонів — менше різнотону\n")
        sb.append("• Спочатку бордюр на бетон, плитку — після його застигання\n")

        lastReport = sb.toString()
        result.text = lastReport
    }

    private fun share() {
        if (lastReport.isEmpty()) return
        val i = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, "Кошторис — укладання тротуарної плитки\n\n$lastReport")
        }
        startActivity(Intent.createChooser(i, "Надіслати кошторис"))
    }
}
