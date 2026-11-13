package ua.alex.plitka

import android.content.Context
import android.graphics.Canvas
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Path
import android.view.View

/** 2D overlay: polygon from the placed points, a line to the cursor, and the crosshair. */
class OverlayView(context: Context) : View(context) {
    /** Screen coordinates of placed points: [x0, y0, x1, y1, ...]; NaN means behind the camera. */
    @Volatile var points: FloatArray = FloatArray(0)
    @Volatile var cursor: FloatArray? = null
    @Volatile var hasHit: Boolean = false

    private val d = resources.displayMetrics.density
    private val line = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFFFFD600.toInt(); strokeWidth = 4 * d; style = Paint.Style.STROKE
    }
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0x33FFD600; style = Paint.Style.FILL
    }
    private val dashed = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFFFFFFFF.toInt(); strokeWidth = 3 * d; style = Paint.Style.STROKE
        pathEffect = DashPathEffect(floatArrayOf(12 * d, 8 * d), 0f)
    }
    private val dot = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFFFD600.toInt() }
    private val dotRing = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFF000000.toInt(); style = Paint.Style.STROKE; strokeWidth = 2 * d
    }
    private val cross = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        strokeWidth = 3 * d; style = Paint.Style.STROKE
    }

    override fun onDraw(c: Canvas) {
        val p = points
        val n = p.size / 2
        val valid = (0 until n).all { !p[it * 2].isNaN() }

        if (n >= 2 && valid) {
            val path = Path()
            path.moveTo(p[0], p[1])
            for (i in 1 until n) path.lineTo(p[i * 2], p[i * 2 + 1])
            if (n >= 3) {
                path.close()
                c.drawPath(path, fill)
            }
            c.drawPath(path, line)
        }

        val cur = cursor
        if (n >= 1 && cur != null && hasHit && !p[(n - 1) * 2].isNaN()) {
            c.drawLine(p[(n - 1) * 2], p[(n - 1) * 2 + 1], cur[0], cur[1], dashed)
            if (n >= 2 && !p[0].isNaN()) c.drawLine(cur[0], cur[1], p[0], p[1], dashed)
        }

        for (i in 0 until n) {
            if (p[i * 2].isNaN()) continue
            c.drawCircle(p[i * 2], p[i * 2 + 1], 8 * d, dot)
            c.drawCircle(p[i * 2], p[i * 2 + 1], 8 * d, dotRing)
        }

        // Crosshair in the screen centre
        val cx = width / 2f
        val cy = height / 2f
        cross.color = if (hasHit) 0xFF00E676.toInt() else 0xFFFF5252.toInt()
        val r = 18 * d
        c.drawCircle(cx, cy, r, cross)
        c.drawLine(cx - r * 1.6f, cy, cx - r * 0.5f, cy, cross)
        c.drawLine(cx + r * 0.5f, cy, cx + r * 1.6f, cy, cross)
        c.drawLine(cx, cy - r * 1.6f, cx, cy - r * 0.5f, cross)
        c.drawLine(cx, cy + r * 0.5f, cx, cy + r * 1.6f, cross)
    }
}
