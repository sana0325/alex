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

    private val anchors = mutableListOf<Anchor>()
    @Volatile private var addRequested = false
    @Volatile private var undoRequested = false
    @Volatile private var geometryChanged = true
    private var viewW = 0
    private var viewH = 0

    @Volatile private var lastArea = 0.0
    @Volatile private var lastPerimeter = 0.0
    @Volatile private var pointCount = 0
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

        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            val p = Ui.dp(this@ArMeasureActivity, 12)
            setPadding(p, p, p, p)
        }
        fun weighted() = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
            marginStart = Ui.dp(this@ArMeasureActivity, 4); marginEnd = Ui.dp(this@ArMeasureActivity, 4)
        }
        bar.addView(Ui.button(this, "↶ Назад", Ui.GRAY) { undoRequested = true }, weighted())
        bar.addView(Ui.button(this, "＋ Точка", Ui.ORANGE) { addRequested = true }, weighted())
        bar.addView(Ui.button(this, "✔ Готово") { finishMeasure() }, weighted())
        root.addView(bar, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM))

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
        if (pointCount < 3) {
            Toast.makeText(this, "Постав мінімум 3 точки по кутах ділянки", Toast.LENGTH_SHORT).show()
            return
        }
        CalcActivity.start(this, lastArea, lastPerimeter)
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

        if (undoRequested) {
            undoRequested = false
            synchronized(anchors) { if (anchors.isNotEmpty()) anchors.removeAt(anchors.size - 1).detach() }
        }
        if (addRequested) {
            addRequested = false
            if (hit != null) {
                synchronized(anchors) { anchors.add(hit.createAnchor()) }
            } else {
                runOnUiThread { Toast.makeText(this, "Поверхню ще не знайдено — приціл має бути зеленим", Toast.LENGTH_SHORT).show() }
            }
        }

        val world: List<FloatArray> = synchronized(anchors) {
            anchors.map { a -> a.pose.let { p -> floatArrayOf(p.tx(), p.ty(), p.tz()) } }
        }
        val screen = FloatArray(world.size * 2)
        world.forEachIndexed { i, w ->
            val sp = project(w)
            screen[i * 2] = sp?.get(0) ?: Float.NaN
            screen[i * 2 + 1] = sp?.get(1) ?: Float.NaN
        }

        val cursorWorld = hit?.hitPose?.let { floatArrayOf(it.tx(), it.ty(), it.tz()) }
        overlay.points = screen
        overlay.cursor = cursorWorld?.let { project(it) }
        overlay.hasHit = hit != null
        overlay.postInvalidate()

        val area = Geo.area(world)
        val perim = Geo.perimeter(world)
        lastArea = area
        lastPerimeter = perim
        pointCount = world.size

        val sb = StringBuilder()
        sb.append("Точок: ${world.size}")
        if (world.size >= 3) sb.append("   Площа: ${Ui.fmt(area)} м²")
        if (world.size >= 2) sb.append("\nПериметр: ${Ui.fmt(perim)} м")
        if (world.isNotEmpty() && cursorWorld != null) {
            sb.append("   Відрізок: ${Ui.fmt(Geo.dist(world.last(), cursorWorld))} м")
        }
        if (world.isEmpty()) {
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
