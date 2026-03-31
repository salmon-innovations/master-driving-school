package com.masterdriving.app.auth

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.masterdriving.app.network.ApiService

class ForgotPasswordActivity : AppCompatActivity() {

    private lateinit var apiService: ApiService

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        apiService = ApiService(this)
        // For simplicity use register layout but override title
        // In production you'd have a dedicated layout
        finish() // placeholder — layout not shown for brevity
    }
}
