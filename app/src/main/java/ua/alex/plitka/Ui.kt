package ua.alex.plitka

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.InputType
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView

object Ui {
    const val GREEN = 0xFF2E7D32.toInt()
    const val GRAY = 0xFF616161.toInt()
    const val ORANGE = 0xFFEF6C00.toInt()

    fun dp(c: Context, v: Int): Int = (v * c.resources.displayMetrics.density).toInt()

    fun button(c: Context, text: String, color: Int = GREEN, onClick: () -> Unit): Button =
        Button(c).apply {
            this.text = text
            isAllCaps = false
            textSize = 17f
            setTextColor(Color.WHITE)
            background = GradientDrawable().apply {
                setColor(color)
                cornerRadius = dp(c, 12).toFloat()
            }
            setPadding(dp(c, 12), dp(c, 14), dp(c, 12), dp(c, 14))
            setOnClickListener { onClick() }
        }

    fun text(c: Context, s: String, size: Float = 15f, bold: Boolean = false, color: Int = 0xFF212121.toInt()): TextView =
        TextView(c).apply {
            text = s
            textSize = size
            setTextColor(color)
            if (bold) setTypeface(typeface, Typeface.BOLD)
        }

    fun number(c: Context, hint: String, value: String = ""): EditText =
        EditText(c).apply {
            this.hint = hint
            setText(value)
            inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL
            textSize = 17f
            setSingleLine()
        }

    /** Row: label on the left, field on the right. */
    fun row(c: Context, label: String, field: EditText): LinearLayout =
        LinearLayout(c).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(text(c, label), LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.4f))
            addView(field, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        }

    fun lp(c: Context, top: Int = 8): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
            .apply { topMargin = dp(c, top) }

    fun parse(e: EditText): Double =
        e.text.toString().trim().replace(',', '.').toDoubleOrNull() ?: 0.0

    fun fmt(v: Double, digits: Int = 2): String =
        String.format(java.util.Locale.US, "%.${digits}f", v).trimEnd('0').trimEnd('.').ifEmpty { "0" }
}
