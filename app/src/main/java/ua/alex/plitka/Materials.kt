package ua.alex.plitka

import kotlin.math.ceil

/**
 * Full estimate for paving tiles:
 * soil excavation → geotextile → crushed stone 20–40 → crushed stone 5–20 →
 * (optional sand) → dry bedding mix (screenings + cement) → tiles → joint sand,
 * plus curbs on concrete and cut length.
 *
 * Reference values (manufacturer guides): tile 40 mm pedestrian, 60 mm pedestrian
 * + occasional cars, 80 mm intensive traffic; tile reserve 4–6% (straight) up to ~10%
 * (complex/diagonal); bedding 30–50 mm; crushed stone 20–40 mm 100–300 mm;
 * 5–20 mm 100 mm; joints 2–3 mm; slope 1–2%.
 */
data class MatInput(
    val area: Double,            // m² net paved area
    val perimeter: Double,       // outer perimeter, m
    val cutPerimeter: Double,    // perimeter of cut-outs (building, flowerbeds), m
    val curbAtCuts: Boolean,     // also put curbs around cut-outs
    val tileMm: Double,
    val stone2040Cm: Double,
    val stone520Cm: Double,
    val sandCm: Double,
    val mixCm: Double,
    val cementRatio: Double,     // 1 : N (0 = no cement)
    val reservePct: Double,
    val diagonal: Boolean,       // diagonal / herringbone → longer cuts
    val curbLenM: Double,
    val m2PerPallet: Double,
    // prices, UAH (0 = not counted)
    val pStone2040T: Double,
    val pStone520T: Double,
    val pSandT: Double,
    val pScreenT: Double,
    val pCementBag: Double,
    val pTileM2: Double,
    val pCurbPc: Double,
    val pGeoM2: Double,
    val pLayM2: Double,          // laying labour per m²
    val pCurbWorkM: Double,      // curb install per m
    val pCutM: Double,           // cutting per running m
    val pDigM3: Double,          // excavation + removal per m³
)

data class MatResult(
    val digDepthCm: Double, val soilM3: Double,
    val geoM2: Double,
    val stone2040M3: Double, val stone2040T: Double,
    val stone520M3: Double, val stone520T: Double,
    val sandM3: Double, val sandT: Double,
    val screenM3: Double, val screenT: Double,
    val cementMixKg: Double,
    val tileM2: Double, val pallets: Int, val tileT: Double,
    val jointSandKg: Double,
    val curbM: Double, val curbPcs: Int, val curbConcreteM3: Double, val curbCementKg: Double,
    val cementBags: Int,
    val cutM: Double,
    val costs: List<Pair<String, Double>>,
) {
    val costTotal get() = costs.sumOf { it.second }
}

object Materials {
    const val STONE_COMPACTION = 1.3
    const val SAND_COMPACTION = 1.2
    const val MIX_COMPACTION = 1.2
    const val SOIL_LOOSENING = 1.25    // викопаний ґрунт розпушується
    const val STONE_DENSITY = 1.45     // т/м³ насипна
    const val SAND_DENSITY = 1.5
    const val SCREEN_DENSITY = 1.5
    const val CEMENT_DENSITY = 1300.0  // кг/м³ насипна
    const val TILE_DENSITY = 2200.0    // кг/м³ (бетонна бруківка ~2.2 т/м³)
    const val BAG_KG = 25.0
    const val CURB_CONCRETE_M3_PER_M = 0.04  // бетонна подушка + «замок» під бордюр
    const val CURB_CEMENT_KG_PER_M3 = 300.0  // ≈ М200
    const val GEO_OVERLAP = 1.15             // нахлест + заведення на борти

    fun calc(i: MatInput): MatResult {
        val a = i.area
        val digCm = i.tileMm / 10.0 + i.mixCm + i.sandCm + i.stone520Cm + i.stone2040Cm
        val soil = a * digCm / 100.0 * SOIL_LOOSENING

        val s2040 = a * i.stone2040Cm / 100.0 * STONE_COMPACTION
        val s520 = a * i.stone520Cm / 100.0 * STONE_COMPACTION
        val sand = a * i.sandCm / 100.0 * SAND_COMPACTION
        val mix = a * i.mixCm / 100.0 * MIX_COMPACTION
        val n = i.cementRatio
        val screen = if (n > 0) mix * n / (n + 1) else mix
        val cementMix = if (n > 0) mix / (n + 1) * CEMENT_DENSITY else 0.0

        val tile = a * (1 + i.reservePct / 100.0)
        val pallets = if (i.m2PerPallet > 0) ceil(tile / i.m2PerPallet).toInt() else 0
        val tileT = tile * i.tileMm / 1000.0 * TILE_DENSITY / 1000.0
        // Joint sand: ~1 kg/m² per 10 mm of tile height
        val jointSand = a * i.tileMm / 10.0

        val curbM = i.perimeter + if (i.curbAtCuts) i.cutPerimeter else 0.0
        val curbPcs = if (curbM > 0 && i.curbLenM > 0) ceil(curbM * 1.02 / i.curbLenM).toInt() else 0
        val curbConcrete = curbM * CURB_CONCRETE_M3_PER_M
        val curbCement = curbConcrete * CURB_CEMENT_KG_PER_M3

        val bags = ceil((cementMix + curbCement) / BAG_KG).toInt()
        // Cuts happen along every edge; diagonal patterns cut almost every tile on the edge
        val cutM = (i.perimeter + i.cutPerimeter) * if (i.diagonal) 1.4 else 1.0
        val geo = a * GEO_OVERLAP

        val costs = listOf(
            "Щебінь 20–40" to s2040 * STONE_DENSITY * i.pStone2040T,
            "Щебінь 5–20" to s520 * STONE_DENSITY * i.pStone520T,
            "Пісок" to (sand * SAND_DENSITY + jointSand / 1000.0) * i.pSandT,
            "Відсів" to screen * SCREEN_DENSITY * i.pScreenT,
            "Цемент" to bags * i.pCementBag,
            "Плитка" to tile * i.pTileM2,
            "Бордюр" to curbPcs * i.pCurbPc,
            "Геотекстиль" to geo * i.pGeoM2,
            "Земляні роботи + вивіз" to soil * i.pDigM3,
            "Укладання плитки" to a * i.pLayM2,
            "Монтаж бордюру" to curbM * i.pCurbWorkM,
            "Підрізка" to cutM * i.pCutM,
        ).filter { it.second > 0 }

        return MatResult(
            digDepthCm = digCm, soilM3 = soil,
            geoM2 = geo,
            stone2040M3 = s2040, stone2040T = s2040 * STONE_DENSITY,
            stone520M3 = s520, stone520T = s520 * STONE_DENSITY,
            sandM3 = sand, sandT = sand * SAND_DENSITY,
            screenM3 = screen, screenT = screen * SCREEN_DENSITY,
            cementMixKg = cementMix,
            tileM2 = tile, pallets = pallets, tileT = tileT,
            jointSandKg = jointSand,
            curbM = curbM, curbPcs = curbPcs, curbConcreteM3 = curbConcrete, curbCementKg = curbCement,
            cementBags = bags,
            cutM = cutM,
            costs = costs,
        )
    }
}
