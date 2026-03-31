package com.masterdriving.app

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import com.google.android.material.bottomnavigation.BottomNavigationView
import com.masterdriving.app.fragments.*
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    private lateinit var bottomNav: BottomNavigationView

    /**
     * The branch selected by the user on the Branches tab.
     * CoursesFragment reads this to show the banner and enforce the "select branch first" flow.
     */
    var selectedBranch: JSONObject? = null
        private set

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        bottomNav = findViewById(R.id.bottom_nav)

        // Load home fragment by default
        if (savedInstanceState == null) {
            loadFragment(HomeFragment())
        }

        bottomNav.setOnItemSelectedListener { item ->
            val selected: Fragment? = when (item.itemId) {
                R.id.nav_home -> HomeFragment()
                R.id.nav_courses -> CoursesFragment()
                R.id.nav_branches -> BranchesFragment()
                R.id.nav_news -> NewsFragment()
                R.id.nav_profile -> ProfileFragment()
                else -> null
            }

            selected?.let {
                loadFragment(it)
                true
            } ?: false
        }
    }

    private fun loadFragment(fragment: Fragment) {
        supportFragmentManager
            .beginTransaction()
            .replace(R.id.fragment_container, fragment)
            .commit()
    }

    /** Navigate to a tab by nav item ID */
    fun navigateTo(navItemId: Int) {
        bottomNav.selectedItemId = navItemId
    }

    /** Called by BranchesFragment when user taps "Enroll Now" on a branch */
    fun updateSelectedBranch(branch: JSONObject?) {
        this.selectedBranch = branch
    }

    /** Clear branch selection (e.g., when user taps "Change" in Courses) */
    fun clearSelectedBranch() {
        this.selectedBranch = null
    }
}
