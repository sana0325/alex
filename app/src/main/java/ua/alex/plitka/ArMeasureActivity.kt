package ua.alex.plitka

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.pm.PackageManager
import android.graphics.Color
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.opengl.Matrix
import android.os.Bundle
import android.os.SystemClock
import android.view.Gravity
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import com.google.ar.core.Anchor
import com.google.ar.core.ArCoreApk
import com.google.ar.core.Config
import com.google.ar.core.HitResult
import com.google.ar.core.Plane
import com.google.ar.core.Session
import com.google.ar.core.TrackingState
import com.google.ar.core.exceptions.CameraNotAvailableException
import com.google.ar.core.exceptions.UnavailableDeviceNotCompatibleException
import com.google.ar.core.exceptions.UnavailableUserDeclinedInstallationException
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10

class ArMeasureActivity : Activity(), GLSurfaceView.Renderer {
    private lateinit var glView: GLSurfaceView
    private lateinit var overlay: OverlayView
    private lateinit var info: TextView

    private var session: Session? = null
    private var installRequested = false
    private val bg = BackgroundRenderer()

    /** One measured zone; cut = subtracted (building, flowerbed, well…). */
    private class Contour(var cut: Boolean, val anchors: MutableList<Anchor> = mutableListOf())

    private val contours = mutableListOf(Contour(false))
    @Volatile private var newZoneRequest = 0   // 0 = none, 1 = add zone, -1 = cut zone
    @Volatile private var addRequested = false
    @Volatile private var undoRequested = false
    @Volatile private var geometryChanged = true
    private var viewW = 0
    private var viewH = 0

    @Volatile private var lastArea = 0.0
    @Volatile private var lastPerimeter = 0.0
    @Volatile private var lastCutPerimeter = 0.0
    @Volatile private var openZonePoints = 0
    private var lastUiUpdate = 0L

    private val viewM = FloatArray(16)
    private val projM = FloatArray(16)
    private val vpM = FloatArray(16)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = FrameLayout(this)

        glView = GLSurfaceView(this).apply {
            preserveEGLContextOnPause = true
            setEGLContextClientVersion(2)
            setEGLConfigChooser(8, 8, 8, 8, 16, 0)
            setRenderer(this@ArMeasureActivity)
            renderMode = GLSurfaceView.RENDERMODE_CONTINUOUSLY
        }
        root.addView(glView)

        overlay = OverlayView(this)
        root.addView(overlay)

