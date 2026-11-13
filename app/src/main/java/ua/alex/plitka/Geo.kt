package ua.alex.plitka

import kotlin.math.abs
import kotlin.math.sqrt

/** Geometry on world points (x, y, z) in metres; the ground is the x–z plane. */
object Geo {
    fun dist(a: FloatArray, b: FloatArray): Double {
        val dx = (a[0] - b[0]).toDouble()
        val dy = (a[1] - b[1]).toDouble()
        val dz = (a[2] - b[2]).toDouble()
        return sqrt(dx * dx + dy * dy + dz * dz)
    }

    /** Area of the closed polygon projected onto the horizontal plane (shoelace). */
    fun area(pts: List<FloatArray>): Double {
        if (pts.size < 3) return 0.0
        var s = 0.0
        for (i in pts.indices) {
            val a = pts[i]
            val b = pts[(i + 1) % pts.size]
            s += a[0].toDouble() * b[2] - b[0].toDouble() * a[2]
        }
        return abs(s) / 2.0
    }

    /** Perimeter of the closed polygon. */
    fun perimeter(pts: List<FloatArray>): Double {
        if (pts.size < 2) return 0.0
        var p = 0.0
        for (i in 0 until pts.size - 1) p += dist(pts[i], pts[i + 1])
        if (pts.size >= 3) p += dist(pts.last(), pts.first())
        return p
    }
}
