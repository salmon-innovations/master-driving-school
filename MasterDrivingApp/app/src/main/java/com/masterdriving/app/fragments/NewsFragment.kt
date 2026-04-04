package com.masterdriving.app.fragments

import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.masterdriving.app.R
import com.masterdriving.app.network.ApiService
import com.masterdriving.app.network.NetworkResult
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import androidx.core.content.ContextCompat
import com.google.android.material.tabs.TabLayout
import android.net.Uri
import android.content.Intent

class NewsFragment : Fragment() {

    private lateinit var apiService: ApiService
    private var newsContainer: LinearLayout? = null
    private var progressBar: ProgressBar? = null
    private var emptyState: View? = null
    private var swipeRefresh: SwipeRefreshLayout? = null
    private var tabLayout: TabLayout? = null
    
    private var allNews: JSONArray = JSONArray()
    private var currentFilter: String = "Latest"

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_news, container, false)
        
        apiService = ApiService(requireContext())
        newsContainer = view.findViewById(R.id.news_container)
        progressBar = view.findViewById(R.id.news_progress_bar)
        emptyState = view.findViewById(R.id.news_empty_state)
        swipeRefresh = view.findViewById(R.id.swipe_refresh)
        tabLayout = view.findViewById(R.id.news_tabs)

        swipeRefresh?.apply {
            setColorSchemeColors(ContextCompat.getColor(requireContext(), R.color.brand_blue))
            setOnRefreshListener { loadNews() }
        }

        tabLayout?.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) {
                currentFilter = tab?.text?.toString() ?: "Latest"
                filterAndDisplay()
            }
            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })
        
        loadNews()
        
        return view
    }

    private fun loadNews() {
        viewLifecycleOwner.lifecycleScope.launch {
            if (swipeRefresh?.isRefreshing == false) {
                progressBar?.visibility = View.VISIBLE
            }
            emptyState?.visibility = View.GONE

            val result = apiService.getNewsResult()
            
            progressBar?.visibility = View.GONE
            swipeRefresh?.isRefreshing = false

            when (result) {
                is NetworkResult.Success -> {
                    allNews = result.data
                    filterAndDisplay()
                }
                is NetworkResult.Error -> {
                    Log.e("NewsFragment", "Error loading news: ${result.message}")
                    if (isAdded) {
                        Toast.makeText(requireContext(), "Failed to load news: ${result.message}", Toast.LENGTH_SHORT).show()
                    }
                    if (newsContainer?.childCount == 0) {
                        emptyState?.visibility = View.VISIBLE
                    }
                }
                is NetworkResult.Loading -> {
                    // Handled by manual progress bar
                }
            }
        }
    }

    private fun filterAndDisplay() {
        if (!isAdded) return
        val filtered = JSONArray()
        
        for (i in 0 until allNews.length()) {
            val item = allNews.optJSONObject(i) ?: continue
            val type = item.optString("type", "")
            val tag = item.optString("tag", "")

            when (currentFilter) {
                "Latest" -> {
                    if (type != "Promotional Video") filtered.put(item)
                }
                "Events" -> {
                    if (tag.equals("EVENT", ignoreCase = true)) filtered.put(item)
                }
                "Videos" -> {
                    if (type == "Promotional Video") filtered.put(item)
                }
            }
        }
        
        displayNews(filtered)
    }

    private fun displayNews(newsArray: JSONArray) {
        if (!isAdded) return
        newsContainer?.removeAllViews()
        
        if (newsArray.length() == 0) {
            emptyState?.visibility = View.VISIBLE
            return
        }
        
        emptyState?.visibility = View.GONE
        
        val inflater = LayoutInflater.from(requireContext())
        
        for (i in 0 until newsArray.length()) {
            val news = newsArray.optJSONObject(i) ?: continue
            val card = createNewsCard(inflater, newsContainer!!, news)
            newsContainer?.addView(card)
        }
    }

    private fun createNewsCard(inflater: LayoutInflater, container: ViewGroup, news: JSONObject): View {
        val cardView = inflater.inflate(R.layout.item_news_card, container, false)
        
        val title = cardView.findViewById<TextView>(R.id.news_title)
        val description = cardView.findViewById<TextView>(R.id.news_description)
        val tag = cardView.findViewById<TextView>(R.id.news_tag)
        val date = cardView.findViewById<TextView>(R.id.news_date)
        val image = cardView.findViewById<android.widget.ImageView>(R.id.news_image)
        val playBtn = cardView.findViewById<View>(R.id.play_button_overlay)

        title.text = news.optString("title")
        description.text = news.optString("description")
        tag.text = news.optString("tag", "General")
        
        val rawDate = news.optString("published_at", "")
        date.text = if (rawDate.length > 10) rawDate.substring(0, 10) else rawDate

        val type = news.optString("type", "")
        val rawUrl = news.optString("media_url", news.optString("image_url", ""))
        val mediaUrl = formatUrl(rawUrl)
        
        Log.d("NewsFragment", "Loading news media [type=$type]: $mediaUrl")
        
        val isVideo = type == "Promotional Video" || 
                     mediaUrl.contains(".mp4", ignoreCase = true) || 
                     mediaUrl.contains("video", ignoreCase = true)
        
        playBtn?.visibility = if (isVideo) View.VISIBLE else View.GONE

        if (mediaUrl.isNotEmpty()) {
            com.bumptech.glide.Glide.with(requireContext())
                .load(mediaUrl)
                .centerCrop()
                .placeholder(R.drawable.ic_news)
                .error(R.drawable.ic_news) // Use placeholder on error too
                .into(image)
        } else {
            image.visibility = View.GONE
        }

        cardView.setOnClickListener {
            if (isVideo && mediaUrl.isNotEmpty()) {
                playVideo(mediaUrl)
            }
        }

        return cardView
    }

    private fun formatUrl(url: String): String {
        if (url.isEmpty()) return ""
        if (url.startsWith("http") || url.startsWith("data:")) return url
        
        val baseUrl = "https://booking-system-ej5o.onrender.com"
        return if (url.startsWith("/")) "$baseUrl$url" else "$baseUrl/$url"
    }

    private fun playVideo(url: String) {
        if (url.startsWith("data:video", ignoreCase = true)) {
            try {
                val base64Data = url.substringAfter("base64,")
                val videoBytes = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT)
                
                val tempFile = java.io.File(requireContext().cacheDir, "temp_video.mp4")
                java.io.FileOutputStream(tempFile).use { it.write(videoBytes) }
                
                val authority = "${requireContext().packageName}.fileprovider"
                val contentUri = androidx.core.content.FileProvider.getUriForFile(requireContext(), authority, tempFile)
                
                val intent = Intent(Intent.ACTION_VIEW)
                intent.setDataAndType(contentUri, "video/mp4")
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                startActivity(intent)
                return
            } catch (e: Exception) {
                Log.e("NewsFragment", "Error playing Base64 video: ${e.message}")
                Toast.makeText(requireContext(), "Failed to prepare video", Toast.LENGTH_SHORT).show()
            }
        }

        try {
            val intent = Intent(Intent.ACTION_VIEW)
            intent.setDataAndType(Uri.parse(url), "video/*")
            startActivity(intent)
        } catch (e: Exception) {
            try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                startActivity(intent)
            } catch (ex: Exception) {
                Toast.makeText(requireContext(), "Could not play video", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
