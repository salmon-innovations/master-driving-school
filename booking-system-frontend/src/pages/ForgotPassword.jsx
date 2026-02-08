import { useState } from 'react'
import { authAPI } from '../services/api'
import { useNotification } from '../context/NotificationContext'

function ForgotPassword({ onNavigate }) {
  const { showNotification } = useNotification()
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errors, setErrors] = useState({})

  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    setErrors({})
    
    // Basic validation
    if (!email) {
      setErrors({ email: 'Email is required' })
      return
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setErrors({ email: 'Please enter a valid email' })
      return
    }

    setLoading(true)
    try {
      const response = await authAPI.forgotPassword({ email })
      setSuccessMessage(response.message || 'OTP sent successfully')
      setTimeout(() => setSuccessMessage(''), 3000)
      setStep(2)
    } catch (error) {
      setErrors({ email: error.message || 'Failed to send OTP' })
    } finally {
      setLoading(false)
    }
  }

  const handleOtpSubmit = async (e) => {
    e.preventDefault()
    setErrors({})

    if (!otp || otp.length !== 6) {
      setErrors({ otp: 'Please enter a valid 6-digit OTP' })
      return
    }

    setLoading(true)
    try {
      // For verification step, we usually just move to next step if valid
      // Verify with backend if needed, for now move to step 3
      setStep(3)
    } catch (error) {
      setErrors({ otp: error.message || 'Invalid OTP' })
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setErrors({})

    if (!newPassword) {
      setErrors({ newPassword: 'Password is required' })
      return
    }
    if (newPassword.length < 6) {
      setErrors({ newPassword: 'Password must be at least 6 characters' })
      return
    }
    if (newPassword !== confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match' })
      return
    }

    setLoading(true)
    try {
      const response = await authAPI.resetPassword({ email, code: otp, newPassword })
      setSuccessMessage(response.message || 'Password reset successful')
      setTimeout(() => {
        onNavigate('signin')
      }, 2000)
    } catch (error) {
      setErrors({ general: error.message || 'Failed to reset password' })
    } finally {
      setLoading(false)
    }
  }

  const handleResendOTP = async () => {
    setErrors({})
    setLoading(true)
    try {
      const response = await authAPI.forgotPassword({ email })
      setSuccessMessage(response.message || 'OTP resent to your email')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error) {
      setErrors({ general: error.message || 'Failed to resend OTP' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 py-8 px-4">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col lg:flex-row relative z-10" data-aos="fade-up">
        
        {/* Left Section - Form */}
        <div className="w-full lg:w-1/2 p-8 lg:p-12">
          <h1 className="text-3xl font-bold text-[#2157da] text-center mb-2">
            FORGOT PASSWORD
          </h1>
          <p className="text-gray-600 text-center mb-8 text-sm">
            {step === 1 && 'Enter your email to receive OTP'}
            {step === 2 && 'Enter the OTP sent to your email'}
            {step === 3 && 'Create a new password'}
          </p>

          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 text-sm text-center">
              {successMessage}
            </div>
          )}
          {errors.general && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm text-center">
              {errors.general}
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleEmailSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setErrors({})
                  }}
                  className={`w-full px-4 py-3 bg-white border ${errors.email ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2157da] focus:border-transparent transition-all`}
                  placeholder="your.email@example.com"
                />
                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#1e3a8a] text-white py-3.5 rounded-lg font-bold hover:bg-[#172554] transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide shadow-md"
              >
                {loading ? 'SENDING OTP...' : 'SEND OTP'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => onNavigate('signin')}
                  className="text-sm text-gray-500 hover:text-[#2157da] transition-colors"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleOtpSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Enter 6-Digit OTP
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                    setOtp(value)
                    setErrors({})
                  }}
                  className={`w-full px-4 py-3 bg-white border ${errors.otp ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2157da] focus:border-transparent text-center text-2xl tracking-widest`}
                  placeholder="000000"
                  maxLength={6}
                />
                {errors.otp && <p className="mt-1 text-xs text-red-500">{errors.otp}</p>}
                <p className="mt-2 text-xs text-gray-500 text-center">
                  OTP sent to {email}
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#1e3a8a] text-white py-3.5 rounded-lg font-bold hover:bg-[#172554] transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide shadow-md"
              >
                {loading ? 'VERIFYING...' : 'VERIFY OTP'}
              </button>

              <div className="text-center space-y-3">
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={loading}
                  className="text-[#2157da] hover:underline text-sm font-medium"
                >
                  Resend OTP
                </button>
                <div>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Change Email
                  </button>
                </div>
              </div>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handlePasswordSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value)
                      setErrors({})
                    }}
                    className={`w-full px-4 py-3 bg-white border ${errors.newPassword ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2157da] focus:border-transparent pr-12`}
                    placeholder="Enter new password"
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
                {errors.newPassword && <p className="mt-1 text-xs text-red-500">{errors.newPassword}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value)
                      setErrors({})
                    }}
                    className={`w-full px-4 py-3 bg-white border ${errors.confirmPassword ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2157da] focus:border-transparent pr-12`}
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-[#2157da] transition-colors"
                  >
                    {showConfirmPassword ? (
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
                {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#1e3a8a] text-white py-3.5 rounded-lg font-bold hover:bg-[#172554] transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide shadow-md"
              >
                {loading ? 'RESETTING...' : 'RESET PASSWORD'}
              </button>
            </form>
          )}
        </div>

        {/* Right Section - Branding */}
        <div className="w-full lg:w-1/2 bg-[#2157da] p-8 lg:p-12 flex flex-col justify-center items-center text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#2157da] to-[#1a3a8a] opacity-50"></div>
          
          <div className="relative z-10 text-center">
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
            <h2 className="text-4xl font-bold mb-3">Master School</h2>
            <p className="text-xl font-medium mb-4 text-blue-100">Drive with Confidence</p>
            <p className="text-sm text-blue-100 mb-8 max-w-md mx-auto">
              Recover your account access and get back on the road.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword
