import { useState, useEffect, useCallback } from 'react'
import { useNotification } from '../context/NotificationContext'
import { schedulesAPI } from '../services/api'

function Schedule({ onNavigate, selectedCourse, preSelectedBranch, setScheduleSelection, cart, setCart, isLoggedIn }) {
  const { showNotification } = useNotification()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)       // Day 1 date
  const [selectedSlot, setSelectedSlot] = useState(null)       // Day 1 slot object
  const [dbSlots, setDbSlots] = useState([])                   // Slots for Day 1 date
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [courseType, setCourseType] = useState(selectedCourse?.selectedType || 'online')
  const [pdcSessionFilter, setPdcSessionFilter] = useState('All')
  const [tdcViewMonth, setTdcViewMonth] = useState(new Date())

  // Day 2 state — only used for PDC Morning/Afternoon half-day sessions
  const [selectingDay2, setSelectingDay2] = useState(false)    // true when waiting for Day 2
  const [selectedDate2, setSelectedDate2] = useState(null)     // Day 2 date
  const [selectedSlot2, setSelectedSlot2] = useState(null)     // Day 2 slot object
  const [dbSlots2, setDbSlots2] = useState([])                 // Slots for Day 2 date
  const [loadingSlots2, setLoadingSlots2] = useState(false)

  // Determine which slot type to show based on selected course
  const isTDCCourse = selectedCourse?.type === 'tdc' ||
    selectedCourse?.category === 'TDC' ||
    selectedCourse?.name?.toLowerCase().includes('tdc') ||
    selectedCourse?.shortName?.toLowerCase().includes('tdc')

  // Motorcycle PDC: schedule is assigned by admin only — students cannot self-select
  const isMotorcyclePDC = !isTDCCourse && (
    selectedCourse?.name?.toLowerCase().includes('motorcycle') ||
    selectedCourse?.shortName?.toLowerCase().includes('motorcycle') ||
    selectedCourse?.category?.toLowerCase().includes('motorcycle')
  )

  // Redirect if no course is selected
  useEffect(() => {
    if (!selectedCourse) {
      showNotification('Please select a course first', 'error')
      onNavigate('courses')
    } else if (selectedCourse.selectedType) {
      setCourseType(selectedCourse.selectedType)
    }
  }, [selectedCourse, onNavigate, showNotification])

  // Prevent rendering while redirect is pending (no course selected)
  if (!selectedCourse) return null

  // Fetch slots for Day 1
  const fetchSlotsForDate = useCallback(async (date) => {
    try {
      setLoadingSlots(true)
      setDbSlots([])
      setSelectedSlot(null)

      const branchId = preSelectedBranch?.id || null
      let slots = []

      if (isTDCCourse) {
        slots = await schedulesAPI.getSlotsByDate(null, branchId)
      } else {
        if (!date) return
        const y = date.getFullYear()
        const m = String(date.getMonth() + 1).padStart(2, '0')
        const d = String(date.getDate()).padStart(2, '0')
        slots = await schedulesAPI.getSlotsByDate(`${y}-${m}-${d}`, branchId)
      }

      setDbSlots(slots)
    } catch (err) {
      console.error('Failed to fetch slots:', err)
      showNotification('Failed to load available slots. Please try again.', 'error')
      setDbSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }, [preSelectedBranch, showNotification, isTDCCourse])

  // Fetch slots for Day 2 (PDC half-day second selection)
  const fetchSlotsForDate2 = useCallback(async (date) => {
    try {
      setLoadingSlots2(true)
      setDbSlots2([])
      setSelectedSlot2(null)

      if (!date) return
      const branchId = preSelectedBranch?.id || null
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      const slots = await schedulesAPI.getSlotsByDate(`${y}-${m}-${d}`, branchId)
      setDbSlots2(slots)
    } catch (err) {
      console.error('Failed to fetch Day 2 slots:', err)
      setDbSlots2([])
    } finally {
      setLoadingSlots2(false)
    }
  }, [preSelectedBranch])

  useEffect(() => {
    fetchSlotsForDate(selectedDate)
  }, [selectedDate, fetchSlotsForDate])

  useEffect(() => {
    if (selectingDay2 && selectedDate2) {
      fetchSlotsForDate2(selectedDate2)
    }
  }, [selectedDate2, fetchSlotsForDate2, selectingDay2])

  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    return { daysInMonth, startingDayOfWeek }
  }

  // Returns true if a given calendar day is selectable (2+ days ahead for PDC, 1+ day ahead for TDC, not Sunday)
  const isDateAvailable = (day, monthRef = currentMonth) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const checkDate = new Date(monthRef.getFullYear(), monthRef.getMonth(), day)
    const minAllowedDate = new Date(today)

    // TDC uses 1 day advance, PDC uses 2 days advance
    minAllowedDate.setDate(today.getDate() + (isTDCCourse ? 1 : 2))

    return checkDate >= minAllowedDate && checkDate.getDay() !== 0 // no Sundays
  }

  // Single handleDateClick handles BOTH Day 1 and Day 2 using the same calendar
  const handleDateClick = (day) => {
    if (!isDateAvailable(day)) return
    const selected = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)

    if (selectingDay2) {
      // Day 2 mode: block same date as Day 1
      if (selectedDate && selected.toDateString() === selectedDate.toDateString()) {
        showNotification('Day 2 must be a different date than Day 1.', 'warning')
        return
      }
      setSelectedDate2(selected)
      setSelectedSlot2(null)
    } else {
      // Day 1 mode: normal date pick, reset everything
      setSelectedDate(selected)
      setSelectingDay2(false)
      setSelectedDate2(null)
      setSelectedSlot(null)
      setSelectedSlot2(null)
      setDbSlots2([])
    }
  }

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  // Whether the selected session requires a 2-day pick (Morning or Afternoon PDC)
  const isHalfDay = (session) =>
    session === 'Morning' || session === 'Afternoon'

  // Called when user clicks a slot card
  const handleSlotClick = (slot) => {
    if (slot.available_slots === 0) return
    const halfDay = !isTDCCourse && isHalfDay(slot.session)

    if (!halfDay) {
      // Whole Day / TDC: single selection
      setSelectedSlot(slot)
      setSelectingDay2(false)
      setSelectedSlot2(null)
      setSelectedDate2(null)
      setDbSlots2([])
      return
    }

    if (!selectingDay2) {
      // First pick — set Day 1, then switch to Day 2 picking mode
      setSelectedSlot(slot)
      setSelectingDay2(true)
      setSelectedSlot2(null)
      setSelectedDate2(null)
      setDbSlots2([])
      showNotification(`Day 1 selected (${slot.session}). Pick another date from the calendar above for Day 2.`, 'info')
    } else {
      // Second pick — validate session matches
      if (slot.session !== selectedSlot?.session) {
        showNotification(`Day 2 must be the same session type: ${selectedSlot?.session}`, 'warning')
        return
      }
      setSelectedSlot2(slot)
      showNotification('Both days selected! Ready to proceed.', 'success')
    }
  }

  const handleProceedToPayment = () => {
    // Motorcycle PDC: skip slot validation — admin assigns schedule
    if (isMotorcyclePDC) {
      const scheduleData = {
        date: new Date(),
        slot: null,
        slotDetails: null,
        isMotorcyclePDC: true
      }
      setScheduleSelection(scheduleData)
      if (selectedCourse) {
        const existingItem = cart.find(item => item.id === selectedCourse.id && item.type === courseType)
        if (existingItem) {
          setCart(cart.map(item =>
            item.id === selectedCourse.id && item.type === courseType
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ))
        } else {
          setCart([...cart, {
            id: selectedCourse.id,
            name: selectedCourse.name,
            shortName: selectedCourse.shortName,
            duration: selectedCourse.duration,
            price: selectedCourse.price,
            category: selectedCourse.category,
            typeOptions: selectedCourse.typeOptions,
            hasTypeOption: selectedCourse.hasTypeOption,
            quantity: 1,
            type: courseType,
          }])
        }
      }
      showNotification('Proceeding to payment. Your schedule will be assigned by our admin.', 'info')
      onNavigate('payment')
      return
    }

    if (!isTDCCourse && !selectedDate) {
      showNotification('Please select a date', 'error')
      return
    }
    if (!selectedSlot) {
      showNotification('Please select a time slot', 'error')
      return
    }

    // For half-day PDC sessions — require Day 2 as well
    if (!isTDCCourse && isHalfDay(selectedSlot.session)) {
      if (!selectedDate2 || !selectedSlot2) {
        showNotification('Morning and Afternoon sessions require 2 days. Please select Day 2 schedule.', 'warning')
        return
      }
    }

    // Determine Day 1 date
    let finalDate = selectedDate
    if (isTDCCourse && !finalDate && selectedSlot.date) {
      finalDate = new Date(selectedSlot.date + 'T00:00:00')
    }
    if (!finalDate) {
      showNotification('Invalid schedule date', 'error')
      return
    }

    const scheduleData = {
      date: finalDate,
      slot: selectedSlot.id,
      slotDetails: {
        id: selectedSlot.id,
        session: selectedSlot.session,
        type: selectedSlot.type,
        time: selectedSlot.time_range,
        available: selectedSlot.available_slots,
        total: selectedSlot.total_capacity,
      },
      // Day 2 fields (only set for half-day PDC)
      ...(selectedSlot2 ? {
        date2: selectedDate2,
        slot2: selectedSlot2.id,
        slotDetails2: {
          id: selectedSlot2.id,
          session: selectedSlot2.session,
          type: selectedSlot2.type,
          time: selectedSlot2.time_range,
          available: selectedSlot2.available_slots,
          total: selectedSlot2.total_capacity,
        }
      } : {})
    }

    setScheduleSelection(scheduleData)

    if (selectedCourse) {
      const existingItem = cart.find(item => item.id === selectedCourse.id && item.type === courseType)
      if (existingItem) {
        setCart(cart.map(item =>
          item.id === selectedCourse.id && item.type === courseType
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ))
      } else {
        setCart([...cart, {
          id: selectedCourse.id,
          name: selectedCourse.name,
          shortName: selectedCourse.shortName,
          duration: selectedCourse.duration,
          price: selectedCourse.price,
          category: selectedCourse.category,
          typeOptions: selectedCourse.typeOptions,
          hasTypeOption: selectedCourse.hasTypeOption,
          quantity: 1,
          type: courseType,
        }])
      }
    }

    showNotification('Schedule selected! Proceeding to payment...', 'success')
    onNavigate('payment')
  }

  const tdcSlots = dbSlots.filter(s => {
    if (s.type?.toLowerCase() !== 'tdc' || !s.date) return false
    const d = new Date(s.date + 'T00:00:00')
    return isDateAvailable(d.getDate(), d)
  })
  const pdcSlots = dbSlots.filter(s => s.type?.toLowerCase() === 'pdc')

  // Apply PDC session filter — matches DB values: 'Morning', 'Afternoon', 'Whole Day'
  const filteredPdcSlots = pdcSlots.filter(slot => {
    if (pdcSessionFilter === 'All') return true
    if (pdcSessionFilter === 'Whole Day') return slot.session === 'Whole Day'
    if (pdcSessionFilter === 'Morning') return slot.session === 'Morning'
    if (pdcSessionFilter === 'Afternoon') return slot.session === 'Afternoon'
    return true
  })

  // For TDC: group by month for pagination
  const tdcSlotsByMonth = tdcSlots.reduce((acc, slot) => {
    if (!slot.date) return acc
    const d = new Date(slot.date + 'T00:00:00')
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!acc[key]) acc[key] = []
    acc[key].push(slot)
    return acc
  }, {})
  const tdcMonthKeys = Object.keys(tdcSlotsByMonth).sort()
  const tdcCurrentMonthKey = `${tdcViewMonth.getFullYear()}-${String(tdcViewMonth.getMonth() + 1).padStart(2, '0')}`
  const tdcSlotsForMonth = tdcSlotsByMonth[tdcCurrentMonthKey] || []
  const hasPrevTdcMonth = tdcMonthKeys.some(k => k < tdcCurrentMonthKey)
  const hasNextTdcMonth = tdcMonthKeys.some(k => k > tdcCurrentMonthKey)

  const goToPrevTdcMonth = () => {
    const prev = tdcMonthKeys.filter(k => k < tdcCurrentMonthKey)
    if (prev.length > 0) {
      const [y, m] = prev[prev.length - 1].split('-').map(Number)
      setTdcViewMonth(new Date(y, m - 1, 1))
    }
  }
  const goToNextTdcMonth = () => {
    const next = tdcMonthKeys.filter(k => k > tdcCurrentMonthKey)
    if (next.length > 0) {
      const [y, m] = next[0].split('-').map(Number)
      setTdcViewMonth(new Date(y, m - 1, 1))
    }
  }

  // Sync tdcViewMonth to the first available month when slots load
  useEffect(() => {
    if (isTDCCourse && tdcMonthKeys.length > 0 && !tdcSlotsByMonth[tdcCurrentMonthKey]) {
      const [y, m] = tdcMonthKeys[0].split('-').map(Number)
      setTdcViewMonth(new Date(y, m - 1, 1))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbSlots])

  // Show TDC slots for TDC courses (month-filtered), filtered PDC slots for PDC courses
  const relevantSlots = isTDCCourse ? tdcSlotsForMonth : filteredPdcSlots

  const sessionIcon = (session) => {
    if (session === 'Morning') return '🌅'
    if (session === 'Afternoon') return '☀️'
    return '🕐'
  }

  const sessionColor = (session, selected) => {
    if (selected) return { bg: 'linear-gradient(135deg, #2157da 0%, #1a3a8a 100%)', text: '#fff', badge: 'rgba(255,255,255,0.2)', badgeText: '#fff' }
    if (session === 'Morning') return { bg: '#fff7ed', text: '#9a3412', badge: '#fed7aa', badgeText: '#9a3412' }
    if (session === 'Afternoon') return { bg: '#fefce8', text: '#713f12', badge: '#fde68a', badgeText: '#713f12' }
    return { bg: '#eff6ff', text: '#1e3a5f', badge: '#bfdbfe', badgeText: '#1e40af' }
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
            📅 {isMotorcyclePDC ? 'Schedule Information' : 'Select Your Schedule'}
          </h1>
          <p className="text-base text-gray-600">
            {isMotorcyclePDC
              ? <>For <span className="font-semibold text-[#2157da]">{selectedCourse?.name || 'Motorcycle PDC'}</span> — schedule is assigned by our admin team after payment.</>
              : <>Choose your preferred date and time slot for <span className="font-semibold text-[#2157da]">{selectedCourse?.name || 'Course'}</span></>
            }
          </p>
        </div>

        {/* Motorcycle PDC: Admin-only notice */}
        {isMotorcyclePDC && (
          <div className="mb-6" data-aos="fade-up">
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-amber-400 rounded-3xl p-6 sm:p-8 text-center shadow-lg">
              <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg">
                <span className="text-4xl">🏍️</span>
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-3">Motorcycle PDC — Admin-Assigned Schedule</h2>
              <p className="text-sm text-gray-600 max-w-lg mx-auto mb-5 leading-relaxed">
                For <strong className="text-gray-900">{selectedCourse?.name}</strong>, your practical driving schedule is personally assigned
                by our admin team based on instructor and vehicle availability.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto mb-6">
                <div className="bg-white rounded-2xl p-4 border border-amber-200 shadow-sm">
                  <div className="text-2xl mb-2">💳</div>
                  <p className="text-xs font-black text-gray-700 uppercase tracking-wider mb-1">Step 1</p>
                  <p className="text-sm font-semibold text-gray-600">Complete payment below</p>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-amber-200 shadow-sm">
                  <div className="text-2xl mb-2">📞</div>
                  <p className="text-xs font-black text-gray-700 uppercase tracking-wider mb-1">Step 2</p>
                  <p className="text-sm font-semibold text-gray-600">Admin contacts you within 24 hrs</p>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-amber-200 shadow-sm">
                  <div className="text-2xl mb-2">📅</div>
                  <p className="text-xs font-black text-gray-700 uppercase tracking-wider mb-1">Step 3</p>
                  <p className="text-sm font-semibold text-gray-600">Schedule confirmed &amp; emailed to you</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => onNavigate('courses')}
                  className="px-6 py-3 bg-white text-gray-700 border-2 border-gray-200 rounded-2xl font-bold hover:bg-gray-50 transition-all"
                >
                  ← Back to Courses
                </button>
                <button
                  onClick={handleProceedToPayment}
                  className="px-8 py-3 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-2xl font-black hover:shadow-xl hover:shadow-amber-500/30 hover:scale-105 transition-all"
                >
                  Proceed to Payment →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Info Cards Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6" data-aos="fade-up">
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

          {selectedCourse && (
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 hover:shadow-lg transition-all">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-2xl">📚</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Selected Course</p>
                  <p className="text-sm font-bold text-gray-900 truncate">{selectedCourse.shortName || selectedCourse.name}</p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Calendar (Hidden for TDC and Motorcycle PDC) */}
        {!isTDCCourse && !isMotorcyclePDC && (
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-5 sm:p-7 mb-6" data-aos="fade-up" data-aos-delay="100">
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

            <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
              {dayNames.map((day) => (
                <div key={day} className="text-center text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-wider py-2">
                  {day}
                </div>
              ))}
            </div>

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

                // When picking Day 2, Day 1 date gets an orange lock; Day 2 date gets the blue highlight
                const isDay1Marker = selectingDay2 &&
                  selectedDate?.getDate() === day &&
                  selectedDate?.getMonth() === currentMonth.getMonth() &&
                  selectedDate?.getFullYear() === currentMonth.getFullYear()

                const isDay2Selected = selectingDay2 &&
                  selectedDate2?.getDate() === day &&
                  selectedDate2?.getMonth() === currentMonth.getMonth() &&
                  selectedDate2?.getFullYear() === currentMonth.getFullYear()

                const isDay1Selected = !selectingDay2 &&
                  selectedDate?.getDate() === day &&
                  selectedDate?.getMonth() === currentMonth.getMonth() &&
                  selectedDate?.getFullYear() === currentMonth.getFullYear()

                const isSelected = isDay1Selected || isDay2Selected

                return (
                  <button
                    key={day}
                    onClick={() => handleDateClick(day)}
                    disabled={!isAvailable || isDay1Marker}
                    title={isDay1Marker ? 'Day 1 already selected' : undefined}
                    className={`aspect-square flex items-center justify-center rounded-xl text-xs sm:text-sm font-bold transition-all relative ${isDay1Marker
                      ? 'bg-orange-100 text-orange-500 cursor-not-allowed border border-orange-200'
                      : isDay2Selected
                        ? 'bg-gradient-to-br from-green-500 to-green-700 text-white shadow-lg shadow-green-500/30 scale-105 z-10'
                        : isDay1Selected
                          ? 'bg-gradient-to-br from-[#2157da] to-[#1a3a8a] text-white shadow-lg shadow-blue-500/30 scale-105 z-10'
                          : isToday && isAvailable
                            ? 'bg-blue-100 text-[#2157da] border-2 border-[#2157da] font-black hover:bg-blue-200'
                            : isAvailable
                              ? 'bg-gray-50 text-gray-900 hover:bg-blue-50 hover:text-[#2157da] hover:scale-105 border border-gray-200'
                              : 'bg-gray-100/50 text-gray-300 cursor-not-allowed border border-gray-100'
                      }`}
                  >
                    {day}
                    {isDay1Marker && (
                      <span className="absolute bottom-0.5 text-[8px] font-black text-orange-500">D1</span>
                    )}
                    {isDay2Selected && (
                      <span className="absolute bottom-0.5 text-[8px] font-black text-white">D2</span>
                    )}
                    {isToday && !isSelected && !isDay1Marker && isAvailable && (
                      <span className="absolute bottom-1 w-1 h-1 bg-[#2157da] rounded-full"></span>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-wrap gap-3 sm:gap-4 mt-6 pt-6 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-gray-50 border border-gray-200 rounded-lg"></div>
                <span className="text-xs font-medium text-gray-600">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-gradient-to-br from-[#2157da] to-[#1a3a8a] rounded-lg shadow"></div>
                <span className="text-xs font-medium text-gray-600">{selectingDay2 ? 'Day 2' : 'Selected'}</span>
              </div>
              {selectingDay2 && (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-orange-100 border border-orange-200 rounded-lg"></div>
                  <span className="text-xs font-medium text-gray-600">Day 1 (locked)</span>
                </div>
              )}
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
        )}

        {/* Slot Selection Panel */}
        {!isMotorcyclePDC && (isTDCCourse || selectedDate) ? (
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-5 sm:p-7 mb-6" data-aos="fade-up" data-aos-delay="200">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-black text-gray-900">
                  {isTDCCourse
                    ? 'Available TDC Schedules'
                    : selectingDay2
                      ? `Day 1 Slots — ${selectedDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                      : 'Available Time Slots'}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {isTDCCourse
                    ? tdcViewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                    : selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              {!loadingSlots && (
                <div className="px-3 py-1.5 bg-blue-50 rounded-lg">
                  <span className="text-xs font-bold text-[#2157da]">
                    {relevantSlots.length} {relevantSlots.length === 1 ? 'Slot' : 'Slots'}
                  </span>
                </div>
              )}
            </div>

            {/* TDC Month Pagination */}
            {isTDCCourse && (
              <div className="mb-6">
                <div className="flex items-center justify-center gap-4 mb-3">
                  <button
                    onClick={goToPrevTdcMonth}
                    disabled={!hasPrevTdcMonth}
                    className={`w-9 h-9 flex items-center justify-center rounded-xl border-2 transition-all ${hasPrevTdcMonth
                      ? 'border-gray-200 hover:border-[#2157da] hover:bg-blue-50'
                      : 'border-gray-100 opacity-30 cursor-not-allowed'
                      }`}
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="text-center">
                    <p className="text-base font-black text-gray-900">
                      {tdcViewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </p>
                    {tdcMonthKeys.length > 1 && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {tdcMonthKeys.length} months with schedules
                      </p>
                    )}
                  </div>
                  <button
                    onClick={goToNextTdcMonth}
                    disabled={!hasNextTdcMonth}
                    className={`w-9 h-9 flex items-center justify-center rounded-xl border-2 transition-all ${hasNextTdcMonth
                      ? 'border-gray-200 hover:border-[#2157da] hover:bg-blue-50'
                      : 'border-gray-100 opacity-30 cursor-not-allowed'
                      }`}
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                {/* Month dot indicators */}
                {tdcMonthKeys.length > 1 && (
                  <div className="flex items-center justify-center gap-1.5">
                    {tdcMonthKeys.map(key => (
                      <button
                        key={key}
                        onClick={() => {
                          const [y, m] = key.split('-').map(Number)
                          setTdcViewMonth(new Date(y, m - 1, 1))
                        }}
                        title={new Date(key + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        className="transition-all rounded-full"
                        style={{
                          width: key === tdcCurrentMonthKey ? '24px' : '8px',
                          height: '8px',
                          background: key === tdcCurrentMonthKey ? '#2157da' : '#d1d5db',
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {!isTDCCourse && (
              <div className="flex gap-2 mb-6 flex-wrap">
                {[
                  { value: 'All', label: 'All' },
                  { value: 'Whole Day', label: '🕐 Whole Day' },
                  { value: 'Morning', label: '🌅 Morning' },
                  { value: 'Afternoon', label: '☀️ Afternoon' },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setPdcSessionFilter(value)}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${pdcSessionFilter === value
                      ? 'bg-[#2157da] text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {loadingSlots ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="w-10 h-10 border-4 border-[#2157da] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-gray-500 font-medium">Loading available slots...</p>
              </div>
            ) : relevantSlots.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
                  <span className="text-3xl">📭</span>
                </div>
                <p className="text-base font-black text-gray-700">No slots available</p>
                <p className="text-sm text-gray-500 max-w-xs">
                  There are no schedule slots set up for this date yet. Please choose another date or check back later.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {relevantSlots.map((slot) => {
                  const isFull = slot.available_slots === 0
                  const isDay1 = selectedSlot?.id === slot.id
                  const isDay2 = selectedSlot2?.id === slot.id
                  const isSelected = isDay1 || isDay2
                  const bookedPct = ((slot.total_capacity - slot.available_slots) / slot.total_capacity) * 100
                  const colors = sessionColor(slot.session, isDay1)

                  return (
                    <button
                      key={slot.id}
                      onClick={() => handleSlotClick(slot)}
                      disabled={isFull}
                      style={isDay1 ? { background: colors.bg } : {}}
                      className={`group relative p-5 rounded-2xl transition-all text-left border-2 ${isDay1
                        ? 'shadow-xl shadow-blue-500/30 scale-105 border-transparent'
                        : isDay2
                          ? 'border-green-500 bg-green-50 shadow-md'
                          : isFull
                            ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60'
                            : 'bg-white border-gray-200 hover:border-[#2157da] hover:shadow-lg hover:scale-105'
                        }`}
                    >
                      {/* Header row: session icon + name + type badge + day label */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{sessionIcon(slot.session)}</span>
                          <div>
                            <p className={`text-xs font-black uppercase tracking-wider ${isDay1 ? 'text-blue-100' : isDay2 ? 'text-green-600' : 'text-gray-400'}`}>
                              {slot.type.toUpperCase()}
                            </p>
                            <p className={`font-black text-sm ${isDay1 ? 'text-white' : isDay2 ? 'text-green-800' : 'text-gray-900'}`}>
                              {slot.session} Session
                            </p>
                          </div>
                        </div>
                        {isDay1 ? (
                          <span className="text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-white/20 text-white">DAY 1</span>
                        ) : isDay2 ? (
                          <span className="text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-green-200 text-green-800">DAY 1 ✓</span>
                        ) : (
                          <span
                            className="text-[10px] font-black uppercase px-2 py-1 rounded-lg"
                            style={{ background: colors.badge, color: colors.badgeText }}
                          >
                            {slot.type.toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Date badge — shown for TDC only since PDC date comes from the calendar */}
                      {isTDCCourse && slot.date && (
                        <div className={`text-xs font-bold px-3 py-1.5 rounded-lg mb-3 flex items-center gap-1.5 ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
                          }`}>
                          <span>📅</span>
                          <span>
                            {slot.end_date && slot.end_date !== slot.date
                              ? `${new Date(slot.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(slot.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                              : new Date(slot.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
                            }
                          </span>
                        </div>
                      )}

                      {/* Time */}
                      <p className={`text-sm font-bold mb-4 ${isDay1 ? 'text-blue-100' : isDay2 ? 'text-green-700' : 'text-gray-600'}`}>
                        🕐 {slot.time_range}
                      </p>

                      {/* Progress bar */}
                      <div className="mb-3">
                        <div className={`h-2 rounded-full overflow-hidden ${isDay1 ? 'bg-white/20' : 'bg-gray-200'}`}>
                          <div
                            className={`h-full rounded-full transition-all ${isDay1 ? 'bg-white'
                              : isFull ? 'bg-red-500'
                                : bookedPct > 70 ? 'bg-orange-500'
                                  : 'bg-green-500'
                              }`}
                            style={{ width: `${bookedPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Footer row: availability + status badge */}
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${isDay1 ? 'text-white' : isDay2 ? 'text-green-700' : 'text-gray-600'}`}>
                          {slot.available_slots}/{slot.total_capacity} Available
                        </span>
                        {isFull ? (
                          <span className="text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-black">FULL</span>
                        ) : isDay1 ? (
                          <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-black">✓ DAY 1</span>
                        ) : isDay2 ? (
                          <span className="text-xs bg-green-200 text-green-800 px-2.5 py-1 rounded-full font-black">✓ DAY 1</span>
                        ) : (
                          <span className={`text-xs px-2.5 py-1 rounded-full font-black ${bookedPct > 70 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                            }`}>
                            {bookedPct > 70 ? 'FILLING UP' : 'OPEN'}
                          </span>
                        )}
                      </div>

                      {/* Checkmark for selected day 1 */}
                      {isDay1 && (
                        <div className="absolute top-3 right-3">
                          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center shadow">
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
            )}
          </div>
        ) : (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl border-2 border-dashed border-blue-300 p-8 sm:p-12 mb-6 text-center" data-aos="fade-up" data-aos-delay="200">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-black text-gray-900 mb-2">Select a Date First</h3>
            <p className="text-sm text-gray-600 max-w-md mx-auto">
              Choose an available date from the calendar above to view time slots for your course.
            </p>
          </div>
        )}

        {/* Day-1 selected banner (half-day PDC) */}
        {!isTDCCourse && selectedSlot && isHalfDay(selectedSlot.session) && !selectedSlot2 && (
          <div className="bg-blue-50 border-2 border-[#2157da] rounded-2xl p-4 mb-4 flex items-center gap-3" data-aos="fade-up">
            <div className="w-10 h-10 bg-[#2157da] rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-white font-black text-sm">1</span>
            </div>
            <div className="flex-1">
              <p className="font-black text-[#2157da] text-sm">Day 1 Selected — {selectedSlot.session} · {selectedSlot.time_range}</p>
              <p className="text-xs text-blue-600 mt-0.5">
                {selectedSlot.session} sessions require 2 days. Pick a new date and time slot below for <strong>Day 2</strong>.
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedSlot(null)
                setSelectedSlot2(null)
                setSelectingDay2(false)
                setSelectedDate2(null)
                setDbSlots2([])
              }}
              className="text-xs text-[#2157da] underline hover:no-underline font-bold flex-shrink-0"
            >
              Change Day 1
            </button>
          </div>
        )}


        {/* Day-2 complete banner */}
        {!isTDCCourse && selectedSlot && selectedSlot2 && (
          <div className="bg-green-50 border-2 border-green-500 rounded-2xl p-4 mb-4 flex items-center gap-3" data-aos="fade-up">
            <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-black text-green-800 text-sm">Both Days Selected — Schedule Complete!</p>
              <p className="text-xs text-green-600 mt-0.5">
                Day 1: {selectedDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {selectedSlot.time_range} &nbsp;|&nbsp;
                Day 2: {selectedDate2?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {selectedSlot2.time_range}
              </p>
            </div>
            <button
              onClick={() => { setSelectedSlot2(null); setSelectedDate2(null); setSelectingDay2(true); setDbSlots2([]); }}
              className="text-xs text-green-700 underline hover:no-underline flex-shrink-0"
            >
              Change Day 2
            </button>
          </div>
        )}

        {/* Day-2 slot panel — appears below main panel after Day 1 is picked, no second calendar */}
        {selectingDay2 && !selectedSlot2 && (
          <div className="bg-white rounded-3xl shadow-lg border-2 border-dashed border-[#2157da] p-5 sm:p-7 mb-6" data-aos="fade-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-[#2157da] rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-white font-black text-sm">2</span>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-black text-gray-900">Select Day 2 Time Slot</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedDate2
                    ? `${selectedDate2.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · must match ${selectedSlot?.session}`
                    : `Pick a date from the calendar above for Day 2 · must match ${selectedSlot?.session} session`}
                </p>
              </div>
            </div>

            {!selectedDate2 ? (
              <div className="flex items-center justify-center py-8 gap-3 text-gray-400">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm font-semibold">Pick a different date above ↗</p>
              </div>
            ) : loadingSlots2 ? (
              <div className="flex items-center justify-center py-8 gap-3">
                <div className="w-8 h-8 border-4 border-[#2157da] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500">Loading Day 2 slots...</p>
              </div>
            ) : (() => {
              const day2Slots = dbSlots2.filter(s => s.type?.toLowerCase() === 'pdc' && s.session === selectedSlot?.session)
              return day2Slots.length === 0 ? (
                <div className="text-center py-8">
                  <span className="text-3xl">📭</span>
                  <p className="text-sm font-bold text-gray-700 mt-2">No {selectedSlot?.session} slots on this date</p>
                  <p className="text-xs text-gray-500 mt-1">Pick a different date from the calendar above.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {day2Slots.map(slot => {
                    const isFull2 = slot.available_slots === 0
                    const isSel2 = selectedSlot2?.id === slot.id
                    const colors2 = sessionColor(slot.session, isSel2)
                    return (
                      <button
                        key={slot.id}
                        onClick={() => handleSlotClick(slot)}
                        disabled={isFull2}
                        style={isSel2 ? { background: colors2.bg } : {}}
                        className={`relative p-4 rounded-2xl text-left border-2 transition-all ${isSel2 ? 'border-transparent shadow-xl shadow-blue-500/30 scale-105'
                          : isFull2 ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60'
                            : 'bg-white border-gray-200 hover:border-[#2157da] hover:shadow-md hover:scale-105'
                          }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">{sessionIcon(slot.session)}</span>
                          <div className="flex-1">
                            <p className={`font-black text-sm ${isSel2 ? 'text-white' : 'text-gray-900'}`}>{slot.session} Session</p>
                            <p className={`text-xs font-bold ${isSel2 ? 'text-blue-100' : 'text-gray-500'}`}>🕐 {slot.time_range}</p>
                          </div>
                          {isSel2 && <span className="text-[10px] font-black bg-white/20 text-white px-2 py-0.5 rounded-lg">DAY 2 ✓</span>}
                        </div>
                        <div className={`h-1.5 rounded-full overflow-hidden ${isSel2 ? 'bg-white/20' : 'bg-gray-200'} mb-2`}>
                          <div
                            className={`h-full rounded-full ${isSel2 ? 'bg-white' : slot.available_slots === 0 ? 'bg-red-500' : 'bg-green-500'}`}
                            style={{ width: `${((slot.total_capacity - slot.available_slots) / slot.total_capacity) * 100}%` }}
                          />
                        </div>
                        <p className={`text-xs font-bold ${isSel2 ? 'text-blue-100' : 'text-gray-500'}`}>
                          {slot.available_slots}/{slot.total_capacity} available
                        </p>
                        {isFull2 && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-black mt-1 inline-block">FULL</span>}
                        {isSel2 && (
                          <div className="absolute top-2 right-2 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow">
                            <svg className="w-3 h-3 text-[#2157da]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })()}
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
            disabled={(() => {
              if (!selectedSlot) return true
              if (!isTDCCourse && !selectedDate) return true
              if (!isTDCCourse && isHalfDay(selectedSlot.session) && (!selectedDate2 || !selectedSlot2)) return true
              return false
            })()}
            className={`flex-1 py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-2 ${(() => {
              if (!selectedSlot) return false
              if (!isTDCCourse && !selectedDate) return false
              if (!isTDCCourse && isHalfDay(selectedSlot.session) && (!selectedDate2 || !selectedSlot2)) return false
              return true
            })()
              ? 'bg-gradient-to-r from-[#2157da] to-[#1a3a8a] text-white hover:shadow-2xl hover:shadow-blue-500/40 hover:scale-105 active:scale-100'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
          >
            {(() => {
              if (!selectedSlot) return 'Select Date & Slot to Continue'
              if (!isTDCCourse && isHalfDay(selectedSlot.session) && !selectedSlot2) return 'Select Day 2 to Continue'
              return (
                <>
                  Proceed to Payment
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )
            })()}
          </button>
        </div>

        {/* Important Notes */}
        <div className="mt-6 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-5 sm:p-6" data-aos="fade-up" data-aos-delay="400">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-400 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-xl">⚠️</span>
            </div>
            <div>
              <h4 className="font-black text-gray-900 text-base">Important Enrollment Information</h4>
              <p className="text-xs text-gray-600 mt-0.5">Please read carefully before proceeding</p>
            </div>
          </div>
          <ul className="space-y-3 text-sm text-gray-700">
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 flex-shrink-0"></div>
              <span className="leading-relaxed"><strong className="font-bold text-gray-900">Payment Required:</strong> Your selected date and time slot will only be secured after payment confirmation.</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 flex-shrink-0"></div>
              <span className="leading-relaxed"><strong className="font-bold text-gray-900">Limited Slots:</strong> Slots are available on a first-come, first-served basis. Enroll early to guarantee your preferred schedule.</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 flex-shrink-0"></div>
              <span className="leading-relaxed"><strong className="font-bold text-gray-900">Schedule Restrictions:</strong> Sundays are not available. Plan your schedule accordingly.</span>
            </li>
            {isTDCCourse ? (
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 flex-shrink-0"></div>
                <span className="leading-relaxed"><strong className="font-bold text-gray-900">TDC Course Note:</strong> TDC is a 15-hour course that spans 2 consecutive school days. Your start date determines both days automatically.</span>
              </li>
            ) : (
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 flex-shrink-0"></div>
                <span className="leading-relaxed"><strong className="font-bold text-gray-900">PDC Course Note:</strong> Practical Driving Courses require scheduling at least 2 days in advance. Half-day sessions (Morning/Afternoon) require you to pick two different days.</span>
              </li>
            )}
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
