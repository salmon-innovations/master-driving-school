import { useState, useEffect, useRef } from 'react'
import { authAPI, schedulesAPI, starpayAPI, testimonialsAPI, MEDIA_BASE_URL } from '../services/api'
import { useNotification } from '../context/NotificationContext'
import { resolveAvatar } from '../utils/avatarUtils'

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
  const [payMethod, setPayMethod] = useState('StarPay')
  const [payTypeChoice, setPayTypeChoice] = useState('full')
  const [payLoading, setPayLoading] = useState(false)
  const [payToast, setPayToast] = useState(null)
  const [pendingNow, setPendingNow] = useState(Date.now())
  const [expandedBundles, setExpandedBundles] = useState({})

  // Reschedule fee payment state
  const [rescheduleFeeModal, setRescheduleFeeModal] = useState(null) // { enrollmentId, loading, codeUrl, msgId, qrStatus }
  const reschedulePollRef = useRef(null)
  const [waitTimers, setWaitTimers] = useState({}) // { [enrollmentId]: secondsLeft }
  const autoCancelingRef = useRef(new Set())

  // Feedback modal state
  const [feedbackModal, setFeedbackModal] = useState(null) // enrollment object
  const [feedbackForm, setFeedbackForm] = useState({ rating: 5, comment: '', videoFile: null, imageFile: null, error: '' });
  const [submitFeedbackLoading, setSubmitFeedbackLoading] = useState(false)

  // Edit Profile / Password Modals
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [changePasswordModal, setChangePasswordModal] = useState(false);
  const [profileForm, setProfileForm] = useState({});
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef(null);

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

  useEffect(() => {
    const hasPending = courseHistory.some((item) => {
      const rowStatus = String(item?.booking_status || item?.enrollment_status || '').toLowerCase()
      return rowStatus === 'pending'
    })
    if (!hasPending) return

    const interval = setInterval(() => setPendingNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [courseHistory])

  useEffect(() => {
    const now = Date.now()
    const expiredPending = courseHistory.filter((item) => {
      const rowStatus = String(item?.booking_status || item?.enrollment_status || '').toLowerCase()
      const enrolledAtMs = item?.enrolled_at ? new Date(item.enrolled_at).getTime() : NaN
      const isExpired = Number.isFinite(enrolledAtMs) && now >= enrolledAtMs + (20 * 60 * 1000)
      return rowStatus === 'pending' && isExpired && item?.enrollment_id && !autoCancelingRef.current.has(item.enrollment_id)
    })

    if (expiredPending.length === 0) return

    let cancelledCount = 0
    expiredPending.forEach((row) => autoCancelingRef.current.add(row.enrollment_id))

    ;(async () => {
      for (const row of expiredPending) {
        try {
          await schedulesAPI.cancelEnrollment(row.enrollment_id)
          cancelledCount += 1
          setCourseHistory((prev) => prev.map((entry) => {
            if (entry.enrollment_id !== row.enrollment_id) return entry
            return { ...entry, booking_status: 'cancelled', enrollment_status: 'cancelled' }
          }))
        } catch (err) {
          // Keep current state if cancellation fails.
        } finally {
          autoCancelingRef.current.delete(row.enrollment_id)
        }
      }

      if (cancelledCount > 0) {
        showNotification(`${cancelledCount} expired booking${cancelledCount > 1 ? 's were' : ' was'} cancelled automatically.`, 'info')
        fetchUserData()
      }
    })()
  }, [courseHistory, pendingNow, showNotification])

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
      const response = await schedulesAPI.payRemainingBalance(
        payModal.bookingId,
        payMethod,
        payModal?.isPending ? payTypeChoice : 'full'
      )
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

  const handleSubmitFeedback = async (e) => {
    e.preventDefault()
    if (!feedbackForm.comment.trim()) {
      setFeedbackForm(prev => ({ ...prev, error: 'Please provide a review comment.' }));
      return
    }
    
    setFeedbackForm(prev => ({ ...prev, error: '' }));
    setSubmitFeedbackLoading(true)
    
    try {
      let submitData;
      if (feedbackForm.videoFile || feedbackForm.imageFile) {
        submitData = new FormData();
        submitData.append('rating', feedbackForm.rating);
        submitData.append('comment', feedbackForm.comment);
        if (feedbackForm.videoFile) submitData.append('videoFile', feedbackForm.videoFile);
        if (feedbackForm.imageFile) submitData.append('imageFile', feedbackForm.imageFile);
        submitData.append('booking_id', feedbackModal.booking_id);
        if (feedbackModal.course_id) submitData.append('course_id', feedbackModal.course_id);
      } else {
        submitData = {
          rating: feedbackForm.rating,
          comment: feedbackForm.comment,
          booking_id: feedbackModal.booking_id,
          course_id: feedbackModal.course_id
        };
      }
      
      const response = await testimonialsAPI.create(submitData)

      if (response.success) {
        setPayToast({ msg: 'Thank you! Your feedback has been submitted successfully.', type: 'success' })
        setFeedbackModal(null)
        setFeedbackForm({ rating: 5, comment: '', videoFile: null, imageFile: null, error: '' })
      } else {
        throw new Error(response.message || 'Failed to submit feedback.')
      }
    } catch (err) {
      console.error('Feedback error:', err);
      setFeedbackForm(prev => ({ ...prev, error: 'Failed to submit feedback. Please try again.' }));
    } finally {
      setSubmitFeedbackLoading(false)
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

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showNotification('Image must be smaller than 5MB', 'error');
      return;
    }
    setIsUploadingAvatar(true);
    try {
      const response = await authAPI.uploadAvatar(file);
      if (response.success) {
        setUser(prev => ({ ...prev, avatar: response.avatarUrl }));
        showNotification('Profile picture updated!', 'success');
      }
    } catch (err) {
      showNotification(err.message || 'Failed to upload profile picture', 'error');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    try {
      const response = await authAPI.updateProfile(profileForm);
      setUser(response.user);
      setEditProfileModal(false);
      showNotification('Profile updated successfully!', 'success');
    } catch (err) {
      showNotification(err.message || 'Failed to update profile', 'error');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return showNotification('New passwords do not match', 'error');
    }
    setIsUpdatingPassword(true);
    try {
      await authAPI.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      setChangePasswordModal(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showNotification('Password changed successfully!', 'success');
    } catch (err) {
      showNotification(err.message || 'Failed to change password', 'error');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

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

  const parseBookingNotes = (notes) => {
    if (!notes) return {}
    if (typeof notes === 'object') return notes
    if (typeof notes !== 'string') return {}
    try {
      return JSON.parse(notes)
    } catch {
      return {}
    }
  }

  const normalizeCourseName = (name) => String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

  const toDisplayDate = (dateStr) => {
    if (!dateStr) return 'TBA'
    const raw = String(dateStr).trim()
    if (!raw) return 'TBA'

    let d = null
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      d = new Date(`${raw}T00:00:00`)
    } else {
      d = new Date(raw)
    }

    if (Number.isNaN(d.getTime())) {
      // Keep original value if backend stored a human-readable date format.
      return raw
    }

    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const findScheduleForCourse = (courseName, scheduleEntries) => {
    const target = normalizeCourseName(courseName)
    if (!target || !Array.isArray(scheduleEntries) || scheduleEntries.length === 0) return null

    const exact = scheduleEntries.find((entry) => normalizeCourseName(entry?.label) === target)
    if (exact) return exact

    return scheduleEntries.find((entry) => {
      const label = normalizeCourseName(entry?.label)
      return label && (label.includes(target) || target.includes(label))
    }) || null
  }

  const toggleBundle = (bundleKey) => {
    setExpandedBundles((prev) => ({ ...prev, [bundleKey]: !prev[bundleKey] }))
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
            {/* Hidden file input for avatar */}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            {/* Profile Avatar */}
            <div className="relative cursor-pointer group" onClick={() => avatarInputRef.current?.click()} title="Click to change profile picture">
              <img
                src={resolveAvatar(user?.avatar, user?.gender, MEDIA_BASE_URL)}
                alt="Profile"
                className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
                onError={e => { e.target.src = '/images/Defualt_profile_male.png'; }}
              />
              {/* Camera overlay */}
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {isUploadingAvatar ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                ) : (
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </div>
              <div className="absolute bottom-1 right-1 w-8 h-8 bg-[#2157da] rounded-full border-2 border-white flex items-center justify-center shadow">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                </svg>
              </div>
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
                    onClick={() => {
                      setProfileForm({
                        firstName: user?.firstName || '',
                        middleName: user?.middleName || '',
                        lastName: user?.lastName || '',
                        address: user?.address || '',
                        age: user?.age || '',
                        gender: user?.gender || '',
                        birthday: user?.birthday ? new Date(user.birthday).toISOString().split('T')[0] : '',
                        birthPlace: user?.birthPlace || '',
                        nationality: user?.nationality || '',
                        maritalStatus: user?.maritalStatus || '',
                        contactNumbers: user?.contactNumbers || '',
                        zipCode: user?.zipCode || '',
                        emergencyContactPerson: user?.emergencyContactPerson || '',
                        emergencyContactNumber: user?.emergencyContactNumber || ''
                      });
                      setEditProfileModal(true);
                    }}
                    className="flex items-center gap-2 px-6 py-2.5 bg-[#2157da] text-white rounded-lg hover:bg-[#1a3a8a] transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Profile
                  </button>
                  <button
                    onClick={() => {
                      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                      setChangePasswordModal(true);
                    }}
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
                    { (() => {
  const grouped = [];
  const map = new Map();
  courseHistory.forEach(e => {
    const key = e.booking_id || e.enrollment_id || e._displayKey;
    if(!map.has(key)) {
       map.set(key, []);
       grouped.push(map.get(key));
    }
    map.get(key).push(e);
  });
  return grouped;
})().map((bundle, bIdx) => {
  const isBundle = bundle.length > 1;
  const bundleKey = bundle[0].booking_id || bundle[0].enrollment_id || bundle[0]._displayKey;
  const isExpanded = isBundle ? !!expandedBundles[bundleKey] : true;
  return (
    <div key={bundleKey} className={isBundle ? "mb-6 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" : "mb-4"}>
      {isBundle && (
        <button onClick={() => toggleBundle(bundleKey)} className="w-full flex items-center justify-between p-4 bg-gray-50/80 border-b border-gray-200 hover:bg-gray-100 transition-colors text-left">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-blue-100 text-[#2157da] flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
             </div>
             <div>
               <p className="font-extrabold text-gray-900 leading-tight">Booking Bundle ({bundle.length} Courses)</p>
               <p className="text-[12px] text-gray-500 font-semibold mt-0.5">Booked {new Date(bundle[0].enrolled_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <span className="text-xs font-bold text-blue-700 bg-blue-100 px-3 py-1 rounded-full hidden sm:inline-block">{isExpanded ? 'Hide Details' : 'View Full Details'}</span>
             <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
        </button>
      )}
      <div className={`flex flex-col ${isExpanded ? 'block' : 'hidden'} ${isBundle ? 'divide-y divide-gray-100 border-t border-gray-100' : ''}`}>
        {bundle.map((enrollment, cardIdx) => {
          const isPrimaryCard = cardIdx === 0;

          // -- WE INJECT THE OLD MAP BODY LOGIC HERE --
          
                      const courseName = enrollment.course_full_name || (enrollment.slot_type ? enrollment.slot_type.toUpperCase() + ' Course' : 'Course')
                      const schedDate = formatDate(enrollment.schedule_date)
                      const schedEndDate = enrollment.schedule_end_date && enrollment.schedule_end_date !== enrollment.schedule_date
                        ? formatDate(enrollment.schedule_end_date)
                        : null
                      const rawStatus = enrollment.booking_status || enrollment.enrollment_status || 'booked'
                      const bookingStatus = String(enrollment.booking_status || rawStatus || '').toLowerCase()
                      const statusLabel = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1)
                      const isPendingBooking = bookingStatus === 'pending'
                      const pendingExpiresAtMs = isPendingBooking && enrollment?.enrolled_at
                        ? (new Date(enrollment.enrolled_at).getTime() + (20 * 60 * 1000))
                        : null
                      const pendingSecondsLeft = Number.isFinite(pendingExpiresAtMs)
                        ? Math.max(0, Math.floor((pendingExpiresAtMs - pendingNow) / 1000))
                        : null
                      const pendingMinutesLeft = pendingSecondsLeft != null ? Math.floor(pendingSecondsLeft / 60) : null
                      const pendingSecondsRem = pendingSecondsLeft != null ? pendingSecondsLeft % 60 : null
                      const isNoShow = enrollment.enrollment_id && enrollment.enrollment_status === 'no-show'
                      const timerSecs = waitTimers[enrollment.enrollment_id] || 0
                      const timerActive = timerSecs > 0
                      const timerMins = Math.floor(timerSecs / 60)
                      const timerSecsRem = timerSecs % 60
                      const bookingMeta = parseBookingNotes(enrollment.booking_notes)
                      const bookingCourseList = Array.isArray(bookingMeta.courseList) ? bookingMeta.courseList : []
                      const normalizedCourseName = normalizeCourseName(courseName)
                      const normalizedCategoryType = normalizeCourseName(enrollment.course_category || enrollment.slot_type)
                      const matchedCoursesFromNotes = bookingCourseList.filter((course) => {
                        const listedName = normalizeCourseName(course?.name || course?.label || course?.courseName)
                        return listedName && listedName === normalizedCourseName
                      })
                      const preferredNoteType = [...matchedCoursesFromNotes]
                        .reverse()
                        .map((course) => String(course?.type || '').trim())
                        .find((typeValue) => {
                          const normalizedType = normalizeCourseName(typeValue)
                          return normalizedType && normalizedType !== normalizedCategoryType && normalizedType !== normalizedCourseName
                        }) || ''
                      const fallbackCourseType = String(enrollment.course_type || enrollment.slot_type || '').trim()
                      const fallbackNormalizedType = normalizeCourseName(fallbackCourseType)
                      const displayCourseType = String(
                        preferredNoteType || (
                          fallbackNormalizedType
                            && fallbackNormalizedType !== normalizedCategoryType
                            && fallbackNormalizedType !== normalizedCourseName
                            ? fallbackCourseType
                            : ''
                        )
                      ).toUpperCase().trim()
                      const noteScheduleEntries = bookingMeta?.pdcSelections && typeof bookingMeta.pdcSelections === 'object'
                        ? Object.values(bookingMeta.pdcSelections)
                            .map((selection) => ({
                              label: selection?.courseName || selection?.label || 'PDC',
                              date1: selection?.pdcDate || selection?.date || null,
                              date2: selection?.pdcDate2 || selection?.date2 || null,
                              session: selection?.session || selection?.scheduleSession || selection?.pdcSession || null,
                              time: selection?.time
                                || selection?.scheduleTime
                                || selection?.timeRange
                                || selection?.time_range
                                || selection?.pdcSlotDetails?.time_range
                                || selection?.pdcSlotDetails?.time
                                || selection?.slot?.time_range
                                || selection?.slot?.time
                                || null,
                            }))
                            .filter((entry) => entry.date1 || entry.time)
                        : []
                      const otherAvailedCourses = bookingCourseList.filter((course) => {
                        const listedName = normalizeCourseName(course?.name || course?.label || course?.courseName)
                        return listedName && listedName !== normalizeCourseName(courseName)
                      })
                      const bundleScheduleEntries = bundle
                        .filter((row) => row !== enrollment)
                        .map((row) => ({
                          label: row.course_full_name || (row.slot_type ? `${row.slot_type.toUpperCase()} Course` : 'Course'),
                          date1: row.schedule_date || null,
                          date2: row.schedule_end_date && row.schedule_end_date !== row.schedule_date ? row.schedule_end_date : null,
                          session: row.session || null,
                          time: row.time_range || null,
                        }))
                        .filter((entry) => entry.date1 || entry.time)
                      const mergedScheduleEntries = [...bundleScheduleEntries]
                      const seenScheduleKey = new Set()
                      const allScheduleEntries = mergedScheduleEntries.filter((entry) => {
                        const key = `${normalizeCourseName(entry.label)}|${entry.date1 || ''}|${entry.date2 || ''}|${entry.time || ''}`
                        if (seenScheduleKey.has(key)) return false
                        seenScheduleKey.add(key)
                        return true
                      })
                      const hasAdditionalSchedules = otherAvailedCourses.length > 0 || allScheduleEntries.length > 0
                      const detailsKey = `booking-extra-${bundleKey}-${enrollment.enrollment_id || cardIdx}`
                      const isDetailsExpanded = !!expandedBundles[detailsKey]
                      const accentColor = rawStatus === 'completed' ? 'border-l-green-400'
                        : rawStatus === 'enrolled' || rawStatus === 'confirmed' ? 'border-l-blue-400'
                        : rawStatus === 'no-show' ? 'border-l-red-400'
                        : rawStatus === 'pending' ? 'border-l-yellow-400'
                        : rawStatus === 'cancelled' ? 'border-l-gray-300'
                        : 'border-l-[#2157da]'

                      return (
                        <div
                          key={enrollment.enrollment_id || `${enrollment.booking_id}-${enrollment.course_id || cardIdx}`}
                          className={`bg-white ${isBundle ? "" : "rounded-2xl border border-gray-200"} border-l-4 ${accentColor} transition-all overflow-hidden`}
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
                                </div>
                                <div className="flex items-center justify-center gap-2 flex-wrap mt-5">
                                  <h3 className="text-base font-bold text-gray-900 leading-tight">{courseName}</h3>
                                  {displayCourseType && (
                                    <span className="inline-flex items-center justify-center self-center text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-md bg-gray-100 text-gray-500 border border-gray-200 leading-none">
                                      {displayCourseType}
                                    </span>
                                  )}
                                </div>
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

                            {hasAdditionalSchedules && (
                              <div className="mt-4 border-t border-gray-100/80 pt-3">
                                <button
                                  onClick={() => toggleBundle(detailsKey)}
                                  className="w-full flex items-center justify-between px-3 py-2 bg-gray-50/50 hover:bg-black/5 text-gray-600 rounded-xl transition-all group"
                                >
                                  <span className="text-[11px] font-black uppercase tracking-wider text-gray-500 group-hover:text-blue-600 transition-colors">
                                    {isDetailsExpanded ? 'Hide Extra Details' : 'View Included Courses & Schedules'}
                                  </span>
                                  <div className={`w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center border border-gray-100 transition-transform ${isDetailsExpanded ? 'rotate-180 bg-blue-50 border-blue-200' : ''}`}>
                                    <svg className={`w-3.5 h-3.5 ${isDetailsExpanded ? 'text-blue-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </div>
                                </button>
                                
                                {isDetailsExpanded && (
                                  <div className={`mt-3 grid grid-cols-1 ${allScheduleEntries.length > 0 ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-3 px-1`}>
                                    {otherAvailedCourses.length > 0 && (
                                      <div className="w-full">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#2157da]/70 mb-2 px-1 flex items-center gap-1.5">
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                                          Courses Availed
                                        </p>
                                        <ul className="space-y-1.5">
                                          {otherAvailedCourses.map((course, otherIdx) => {
                                            const displayName = course?.name || course?.label || course?.courseName || 'Course'
                                            const scheduleFromNote = findScheduleForCourse(displayName, noteScheduleEntries)
                                            const noteDate1 = scheduleFromNote?.date1 ? toDisplayDate(scheduleFromNote.date1) : null
                                            const noteDate2 = scheduleFromNote?.date2 ? toDisplayDate(scheduleFromNote.date2) : null
                                            const noteTime = [scheduleFromNote?.session, scheduleFromNote?.time].filter(Boolean).join(' · ')
                                            const displayTime = noteTime || 'Time to be announced'
                                            const displayBranch = enrollment?.branch_name || bookingMeta?.branchName || 'Branch to be announced'
                                            return (
                                            <li key={`other-${otherIdx}`} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-[#2157da]" />
                                              <p className="text-sm font-extrabold text-gray-900 text-center leading-tight">{displayName}</p>
                                              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                                                {noteDate1 && (
                                                  <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 text-xs text-gray-600">
                                                    <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                    <span className="font-medium">{noteDate1}{noteDate2 ? ` - ${noteDate2}` : ''}</span>
                                                  </div>
                                                )}
                                                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 text-xs text-gray-600">
                                                  <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                  </svg>
                                                  <span className="font-medium">{displayTime}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 text-xs text-gray-600">
                                                    <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                  <span className="font-medium">{displayBranch}</span>
                                                  </div>
                                                {course?.type && (
                                                  <span className="text-[10px] font-bold uppercase px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-100 text-gray-600">
                                                    {course.type}
                                                  </span>
                                                )}
                                                {!noteDate1 && !noteTime && (
                                                  <span className="text-[10px] font-bold uppercase px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-100 text-amber-600">
                                                    Schedule pending
                                                  </span>
                                                )}
                                              </div>
                                            </li>
                                            )
                                          })}
                                        </ul>
                                      </div>
                                    )}
                                    {allScheduleEntries.length > 0 && (
                                      <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/80 mb-2 px-1 flex items-center gap-1.5">
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                                          Assigned Schedules
                                        </p>
                                        <ul className="space-y-1.5">
                                          {allScheduleEntries.map((entry, scheduleIdx) => {
                                            const d1 = toDisplayDate(entry.date1);
                                            const d2 = entry.date2 ? toDisplayDate(entry.date2) : '';
                                            const scheduleTime = [entry.session, entry.time].filter(Boolean).join(' · ')
                                            return (
                                              <li key={`sch-${scheduleIdx}`} className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm relative overflow-hidden flex flex-col justify-center">
                                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-emerald-600" />
                                                <p className="text-xs font-bold text-gray-800">{entry.label}</p>
                                                <p className="text-[11px] font-semibold text-gray-500 mt-0.5 flex flex-wrap items-center gap-x-2 w-full gap-y-0.5">
                                                    {(d1 !== 'TBA' || d2) ? (
                                                      <>
                                                        <span className="bg-gray-100 px-1.5 rounded">{d1}</span>
                                                        {d2 && d2 !== 'TBA' && (
                                                          <>
                                                            <span className="text-gray-300">-</span>
                                                            <span className="bg-gray-100 px-1.5 rounded">{d2}</span>
                                                          </>
                                                        )}
                                                      </>
                                                    ) : (
                                                      <span className="bg-gray-100 text-gray-400 px-1.5 rounded uppercase text-[9px] tracking-wider">TBA</span>
                                                    )}
                                                </p>
                                                <p className="text-[10px] text-gray-500 mt-1">
                                                  {scheduleTime || 'Time to be announced'}
                                                </p>
                                              </li>
                                            )
                                          })}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Card footer row */}
                          <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                            <p className="text-[11px] text-gray-400">
                              Booked {new Date(enrollment.enrolled_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </p>
                            {rawStatus === 'completed' && (
                              <button
                                onClick={() => setFeedbackModal(enrollment)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2157da] text-white rounded-full text-[11px] font-bold hover:bg-[#1a3a8a] transition-colors shadow-sm"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                </svg>
                                Share Feedback
                              </button>
                            )}
                          </div>

                          {isPendingBooking && (
                            <div className="px-5 py-3 bg-amber-50 border-t border-amber-200">
                              <p className="text-[11px] text-amber-700 font-semibold text-center">
                                {pendingSecondsLeft === 0
                                  ? 'Expired. This pending booking will be automatically cancelled.'
                                  : `Expires in ${pendingMinutesLeft}:${String(pendingSecondsRem).padStart(2, '0')} before automatic cancellation.`}
                              </p>
                            </div>
                          )}

                          {/* Pay Balance / Pending */}
                          {(() => {
                            const rowStatus = String(enrollment.booking_status || rawStatus || '').toLowerCase()
                            const normalizedPaymentType = String(enrollment.payment_status || '').toLowerCase()
                            const coursePriceNum = Math.max(0, Number(enrollment.course_price || 0))
                            const amountPaidNum = Math.max(0, Number(enrollment.amount_paid || 0))
                            const balanceDue = Math.max(0, coursePriceNum - amountPaidNum)
                            const collectableFallbackDue = normalizedPaymentType.includes('downpayment')
                              ? Math.max(0, amountPaidNum)
                              : coursePriceNum
                            const payableBalanceDue = balanceDue > 0 ? balanceDue : collectableFallbackDue
                            const isPendingForPay = rowStatus === 'pending' && (pendingSecondsLeft == null || pendingSecondsLeft > 0)
                            const isCollectableForPay = rowStatus === 'collectable' && payableBalanceDue > 0
                            const canPay = isPendingForPay || isCollectableForPay
                            return canPay ? (
                              <div className="px-5 py-4 bg-orange-50 border-t border-orange-100">
                                <div className="flex items-center justify-between gap-4">
                                  <div>
                                    <p className="text-[11px] text-orange-600 font-semibold uppercase tracking-wide">
                                      {isPendingForPay ? 'Pending Payment' : 'Remaining Balance'}
                                    </p>
                                    <p className="text-xl font-extrabold text-orange-500">₱{(isPendingForPay ? coursePriceNum : payableBalanceDue).toLocaleString()}</p>
                                  </div>
                                  <button
                                    onClick={() => {
                                      setPayModal({
                                        bookingId: enrollment.booking_id,
                                        balanceDue: payableBalanceDue,
                                        courseName,
                                        coursePrice: coursePriceNum,
                                        amountPaid: amountPaidNum,
                                        isPending: isPendingForPay,
                                        paymentStatus: enrollment.payment_status,
                                        bookingNotes: enrollment.booking_notes,
                                        branchName: enrollment.branch_name,
                                      bundleCourses: bundle.map((row) => ({
                                        name: row.course_full_name || (row.slot_type ? `${row.slot_type.toUpperCase()} Course` : 'Course'),
                                        type: row.course_type || row.slot_type || null,
                                      })),
                                      })
                                      setPayTypeChoice(isPendingForPay ? 'downpayment' : 'full')
                                      setPayMethod('StarPay')
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm hover:shadow-md transition-all shrink-0"
                                  >
                                    {isPendingForPay
                                      ? 'Pay via StarPay'
                                      : (normalizedPaymentType.includes('downpayment')
                                        ? 'Pay Remaining via StarPay'
                                        : 'Pay Balance via StarPay')}
                                  </button>
                                </div>
                                {isCollectableForPay && (
                                  <p className="mt-2 text-[11px] text-orange-700 font-medium">
                                    Note: You can also pay walk-in on the day of your first face-to-face lesson.
                                  </p>
                                )}
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
            <h2 className="text-xl font-bold">{payModal.isPending ? 'Pay Pending Course' : 'Pay Remaining Balance'}</h2>
            <p className="text-blue-100 text-sm mt-1">Complete your enrollment payment online</p>
          </div>
          <div className="p-6">
            {(() => {
              const selectedAmount = payModal.isPending
                ? (payTypeChoice === 'downpayment' ? Math.max(0, (payModal.coursePrice || 0) * 0.5) : Math.max(0, payModal.coursePrice || 0))
                : Math.max(0, payModal.balanceDue || 0)
              const modalMeta = parseBookingNotes(payModal.bookingNotes)
              const modalBundleCourses = Array.isArray(payModal.bundleCourses) ? payModal.bundleCourses : []
              const notesCourseList = Array.isArray(modalMeta.courseList) ? modalMeta.courseList : []
              const rawModalCourses = [
                ...modalBundleCourses,
                ...notesCourseList,
              ]
              if (rawModalCourses.length === 0) {
                rawModalCourses.push({ name: payModal.courseName, type: null })
              }
              const modalCourseMap = new Map()
              rawModalCourses.forEach((course) => {
                const courseName = course?.name || course?.courseName || course?.label || ''
                const key = normalizeCourseName(courseName)
                if (!key) return
                modalCourseMap.set(key, {
                  ...course,
                  name: courseName,
                  type: course?.type || course?.slotType || null,
                })
              })
              const modalCourseList = modalCourseMap.size > 0
                ? Array.from(modalCourseMap.values())
                : [{ name: payModal.courseName, type: null }]
              const normalizedStatus = String(payModal.paymentStatus || '').toLowerCase()
              const isDownpaymentFlow = payModal.isPending
                ? payTypeChoice === 'downpayment'
                : normalizedStatus.includes('downpayment')
              const totalAssessment = payModal.isPending
                ? Math.max(0, Number(payModal.coursePrice || 0))
                : Math.max(0, Number(payModal.amountPaid || 0) + Number(payModal.balanceDue || 0), Number(payModal.coursePrice || 0))
              const paidSoFar = payModal.isPending ? 0 : Math.max(0, Number(payModal.amountPaid || 0))
              const remainingAfterThis = Math.max(0, totalAssessment - (paidSoFar + selectedAmount))

              return (
                <>
            <div className="bg-gray-50 rounded-xl p-4 mb-5 border border-gray-200">
              <p className="text-base font-black text-gray-900 mb-3">Enrollment Summary</p>

              <div className="space-y-2 mb-3">
                {modalCourseList.map((course, idx) => (
                  <div key={`modal-course-${idx}`} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold text-gray-800 leading-snug">{course?.name || course?.courseName || 'Course'}</p>
                      {course?.type && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200 shrink-0">
                          {course.type}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 text-sm">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-gray-600">Payment Method</span>
                  <span className="font-semibold text-gray-800">StarPay</span>
                </div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-gray-600">Payment Type</span>
                  <span className="font-semibold text-gray-800">{isDownpaymentFlow ? 'Downpayment (50%)' : 'Full Payment'}</span>
                </div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-gray-600">Total Assessment</span>
                  <span className="font-semibold text-gray-800">₱{totalAssessment.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-gray-600">Paid So Far</span>
                  <span className="font-semibold text-emerald-700">₱{paidSoFar.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center border-t border-emerald-100 pt-1.5">
                  <span className="text-orange-600 font-bold">Amount to Pay</span>
                  <span className="text-2xl font-extrabold text-orange-500">₱{selectedAmount.toLocaleString()}</span>
                </div>
                {remainingAfterThis > 0 && (
                  <p className="mt-1.5 text-[11px] text-gray-500 text-right">Remaining after this payment: ₱{remainingAfterThis.toLocaleString()}</p>
                )}
              </div>
            </div>

            {payModal.isPending && (
              <>
                <label className="block text-sm font-semibold text-gray-600 mb-2">Payment Type</label>
                <select
                  value={payTypeChoice}
                  onChange={(e) => setPayTypeChoice(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-800 font-medium focus:outline-none focus:border-[#2157da] mb-4"
                >
                  <option value="full">Full Payment</option>
                  <option value="downpayment">Downpayment</option>
                </select>
              </>
            )}

            <label className="block text-sm font-semibold text-gray-600 mb-2">Payment Method</label>
            <div className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-[#2b4db8] bg-[#f0f4ff] mb-6">
              <img src="/images/starpay.png" alt="StarPay" className="w-8 h-8 rounded-lg object-cover shadow-sm border border-gray-200 bg-white shrink-0" onError={(e) => e.target.style.display='none'} />
              <div className="flex flex-col overflow-hidden">
                <span className="font-black text-gray-900 text-sm leading-tight">StarPay</span>
                <span className="text-xs text-gray-500 mt-1 truncate">Scan QR Ph in GCash, Maya, GrabPay, BDO, BPI and more</span>
              </div>
            </div>
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
                {payLoading
                  ? 'Processing...'
                  : (payModal.isPending && payTypeChoice === 'downpayment'
                    ? `Pay Downpayment via StarPay - ₱${selectedAmount.toLocaleString()}`
                    : `Pay via StarPay - ₱${selectedAmount.toLocaleString()}`)}
              </button>
            </div>
            </>
              )
            })()}
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

    {/* Feedback Modal */}
    {feedbackModal && (
      <div 
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 transition-opacity"
        onClick={(e) => {
          if (e.target === e.currentTarget && !submitFeedbackLoading) {
            setFeedbackModal(null)
          }
        }}
      >
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#2157da] to-[#3b82f6] p-6 text-white shrink-0">
            <h2 className="text-xl font-bold">Share Your Feedback</h2>
            <p className="text-blue-100 text-sm mt-1">
              For {feedbackModal.course_full_name || (feedbackModal.slot_type ? feedbackModal.slot_type.toUpperCase() + ' Course' : 'Course')}
            </p>
          </div>
          
          {/* Body */}
          <div className="p-6 overflow-y-auto">
            <form id="feedback-form" onSubmit={handleSubmitFeedback}>
              {/* Rating */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">How would you rate your experience?</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFeedbackForm(prev => ({ ...prev, rating: star }))}
                      className={`text-3xl transition-transform hover:scale-110 focus:outline-none ${
                        star <= feedbackForm.rating ? 'text-[#F3B74C]' : 'text-gray-300'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {/* Comment */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">Your Review *</label>
                <textarea
                  required
                  value={feedbackForm.comment}
                  onChange={(e) => setFeedbackForm(prev => ({ ...prev, comment: e.target.value }))}
                  placeholder="Tell us about your learning experience..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#2157da] focus:ring-2 focus:ring-[#2157da]/20 outline-none resize-none transition-all placeholder:text-gray-400"
                  rows={4}
                ></textarea>
              </div>

              {/* Media Upload (Picture / Video) */}
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">Add Picture or Video <span className="text-xs font-normal text-gray-500">(Optional)</span></label>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Picture Upload Box */}
                  <div className="relative border-2 border-dashed border-gray-300 rounded-xl hover:border-[#2157da] hover:bg-blue-50/50 transition-all flex flex-col items-center justify-center p-4 text-center cursor-pointer group">
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file && file.size > 5 * 1024 * 1024) {
                          setFeedbackForm(prev => ({ ...prev, error: 'Image size must be less than 5MB' }));
                          return;
                        }
                        setFeedbackForm(prev => ({ ...prev, imageFile: file, error: '' }));
                      }}
                    />
                    <div className="w-10 h-10 mb-2 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    </div>
                    <span className="text-sm font-semibold text-gray-700 overflow-hidden text-ellipsis w-full whitespace-nowrap px-2">
                      {feedbackForm.imageFile ? feedbackForm.imageFile.name : 'Upload Picture'}
                    </span>
                    <span className="text-xs text-gray-500 mt-1">Max 5MB</span>
                  </div>

                  {/* Video Upload Box */}
                  <div className="relative border-2 border-dashed border-gray-300 rounded-xl hover:border-[#2157da] hover:bg-blue-50/50 transition-all flex flex-col items-center justify-center p-4 text-center cursor-pointer group">
                    <input
                      type="file"
                      accept="video/*"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file && file.size > 50 * 1024 * 1024) {
                          setFeedbackForm(prev => ({ ...prev, error: 'Video size must be less than 50MB' }));
                          return;
                        }
                        setFeedbackForm(prev => ({ ...prev, videoFile: file, error: '' }));
                      }}
                    />
                    <div className="w-10 h-10 mb-2 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                    </div>
                    <span className="text-sm font-semibold text-gray-700 overflow-hidden text-ellipsis w-full whitespace-nowrap px-2">
                      {feedbackForm.videoFile ? feedbackForm.videoFile.name : 'Upload Video'}
                    </span>
                    <span className="text-xs text-gray-500 mt-1">Max 50MB</span>
                  </div>
                </div>
                
                {feedbackForm.error && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-600 text-sm font-medium rounded-lg flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    {feedbackForm.error}
                  </div>
                )}

                <p className="text-xs text-gray-500 mt-3">
                  Share a picture or video of your experience.
                </p>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setFeedbackModal(null)}
              disabled={submitFeedbackLoading}
              className="flex-1 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-bold hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="feedback-form"
              disabled={submitFeedbackLoading || !feedbackForm.comment.trim()}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#2157da] to-[#3b82f6] text-white font-bold hover:shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitFeedbackLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Submitting...
                </>
              ) : (
                'Submit Review'
              )}
            </button>
          </div>
        </div>
      </div>
    )}

    
    {/* Edit Profile Modal */}
    {editProfileModal && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm shadow-xl transition-all overflow-y-auto">
        <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl relative my-auto">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10 shrink-0">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#2157da]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              Edit Profile
            </h3>
            <button onClick={() => setEditProfileModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
            <form id="edit-profile-form" onSubmit={handleUpdateProfile} className="space-y-8">
              
              {/* Personal Information */}
              <section>
                <div className="flex items-center gap-3 mb-4 pb-2 border-b">
                  <div className="p-2 bg-blue-50 rounded-lg text-[#2157da]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </div>
                  <h4 className="text-lg font-bold text-gray-800">Personal Information</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">First Name</label><input type="text" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={profileForm.firstName} onChange={e => setProfileForm({...profileForm, firstName: e.target.value})} required/></div>
                  <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Middle Name</label><input type="text" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={profileForm.middleName} onChange={e => setProfileForm({...profileForm, middleName: e.target.value})} /></div>
                  <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Last Name</label><input type="text" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={profileForm.lastName} onChange={e => setProfileForm({...profileForm, lastName: e.target.value})} required/></div>
                  <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Age</label><input type="number" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={profileForm.age} onChange={e => setProfileForm({...profileForm, age: e.target.value})} /></div>
                  <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Gender</label><select className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={profileForm.gender} onChange={e => setProfileForm({...profileForm, gender: e.target.value})}><option value="">Select Gender</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
                  <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Birthday</label><input type="date" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={profileForm.birthday} onChange={e => setProfileForm({...profileForm, birthday: e.target.value})} /></div>
                  <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Birth Place</label><input type="text" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={profileForm.birthPlace} onChange={e => setProfileForm({...profileForm, birthPlace: e.target.value})} /></div>
                  <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Nationality</label><input type="text" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={profileForm.nationality} onChange={e => setProfileForm({...profileForm, nationality: e.target.value})} /></div>
                  <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Marital Status</label><select className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={profileForm.maritalStatus} onChange={e => setProfileForm({...profileForm, maritalStatus: e.target.value})}><option value="">Select</option><option value="single">Single</option><option value="married">Married</option><option value="widowed">Widowed</option></select></div>
                </div>
              </section>

              {/* Address & Contact */}
              <section>
                <div className="flex items-center gap-3 mb-4 pb-2 border-b">
                  <div className="p-2 bg-blue-50 rounded-lg text-[#2157da]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </div>
                  <h4 className="text-lg font-bold text-gray-800">Address & Contact</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2"><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Full Address</label><input type="text" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={profileForm.address} onChange={e => setProfileForm({...profileForm, address: e.target.value})} /></div>
                  <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Contact Numbers</label><input type="text" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={profileForm.contactNumbers} onChange={e => setProfileForm({...profileForm, contactNumbers: e.target.value})} /></div>
                  <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Zip Code</label><input type="text" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={profileForm.zipCode} onChange={e => setProfileForm({...profileForm, zipCode: e.target.value})} /></div>
                </div>
              </section>

              {/* Emergency Contact */}
              <section>
                <div className="flex items-center gap-3 mb-4 pb-2 border-b">
                  <div className="p-2 bg-red-50 rounded-lg text-red-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  </div>
                  <h4 className="text-lg font-bold text-gray-800">Emergency Contact</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Contact Person</label><input type="text" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={profileForm.emergencyContactPerson} onChange={e => setProfileForm({...profileForm, emergencyContactPerson: e.target.value})} /></div>
                  <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Emergency Number</label><input type="text" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={profileForm.emergencyContactNumber} onChange={e => setProfileForm({...profileForm, emergencyContactNumber: e.target.value})} /></div>
                </div>
              </section>

            </form>
          </div>
          <div className="p-4 sm:p-6 border-t border-gray-100 bg-gray-50 flex gap-3 shrink-0 rounded-b-2xl justify-end">
            <button type="button" onClick={() => setEditProfileModal(false)} className="px-6 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 font-bold hover:bg-gray-100 transition-colors">Cancel</button>
            <button type="submit" form="edit-profile-form" disabled={isUpdatingProfile} className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-[#2157da] to-[#3b82f6] text-white font-bold hover:shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              {isUpdatingProfile ? (
                 <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Saving...
                 </>
              ) : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Change Password Modal */}
    {changePasswordModal && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm shadow-xl transition-all">
        <div className="bg-white rounded-2xl w-full max-w-md flex flex-col overflow-hidden shadow-2xl relative">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white relative z-10 shrink-0">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#2157da]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17.086V19a1 1 0 01-1 1h-2a1 1 0 01-1-1v-2a1 1 0 01.293-.707L10.243 13.5A6 6 0 1121 9z" /></svg>
              Change Password
            </h3>
            <button onClick={() => setChangePasswordModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="p-6">
            <form id="change-password-form" onSubmit={handleChangePassword} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Current Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input type="password" required className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={passwordForm.currentPassword} onChange={e => setPasswordForm({...passwordForm, currentPassword: e.target.value})} placeholder="••••••••" />
                </div>
              </div>
              <div className="pt-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">New Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input type="password" required minLength="6" className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={passwordForm.newPassword} onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})} placeholder="••••••••" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Confirm New Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H5V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input type="password" required className={`w-full pl-10 pr-4 py-2.5 rounded-lg border focus:ring-2 focus:border-transparent outline-none transition-all text-gray-800 focus:bg-white ${passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword ? 'border-red-300 focus:ring-red-400 bg-red-50/30' : 'border-gray-300 focus:ring-[#2157da] bg-gray-50/50'}`} value={passwordForm.confirmPassword} onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})} placeholder="••••••••" />
                </div>
                {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                  <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    Passwords do not match
                  </p>
                )}
              </div>
            </form>
          </div>
          <div className="p-4 sm:p-6 border-t border-gray-100 bg-gray-50 flex gap-3 shrink-0 rounded-b-2xl">
            <button type="button" onClick={() => setChangePasswordModal(false)} className="flex-1 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-bold hover:bg-gray-100 transition-colors">Cancel</button>
            <button type="submit" form="change-password-form" disabled={isUpdatingPassword || (passwordForm.newPassword !== passwordForm.confirmPassword)} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#2157da] to-[#3b82f6] text-white font-bold hover:shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              {isUpdatingPassword ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Updating...
                </>
              ) : 'Update Password'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

export default Profile
