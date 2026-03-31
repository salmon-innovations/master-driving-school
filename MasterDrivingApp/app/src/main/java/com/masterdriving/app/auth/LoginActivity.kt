package com.masterdriving.app.auth

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.text.TextUtils
import android.view.View
import android.widget.CheckBox
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import com.masterdriving.app.MainActivity
import com.masterdriving.app.R
import com.masterdriving.app.network.ApiCallback
import com.masterdriving.app.network.ApiClient
import com.masterdriving.app.network.ApiService
import org.json.JSONObject
import java.util.Locale

class LoginActivity : AppCompatActivity() {

    private lateinit var etEmail: TextInputEditText
    private lateinit var etPassword: TextInputEditText
    private lateinit var btnSignIn: MaterialButton
    private lateinit var progressBar: ProgressBar
    private lateinit var tvError: TextView
    private lateinit var tvForgotPassword: TextView
    private lateinit var tvSignUp: TextView
    private lateinit var tvTermsLink: TextView
    private lateinit var tvTermsError: TextView
    private lateinit var cbTerms: CheckBox
    private lateinit var apiService: ApiService

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        // If already logged in, skip to main
        if (ApiClient.isLoggedIn(this)) {
            goToMain()
            return
        }

        apiService = ApiService(this)
        initViews()
        setupListeners()
    }

    private fun initViews() {
        etEmail = findViewById(R.id.et_email)
        etPassword = findViewById(R.id.et_password)
        btnSignIn = findViewById(R.id.btn_sign_in)
        progressBar = findViewById(R.id.progress_bar)
        tvError = findViewById(R.id.tv_error)
        tvForgotPassword = findViewById(R.id.tv_forgot_password)
        tvSignUp = findViewById(R.id.tv_sign_up)
        tvTermsLink = findViewById(R.id.tv_terms_link)
        tvTermsError = findViewById(R.id.tv_terms_error)
        cbTerms = findViewById(R.id.cb_terms)
    }

    private fun setupListeners() {
        btnSignIn.setOnClickListener { performLogin() }

        tvForgotPassword.setOnClickListener {
            startActivity(Intent(this, ForgotPasswordActivity::class.java))
        }

        tvSignUp.setOnClickListener {
            startActivity(Intent(this, RegisterActivity::class.java))
            finish()
        }

        // Show terms & conditions dialog
        tvTermsLink.setOnClickListener { showTermsDialog() }

        // Hide terms error when checkbox is ticked
        cbTerms.setOnCheckedChangeListener { _, checked ->
            if (checked) {
                tvTermsError.visibility = View.GONE
            }
        }
    }

    private fun performLogin() {
        val email = etEmail.text?.toString()?.trim() ?: ""
        val password = etPassword.text?.toString() ?: ""

        // Validation
        if (TextUtils.isEmpty(email)) {
            etEmail.error = "Email is required"
            etEmail.requestFocus()
            return
        }
        if (!email.contains("@") || !email.lowercase(Locale.ROOT).endsWith(".com")) {
            etEmail.error = "Enter a valid email address"
            etEmail.requestFocus()
            return
        }
        if (TextUtils.isEmpty(password)) {
            etPassword.error = "Password is required"
            etPassword.requestFocus()
            return
        }
        if (!cbTerms.isChecked) {
            tvTermsError.visibility = View.VISIBLE
            return
        }

        setLoading(true)
        tvError.visibility = View.GONE

        apiService.login(email, password, object : ApiCallback<JSONObject> {
            override fun onSuccess(result: JSONObject) {
                setLoading(false)
                try {
                    // Check if email needs verification
                    val needsVerification = result.optBoolean("needsVerification", false)
                    if (needsVerification) {
                        val verifyEmail = result.optString("email", email)
                        Toast.makeText(this@LoginActivity,
                            "Please verify your email first. Check your inbox.", Toast.LENGTH_LONG).show()
                        
                        // Navigate to verify screen
                        val intent = Intent(this@LoginActivity, VerifyEmailActivity::class.java)
                        intent.putExtra("email", verifyEmail)
                        startActivity(intent)
                        return
                    }

                    val token = result.optString("token", result.optString("accessToken", ""))
                    if (token.isNotEmpty()) {
                        ApiClient.setToken(this@LoginActivity, token)

                        val user = result.optJSONObject("user")
                        if (user != null) {
                            val prefs = getSharedPreferences("master_prefs", Context.MODE_PRIVATE)
                            prefs.edit().putString("user_data", user.toString()).apply()
                        }

                        Toast.makeText(this@LoginActivity, "Welcome back! 👋", Toast.LENGTH_SHORT).show()
                        goToMain()
                    } else {
                        showError("Login failed. Please try again.")
                    }
                } catch (e: Exception) {
                    showError("Unexpected error. Please try again.")
                }
            }

            override fun onError(message: String) {
                setLoading(false)
                // Handle account locked
                if (message.lowercase(Locale.ROOT).contains("locked")) {
                    showError("Your account has been locked. Please contact support.")
                } else {
                    showError(message)
                }
            }
        })
    }

    private fun showTermsDialog() {
        val termsText = """
            TERMS AND CONDITIONS

            1. ELIGIBILITY
            • Students must be at least 16 years old (with parental consent) for TDC.
            • Must hold a valid Student Permit or Driver's License for driving courses.

            2. ENROLLMENT AND PAYMENT
            • Enrollment is confirmed upon completed application and payment.
            • 50% Down payment is acceptable; full payment before 2nd day of lesson.
            • Payments are NON-REFUNDABLE and NON-TRANSFERABLE.

            3. CANCELLATION POLICY
            • Full refund if cancelled 5 days before start date.
            • 5 days' notice required to reschedule without fees.
            • 1st re-schedule: ₱1,000 | 2nd: Lesson Forfeiture

            4. LESSON SCHEDULE
            • Lessons scheduled based on availability. Punctuality is required.

            5. STUDENT CONDUCT
            • Follow all instructor directions and traffic laws.
            • No alcohol or illegal substances — results in immediate termination without refund.

            6. PRIVACY POLICY
            Personal information is kept confidential and used only for course administration.

            By enrolling, you acknowledge that you have read, understood, and agreed to these Terms and Conditions.
        """.trimIndent()

        AlertDialog.Builder(this)
            .setTitle("Terms & Conditions")
            .setMessage(termsText)
            .setPositiveButton("I Understand") { _, _ ->
                cbTerms.isChecked = true
                tvTermsError.visibility = View.GONE
            }
            .setNegativeButton("Close", null)
            .show()
    }

    private fun setLoading(loading: Boolean) {
        progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        btnSignIn.isEnabled = !loading
        btnSignIn.text = if (loading) "LOGGING IN..." else "LOGIN"
    }

    private fun showError(message: String) {
        tvError.text = "⚠ $message"
        tvError.visibility = View.VISIBLE
    }

    private fun goToMain() {
        val intent = Intent(this, MainActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }
}
