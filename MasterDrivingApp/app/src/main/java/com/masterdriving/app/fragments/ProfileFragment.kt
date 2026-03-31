package com.masterdriving.app.fragments

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.button.MaterialButton
import com.masterdriving.app.R
import com.masterdriving.app.auth.LoginActivity
import com.masterdriving.app.auth.RegisterActivity
import com.masterdriving.app.network.ApiCallback
import com.masterdriving.app.network.ApiClient
import com.masterdriving.app.network.ApiService
import org.json.JSONArray

class ProfileFragment : Fragment() {

    private var layoutGuest: LinearLayout? = null
    private var layoutLoggedIn: LinearLayout? = null
    private var apiService: ApiService? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_profile, container, false)

        layoutGuest = view.findViewById(R.id.layout_guest)
        layoutLoggedIn = view.findViewById(R.id.layout_logged_in)
        apiService = ApiService(requireContext())

        // ── Auth buttons ────────────────────────────────────
        val btnSignIn = view.findViewById<MaterialButton>(R.id.btn_sign_in)
        val btnSignUp = view.findViewById<MaterialButton>(R.id.btn_sign_up)
        val btnSignOut = view.findViewById<MaterialButton>(R.id.btn_sign_out)

        btnSignIn?.setOnClickListener {
            startActivity(Intent(requireContext(), LoginActivity::class.java))
        }
        btnSignUp?.setOnClickListener {
            startActivity(Intent(requireContext(), RegisterActivity::class.java))
        }
        btnSignOut?.setOnClickListener {
            ApiClient.clearToken(requireContext())
            layoutLoggedIn?.visibility = View.GONE
            layoutGuest?.visibility = View.VISIBLE
            Toast.makeText(requireContext(), "Signed out.", Toast.LENGTH_SHORT).show()
        }

        // ── Account settings rows ───────────────────────────
        val layoutEditProfile = view.findViewById<LinearLayout>(R.id.layout_edit_profile)
        val layoutChangePassword = view.findViewById<LinearLayout>(R.id.layout_change_password)

        layoutEditProfile?.setOnClickListener {
            Toast.makeText(requireContext(), "Edit Profile coming soon!", Toast.LENGTH_SHORT).show()
        }
        layoutChangePassword?.setOnClickListener {
            Toast.makeText(requireContext(), "Change Password coming soon!", Toast.LENGTH_SHORT).show()
        }

        // ── Quick Links ─────────────────────────────────────
        val linkWebsite = view.findViewById<View>(R.id.link_website)
        val linkCall = view.findViewById<View>(R.id.link_call)
        val linkFacebook = view.findViewById<View>(R.id.link_facebook)
        val linkPrivacy = view.findViewById<View>(R.id.link_privacy)

        linkWebsite?.setOnClickListener { openUrl("https://masterdriving.ph") }
        linkCall?.setOnClickListener {
            val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:09273993219"))
            startActivity(intent)
        }
        linkFacebook?.setOnClickListener { openUrl("https://www.facebook.com/masterdrivingschoolph") }
        linkPrivacy?.setOnClickListener { openUrl("https://masterdriving.ph/privacy-policy") }

        // ── Load profile state ──────────────────────────────
        checkLoginState(view)

        return view
    }

    private fun checkLoginState(view: View) {
        val isLoggedIn = ApiClient.isLoggedIn(requireContext())
        layoutGuest?.visibility = if (isLoggedIn) View.GONE else View.VISIBLE
        layoutLoggedIn?.visibility = if (isLoggedIn) View.VISIBLE else View.GONE

        if (isLoggedIn) {
            loadEnrollments(view)
        }
    }

    private fun loadEnrollments(view: View) {
        val progress = view.findViewById<View>(R.id.progress_enrollments)
        val rv = view.findViewById<RecyclerView>(R.id.rv_enrollments)
        val tvEmpty = view.findViewById<View>(R.id.tv_no_enrollments)

        progress?.visibility = View.VISIBLE

        apiService?.getEnrollments(object : ApiCallback<JSONArray> {
            override fun onSuccess(result: JSONArray) {
                progress?.visibility = View.GONE
                if (result.length() == 0) {
                    tvEmpty?.visibility = View.VISIBLE
                } else {
                    rv?.layoutManager = LinearLayoutManager(requireContext())
                    // TODO: bind enrollment adapter
                }
            }

            override fun onError(message: String) {
                progress?.visibility = View.GONE
                tvEmpty?.visibility = View.VISIBLE
            }
        })
    }

    private fun openUrl(url: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(requireContext(), "Could not open link.", Toast.LENGTH_SHORT).show()
        }
    }
}
