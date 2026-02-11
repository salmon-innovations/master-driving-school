import { useState, useEffect } from 'react'
import { useNotification } from '../context/NotificationContext'

function Schedule({ onNavigate, selectedCourse, preSelectedBranch, setScheduleSelection, cart, setCart }) {
  const { showNotification } = useNotification()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [availableSlots, setAvailableSlots] = useState([])
  const [courseType, setCourseType] = useState(selectedCourse?.selectedType || 'online') // Initialize with passed type or default to online

  // Redirect if no course is selected
  useEffect(() => {
    if (!selectedCourse) {
      showNotification('Please select a course first', 'error')
      onNavigate('courses')
    } else if (selectedCourse.selectedType) {
      // Set the course type from the selected course if available
      setCourseType(selectedCourse.selectedType)
    }
  }, [selectedCourse, onNavigate, showNotification])

  // Mock available slots for demonstration - In production, fetch from backend
  const mockAvailableSlots = {
    'morning': { time: '8:00 AM - 12:00 PM', available: 15, total: 20 },
    'afternoon': { time: '1:00 PM - 5:00 PM', available: 8, total: 20 },
    'evening': { time: '6:00 PM - 9:00 PM', available: 12, total: 15 }
  }

  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    return { daysInMonth, startingDayOfWeek }
  }

  const isDateAvailable = (date) => {
    // Only allow future dates and not Sundays
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const checkDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), date)
    return checkDate >= today && checkDate.getDay() !== 0
  }

  const handleDateClick = (day) => {
    if (isDateAvailable(day)) {
      const selected = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
      setSelectedDate(selected)
      setSelectedSlot(null)
      // In production, fetch available slots from backend based on selected date
      setAvailableSlots(mockAvailableSlots)
    }
  }

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
    setSelectedDate(null)
    setSelectedSlot(null)
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
    setSelectedDate(null)
    setSelectedSlot(null)
  }

  const handleProceedToPayment = () => {
    // For TDC (id: 1), only date is required. For other courses, both date and slot required.
    if (!selectedDate) {
      showNotification('Please select a date', 'error')
      return
    }

    // For TDC, use fixed time schedule
    const scheduleData = selectedCourse?.id === 1 ? {
      date: selectedDate,
      slot: 'full-day',
      slotDetails: { time: '8:00 AM - 5:00 PM', available: 20, total: 20 }
    } : {
      date: selectedDate,
      slot: selectedSlot,
      slotDetails: availableSlots[selectedSlot]
    }

    // Store schedule selection
    setScheduleSelection(scheduleData)

    // Add course to cart with selected type
    if (selectedCourse) {
      const existingItem = cart.find(item => item.id === selectedCourse.id && item.type === courseType)
      if (existingItem) {
        setCart(cart.map(item =>
          item.id === selectedCourse.id && item.type === courseType
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ))
      } else {
        setCart([...cart, { ...selectedCourse, quantity: 1, type: courseType }])
      }
    }

    showNotification('Schedule selected! Proceeding to payment...', 'success')
    onNavigate('payment')
  }

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentMonth)
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 py-8 sm:py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8" data-aos="fade-down">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-2">
            📅 Select Your Schedule
          </h1>
          <p className="text-base text-gray-600">
            Choose your preferred date and time for <span className="font-semibold text-[#2157da]">{selectedCourse?.name || 'TDC Course'}</span>
          </p>
        </div>

        {/* Info Cards Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6" data-aos="fade-up">
          {/* Branch Card */}
          {preSelectedBranch && (
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 hover:shadow-lg transition-all">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-2xl">📍</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Branch Location</p>
                  <p className="text-sm font-bold text-gray-900 truncate">{preSelectedBranch.name}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Course Card */}
          {selectedCourse && (
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 hover:shadow-lg transition-all">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-2xl">📚</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Selected Course</p>
                  <p className="text-sm font-bold text-gray-900 truncate">{selectedCourse.shortName}</p>
                </div>
              </div>
            </div>
          )}

          {/* Course Type Card */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 hover:shadow-lg transition-all">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
              Course Type {selectedCourse?.selectedType && <span className="text-green-600">✓ Pre-selected</span>}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCourseType('online')}
                className={`flex-1 px-4 py-2.5 text-xs font-bold rounded-xl transition-all ${
                  courseType === 'online'
                    ? 'bg-[#2157da] text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                🌐 ONLINE
              </button>
              <button
                onClick={() => setCourseType('face-to-face')}
                className={`flex-1 px-4 py-2.5 text-xs font-bold rounded-xl transition-all ${
                  courseType === 'face-to-face'
                    ? 'bg-[#2157da] text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                👥 FACE TO FACE
              </button>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-5 sm:p-7 mb-6" data-aos="fade-up" data-aos-delay="100">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={handlePrevMonth}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 hover:border-[#2157da] hover:bg-blue-50 transition-all"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-lg sm:text-xl font-black text-gray-900">
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h2>
            <button
              onClick={handleNextMonth}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 hover:border-[#2157da] hover:bg-blue-50 transition-all"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day Names */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
            {dayNames.map((day) => (
              <div key={day} className="text-center text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-wider py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {[...Array(startingDayOfWeek)].map((_, index) => (
              <div key={`empty-${index}`} className="aspect-square"></div>
            ))}
            {[...Array(daysInMonth)].map((_, index) => {
              const day = index + 1
              const isAvailable = isDateAvailable(day)
              const isToday = new Date().getDate() === day && 
                             new Date().getMonth() === currentMonth.getMonth() &&
                             new Date().getFullYear() === currentMonth.getFullYear()
              const isSelected = selectedDate?.getDate() === day && 
                                selectedDate?.getMonth() === currentMonth.getMonth() &&
                                selectedDate?.getFullYear() === currentMonth.getFullYear()

              return (
                <button
                  key={day}
                  onClick={() => handleDateClick(day)}
                  disabled={!isAvailable}
                  className={`aspect-square flex items-center justify-center rounded-xl text-xs sm:text-sm font-bold transition-all relative ${
                    isSelected
                      ? 'bg-gradient-to-br from-[#2157da] to-[#1a3a8a] text-white shadow-lg shadow-blue-500/30 scale-105 z-10'
                      : isToday && isAvailable
                      ? 'bg-blue-100 text-[#2157da] border-2 border-[#2157da] font-black hover:bg-blue-200'
                      : isAvailable
                      ? 'bg-gray-50 text-gray-900 hover:bg-blue-50 hover:text-[#2157da] hover:scale-105 border border-gray-200'
                      : 'bg-gray-100/50 text-gray-300 cursor-not-allowed border border-gray-100'
                  }`}
                >
                  {day}
                  {isToday && !isSelected && isAvailable && (
                    <span className="absolute bottom-1 w-1 h-1 bg-[#2157da] rounded-full"></span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 sm:gap-4 mt-6 pt-6 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-gray-50 border border-gray-200 rounded-lg"></div>
              <span className="text-xs font-medium text-gray-600">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-gradient-to-br from-[#2157da] to-[#1a3a8a] rounded-lg shadow"></div>
              <span className="text-xs font-medium text-gray-600">Selected</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-blue-100 border-2 border-[#2157da] rounded-lg"></div>
              <span className="text-xs font-medium text-gray-600">Today</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-gray-100/50 border border-gray-100 rounded-lg"></div>
              <span className="text-xs font-medium text-gray-600">Unavailable</span>
            </div>
          </div>
        </div>

        {/* Time Slots or Fixed Schedule */}
        {selectedDate ? (
          selectedCourse?.id === 1 ? (
            // TDC Fixed Schedule Display
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-5 sm:p-7 mb-6" data-aos="fade-up" data-aos-delay="200">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-black text-gray-900">
                    Fixed Schedule
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div className="px-3 py-1.5 bg-green-100 rounded-lg">
                  <span className="text-xs font-bold text-green-700">✓ Fixed Time</span>
                </div>
              </div>
              
              {/* Fixed Schedule Card */}
              <div className="bg-gradient-to-br from-[#2157da] to-[#1a3a8a] rounded-2xl p-6 text-white">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" strokeWidth="2"></circle>
                      <polyline points="12 6 12 12 16 14" strokeWidth="2"></polyline>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-black uppercase tracking-wider text-blue-100 mb-1">TDC Full Day Session</p>
                    <p className="text-2xl font-black">8:00 AM - 5:00 PM</p>
                  </div>
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#2157da]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                
                <div className="bg-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-semibold">All TDC courses follow this standard 8-hour schedule.</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Other courses - show time slot selection
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-5 sm:p-7 mb-6" data-aos="fade-up" data-aos-delay="200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-black text-gray-900">
                  Available Time Slots
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div className="px-3 py-1.5 bg-blue-50 rounded-lg">
                <span className="text-xs font-bold text-[#2157da]">{Object.keys(availableSlots).length} Slots</span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              {Object.entries(availableSlots).map(([key, slot]) => {
                const bookedPercentage = ((slot.total - slot.available) / slot.total) * 100
                const isFull = slot.available === 0
                const isSelected = selectedSlot === key
                
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedSlot(key)}
                    disabled={isFull}
                    className={`group relative p-5 rounded-2xl transition-all text-left ${
                      isSelected
                        ? 'bg-gradient-to-br from-[#2157da] to-[#1a3a8a] shadow-xl shadow-blue-500/30 scale-105 border-2 border-transparent'
                        : isFull
                        ? 'bg-gray-50 border-2 border-gray-200 cursor-not-allowed opacity-60'
                        : 'bg-white border-2 border-gray-200 hover:border-[#2157da] hover:shadow-lg hover:scale-105'
                    }`}
                  >
                    {/* Time Period Icon */}
                    <div className={`flex items-center gap-3 mb-4 ${
                      isSelected ? 'text-white' : 'text-gray-900'
                    }`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isSelected 
                          ? 'bg-white/20' 
                          : isFull
                          ? 'bg-gray-200'
                          : 'bg-blue-50 group-hover:bg-blue-100'
                      }`}>
                        <svg className={`w-5 h-5 ${
                          isSelected ? 'text-white' : isFull ? 'text-gray-400' : 'text-[#2157da]'
                        }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" strokeWidth="2"></circle>
                          <polyline points="12 6 12 12 16 14" strokeWidth="2"></polyline>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-black uppercase tracking-wider mb-0.5 ${
                          isSelected ? 'text-blue-100' : 'text-gray-400'
                        }`}>
                          {key === 'morning' ? 'Morning' : key === 'afternoon' ? 'Afternoon' : 'Evening'}
                        </p>
                        <p className={`font-bold text-sm truncate ${
                          isSelected ? 'text-white' : 'text-gray-900'
                        }`}>
                          {slot.time}
                        </p>
                      </div>
                    </div>

                    {/* Availability Bar */}
                    <div className="mb-3">
                      <div className={`h-2 rounded-full overflow-hidden ${
                        isSelected ? 'bg-white/20' : 'bg-gray-200'
                      }`}>
                        <div 
                          className={`h-full rounded-full transition-all ${
                            isSelected
                              ? 'bg-white'
                              : isFull
                              ? 'bg-red-500'
                              : bookedPercentage > 70
                              ? 'bg-orange-500'
                              : 'bg-green-500'
                          }`}
                          style={{ width: `${bookedPercentage}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${
                        isSelected ? 'text-white' : 'text-gray-600'
                      }`}>
                        {slot.available}/{slot.total} Available
                      </span>
                      {isFull ? (
                        <span className="text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-black">
                          FULL
                        </span>
                      ) : isSelected ? (
                        <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-black">
                          ✓ SELECTED
                        </span>
                      ) : (
                        <span className={`text-xs px-2.5 py-1 rounded-full font-black ${
                          bookedPercentage > 70
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {bookedPercentage > 70 ? 'FILLING UP' : 'OPEN'}
                        </span>
                      )}
                    </div>

                    {/* Selected Checkmark */}
                    {isSelected && (
                      <div className="absolute top-3 right-3">
                        <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-[#2157da]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
          )
        ) : (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl border-2 border-dashed border-blue-300 p-8 sm:p-12 mb-6 text-center" data-aos="fade-up" data-aos-delay="200">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-black text-gray-900 mb-2">Select a Date First</h3>
            <p className="text-sm text-gray-600 max-w-md mx-auto">
              Choose an available date from the calendar above to {selectedCourse?.id === 1 ? 'schedule your TDC course' : 'view time slots for your course'}.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4" data-aos="fade-up" data-aos-delay="300">
          <button
            onClick={() => onNavigate('courses')}
            className="flex-1 py-4 bg-white text-gray-700 border-2 border-gray-200 rounded-2xl font-bold hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Courses
          </button>
          <button
            onClick={handleProceedToPayment}
            disabled={selectedCourse?.id === 1 ? !selectedDate : (!selectedDate || !selectedSlot)}
            className={`flex-1 py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-2 ${
              (selectedCourse?.id === 1 ? selectedDate : (selectedDate && selectedSlot))
                ? 'bg-gradient-to-r from-[#2157da] to-[#1a3a8a] text-white hover:shadow-2xl hover:shadow-blue-500/40 hover:scale-105 active:scale-100'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {(selectedCourse?.id === 1 ? selectedDate : (selectedDate && selectedSlot)) ? (
              <>
                Proceed to Payment
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </>
            ) : (
              selectedCourse?.id === 1 ? 'Select Date to Continue' : 'Select Date & Time to Continue'
            )}
          </button>
        </div>

        {/* Important Notes */}
        <div className="mt-6 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-5 sm:p-6" data-aos="fade-up" data-aos-delay="400">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-400 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-xl">⚠️</span>
            </div>
            <div>
              <h4 className="font-black text-gray-900 text-base">Important Booking Information</h4>
              <p className="text-xs text-gray-600 mt-0.5">Please read carefully before proceeding</p>
            </div>
          </div>
          <ul className="space-y-3 text-sm text-gray-700">
            {selectedCourse?.id === 1 && (
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 flex-shrink-0"></div>
                <span className="leading-relaxed"><strong className="font-bold text-gray-900">Fixed Schedule:</strong> All TDC courses follow a standard 8:00 AM - 5:00 PM schedule. No time slot selection needed.</span>
              </li>
            )}
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 flex-shrink-0"></div>
              <span className="leading-relaxed"><strong className="font-bold text-gray-900">Payment Required:</strong> Your selected date {selectedCourse?.id !== 1 && 'and time slot'} will only be secured after payment confirmation.</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 flex-shrink-0"></div>
              <span className="leading-relaxed"><strong className="font-bold text-gray-900">Limited Slots:</strong> Slots are available on a first-come, first-served basis. Book early to guarantee your preferred schedule.</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 flex-shrink-0"></div>
              <span className="leading-relaxed"><strong className="font-bold text-gray-900">Schedule Restrictions:</strong> Sundays are not available for {selectedCourse?.id === 1 ? 'TDC' : ''} courses. Plan your schedule accordingly.</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 flex-shrink-0"></div>
              <span className="leading-relaxed"><strong className="font-bold text-gray-900">Rescheduling Policy:</strong> Changes are subject to slot availability and may incur additional fees.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default Schedule
