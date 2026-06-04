package com.goldscalp.bot.api

import retrofit2.Response
import retrofit2.http.*

interface MT5ApiService {

    @POST("auth/login")
    suspend fun login(@Body request: MT5AuthRequest): Response<MT5AuthResponse>

    @GET("quotes/{symbol}")
    suspend fun getQuote(
        @Path("symbol") symbol: String,
        @Header("Authorization") token: String
    ): Response<MT5Quote>

    @GET("history/{symbol}")
    suspend fun getCandles(
        @Path("symbol") symbol: String,
        @Query("timeframe") timeframe: String,
        @Query("count") count: Int,
        @Header("Authorization") token: String
    ): Response<MT5CandleResponse>

    @POST("orders/open")
    suspend fun openOrder(
        @Body request: MT5OrderRequest,
        @Header("Authorization") token: String
    ): Response<MT5OrderResponse>

    @PUT("positions/modify")
    suspend fun modifyPosition(
        @Body request: MT5ModifyRequest,
        @Header("Authorization") token: String
    ): Response<MT5OrderResponse>

    @POST("positions/close")
    suspend fun closePosition(
        @Body request: MT5CloseRequest,
        @Header("Authorization") token: String
    ): Response<MT5OrderResponse>

    @GET("positions")
    suspend fun getPositions(
        @Header("Authorization") token: String
    ): Response<List<MT5PositionData>>

    @GET("account")
    suspend fun getAccount(
        @Header("Authorization") token: String
    ): Response<MT5Account>
}
