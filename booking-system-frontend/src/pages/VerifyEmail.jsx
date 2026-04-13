import { useState, useEffect } from 'react'
import { authAPI, setAuthToken } from '../services/api'
import { useNotification } from '../context/NotificationContext'

function VerifyEmail({ onNavigate, setIsLoggedIn, userEmail }) {
  const { showNotification } = useNotification()
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const getPostVerifyRedirect = () => {
    const parsePayload = (raw) => {
      if (!raw) return null
      try {
        const parsed = JSON.parse(raw)
        if (!parsed || typeof parsed !== 'object') return null
        return parsed
      } catch {
        return null
      }
    }

    return parsePayload(sessionStorage.getItem('postVerifyRedirect'))
      || parsePayload(localStorage.getItem('postVerifyRedirect'))
  }

  const clearPostVerifyRedirect = () => {
    sessionStorage.removeItem('postVerifyRedirect')
    localStorage.removeItem('postVerifyRedirect')
  }

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleChange = (index, value) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) return

    const newCode = [...code]
    newCode[index] = value
    setCode(newCode)
    setError('')

    // Auto-focus next input
    if (value && index < 5) {
      document.getElementById(`code-${index + 1}`)?.focus()
    }
  }

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      document.getElementById(`code-${index - 1}`)?.focus()
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').slice(0, 6)
    if (/^\d+$/.test(pastedData)) {
      const newCode = pastedData.split('').concat(['', '', '', '', '', '']).slice(0, 6)
      setCode(newCode)
      // Focus last filled input
      const lastIndex = Math.min(pastedData.length, 5)
      document.getElementById(`code-${lastIndex}`)?.focus()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const verificationCode = code.join('')

    if (verificationCode.length !== 6) {
      setError('Please enter all 6 digits')
      return
    }

    setLoading(true)
    try {
      const response = await authAPI.verifyEmail({
        email: userEmail,
        code: verificationCode,
      })

      // Store token and user info
      setAuthToken(response.token)
      localStorage.setItem('user', JSON.stringify(response.user))

      // Update login state
      setIsLoggedIn(true)

      const redirectContext = getPostVerifyRedirect()
      const nextRoute = redirectContext?.next
      if (nextRoute === 'payment') {
        clearPostVerifyRedirect()
        onNavigate('payment')
        return
      }

      if (nextRoute === 'schedule') {
        clearPostVerifyRedirect()
        onNavigate('schedule')
        return
      }

      const savedScheduleSelection = localStorage.getItem('scheduleSelection')
      if (savedScheduleSelection) {
        try {
          const parsedSchedule = JSON.parse(savedScheduleSelection)
          if (parsedSchedule?.isOnlineTdcNoSchedule) {
            clearPostVerifyRedirect()
            onNavigate('payment')
            return
          }
        } catch {
          // Ignore invalid saved schedule payload.
        }
      }

      clearPostVerifyRedirect()
      onNavigate('schedule')
    } catch (error) {
      setError(error.message || 'Invalid verification code')
      setCode(['', '', '', '', '', ''])
      document.getElementById('code-0')?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (countdown > 0) return

    setResending(true)
    try {
      await authAPI.resendVerificationCode({ email: userEmail })
      setCountdown(60) // 60 seconds cooldown
      setError('')
      showNotification('Verification code sent! Please check your email.', 'success')
    } catch (error) {
      setError(error.message || 'Failed to resend code')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 py-8 px-4">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col lg:flex-row relative z-10" data-aos="fade-up">
        
        {/* Left Section - Form */}
        <div className="w-full lg:w-1/2 p-8 lg:p-12">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[#2157da] mb-2">
              VERIFY YOUR EMAIL
            </h1>
            <p className="text-gray-600 text-sm">
              We've sent a 6-digit code to<br />
              <span className="font-semibold text-[#2157da]">{userEmail}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-center text-sm">
                {error}
              </div>
            )}

            {/* Code Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3 text-center">
                Enter Verification Code
              </label>
              <div className="flex gap-2 justify-center" onPaste={handlePaste}>
                {code.map((digit, index) => (
                  <input
                    key={index}
                    id={`code-${index}`}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2157da] focus:border-transparent transition-all"
                    disabled={loading}
                  />
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || code.join('').length !== 6}
              className="w-full bg-[#1e3a8a] text-white py-3.5 rounded-lg font-bold hover:bg-[#172554] transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide shadow-md"
            >
              {loading ? 'VERIFYING...' : 'VERIFY EMAIL'}
            </button>

            {/* Resend Code */}
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">
                Didn't receive the code?
              </p>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={resending || countdown > 0}
                className="text-[#2157da] font-semibold hover:underline disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {resending ? 'Sending...' : countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}
              </button>
            </div>

            {/* Back to Sign In */}
            <div className="text-center pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => onNavigate('signin')}
                className="text-gray-500 hover:text-[#2157da] transition-colors text-sm"
              >
                ← Back to Sign In
              </button>
            </div>
          </form>

           {/* Info Box */}
           <div className="mt-6 bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
            <p className="text-xs text-blue-800">
              <strong>💡 Tip:</strong> The verification code expires in 10 minutes. Check your spam folder if you don't see the email.
            </p>
          </div>
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
              Secure your account and start your journey with us.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VerifyEmail
