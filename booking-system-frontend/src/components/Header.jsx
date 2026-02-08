import { useState, useEffect, useRef } from 'react'

function Header({ currentPage, onNavigate, cartItemCount = 0, onCartClick, isLoggedIn = false, onLogout }) {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false)
  const [isMobileProfileDropdownOpen, setIsMobileProfileDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  const mobileDropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProfileDropdownOpen(false)
      }
      if (mobileDropdownRef.current && !mobileDropdownRef.current.contains(event.target)) {
        setIsMobileProfileDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks = [
    { name: 'Home', page: 'home' },
    { name: 'Courses', page: 'courses' },
    { name: 'Branches', page: 'branches' },
    { name: 'News & Events', page: 'news' },
    { name: 'About', page: 'about' },
    { name: 'Contact', page: 'contact' }
  ]

  const handleNavClick = (page) => {
    onNavigate(page)
    setIsMobileMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleBookNowClick = () => {
    if (isLoggedIn) {
      handleNavClick('branches')
    } else {
      handleNavClick('signin')
    }
  }

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled ? 'bg-white shadow-lg' : 'bg-white'
    }`}>
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div 
            onClick={() => handleNavClick('home')}
            className="cursor-pointer hover:opacity-80 transition-opacity"
          >
            <img 
              src="/images/logo.png" 
              alt="Master Driving School" 
              className="h-16 sm:h-20 md:h-24 w-auto"
            />
          </div>

          {/* Desktop Navigation */}
          <ul className="hidden lg:flex items-center space-x-6 xl:space-x-8">
            {navLinks.map(link => (
              <li key={link.page}>
                <button
                  onClick={() => handleNavClick(link.page)}
                  className={`font-medium transition-colors hover:text-[#2157da] ${
                    currentPage === link.page ? 'text-[#2157da]' : 'text-gray-700'
                  }`}
                >
                  {link.name}
                </button>
              </li>
            ))}
            
            {/* Shopping Cart Icon */}
            {cartItemCount > 0 && (
              <li>
                <button
                  onClick={onCartClick}
                  className="relative p-2 text-gray-700 hover:text-[#2157da] transition-colors"
                  aria-label="Shopping cart"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span className="absolute -top-1 -right-1 bg-[#F3B74C] text-[#2157da] text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {cartItemCount}
                  </span>
                </button>
              </li>
            )}

            {/* Profile Icon */}
            {isLoggedIn && (
              <li className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="p-2 text-gray-700 hover:text-[#2157da] transition-colors focus:outline-none"
                  aria-label="Profile"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {isProfileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl py-2 z-50 border border-gray-100 animate-dropdown origin-top-right">
                    <button
                      onClick={() => {
                        handleNavClick('profile')
                        setIsProfileDropdownOpen(false)
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-[#2157da] transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Profile
                    </button>
                    <button
                      onClick={() => {
                        onLogout()
                        setIsProfileDropdownOpen(false)
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logout
                    </button>
                  </div>
                )}
              </li>
            )}

            <li>
              <button
                onClick={handleBookNowClick}
                className="px-4 sm:px-6 py-2 bg-[#2157da] text-white rounded-full hover:bg-[#1a3a8a] transition-all shadow-md hover:shadow-lg transform hover:scale-105"
              >
                Book Now
              </button>
            </li>
          </ul>

          {/* Mobile Menu Button & Cart */}
          <div className="lg:hidden flex items-center gap-3">
            {/* Mobile Cart Icon */}
            {cartItemCount > 0 && (
              <button
                onClick={onCartClick}
                className="relative p-2 text-gray-700 hover:text-[#2157da] transition-colors"
                aria-label="Shopping cart"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="absolute -top-1 -right-1 bg-[#F3B74C] text-[#2157da] text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {cartItemCount}
                </span>
              </button>
            )}

            {/* Mobile Profile Icon */}
            {isLoggedIn && (
              <div className="relative" ref={mobileDropdownRef}>
                <button
                  onClick={() => setIsMobileProfileDropdownOpen(!isMobileProfileDropdownOpen)}
                  className="p-2 text-gray-700 hover:text-[#2157da] transition-colors focus:outline-none"
                  aria-label="Profile"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </button>

                {/* Mobile Dropdown Menu */}
                {isMobileProfileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl py-2 z-50 border border-gray-100 animate-dropdown origin-top-right">
                    <button
                      onClick={() => {
                        handleNavClick('profile')
                        setIsMobileProfileDropdownOpen(false)
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-[#2157da] transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Profile
                    </button>
                    <button
                      onClick={() => {
                        onLogout()
                        setIsMobileProfileDropdownOpen(false)
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logout
                    </button>
                  </div>
                )}
              </div>
            )}
            
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-gray-700 focus:outline-none p-2"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <ul className="lg:hidden mt-4 space-y-2 pb-4 animate-fade-in">
            {navLinks.map(link => (
              <li key={link.page}>
                <button
                  onClick={() => handleNavClick(link.page)}
                  className={`block w-full text-left px-4 py-3 rounded-lg transition-colors font-medium ${
                    currentPage === link.page 
                      ? 'bg-[#2157da] text-white' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {link.name}
                </button>
              </li>
            ))}
            <li>
              <button
                onClick={handleBookNowClick}
                className="w-full px-4 py-3 bg-[#F3B74C] text-[#2157da] font-semibold rounded-lg hover:bg-[#e1a63b] transition-colors"
              >
                Book Now
              </button>
            </li>
          </ul>
        )}
      </nav>
    </header>
  )
}

export default Header
