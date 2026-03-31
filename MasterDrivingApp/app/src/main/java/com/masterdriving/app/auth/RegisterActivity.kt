package com.masterdriving.app.auth

import android.content.Intent
import android.content.res.ColorStateList
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import com.masterdriving.app.R
import com.masterdriving.app.network.ApiCallback
import com.masterdriving.app.network.ApiService
import org.json.JSONObject
import java.util.Locale

class RegisterActivity : AppCompatActivity() {

    // Step tracking
    private var currentStep = 1
    private val TOTAL_STEPS = 3

    // Step panels
    private lateinit var step1Layout: View
    private lateinit var step2Layout: View
    private lateinit var step3Layout: View

    // Step 1 — Personal
    private lateinit var etFirstName: TextInputEditText
    private lateinit var etMiddleName: TextInputEditText
    private lateinit var etLastName: TextInputEditText
    private lateinit var etBirthday: TextInputEditText
    private lateinit var etNationality: TextInputEditText
    private lateinit var btnGenderMale: MaterialButton
    private lateinit var btnGenderFemale: MaterialButton
    private lateinit var spCivilStatus: Spinner
    private var selectedGender = ""

    // Step 2 — Address & Contact
    private lateinit var etAddress: TextInputEditText
    private lateinit var etZipCode: TextInputEditText
    private lateinit var etBirthPlace: TextInputEditText
    private lateinit var etPhone: TextInputEditText
    private lateinit var etEmail: TextInputEditText
    private lateinit var etEmergencyPerson: TextInputEditText
    private lateinit var etEmergencyNumber: TextInputEditText

    // Step 3 — Account Setup
    private lateinit var etPassword: TextInputEditText
    private lateinit var etConfirmPassword: TextInputEditText

    // UI controls
    private lateinit var btnPrevious: MaterialButton
    private lateinit var btnRegister: MaterialButton
    private lateinit var progressBar: ProgressBar
    private lateinit var tvError: TextView
    private lateinit var tvStepTitle: TextView
    private lateinit var tvBack: TextView
    private lateinit var tvSignIn: TextView
    private var dot1: View? = null
    private var dot2: View? = null
    private var dot3: View? = null

