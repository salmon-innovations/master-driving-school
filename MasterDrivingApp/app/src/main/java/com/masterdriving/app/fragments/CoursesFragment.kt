package com.masterdriving.app.fragments

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.cardview.widget.CardView
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.android.material.button.MaterialButton
import com.masterdriving.app.MainActivity
import com.masterdriving.app.R
import com.masterdriving.app.adapters.CourseAdapter
import com.masterdriving.app.network.ApiCallback
import com.masterdriving.app.network.ApiService
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

class CoursesFragment : Fragment() {

    private var recyclerView: RecyclerView? = null
    private var adapter: CourseAdapter? = null
    private val allCourses = mutableListOf<JSONObject>()
    private var loadingLayout: View? = null
    private var errorLayout: LinearLayout? = null
    private var tvError: TextView? = null
    private var swipeRefresh: SwipeRefreshLayout? = null
    private var etSearch: EditText? = null
    private var apiService: ApiService? = null

    // Branch banner views
    private var cardBranchBanner: CardView? = null
    private var tvSelectedBranchName: TextView? = null
    private var tvChangeBranch: TextView? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_courses, container, false)

        recyclerView = view.findViewById(R.id.rv_courses)
        loadingLayout = view.findViewById(R.id.loading_layout)
        errorLayout = view.findViewById(R.id.error_layout)
        tvError = view.findViewById(R.id.tv_error)
        swipeRefresh = view.findViewById(R.id.swipe_refresh)
        etSearch = view.findViewById(R.id.et_search)
        cardBranchBanner = view.findViewById(R.id.card_branch_banner)
        tvSelectedBranchName = view.findViewById(R.id.tv_selected_branch_name)
        tvChangeBranch = view.findViewById(R.id.tv_change_branch)

        apiService = ApiService(requireContext())

        recyclerView?.layoutManager = LinearLayoutManager(context)
        adapter = CourseAdapter(ArrayList(), requireContext())
        recyclerView?.adapter = adapter

        swipeRefresh?.setColorSchemeResources(R.color.brand_blue, R.color.brand_gold)
        swipeRefresh?.setOnRefreshListener { loadCourses() }

        // Search filtering
        etSearch?.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                filterCourses(s.toString())
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        view.findViewById<MaterialButton>(R.id.btn_retry)?.setOnClickListener { loadCourses() }

        // --- Check if a branch has been selected ---
        setupBranchBanner()

        loadCourses()
        return view
    }

    override fun onResume() {
        super.onResume()
        // Refresh the branch banner when coming back to this fragment
        setupBranchBanner()
    }

    private fun setupBranchBanner() {
        val activity = activity as? MainActivity ?: return
        val selectedBranch = activity.selectedBranch

        if (selectedBranch != null) {
            // Show the banner
            val name = formatBranchName(selectedBranch.optString("name", "Selected Branch"))
            tvSelectedBranchName?.text = name
            cardBranchBanner?.visibility = View.VISIBLE

            // "Change" tapped → go back to Branches
            tvChangeBranch?.setOnClickListener {
                activity.clearSelectedBranch()
                activity.navigateTo(R.id.nav_branches)
            }
        } else {
            // No branch selected — redirect user to Branches tab and show a toast
            cardBranchBanner?.visibility = View.GONE
            Toast.makeText(
                requireContext(),
                "Please select a branch first to view available courses.",
                Toast.LENGTH_LONG
            ).show()
            activity.navigateTo(R.id.nav_branches)
        }
    }

    private fun formatBranchName(name: String?): String {
        if (name == null) return ""
        val prefixes = arrayOf(
            "Master Driving School ",
            "Master Prime Driving School ",
            "Masters Prime Holdings Corp. ",
            "Master Prime Holdings Corp. "
        )
        for (prefix in prefixes) {
            if (name.startsWith(prefix)) {
                return name.substring(prefix.length)
            }
        }
        return name
    }

    private fun loadCourses() {
        showLoading()

        apiService?.getCourses(object : ApiCallback<JSONArray> {
            override fun onSuccess(result: JSONArray) {
                swipeRefresh?.isRefreshing = false
                try {
                    allCourses.clear()
                    for (i in 0 until result.length()) {
                        val course = result.getJSONObject(i)
                        val status = course.optString("status", "active")
                        if (status.equals("active", ignoreCase = true)) {
                            allCourses.add(course)
                        }
                    }
                    if (allCourses.isEmpty()) {
                        showError("No courses available yet.")
                    } else {
                        showContent()
                        adapter?.updateData(ArrayList(allCourses))
                    }
                } catch (e: Exception) {
                    showError("Unexpected response from server.")
                }
            }

            override fun onError(message: String) {
                swipeRefresh?.isRefreshing = false
                showError(message)
            }
        })
    }

    private fun filterCourses(query: String) {
        if (query.isEmpty()) {
            adapter?.updateData(ArrayList(allCourses))
            return
        }
        val q = query.lowercase(Locale.ROOT)
        val filtered = allCourses.filter { course ->
            val name = course.optString("name", "").lowercase(Locale.ROOT)
            val type = course.optString("course_type", "").lowercase(Locale.ROOT)
            val desc = course.optString("description", "").lowercase(Locale.ROOT)
            val category = course.optString("category", "").lowercase(Locale.ROOT)
            name.contains(q) || type.contains(q) || desc.contains(q) || category.contains(q)
        }
        adapter?.updateData(filtered)
    }

    private fun showLoading() {
        loadingLayout?.visibility = View.VISIBLE
        errorLayout?.visibility = View.GONE
        recyclerView?.visibility = View.GONE
    }

    private fun showContent() {
        loadingLayout?.visibility = View.GONE
        errorLayout?.visibility = View.GONE
        recyclerView?.visibility = View.VISIBLE
    }

    private fun showError(message: String) {
        loadingLayout?.visibility = View.GONE
        recyclerView?.visibility = View.GONE
        errorLayout?.visibility = View.VISIBLE
        tvError?.text = message
    }
}
