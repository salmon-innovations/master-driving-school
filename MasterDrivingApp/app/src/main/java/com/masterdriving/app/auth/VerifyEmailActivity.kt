package com.masterdriving.app.auth

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

class VerifyEmailActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val email = intent.getStringExtra("email")
        // Display OTP verification UI - simple placeholder
        finish()
    }
}
