import { useState } from 'react'
import { authAPI } from '../services/api'
import { useNotification } from '../context/NotificationContext'

function GuestEnrollment({ onNavigate, setIsLoggedIn }) {
  const { showNotification } = useNotification()
  const [currentStep, setCurrentStep] = useState(1)
  const steps = [
    { id: 1, name: 'Personal Details' },
    { id: 2, name: 'Address & Contact' }
  ]

  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    address: '',
    age: '',
    gender: '',
    birthday: '',
    birthPlace: '',
    nationality: '',
    maritalStatus: '',
    contactNumbers: '',
    email: '',
    zipCode: '',
    emergencyContactPerson: '',
    emergencyContactNumber: ''
  })

  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const formatPhoneNumber = (value) => {
    // Remove all non-numeric characters
    const cleaned = value.replace(/\D/g, '')

    // Limit to 11 digits
    const limited = cleaned.slice(0, 11)

    // Format as "09XX XXX XXXX"
    if (limited.length === 0) return ''
    if (limited.length <= 4) return limited
    if (limited.length <= 7) return `${limited.slice(0, 4)} ${limited.slice(4)}`
    return `${limited.slice(0, 4)} ${limited.slice(4, 7)} ${limited.slice(7, 11)}`
  }

  const handleChange = (e) => {
    const { name, value } = e.target

    // Format phone numbers
    let formattedValue = value
    if (name === 'contactNumbers' || name === 'emergencyContactNumber') {
      formattedValue = formatPhoneNumber(value)
    }

    setFormData(prev => ({
      ...prev,
      [name]: formattedValue
    }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const validateStep1 = () => {
    const newErrors = {}
    if (!formData.firstName) newErrors.firstName = 'First name is required'
    if (!formData.lastName) newErrors.lastName = 'Last name is required'
    if (!formData.age) newErrors.age = 'Age is required'
    else if (parseInt(formData.age) < 18) newErrors.age = 'Must be at least 18'
    if (!formData.gender) newErrors.gender = 'Gender is required'
    if (!formData.birthday) newErrors.birthday = 'Birthday is required'
    if (!formData.nationality) newErrors.nationality = 'Nationality is required'
    if (!formData.maritalStatus) newErrors.maritalStatus = 'Marital status is required'
    return newErrors
  }

  const validateStep2 = () => {
    const newErrors = {}
    if (!formData.address) newErrors.address = 'Address is required'
    if (!formData.zipCode) newErrors.zipCode = 'Zip code is required'
    if (!formData.birthPlace) newErrors.birthPlace = 'Birth place is required'
    if (!formData.contactNumbers) {
      newErrors.contactNumbers = 'Contact number is required'
    } else {
      const cleanedNumber = formData.contactNumbers.replace(/\s/g, '')
      if (!/^09\d{9}$/.test(cleanedNumber)) {
        newErrors.contactNumbers = 'Phone must start with 09 and be exactly 11 digits'
      }
    }
    if (!formData.emergencyContactPerson) newErrors.emergencyContactPerson = 'Contact person is required'
    if (!formData.emergencyContactNumber) {
      newErrors.emergencyContactNumber = 'Contact number is required'
    } else {
      const cleanedNumber = formData.emergencyContactNumber.replace(/\s/g, '')
      if (!/^09\d{9}$/.test(cleanedNumber)) {
        newErrors.emergencyContactNumber = 'Phone must start with 09 and be exactly 11 digits'
      }
    }
    if (!formData.email) {
      newErrors.email = 'Email is required'
    } else if (!/@/.test(formData.email)) {
      newErrors.email = 'Invalid email'
    }
    return newErrors
  }

  const handleNext = () => {
    let currentErrors = {}
    if (currentStep === 1) currentErrors = validateStep1()
    if (currentStep === 2) currentErrors = validateStep2()

    if (Object.keys(currentErrors).length === 0) {
      setCurrentStep(prev => prev + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      setErrors(currentErrors)
    }
  }

  const handlePrev = () => {
    setCurrentStep(prev => prev - 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async () => {
    const newErrors = validateStep2()

    if (Object.keys(newErrors).length === 0) {
      setLoading(true)
      try {
        // Save guest data to localStorage instead of hitting API
        localStorage.setItem('guestEnrollmentData', JSON.stringify(formData))
        // Set a flag to bypass strict sign in checks for payment
        localStorage.setItem('isGuestCheckout', 'true')

        showNotification('Profile saved! Proceeding to Schedule...', 'success')
        onNavigate('schedule')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } catch (error) {
        showNotification('Failed to save profile. Please try again.', 'error')
        setErrors({ general: 'Failed to save profile.' })
      } finally {
        setLoading(false)
      }
    } else {
      setErrors(newErrors)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[url('/images/cover.png')] bg-cover bg-center bg-no-repeat py-8 px-4 relative">
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/40"></div>

      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col lg:flex-row relative z-10 min-h-[600px]" data-aos="fade-up">

        {/* Left Section - Form */}
        <div className="w-full lg:w-2/3 p-8 lg:p-12 relative">
          <button
            onClick={() => onNavigate('courses')}
            className="absolute top-8 left-8 text-gray-500 hover:text-[#2157da] flex items-center gap-2 transition-colors font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Courses
          </button>

          <div className="mt-12 max-w-2xl mx-auto">
            <h1 className="text-4xl font-bold text-gray-900 mb-6">Guest Enrollment</h1>

            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-bold text-[#2157da]">
                  Part {currentStep} of 2: {steps[currentStep - 1].name}
                </h2>
                <div className="h-1 w-24 bg-[#2157da] mt-2 rounded-full"></div>
              </div>

              <div className="flex gap-2">
                {steps.map((step) => (
                  <div
                    key={step.id}
                    className={`w-3 h-3 rounded-full transition-all duration-300 ${step.id === currentStep ? 'bg-[#2157da] scale-125' :
                      step.id < currentStep ? 'bg-[#2157da] opacity-50' : 'bg-gray-200'
                      }`}
                  />
                ))}
              </div>
            </div>

            {/* General Error Message */}
            {errors.general && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
                {errors.general}
              </div>
            )}

            {/* Step 1: Personal Details */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">First Name</label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 bg-gray-50 border ${errors.firstName ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-[#2157da] outline-none transition-all`}
                      placeholder="Juan"
                    />
                    {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Middle Name</label>
                    <input
                      type="text"
                      name="middleName"
                      value={formData.middleName}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#2157da] outline-none transition-all"
                      placeholder="Santos"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Last Name</label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 bg-gray-50 border ${errors.lastName ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-[#2157da] outline-none transition-all`}
                      placeholder="Cruz"
                    />
                    {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Birth Date</label>
                    <input
                      type="date"
                      name="birthday"
                      value={formData.birthday}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 bg-gray-50 border ${errors.birthday ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-[#2157da] outline-none transition-all`}
                    />
                    {errors.birthday && <p className="text-xs text-red-500 mt-1">{errors.birthday}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Age</label>
                    <input
                      type="number"
                      name="age"
                      value={formData.age}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 bg-gray-50 border ${errors.age ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-[#2157da] outline-none transition-all`}
                      placeholder="20"
                    />
                    {errors.age && <p className="text-xs text-red-500 mt-1">{errors.age}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Gender</label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 bg-gray-50 border ${errors.gender ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-[#2157da] outline-none transition-all`}
                    >
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                    {errors.gender && <p className="text-xs text-red-500 mt-1">{errors.gender}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Civil Status</label>
                    <select
                      name="maritalStatus"
                      value={formData.maritalStatus}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 bg-gray-50 border ${errors.maritalStatus ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-[#2157da] outline-none transition-all`}
                    >
                      <option value="">Select Status</option>
                      <option value="single">Single</option>
                      <option value="married">Married</option>
                      <option value="widowed">Widowed</option>
                      <option value="separated">Separated</option>
                    </select>
                    {errors.maritalStatus && <p className="text-xs text-red-500 mt-1">{errors.maritalStatus}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Nationality</label>
                    <input
                      type="text"
                      name="nationality"
                      value={formData.nationality}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 bg-gray-50 border ${errors.nationality ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-[#2157da] outline-none transition-all`}
                      placeholder="Filipino"
                    />
                    {errors.nationality && <p className="text-xs text-red-500 mt-1">{errors.nationality}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Address & Contact */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Home Address</label>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 bg-gray-50 border ${errors.address ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-[#2157da] outline-none transition-all`}
                      placeholder="House No., Street, Barangay, City"
                    />
                    {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Zip Code</label>
                    <input
                      type="text"
                      name="zipCode"
                      value={formData.zipCode}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 bg-gray-50 border ${errors.zipCode ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-[#2157da] outline-none transition-all`}
                      placeholder="1234"
                    />
                    {errors.zipCode && <p className="text-xs text-red-500 mt-1">{errors.zipCode}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Place of Birth</label>
                  <input
                    type="text"
                    name="birthPlace"
                    value={formData.birthPlace}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 bg-gray-50 border ${errors.birthPlace ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-[#2157da] outline-none transition-all`}
                    placeholder="City or Province"
                  />
                  {errors.birthPlace && <p className="text-xs text-red-500 mt-1">{errors.birthPlace}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Mobile Number</label>
                    <input
                      type="text"
                      name="contactNumbers"
                      value={formData.contactNumbers}
                      onChange={handleChange}
                      maxLength="13"
                      className={`w-full px-4 py-3 bg-gray-50 border ${errors.contactNumbers ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-[#2157da] outline-none transition-all`}
                      placeholder="09XX XXX XXXX"
                    />
                    {errors.contactNumbers && <p className="text-xs text-red-500 mt-1">{errors.contactNumbers}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 bg-gray-50 border ${errors.email ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-[#2157da] outline-none transition-all`}
                      placeholder="example@gmail.com"
                    />
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Emergency Contact Person</label>
                    <input
                      type="text"
                      name="emergencyContactPerson"
                      value={formData.emergencyContactPerson}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 bg-gray-50 border ${errors.emergencyContactPerson ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-[#2157da] outline-none transition-all`}
                      placeholder="Full Name"
                    />
                    {errors.emergencyContactPerson && <p className="text-xs text-red-500 mt-1">{errors.emergencyContactPerson}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Emergency Contact No.</label>
                    <input
                      type="text"
                      name="emergencyContactNumber"
                      value={formData.emergencyContactNumber}
                      onChange={handleChange}
                      maxLength="13"
                      className={`w-full px-4 py-3 bg-gray-50 border ${errors.emergencyContactNumber ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-[#2157da] outline-none transition-all`}
                      placeholder="09XX XXX XXXX"
                    />
                    {errors.emergencyContactNumber && <p className="text-xs text-red-500 mt-1">{errors.emergencyContactNumber}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-4 mt-8 pt-4">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="flex-1 bg-gray-100 text-gray-700 py-3.5 rounded-lg font-bold hover:bg-gray-200 transition-all uppercase tracking-wide"
                >
                  Previous
                </button>
              )}

              {currentStep < 2 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 bg-[#2157da] text-white py-3.5 rounded-lg font-bold hover:bg-[#1a3a8a] transition-all uppercase tracking-wide shadow-lg shadow-blue-900/20"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 bg-[#2157da] text-white py-3.5 rounded-lg font-bold hover:bg-[#1a3a8a] transition-all disabled:opacity-50 uppercase tracking-wide shadow-lg shadow-blue-900/20"
                >
                  {loading ? 'Creating Guest Info...' : 'Proceed to Checkout'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Section - Branding & Stepper */}
        <div className="w-full lg:w-1/3 bg-[#1e3a8a] p-12 flex flex-col justify-center items-center text-white relative overflow-hidden">
          <div className="relative z-10 w-full max-w-sm">
            <div className="text-center mb-12">
              <div
                className="w-24 h-24 mx-auto mb-6 bg-white rounded-2xl flex items-center justify-center shadow-xl transform rotate-3 hover:rotate-0 transition-all cursor-pointer hover:opacity-90"
                onClick={() => onNavigate('home')}
              >
                <img
                  src="/images/logo.png"
                  alt="Master Driving School"
                  className="w-16 h-16 object-contain"
                />
              </div>
              <h2 className="text-3xl font-bold mb-2">Master School</h2>
              <p className="text-sm text-blue-200 opacity-90">
                Join the best driving school and master the road today.
              </p>
            </div>

            {/* Vertical Stepper */}
            <div className="space-y-6 ml-8 border-l-2 border-blue-800 pl-8 relative">
              {steps.map((step, index) => (
                <div key={step.id} className="relative">
                  {/* Dot on line */}
                  <div className={`absolute -left-[39px] top-1.5 w-5 h-5 rounded-full border-4 border-[#1e3a8a] transition-all duration-300 ${currentStep >= step.id ? 'bg-[#4ade80]' : 'bg-blue-800'
                    }`} />

                  <h3 className={`font-semibold text-lg transition-colors duration-300 ${currentStep === step.id ? 'text-white' :
                    currentStep > step.id ? 'text-blue-200' : 'text-blue-400'
                    }`}>
                    {step.name}
                  </h3>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GuestEnrollment
