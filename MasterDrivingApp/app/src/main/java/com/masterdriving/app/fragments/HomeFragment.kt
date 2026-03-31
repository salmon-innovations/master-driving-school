package com.masterdriving.app.fragments

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.LinearLayout
import androidx.fragment.app.Fragment
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import androidx.viewpager2.widget.ViewPager2
import com.google.android.material.button.MaterialButton
import com.masterdriving.app.MainActivity
import com.masterdriving.app.R
import com.masterdriving.app.adapters.SliderAdapter

class HomeFragment : Fragment() {

    private var swipeRefresh: SwipeRefreshLayout? = null
    private var sliderViewPager: ViewPager2? = null
    private var sliderDots: LinearLayout? = null
    private var currentSlide = 0
    private val sliderHandler = Handler(Looper.getMainLooper())
    private val sliderRunnable = object : Runnable {
        override fun run() {
            val viewPager = sliderViewPager ?: return
            val images = sliderImages
            val nextSlide = (viewPager.currentItem + 1) % images.size
            viewPager.setCurrentItem(nextSlide, true)
            sliderHandler.postDelayed(this, 3500)
        }
    }
    private val sliderImages = listOf(
        R.drawable.slider1,
        R.drawable.slider2,
        R.drawable.slider3
    )
    private val pageChangeCallback = object : ViewPager2.OnPageChangeCallback() {
        override fun onPageSelected(position: Int) {
            currentSlide = position
            setupDots(position)
            // Reset auto-scroll timer
            sliderHandler.removeCallbacks(sliderRunnable)
            sliderHandler.postDelayed(sliderRunnable, 3500)
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_home, container, false)

        setupSwipeRefresh(view)
        setupSlider(view)
        setupQuickActions(view)
        setupCTAButtons(view)

        return view
    }

    private fun setupSwipeRefresh(view: View) {
        swipeRefresh = view.findViewById(R.id.swipe_refresh)
        swipeRefresh?.setColorSchemeResources(R.color.brand_blue, R.color.brand_gold)
        swipeRefresh?.setOnRefreshListener {
            // Reload data
            swipeRefresh?.isRefreshing = false
        }
    }

    private fun setupSlider(view: View) {
        sliderViewPager = view.findViewById(R.id.slider_viewpager)
        sliderDots = view.findViewById(R.id.slider_dots)

        val adapter = SliderAdapter(sliderImages)
        sliderViewPager?.adapter = adapter

        // Create initial dots
        setupDots(0)

        sliderViewPager?.registerOnPageChangeCallback(pageChangeCallback)

        // Start auto-scroll
        sliderHandler.postDelayed(sliderRunnable, 3500)
    }

    private fun setupDots(activeIndex: Int) {
        val dots = sliderDots ?: return
        val currentContext = context ?: return // Safely bail if fragment isn't attached
        
        dots.removeAllViews()

        for (i in sliderImages.indices) {
            val dot = ImageView(currentContext)
            val params = LinearLayout.LayoutParams(
                if (i == activeIndex) 20 else 14, 14
            )
            params.setMargins(4, 0, 4, 0)
            dot.layoutParams = params
            dot.setImageResource(if (i == activeIndex) R.drawable.dot_active else R.drawable.dot_inactive)
            dots.addView(dot)
        }
    }

    private fun setupQuickActions(view: View) {
        val cardBook = view.findViewById<View>(R.id.card_book)
        val cardCourses = view.findViewById<View>(R.id.card_courses)
        val cardBranches = view.findViewById<View>(R.id.card_branches)

        cardBook?.setOnClickListener { navigateTo(R.id.nav_branches) }
        cardCourses?.setOnClickListener { navigateTo(R.id.nav_courses) }
        cardBranches?.setOnClickListener { navigateTo(R.id.nav_branches) }

        val btnTopEnroll = view.findViewById<MaterialButton>(R.id.btn_topbar_enroll)
        btnTopEnroll?.setOnClickListener { navigateTo(R.id.nav_courses) }
    }

    private fun setupCTAButtons(view: View) {
        val btnBook = view.findViewById<MaterialButton>(R.id.btn_book_lesson)
        btnBook?.setOnClickListener { navigateTo(R.id.nav_branches) }
    }

    private fun navigateTo(navItemId: Int) {
        (activity as? MainActivity)?.navigateTo(navItemId)
    }

    override fun onPause() {
        super.onPause()
        sliderHandler.removeCallbacks(sliderRunnable)
    }

    override fun onResume() {
        super.onResume()
        sliderHandler.postDelayed(sliderRunnable, 3500)
    }

    override fun onDestroyView() {
        sliderViewPager?.unregisterOnPageChangeCallback(pageChangeCallback)
        super.onDestroyView()
        sliderHandler.removeCallbacks(sliderRunnable)
    }
}