    private lateinit var apiService: ApiService

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_register)

        apiService = ApiService(this)
        initViews()
        setupSpinner()
        setupListeners()
        updateStepUI()
    }

    private fun initViews() {
        step1Layout = findViewById(R.id.step1_layout)
        step2Layout = findViewById(R.id.step2_layout)
        step3Layout = findViewById(R.id.step3_layout)

        // Step 1
        etFirstName = findViewById(R.id.et_first_name)
        etMiddleName = findViewById(R.id.et_middle_name)
        etLastName = findViewById(R.id.et_last_name)
        etBirthday = findViewById(R.id.et_birthday)
        etNationality = findViewById(R.id.et_nationality)
        btnGenderMale = findViewById(R.id.btn_gender_male)
        btnGenderFemale = findViewById(R.id.btn_gender_female)
        spCivilStatus = findViewById(R.id.sp_civil_status)

        // Step 2
        etAddress = findViewById(R.id.et_address)
        etZipCode = findViewById(R.id.et_zip_code)
        etBirthPlace = findViewById(R.id.et_birth_place)
        etPhone = findViewById(R.id.et_phone)
        etEmail = findViewById(R.id.et_email)
        etEmergencyPerson = findViewById(R.id.et_emergency_person)
        etEmergencyNumber = findViewById(R.id.et_emergency_number)

        // Step 3
        etPassword = findViewById(R.id.et_password)
        etConfirmPassword = findViewById(R.id.et_confirm_password)

        // Controls
        btnPrevious = findViewById(R.id.btn_previous)
        btnRegister = findViewById(R.id.btn_register)
        progressBar = findViewById(R.id.progress_bar)
        tvError = findViewById(R.id.tv_error)
        tvStepTitle = findViewById(R.id.tv_step_title)
        tvBack = findViewById(R.id.tv_back)
        tvSignIn = findViewById(R.id.tv_sign_in)
        dot1 = findViewById(R.id.dot1)
        dot2 = findViewById(R.id.dot2)
        dot3 = findViewById(R.id.dot3)
    }

    private fun setupSpinner() {
        val statuses = arrayOf("Select Status", "Single", "Married", "Widowed", "Separated")
        val adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, statuses)
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        spCivilStatus.adapter = adapter
    }

    private fun setupListeners() {
        tvBack.setOnClickListener {
            if (currentStep == 1) {
                finish()
            } else {
                currentStep--
                updateStepUI()
            }
        }

        tvSignIn.setOnClickListener {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }

        // Gender toggle buttons
        btnGenderMale.setOnClickListener { setGender("male") }
        btnGenderFemale.setOnClickListener { setGender("female") }

        btnPrevious.setOnClickListener {
            if (currentStep > 1) {
                currentStep--
                updateStepUI()
                tvError.visibility = View.GONE
            }
        }

        btnRegister.setOnClickListener {
            tvError.visibility = View.GONE
            if (currentStep < TOTAL_STEPS) {
                if (validateCurrentStep()) {
                    currentStep++
                    updateStepUI()
                }
            } else {
                if (validateCurrentStep()) {
                    performRegistration()
                }
            }
        }
    }

    private fun setGender(gender: String) {
        selectedGender = gender
        val blue = ContextCompat.getColor(this, R.color.brand_blue)
        val white = ContextCompat.getColor(this, R.color.white)
        val transparent = ContextCompat.getColor(this, android.R.color.transparent)

        if (gender == "male") {
            btnGenderMale.backgroundTintList = ColorStateList.valueOf(blue)
            btnGenderMale.setTextColor(white)
            btnGenderFemale.backgroundTintList = ColorStateList.valueOf(transparent)
            btnGenderFemale.setTextColor(blue)
        } else {
            btnGenderFemale.backgroundTintList = ColorStateList.valueOf(blue)
            btnGenderFemale.setTextColor(white)
            btnGenderMale.backgroundTintList = ColorStateList.valueOf(transparent)
            btnGenderMale.setTextColor(blue)
        }
    }

    private fun updateStepUI() {
        // Show/hide panels
        step1Layout.visibility = if (currentStep == 1) View.VISIBLE else View.GONE
        step2Layout.visibility = if (currentStep == 2) View.VISIBLE else View.GONE
        step3Layout.visibility = if (currentStep == 3) View.VISIBLE else View.GONE

        // Step title
        val titles = arrayOf(
            "Part 1 of 3: Personal Details", 
            "Part 2 of 3: Address & Contact", 
            "Part 3 of 3: Account Setup"
        )
        tvStepTitle.text = titles[currentStep - 1]

        // Dots
        updateDot(dot1, currentStep >= 1)
        updateDot(dot2, currentStep >= 2)
        updateDot(dot3, currentStep >= 3)

        // Previous button
        btnPrevious.visibility = if (currentStep > 1) View.VISIBLE else View.GONE

        // Next/Submit label
        btnRegister.text = if (currentStep < TOTAL_STEPS) "CONTINUE" else "COMPLETE ENROLLMENT"

        // Back text
        tvBack.text = if (currentStep == 1) "← Back to Login" else "← Previous"
    }

    private fun updateDot(dot: View?, active: Boolean) {
        val d = dot ?: return
        d.setBackgroundResource(if (active) R.drawable.bg_step_circle_blue else R.drawable.bg_step_circle_inactive)
        val size = if (active) dpToPx(12) else dpToPx(10)
        d.layoutParams.width = size
        d.layoutParams.height = size
        d.requestLayout()
    }

    private fun dpToPx(dp: Int): Int {
        return (dp * resources.displayMetrics.density).toInt()
    }

    private fun validateCurrentStep(): Boolean {
        when (currentStep) {
            1 -> {
                if (isEmpty(etFirstName)) { showError("First name is required"); return false }
                if (isEmpty(etLastName)) { showError("Last name is required"); return false }
                if (isEmpty(etBirthday)) { showError("Birth date is required"); return false }
                if (selectedGender.isEmpty()) { showError("Please select a gender"); return false }
                if (isEmpty(etNationality)) { showError("Nationality is required"); return false }
            }
            2 -> {
                if (isEmpty(etAddress)) { showError("Address is required"); return false }
                if (isEmpty(etZipCode)) { showError("Zip code is required"); return false }
                if (isEmpty(etBirthPlace)) { showError("Place of birth is required"); return false }
                if (isEmpty(etPhone)) { showError("Mobile number is required"); return false }
                val phone = getText(etPhone).replace(" ", "")
                if (!phone.startsWith("09") || phone.length != 11) {
                    showError("Phone must start with 09 and be 11 digits"); return false
                }
                if (isEmpty(etEmail)) { showError("Email is required"); return false }
                if (!getText(etEmail).contains("@")) { showError("Enter a valid email"); return false }
                if (isEmpty(etEmergencyPerson)) { showError("Emergency contact person is required"); return false }
                if (isEmpty(etEmergencyNumber)) { showError("Emergency contact number is required"); return false }
            }
            3 -> {
                val pw = getText(etPassword)
                if (pw.isEmpty()) { showError("Password is required"); return false }
                if (pw.length < 8) { showError("Password must be at least 8 characters"); return false }
                if (pw != getText(etConfirmPassword)) { showError("Passwords do not match"); return false }
            }
        }
        return true
    }

    private fun performRegistration() {
        setLoading(true)

        try {
            val body = JSONObject().apply {
                put("firstName", getText(etFirstName))
                put("middleName", if (getText(etMiddleName).isEmpty()) "N/A" else getText(etMiddleName))
                put("lastName", getText(etLastName))
                put("birthday", getText(etBirthday))
                put("gender", selectedGender)
                put("maritalStatus", spCivilStatus.selectedItem.toString().lowercase(Locale.ROOT))
                put("nationality", getText(etNationality))
                put("address", getText(etAddress))
                put("zipCode", getText(etZipCode))
                put("birthPlace", getText(etBirthPlace))
                put("contactNumbers", getText(etPhone).replace(" ", ""))
                put("email", getText(etEmail))
                put("emergencyContactPerson", getText(etEmergencyPerson))
                put("emergencyContactNumber", getText(etEmergencyNumber).replace(" ", ""))
                put("password", getText(etPassword))
            }

            apiService.register(body, object : ApiCallback<JSONObject> {
                override fun onSuccess(result: JSONObject) {
                    setLoading(false)
                    Toast.makeText(this@RegisterActivity,
                        "Registration successful! Please verify your email.", Toast.LENGTH_LONG).show()
                    
                    // Navigate to verify email
                    val intent = Intent(this@RegisterActivity, VerifyEmailActivity::class.java)
                    intent.putExtra("email", getText(etEmail))
                    startActivity(intent)
                    finish()
                }

                override fun onError(message: String) {
                    setLoading(false)
                    showError(message)
                }
            })
        } catch (e: Exception) {
            setLoading(false)
            showError("Unexpected error. Please try again.")
        }
    }

    private fun getText(et: TextInputEditText): String {
        return et.text?.toString()?.trim() ?: ""
    }

    private fun isEmpty(et: TextInputEditText): Boolean {
        return getText(et).isEmpty()
    }

    private fun showError(msg: String) {
        tvError.text = "⚠ $msg"
        tvError.visibility = View.VISIBLE
    }

    private fun setLoading(loading: Boolean) {
        progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        btnRegister.isEnabled = !loading
    }
}
