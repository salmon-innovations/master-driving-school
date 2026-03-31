package com.masterdriving.app.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.ProgressBar
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.button.MaterialButton
import com.masterdriving.app.R
import com.masterdriving.app.adapters.ScheduleAdapter
import com.masterdriving.app.network.ApiCallback
import com.masterdriving.app.network.ApiService
import org.json.JSONArray
import org.json.JSONObject

class ScheduleFragment : Fragment() {

    private var rvSchedules: RecyclerView? = null
    private var progressBar: ProgressBar? = null
    private var errorLayout: LinearLayout? = null
    private var apiService: ApiService? = null
    private var adapter: ScheduleAdapter? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_schedule, container, false)

        rvSchedules = view.findViewById(R.id.rv_schedules)
        progressBar = view.findViewById(R.id.progress_bar)
        errorLayout = view.findViewById(R.id.error_layout)

        view.findViewById<MaterialButton>(R.id.btn_retry)?.setOnClickListener { loadSchedules() }

        apiService = ApiService(requireContext())
        adapter = ScheduleAdapter(ArrayList(), requireContext())

        rvSchedules?.apply {
            layoutManager = LinearLayoutManager(requireContext())
            this.adapter = this@ScheduleFragment.adapter
        }

        loadSchedules()
        return view
    }

    private fun loadSchedules() {
        showLoading(true)
        errorLayout?.visibility = View.GONE

        apiService?.getScheduleSlots(null, object : ApiCallback<JSONArray> {
            override fun onSuccess(result: JSONArray) {
                showLoading(false)
                val schedules = mutableListOf<JSONObject>()
                for (i in 0 until result.length()) {
                    try {
                        schedules.add(result.getJSONObject(i))
                    } catch (ignored: Exception) {
                    }
                }
                adapter?.updateData(schedules)
            }

            override fun onError(message: String) {
                showLoading(false)
                errorLayout?.visibility = View.VISIBLE
            }
        })
    }

    private fun showLoading(show: Boolean) {
        progressBar?.visibility = if (show) View.VISIBLE else View.GONE
        rvSchedules?.visibility = if (show) View.GONE else View.VISIBLE
    }
}
