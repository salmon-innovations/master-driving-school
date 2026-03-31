package com.masterdriving.app.adapters

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.button.MaterialButton
import com.masterdriving.app.R
import org.json.JSONObject
import java.util.Locale

class BranchAdapter(private var branches: List<JSONObject>, private val context: Context) :
    RecyclerView.Adapter<BranchAdapter.ViewHolder>() {

    fun interface OnEnrollClickListener {
        fun onEnrollNow(branch: JSONObject)
    }

    private var enrollClickListener: OnEnrollClickListener? = null

    fun setOnEnrollClickListener(listener: OnEnrollClickListener) {
        this.enrollClickListener = listener
    }

    fun updateData(newBranches: List<JSONObject>) {
        this.branches = newBranches
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_branch, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val branch = branches[position]

        val name = branch.optString("name", "Branch")
        val address = branch.optString("address", branch.optString("location", ""))
        val contact = branch.optString("contact_number",
            branch.optString("contact", branch.optString("phone", "0915 644 9441")))
        val mapUrl = branch.optString("embed_url",
            branch.optString("map_url", branch.optString("google_maps_url", "")))

        // Format branch name — strip company prefixes
        val displayName = formatBranchName(name)
        holder.tvBranchName.text = displayName
        holder.tvBranchAddress.text = address.ifEmpty { "Address not available" }
        holder.tvBranchContact.text = contact.ifEmpty { "0915 644 9441" }

        // Show "Main Branch" badge if the name contains "main branch"
        val isMain = name.lowercase(Locale.ROOT).contains("main branch")
        holder.tvMainBadge.visibility = if (isMain) View.VISIBLE else View.GONE

        // Get Directions button
        holder.btnGetDirections.setOnClickListener {
            val finalUrl = when {
                mapUrl.isNotEmpty() -> mapUrl.replace("output=embed", "")
                    .replace("?output=embed", "")
                    .replace("&output=embed", "")
                else -> "https://maps.google.com?q=${Uri.encode("$name $address")}"
            }
            
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(finalUrl)).apply {
                setPackage("com.google.android.apps.maps")
            }
            
            if (intent.resolveActivity(context.packageManager) != null) {
                context.startActivity(intent)
            } else {
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(finalUrl)))
            }
        }

        // Enroll Now button
        holder.btnEnrollNow.setOnClickListener {
            enrollClickListener?.onEnrollNow(branch)
        }
    }

    /** Strip company prefixes from branch name for display */
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

    override fun getItemCount(): Int = branches.size

    class ViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val tvBranchName: TextView = itemView.findViewById(R.id.tv_branch_name)
        val tvBranchAddress: TextView = itemView.findViewById(R.id.tv_branch_address)
        val tvBranchContact: TextView = itemView.findViewById(R.id.tv_branch_contact)
        val tvMainBadge: TextView = itemView.findViewById(R.id.tv_main_branch_badge)
        val btnGetDirections: MaterialButton = itemView.findViewById(R.id.btn_get_directions)
        val btnEnrollNow: MaterialButton = itemView.findViewById(R.id.btn_enroll_now)
    }
}
