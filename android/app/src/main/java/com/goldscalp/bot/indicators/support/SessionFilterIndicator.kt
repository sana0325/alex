package com.goldscalp.bot.indicators.support

import com.goldscalp.bot.indicators.BaseIndicator
import com.goldscalp.bot.models.Candle
import com.goldscalp.bot.models.IndicatorVote
import com.goldscalp.bot.models.SignalDirection
import java.util.Calendar
import java.util.TimeZone

/** Support 32: Trading session time filter (London + NY overlap) */
class SessionFilterIndicator(
    private val startHour: Int = 7,
    private val endHour: Int = 20
) : BaseIndicator() {
    override val name = "Session Filter"
    override val isSignal = false

    override fun calculate(candles: List<Candle>): IndicatorVote {
        val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
        val hour = cal.get(Calendar.HOUR_OF_DAY)
        val inSession = hour in startHour until endHour
        return IndicatorVote(name, SignalDirection.NONE, if (inSession) 1.0 else 0.0,
            "UTC hour=$hour inSession=$inSession")
    }

    fun isInSession(): Boolean {
        val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
        val hour = cal.get(Calendar.HOUR_OF_DAY)
        return hour in startHour until endHour
    }
}
