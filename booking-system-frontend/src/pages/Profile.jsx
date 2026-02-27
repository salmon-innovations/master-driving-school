import { useState, useEffect } from 'react'
import { authAPI, schedulesAPI } from '../services/api'
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

  useEffect(() => {
    fetchUserData()
  }, [])

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
                    <p className="text-gray-500 text-lg font-semibold mb-2">No enrollments yet</p>
                    <p className="text-gray-400 text-sm mb-6">Your course history will appear here once you enroll in a course.</p>
                    <button
                      onClick={() => onNavigate('courses')}
                      className="px-6 py-2.5 bg-[#2157da] text-white rounded-xl font-bold hover:bg-[#1a3a8a] transition-colors shadow-md"
                    >
                      Browse Courses
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {courseHistory.map((enrollment) => {
                      const courseName = enrollment.course_full_name || enrollment.slot_type?.toUpperCase() + ' Course'
                      const schedDate = formatDate(enrollment.schedule_date)
                      const schedEndDate = enrollment.schedule_end_date && enrollment.schedule_end_date !== enrollment.schedule_date
                        ? formatDate(enrollment.schedule_end_date)
                        : null
                      const statusLabel = enrollment.enrollment_status
                        ? enrollment.enrollment_status.charAt(0).toUpperCase() + enrollment.enrollment_status.slice(1)
                        : 'Enrolled'

                      return (
                        <div
                          key={enrollment.enrollment_id}
                          className="border border-gray-200 rounded-2xl p-6 hover:border-[#2157da] hover:shadow-md transition-all"
                        >
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
                            <div className="flex-1">
                              {/* Course type badge + name */}
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-100 text-[#2157da]">
                                  {enrollment.course_category || enrollment.slot_type?.toUpperCase()}
                                </span>
                                {enrollment.course_type && (
                                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                                    {enrollment.course_type}
                                  </span>
                                )}
                              </div>
                              <h3 className="text-lg font-bold text-gray-900 mb-3">{courseName}</h3>

                              {/* Meta info row */}
                              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600">
                                {/* Date */}
                                {schedDate && (
                                  <span className="flex items-center gap-1.5">
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    {schedDate}{schedEndDate ? ` – ${schedEndDate}` : ''}
                                  </span>
                                )}

                                {/* Session & Time */}
                                {enrollment.session && (
                                  <span className="flex items-center gap-1.5">
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {enrollment.session} · {enrollment.time_range}
                                  </span>
                                )}

                                {/* Branch */}
                                {enrollment.branch_name && (
                                  <span className="flex items-center gap-1.5">
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    {enrollment.branch_name}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Status badges */}
                            <div className="flex flex-col items-end gap-2 shrink-0">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${getStatusColor(enrollment.enrollment_status)}`}>
                                {statusLabel}
                              </span>
                              {enrollment.payment_status && (
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${getPaymentColor(enrollment.payment_status)}`}>
                                  {enrollment.payment_status}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Enrolled date */}
                          <p className="text-[11px] text-gray-400 mt-2">
                            Enrolled on {new Date(enrollment.enrolled_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                          </p>
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
  )
}

export default Profile
