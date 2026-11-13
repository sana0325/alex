package ua.alex.plitka

import kotlin.math.ceil

/**
 * Material estimate for paving tiles laid on a crushed-stone base
 * with a dry cement + screenings (відсів) bedding layer.
 */
data class MatInput(
    val area: Double,          // m²
    val perimeter: Double,     // m (for curbs)
    val stoneCm: Double,       // crushed stone layer, cm
    val mixCm: Double,         // bedding (screenings + cement) layer, cm
    val cementRatio: Double,   // 1 part cement : N parts screenings (0 = no cement)
    val tileReservePct: Double,
    val curbLenM: Double,      // length of one curb piece, m
    // prices (UAH); 0 = not counted
    val priceStoneT: Double,
    val priceScreenT: Double,
    val priceCementBag: Double,
    val priceTileM2: Double,
    val priceCurbPc: Double,
    val priceLabourM2: Double,
)

data class MatResult(
    val stoneM3: Double, val stoneT: Double,
    val screenM3: Double, val screenT: Double,
    val cementKg: Double, val cementBags: Int,
    val tileM2: Double,
    val curbPcs: Int,
    val geotextileM2: Double,
    val costStone: Double, val costScreen: Double, val costCement: Double,
    val costTile: Double, val costCurb: Double, val costLabour: Double,
) {
    val costMaterials get() = costStone + costScreen + costCement + costTile + costCurb
    val costTotal get() = costMaterials + costLabour
}

object Materials {
    const val STONE_COMPACTION = 1.3   // щебінь ущільнюється ~на 30%
    const val MIX_COMPACTION = 1.2
    const val STONE_DENSITY = 1.45     // т/м³ насипна
    const val SCREEN_DENSITY = 1.5     // т/м³
    const val CEMENT_DENSITY = 1300.0  // кг/м³ насипна
    const val BAG_KG = 25.0

    fun calc(i: MatInput): MatResult {
        val stoneM3 = i.area * i.stoneCm / 100.0 * STONE_COMPACTION
        val mixM3 = i.area * i.mixCm / 100.0 * MIX_COMPACTION
        val n = i.cementRatio
        val screenM3 = if (n > 0) mixM3 * n / (n + 1) else mixM3
        val cementKg = if (n > 0) mixM3 / (n + 1) * CEMENT_DENSITY else 0.0
        val bags = ceil(cementKg / BAG_KG).toInt()
        val stoneT = stoneM3 * STONE_DENSITY
        val screenT = screenM3 * SCREEN_DENSITY
        val tile = i.area * (1 + i.tileReservePct / 100.0)
        val curbs = if (i.perimeter > 0 && i.curbLenM > 0) ceil(i.perimeter / i.curbLenM).toInt() else 0
        return MatResult(
            stoneM3 = stoneM3, stoneT = stoneT,
            screenM3 = screenM3, screenT = screenT,
            cementKg = cementKg, cementBags = bags,
            tileM2 = tile,
            curbPcs = curbs,
            geotextileM2 = i.area * 1.1,
            costStone = stoneT * i.priceStoneT,
            costScreen = screenT * i.priceScreenT,
            costCement = bags * i.priceCementBag,
            costTile = tile * i.priceTileM2,
            costCurb = curbs * i.priceCurbPc,
            costLabour = i.area * i.priceLabourM2,
        )
    }
}
