import { useState, useEffect, useRef } from 'react'
import { authAPI, schedulesAPI, starpayAPI } from '../services/api'
import { useNotification } from '../context/NotificationContext'

// Helper component for detail items
const DetailItem = ({ label, value }) => {
  let displayValue = value;

  // Format phone numbers
  if (value && (label.toLowerCase().includes('contact') || label.toLowerCase().includes('number') || label.toLowerCase().includes('phone'))) {
    const cleaned = String(value).replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('09')) {
      displayValue = `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 11)}`;
    }
  }
  // Format dates for Birthday or other date strings
  else if (value && typeof value === 'string') {
    if (label === 'Birthday' || value.includes('T00:00:00')) {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          displayValue = date.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          });
        }
      } catch (e) {
        console.error('Date formatting error:', e);
      }
    }
  }

  return (
    <div className="group">
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
        {label}
      </label>
      <p className="text-gray-900 font-medium text-lg leading-snug group-hover:text-[#2157da] transition-colors">
        {displayValue || <span className="text-gray-400 italic font-normal">Not provided</span>}
      </p>
    </div>
  )
}

function Profile({ onNavigate, setIsLoggedIn }) {
  const { showNotification } = useNotification()
  const [user, setUser] = useState(null)
  const [courseHistory, setCourseHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('personal') // personal, history

  // Pay balance modal state
  const [payModal, setPayModal] = useState(null) // { bookingId, balanceDue, courseName }
  const [payMethod, setPayMethod] = useState('GCash')
  const [payLoading, setPayLoading] = useState(false)
  const [payToast, setPayToast] = useState(null)

  // Reschedule fee payment state
  const [rescheduleFeeModal, setRescheduleFeeModal] = useState(null) // { enrollmentId, loading, codeUrl, msgId, qrStatus }
  const reschedulePollRef = useRef(null)
  const [waitTimers, setWaitTimers] = useState({}) // { [enrollmentId]: secondsLeft }

  useEffect(() => {
    fetchUserData()
  }, [])

  // Tick down the StarPay session expiry countdown timers
  useEffect(() => {
    const hasActive = Object.values(waitTimers).some(s => s > 0)
    if (!hasActive) return
    const interval = setInterval(() => {
      setWaitTimers(prev => {
        const next = { ...prev }
        for (const id in next) { if (next[id] > 0) next[id] -= 1 }
        return next
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [waitTimers])

  const fetchUserData = async () => {
    try {
      setLoading(true)

      // Fetch user profile
      try {
        const response = await authAPI.getProfile()
        if (response.success) {
          setUser(response.user)
          localStorage.setItem('user', JSON.stringify(response.user))
        }
      } catch (apiError) {
        console.warn('Could not fetch from API, falling back to local storage:', apiError)
        const userData = JSON.parse(localStorage.getItem('user') || '{}')
        setUser(userData)
      }

      // Fetch real course history from database
      try {
        const historyResponse = await schedulesAPI.getMyEnrollments()
        if (historyResponse.success) {
          setCourseHistory(historyResponse.enrollments)
        }
      } catch (histErr) {
        console.warn('Could not fetch course history:', histErr)
        setCourseHistory([])
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePayBalance = async () => {
    if (!payModal) return
    setPayLoading(true)
    try {
      const response = await schedulesAPI.payRemainingBalance(payModal.bookingId, payMethod)
      if (response.success) {
        setPayModal(null)
        setPayToast({ msg: 'Payment successful! A receipt has been sent to your email! 🎉', type: 'success' })
        setTimeout(() => setPayToast(null), 5000)
        fetchUserData() // refresh history so the card updates
      } else {
        setPayToast({ msg: response.error || 'Payment failed', type: 'error' })
        setTimeout(() => setPayToast(null), 4000)
      }
    } catch (err) {
      setPayToast({ msg: 'Payment failed. Please try again.', type: 'error' })
      setTimeout(() => setPayToast(null), 4000)
    } finally {
      setPayLoading(false)
    }
  }

  const handlePayRescheduleFee = async (enrollmentId) => {
    setRescheduleFeeModal({ enrollmentId, loading: true, codeUrl: null, msgId: null, qrStatus: 'pending' })
    try {
      const result = await starpayAPI.payRescheduleFee(enrollmentId)
      if (!result.success || !result.codeUrl) {
        setRescheduleFeeModal(null)
        setPayToast({ msg: result.message || 'Failed to create payment order', type: 'error' })
        setTimeout(() => setPayToast(null), 6000)
        return
      }
      setRescheduleFeeModal({ enrollmentId, loading: false, codeUrl: result.codeUrl, msgId: result.msgId, qrStatus: 'pending' })
      // Poll every 3s for confirmation
      reschedulePollRef.current = setInterval(async () => {
        try {
          const status = await starpayAPI.checkStatus(result.msgId)
          const state = status.starpayState || status.localStatus
          if (state === 'SUCCESS' || status.localStatus === 'paid') {
            clearInterval(reschedulePollRef.current)
            setRescheduleFeeModal(prev => prev ? { ...prev, qrStatus: 'success' } : null)
            setTimeout(() => {
              setRescheduleFeeModal(null)
              setPayToast({ msg: 'Reschedule fee paid! You can now book a new schedule. 🎉', type: 'success' })
              setTimeout(() => setPayToast(null), 6000)
              fetchUserData()
            }, 2000)
          } else if (['FAIL', 'REVERSED', 'CLOSE'].includes(state)) {
            clearInterval(reschedulePollRef.current)
            setRescheduleFeeModal(prev => prev ? { ...prev, qrStatus: 'failed' } : null)
          }
        } catch { /* ignore poll errors */ }
      }, 3000)
    } catch (err) {
      setRescheduleFeeModal(null)
      if (err.waitMinutes && enrollmentId) {
        setWaitTimers(prev => ({ ...prev, [enrollmentId]: Math.ceil(err.waitMinutes * 60) }))
      }
      const msg = err.message || 'Payment error'
      setPayToast({ msg, type: err.message?.includes('wait') ? 'info' : 'error' })
      setTimeout(() => setPayToast(null), 8000)
    }
  }

  const handleLogout = async () => {
    try {
      await authAPI.logout()
      setIsLoggedIn(false)
      onNavigate('home')
    } catch (error) {
      console.error('Logout error:', error)
      // Still logout on client side even if server call fails
      localStorage.removeItem('user')
      localStorage.removeItem('userToken')
      setIsLoggedIn(false)
      onNavigate('home')
    }
  }

  const getStatusColor = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'completed': return 'bg-green-100 text-green-800 border border-green-200'
      case 'enrolled': return 'bg-blue-100 text-blue-800 border border-blue-200'
      case 'in progress': return 'bg-blue-100 text-blue-800 border border-blue-200'
      case 'no-show': return 'bg-red-100 text-red-800 border border-red-200'
      case 'cancelled': return 'bg-gray-100 text-gray-600 border border-gray-200'
      case 'upcoming': return 'bg-yellow-100 text-yellow-800 border border-yellow-200'
      case 'pending': return 'bg-yellow-100 text-yellow-800 border border-yellow-200'
      case 'confirmed': return 'bg-green-100 text-green-800 border border-green-200'
      case 'rejected': return 'bg-red-100 text-red-800 border border-red-200'
      default: return 'bg-gray-100 text-gray-800 border border-gray-200'
    }
  }

  const getPaymentColor = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'full payment': return 'bg-green-50 text-green-700'
      case 'partial payment': return 'bg-yellow-50 text-yellow-700'
      case 'no payment': return 'bg-red-50 text-red-700'
      default: return 'bg-gray-50 text-gray-600'
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return null
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2157da] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <>
    {payToast && (
      <div className={`fixed top-6 right-6 z-[9999] px-5 py-3 rounded-xl font-semibold text-sm shadow-xl flex items-center gap-2 ${
        payToast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200'
        : payToast.type === 'info' ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
        : 'bg-red-50 text-red-700 border border-red-200'
      }`}>
        {payToast.type === 'success' ? '✅' : payToast.type === 'info' ? '⏳' : '❌'} {payToast.msg}
      </div>
    )}
    <div className="py-12 sm:py-16 lg:py-20 bg-gray-50 min-h-[calc(100vh-4rem)]">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        {/* Profile Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8" data-aos="fade-up">
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Profile Avatar */}
            <div className="relative">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#2157da] to-[#1a3a8a] flex items-center justify-center text-white text-4xl font-bold">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div className="absolute bottom-0 right-0 w-10 h-10 bg-green-500 rounded-full border-4 border-white"></div>
            </div>

            {/* Profile Info */}
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-4xl font-extrabold text-gray-900 mb-2">
                {user?.firstName} {user?.lastName}
              </h1>
              <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4 text-gray-600 mb-4">
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {user?.email}
                </span>
                <span className="hidden md:block w-1 h-1 bg-gray-400 rounded-full"></span>
                <span className="flex items-center gap-1.5 text-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16" />
                  </svg>
                  ID: {user?.id}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start mt-4">
                <span className="px-4 py-1 bg-blue-100 text-[#2157da] text-sm font-bold rounded-full border border-blue-200">
                  STUDENT
                </span>
                <span className="px-4 py-1 bg-green-100 text-green-700 text-sm font-bold rounded-full border border-green-200">
                  VERIFIED
                </span>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="group flex items-center gap-2 px-6 py-2.5 bg-white border-2 border-red-500 text-red-500 rounded-xl font-bold hover:bg-red-500 hover:text-white transition-all transform hover:-translate-y-0.5 active:scale-95"
            >
              <svg className="w-5 h-5 group-hover:animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden" data-aos="fade-up" data-aos-delay="100">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('personal')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${activeTab === 'personal'
                ? 'bg-[#2157da] text-white'
                : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              Personal Information
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${activeTab === 'history'
                ? 'bg-[#2157da] text-white'
                : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              Course History
            </button>
          </div>

          <div className="p-8">
            {/* Personal Information Tab */}
            {activeTab === 'personal' && (
              <div className="space-y-10" data-aos="fade-in">
                {/* Section: Basic Information */}
                <section>
                  <div className="flex items-center gap-3 mb-6 pb-2 border-b">
                    <div className="p-2 bg-blue-50 rounded-lg text-[#2157da]">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">Basic Information</h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    <DetailItem label="First Name" value={user?.firstName} />
                    <DetailItem label="Middle Name" value={user?.middleName} />
                    <DetailItem label="Last Name" value={user?.lastName} />
                    <DetailItem label="Age" value={user?.age} />
                    <DetailItem label="Gender" value={user?.gender} />
                    <DetailItem label="Birthday" value={user?.birthday} />
                    <DetailItem label="Birth Place" value={user?.birthPlace} />
                    <DetailItem label="Nationality" value={user?.nationality} />
                    <DetailItem label="Marital Status" value={user?.maritalStatus} />
                  </div>
                </section>

                {/* Section: Address & Contact */}
                <section>
                  <div className="flex items-center gap-3 mb-6 pb-2 border-b">
                    <div className="p-2 bg-blue-50 rounded-lg text-[#2157da]">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">Address & Contact</h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div className="sm:col-span-2">
                      <DetailItem label="Full Address" value={user?.address} />
                    </div>
                    <DetailItem label="Zip Code" value={user?.zipCode} />
                    <DetailItem label="Contact Number" value={user?.contactNumbers} />
                    <DetailItem label="Email Address" value={user?.email} />
                  </div>
                </section>

                {/* Section: Emergency Contact */}
                <section>
                  <div className="flex items-center gap-3 mb-6 pb-2 border-b">
                    <div className="p-2 bg-red-50 rounded-lg text-red-600">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">Emergency Contact</h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <DetailItem label="Contact Person" value={user?.emergencyContactPerson} />
                    <DetailItem label="Emergency Number" value={user?.emergencyContactNumber} />
                  </div>
                </section>

                <div className="pt-8 border-t flex flex-wrap gap-4">
                  <button
                    onClick={() => showNotification('Edit profile feature coming soon!', 'info')}
                    className="flex items-center gap-2 px-6 py-2.5 bg-[#2157da] text-white rounded-lg hover:bg-[#1a3a8a] transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Profile
                  </button>
                  <button
                    onClick={() => showNotification('Password change coming soon!', 'info')}
                    className="flex items-center gap-2 px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17.086V19a1 1 0 01-1 1h-2a1 1 0 01-1-1v-2a1 1 0 01.293-.707L10.243 13.5A6 6 0 1121 9z" />
                    </svg>
                    Change Password
                  </button>
                </div>
              </div>
            )}

            {/* Course History Tab */}
            {activeTab === 'history' && (
              <div data-aos="fade-in">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">My Course History</h2>
                  <span className="text-sm text-gray-500">{courseHistory.length} enrollment{courseHistory.length !== 1 ? 's' : ''}</span>
                </div>

                {courseHistory.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-24 h-24 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-500 text-lg font-semibold mb-2">No bookings yet</p>
                    <p className="text-gray-400 text-sm mb-6">Your course history will appear here once you book a course.</p>
                    <button
                      onClick={() => onNavigate('courses')}
                      className="px-6 py-2.5 bg-[#2157da] text-white rounded-xl font-bold hover:bg-[#1a3a8a] transition-colors shadow-md"
                    >
                      Browse Courses
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {courseHistory.map((enrollment) => {
                      const courseName = enrollment.course_full_name || (enrollment.slot_type ? enrollment.slot_type.toUpperCase() + ' Course' : 'Course')
                      const schedDate = formatDate(enrollment.schedule_date)
                      const schedEndDate = enrollment.schedule_end_date && enrollment.schedule_end_date !== enrollment.schedule_date
                        ? formatDate(enrollment.schedule_end_date)
                        : null
                      const rawStatus = enrollment.enrollment_status || enrollment.booking_status || 'booked'
                      const statusLabel = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1)
                      const isNoShow = enrollment.enrollment_id && enrollment.enrollment_status === 'no-show'
                      const timerSecs = waitTimers[enrollment.enrollment_id] || 0
                      const timerActive = timerSecs > 0
                      const timerMins = Math.floor(timerSecs / 60)
                      const timerSecsRem = timerSecs % 60
                      const accentColor = rawStatus === 'completed' ? 'border-l-green-400'
                        : rawStatus === 'enrolled' || rawStatus === 'confirmed' ? 'border-l-blue-400'
                        : rawStatus === 'no-show' ? 'border-l-red-400'
                        : rawStatus === 'pending' ? 'border-l-yellow-400'
                        : rawStatus === 'cancelled' ? 'border-l-gray-300'
                        : 'border-l-[#2157da]'

                      return (
                        <div
                          key={enrollment.booking_id}
                          className={`bg-white rounded-2xl border border-gray-200 border-l-4 ${accentColor} shadow-sm hover:shadow-md transition-all overflow-hidden`}
                        >
                          {/* Card header */}
                          <div className="p-5 pb-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                  {(enrollment.course_category || enrollment.slot_type) && (
                                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                      {enrollment.course_category || enrollment.slot_type?.toUpperCase()}
                                    </span>
                                  )}
                                  {enrollment.course_type && (
                                    <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                                      {enrollment.course_type}
                                    </span>
                                  )}
                                </div>
                                <h3 className="text-base font-bold text-gray-900 leading-tight">{courseName}</h3>
                              </div>
                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${getStatusColor(rawStatus)}`}>
                                  {statusLabel}
                                </span>
                                {enrollment.payment_status && (
                                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${getPaymentColor(enrollment.payment_status)}`}>
                                    {enrollment.payment_status}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Meta chips */}
                            {(schedDate || enrollment.session || enrollment.branch_name) && (
                              <div className="flex flex-wrap gap-2 mt-3">
                                {schedDate && (
                                  <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 text-xs text-gray-600">
                                    <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <span className="font-medium">{schedDate}{schedEndDate ? ` – ${schedEndDate}` : ''}</span>
                                  </div>
                                )}
                                {enrollment.session && (
                                  <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 text-xs text-gray-600">
                                    <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="font-medium">{enrollment.session}{enrollment.time_range ? ` · ${enrollment.time_range}` : ''}</span>
                                  </div>
                                )}
                                {enrollment.branch_name && (
                                  <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 text-xs text-gray-600">
                                    <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span className="font-medium">{enrollment.branch_name}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Card footer row */}
                          <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100">
                            <p className="text-[11px] text-gray-400">
                              Booked {new Date(enrollment.enrolled_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </p>
                          </div>

                          {/* Pay Balance */}
                          {(() => {
                            const balanceDue = Math.max(0, (enrollment.course_price || 0) - (enrollment.amount_paid || 0))
                            const canPay = enrollment.booking_status === 'collectable' && balanceDue > 0
                            return canPay ? (
                              <div className="px-5 py-4 bg-orange-50 border-t border-orange-100 flex items-center justify-between gap-4">
                                <div>
                                  <p className="text-[11px] text-orange-600 font-semibold uppercase tracking-wide">Remaining Balance</p>
                                  <p className="text-xl font-extrabold text-orange-500">₱{balanceDue.toLocaleString()}</p>
                                </div>
                                <button
                                  onClick={() => { setPayModal({ bookingId: enrollment.booking_id, balanceDue, courseName }); setPayMethod('GCash') }}
                                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm hover:shadow-md transition-all shrink-0"
                                >
                                  Pay Balance
                                </button>
                              </div>
                            ) : null
                          })()}

                          {/* No-show reschedule fee */}
                          {isNoShow && !enrollment.reschedule_fee_paid && (
                            <div className="px-5 py-4 bg-red-50 border-t border-red-100">
                              <div className="flex flex-col items-center text-center mb-3">
                                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center mb-2">
                                  <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                </div>
                                <p className="text-sm font-bold text-red-700">Marked as No-Show</p>
                                <p className="text-xs text-red-500 mt-0.5">Pay the ₱1,000 reschedule fee to book a new schedule.</p>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <div>
                                  <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide">Reschedule Fee</p>
                                  <p className="text-2xl font-extrabold text-red-600">₱1,000</p>
                                </div>
                                <button
                                  onClick={() => !timerActive && handlePayRescheduleFee(enrollment.enrollment_id)}
                                  disabled={timerActive}
                                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all shrink-0 ${
                                    timerActive
                                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                      : 'bg-gradient-to-r from-red-600 to-red-500 text-white hover:shadow-md hover:-translate-y-0.5 transform'
                                  }`}
                                >
                                  {timerActive ? (
                                    <>
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      Retry in {timerMins}:{String(timerSecsRem).padStart(2, '0')}
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                      </svg>
                                      Pay via StarPay
                                    </>
                                  )}
                                </button>
                              </div>
                              {timerActive && (
                                <p className="text-[11px] text-red-400 mt-2 text-center">
                                  StarPay session still active. Button unlocks when the timer expires.
                                </p>
                              )}
                            </div>
                          )}

                          {/* Fee paid */}
                          {isNoShow && enrollment.reschedule_fee_paid && (
                            <div className="px-5 py-3 bg-green-50 border-t border-green-100 flex items-center gap-2 text-green-700">
                              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-xs font-bold">Reschedule fee paid — contact us to book your new schedule.</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Pay Balance Modal */}
    {payModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={(e) => e.target === e.currentTarget && !payLoading && setPayModal(null)}
      >
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
          <div className="bg-gradient-to-r from-[#2157da] to-[#3b82f6] p-6 text-white">
            <h2 className="text-xl font-bold">Pay Remaining Balance</h2>
            <p className="text-blue-100 text-sm mt-1">Complete your enrollment payment online</p>
          </div>
          <div className="p-6">
            <div className="bg-gray-50 rounded-xl p-4 mb-5">
              <p className="text-sm text-gray-500 mb-1">Course</p>
              <p className="font-bold text-gray-800">{payModal.courseName}</p>
              <div className="flex justify-between mt-3 pt-3 border-t border-gray-200">
                <span className="text-orange-500 font-bold">Amount to Pay</span>
                <span className="text-2xl font-extrabold text-orange-500">₱{payModal.balanceDue.toLocaleString()}</span>
              </div>
            </div>
            <label className="block text-sm font-semibold text-gray-600 mb-2">Payment Method</label>
            <select
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-800 font-medium focus:outline-none focus:border-[#2157da] mb-6"
            >
              <option>GCash</option>
              <option>Cash</option>
              <option>Bank Transfer</option>
            </select>
            <div className="flex gap-3">
              <button
                onClick={() => !payLoading && setPayModal(null)}
                disabled={payLoading}
                className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePayBalance}
                disabled={payLoading}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#2157da] to-[#3b82f6] text-white font-bold hover:shadow-lg transition-all disabled:opacity-60"
              >
                {payLoading ? 'Processing…' : `Pay ₱${payModal.balanceDue.toLocaleString()}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Reschedule Fee QR Modal */}
    {rescheduleFeeModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
          <div className="bg-gradient-to-r from-red-600 to-red-500 p-5 text-white text-center">
            <img src="/images/starpay.png" alt="StarPay" className="w-10 h-10 rounded-xl mx-auto mb-2 object-cover" />
            <h2 className="text-lg font-black">Pay Reschedule Fee</h2>
            <p className="text-red-100 text-xs mt-1">Scan with GCash, Maya, or any QRPh-enabled app</p>
          </div>
          <div className="p-6 flex flex-col items-center">
            {rescheduleFeeModal.loading && (
              <div className="py-8 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500 mx-auto mb-3"></div>
                <p className="text-sm text-gray-500">Creating payment order...</p>
              </div>
            )}
            {!rescheduleFeeModal.loading && rescheduleFeeModal.qrStatus === 'pending' && rescheduleFeeModal.codeUrl && (
              <>
                <div className="p-2 border-4 border-red-500 rounded-xl mb-4">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(rescheduleFeeModal.codeUrl)}&size=220x220&format=png`}
                    alt="StarPay QR"
                    className="w-[220px] h-[220px]"
                  />
                </div>
                <p className="text-sm font-bold text-gray-700 mb-1">Amount Due</p>
                <p className="text-3xl font-black text-red-600 mb-4">₱1,000</p>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></span>
                  Waiting for payment...
                </div>
              </>
            )}
            {rescheduleFeeModal.qrStatus === 'success' && (
              <div className="py-6 text-center">
                <div className="text-5xl mb-3">✅</div>
                <p className="text-xl font-black text-green-600">Payment Confirmed!</p>
                <p className="text-sm text-gray-500 mt-1">Redirecting you now...</p>
              </div>
            )}
            {rescheduleFeeModal.qrStatus === 'failed' && (
              <div className="py-6 text-center">
                <div className="text-5xl mb-3">❌</div>
                <p className="text-xl font-black text-red-600">Payment Failed</p>
                <p className="text-sm text-gray-500 mt-2">Please try again or contact the branch.</p>
                <button
                  onClick={() => { clearInterval(reschedulePollRef.current); setRescheduleFeeModal(null) }}
                  className="mt-4 px-6 py-2 bg-gray-100 rounded-xl font-bold text-sm text-gray-700 hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            )}
          </div>
          {!rescheduleFeeModal.loading && rescheduleFeeModal.qrStatus === 'pending' && (
            <div className="px-6 pb-5">
              <button
                onClick={() => { clearInterval(reschedulePollRef.current); setRescheduleFeeModal(null) }}
                className="w-full py-2.5 rounded-xl border-2 border-gray-200 text-gray-500 font-bold text-sm hover:bg-gray-50"
              >
                Cancel Payment
              </button>
            </div>
          )}
        </div>
      </div>
    )}
    </>
  )
}

export default Profile
