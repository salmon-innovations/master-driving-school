import { useState, useEffect } from 'react'
import AOS from 'aos'
import 'aos/dist/aos.css'
import Header from './components/Header'
import Footer from './components/Footer'
import Cart from './components/Cart'
import Home from './pages/Home'
import Courses from './pages/Courses'
import About from './pages/About'
import Contact from './pages/Contact'
import Branches from './pages/Branches'
import NewsAndEvents from './pages/NewsAndEvents'
import TermsOfUse from './pages/TermsOfUse'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsAndConditions from './pages/TermsAndConditions'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import VerifyEmail from './pages/VerifyEmail'
import ForgotPassword from './pages/ForgotPassword'
import Profile from './pages/Profile'
import Payment from './pages/Payment'
import Admin from './admin/Admin'
import { ThemeProvider } from './context/ThemeContext'
import { NotificationProvider } from './context/NotificationContext'
import './App.css'

function App() {
  const [currentPage, setCurrentPage] = useState(localStorage.getItem('currentPage') || 'home')
  const [cart, setCart] = useState(() => {
    const savedCart = localStorage.getItem('cart')
    return savedCart ? JSON.parse(savedCart) : []
  })
  const [showCart, setShowCart] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState(sessionStorage.getItem('pendingEmail') || '')

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

  // Sync state to storage
  useEffect(() => {
    localStorage.setItem('currentPage', currentPage)
  }, [currentPage])

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart))
  }, [cart])

  useEffect(() => {
    sessionStorage.setItem('pendingEmail', pendingVerificationEmail)
  }, [pendingVerificationEmail])

  // Check if user is logged in on mount
  useEffect(() => {
    const userToken = localStorage.getItem('userToken')
    setIsLoggedIn(!!userToken)
  }, [])

  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0)
  }

  const handleLogout = () => {
    localStorage.removeItem('userToken')
    localStorage.removeItem('user')
    setIsLoggedIn(false)
    setCurrentPage('home')
  }

  const handleCartClick = () => {
    setShowCart(true)
  }

  const renderPage = () => {
    switch(currentPage) {
      case 'home': return <Home onNavigate={setCurrentPage} isLoggedIn={isLoggedIn} />
      case 'courses': return <Courses onNavigate={setCurrentPage} cart={cart} setCart={setCart} isLoggedIn={isLoggedIn} />
      case 'about': return <About />
      case 'contact': return <Contact />
      case 'branches': return <Branches setCurrentPage={setCurrentPage} />
      case 'news': return <NewsAndEvents />
      case 'terms': return <TermsOfUse />
      case 'privacy': return <PrivacyPolicy />
      case 'conditions': return <TermsAndConditions />
      case 'signin': return <SignIn onNavigate={setCurrentPage} setIsLoggedIn={setIsLoggedIn} setPendingVerificationEmail={setPendingVerificationEmail} />
      case 'signup': return <SignUp onNavigate={setCurrentPage} setIsLoggedIn={setIsLoggedIn} setPendingVerificationEmail={setPendingVerificationEmail} />
      case 'verify-email': return <VerifyEmail onNavigate={setCurrentPage} setIsLoggedIn={setIsLoggedIn} userEmail={pendingVerificationEmail} />
      case 'forgot-password': return <ForgotPassword onNavigate={setCurrentPage} />
      case 'profile': return <Profile onNavigate={setCurrentPage} setIsLoggedIn={setIsLoggedIn} />
      case 'payment': return <Payment cart={cart} setCart={setCart} onNavigate={setCurrentPage} isLoggedIn={isLoggedIn} />
      case 'admin': return <Admin onNavigate={setCurrentPage} setIsLoggedIn={setIsLoggedIn} />
      default: return <Home onNavigate={setCurrentPage} />
    }
  }

  const isAuthPage = ['signin', 'signup', 'verify-email', 'forgot-password', 'admin'].includes(currentPage)

  return (
    <ThemeProvider>
      <NotificationProvider>
        <div className="min-h-screen flex flex-col bg-white">
        {!isAuthPage && (
          <Header 
            currentPage={currentPage} 
            onNavigate={setCurrentPage} 
            cartItemCount={getTotalItems()}
            onCartClick={handleCartClick}
            isLoggedIn={isLoggedIn}
            onLogout={handleLogout}
          />
        )}
        <main className={`${!isAuthPage ? 'flex-grow pt-20 sm:pt-24 md:pt-28' : 'flex-grow'}`}>
          {renderPage()}
        </main>
        {!isAuthPage && <Footer onNavigate={setCurrentPage} />}
        <Cart 
          cart={cart} 
          setCart={setCart} 
          showCart={showCart} 
          setShowCart={setShowCart}
          onNavigate={setCurrentPage}
          isLoggedIn={isLoggedIn}
        />
        </div>
      </NotificationProvider>
    </ThemeProvider>
  )
}

export default App
