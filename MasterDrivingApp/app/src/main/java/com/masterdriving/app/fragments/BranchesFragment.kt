package com.masterdriving.app.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.ProgressBar
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.button.MaterialButton
import com.masterdriving.app.MainActivity
import com.masterdriving.app.R
import com.masterdriving.app.adapters.BranchAdapter
import com.masterdriving.app.network.ApiService
import kotlinx.coroutines.launch
import org.json.JSONObject

class BranchesFragment : Fragment() {

    private var rvBranches: RecyclerView? = null
    private var progressBar: ProgressBar? = null
    private var errorLayout: LinearLayout? = null
    private var apiService: ApiService? = null
    private var adapter: BranchAdapter? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_branches, container, false)

        rvBranches = view.findViewById(R.id.rv_branches)
        progressBar = view.findViewById(R.id.progress_bar)
        errorLayout = view.findViewById(R.id.error_layout)

        val btnRetry = view.findViewById<MaterialButton>(R.id.btn_retry)
        btnRetry.setOnClickListener { loadBranches() }

        apiService = ApiService(requireContext())
        adapter = BranchAdapter(ArrayList(), requireContext())

        // --- KEY FLOW: Enroll Now on a branch → save branch, navigate to Courses ---
        adapter?.setOnEnrollClickListener { branch ->
            (activity as? MainActivity)?.let {
                it.updateSelectedBranch(branch) 
                it.navigateTo(R.id.nav_courses)
            }
        }

        rvBranches?.apply {
            layoutManager = LinearLayoutManager(requireContext())
            this.adapter = this@BranchesFragment.adapter
        }

        loadBranches()
        return view
    }

    private fun loadBranches() {
        showLoading(true)
        errorLayout?.visibility = View.GONE

        // Using lifecycleScope for modern, automatic cancellation when fragment is destroyed
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                // Call the suspend function directly! No callbacks.
                val result = apiService?.getBranches() ?: return@launch
                
                showLoading(false)
                val branches = mutableListOf<JSONObject>()
                for (i in 0 until result.length()) {
                    try {
                        branches.add(result.getJSONObject(i))
                    } catch (ignored: Exception) {}
                }
                adapter?.updateData(branches)
            } catch (e: Exception) {
                showLoading(false)
                errorLayout?.visibility = View.VISIBLE
            }
        }
    }

    private fun showLoading(show: Boolean) {
        progressBar?.visibility = if (show) View.VISIBLE else View.GONE
        rvBranches?.visibility = if (show) View.GONE else View.VISIBLE
    }
}
