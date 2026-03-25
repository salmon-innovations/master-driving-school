import { useState, useEffect } from 'react'
import { authAPI, setAuthToken } from '../services/api'
import { useNotification } from '../context/NotificationContext'

function SignIn({ onNavigate, setIsLoggedIn, setPendingVerificationEmail, setLockedAccountEmail }) {
  const { showNotification } = useNotification()
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)

  useEffect(() => {
    const userToken = localStorage.getItem('userToken')
    const userStr = localStorage.getItem('user')
    if (userToken && userStr) {
      try {
        const user = JSON.parse(userStr)
        const role = (user.role || 'student').toLowerCase()
        if (role === 'admin') {
          onNavigate('admin')
        } else if (role === 'staff') {
          onNavigate('staff-dashboard')
        } else {
          onNavigate('home')
        }
      } catch (e) { }
    }
  }, [onNavigate])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.email) {
      newErrors.email = 'Email is required'
    } else if (!/@/.test(formData.email)) {
      newErrors.email = 'Email must contain @'
    } else if (!/\.com$/.test(formData.email.toLowerCase())) {
      newErrors.email = 'Email must end with .com'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email format is invalid'
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    }

    if (!acceptedTerms) {
      newErrors.terms = 'You must accept the Terms & Conditions'
    }

    return newErrors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newErrors = validateForm()

    if (Object.keys(newErrors).length === 0) {
      setLoading(true)
      try {
        // Call the real API
        const response = await authAPI.login({
          email: formData.email,
          password: formData.password,
        })

        // Handle expected unverified state without treating it as a failed login error.
        const shouldGoToVerification =
          response?.needsVerification === true ||
          /not verified|verification code|verify/i.test(String(response?.message || ''))

        if (shouldGoToVerification) {
          setPendingVerificationEmail(response.email || formData.email)
          showNotification(
            response.message || 'Email not verified. Please enter the verification code sent to your inbox.',
            response.emailSent === false ? 'warning' : 'success'
          )
          onNavigate('verify-email')
          return
        }

        if (!response?.token || !response?.user) {
          throw new Error(response?.message || 'Unexpected login response. Please try again.')
        }

        // Store auth token and user info
        setAuthToken(response.token)
        localStorage.setItem('user', JSON.stringify(response.user))

        // Update login state
        setIsLoggedIn(true)

        console.log('Login successful, role:', response.user.role);

        // Navigate based on role
        const role = (response.user.role || 'student').toLowerCase();

        if (role === 'admin') {
          onNavigate('admin')
        } else if (role === 'staff') {
          onNavigate('staff-dashboard')
        } else {
          onNavigate('branches')
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('Sign-in request failed:', {
            accountLocked: error.accountLocked,
            needsVerification: error.needsVerification,
            statusCode: error.statusCode,
            message: error.message,
          })
        }

        // IMPORTANT: Check account locked FIRST before email verification
        // Both return 403, but accountLocked flag differentiates them
        if (error.accountLocked === true) {
          console.log('Account is locked, navigating to lock-account page');
          setLockedAccountEmail(error.email || formData.email)
          onNavigate('lock-account')
          return
        }

        // Check if message contains 'locked' (fallback check)
        if (error.message && error.message.toLowerCase().includes('locked')) {
          console.log('Lock detected in message, navigating to lock-account page');
          setLockedAccountEmail(error.email || formData.email)
          onNavigate('lock-account')
          return
        }

        // Check if user needs email verification
        if (error.needsVerification === true || (error.statusCode === 403 && error.message && error.message.toLowerCase().includes('verify'))) {
          setPendingVerificationEmail(error.email || formData.email)
          showNotification('A verification code has been sent to your email. Please check your inbox (including spam folder).', 'success')
          onNavigate('verify-email')
          return
        }

        setErrors({ general: error.message || 'Login failed. Please try again.' })
      } finally {
        setLoading(false)
      }
    } else {
      setErrors(newErrors)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[url('/images/cover.png')] bg-cover bg-center bg-no-repeat py-8 px-4 relative">
      {/* Dark Overlay for better visibility if needed */}
      <div className="absolute inset-0 bg-black/40"></div>

      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col lg:flex-row relative z-10" data-aos="fade-up">

        {/* Left Section - Login Form */}
        <div className="w-full lg:w-1/2 p-8 lg:p-12">
          <h1 className="text-4xl font-bold text-[#2157da] text-center mb-8">
            WELCOME
          </h1>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* General Error Message */}
            {errors.general && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {errors.general}
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2 text-left">
                Email
              </label>
              <input
                type="text"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`w-full px-4 py-3 bg-white border ${errors.email ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2157da] focus:border-transparent transition-all`}
                placeholder="Enter your email or phone"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-500">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2 text-left">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 bg-white border ${errors.password ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2157da] focus:border-transparent pr-12 transition-all`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-[#2157da] transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.047m4.522-2.33a10.02 10.02 0 011.458-.123c4.478 0 8.268 2.943 9.542 7a10.044 10.044 0 01-2.257 4.03m-2.094-2.094a3 3 0 11-4.243-4.243M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-500">{errors.password}</p>
              )}
            </div>

            {/* Forgot Password */}
            <div className="text-right">
              <button
                type="button"
                onClick={() => onNavigate('forgot-password')}
                className="text-sm text-gray-500 hover:text-[#2157da] transition-colors"
              >
                Forgot Password?
              </button>
            </div>

            {/* Terms & Conditions Checkbox */}
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="terms"
                checked={acceptedTerms}
                onChange={(e) => {
                  setAcceptedTerms(e.target.checked)
                  if (errors.terms) {
                    setErrors(prev => ({ ...prev, terms: '' }))
                  }
                }}
                className="mt-1 w-4 h-4 text-[#2157da] border-gray-300 rounded focus:ring-[#2157da]"
              />
              <label htmlFor="terms" className="text-sm text-gray-700">
                I agree to the{' '}
                <button
                  type="button"
                  onClick={() => setShowTermsModal(true)}
                  className="text-[#2157da] hover:underline font-medium"
                >
                  Terms & Conditions
                </button>
              </label>
            </div>
            {errors.terms && (
              <p className="text-xs text-red-500">{errors.terms}</p>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading || !acceptedTerms}
              className="w-full bg-[#1e3a8a] text-white py-3.5 rounded-lg font-bold hover:bg-[#172554] transition-all disabled:bg-[#93c5fd] disabled:text-white disabled:cursor-not-allowed uppercase tracking-wide hover:shadow-lg transform hover:-translate-y-0.5 shadow-md"
            >
              {loading ? 'LOGGING IN...' : 'LOGIN'}
            </button>
          </form>

          {/* Sign Up Link */}
          <p className="text-center text-sm text-gray-600 mt-5">
            Don't have an account?{' '}
            <button
              onClick={() => onNavigate('signup')}
              className="text-[#2157da] font-semibold hover:underline"
            >
              Enroll Now
            </button>
          </p>


        </div>

        {/* Right Section - Branding */}
        <div className="w-full lg:w-1/2 bg-[#2157da] p-8 lg:p-12 flex flex-col justify-center items-center text-white relative overflow-hidden">
          {/* Decorative Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#2157da] to-[#1a3a8a] opacity-50"></div>

          <div className="relative z-10 text-center">
            {/* Logo Circle */}
            <div
              className="w-32 h-32 mx-auto mb-6 bg-white rounded-full flex items-center justify-center shadow-xl cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => onNavigate('home')}
            >
              <img
                src="/images/logo.png"
                alt="Master Driving School"
                className="w-20 h-20 object-contain"
              />
            </div>

            {/* Title */}
            <h2 className="text-4xl font-bold mb-3">Master School</h2>
            <p className="text-xl font-medium mb-4 text-blue-100">Drive with Confidence</p>
            <p className="text-sm text-blue-100 mb-8 max-w-md mx-auto">
              Join the best driving school and master the road today.
            </p>
          </div>
        </div>

      </div>

      {/* Terms & Conditions Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={() => setShowTermsModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>

            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Terms and Conditions</h2>
              <button
                onClick={() => setShowTermsModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 text-gray-700">
              <p className="mb-6 leading-relaxed">
                These terms and conditions govern the enrollment and participation in the Driving courses offered by MASTER DRIVING SCHOOL. By enrolling in our driving school, you agree to the following terms:
              </p>

              {/* 1. ELIGIBILITY */}
              <h3 className="text-lg font-bold text-[#2157da] mb-3">1. ELIGIBILITY</h3>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>Student(s) must be at least 16 years of age with Parents consent when applying for TDC.</li>
                <li>Student(s) must hold a valid Student Permit or valid Driver's license to enroll in any driving course.</li>
              </ul>

              {/* 2. ENROLLMENT AND PAYMENT */}
              <h3 className="text-lg font-bold text-[#2157da] mb-3">2. ENROLLMENT AND PAYMENT</h3>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>Enrollment is only confirmed upon receipt of a completed application form and payment of the course fee.</li>
                <li>50% Down payment is acceptable.</li>
                <li>Full payment must be made before the 2nd day of lesson.</li>
                <li>Payments are <strong>NON-REFUNDABLE</strong> and <strong>NON-TRANSFERABLE</strong> unless stated otherwise in the cancellation and refund policy.</li>
              </ul>

              {/* 3. CANCELLATION AND REFUND POLICY */}
              <h3 className="text-lg font-bold text-[#2157da] mb-3">3. CANCELLATION AND REFUND POLICY</h3>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>A full refund will be issued if the student cancels the enrollment within (5) five days before the course start date.</li>
                <li>If a lesson is cancelled by the student, a (5) five days' notice is required to reschedule without incurring a fee.</li>
                <li>Failure to give proper notice or missed lessons may result in late payment fee amounting to:
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>1st re-schedule - Php 1,000.00</li>
                    <li>2nd re-schedule - Lesson Forfeiture</li>
                  </ul>
                </li>
                <li>Refunds for courses cancelled by the driving school will be issued in full.</li>
              </ul>

              {/* 4. LESSON SCHEDULE */}
              <h3 className="text-lg font-bold text-[#2157da] mb-3">4. LESSON SCHEDULE</h3>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>Lessons are scheduled according to the availability of both the instructor and the student. The school reserves the right to adjust the lesson schedule.</li>
                <li>Punctuality is required. Students who arrive late may lose the portion of the lesson missed, and no extra time will be provided.</li>
              </ul>

              {/* 5. STUDENT CONDUCT */}
              <h3 className="text-lg font-bold text-[#2157da] mb-3">5. STUDENT CONDUCT</h3>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>Students must follow all instructions from the instructor during lessons.</li>
                <li>Students are expected to behave responsibly and comply with all traffic laws during lessons.</li>
                <li>Use of alcohol, drugs, or any illegal substances before or during lessons is strictly prohibited and will result in termination of enrollment, without refund.</li>
              </ul>

              {/* 6. LIABILITY */}
              <h3 className="text-lg font-bold text-[#2157da] mb-3">6. LIABILITY</h3>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>The driving school is not liable for any damage, injury, or loss incurred during lessons unless caused by negligence on the part of the school or instructor.</li>
                <li>Students are responsible for any fines, penalties, or legal issues arising from their actions during a lesson. (PDC)</li>
              </ul>

              {/* 7. COMPLETION OF COURSE */}
              <h3 className="text-lg font-bold text-[#2157da] mb-3">7. COMPLETION OF COURSE</h3>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>The completion of the course and the issuance of certificates depend on the students' performance and test result.</li>
                <li>The driving school does not guarantee that students will pass their driving test or obtain a driver's license.</li>
              </ul>

              {/* 8. PRIVACY POLICY */}
              <h3 className="text-lg font-bold text-[#2157da] mb-3">8. PRIVACY POLICY</h3>
              <p className="mb-6">
                The driving school respects your privacy and is committed to protecting your personal information. Personal details collected will be kept confidential and used only for course administration and legal purposes.
              </p>

              {/* 9. EMAIL COMMUNICATIONS */}
              <h3 className="text-lg font-bold text-[#2157da] mb-3">9. EMAIL COMMUNICATIONS</h3>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>By enrolling or creating an account, you agree to receive News, Events, and Promotional emails from Master Driving School.</li>
                <li>This applies to all students, including guest students who enroll without creating an account.</li>
                <li>You may contact the school to opt out of promotional emails at any time; however, transactional emails (receipts, schedules, verification) will still be sent.</li>
              </ul>

              {/* 10. AMENDMENTS */}
              <h3 className="text-lg font-bold text-[#2157da] mb-3">10. AMENDMENTS</h3>
              <p className="mb-6">
                The driving school reserves the right to amend these Terms and Conditions at any time. Any changes will be communicated via phone call or email.
              </p>

              <p className="font-semibold text-gray-800">
                By enrolling in Master Driving School, you acknowledge that you have read, understood, and agreed to these Terms and Conditions.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowTermsModal(false)}
                className="w-full bg-[#2157da] text-white py-3 rounded-lg font-semibold hover:bg-[#1a3a8a] transition-all"
              >
                I Understand
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

export default SignIn
