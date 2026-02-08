import { useState, useEffect } from 'react'
import { authAPI } from '../services/api'
import { useNotification } from '../context/NotificationContext'

// Helper component for detail items
const DetailItem = ({ label, value }) => {
  let displayValue = value;

  // Format dates for Birthday or other date strings
  if (value && typeof value === 'string') {
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
      
      // Try to get data from API first for the most complete profile
      try {
        const response = await authAPI.getProfile()
        if (response.success) {
          setUser(response.user)
          // Update localStorage with complete data
          localStorage.setItem('user', JSON.stringify(response.user))
        }
      } catch (apiError) {
        console.warn('Could not fetch from API, falling back to local storage:', apiError)
        const userData = JSON.parse(localStorage.getItem('user') || '{}')
        setUser(userData)
      }
      
      // Fetch course history from API
      // For now, we'll use mock data until the backend endpoint is created
      const mockHistory = [
        {
          id: 1,
          courseName: 'Theoretical Driving Course',
          status: 'Completed',
          date: '2025-12-15',
          progress: 100,
          instructor: 'John Smith',
          branch: 'Caloocan Branch'
        },
        {
          id: 2,
          courseName: 'Practical Driving Course',
          status: 'In Progress',
          date: '2026-01-10',
          progress: 60,
          instructor: 'Maria Garcia',
          branch: 'Manila Branch'
        },
        {
          id: 3,
          courseName: 'Defensive Driving Course',
          status: 'Upcoming',
          date: '2026-03-01',
          progress: 0,
          instructor: 'TBD',
          branch: 'Quezon City Branch'
        }
      ]
      setCourseHistory(mockHistory)
    } catch (error) {
      console.error('Error fetching user data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('userToken')
    setIsLoggedIn(false)
    onNavigate('home')
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-100 text-green-800'
      case 'In Progress':
        return 'bg-blue-100 text-blue-800'
      case 'Upcoming':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
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
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                activeTab === 'personal'
                  ? 'bg-[#2157da] text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Personal Information
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                activeTab === 'history'
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
                <h2 className="text-2xl font-bold text-gray-800 mb-6">My Courses</h2>
                
                {courseHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-24 h-24 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-gray-500 text-lg mb-4">No courses enrolled yet</p>
                    <button
                      onClick={() => onNavigate('courses')}
                      className="px-6 py-2 bg-[#2157da] text-white rounded-lg hover:bg-[#1a3a8a] transition-colors"
                    >
                      Browse Courses
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {courseHistory.map((course) => (
                      <div
                        key={course.id}
                        className="border border-gray-200 rounded-lg p-6 hover:border-[#2157da] transition-colors"
                      >
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                          <div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">{course.courseName}</h3>
                            <div className="flex flex-wrap gap-2 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {course.date}
                              </span>
                              <span className="flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {course.branch}
                              </span>
                              <span className="flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                {course.instructor}
                              </span>
                            </div>
                          </div>
                          <span className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${getStatusColor(course.status)}`}>
                            {course.status}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-4">
                          <div className="flex justify-between text-sm text-gray-600 mb-2">
                            <span>Progress</span>
                            <span className="font-semibold">{course.progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-[#2157da] to-[#1a3a8a] h-2 rounded-full transition-all duration-500"
                              style={{ width: `${course.progress}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          {course.status === 'In Progress' && (
                            <button className="px-4 py-2 bg-[#2157da] text-white rounded-lg hover:bg-[#1a3a8a] transition-colors text-sm">
                              Continue Course
                            </button>
                          )}
                          <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm">
                            View Details
                          </button>
                        </div>
                      </div>
                    ))}
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
