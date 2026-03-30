function Footer({ onNavigate }) {
  const handleNavClick = (page) => {
    onNavigate(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <footer className="bg-[#2157da] text-white py-8 sm:py-12 mt-auto">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {/* Brand */}
          <div className="text-center sm:text-left">
            <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Master Driving School</h3>
            <p className="text-gray-200 text-sm leading-relaxed">
              Learn to drive with confidence. Professional, certified instructors and flexible scheduling.
            </p>
          </div>

          {/* Quick Links */}
          <div className="text-center sm:text-left">
            <h4 className="font-semibold mb-3 sm:mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <button onClick={() => handleNavClick('courses')} className="hover:text-[#F3B74C] transition-colors">
                  Courses
                </button>
              </li>
              <li>
                <button onClick={() => handleNavClick('branches')} className="hover:text-[#F3B74C] transition-colors">
                  Branches
                </button>
              </li>
              <li>
                <button onClick={() => handleNavClick('payment')} className="hover:text-[#F3B74C] transition-colors">
                  Enroll Now
                </button>
              </li>
              <li>
                <button onClick={() => handleNavClick('about')} className="hover:text-[#F3B74C] transition-colors">
                  About Us
                </button>
              </li>
              <li>
                <button onClick={() => handleNavClick('contact')} className="hover:text-[#F3B74C] transition-colors">
                  Contact
                </button>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div className="text-center sm:text-left">
            <h4 className="font-semibold mb-3 sm:mb-4">Contact Us</h4>
            <ul className="space-y-2 text-sm text-gray-200">
              <li>📞 +63 915 644 9441</li>
              <li>✉️ masterdrivingmain@gmail.com</li>
              <li>📍 Unit 206, PMHA Building, V.Luna, Corner East Ave, Quezon City, 1100 Metro Manila</li>
            </ul>
          </div>

          {/* Logo and Social Media */}
          <div className="flex flex-col items-center">
            <div 
              className="mb-4 flex justify-center cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => handleNavClick('home')}
            >
              <img 
                src="/images/logo.png" 
                alt="Master Driving School Logo" 
                className="h-20 sm:h-24 w-auto"
              />
            </div>
            <div className="flex justify-center gap-4 mb-4">
              <a 
                href="https://www.facebook.com/masterdrivingschool.ph" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white hover:text-[#F3B74C] transition-colors"
                aria-label="Visit our Facebook page"
              >
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a 
                href="https://www.instagram.com/masterdrivingschool.ph/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white hover:text-[#F3B74C] transition-colors"
                aria-label="Visit our Instagram page"
              >
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
            </div>

            <a 
              href="/MasterDriving.apk" 
              download 
              className="flex items-center gap-2 bg-[#F3B74C] hover:bg-[#e1a63b] text-[#1a2d6b] px-4 py-2 rounded-full font-bold text-xs transition-all transform hover:scale-105 shadow-lg group"
            >
              <svg 
                className="w-5 h-5 group-hover:animate-bounce" 
                fill="currentColor" 
                viewBox="0 0 24 24"
              >
                <path d="M17.523 15.3414C16.9209 15.3414 16.4318 15.8305 16.4318 16.4326C16.4318 17.0347 16.9209 17.5238 17.523 17.5238C18.1251 17.5238 18.6142 17.0347 18.6142 16.4326C18.6142 15.8305 18.1251 15.3414 17.523 15.3414ZM6.47727 15.3409C5.8752 15.3409 5.38605 15.83 5.38605 16.4321C5.38605 17.0341 5.8752 17.5233 6.47727 17.5233C7.07934 17.5233 7.56849 17.0341 7.56849 16.4321C7.56849 15.83 7.07934 15.3409 6.47727 15.3409ZM18.1631 11.4552L20.154 8.00545C20.2981 7.75548 20.2125 7.43615 19.9626 7.29202C19.7126 7.14788 19.3933 7.23351 19.2491 7.48348L17.2285 10.9855C15.656 10.2796 13.9103 9.88636 12.0741 9.88636C10.2373 9.88636 8.49081 10.2801 6.91754 10.9866L4.89694 7.48348C4.75281 7.23351 4.43348 7.14788 4.18351 7.29202C3.93354 7.43615 3.84791 7.75548 3.99205 8.00545L5.93796 11.3789C2.45423 13.2504 0.0818165 16.8927 0.0818165 21.0966H24.0664C24.0664 16.8927 21.694 13.2504 18.2103 11.3789L18.1631 11.4552Z" />
              </svg>
              DOWNLOAD APP
            </a>
          </div>
        </div>

        <div className="border-t border-white/20 mt-6 sm:mt-8 pt-4 sm:pt-6">
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-6 mb-4 text-xs sm:text-sm">
            <button 
              onClick={() => handleNavClick('terms')} 
              className="hover:text-[#F3B74C] transition-colors"
            >
              Terms of Use
            </button>
            <span className="hidden sm:inline text-gray-400">|</span>
            <button 
              onClick={() => handleNavClick('privacy')} 
              className="hover:text-[#F3B74C] transition-colors"
            >
              Privacy Policy
            </button>
            <span className="hidden sm:inline text-gray-400">|</span>
            <button 
              onClick={() => handleNavClick('conditions')} 
              className="hover:text-[#F3B74C] transition-colors"
            >
              Terms & Conditions
            </button>
          </div>
          <p className="text-center text-xs sm:text-sm text-gray-200">&copy; 2026 Master Driving School. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
