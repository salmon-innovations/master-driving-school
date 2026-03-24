import { useState, useEffect } from 'react'
import { authAPI } from '../services/api'
import { useNotification } from '../context/NotificationContext'
import { getZipFromAddress } from '../utils/philippineZipCodes'

// Zip code lookup is handled by the shared utility: getZipFromAddress(address)

function GuestEnrollment({ onNavigate, setIsLoggedIn, preSelectedBranch }) {
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

  // We remove auto-fill on mount to keep the form empty (as requested)
  // Zip code and birthPlace will be filled based on the Address field input later.

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

    const calculateAge = (birthday) => {
      if (!birthday) return '';
      const birthDate = new Date(birthday);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age >= 0 ? age.toString() : '';
    };

    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: formattedValue
      };

      // Auto-calculate age based on birthday
      if (name === 'birthday' && formattedValue) {
        updated.age = calculateAge(formattedValue);
        // Clear age error if it was auto-filled
        if (errors.age) {
          setErrors(prevErrors => ({ ...prevErrors, age: '' }));
        }
      }

      // Auto-fill zip code based on Philippine city/municipality in address
      if (name === 'address') {
        updated.zipCode = getZipFromAddress(formattedValue);
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
    <div className="min-h-screen w-full flex items-center justify-center bg-[url('/images/cover.png')] bg-cover bg-center bg-no-repeat py-12 px-4 relative font-sans">
      {/* Dynamic Background Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/40 to-transparent backdrop-blur-[2px]"></div>

      <div className="w-full max-w-7xl bg-white/95 backdrop-blur-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col lg:flex-row relative z-10 min-h-[750px] border border-white/20" data-aos="zoom-in">

        {/* ──────────────────────────────────────────────────────────────────
            LEFT SECTION: FORM CONTENT
            ────────────────────────────────────────────────────────────────── */}
        <div className="w-full lg:w-2/3 p-8 lg:p-12 relative flex flex-col">
          <button
            onClick={() => onNavigate('courses')}
            className="absolute top-10 left-10 text-gray-400 hover:text-[#2157da] flex items-center gap-2.5 transition-all duration-300 font-semibold group"
          >
            <div className="p-2 rounded-full bg-gray-50 group-hover:bg-blue-50 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </div>
            <span>Back to Courses</span>
          </button>

          <div className="mt-14 w-full">
            <header className="mb-10 text-center lg:text-left">
              <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-3">Begin Your Journey</h1>
              <p className="text-gray-500 font-medium">Complete your profile to get started with Master School.</p>
            </header>

            {/* Step Progress Bar */}
            <div className="mb-10 relative">
               <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-extrabold text-[#2157da] uppercase tracking-widest">
                    Part {currentStep} of 2 — {steps[currentStep - 1].name}
                  </span>
                  <span className="text-xs font-bold text-gray-400">{Math.round((currentStep/2)*100)}% Complete</span>
               </div>
               <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#2157da] to-[#4facfe] transition-all duration-700 ease-out"
                    style={{ width: `${(currentStep / 2) * 100}%` }}
                  ></div>
               </div>
            </div>

            {/* General Error Message */}
            {errors.general && (
              <div className="bg-red-50/50 border-l-4 border-red-500 text-red-700 px-5 py-4 rounded-xl mb-8 text-sm flex items-center gap-3 animate-shake">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                <span className="font-semibold">{errors.general}</span>
              </div>
            )}

            <div className="form-sections-container w-full">
                {/* Step 1: Personal Details */}
                {currentStep === 1 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    
                    {/* Section: Name Identity */}
                    <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                      <div className="flex items-center gap-2 mb-6">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-[#2157da]">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                        </div>
                        <h3 className="font-bold text-gray-800">Identity Details</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="relative group">
                          <label className="text-[0.65rem] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">First Name</label>
                          <input
                            type="text"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleChange}
                            className={`w-full px-4 py-3.5 bg-white border-2 border-transparent shadow-sm rounded-xl focus:border-[#2157da] focus:ring-4 focus:ring-blue-50 outline-none transition-all font-semibold ${errors.firstName ? 'border-red-300 ring-4 ring-red-50' : 'hover:border-gray-200'}`}
                            placeholder="Juan"
                          />
                          {errors.firstName && <p className="text-[10px] text-red-500 font-bold mt-1.5 ml-1 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"/></svg>
                            {errors.firstName}
                          </p>}
                        </div>

                        <div className="relative group flex flex-col justify-end">
                          <div className="flex flex-wrap justify-between items-center mb-1.5 px-1 gap-2">
                             <label className="text-[0.65rem] font-black text-gray-400 uppercase tracking-widest leading-none">Middle Initial</label>
                             <div className="flex items-center gap-2">
                               <label className="flex items-center gap-1 cursor-pointer text-[10px] font-bold text-gray-500 hover:text-[#2157da] transition-colors">
                                 <input 
                                   type="radio" 
                                   name="middleNameType" 
                                   checked={formData.middleName !== 'N/A'} 
                                   onChange={() => setFormData(prev => ({ ...prev, middleName: '' }))}
                                   className="w-2.5 h-2.5 text-[#2157da]"
                                 />
                                 Has
                               </label>
                               <label className="flex items-center gap-1 cursor-pointer text-[10px] font-bold text-gray-500 hover:text-[#2157da] transition-colors">
                                 <input 
                                   type="radio" 
                                   name="middleNameType" 
                                   checked={formData.middleName === 'N/A'} 
                                   onChange={() => setFormData(prev => ({ ...prev, middleName: 'N/A' }))}
                                   className="w-2.5 h-2.5 text-[#2157da]"
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
                            className={`w-full px-4 py-3.5 bg-white border-2 border-transparent shadow-sm rounded-xl focus:border-[#2157da] focus:ring-4 focus:ring-blue-50 outline-none transition-all font-semibold ${formData.middleName === 'N/A' ? 'opacity-40 grayscale cursor-not-allowed bg-gray-50' : 'hover:border-gray-200'}`}
                            placeholder={formData.middleName === 'N/A' ? '—' : 'Santos'}
                          />
                        </div>

                        <div>
                          <label className="text-[0.65rem] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Last Name</label>
                          <input
                            type="text"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleChange}
                            className={`w-full px-4 py-3.5 bg-white border-2 border-transparent shadow-sm rounded-xl focus:border-[#2157da] focus:ring-4 focus:ring-blue-50 outline-none transition-all font-semibold ${errors.lastName ? 'border-red-300 ring-4 ring-red-50' : 'hover:border-gray-200'}`}
                            placeholder="Cruz"
                          />
                          {errors.lastName && <p className="text-[10px] text-red-500 font-bold mt-1.5 ml-1 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"/></svg>
                            {errors.lastName}
                          </p>}
                        </div>
                      </div>
                    </div>

                    {/* Section: Demographics */}
                    <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                      <div className="flex items-center gap-2 mb-6">
                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        </div>
                        <h3 className="font-bold text-gray-800">Demographics</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <label className="text-[0.65rem] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Birth Date</label>
                          <input
                            type="date"
                            name="birthday"
                            value={formData.birthday}
                            onChange={handleChange}
                            className={`w-full px-4 py-3.5 bg-white border-2 border-transparent shadow-sm rounded-xl focus:border-[#2157da] focus:ring-4 focus:ring-blue-50 outline-none transition-all font-semibold ${errors.birthday ? 'border-red-300 ring-4 ring-red-50' : 'hover:border-gray-200'}`}
                          />
                          {errors.birthday && <p className="text-[10px] text-red-500 font-bold mt-1.5 ml-1">{errors.birthday}</p>}
                        </div>
                        <div>
                          <label className="text-[0.65rem] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Age</label>
                          <input
                            type="number"
                            name="age"
                            value={formData.age}
                            onChange={handleChange}
                            readOnly
                            className="w-full px-4 py-3.5 bg-gray-100 border-2 border-gray-50 rounded-xl outline-none font-bold text-gray-500 cursor-default"
                            placeholder="Age"
                          />
                          {errors.age && <p className="text-[10px] text-red-500 font-bold mt-1.5 ml-1">{errors.age}</p>}
                        </div>
                        <div>
                          <label className="text-[0.65rem] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Gender</label>
                          <div className="relative">
                            <select
                              name="gender"
                              value={formData.gender}
                              onChange={handleChange}
                              className={`w-full px-4 py-3.5 bg-white border-2 border-transparent shadow-sm rounded-xl focus:border-[#2157da] focus:ring-4 focus:ring-blue-50 outline-none transition-all font-semibold appearance-none cursor-pointer ${errors.gender ? 'border-red-300 ring-4 ring-red-50' : 'hover:border-gray-200'}`}
                            >
                              <option value="">Select Gender</option>
                              <option value="male">Male</option>
                              <option value="female">Female</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7"/></svg>
                            </div>
                          </div>
                          {errors.gender && <p className="text-[10px] text-red-500 font-bold mt-1.5 ml-1">{errors.gender}</p>}
                        </div>
                      </div>
                    </div>

                    {/* Section: Background */}
                    <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                      <div className="flex items-center gap-2 mb-6">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-2.105-3.99c.433.023.868.033 1.304.033 4.173 0 7.378-2.659 8.017-6.528A4.187 4.187 0 0013.846 6h-3.46M12 11c0-3.517 1.009-6.799 2.753-9.571m-2.105 3.99c-.433-.023-.868-.033-1.304-.033-4.173 0-7.378 2.659-8.017 6.528A4.187 4.187 0 006.154 6h3.46M12 11a1 1 0 11-2 0 1 1 0 012 0z"/></svg>
                        </div>
                        <h3 className="font-bold text-gray-800">Status & Citizenship</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="text-[0.65rem] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Civil Status</label>
                          <div className="relative">
                            <select
                              name="maritalStatus"
                              value={formData.maritalStatus}
                              onChange={handleChange}
                              className={`w-full px-4 py-3.5 bg-white border-2 border-transparent shadow-sm rounded-xl focus:border-[#2157da] focus:ring-4 focus:ring-blue-50 outline-none transition-all font-semibold appearance-none cursor-pointer ${errors.maritalStatus ? 'border-red-300 ring-4 ring-red-50' : 'hover:border-gray-200'}`}
                            >
                              <option value="">Select Status</option>
                              <option value="single">Single</option>
                              <option value="married">Married</option>
                              <option value="widowed">Widowed</option>
                              <option value="separated">Separated</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7"/></svg>
                            </div>
                          </div>
                          {errors.maritalStatus && <p className="text-[10px] text-red-500 font-bold mt-1.5 ml-1">{errors.maritalStatus}</p>}
                        </div>
                        <div>
                          <label className="text-[0.65rem] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Nationality</label>
                          <input
                            type="text"
                            name="nationality"
                            value={formData.nationality}
                            onChange={handleChange}
                            placeholder="e.g. Filipino"
                            className={`w-full px-4 py-3.5 bg-white border-2 border-transparent shadow-sm rounded-xl focus:border-[#2157da] focus:ring-4 focus:ring-blue-50 outline-none transition-all font-semibold ${errors.nationality ? 'border-red-300 ring-4 ring-red-50' : 'hover:border-gray-200'}`}
                          />
                          {errors.nationality && <p className="text-[10px] text-red-500 font-bold mt-1.5 ml-1">{errors.nationality}</p>}
                        </div>
                      </div>
                    </div>

                  </div>
                )}

                {/* Step 2: Address & Contact */}
                {currentStep === 2 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    
                    {/* Location Card */}
                    <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                      <div className="flex items-center gap-2 mb-6">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                        </div>
                        <h3 className="font-bold text-gray-800">Location Details</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="md:col-span-3">
                          <label className="text-[0.65rem] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Home Address</label>
                          <input
                            type="text"
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            className={`w-full px-4 py-3.5 bg-white border-2 border-transparent shadow-sm rounded-xl focus:border-[#2157da] focus:ring-4 focus:ring-blue-50 outline-none transition-all font-semibold ${errors.address ? 'border-red-300 ring-4 ring-red-50' : 'hover:border-gray-200'}`}
                            placeholder="House No., Street, Barangay, City"
                          />
                          {errors.address && <p className="text-[10px] text-red-500 font-bold mt-1.5 ml-1">{errors.address}</p>}
                        </div>
                        <div>
                          <label className="text-[0.65rem] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Zip Code</label>
                          <input
                            type="text"
                            name="zipCode"
                            value={formData.zipCode}
                            onChange={handleChange}
                            className={`w-full px-4 py-3.5 bg-white border-2 border-transparent shadow-sm rounded-xl focus:border-[#2157da] focus:ring-4 focus:ring-blue-50 outline-none transition-all font-semibold ${errors.zipCode ? 'border-red-300 ring-4 ring-red-50' : 'hover:border-gray-200'}`}
                            placeholder="1234"
                          />
                          {errors.zipCode && <p className="text-[10px] text-red-500 font-bold mt-1.5 ml-1">{errors.zipCode}</p>}
                        </div>
                        <div className="md:col-span-4">
                          <label className="text-[0.65rem] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Place of Birth</label>
                          <input
                            type="text"
                            name="birthPlace"
                            value={formData.birthPlace}
                            onChange={handleChange}
                            className={`w-full px-4 py-3.5 bg-white border-2 border-transparent shadow-sm rounded-xl focus:border-[#2157da] focus:ring-4 focus:ring-blue-50 outline-none transition-all font-semibold ${errors.birthPlace ? 'border-red-300 ring-4 ring-red-50' : 'hover:border-gray-200'}`}
                            placeholder="City or Province"
                          />
                          {errors.birthPlace && <p className="text-[10px] text-red-500 font-bold mt-1.5 ml-1">{errors.birthPlace}</p>}
                        </div>
                      </div>
                    </div>

                    {/* Contact Card */}
                    <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                      <div className="flex items-center gap-2 mb-6">
                        <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center text-pink-600">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                        </div>
                        <h3 className="font-bold text-gray-800">Communication</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="text-[0.65rem] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Mobile Number</label>
                          <input
                            type="text"
                            name="contactNumbers"
                            value={formData.contactNumbers}
                            onChange={handleChange}
                            maxLength="13"
                            className={`w-full px-4 py-3.5 bg-white border-2 border-transparent shadow-sm rounded-xl focus:border-[#2157da] focus:ring-4 focus:ring-blue-50 outline-none transition-all font-semibold ${errors.contactNumbers ? 'border-red-300 ring-4 ring-red-50' : 'hover:border-gray-200'}`}
                            placeholder="09XX XXX XXXX"
                          />
                          {errors.contactNumbers && <p className="text-[10px] text-red-500 font-bold mt-1.5 ml-1">{errors.contactNumbers}</p>}
                        </div>
                        <div>
                          <label className="text-[0.65rem] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Email Address</label>
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className={`w-full px-4 py-3.5 bg-white border-2 border-transparent shadow-sm rounded-xl focus:border-[#2157da] focus:ring-4 focus:ring-blue-50 outline-none transition-all font-semibold ${errors.email ? 'border-red-300 ring-4 ring-red-50' : 'hover:border-gray-200'}`}
                            placeholder="example@gmail.com"
                          />
                          {errors.email && <p className="text-[10px] text-red-500 font-bold mt-1.5 ml-1">{errors.email}</p>}
                        </div>
                      </div>
                    </div>

                    {/* Emergency Card */}
                    <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                      <div className="flex items-center gap-2 mb-6">
                        <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                        </div>
                        <h3 className="font-bold text-gray-800">Emergency Contact</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="text-[0.65rem] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Contact Person</label>
                          <input
                            type="text"
                            name="emergencyContactPerson"
                            value={formData.emergencyContactPerson}
                            onChange={handleChange}
                            className={`w-full px-4 py-3.5 bg-white border-2 border-transparent shadow-sm rounded-xl focus:border-[#2157da] focus:ring-4 focus:ring-blue-50 outline-none transition-all font-semibold ${errors.emergencyContactPerson ? 'border-red-300 ring-4 ring-red-50' : 'hover:border-gray-200'}`}
                            placeholder="Full Name"
                          />
                          {errors.emergencyContactPerson && <p className="text-[10px] text-red-500 font-bold mt-1.5 ml-1">{errors.emergencyContactPerson}</p>}
                        </div>
                        <div>
                          <label className="text-[0.65rem] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Contact No.</label>
                          <input
                            type="text"
                            name="emergencyContactNumber"
                            value={formData.emergencyContactNumber}
                            onChange={handleChange}
                            maxLength="13"
                            className={`w-full px-4 py-3.5 bg-white border-2 border-transparent shadow-sm rounded-xl focus:border-[#2157da] focus:ring-4 focus:ring-blue-50 outline-none transition-all font-semibold ${errors.emergencyContactNumber ? 'border-red-300 ring-4 ring-red-50' : 'hover:border-gray-200'}`}
                            placeholder="09XX XXX XXXX"
                          />
                          {errors.emergencyContactNumber && <p className="text-[10px] text-red-500 font-bold mt-1.5 ml-1">{errors.emergencyContactNumber}</p>}
                        </div>
                      </div>
                    </div>

                  </div>
                )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex gap-5 mt-10 pt-6 border-t border-gray-100">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="flex-1 bg-gray-50 text-gray-500 py-4 rounded-2xl font-black hover:bg-gray-100 transition-all uppercase tracking-widest text-xs border-2 border-gray-100"
                >
                  Back
                </button>
              )}

              {currentStep < 2 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-[2] bg-gradient-to-r from-[#2157da] to-[#1a3a8a] text-white py-4 rounded-2xl font-black hover:shadow-xl hover:shadow-blue-900/30 transition-all uppercase tracking-widest text-xs shadow-lg shadow-blue-900/10 active:scale-95"
                >
                  Save & Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-[2] bg-gradient-to-r from-[#2157da] to-[#1a3a8a] text-white py-4 rounded-2xl font-black hover:shadow-xl hover:shadow-blue-900/30 transition-all disabled:opacity-50 uppercase tracking-widest text-xs shadow-lg shadow-blue-900/10 active:scale-95"
                >
                  {loading ? 'Creating Account...' : 'Finish Enrollment'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────────────
            RIGHT SECTION: BRANDING & SIDEBAR
            ────────────────────────────────────────────────────────────────── */}
        <div className="w-full lg:w-1/3 bg-[#1a3a8a] p-12 flex flex-col justify-center items-center text-white relative overflow-hidden">
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-400/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400/10 rounded-full -ml-32 -mb-32 blur-3xl"></div>
          
          <div className="relative z-10 w-full max-w-sm text-center lg:text-left">
            <div className="mb-14">
              <div
                className="w-24 h-24 mx-auto lg:mx-0 mb-8 bg-white rounded-[2rem] flex items-center justify-center shadow-2xl transform hover:scale-105 transition-all duration-500 cursor-pointer group p-4"
                onClick={() => onNavigate('home')}
              >
                <img
                  src="/images/logo.png"
                  alt="Master Driving School"
                  className="w-16 h-16 object-contain group-hover:rotate-12 transition-transform"
                />
              </div>
              <h2 className="text-4xl font-black mb-3 text-white tracking-tight">Master School</h2>
              <div className="h-1 w-12 bg-blue-400 rounded-full mb-4 mx-auto lg:mx-0"></div>
              <p className="text-blue-100/80 font-medium leading-relaxed">
                Join thousands of confident drivers. Our modern curriculum and expert instructors ensure you master the road safely.
              </p>
            </div>

            {/* Vertical Stepper Visual */}
            <div className="hidden lg:block space-y-12 ml-6 border-l-2 border-blue-400/30 pl-10 relative">
              {steps.map((step, index) => (
                <div key={step.id} className="relative group">
                  {/* Dot on line */}
                  <div className={`absolute -left-[61px] top-1 w-10 h-10 rounded-full border-4 border-[#1a3a8a] flex items-center justify-center transition-all duration-500 shadow-xl ${
                      currentStep === step.id ? 'bg-[#4ade80] scale-110' : 
                      currentStep > step.id ? 'bg-[#4ade80]' : 'bg-blue-900/50'
                    }`}>
                    {currentStep > step.id ? (
                      <svg className="w-5 h-5 text-blue-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                    ) : (
                      <span className="text-xs font-black">{step.id}</span>
                    )}
                  </div>

                  <div>
                    <h3 className={`font-black text-xl transition-all duration-300 ${currentStep === step.id ? 'text-white' : 'text-white/40 group-hover:text-white/60'}`}>
                      {step.name}
                    </h3>
                    <p className={`text-xs font-bold transition-all duration-300 ${currentStep === step.id ? 'text-blue-300' : 'text-transparent'}`}>
                      {step.id === 1 ? 'Tell us who you are' : 'How can we reach you?'}
                    </p>
                  </div>
                </div>
              ))}
              
              <div className="pt-8 mt-8 border-t border-blue-400/20">
                 <div className="flex items-center gap-4 text-white/40">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Secure Data Encryption</span>
                 </div>
              </div>
            </div>
          </div>

          {/* Bottom Branding for Mobile */}
          <div className="lg:hidden mt-8 text-blue-300 text-[10px] font-black uppercase tracking-widest">
            Master Driving School © 2026
          </div>
        </div>
      </div>
    </div>
  )
}

export default GuestEnrollment
