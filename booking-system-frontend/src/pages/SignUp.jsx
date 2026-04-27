import { useState, useEffect, useRef } from 'react'
import { authAPI } from '../services/api'
import { useNotification } from '../context/NotificationContext'
import { getZipFromAddress } from '../utils/philippineZipCodes'
import NationalitySelect from '../components/NationalitySelect'
import SmartAddress from '../components/SmartAddress'
import TurnstileWidget from '../components/TurnstileWidget'

// Zip code lookup is handled by the shared utility: getZipFromAddress(address)

function SignUp({ onNavigate, setIsLoggedIn, setPendingVerificationEmail, preSelectedBranch }) {
  const { showNotification } = useNotification()
  const [currentStep, setCurrentStep] = useState(1)
  const steps = [
    { id: 1, name: 'Personal Details' },
    { id: 2, name: 'Address & Contact' },
    { id: 3, name: 'Account Setup' }
  ]

  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    houseNumber: '',
    streetName: '',
    village: '',
    barangay: '',
    city: '',
    province: '',
    address: '', // Combined address
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
    emergencyContactNumber: '',
    password: '',
    confirmPassword: ''
  })

  // We remove the auto-fill on mount to keep the form empty initially (as requested)
  // Zip code and birthPlace will be filled based on the Address field input later.

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const turnstileRef = useRef(null)
  const enrollmentReminder = 'Please make sure all details are correct, as this will be used to process your enrollment.'

  const calculateAge = (birthday) => {
    if (!birthday) return ''
    const birthDate = new Date(birthday)
    const today = new Date()
    let computedAge = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      computedAge--
    }
    return computedAge >= 0 ? String(computedAge) : ''
  }

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
    
    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: formattedValue
      };

      // Auto-calculate age based on birthday
      if (name === 'birthday') {
        updated.age = calculateAge(formattedValue);
        // Clear age error if it was auto-filled
        if (errors.age) {
          setErrors(prevErrors => ({ ...prevErrors, age: '' }));
        }
      }

      // Re-evaluate combined address whenever address parts change
      const addressPartsFields = ['houseNumber', 'streetName', 'village', 'barangay', 'city', 'province'];
      if (addressPartsFields.includes(name)) {
        const parts = [
          updated.houseNumber,
          updated.streetName,
          updated.village,
          updated.barangay,
          updated.city,
          updated.province
        ].filter(Boolean);
        updated.address = parts.join(', ');

        const locationStr = [updated.barangay, updated.city, updated.province].filter(Boolean).join(', ');
        updated.zipCode = getZipFromAddress(locationStr) || updated.zipCode; // Auto-fill zip
      }

      return updated;
    });

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
    if (!formData.province) newErrors.province = 'Province is required'
    if (!formData.city) newErrors.city = 'City/Municipality is required'
    if (!formData.barangay) newErrors.barangay = 'Barangay is required'
    if (!formData.streetName) newErrors.streetName = 'Street Name is required'
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
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email) {
      newErrors.email = 'Email is required'
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Invalid email address'
    }
    return newErrors
  }

  const validateStep3 = () => {
    const newErrors = {}
    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      newErrors.password = 'At least 8 characters'
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }
    if (!turnstileToken) {
      newErrors.turnstile = 'Please complete human verification'
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

  const handleTopBack = () => {
    if (currentStep > 1) {
      handlePrev()
      return
    }
    const lastVisitedPage = sessionStorage.getItem('lastVisitedPage')
    if (lastVisitedPage && !['signup', 'verify-email'].includes(lastVisitedPage)) {
      onNavigate(lastVisitedPage)
      return
    }
    onNavigate('signin')
  }

  const handleSubmit = async () => {
    const newErrors = validateStep3()
    
    if (Object.keys(newErrors).length === 0) {
      setLoading(true)
      try {
        const existingRedirect = sessionStorage.getItem('postVerifyRedirect') || localStorage.getItem('postVerifyRedirect')
        if (!existingRedirect) {
          const fallbackPayload = {
            next: 'branches',
            source: 'signup',
            isOnlineTdcNoSchedule: false,
            createdAt: Date.now(),
          }
          sessionStorage.setItem('postVerifyRedirect', JSON.stringify(fallbackPayload))
          localStorage.setItem('postVerifyRedirect', JSON.stringify(fallbackPayload))
        }

        const response = await authAPI.register({ ...formData, turnstileToken })
        showNotification('Registration successful! Please verify your email.', 'success')
        setPendingVerificationEmail(formData.email)
        onNavigate('verify-email')
      } catch (error) {
        showNotification(error.message || 'Registration failed. Please try again.', 'error')
        setErrors({ general: error.message || 'Registration failed. Please try again.' })
      } finally {
        setLoading(false)
        turnstileRef.current?.reset()
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
            onClick={handleTopBack}
            className="absolute top-8 left-8 text-gray-500 hover:text-[#2157da] flex items-center gap-2 transition-colors font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {currentStep > 1 ? 'Back to Previous Step' : 'Back'}
          </button>

          <div className="mt-12 max-w-2xl mx-auto">
            <h1 className="text-4xl font-bold text-gray-900 mb-6">Enrollment Form</h1>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handlePrev}
                className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-[#2157da] hover:text-[#1a3a8a] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to previous section
              </button>
            )}
            
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-bold text-[#2157da]">
                  Part {currentStep} of 3: {steps[currentStep-1].name}
                </h2>
                <div className="h-1 w-24 bg-[#2157da] mt-2 rounded-full"></div>
              </div>
              
              <div className="flex gap-2">
                {steps.map((step) => (
                  <div 
                    key={step.id}
                    onClick={() => {
                      if (step.id < currentStep) {
                        setCurrentStep(step.id)
                        setErrors({})
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }
                    }}
                    className={`w-3 h-3 rounded-full transition-all duration-300 ${
                      step.id === currentStep ? 'bg-[#2157da] scale-125' : 
                      step.id < currentStep ? 'bg-[#2157da] opacity-50' : 'bg-gray-200'
                    } ${step.id < currentStep ? 'cursor-pointer hover:opacity-80' : ''}`}
                  />
                ))}
              </div>
            </div>

            <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-sm font-medium text-blue-800">{enrollmentReminder}</p>
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
                    <div className="flex justify-between items-center mb-2">
                       <label className="block text-sm font-semibold text-gray-700">Middle Initial</label>
                       <div className="flex items-center gap-3">
                         <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-500">
                           <input 
                             type="radio" 
                             name="middleNameType" 
                             checked={formData.middleName !== 'N/A'} 
                             onChange={() => setFormData(prev => ({ ...prev, middleName: '' }))}
                             className="w-3 h-3 text-[#2157da]"
                           />
                           Has
                         </label>
                         <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-500">
                           <input 
                             type="radio" 
                             name="middleNameType" 
                             checked={formData.middleName === 'N/A'} 
                             onChange={() => setFormData(prev => ({ ...prev, middleName: 'N/A' }))}
                             className="w-3 h-3 text-[#2157da]"
                           />
                           None
                         </label>
                       </div>
                    </div>
                    <input
                      type="text"
                      name="middleName"
                      value={formData.middleName === 'N/A' ? '' : formData.middleName}
                      onChange={handleChange}
                      disabled={formData.middleName === 'N/A'}
                      className={`w-full px-4 py-3 ${formData.middleName === 'N/A' ? 'bg-gray-200 border-gray-300 cursor-not-allowed' : 'bg-gray-50 border-gray-200'} border rounded-lg focus:ring-2 focus:ring-[#2157da] outline-none transition-all`}
                      placeholder={formData.middleName === 'N/A' ? 'N/A' : 'Santos'}
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
                      readOnly
                      tabIndex={-1}
                      className={`w-full px-4 py-3 bg-gray-50 border ${errors.age ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-[#2157da] outline-none transition-all`}
                      placeholder="Auto-calculated"
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
                    <NationalitySelect
                      value={formData.nationality}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 bg-gray-50 border ${errors.nationality ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-[#2157da] outline-none transition-all pr-10`}
                    />
                    {errors.nationality && <p className="text-xs text-red-500 mt-1">{errors.nationality}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Address & Contact */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-fade-in">
                <SmartAddress formData={formData} onChange={handleChange} errors={errors} />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
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
                      placeholder="example@domain.com"
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

            {/* Step 3: Account Setup */}
            {currentStep === 3 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Account Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 bg-gray-50 border ${errors.password ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-[#2157da] outline-none transition-all`}
                      placeholder="Min. 8 characters"
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
                  {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
                  <p className="text-xs text-gray-500 mt-2">At least 8 characters recommended.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Re-type Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 bg-gray-50 border ${errors.confirmPassword ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-[#2157da] outline-none transition-all`}
                      placeholder="Re-enter password"
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
                  {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
                </div>

                <div className="space-y-2 flex flex-col items-center mt-4">
                  <TurnstileWidget
                    ref={turnstileRef}
                    onVerify={(token) => {
                      setTurnstileToken(token)
                      if (errors.turnstile) {
                        setErrors(prev => ({ ...prev, turnstile: '' }))
                      }
                    }}
                    onExpire={() => {
                      setTurnstileToken('')
                    }}
                    onError={() => {
                      setTurnstileToken('')
                      setErrors(prev => ({ ...prev, turnstile: 'Verification failed. Please retry.' }))
                    }}
                  />
                  {errors.turnstile && <p className="text-xs text-red-500 mt-1">{errors.turnstile}</p>}
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
              
              {currentStep < 3 ? (
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
                  disabled={loading || !turnstileToken}
                  className="flex-1 bg-[#2157da] text-white py-3.5 rounded-lg font-bold hover:bg-[#1a3a8a] transition-all disabled:opacity-50 uppercase tracking-wide shadow-lg shadow-blue-900/20"
                >
                  {loading ? 'Creating Account...' : 'Complete Enrollment'}
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
                  <div className={`absolute -left-[43px] top-1.5 w-5 h-5 rounded-full border-4 border-[#1e3a8a] transition-all duration-300 ${
                    currentStep >= step.id ? 'bg-[#4ade80]' : 'bg-blue-800'
                  }`} />
                  
                  <h3 className={`font-semibold text-lg transition-colors duration-300 ${
                    currentStep === step.id ? 'text-white' : 
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

export default SignUp
