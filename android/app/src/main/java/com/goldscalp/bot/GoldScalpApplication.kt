package com.goldscalp.bot

import android.app.Application
import com.goldscalp.bot.data.db.AppDatabase

class GoldScalpApplication : Application() {
    val database: AppDatabase by lazy { AppDatabase.getInstance(this) }
}
