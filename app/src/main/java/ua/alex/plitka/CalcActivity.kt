package ua.alex.plitka

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
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
    }

    private val prefs by lazy { getSharedPreferences("calc", MODE_PRIVATE) }
    private val fields = linkedMapOf<String, EditText>()
    private lateinit var areaE: EditText
    private lateinit var perimE: EditText
    private lateinit var result: TextView
    private var lastReport = ""

    // key, label, default (pedestrian)
    private val layerDefs = listOf(
        Triple("stone", "Щебінь 20–40, шар см", "15"),
        Triple("mix", "Відсів+цемент, шар см", "5"),
        Triple("ratio", "Цемент : відсів = 1 : N (0 — без цементу)", "6"),
        Triple("reserve", "Запас плитки, %", "7"),
        Triple("curbLen", "Довжина бордюру, м/шт", "1"),
    )
    private val priceDefs = listOf(
        Triple("pStone", "Щебінь, грн/т", "0"),
        Triple("pScreen", "Відсів, грн/т", "0"),
        Triple("pCement", "Цемент, грн/мішок 25 кг", "0"),
        Triple("pTile", "Плитка, грн/м²", "0"),
        Triple("pCurb", "Бордюр, грн/шт", "0"),
        Triple("pLabour", "Робота, грн/м²", "0"),
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val p = Ui.dp(this, 18)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(p, p, p, p)
        }

        root.addView(Ui.text(this, "Розрахунок матеріалів", 24f, true, Ui.GREEN))

        val area = intent.getDoubleExtra(EXTRA_AREA, 0.0)
        val perim = intent.getDoubleExtra(EXTRA_PERIM, 0.0)
        areaE = Ui.number(this, "м²", if (area > 0) Ui.fmt(area) else "")
        perimE = Ui.number(this, "м", if (perim > 0) Ui.fmt(perim) else "")
        root.addView(Ui.row(this, "Площа, м²", areaE), Ui.lp(this, 12))
        root.addView(Ui.row(this, "Периметр (бордюр), м", perimE), Ui.lp(this, 2))
        val cutPerim = intent.getDoubleExtra(EXTRA_CUT_PERIM, 0.0)
        if (cutPerim > 0) {
            root.addView(Ui.text(this,
                "Навколо вирізів (будинок, клумби): ${Ui.fmt(cutPerim)} м — додай до периметра, якщо там теж ставиш бордюр",
                13f, color = Ui.GRAY), Ui.lp(this, 2))
        }

        val presets = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        fun half() = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
            marginEnd = Ui.dp(this@CalcActivity, 6)
        }
        presets.addView(Ui.button(this, "🚶 Пішохідна") { preset(15, 5, 6) }, half())
        presets.addView(Ui.button(this, "🚗 Під авто", Ui.ORANGE) { preset(25, 5, 5) }, half())
        root.addView(presets, Ui.lp(this, 14))
        root.addView(Ui.text(this, "Пішохідна: плитка 6 см • Під авто: плитка 8 см", 13f, color = Ui.GRAY), Ui.lp(this, 4))

        root.addView(Ui.text(this, "Шари", 18f, true), Ui.lp(this, 16))
        for ((k, label, def) in layerDefs) {
            val e = Ui.number(this, label, prefs.getString(k, def) ?: def)
            fields[k] = e
            root.addView(Ui.row(this, label, e), Ui.lp(this, 2))
        }

        root.addView(Ui.text(this, "Ціни (необов'язково — для кошторису)", 18f, true), Ui.lp(this, 16))
        for ((k, label, def) in priceDefs) {
            val e = Ui.number(this, label, prefs.getString(k, def) ?: def)
            fields[k] = e
            root.addView(Ui.row(this, label, e), Ui.lp(this, 2))
        }

        result = Ui.text(this, "", 16f).apply {
            setBackgroundColor(0xFFEEF5EE.toInt())
            val q = Ui.dp(this@CalcActivity, 14)
            setPadding(q, q, q, q)
            setTextIsSelectable(true)
        }
        root.addView(result, Ui.lp(this, 18))

        root.addView(Ui.button(this, "📤 Поділитися кошторисом") { share() }, Ui.lp(this, 14))
        root.addView(Ui.text(this,
            "Орієнтовний розрахунок. Щебінь з коеф. ущільнення 1.3, суміш — 1.2; щебінь 1.45 т/м³, відсів 1.5 т/м³.",
            12f, color = Ui.GRAY), Ui.lp(this, 10))

        setContentView(ScrollView(this).apply { addView(root) })

        val watcher = object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
            override fun afterTextChanged(s: Editable?) { recalc() }
        }
        areaE.addTextChangedListener(watcher)
        perimE.addTextChangedListener(watcher)
        fields.values.forEach { it.addTextChangedListener(watcher) }
        recalc()
    }

    private fun preset(stone: Int, mix: Int, ratio: Int) {
        fields["stone"]?.setText(stone.toString())
        fields["mix"]?.setText(mix.toString())
        fields["ratio"]?.setText(ratio.toString())
    }

    private fun v(k: String) = fields[k]?.let { Ui.parse(it) } ?: 0.0

    private fun recalc() {
        val ed = prefs.edit()
        fields.forEach { (k, e) -> ed.putString(k, e.text.toString()) }
        ed.apply()

        val area = Ui.parse(areaE)
        val perim = Ui.parse(perimE)
        if (area <= 0) {
            result.text = "Введи площу, щоб побачити розрахунок"
            lastReport = ""
            return
        }
        val r = Materials.calc(MatInput(
            area = area, perimeter = perim,
            stoneCm = v("stone"), mixCm = v("mix"), cementRatio = v("ratio"),
            tileReservePct = v("reserve"), curbLenM = v("curbLen"),
            priceStoneT = v("pStone"), priceScreenT = v("pScreen"), priceCementBag = v("pCement"),
            priceTileM2 = v("pTile"), priceCurbPc = v("pCurb"), priceLabourM2 = v("pLabour"),
        ))

        val sb = StringBuilder()
        sb.append("Площа: ${Ui.fmt(area)} м², периметр: ${Ui.fmt(perim)} м\n\n")
        sb.append("🪨 Щебінь: ${Ui.fmt(r.stoneM3)} м³ ≈ ${Ui.fmt(r.stoneT, 1)} т\n")
        sb.append("⏳ Відсів: ${Ui.fmt(r.screenM3)} м³ ≈ ${Ui.fmt(r.screenT, 1)} т\n")
        if (r.cementKg > 0) sb.append("🧱 Цемент: ${Ui.fmt(r.cementKg, 0)} кг = ${r.cementBags} міш. по 25 кг\n")
        sb.append("▦ Плитка: ${Ui.fmt(r.tileM2)} м² (з запасом)\n")
        if (r.curbPcs > 0) sb.append("▬ Бордюр: ${r.curbPcs} шт\n")
        sb.append("🧵 Геотекстиль: ${Ui.fmt(r.geotextileM2, 1)} м²\n")

        if (r.costTotal > 0) {
            sb.append("\n💰 Кошторис:\n")
            fun line(name: String, c: Double) { if (c > 0) sb.append("  $name: ${Ui.fmt(c, 0)} грн\n") }
            line("Щебінь", r.costStone)
            line("Відсів", r.costScreen)
            line("Цемент", r.costCement)
            line("Плитка", r.costTile)
            line("Бордюр", r.costCurb)
            if (r.costMaterials > 0) sb.append("  Матеріали разом: ${Ui.fmt(r.costMaterials, 0)} грн\n")
            line("Робота", r.costLabour)
            sb.append("  ВСЬОГО: ${Ui.fmt(r.costTotal, 0)} грн\n")
        }
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
