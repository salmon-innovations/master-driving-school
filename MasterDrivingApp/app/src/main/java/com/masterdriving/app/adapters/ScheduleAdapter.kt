package com.masterdriving.app.adapters

import android.content.Context
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.button.MaterialButton
import com.masterdriving.app.R
import com.masterdriving.app.network.ApiClient
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Locale

class ScheduleAdapter(private var schedules: List<JSONObject>, private val context: Context) :
    RecyclerView.Adapter<ScheduleAdapter.ViewHolder>() {

    fun updateData(newSchedules: List<JSONObject>) {
        this.schedules = newSchedules
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_schedule, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val slot = schedules[position]

        // Date
        val dateStr = slot.optString("slot_date", slot.optString("date", ""))
        holder.tvScheduleDate.text = formatDate(dateStr)

        // Time / Session
        val session = slot.optString("session_type", slot.optString("time_slot", "Morning"))
        holder.tvScheduleTime.text = "$session Session"

        // Course type
        val courseType = slot.optString("course_type", slot.optString("type", "TDC"))
        val dayType = slot.optString("day_type", "")
        val courseTypeFinal = courseType.uppercase(Locale.ROOT)
        val displayCourse = if (dayType.isEmpty()) courseTypeFinal else "$courseTypeFinal – $dayType"
        holder.tvScheduleCourse.text = displayCourse

        // Branch
        var branchName = slot.optString("branch_name", "")
        if (branchName.isEmpty()) {
            val branch = slot.optJSONObject("branch")
            if (branch != null) branchName = branch.optString("name", "")
        }
        holder.tvScheduleBranch.text = "📍 ${if (branchName.isEmpty()) "Branch TBD" else branchName}"

        // Available slots
        val totalSlots = slot.optInt("max_students", slot.optInt("capacity", 10))
        val enrolled = slot.optInt("enrolled_count", slot.optInt("current_students", 0))
        val available = totalSlots - enrolled
        holder.tvSlotsBadge.text = "$available slots"

        // Book button
        holder.btnBook.setOnClickListener {
            if (!ApiClient.isLoggedIn(context)) {
                Toast.makeText(context, "Please sign in to book a schedule", Toast.LENGTH_SHORT).show()
            } else if (available <= 0) {
                Toast.makeText(context, "No available slots", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(context, "Opening booking for: $displayCourse", Toast.LENGTH_SHORT).show()
                // In full app: show booking dialog or navigate to payment
            }
        }
    }

    private fun formatDate(dateStr: String?): String {
        if (dateStr.isNullOrEmpty()) return "Date TBD"
        return try {
            val inputFmt = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
            val outputFmt = SimpleDateFormat("MMMM d, yyyy", Locale.getDefault())
            val date = inputFmt.parse(dateStr)
            date?.let { outputFmt.format(it) } ?: dateStr
        } catch (e: Exception) {
            dateStr
        }
    }

    override fun getItemCount(): Int = schedules.size

    class ViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val tvScheduleDate: TextView = itemView.findViewById(R.id.tv_schedule_date)
        val tvScheduleTime: TextView = itemView.findViewById(R.id.tv_schedule_time)
        val tvScheduleCourse: TextView = itemView.findViewById(R.id.tv_schedule_course)
        val tvScheduleBranch: TextView = itemView.findViewById(R.id.tv_schedule_branch)
        val tvSlotsBadge: TextView = itemView.findViewById(R.id.tv_slots_badge)
        val btnBook: MaterialButton = itemView.findViewById(R.id.btn_book)
    }
}
