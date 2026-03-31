package com.masterdriving.app.adapters

import android.content.Context
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.button.MaterialButton
import com.masterdriving.app.R
import org.json.JSONObject
import java.util.Locale

class CourseAdapter(private var courses: List<JSONObject>, private val context: Context) :
    RecyclerView.Adapter<CourseAdapter.ViewHolder>() {

    fun interface OnCourseSelectListener {
        fun onSelect(course: JSONObject)
    }

    private var selectListener: OnCourseSelectListener? = null

    fun setOnCourseSelectListener(listener: OnCourseSelectListener) {
        this.selectListener = listener
    }

    fun updateData(newCourses: List<JSONObject>) {
        this.courses = newCourses
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_course, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val course = courses[position]

        val name = course.optString("name", "Course")
        val courseType = course.optString("course_type", course.optString("type", ""))
        val category = course.optString("category", "")
        val description = course.optString("description", "")
        val price = course.optDouble("price", 0.0)
        val durationRaw = course.optString("duration", "")

        val durationDisplay = if (durationRaw.isNotEmpty() && durationRaw != "null") {
            try {
                val hrs = durationRaw.trim().toInt()
                "$hrs Hours"
            } catch (e: NumberFormatException) {
                durationRaw // already has units
            }
        } else {
            "See Schedule"
        }

        // --- Determine course icon based on category or type ---
        val iconCategory = category.ifEmpty { courseType }
        val icon = when {
            iconCategory.lowercase(Locale.ROOT).contains("tdc") || 
            iconCategory.lowercase(Locale.ROOT).contains("theoretical") -> "📖"
            iconCategory.lowercase(Locale.ROOT).contains("pdc") || 
            iconCategory.lowercase(Locale.ROOT).contains("practical") -> "🚗"
            iconCategory.lowercase(Locale.ROOT).contains("promo") || 
            iconCategory.lowercase(Locale.ROOT).contains("bundle") -> "🎁"
            else -> "📚"
        }

        // --- Bind to views ---
        holder.tvName.text = name

        var typeLabel = category.ifEmpty { courseType }
        if (courseType.isNotEmpty() && !category.equals(courseType, ignoreCase = true)) {
            typeLabel = if (category.isEmpty()) courseType else "$category · $courseType"
        }
        holder.tvType.text = typeLabel

        // Short description (first sentence or truncated)
        if (description.isNotEmpty() && description != "null") {
            val shortDesc = description.split(Regex("[.\\n]"))[0].trim()
            holder.tvDescription.text = shortDesc
        } else {
            holder.tvDescription.text = "LTO Accredited · Licensing Program"
        }

        holder.tvPrice.text = "₱${formatPrice(price)}"
        holder.tvDuration.text = durationDisplay
        holder.tvIcon.text = icon

        // Select buttons
        val selectAction = { selectListener?.onSelect(course) }
        holder.btnEnroll.setOnClickListener { selectAction() }
        holder.tvName.setOnClickListener { selectAction() }
    }

    private fun formatPrice(price: Double): String {
        if (price == 0.0) return "See Branch"
        val p = price.toLong()
        return if (p >= 1000) String.format(Locale.ROOT, "%,d", p) else p.toString()
    }

    override fun getItemCount(): Int = courses.size

    class ViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val tvName: TextView = itemView.findViewById(R.id.tv_course_name)
        val tvType: TextView = itemView.findViewById(R.id.tv_course_type)
        val tvDescription: TextView = itemView.findViewById(R.id.tv_course_description)
        val tvPrice: TextView = itemView.findViewById(R.id.tv_course_price)
        val tvDuration: TextView = itemView.findViewById(R.id.tv_course_duration)
        val tvIcon: TextView = itemView.findViewById(R.id.tv_course_icon)
        val btnEnroll: MaterialButton = itemView.findViewById(R.id.btn_enroll)
    }
}
