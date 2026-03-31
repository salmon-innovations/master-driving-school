package com.masterdriving.app.network

import android.content.Context
import android.content.SharedPreferences
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import java.util.concurrent.TimeUnit

object ApiClient {

    // ✅ Correct Render backend URL
    const val BASE_URL = "https://booking-system-ej5o.onrender.com/api"

    private var client: OkHttpClient? = null

    @JvmStatic
    fun getClient(context: Context): OkHttpClient {
        return client ?: synchronized(this) {
            val logging = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            }

            val newClient = OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .addInterceptor(logging)
                .addInterceptor { chain ->
                    val original = chain.request()
                    val builder = original.newBuilder()
                        .header("Content-Type", "application/json")
                        .header("Accept", "application/json")

                    val token = getToken(context)
                    if (!token.isNullOrEmpty()) {
                        builder.header("Authorization", "Bearer $token")
                    }

                    chain.proceed(builder.build())
                }
                .build()
            client = newClient
            newClient
        }
    }

    @JvmStatic
    fun getToken(context: Context): String? {
        val prefs = context.getSharedPreferences("master_prefs", Context.MODE_PRIVATE)
        return prefs.getString("auth_token", null)
    }

    @JvmStatic
    fun setToken(context: Context, token: String?) {
        val prefs = context.getSharedPreferences("master_prefs", Context.MODE_PRIVATE)
        prefs.edit().putString("auth_token", token).apply()
        client = null // reset client so next request picks up the new token
    }

    @JvmStatic
    fun clearToken(context: Context) {
        val prefs = context.getSharedPreferences("master_prefs", Context.MODE_PRIVATE)
        prefs.edit().remove("auth_token").remove("user_data").apply()
        client = null
    }

    @JvmStatic
    fun isLoggedIn(context: Context): Boolean {
        return !getToken(context).isNullOrEmpty()
    }
}