        info = TextView(this).apply {
            setTextColor(Color.WHITE)
            textSize = 16f
            setBackgroundColor(0xAA000000.toInt())
            val p = Ui.dp(this@ArMeasureActivity, 12)
            setPadding(p, p, p, p)
            text = "Повільно поводи телефоном над землею, поки приціл не стане зеленим"
        }
        root.addView(info, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP))

        val bottom = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            val p = Ui.dp(this@ArMeasureActivity, 8)
            setPadding(p, p, p, p)
        }
        val bar2 = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, Ui.dp(this@ArMeasureActivity, 6), 0, 0)
        }
        fun weighted() = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
            marginStart = Ui.dp(this@ArMeasureActivity, 4); marginEnd = Ui.dp(this@ArMeasureActivity, 4)
        }
        bar2.addView(Ui.button(this, "＋ Нова зона", 0xFF1565C0.toInt()) { newZoneRequest = 1 }, weighted())
        bar2.addView(Ui.button(this, "− Виріз (будинок)", 0xFFC62828.toInt()) { newZoneRequest = -1 }, weighted())
        bar.addView(Ui.button(this, "↶ Назад", Ui.GRAY) { undoRequested = true }, weighted())
        bar.addView(Ui.button(this, "＋ Точка", Ui.ORANGE) { addRequested = true }, weighted())
        bar.addView(Ui.button(this, "✔ Готово") { finishMeasure() }, weighted())
        bottom.addView(bar2)
        bottom.addView(bar)
        root.addView(bottom, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM))

        setContentView(root)
    }

    override fun onResume() {
        super.onResume()
        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.CAMERA), 1)
            return
        }
        if (session == null) {
            try {
                if (ArCoreApk.getInstance().requestInstall(this, !installRequested) ==
                    ArCoreApk.InstallStatus.INSTALL_REQUESTED
                ) {
                    installRequested = true
                    return
                }
                val s = Session(this)
                val cfg = Config(s).apply {
                    planeFindingMode = Config.PlaneFindingMode.HORIZONTAL
                    focusMode = Config.FocusMode.AUTO
                    updateMode = Config.UpdateMode.LATEST_CAMERA_IMAGE
                }
                s.configure(cfg)
                session = s
            } catch (e: UnavailableDeviceNotCompatibleException) {
                fail("Цей телефон не підтримує AR (ARCore). Скористайся ручним вводом розмірів.")
                return
            } catch (e: UnavailableUserDeclinedInstallationException) {
                fail("Для AR-заміру потрібні «Сервіси Google Play для AR».")
                return
            } catch (e: Exception) {
                fail("Не вдалося запустити AR: ${e.message}")
                return
            }
        }
        try {
            session?.resume()
        } catch (e: CameraNotAvailableException) {
            session = null
            fail("Камера недоступна. Закрий інші програми, що використовують камеру.")
            return
        }
        glView.onResume()
    }

    override fun onPause() {
        super.onPause()
        if (session != null) {
            glView.onPause()
            session?.pause()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        session?.close()
        session = null
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (grantResults.isEmpty() || grantResults[0] != PackageManager.PERMISSION_GRANTED) {
            Toast.makeText(this, "Без доступу до камери AR-замір не працює", Toast.LENGTH_LONG).show()
            finish()
        }
    }

    private fun fail(msg: String) {
        AlertDialog.Builder(this)
            .setTitle("AR недоступний")
            .setMessage(msg)
            .setCancelable(false)
            .setPositiveButton("OK") { _, _ -> finish() }
            .show()
    }

    private fun finishMeasure() {
        if (openZonePoints in 1..2) {
            Toast.makeText(this, "Поточна зона незакінчена — потрібно мінімум 3 точки", Toast.LENGTH_SHORT).show()
            return
        }
        if (lastArea <= 0.0) {
            Toast.makeText(this, "Постав мінімум 3 точки по кутах ділянки", Toast.LENGTH_SHORT).show()
            return
        }
        CalcActivity.start(this, lastArea, lastPerimeter, lastCutPerimeter)
    }

    // ---------------- GL thread ----------------

    override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
        GLES20.glClearColor(0f, 0f, 0f, 1f)
        bg.createOnGlThread()
    }

    override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
        GLES20.glViewport(0, 0, width, height)
        viewW = width
        viewH = height
        geometryChanged = true
    }

    @Suppress("DEPRECATION")
    override fun onDrawFrame(gl: GL10?) {
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT or GLES20.GL_DEPTH_BUFFER_BIT)
        val s = session ?: return
        if (geometryChanged) {
            s.setDisplayGeometry(windowManager.defaultDisplay.rotation, viewW, viewH)
            geometryChanged = false
        }
        s.setCameraTextureName(bg.textureId)

        val frame = try { s.update() } catch (e: Exception) { return }
        bg.draw(frame)

        val cam = frame.camera
        if (cam.trackingState != TrackingState.TRACKING) {
            overlay.hasHit = false
            overlay.cursor = null
            overlay.postInvalidate()
            ui("Повільно поводи телефоном над землею… (мало світла чи однотонна поверхня заважають)")
            return
        }
        cam.getViewMatrix(viewM, 0)
        cam.getProjectionMatrix(projM, 0, 0.05f, 100f)
        Matrix.multiplyMM(vpM, 0, projM, 0, viewM, 0)

        val hit: HitResult? = frame.hitTest(viewW / 2f, viewH / 2f).firstOrNull { h ->
            val t = h.trackable
            t is Plane && t.isPoseInPolygon(h.hitPose) && t.type == Plane.Type.HORIZONTAL_UPWARD_FACING
        }

        val toast: String? = synchronized(contours) {
            var msg: String? = null
            val cur = contours.last()
            if (undoRequested) {
                undoRequested = false
                if (cur.anchors.isNotEmpty()) cur.anchors.removeAt(cur.anchors.size - 1).detach()
                else if (contours.size > 1) contours.removeAt(contours.size - 1)
            }
            if (addRequested) {
                addRequested = false
                if (hit != null) contours.last().anchors.add(hit.createAnchor())
                else msg = "Поверхню ще не знайдено — приціл має бути зеленим"
            }
            val req = newZoneRequest
            if (req != 0) {
                newZoneRequest = 0
                val last = contours.last()
                when {
                    last.anchors.isEmpty() -> last.cut = req < 0
                    last.anchors.size < 3 -> msg = "Спочатку закінчи поточну зону (мінімум 3 точки)"
                    else -> contours.add(Contour(req < 0))
                }
                if (msg == null) msg = if (req < 0) "Виріз: обведи будинок / клумбу по кутах" else "Нова зона: обведи її по кутах"
            }
            msg
        }
        if (toast != null) runOnUiThread { Toast.makeText(this, toast, Toast.LENGTH_SHORT).show() }

        // Snapshot world points of every zone
        class Z(val cut: Boolean, val pts: List<FloatArray>)
        val zones: List<Z> = synchronized(contours) {
            contours.map { c -> Z(c.cut, c.anchors.map { a -> a.pose.let { p -> floatArrayOf(p.tx(), p.ty(), p.tz()) } }) }
        }

        overlay.polys = zones.map { z ->
            val sc = FloatArray(z.pts.size * 2)
            z.pts.forEachIndexed { i, w ->
                val sp = project(w)
                sc[i * 2] = sp?.get(0) ?: Float.NaN
                sc[i * 2 + 1] = sp?.get(1) ?: Float.NaN
            }
            ScreenPoly(sc, z.cut)
        }
        val cursorWorld = hit?.hitPose?.let { floatArrayOf(it.tx(), it.ty(), it.tz()) }
        overlay.cursor = cursorWorld?.let { project(it) }
        overlay.hasHit = hit != null
        overlay.postInvalidate()

        var addArea = 0.0
        var cutArea = 0.0
        var addPerim = 0.0
        var cutPerim = 0.0
        for (z in zones) {
            if (z.pts.size < 3) continue
            if (z.cut) { cutArea += Geo.area(z.pts); cutPerim += Geo.perimeter(z.pts) }
            else { addArea += Geo.area(z.pts); addPerim += Geo.perimeter(z.pts) }
        }
        val total = (addArea - cutArea).coerceAtLeast(0.0)
        lastArea = total
        lastPerimeter = addPerim
        lastCutPerimeter = cutPerim
        val current = zones.last()
        openZonePoints = current.pts.size

        val sb = StringBuilder()
        val zoneNo = zones.size
        sb.append(if (current.cut) "✂ Виріз" else "▦ Зона").append(" $zoneNo, точок: ${current.pts.size}")
        if (current.pts.isNotEmpty() && cursorWorld != null) {
            sb.append("   Відрізок: ${Ui.fmt(Geo.dist(current.pts.last(), cursorWorld))} м")
        }
        sb.append("\nПлоща: ${Ui.fmt(total)} м²")
        if (cutArea > 0) sb.append("  (${Ui.fmt(addArea)} − ${Ui.fmt(cutArea)})")
        if (addPerim > 0) sb.append("\nПериметр: ${Ui.fmt(addPerim)} м")
        if (cutPerim > 0) sb.append("   навколо вирізів: ${Ui.fmt(cutPerim)} м")
        if (zones.size == 1 && current.pts.isEmpty()) {
            sb.append(if (hit != null) "\nНаведи приціл на перший кут і натисни «＋ Точка»"
                      else "\nШукаю поверхню… поводи телефоном")
        }
        ui(sb.toString())
    }

    /** World point -> screen pixels, or null if behind the camera. */
    private fun project(w: FloatArray): FloatArray? {
        val v = floatArrayOf(w[0], w[1], w[2], 1f)
        val out = FloatArray(4)
        Matrix.multiplyMV(out, 0, vpM, 0, v, 0)
        if (out[3] <= 0f) return null
        val nx = out[0] / out[3]
        val ny = out[1] / out[3]
        return floatArrayOf((nx + 1f) / 2f * viewW, (1f - ny) / 2f * viewH)
    }

    private fun ui(text: String) {
        val now = SystemClock.uptimeMillis()
        if (now - lastUiUpdate < 120) return
        lastUiUpdate = now
        runOnUiThread { info.text = text }
    }
}
