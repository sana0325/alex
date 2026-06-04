package com.goldscalp.bot.data.db

import android.content.Context
import androidx.room.*
import com.goldscalp.bot.models.Position

@Dao
interface PositionDao {
    @Query("SELECT * FROM positions ORDER BY openTime DESC")
    suspend fun getAll(): List<Position>

    @Query("SELECT * FROM positions WHERE state = 'OPEN'")
    suspend fun getOpen(): List<Position>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(position: Position)

    @Update
    suspend fun update(position: Position)

    @Query("SELECT SUM(profit) FROM positions WHERE state = 'CLOSED' AND openTime > :sinceMs")
    suspend fun getTotalProfitSince(sinceMs: Long): Double?

    @Query("SELECT COUNT(*) FROM positions WHERE state = 'CLOSED' AND openTime > :sinceMs")
    suspend fun getTradeCountSince(sinceMs: Long): Int
}

@Database(entities = [Position::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun positionDao(): PositionDao

    companion object {
        @Volatile private var instance: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase {
            return instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "gold_scalp_db"
                ).build().also { instance = it }
            }
        }
    }
}
