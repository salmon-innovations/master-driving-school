import React, { useState, useEffect, useRef, Suspense, lazy } from 'react'
import AOS from 'aos'
import 'aos/dist/aos.css'
import { authAPI } from './services/api'
import Header from './components/Header'
import Footer from './components/Footer'
import Cart from './components/Cart'

// Pages
const Home = lazy(() => import('./pages/Home'))
const Courses = lazy(() => import('./pages/Courses'))
const About = lazy(() => import('./pages/About'))
const Contact = lazy(() => import('./pages/Contact'))
const Branches = lazy(() => import('./pages/Branches'))
const NewsAndEvents = lazy(() => import('./pages/NewsAndEvents'))
const TermsOfUse = lazy(() => import('./pages/TermsOfUse'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const TermsAndConditions = lazy(() => import('./pages/TermsAndConditions'))
const SignIn = lazy(() => import('./pages/SignIn'))
const SignUp = lazy(() => import('./pages/SignUp'))
const GuestEnrollment = lazy(() => import('./pages/GuestEnrollment'))
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const LockAccount = lazy(() => import('./pages/LockAccount'))
const Profile = lazy(() => import('./pages/Profile'))
const Payment = lazy(() => import('./pages/Payment'))
const Schedule = lazy(() => import('./pages/Schedule'))
const Reviews = lazy(() => import('./pages/Reviews'))
const Admin = lazy(() => import('./admin/Admin'))
const StaffDashboard = lazy(() => import('./admin/staff/StaffDashboard'))

import { ThemeProvider } from './context/ThemeContext'
import { NotificationProvider } from './context/NotificationContext'
import './App.css'

import SimpleErrorBoundary from './SimpleErrorBoundary'

const PAGE_TO_PATH = {
  home: '/',
  courses: '/courses',
  about: '/about',
  contact: '/contact',
  branches: '/branches',
  schedule: '/schedule',
  news: '/news',
  terms: '/terms',
  privacy: '/privacy',
  conditions: '/conditions',
  signin: '/signin',
  signup: '/signup',
  'guest-enrollment': '/guest-enrollment',
  'verify-email': '/verify-email',
  'forgot-password': '/forgot-password',
  'lock-account': '/lock-account',
  profile: '/profile',
  reviews: '/reviews',
  payment: '/payment',
  admin: '/admin',
  'staff-dashboard': '/staff-dashboard',
}

const PATH_TO_PAGE = Object.entries(PAGE_TO_PATH).reduce((acc, [page, path]) => {
  acc[path] = page
  return acc
}, {})

const normalizePath = (pathname = '/') => {
  const clean = pathname.trim()
  if (!clean || clean === '/') return '/'
  return clean.replace(/\/+$/, '') || '/'
}

const isPathCompatibleWithPage = (pathname, page) => {
  const path = normalizePath(pathname)
  if (page === 'admin') {
    return path === '/admin' || path.startsWith('/admin/')
  }
  if (page === 'staff-dashboard') {
    return path === '/staff-dashboard' || path.startsWith('/staff-dashboard/')
  }
  return path === getPathForPage(page)
}

const getPageFromLocation = () => {
  const path = normalizePath(window.location.pathname)
  if (path === '/admin' || path.startsWith('/admin/')) return 'admin'
  if (path === '/staff-dashboard' || path.startsWith('/staff-dashboard/')) return 'staff-dashboard'
  return PATH_TO_PAGE[path] || null
}

const getPathForPage = (page) => PAGE_TO_PATH[page] || '/'
const LEGACY_CART_KEY = 'cart'
const GUEST_CART_KEY = 'cart:guest'

const parseCart = (raw) => {
  if (!raw || raw === 'undefined') return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const getCartStorageKey = () => {
  try {
    const token = localStorage.getItem('userToken')
    const userStr = localStorage.getItem('user')
    if (!token || !userStr) return GUEST_CART_KEY

    const user = JSON.parse(userStr)
    const userIdentity = user?.id || user?.email
    if (!userIdentity) return GUEST_CART_KEY

    return `cart:user:${String(userIdentity).toLowerCase()}`
  } catch {
    return GUEST_CART_KEY
  }
}

const loadCartForKey = (key) => {
  const scopedCart = parseCart(localStorage.getItem(key))
  if (scopedCart.length > 0) return scopedCart

  // One-time migration fallback from old single cart key.
  const legacyCart = parseCart(localStorage.getItem(LEGACY_CART_KEY))
  if (legacyCart.length > 0) {
    localStorage.setItem(key, JSON.stringify(legacyCart))
    localStorage.removeItem(LEGACY_CART_KEY)
    return legacyCart
  }

  return scopedCart
}

// Read the stored user role from localStorage (set on login)
const getStoredUserRole = () => {
  try {
    const token = localStorage.getItem('userToken')
    if (!token) return null
    const userStr = localStorage.getItem('user')
    if (!userStr) return null
    const user = JSON.parse(userStr)
    return (user?.role || 'student').toLowerCase()
  } catch {
    return null
  }
}

function App() {
  const activeCartKeyRef = useRef(getCartStorageKey())
  const skipNextCartPersistRef = useRef(false)

  const [currentPage, setCurrentPage] = useState(() => {
    const pageFromUrl = getPageFromLocation()
    if (pageFromUrl) return pageFromUrl
    try {
      const saved = localStorage.getItem('currentPage')
      return saved && saved !== 'undefined' ? saved : 'home'
    } catch { return 'home' }
  })
  const [cart, setCart] = useState(() => {
    try {
      return loadCartForKey(activeCartKeyRef.current)
    } catch { return [] }
  })
  const [showCart, setShowCart] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('userToken'))
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState(sessionStorage.getItem('pendingEmail') || '')
  const [lockedAccountEmail, setLockedAccountEmail] = useState(sessionStorage.getItem('lockedEmail') || '')
  const [preSelectedBranch, setPreSelectedBranch] = useState(() => {
    try {
      const saved = localStorage.getItem('preSelectedBranch')
      return saved && saved !== 'undefined' ? JSON.parse(saved) : null
    } catch { return null }
  })
  const [selectedCourseForSchedule, setSelectedCourseForSchedule] = useState(() => {
    try {
      const saved = localStorage.getItem('selectedCourseForSchedule')
      return saved && saved !== 'undefined' ? JSON.parse(saved) : null
    } catch { return null }
  })
  const [scheduleSelection, setScheduleSelection] = useState(() => {
    try {
      const saved = localStorage.getItem('scheduleSelection')
      if (saved && saved !== 'undefined') {
        const parsed = JSON.parse(saved)
        if (parsed) {
          if (parsed.date) parsed.date = new Date(parsed.date)
          if (parsed.date2) parsed.date2 = new Date(parsed.date2)
        }
        return parsed
      }
    } catch { return null }
  })

  useEffect(() => {
    AOS.init({
      duration: 600,
      once: false,
      offset: 50,
      easing: 'ease-out',
      mirror: true,
      anchorPlacement: 'top-bottom'
    })
  }, [])

  useEffect(() => {
    localStorage.setItem('currentPage', currentPage)
  }, [currentPage])

  useEffect(() => {
    const currentPath = normalizePath(window.location.pathname)
    if (!isPathCompatibleWithPage(currentPath, currentPage)) {
      window.history.replaceState({}, '', getPathForPage(currentPage))
    }
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      const pageFromUrl = getPageFromLocation() || 'home'
      setCurrentPage(pageFromUrl)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (skipNextCartPersistRef.current) {
      skipNextCartPersistRef.current = false
      return
    }
    localStorage.setItem(activeCartKeyRef.current, JSON.stringify(cart))
  }, [cart])

  useEffect(() => {
    const nextCartKey = getCartStorageKey()
    if (activeCartKeyRef.current === nextCartKey) return

    activeCartKeyRef.current = nextCartKey
    skipNextCartPersistRef.current = true
    setCart(loadCartForKey(nextCartKey))
  }, [isLoggedIn])

  useEffect(() => {
    if (preSelectedBranch) localStorage.setItem('preSelectedBranch', JSON.stringify(preSelectedBranch))
    else localStorage.removeItem('preSelectedBranch')
  }, [preSelectedBranch])

  useEffect(() => {
    if (selectedCourseForSchedule) localStorage.setItem('selectedCourseForSchedule', JSON.stringify(selectedCourseForSchedule))
    else localStorage.removeItem('selectedCourseForSchedule')
  }, [selectedCourseForSchedule])

  useEffect(() => {
    if (scheduleSelection) localStorage.setItem('scheduleSelection', JSON.stringify(scheduleSelection))
    else localStorage.removeItem('scheduleSelection')
  }, [scheduleSelection])

  const handleNavigation = (page) => {
    const targetPath = getPathForPage(page)
    const currentPath = normalizePath(window.location.pathname)
    if (currentPath !== targetPath) {
      window.history.pushState({}, '', targetPath)
    }
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout()
      setIsLoggedIn(false)
      handleNavigation('home')
    } catch (error) {
      localStorage.removeItem('userToken')
      localStorage.removeItem('user')
      setIsLoggedIn(false)
      handleNavigation('home')
    }
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'home': return <Home onNavigate={handleNavigation} isLoggedIn={isLoggedIn} />
      case 'courses': return <Courses onNavigate={handleNavigation} cart={cart} setCart={setCart} isLoggedIn={isLoggedIn} preSelectedBranch={preSelectedBranch} setSelectedCourseForSchedule={setSelectedCourseForSchedule} />
      case 'about': return <About />
      case 'contact': return <Contact />
      case 'branches': return <Branches setCurrentPage={handleNavigation} isLoggedIn={isLoggedIn} setPreSelectedBranch={setPreSelectedBranch} />
      case 'schedule': return <Schedule onNavigate={handleNavigation} selectedCourse={selectedCourseForSchedule} preSelectedBranch={preSelectedBranch} setScheduleSelection={setScheduleSelection} scheduleSelection={scheduleSelection} cart={cart} setCart={setCart} isLoggedIn={isLoggedIn} />
      case 'news': return <NewsAndEvents />
      case 'terms': return <TermsOfUse />
      case 'privacy': return <PrivacyPolicy />
      case 'conditions': return <TermsAndConditions />
      case 'signin': return <SignIn onNavigate={handleNavigation} setIsLoggedIn={setIsLoggedIn} setPendingVerificationEmail={setPendingVerificationEmail} setLockedAccountEmail={setLockedAccountEmail} />
      case 'signup': return <SignUp onNavigate={handleNavigation} setIsLoggedIn={setIsLoggedIn} setPendingVerificationEmail={setPendingVerificationEmail} />
      case 'guest-enrollment': return <GuestEnrollment onNavigate={handleNavigation} setIsLoggedIn={setIsLoggedIn} />
      case 'verify-email': return <VerifyEmail onNavigate={handleNavigation} setIsLoggedIn={setIsLoggedIn} userEmail={pendingVerificationEmail} />
      case 'forgot-password': return <ForgotPassword onNavigate={handleNavigation} />
      case 'lock-account': return <LockAccount onNavigate={handleNavigation} lockedEmail={lockedAccountEmail} />
      case 'profile': return <Profile onNavigate={handleNavigation} setIsLoggedIn={setIsLoggedIn} />
      case 'reviews': return <Reviews onNavigate={handleNavigation} />
      case 'payment': return <Payment cart={cart} setCart={setCart} onNavigate={handleNavigation} isLoggedIn={isLoggedIn} preSelectedBranch={preSelectedBranch} scheduleSelection={scheduleSelection} />
      case 'admin': {
        const role = getStoredUserRole()
        if (!role) { handleNavigation('signin'); return null }
        if (role !== 'admin' && role !== 'super_admin') { handleNavigation('signin'); return null }
        return <Admin onNavigate={handleNavigation} setIsLoggedIn={setIsLoggedIn} />
      }
      case 'staff-dashboard': {
        const role = getStoredUserRole()
        if (!role) { handleNavigation('signin'); return null }
        if (role !== 'staff') { handleNavigation('signin'); return null }
        return <StaffDashboard onNavigate={handleNavigation} setIsLoggedIn={setIsLoggedIn} />
      }
      default: return <Home onNavigate={handleNavigation} />
    }
  }

  const isAuthPage = ['signin', 'signup', 'guest-enrollment', 'verify-email', 'forgot-password', 'lock-account', 'admin', 'staff-dashboard'].includes(currentPage)

  return (
    <SimpleErrorBoundary>
      <ThemeProvider>
        <NotificationProvider>
          <div className="min-h-screen flex flex-col bg-white">
          {!isAuthPage && (
            <Header
              currentPage={currentPage}
              onNavigate={handleNavigation}
              cartItemCount={cart.reduce((total, item) => total + item.quantity, 0)}
              onCartClick={() => setShowCart(true)}
              isLoggedIn={isLoggedIn}
              onLogout={handleLogout}
            />
          )}
          <main className={`${!isAuthPage ? 'flex-grow pt-[84px] sm:pt-[108px] md:pt-[124px]' : 'flex-grow'}`}>
            <Suspense fallback={
              <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            }>
              {renderPage()}
            </Suspense>
          </main>
          {!isAuthPage && <Footer onNavigate={handleNavigation} />}
          <Cart
            cart={cart}
            setCart={setCart}
            showCart={showCart}
            setShowCart={setShowCart}
            onNavigate={handleNavigation}
            isLoggedIn={isLoggedIn}
            preSelectedBranch={preSelectedBranch}
            setSelectedCourseForSchedule={setSelectedCourseForSchedule}
          />
        </div>
      </NotificationProvider>
    </ThemeProvider>
    </SimpleErrorBoundary>
  )
}


export default App
