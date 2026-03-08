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

  // Promo Bundle state (category === 'Promo': TDC + PDC bundle)
  const [promoStep, setPromoStep] = useState(1)               // 1 = pick TDC, 2 = pick PDC
  const [promoTdcViewMonth, setPromoTdcViewMonth] = useState(new Date())
  const [promoTdcRawSlots, setPromoTdcRawSlots] = useState([])
  const [loadingPromoTdc, setLoadingPromoTdc] = useState(false)
  const [promoTdcSlot, setPromoTdcSlot] = useState(null)
  const [promoPdcCalMonth, setPromoPdcCalMonth] = useState(new Date())
  const [promoPdcDate, setPromoPdcDate] = useState(null)
  const [promoPdcRawSlots, setPromoPdcRawSlots] = useState([])
  const [loadingPromoPdc, setLoadingPromoPdc] = useState(false)
  const [promoPdcSlot, setPromoPdcSlot] = useState(null)
  const [promoPdcMotorType, setPromoPdcMotorType] = useState(null) // 'MT' | 'AT' — only for Motorcycle PDC bundles
  // Promo PDC Day 2 state (half-day sessions: Morning / Afternoon)
  const [promoPdcSelectingDay2, setPromoPdcSelectingDay2] = useState(false)
  const [promoPdcDay2CalMonth, setPromoPdcDay2CalMonth] = useState(new Date())
  const [promoPdcDate2, setPromoPdcDate2] = useState(null)
  const [promoPdcRawSlots2, setPromoPdcRawSlots2] = useState([])
  const [loadingPromoPdc2, setLoadingPromoPdc2] = useState(false)
  const [promoPdcSlot2, setPromoPdcSlot2] = useState(null)

  // Determine which slot type to show based on selected course
  const isTDCCourse = selectedCourse?.type === 'tdc' ||
    selectedCourse?.category === 'TDC' ||
    selectedCourse?.name?.toLowerCase().includes('tdc') ||
    selectedCourse?.shortName?.toLowerCase().includes('tdc')

  // Promo bundle: separate two-step flow (TDC slot + PDC slot)
  const isPromoCourse = selectedCourse?.category === 'Promo'
  const promoTdcType = isPromoCourse ? (selectedCourse.course_type?.split('+')[0] || 'F2F') : null
  const promoPdcType = isPromoCourse ? (selectedCourse.course_type?.split('+')[1] || 'Motorcycle') : null

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

  // Promo bundle: fetch all TDC slots (step 1)
  const fetchPromoTdcSlots = useCallback(async () => {
    setLoadingPromoTdc(true)
    try {
      const branchId = preSelectedBranch?.id || null
      const slots = await schedulesAPI.getSlotsByDate(null, branchId)
      setPromoTdcRawSlots(slots.filter(s => s.type?.toLowerCase() === 'tdc'))
    } catch (e) {
      console.error('Failed to fetch promo TDC slots:', e)
      setPromoTdcRawSlots([])
    } finally {
      setLoadingPromoTdc(false)
    }
  }, [preSelectedBranch])

  // Promo bundle: fetch PDC slots for a selected date (step 2)
  const fetchPromoPdcSlots = useCallback(async (date) => {
    if (!date) return
    setLoadingPromoPdc(true)
    try {
      const branchId = preSelectedBranch?.id || null
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      const slots = await schedulesAPI.getSlotsByDate(`${y}-${m}-${d}`, branchId)
      setPromoPdcRawSlots(slots.filter(s => s.type?.toLowerCase() === 'pdc'))
    } catch (e) {
      console.error('Failed to fetch promo PDC slots:', e)
      setPromoPdcRawSlots([])
    } finally {
      setLoadingPromoPdc(false)
    }
  }, [preSelectedBranch])

  // Promo bundle: fetch PDC slots for Day 2 date
  const fetchPromoPdcSlots2 = useCallback(async (date) => {
    if (!date) return
    setLoadingPromoPdc2(true)
    try {
      const branchId = preSelectedBranch?.id || null
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      const slots = await schedulesAPI.getSlotsByDate(`${y}-${m}-${d}`, branchId)
      setPromoPdcRawSlots2(slots.filter(s => s.type?.toLowerCase() === 'pdc'))
    } catch (e) {
      setPromoPdcRawSlots2([])
    } finally {
      setLoadingPromoPdc2(false)
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

  // Promo: fetch TDC slots once on mount
  useEffect(() => {
    if (isPromoCourse) fetchPromoTdcSlots()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPromoTdcSlots])

  // Promo: fetch PDC slots when step 2 date is picked
  useEffect(() => {
    if (isPromoCourse && promoPdcDate) fetchPromoPdcSlots(promoPdcDate)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promoPdcDate, fetchPromoPdcSlots])

  // Promo: fetch PDC Day 2 slots when day 2 date is picked
  useEffect(() => {
    if (isPromoCourse && promoPdcDate2) fetchPromoPdcSlots2(promoPdcDate2)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promoPdcDate2, fetchPromoPdcSlots2])

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

    // Promo bundle: step 1 = TDC slot, step 2 = PDC slot
    if (isPromoCourse) {
      if (promoStep === 1) {
        setPromoTdcSlot(slot)
      } else if (!promoPdcSelectingDay2) {
        // Picking PDC Day 1
        setPromoPdcSlot(slot)
        setPromoPdcSlot2(null)
        setPromoPdcDate2(null)
        setPromoPdcRawSlots2([])
        if (isHalfDay(slot.session)) {
          setPromoPdcSelectingDay2(true)
          showNotification(`PDC Day 1 selected (${slot.session}). Pick a different date below for Day 2.`, 'info')
        } else {
          setPromoPdcSelectingDay2(false)
        }
      } else {
        // Picking PDC Day 2 — must match session
        if (slot.session !== promoPdcSlot?.session) {
          showNotification(`Day 2 must be the same session: ${promoPdcSlot?.session}`, 'warning')
          return
        }
        setPromoPdcSlot2(slot)
        showNotification('Both PDC days selected! Ready to proceed.', 'success')
      }
      return
    }

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

    // Promo bundle: requires both TDC + PDC slots
    if (isPromoCourse) {
      if (!promoTdcSlot) {
        showNotification('Please select a TDC schedule (Step 1)', 'error')
        setPromoStep(1)
        return
      }
      if (!promoPdcSlot) {
        showNotification('Please select a PDC schedule (Step 2)', 'error')
        setPromoStep(2)
        return
      }
      if (isHalfDay(promoPdcSlot.session) && !promoPdcSlot2) {
        showNotification(`${promoPdcSlot.session} PDC sessions require 2 days. Please pick a Day 2 date and slot.`, 'warning')
        setPromoStep(2)
        return
      }
      const scheduleData = {
        date: new Date(promoTdcSlot.date + 'T00:00:00'),
        slot: promoTdcSlot.id,
        slotDetails: {
          id: promoTdcSlot.id,
          session: promoTdcSlot.session,
          type: promoTdcSlot.type,
          time: promoTdcSlot.time_range,
          available: promoTdcSlot.available_slots,
          total: promoTdcSlot.total_capacity,
          date: promoTdcSlot.date,
          end_date: promoTdcSlot.end_date,
        },
        pdcDate: promoPdcDate,
        pdcSlot: promoPdcSlot.id,
        pdcSlotDetails: {
          id: promoPdcSlot.id,
          session: promoPdcSlot.session,
          type: promoPdcSlot.type,
          time: promoPdcSlot.time_range,
          available: promoPdcSlot.available_slots,
          total: promoPdcSlot.total_capacity,
          date: promoPdcDate,
        },
        pdcDate2: promoPdcSlot2 ? promoPdcDate2 : null,
        pdcSlot2: promoPdcSlot2 ? promoPdcSlot2.id : null,
        pdcSlotDetails2: promoPdcSlot2 ? {
          id: promoPdcSlot2.id,
          session: promoPdcSlot2.session,
          type: promoPdcSlot2.type,
          time: promoPdcSlot2.time_range,
          available: promoPdcSlot2.available_slots,
          total: promoPdcSlot2.total_capacity,
          date: promoPdcDate2,
        } : null,
      }
      setScheduleSelection(scheduleData)
      if (selectedCourse) {
        const existingItem = cart.find(item => item.id === selectedCourse.id)
        if (existingItem) {
          setCart(cart.map(item => item.id === selectedCourse.id ? { ...item, quantity: 1 } : item))
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
      showNotification('Promo bundle schedule selected! Proceeding to payment...', 'success')
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
        date: selectedSlot.date,
        end_date: selectedSlot.end_date,
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
            ? { ...item, quantity: 1 }
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

    // Filter TDC slots based on the courseType selected (e.g. F2F or Online)
    if (courseType && s.course_type && s.course_type.toLowerCase() !== courseType.toLowerCase()) {
      return false
    }

    const d = new Date(s.date + 'T00:00:00')
    return isDateAvailable(d.getDate(), d)
  })
  const pdcSlots = dbSlots.filter(s => s.type?.toLowerCase() === 'pdc')

  // Helper: check if a slot's course_type is "universal" (applies to all PDC courses)
  const isUniversalCourseType = (ct) => {
    if (!ct) return true;
    const norm = ct.toLowerCase().trim();
    return norm === 'both' || norm === 'any' || norm === 'all';
  };

  // Extract meaningful category-specific tokens from a course name string.
  // Filters out generic words so only distinguishing identifiers remain,
  // e.g. "Practical Driving Course(PDC) - (A1 - TRICYCLE)" → ["a1", "tricycle"]
  const extractCategoryTokens = (str) => {
    const stopWords = new Set([
      'practical', 'driving', 'course', 'pdc', 'tdc', 'theoretical',
      'dc', 'a', 'an', 'the', 'and', 'or', 'for', 'of', 'in', 'to',
    ]);
    return str
      .toLowerCase()
      .replace(/[()[\]{}'"%]/g, ' ')
      .split(/[\s\-\/,;|&+]+/)
      .filter(t => t.length >= 2 && !stopWords.has(t));
  };

  // Helper: check if a slot's course_type matches the student's selected course.
  // Strategy:
  //   1. Universal slot (null / both / any / all) → always show
  //   2. Extract key tokens from slot.course_type and selectedCourse.name
  //   3. If slot has NO specific tokens (too generic) → show
  //   4. If ANY token overlaps between slot and selected course → show
  //   5. No overlap → hide (slot is for a different PDC sub-course)
  const pdcCourseTypeMatches = (slotCourseType) => {
    if (isUniversalCourseType(slotCourseType)) return true;

    const slotTokens = extractCategoryTokens(slotCourseType);
    // Slot has no distinguishing tokens → treat as universal
    if (slotTokens.length === 0) return true;

    const courseTokens = new Set(
      extractCategoryTokens((selectedCourse?.name || '') + ' ' + (selectedCourse?.shortName || ''))
    );

    // Show if at least one identifying token matches
    return slotTokens.some(t => courseTokens.has(t));
  };

  // Apply PDC session & transmission filter
  // Only filter by transmission if the selected courseType is explicitly a transmission variant (manual/automatic)
  const transmissionKeywords = ['manual', 'automatic', 'at', 'mt'];
  const isTransmissionType = !isTDCCourse && courseType &&
    transmissionKeywords.some(k => courseType.toLowerCase().includes(k));

  const filteredPdcSlots = pdcSlots.filter(slot => {
    // Filter by course_type (motorcycle vs car, etc.)
    if (!pdcCourseTypeMatches(slot.course_type)) return false;

    // Only apply transmission filter when student's courseType is a known transmission type
    if (isTransmissionType && slot.transmission &&
      slot.transmission.toLowerCase() !== 'both' &&
      slot.transmission.toLowerCase() !== 'any') {
      const transmissionNorm = slot.transmission.toLowerCase().trim();
      const selectedNorm = courseType.toLowerCase().trim();
      if (!selectedNorm.includes(transmissionNorm) && !transmissionNorm.includes(selectedNorm)) {
        return false;
      }
    }

    // Vehicle type filter

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

  // Promo TDC slot filtering (matches promoTdcType: 'F2F' or 'Online')
  const promoTdcFiltered = promoTdcRawSlots.filter(s => {
    if (!s.date) return false
    if (promoTdcType) {
      const sc = (s.course_type || '').toLowerCase()
      const exp = promoTdcType.toLowerCase()
      if (sc && sc !== exp && !sc.startsWith(exp)) return false
    }
    const d = new Date(s.date + 'T00:00:00')
    return isDateAvailable(d.getDate(), d)
  })

  const promoTdcByMonth = promoTdcFiltered.reduce((acc, s) => {
    const d = new Date(s.date + 'T00:00:00')
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})
  const promoTdcMonthKeys = Object.keys(promoTdcByMonth).sort()
  const promoTdcCurrentMonthKey = `${promoTdcViewMonth.getFullYear()}-${String(promoTdcViewMonth.getMonth() + 1).padStart(2, '0')}`
  const promoTdcSlotsForMonth = promoTdcByMonth[promoTdcCurrentMonthKey] || []
  const hasPromoTdcPrev = promoTdcMonthKeys.some(k => k < promoTdcCurrentMonthKey)
  const hasPromoTdcNext = promoTdcMonthKeys.some(k => k > promoTdcCurrentMonthKey)

  const goToPrevPromoTdcMonth = () => {
    const prev = promoTdcMonthKeys.filter(k => k < promoTdcCurrentMonthKey)
    if (prev.length > 0) {
      const [y, m] = prev[prev.length - 1].split('-').map(Number)
      setPromoTdcViewMonth(new Date(y, m - 1, 1))
    }
  }
  const goToNextPromoTdcMonth = () => {
    const next = promoTdcMonthKeys.filter(k => k > promoTdcCurrentMonthKey)
    if (next.length > 0) {
      const [y, m] = next[0].split('-').map(Number)
      setPromoTdcViewMonth(new Date(y, m - 1, 1))
    }
  }

  // Promo PDC slot matching — filters by motorcycle vs car type + transmission
  const promoPdcSlotMatches = (slot) => {
    const ct = (slot.course_type || '').toLowerCase().trim()
    const tr = (slot.transmission || '').toLowerCase().trim()
    if (!ct || ct === 'both' || ct === 'any' || ct === 'all') {
      if (promoPdcType === 'Motorcycle') return ct.includes('motor') || ct.includes('bike') || !ct
      return true
    }
    if (promoPdcType === 'Motorcycle') {
      const isMotor = ct.includes('motorcycle') || ct.includes('motor') || ct.includes('moto') || ct.includes('bike')
      if (!isMotor) return false
      if (promoPdcMotorType === 'MT') return !tr || tr === 'both' || tr === 'any' || tr.includes('manual') || tr === 'mt'
      if (promoPdcMotorType === 'AT') return !tr || tr === 'both' || tr === 'any' || tr.includes('auto') || tr === 'at'
      return true
    }
    // Car types — exclude motorcycle + special vehicle slots
    if (ct.includes('motorcycle') || ct.includes('motor') || ct.includes('moto') || ct.includes('bike') ||
      ct.includes('tricycle') || ct.includes('van') || ct.includes('l300') || ct.includes('b1-') ||
      ct.includes('b2-') || ct.includes('v1-')) return false
    if (promoPdcType === 'CarAT') return !tr || tr === 'both' || tr === 'any' || tr.includes('auto') || tr === 'at'
    if (promoPdcType === 'CarMT') return !tr || tr === 'both' || tr === 'any' || tr.includes('manual') || tr === 'mt'
    return true
  }
  const promoPdcFiltered = promoPdcRawSlots.filter(promoPdcSlotMatches)
  // Day 2 slots must match vehicle type AND must match the same session as Day 1
  const promoPdcFiltered2 = promoPdcRawSlots2
    .filter(promoPdcSlotMatches)
    .filter(s => s.session === promoPdcSlot?.session)

  const { daysInMonth: promoPdcDaysInMonth, startingDayOfWeek: promoPdcStartDay } = getDaysInMonth(promoPdcCalMonth)
  const { daysInMonth: promoPdcDay2DaysInMonth, startingDayOfWeek: promoPdcDay2StartDay } = getDaysInMonth(promoPdcDay2CalMonth)

  // Sync tdcViewMonth to the first available month when slots load
  useEffect(() => {
    if (isTDCCourse && tdcMonthKeys.length > 0 && !tdcSlotsByMonth[tdcCurrentMonthKey]) {
      const [y, m] = tdcMonthKeys[0].split('-').map(Number)
      setTdcViewMonth(new Date(y, m - 1, 1))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbSlots])

  // Sync promoTdcViewMonth to the first available month when promo TDC slots load
  useEffect(() => {
    if (isPromoCourse && promoTdcMonthKeys.length > 0 && !promoTdcByMonth[promoTdcCurrentMonthKey]) {
      const [y, m] = promoTdcMonthKeys[0].split('-').map(Number)
      setPromoTdcViewMonth(new Date(y, m - 1, 1))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promoTdcRawSlots])

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
            📅 Select Your Schedule
          </h1>
          <p className="text-base text-gray-600">
            <>Choose your preferred date and time slot for <span className="font-semibold text-[#2157da]">{selectedCourse?.name || 'Course'}</span></>
          </p>
        </div>

        {/* B1/B2 VAN/L300 Notice */}
        {selectedCourse && (selectedCourse.name.toLowerCase().includes('b1') || selectedCourse.name.toLowerCase().includes('b2') || selectedCourse.name.toLowerCase().includes('van') || selectedCourse.name.toLowerCase().includes('l300')) && (
          <div className="mb-6" data-aos="fade-up">
            <div className="bg-blue-50 border-l-4 border-[#2157da] p-5 rounded-r-2xl shadow-sm">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <span className="text-xl">ℹ️</span>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-bold text-[#2157da]">Vehicle Rental Requirement</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    For Practical Driving Course (PDC) - B1/B2, students are required to rent their own VAN or L300 for the course instead of using the school's vehicle because we only have one unit for all branches.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* A1 Tricycle Notice */}
        {selectedCourse && (selectedCourse.name.toLowerCase().includes('a1') || selectedCourse.name.toLowerCase().includes('tricycle')) && (
          <div className="mb-6" data-aos="fade-up">
            <div className="bg-blue-50 border-l-4 border-[#2157da] p-5 rounded-r-2xl shadow-sm">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <span className="text-xl">ℹ️</span>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-bold text-[#2157da]">Vehicle Rental Requirement</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    For Practical Driving Course (PDC) - A1 TRICYCLE, students are required to rent their own Tricycle for the course instead of using the school's vehicle because we only have one unit for all branches.
                  </p>
                </div>
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
                  <p className="text-sm font-bold text-gray-900 leading-tight">{selectedCourse.name}</p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Calendar (Hidden for TDC and Promo which has its own flow) */}
        {!isTDCCourse && !isPromoCourse && (

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
        {!isPromoCourse && (isTDCCourse || selectedDate) ? (
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
                  const bookedPct = ((slot.total_capacity - slot.available_slots) / slot.total_capacity) * 100

                  const sessionMeta = {
                    'Morning': { icon: '🌅', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', pill: 'bg-orange-100 text-orange-700' },
                    'Afternoon': { icon: '☀️', color: '#ca8a04', bg: '#fefce8', border: '#fde68a', pill: 'bg-yellow-100 text-yellow-700' },
                    'Whole Day': { icon: '🕐', color: '#2157da', bg: '#eff6ff', border: '#bfdbfe', pill: 'bg-blue-100 text-blue-700' },
                  }[slot.session] || { icon: '🕐', color: '#2157da', bg: '#eff6ff', border: '#bfdbfe', pill: 'bg-blue-100 text-blue-700' }

                  const courseLabel = (() => {
                    const base = slot.type?.toLowerCase() === 'tdc' ? 'TDC' : 'PDC';
                    const parts = [base];
                    if (slot.course_type && slot.course_type !== 'both' && slot.course_type !== 'any') {
                      parts.push(slot.course_type);
                    }
                    if (slot.transmission) {
                      parts.push(slot.transmission);
                    }
                    return parts.join(' · ');
                  })()

                  const statusColor = isFull ? '#ef4444' : bookedPct > 70 ? '#f59e0b' : '#22c55e';
                  const statusLabel = isFull ? 'FULL' : bookedPct > 70 ? 'FILLING UP' : 'OPEN';
                  const statusBg = isFull ? '#fef2f2' : bookedPct > 70 ? '#fffbeb' : '#f0fdf4';
                  const statusText = isFull ? '#dc2626' : bookedPct > 70 ? '#b45309' : '#15803d';

                  // Active state overrides
                  const cardBg = isDay1
                    ? 'linear-gradient(135deg, #1a4fba 0%, #1e3a8a 100%)'
                    : isDay2
                      ? '#f0fdf4'
                      : isFull
                        ? '#f8fafc'
                        : 'white';
                  const cardBorder = isDay1
                    ? 'transparent'
                    : isDay2
                      ? '#22c55e'
                      : isFull
                        ? '#e2e8f0'
                        : '#e2e8f0';

                  return (
                    <button
                      key={slot.id}
                      onClick={() => handleSlotClick(slot)}
                      disabled={isFull}
                      style={{ background: cardBg, borderColor: cardBorder }}
                      className={`group relative flex flex-col text-left rounded-2xl border-2 transition-all overflow-hidden ${isFull
                        ? 'opacity-60 cursor-not-allowed'
                        : isDay1
                          ? 'shadow-xl shadow-blue-500/30 scale-[1.02]'
                          : isDay2
                            ? 'shadow-lg shadow-green-500/20'
                            : 'hover:border-[#2157da] hover:shadow-lg hover:scale-[1.02] hover:-translate-y-0.5'
                        }`}
                    >
                      {/* Color accent bar */}
                      <div
                        className="h-1.5 w-full flex-shrink-0"
                        style={{ background: isDay1 ? 'rgba(255,255,255,0.3)' : isDay2 ? '#22c55e' : sessionMeta.color }}
                      />

                      <div className="p-5 flex flex-col flex-1">
                        {/* Top row: session pill + status badge */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xl leading-none">{sessionMeta.icon}</span>
                            <span
                              className="text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full"
                              style={isDay1
                                ? { background: 'rgba(255,255,255,0.18)', color: '#fff' }
                                : { background: sessionMeta.bg, color: sessionMeta.color, border: `1px solid ${sessionMeta.border}` }
                              }
                            >
                              {slot.session}
                            </span>
                          </div>
                          <span
                            className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full"
                            style={isFull
                              ? { background: '#fef2f2', color: '#dc2626' }
                              : isDay1
                                ? { background: 'rgba(255,255,255,0.18)', color: '#fff' }
                                : isDay2
                                  ? { background: '#dcfce7', color: '#15803d' }
                                  : { background: statusBg, color: statusText }
                            }
                          >
                            {isDay1 ? '✓ DAY 1' : isDay2 ? '✓ DAY 2' : statusLabel}
                          </span>
                        </div>

                        {/* Course type */}
                        <p
                          className="text-[11px] font-bold uppercase tracking-wider mb-2 leading-tight"
                          style={{ color: isDay1 ? 'rgba(255,255,255,0.65)' : '#94a3b8' }}
                        >
                          {courseLabel}
                        </p>

                        {/* Session name */}
                        <p
                          className="text-base font-black mb-1"
                          style={{ color: isDay1 ? '#fff' : isDay2 ? '#166534' : '#1e293b' }}
                        >
                          {slot.session} Session
                        </p>

                        {/* TDC date range */}
                        {isTDCCourse && slot.date && (
                          <p
                            className="text-xs font-semibold mb-3"
                            style={{ color: isDay1 ? 'rgba(255,255,255,0.7)' : '#64748b' }}
                          >
                            📅 {slot.end_date && slot.end_date !== slot.date
                              ? `${new Date(slot.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(slot.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                              : new Date(slot.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
                          </p>
                        )}

                        {/* Time */}
                        <div
                          className="flex items-center gap-1.5 text-sm font-bold mb-4"
                          style={{ color: isDay1 ? 'rgba(255,255,255,0.9)' : '#334155' }}
                        >
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" strokeWidth="2" />
                            <polyline points="12 6 12 12 16 14" strokeWidth="2" />
                          </svg>
                          {slot.time_range}
                        </div>

                        {/* Capacity bar */}
                        <div className="mt-auto">
                          <div
                            className="h-1.5 rounded-full overflow-hidden mb-2"
                            style={{ background: isDay1 ? 'rgba(255,255,255,0.2)' : '#e2e8f0' }}
                          >
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${bookedPct}%`,
                                background: isDay1 ? 'rgba(255,255,255,0.8)' : statusColor
                              }}
                            />
                          </div>
                          <p
                            className="text-xs font-semibold"
                            style={{ color: isDay1 ? 'rgba(255,255,255,0.65)' : '#64748b' }}
                          >
                            {slot.available_slots} / {slot.total_capacity} Available
                          </p>
                        </div>
                      </div>

                      {/* Selected day 1 checkmark */}
                      {isDay1 && (
                        <div className="absolute top-4 right-4">
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
        ) : null}

        {/* =================== PROMO BUNDLE 2-STEP FLOW =================== */}
        {isPromoCourse && (() => {
          const pdcTypeLabel = promoPdcType === 'Motorcycle'
            ? (promoPdcMotorType === 'MT' ? 'Motorcycle (Manual)' : promoPdcMotorType === 'AT' ? 'Motorcycle (Automatic)' : 'Motorcycle')
            : promoPdcType === 'CarAT' ? 'Car (Automatic)' : 'Car (Manual)'
          const totalSteps = 2
          return (
            <div data-aos="fade-up" data-aos-delay="100">

              {/* Step indicator */}
              <div className="flex items-center gap-3 mb-5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
                <span className="text-2xl">🏷️</span>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-amber-900 text-sm">Promo Bundle — 2-Step Schedule</p>
                  <p className="text-xs text-amber-700 mt-0.5">{selectedCourse?.name}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-1.5 ${promoStep === 1 ? 'opacity-100' : 'opacity-60'}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs ${promoTdcSlot ? 'bg-green-500 text-white' : promoStep === 1 ? 'bg-[#2157da] text-white' : 'bg-gray-200 text-gray-500'}`}>
                      {promoTdcSlot ? '✓' : '1'}
                    </div>
                    <span className="text-xs font-bold text-gray-700 hidden sm:block">TDC</span>
                  </div>
                  <div className="w-6 h-0.5 bg-gray-300 rounded" />
                  <div className={`flex items-center gap-1.5 ${promoStep === 2 ? 'opacity-100' : 'opacity-60'}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs ${promoPdcSlot ? 'bg-green-500 text-white' : promoStep === 2 ? 'bg-[#2157da] text-white' : 'bg-gray-200 text-gray-500'}`}>
                      {promoPdcSlot ? '✓' : '2'}
                    </div>
                    <span className="text-xs font-bold text-gray-700 hidden sm:block">PDC</span>
                  </div>
                </div>
              </div>

              {/* ---- STEP 1: TDC Slot Selection ---- */}
              {promoStep === 1 && (
                <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-5 sm:p-7 mb-4">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-black text-sm">1</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-black text-gray-900">Step 1: Select TDC Schedule</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {promoTdcType === 'F2F' ? 'Face-to-Face TDC' : 'Online TDC'} — {promoTdcViewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    {!loadingPromoTdc && (
                      <div className="px-3 py-1.5 bg-blue-50 rounded-lg">
                        <span className="text-xs font-bold text-[#2157da]">{promoTdcSlotsForMonth.length} Slots</span>
                      </div>
                    )}
                  </div>

                  {/* Month navigation */}
                  <div className="mb-5">
                    <div className="flex items-center justify-center gap-4 mb-3">
                      <button onClick={goToPrevPromoTdcMonth} disabled={!hasPromoTdcPrev} className={`w-9 h-9 flex items-center justify-center rounded-xl border-2 transition-all ${hasPromoTdcPrev ? 'border-gray-200 hover:border-[#2157da] hover:bg-blue-50' : 'border-gray-100 opacity-30 cursor-not-allowed'}`}>
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      <p className="text-base font-black text-gray-900">{promoTdcViewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                      <button onClick={goToNextPromoTdcMonth} disabled={!hasPromoTdcNext} className={`w-9 h-9 flex items-center justify-center rounded-xl border-2 transition-all ${hasPromoTdcNext ? 'border-gray-200 hover:border-[#2157da] hover:bg-blue-50' : 'border-gray-100 opacity-30 cursor-not-allowed'}`}>
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                      </button>
                    </div>
                    {promoTdcMonthKeys.length > 1 && (
                      <div className="flex items-center justify-center gap-1.5">
                        {promoTdcMonthKeys.map(key => (
                          <button key={key} onClick={() => { const [y, m] = key.split('-').map(Number); setPromoTdcViewMonth(new Date(y, m - 1, 1)) }}
                            className="transition-all rounded-full"
                            style={{ width: key === promoTdcCurrentMonthKey ? '24px' : '8px', height: '8px', background: key === promoTdcCurrentMonthKey ? '#2157da' : '#d1d5db' }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {loadingPromoTdc ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <div className="w-10 h-10 border-4 border-[#2157da] border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-gray-500 font-medium">Loading TDC slots...</p>
                    </div>
                  ) : promoTdcSlotsForMonth.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center"><span className="text-3xl">📭</span></div>
                      <p className="text-base font-black text-gray-700">No {promoTdcType} TDC slots this month</p>
                      <p className="text-sm text-gray-500">Try navigating to a different month above.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {promoTdcSlotsForMonth.map(slot => {
                        const isFull = slot.available_slots === 0
                        const isSel = promoTdcSlot?.id === slot.id
                        const colors = sessionColor(slot.session, isSel)
                        const slotDate = new Date(slot.date + 'T00:00:00')
                        const endDate = slot.end_date ? new Date(slot.end_date + 'T00:00:00') : null
                        return (
                          <button key={slot.id} onClick={() => handleSlotClick(slot)} disabled={isFull}
                            style={isSel ? { background: colors.bg } : {}}
                            className={`relative p-4 rounded-2xl text-left border-2 transition-all ${isSel ? 'border-transparent shadow-xl shadow-blue-500/30 scale-105' : isFull ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60' : 'bg-white border-gray-200 hover:border-[#2157da] hover:shadow-md hover:scale-105'}`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xl">{sessionIcon(slot.session)}</span>
                              <div className="flex-1">
                                <p className={`font-black text-sm ${isSel ? 'text-white' : 'text-gray-900'}`}>{slot.session} Session</p>
                                <p className={`text-xs font-bold ${isSel ? 'text-blue-100' : 'text-gray-500'}`}>🕐 {slot.time_range}</p>
                              </div>
                              {isSel && <span className="text-[10px] font-black bg-white/20 text-white px-2 py-0.5 rounded-lg">TDC ✓</span>}
                            </div>
                            <p className={`text-xs font-bold mb-1 ${isSel ? 'text-blue-100' : 'text-gray-500'}`}>
                              📅 {slotDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{endDate ? ` – ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                            </p>
                            <div className={`h-1.5 rounded-full overflow-hidden ${isSel ? 'bg-white/20' : 'bg-gray-200'} mb-2`}>
                              <div className={`h-full rounded-full ${isSel ? 'bg-white' : slot.available_slots === 0 ? 'bg-red-500' : 'bg-green-500'}`}
                                style={{ width: `${((slot.total_capacity - slot.available_slots) / slot.total_capacity) * 100}%` }} />
                            </div>
                            <p className={`text-xs font-bold ${isSel ? 'text-blue-100' : 'text-gray-500'}`}>{slot.available_slots}/{slot.total_capacity} available</p>
                            {isFull && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-black mt-1 inline-block">FULL</span>}
                            {isSel && <div className="absolute top-2 right-2 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow"><svg className="w-3 h-3 text-[#2157da]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ---- STEP 2: PDC Calendar + Slot Selection ---- */}
              {promoStep === 2 && (
                <>
                  {/* ---- Motor Type Selector (Motorcycle PDC bundles only) ---- */}
                  {promoPdcType === 'Motorcycle' && (
                    <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-5 sm:p-7 mb-4">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0 text-xl">🏍️</div>
                        <div>
                          <h3 className="text-base font-black text-gray-900">Select Motorcycle Transmission</h3>
                          <p className="text-xs text-gray-500 mt-0.5">Choose Manual or Automatic before picking a schedule date</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { key: 'MT', label: 'Manual', sub: 'Manual Transmission', icon: '⚙️' },
                          { key: 'AT', label: 'Automatic', sub: 'Automatic Transmission', icon: '🔄' },
                        ].map(({ key, label, sub, icon }) => {
                          const isSel = promoPdcMotorType === key
                          return (
                            <button key={key}
                              onClick={() => { setPromoPdcMotorType(key); setPromoPdcDate(null); setPromoPdcSlot(null) }}
                              className={`p-4 rounded-2xl border-2 text-left transition-all ${
                                isSel
                                  ? 'border-[#2157da] bg-blue-50 shadow-md shadow-blue-100'
                                  : 'border-gray-200 bg-gray-50 hover:border-[#2157da] hover:bg-blue-50 hover:scale-105'
                              }`}
                            >
                              <div className="text-2xl mb-2">{icon}</div>
                              <p className={`font-black text-sm ${isSel ? 'text-[#2157da]' : 'text-gray-900'}`}>{label}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
                              {isSel && (
                                <div className="mt-2 flex items-center gap-1 text-[#2157da]">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                  <span className="text-xs font-black">Selected</span>
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* PDC Calendar — only shown once motor type selected (for Motorcycle) */}
                  {(promoPdcType !== 'Motorcycle' || promoPdcMotorType) && (
                  <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-5 sm:p-7 mb-4">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-black text-sm">2</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-gray-900">Step 2: Select PDC Schedule</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{pdcTypeLabel} — pick a date from the calendar</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-6">
                      <button onClick={() => setPromoPdcCalMonth(new Date(promoPdcCalMonth.getFullYear(), promoPdcCalMonth.getMonth() - 1))} className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 hover:border-[#2157da] hover:bg-blue-50 transition-all">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      <h2 className="text-lg sm:text-xl font-black text-gray-900">{monthNames[promoPdcCalMonth.getMonth()]} {promoPdcCalMonth.getFullYear()}</h2>
                      <button onClick={() => setPromoPdcCalMonth(new Date(promoPdcCalMonth.getFullYear(), promoPdcCalMonth.getMonth() + 1))} className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 hover:border-[#2157da] hover:bg-blue-50 transition-all">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
                      {dayNames.map(d => <div key={d} className="text-center text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-wider py-2">{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                      {[...Array(promoPdcStartDay)].map((_, i) => <div key={`ep-${i}`} className="aspect-square" />)}
                      {[...Array(promoPdcDaysInMonth)].map((_, i) => {
                        const day = i + 1
                        const avail = isDateAvailable(day, promoPdcCalMonth)
                        const today = new Date(); today.setHours(0, 0, 0, 0)
                        const isToday = new Date(promoPdcCalMonth.getFullYear(), promoPdcCalMonth.getMonth(), day).getTime() === today.getTime()
                        const isSel = promoPdcDate?.getDate() === day && promoPdcDate?.getMonth() === promoPdcCalMonth.getMonth() && promoPdcDate?.getFullYear() === promoPdcCalMonth.getFullYear()
                        return (
                          <button key={day} onClick={() => { if (!avail) return; const d = new Date(promoPdcCalMonth.getFullYear(), promoPdcCalMonth.getMonth(), day); setPromoPdcDate(d); setPromoPdcSlot(null) }}
                            disabled={!avail}
                            className={`aspect-square flex items-center justify-center rounded-xl text-xs sm:text-sm font-bold transition-all relative ${isSel ? 'bg-gradient-to-br from-[#2157da] to-[#1a3a8a] text-white shadow-lg shadow-blue-500/30 scale-105 z-10' : isToday && avail ? 'bg-blue-100 text-[#2157da] border-2 border-[#2157da] font-black hover:bg-blue-200' : avail ? 'bg-gray-50 text-gray-900 hover:bg-blue-50 hover:text-[#2157da] hover:scale-105 border border-gray-200' : 'bg-gray-100/50 text-gray-300 cursor-not-allowed border border-gray-100'}`}
                          >
                            {day}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  )}

                  {/* PDC Day 1 Slots */}
                  {(promoPdcType !== 'Motorcycle' || promoPdcMotorType) && promoPdcDate && (
                    <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-5 sm:p-7 mb-4">
                      <div className="flex items-center justify-between mb-5">
                        <div>
                          <h3 className="text-lg font-black text-gray-900">PDC Time Slots — {pdcTypeLabel} <span className="text-sm font-bold text-gray-400">(Day 1)</span></h3>
                          <p className="text-xs text-gray-500 mt-1">{promoPdcDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
                        </div>
                        {!loadingPromoPdc && <div className="px-3 py-1.5 bg-blue-50 rounded-lg"><span className="text-xs font-bold text-[#2157da]">{promoPdcFiltered.length} Slots</span></div>}
                      </div>
                      {loadingPromoPdc ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                          <div className="w-10 h-10 border-4 border-[#2157da] border-t-transparent rounded-full animate-spin" />
                          <p className="text-sm text-gray-500">Loading PDC slots...</p>
                        </div>
                      ) : promoPdcFiltered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center"><span className="text-3xl">📭</span></div>
                          <p className="text-base font-black text-gray-700">No {pdcTypeLabel} PDC slots on this date</p>
                          <p className="text-sm text-gray-500">Pick a different date from the calendar above.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {promoPdcFiltered.map(slot => {
                            const isFull = slot.available_slots === 0
                            const isSel = promoPdcSlot?.id === slot.id
                            const colors = sessionColor(slot.session, isSel)
                            return (
                              <button key={slot.id} onClick={() => handleSlotClick(slot)} disabled={isFull}
                                style={isSel ? { background: colors.bg } : {}}
                                className={`relative p-4 rounded-2xl text-left border-2 transition-all ${isSel ? 'border-transparent shadow-xl shadow-blue-500/30 scale-105' : isFull ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60' : 'bg-white border-gray-200 hover:border-[#2157da] hover:shadow-md hover:scale-105'}`}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xl">{sessionIcon(slot.session)}</span>
                                  <div className="flex-1">
                                    <p className={`font-black text-sm ${isSel ? 'text-white' : 'text-gray-900'}`}>{slot.session} Session</p>
                                    <p className={`text-xs font-bold ${isSel ? 'text-blue-100' : 'text-gray-500'}`}>🕐 {slot.time_range}</p>
                                  </div>
                                  {isSel && <span className="text-[10px] font-black bg-white/20 text-white px-2 py-0.5 rounded-lg">Day 1 ✓</span>}
                                </div>
                                <div className={`h-1.5 rounded-full overflow-hidden ${isSel ? 'bg-white/20' : 'bg-gray-200'} mb-2`}>
                                  <div className={`h-full rounded-full ${isSel ? 'bg-white' : slot.available_slots === 0 ? 'bg-red-500' : 'bg-green-500'}`}
                                    style={{ width: `${((slot.total_capacity - slot.available_slots) / slot.total_capacity) * 100}%` }} />
                                </div>
                                <p className={`text-xs font-bold ${isSel ? 'text-blue-100' : 'text-gray-500'}`}>{slot.available_slots}/{slot.total_capacity} available</p>
                                {isFull && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-black mt-1 inline-block">FULL</span>}
                                {isSel && <div className="absolute top-2 right-2 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow"><svg className="w-3 h-3 text-[#2157da]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ---- PDC Day 1 selected banner (half-day) ---- */}
                  {promoPdcSlot && isHalfDay(promoPdcSlot.session) && !promoPdcSlot2 && (
                    <div className="bg-blue-50 border-2 border-[#2157da] rounded-2xl p-4 mb-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#2157da] rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-black text-sm">1</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-black text-[#2157da] text-sm">PDC Day 1 Selected — {promoPdcSlot.session} · {promoPdcSlot.time_range}</p>
                        <p className="text-xs text-blue-600 mt-0.5">{promoPdcSlot.session} sessions require 2 days. Pick a different date below for <strong>Day 2</strong>.</p>
                      </div>
                      <button onClick={() => { setPromoPdcSlot(null); setPromoPdcSlot2(null); setPromoPdcSelectingDay2(false); setPromoPdcDate2(null); setPromoPdcRawSlots2([]) }}
                        className="text-xs text-[#2157da] underline hover:no-underline font-bold flex-shrink-0">Change Day 1</button>
                    </div>
                  )}

                  {/* ---- PDC Day 2 complete banner ---- */}
                  {promoPdcSlot && promoPdcSlot2 && (
                    <div className="bg-green-50 border-2 border-green-500 rounded-2xl p-4 mb-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <div className="flex-1">
                        <p className="font-black text-green-800 text-sm">PDC Both Days Selected!</p>
                        <p className="text-xs text-green-700 mt-0.5">
                          Day 1: {promoPdcSlot.session} · {promoPdcDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} &nbsp;|&nbsp;
                          Day 2: {promoPdcSlot2.session} · {promoPdcDate2?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <button onClick={() => { setPromoPdcSlot(null); setPromoPdcSlot2(null); setPromoPdcSelectingDay2(false); setPromoPdcDate2(null); setPromoPdcRawSlots2([]) }}
                        className="text-xs text-green-700 underline hover:no-underline font-bold flex-shrink-0">Change</button>
                    </div>
                  )}

                  {/* ---- PDC Day 2 Calendar (half-day sessions only) ---- */}
                  {promoPdcSelectingDay2 && promoPdcSlot && !promoPdcSlot2 && (
                    <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-5 sm:p-7 mb-4">
                      <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-black text-sm">2</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-gray-900">Day 2: Pick Another Date</h3>
                          <p className="text-xs text-gray-500 mt-0.5">Must be a different date — same {promoPdcSlot.session} session</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mb-6">
                        <button onClick={() => setPromoPdcDay2CalMonth(new Date(promoPdcDay2CalMonth.getFullYear(), promoPdcDay2CalMonth.getMonth() - 1))} className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 hover:border-[#2157da] hover:bg-blue-50 transition-all">
                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <h2 className="text-lg sm:text-xl font-black text-gray-900">{monthNames[promoPdcDay2CalMonth.getMonth()]} {promoPdcDay2CalMonth.getFullYear()}</h2>
                        <button onClick={() => setPromoPdcDay2CalMonth(new Date(promoPdcDay2CalMonth.getFullYear(), promoPdcDay2CalMonth.getMonth() + 1))} className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 hover:border-[#2157da] hover:bg-blue-50 transition-all">
                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </div>
                      <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
                        {dayNames.map(d => <div key={d} className="text-center text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-wider py-2">{d}</div>)}
                      </div>
                      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                        {[...Array(promoPdcDay2StartDay)].map((_, i) => <div key={`ep2-${i}`} className="aspect-square" />)}
                        {[...Array(promoPdcDay2DaysInMonth)].map((_, i) => {
                          const day = i + 1
                          const avail = isDateAvailable(day, promoPdcDay2CalMonth)
                          const isDay1 = promoPdcDate?.getDate() === day && promoPdcDate?.getMonth() === promoPdcDay2CalMonth.getMonth() && promoPdcDate?.getFullYear() === promoPdcDay2CalMonth.getFullYear()
                          const isSel2 = promoPdcDate2?.getDate() === day && promoPdcDate2?.getMonth() === promoPdcDay2CalMonth.getMonth() && promoPdcDate2?.getFullYear() === promoPdcDay2CalMonth.getFullYear()
                          const today = new Date(); today.setHours(0,0,0,0)
                          const isToday = new Date(promoPdcDay2CalMonth.getFullYear(), promoPdcDay2CalMonth.getMonth(), day).getTime() === today.getTime()
                          return (
                            <button key={day}
                              onClick={() => { if (!avail || isDay1) return; const d = new Date(promoPdcDay2CalMonth.getFullYear(), promoPdcDay2CalMonth.getMonth(), day); setPromoPdcDate2(d); setPromoPdcSlot2(null) }}
                              disabled={!avail || isDay1}
                              title={isDay1 ? 'Already used for Day 1' : undefined}
                              className={`aspect-square flex items-center justify-center rounded-xl text-xs sm:text-sm font-bold transition-all relative ${
                                isDay1 ? 'bg-orange-100 text-orange-400 cursor-not-allowed border border-orange-200'
                                : isSel2 ? 'bg-gradient-to-br from-green-500 to-green-700 text-white shadow-lg scale-105 z-10'
                                : isToday && avail ? 'bg-blue-100 text-[#2157da] border-2 border-[#2157da] font-black hover:bg-blue-200'
                                : avail ? 'bg-gray-50 text-gray-900 hover:bg-blue-50 hover:text-[#2157da] hover:scale-105 border border-gray-200'
                                : 'bg-gray-100/50 text-gray-300 cursor-not-allowed border border-gray-100'
                              }`}
                            >{day}</button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* PDC Day 2 Slots */}
                  {promoPdcSelectingDay2 && !promoPdcSlot2 && promoPdcDate2 && (
                    <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-5 sm:p-7 mb-4">
                      <div className="flex items-center justify-between mb-5">
                        <div>
                          <h3 className="text-lg font-black text-gray-900">PDC Time Slots — {pdcTypeLabel} <span className="text-sm font-bold text-gray-400">(Day 2)</span></h3>
                          <p className="text-xs text-gray-500 mt-1">{promoPdcDate2.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · {promoPdcSlot?.session} session only</p>
                        </div>
                        {!loadingPromoPdc2 && <div className="px-3 py-1.5 bg-green-50 rounded-lg"><span className="text-xs font-bold text-green-700">{promoPdcFiltered2.length} Slots</span></div>}
                      </div>
                      {loadingPromoPdc2 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                          <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
                          <p className="text-sm text-gray-500">Loading Day 2 slots...</p>
                        </div>
                      ) : promoPdcFiltered2.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center"><span className="text-3xl">📭</span></div>
                          <p className="text-base font-black text-gray-700">No {promoPdcSlot?.session} slots on this date</p>
                          <p className="text-sm text-gray-500">Pick a different date for Day 2.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {promoPdcFiltered2.map(slot => {
                            const isFull = slot.available_slots === 0
                            const isSel = promoPdcSlot2?.id === slot.id
                            const colors = sessionColor(slot.session, isSel)
                            return (
                              <button key={slot.id} onClick={() => handleSlotClick(slot)} disabled={isFull}
                                style={isSel ? { background: colors.bg } : {}}
                                className={`relative p-4 rounded-2xl text-left border-2 transition-all ${isSel ? 'border-transparent shadow-xl shadow-green-500/30 scale-105' : isFull ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60' : 'bg-white border-gray-200 hover:border-green-500 hover:shadow-md hover:scale-105'}`}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xl">{sessionIcon(slot.session)}</span>
                                  <div className="flex-1">
                                    <p className={`font-black text-sm ${isSel ? 'text-white' : 'text-gray-900'}`}>{slot.session} Session</p>
                                    <p className={`text-xs font-bold ${isSel ? 'text-green-100' : 'text-gray-500'}`}>🕐 {slot.time_range}</p>
                                  </div>
                                  {isSel && <span className="text-[10px] font-black bg-white/20 text-white px-2 py-0.5 rounded-lg">Day 2 ✓</span>}
                                </div>
                                <div className={`h-1.5 rounded-full overflow-hidden ${isSel ? 'bg-white/20' : 'bg-gray-200'} mb-2`}>
                                  <div className={`h-full rounded-full ${isSel ? 'bg-white' : slot.available_slots === 0 ? 'bg-red-500' : 'bg-green-500'}`}
                                    style={{ width: `${((slot.total_capacity - slot.available_slots) / slot.total_capacity) * 100}%` }} />
                                </div>
                                <p className={`text-xs font-bold ${isSel ? 'text-green-100' : 'text-gray-500'}`}>{slot.available_slots}/{slot.total_capacity} available</p>
                                {isFull && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-black mt-1 inline-block">FULL</span>}
                                {isSel && <div className="absolute top-2 right-2 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow"><svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Promo Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6" data-aos="fade-up" data-aos-delay="300">
                <button onClick={() => onNavigate('courses')} className="flex-1 py-4 bg-white text-gray-700 border-2 border-gray-200 rounded-2xl font-bold hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                  Back to Courses
                </button>
                {promoStep === 1 ? (
                  <button
                    onClick={() => { if (!promoTdcSlot) { showNotification('Please select a TDC schedule first', 'error'); return } setPromoStep(2) }}
                    disabled={!promoTdcSlot}
                    className={`flex-1 py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-2 ${promoTdcSlot ? 'bg-gradient-to-r from-[#2157da] to-[#1a3a8a] text-white hover:shadow-2xl hover:shadow-blue-500/40 hover:scale-105 active:scale-100' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                  >
                    {promoTdcSlot ? <><span>Next: Select PDC Schedule</span><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg></> : 'Select TDC Slot to Continue'}
                  </button>
                ) : (
                  <>
                    <button onClick={() => { setPromoStep(1); setPromoPdcSlot(null); setPromoPdcSlot2(null); setPromoPdcMotorType(null); setPromoPdcDate(null); setPromoPdcDate2(null); setPromoPdcSelectingDay2(false); setPromoPdcRawSlots2([]) }} className="py-4 px-6 bg-white text-[#2157da] border-2 border-[#2157da] rounded-2xl font-bold hover:bg-blue-50 transition-all flex items-center justify-center gap-2 flex-shrink-0">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                      Change TDC
                    </button>
                    <button
                      onClick={handleProceedToPayment}
                      disabled={!promoPdcSlot || (isHalfDay(promoPdcSlot?.session) && !promoPdcSlot2)}
                      className={`flex-1 py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-2 ${(promoPdcSlot && (!isHalfDay(promoPdcSlot?.session) || promoPdcSlot2)) ? 'bg-gradient-to-r from-[#2157da] to-[#1a3a8a] text-white hover:shadow-2xl hover:shadow-blue-500/40 hover:scale-105 active:scale-100' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                    >
                      {(promoPdcSlot && (!isHalfDay(promoPdcSlot?.session) || promoPdcSlot2))
                        ? <><span>Proceed to Payment</span><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg></>
                        : isHalfDay(promoPdcSlot?.session) ? 'Select PDC Day 2 to Continue' : 'Select PDC Slot to Continue'
                      }
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })()}

        {/* Day-1 selected banner (half-day PDC) */}
        {!isPromoCourse && !isTDCCourse && selectedSlot && isHalfDay(selectedSlot.session) && !selectedSlot2 && (
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
        {!isPromoCourse && !isTDCCourse && selectedSlot && selectedSlot2 && (
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
        {!isPromoCourse && selectingDay2 && !selectedSlot2 && (
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
              const day2Slots = dbSlots2.filter(s =>
                s.type?.toLowerCase() === 'pdc' &&
                s.session === selectedSlot?.session &&
                pdcCourseTypeMatches(s.course_type)
              )
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
        {!isPromoCourse && (
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
        )}

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
