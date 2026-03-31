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
import com.google.android.material.button.MaterialButton
import com.masterdriving.app.R
import com.masterdriving.app.network.ApiService
import com.masterdriving.app.network.NetworkResult
import com.masterdriving.app.network.optStringOrNull
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

class NewsFragment : Fragment() {

    private lateinit var apiService: ApiService
    private var newsContainer: LinearLayout? = null
    private var progressBar: ProgressBar? = null
    private var emptyState: View? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_news, container, false)
        
        apiService = ApiService(requireContext())
        newsContainer = view.findViewById(R.id.news_container) // Need to add this ID to layout
        // For now using the existing scrollview container
        
        loadNews()
        
        return view
    }

    private fun loadNews() {
        viewLifecycleOwner.lifecycleScope.launch {
            // Using the new NetworkResult pattern we created
            val result = apiService.getNewsResult()
            
            when (result) {
                is NetworkResult.Loading -> {
                    // Show progress bar
                }
                is NetworkResult.Success -> {
                    displayNews(result.data)
                }
                is NetworkResult.Error -> {
                    Log.e("NewsFragment", "Error loading news: ${result.message}")
                    // Handle error (show a toast or error view)
                }
            }
        }
    }

    private fun displayNews(newsArray: JSONArray) {
        if (newsArray.length() == 0) return
        
        // This is where we'd dynamically add view cards
        // For demonstration of Kotlin idiomatic list handling:
        val newsList = mutableListOf<JSONObject>()
        for (i in 0 until newsArray.length()) {
            newsArray.optJSONObject(i)?.let { newsList.add(it) }
        }
        
        // idiomatic Kotlin filtering or mapping if needed
        val latestNews = newsList.take(5) 
    }
}
