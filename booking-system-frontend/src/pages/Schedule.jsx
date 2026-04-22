import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNotification } from '../context/NotificationContext'
import { schedulesAPI } from '../services/api'

const getPromoPdcTypeFromItem = (item) => {
  const typeStr = String(item.type || '').toUpperCase();
  const nameStr = String(item.name || '').toUpperCase();
  if (typeStr.includes('AT') && typeStr.includes('CAR')) return 'Car AT';
  if (typeStr.includes('MT') && typeStr.includes('CAR')) return 'Car MT';
  if (nameStr.includes('AUTOMATIC') && nameStr.includes('CAR')) return 'Car AT';
  if (nameStr.includes('MANUAL') && nameStr.includes('CAR')) return 'Car MT';

  if (nameStr.includes('MOTOR') || typeStr.includes('MOTOR')) return 'Motorcycle';
  if (nameStr.includes('TRICYCLE') || typeStr.includes('TRICYCLE') || nameStr.includes('A1') || typeStr.includes('A1')) return 'Motorcycle';

  if (nameStr.includes('VAN') || typeStr.includes('L300') || nameStr.includes('B1') || typeStr.includes('B2')) return 'Car MT';
  return 'Car MT'; // default fallback config
};

const inferMotorTypeFromItem = (item) => {
  const typeStr = String(item.type || '').toUpperCase();
  const nameStr = String(item.name || '').toUpperCase();
  if (typeStr.includes('AT') || nameStr.includes('AUTOMATIC')) return 'Automatic';
  if (typeStr.includes('MT') || nameStr.includes('MANUAL')) return 'Manual';
  return 'Manual'; // default
};

function Schedule({ onNavigate, selectedCourse, preSelectedBranch, scheduleSelection, setScheduleSelection, cart, setCart, isLoggedIn }) {
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

  // Flags & Derived State (Must be defined before useEffects that use them)
  const isTDCCourse = selectedCourse?.type === 'tdc' ||
    selectedCourse?.category === 'TDC' ||
    selectedCourse?.name?.toLowerCase().includes('tdc') ||
    selectedCourse?.shortName?.toLowerCase().includes('tdc')

  const selectedCartItems = useMemo(() => cart.filter(i => i.selected), [cart]);
  const isMultiStepFlow = 
    selectedCourse?.category === 'Promo' || 
    selectedCartItems.length > 1 ||
    selectedCourse?.fromCartBundle;

  const isPromoCourse = isMultiStepFlow;

  const tdcItemInCart = selectedCartItems.find(i => {
    const cat = (i.category || '').toLowerCase();
    const nm = (i.name || '').toLowerCase();
    return cat === 'tdc' || nm.includes('tdc');
  });

  const isOnlineTdcNoSchedule = isTDCCourse && !isPromoCourse && String(selectedCourse?.selectedType || courseType || '').toLowerCase() === 'online'
  
  const promoCourseTypeRaw = String(selectedCourse?.selectedType || courseType || selectedCourse?.course_type || '')
  const promoCourseTypeParts = promoCourseTypeRaw.split('+').map((part) => String(part || '').trim()).filter(Boolean)
  
  const promoTdcType = useMemo(() => {
    if (!isPromoCourse) return null;
    if (tdcItemInCart) {
      return (String(tdcItemInCart.selectedType || tdcItemInCart.type || 'F2F')).toUpperCase();
    }
    return (promoCourseTypeParts[0] || (isTDCCourse ? (String(selectedCourse?.selectedType || courseType || '')) : 'F2F')).toUpperCase();
  }, [isPromoCourse, tdcItemInCart, promoCourseTypeParts, isTDCCourse, selectedCourse, courseType]);
  
  const isPromoTdcOnline = 
    isPromoCourse && 
    (promoTdcType === 'ONLINE' || promoTdcType === 'OTDC');

  const promoHasPdcFromType = promoCourseTypeParts.slice(1).some((part) => /pdc/i.test(part))
  const promoHasPdcFromName = /pdc|otdc\s*\+\s*4\s*pdc|4\s*pdc/i.test(`${selectedCourse?.name || ''} ${selectedCourse?.shortName || ''}`)
  const promoHasPdcFromSelectedCourseMeta = Array.isArray(selectedCourse?._pdcCourses) && selectedCourse._pdcCourses.length > 0
  const promoHasPdcFromCart = selectedCartItems.some(i => (i.category || '').toLowerCase() === 'pdc' || (i.name || '').toLowerCase().includes('pdc'));

  const isPromoOnlineTdcLockedBundle = isPromoCourse &&
    isPromoTdcOnline &&
    (promoHasPdcFromType || promoHasPdcFromName || promoHasPdcFromSelectedCourseMeta || promoHasPdcFromCart)

  const promoHasTdc = isTDCCourse || selectedCartItems.some(i => {
    const cat = (i.category || '').toLowerCase();
    const nm = (i.name || '').toLowerCase();
    return cat === 'tdc' || nm.includes('tdc');
  });


  useEffect(() => {
    const editMode = sessionStorage.getItem('editScheduleTarget');
    if (editMode && scheduleSelection) {
      if (editMode === 'tdc' || editMode === 'pdc') {
        if (scheduleSelection.slotDetails) setPromoTdcSlot(scheduleSelection.slotDetails);
        if (scheduleSelection.date) setPromoTdcViewMonth(new Date(scheduleSelection.date));
        if (scheduleSelection.pdcSelections) {
          setPromoPdcSelections(scheduleSelection.pdcSelections);
        }
        if (scheduleSelection.pdcSlotDetails) setPromoPdcSlot(scheduleSelection.pdcSlotDetails);
        if (scheduleSelection.pdcDate) {
          setPromoPdcDate(scheduleSelection.pdcDate);
          setPromoPdcCalMonth(new Date(scheduleSelection.pdcDate));
        }
        if (scheduleSelection.pdcSlotDetails2) setPromoPdcSlot2(scheduleSelection.pdcSlotDetails2);
        if (scheduleSelection.pdcDate2) setPromoPdcDate2(scheduleSelection.pdcDate2);

        setPromoStep(editMode === 'pdc' ? 2 : 1);
      } else if (editMode === 'all') {
        setPromoStep(1);
      }
      sessionStorage.removeItem('editScheduleTarget');
    }
  }, [scheduleSelection]);

  const [promoTdcViewMonth, setPromoTdcViewMonth] = useState(new Date())
  const [promoTdcRawSlots, setPromoTdcRawSlots] = useState([])
  const [loadingPromoTdc, setLoadingPromoTdc] = useState(false)
  const [promoTdcSlot, setPromoTdcSlot] = useState(null)
  
  // Auto-skip TDC step if it's Online TDC OR if there is no TDC in the transaction
  useEffect(() => {
    if (isPromoCourse && promoStep === 1) {
      if (isPromoTdcOnline || !promoHasTdc) {
        setPromoStep(2);
      }
    }
  }, [isPromoCourse, isPromoTdcOnline, promoHasTdc, promoStep]);
  const [promoPdcCalMonth, setPromoPdcCalMonth] = useState(new Date())
  const [promoPdcDate, setPromoPdcDate] = useState(null)
  const [promoPdcRawSlots, setPromoPdcRawSlots] = useState([])
  const [loadingPromoPdc, setLoadingPromoPdc] = useState(false)
  const [promoPdcSlot, setPromoPdcSlot] = useState(null)
  const [promoPdcMotorType, setPromoPdcMotorType] = useState(null) // 'MT' | 'AT' — only for Motorcycle PDC bundles
  // All PDC slots for the promo calendar (loaded upfront for slot pills display)
  const [promoPdcAllRawSlots, setPromoPdcAllRawSlots] = useState([])
  const [loadingPromoPdcAll, setLoadingPromoPdcAll] = useState(false)
  // Promo PDC Day 2 state (half-day sessions: Morning / Afternoon)
  const [promoPdcSelectingDay2, setPromoPdcSelectingDay2] = useState(false)
  const [promoPdcDate2, setPromoPdcDate2] = useState(null)
  const [promoPdcRawSlots2, setPromoPdcRawSlots2] = useState([])
  const [loadingPromoPdc2, setLoadingPromoPdc2] = useState(false)
  const [promoPdcSlot2, setPromoPdcSlot2] = useState(null)
  const [promoPdcSelections, setPromoPdcSelections] = useState({})
  const [activePromoPdcCourseId, setActivePromoPdcCourseId] = useState(null)
  const isHydratingPromoPdcRef = useRef(false)


  const parsePromoPdcParts = (courseTypeValue) => {
    const raw = String(courseTypeValue || '')
    const plusIndex = raw.indexOf('+')
    if (plusIndex < 0) return []
    const pdcRaw = raw.slice(plusIndex + 1).trim()
    if (!pdcRaw) return []
    const parts = pdcRaw.split('|').map(part => String(part || '').trim()).filter(Boolean)
    return parts.length > 0 ? parts : [pdcRaw]
  }

  const getPromoPdcTypeFromItem = (item) => {
    const label = `${item?.name || ''} ${(item?.type || item?.course_type || '')}`.toLowerCase()
    if (label.includes('tricycle') || label.includes('a1')) return 'Tricycle'
    if (label.includes('van') || label.includes('l300') || label.includes('b1') || label.includes('b2')) return 'B1B2'
    const isMotor = label.includes('motor') || label.includes('motorcycle')
    if (isMotor) return 'Motorcycle'
    const isAuto = label.includes('automatic') || label.includes(' at') || label.endsWith('at') || label.includes(' a/t')
    return isAuto ? 'CarAT' : 'CarMT'
  }

  const getPromoPdcCourseKey = (item) => {
    return `${item?.id || 'na'}::${(item?.name || '').toLowerCase()}::${(item?.type || item?.course_type || '').toLowerCase()}`
  }

  const inferMotorTypeFromItem = (item) => {
    const label = `${item?.name || ''} ${(item?.type || item?.course_type || '')}`.toLowerCase()
    if (label.includes('manual') || label.includes(' mt')) return 'MT'
    if (label.includes('automatic') || label.includes(' at') || label.includes(' a/t')) return 'AT'
    return null
  }

  const promoPdcCourses = useMemo(() => {
    if (!isPromoCourse) return []
    const cartPdc = cart
      .filter(item => item.selected)
      .filter(item => {
        const category = String(item?.category || '').toLowerCase()
        const name = String(item?.name || '').toLowerCase()
        const shortName = String(item?.shortName || '').toLowerCase()
        if (category === 'promo' || name.includes('promo') || name.includes('bundle')) return false
        return category === 'pdc' || category.includes('practical') || name.includes('pdc') || shortName.includes('pdc')
      })
      
    let selectedCoursePdc = Array.isArray(selectedCourse?._pdcCourses) && selectedCourse._pdcCourses.length > 0
      ? selectedCourse._pdcCourses
      : (selectedCourse?._pdcCourse ? [selectedCourse._pdcCourse] : [])

    if (selectedCoursePdc.length === 0 && promoCourseTypeRaw) {
      const parts = parsePromoPdcParts(promoCourseTypeRaw)
      selectedCoursePdc = parts.map((part, idx) => ({
        id: `promo-pdc-${idx}`,
        name: `Practical Driving Course(PDC) - ${part}`,
        shortName: part,
        category: 'PDC',
        type: part,
        course_type: part
      }))
    }

    const merged = [...cartPdc, ...selectedCoursePdc]
      .filter(Boolean)
      .map(item => ({ ...item, _pdcKey: getPromoPdcCourseKey(item) }))

    const seen = new Set()
    return merged.filter((item) => {
      if (!item?._pdcKey || seen.has(item._pdcKey)) return false
      seen.add(item._pdcKey)
      return true
    })
  }, [isPromoCourse, cart, selectedCourse, promoCourseTypeRaw])
  const activePromoPdcCourse = promoPdcCourses.find(c => c._pdcKey === activePromoPdcCourseId) || promoPdcCourses[0] || null
  const promoPdcType = activePromoPdcCourse
    ? getPromoPdcTypeFromItem(activePromoPdcCourse)
    : (isPromoCourse ? getPromoPdcTypeFromItem({ name: promoCourseTypeRaw }) : null)
  const fixedPromoPdcMotorType = promoPdcType === 'Motorcycle' ? (activePromoPdcCourse ? inferMotorTypeFromItem(activePromoPdcCourse) : inferMotorTypeFromItem({ name: promoCourseTypeRaw })) : null
  const effectivePromoPdcMotorType = fixedPromoPdcMotorType || promoPdcMotorType

  const getIsPromoPdcComplete = (courseKey) => {
    const sel = promoPdcSelections[courseKey]
    if (!sel?.slot) return false
    const session = sel.slot?.session
    if (!session) return false
    return !isHalfDay(session) || !!sel.slot2
  }

  const activePromoPdcKey = activePromoPdcCourse?._pdcKey || null

  const normalizeDateKey = (dateLike) => {
    if (!dateLike) return null
    if (typeof dateLike === 'string') {
      return dateLike.slice(0, 10)
    }
    const d = new Date(dateLike)
    if (Number.isNaN(d.getTime())) return null
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const canShareDateAcrossPdc = (existingSession, nextSession) => {
    if (!existingSession || !nextSession) return false
    if (!isHalfDay(existingSession) || !isHalfDay(nextSession)) return false
    return existingSession !== nextSession
  }

  const isCrossCourseDateConflict = (dateLike, nextSession, excludedKey = activePromoPdcKey) => {
    const nextDateKey = normalizeDateKey(dateLike)
    if (!nextDateKey || !nextSession) return false

    return Object.entries(promoPdcSelections).some(([key, sel]) => {
      if (key === excludedKey || !sel) return false

      const occupied = [
        { date: sel.date, session: sel.slot?.session },
        { date: sel.date2, session: sel.slot2?.session },
      ]

      return occupied.some((entry) => {
        const entryDateKey = normalizeDateKey(entry.date)
        if (!entryDateKey || entryDateKey !== nextDateKey || !entry.session) return false
        return !canShareDateAcrossPdc(entry.session, nextSession)
      })
    })
  }

  // Redirect if no course is selected
  useEffect(() => {
    if (!selectedCourse) {
      showNotification('Please select a course first', 'error')
      onNavigate('courses')
    } else if (selectedCourse.selectedType) {
      setCourseType(selectedCourse.selectedType)
    }
  }, [selectedCourse, onNavigate, showNotification])

  useEffect(() => {
    if (!selectedCourse || !isOnlineTdcNoSchedule || isMultiStepFlow) return

    const scheduleData = {
      noScheduleRequired: true,
      isOnlineTdcNoSchedule: true,
      providerName: 'drivetech.ph / OTDC.ph',
    }
    setScheduleSelection(scheduleData)

    if (!selectedCourse.fromCartBundle) {
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
          addonsConfig: selectedCourse.addonsConfig,
          selectedAddons: selectedCourse.selectedAddons,
          quantity: 1,
          type: courseType,
        }])
      }
    }

    showNotification('Online TDC does not require schedule selection. Proceeding to payment.', 'info')
    onNavigate('payment')
  }, [selectedCourse, isOnlineTdcNoSchedule, setScheduleSelection, cart, setCart, courseType, showNotification, onNavigate])

  // Prevent rendering while redirect is pending (no course selected)
  if (!selectedCourse) return null

  // Fetch slots for Day 1
  const fetchSlotsForDate = useCallback(async () => {
    try {
      setLoadingSlots(true)
      setDbSlots([])
      setSelectedSlot(null)

      const branchId = preSelectedBranch?.id || null
      // Always fetch all slots so they can be distributed in the calendar view
      const slots = await schedulesAPI.getSlotsByDate(null, branchId)

      setDbSlots(slots)
    } catch (err) {
      console.error('Failed to fetch slots:', err)
      showNotification('Failed to load available slots. Please try again.', 'error')
      setDbSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }, [preSelectedBranch, showNotification])

  // Fetch slots for Day 2 (PDC half-day second selection)
  const fetchSlotsForDate2 = useCallback(async (date) => {
    try {
      setLoadingSlots2(true)
      setDbSlots2([])

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

  // Promo bundle: fetch ALL PDC slots upfront (for calendar pill display)
  const fetchPromoPdcAllSlots = useCallback(async () => {
    if (!preSelectedBranch) return
    setLoadingPromoPdcAll(true)
    try {
      const branchId = preSelectedBranch?.id || null
      const slots = await schedulesAPI.getSlotsByDate(null, branchId)
      setPromoPdcAllRawSlots(slots.filter(s => s.type?.toLowerCase() === 'pdc'))
    } catch (e) {
      console.error('Failed to fetch promo PDC all slots:', e)
      setPromoPdcAllRawSlots([])
    } finally {
      setLoadingPromoPdcAll(false)
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
    fetchSlotsForDate()
  }, [fetchSlotsForDate])

  useEffect(() => {
    if (selectingDay2 && selectedDate2) {
      fetchSlotsForDate2(selectedDate2)
    }
  }, [selectedDate2, fetchSlotsForDate2, selectingDay2])

  // Promo: fetch TDC slots and all PDC slots once on mount
  useEffect(() => {
    if (isPromoCourse) {
      fetchPromoTdcSlots()
      fetchPromoPdcAllSlots()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPromoTdcSlots, fetchPromoPdcAllSlots])

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

  useEffect(() => {
    if (!isPromoCourse) return
    if (!promoPdcCourses.length) return
    if (!activePromoPdcCourseId || !promoPdcCourses.some(c => c._pdcKey === activePromoPdcCourseId)) {
      setActivePromoPdcCourseId(promoPdcCourses[0]._pdcKey)
    }
  }, [isPromoCourse, promoPdcCourses, activePromoPdcCourseId])

  useEffect(() => {
    if (!isPromoCourse || !activePromoPdcCourse) return
    isHydratingPromoPdcRef.current = true
    const saved = promoPdcSelections[activePromoPdcCourse._pdcKey]
    if (!saved) {
      setPromoPdcDate(null)
      setPromoPdcSlot(null)
      setPromoPdcDate2(null)
      setPromoPdcSlot2(null)
      setPromoPdcSelectingDay2(false)
      setPromoPdcMotorType(inferMotorTypeFromItem(activePromoPdcCourse) || null)
      setTimeout(() => {
        isHydratingPromoPdcRef.current = false
      }, 0)
      return
    }

    setPromoPdcDate(saved.date || null)
    setPromoPdcSlot(saved.slot || null)
    setPromoPdcDate2(saved.date2 || null)
    setPromoPdcSlot2(saved.slot2 || null)
    setPromoPdcSelectingDay2(saved.selectingDay2 || false)
    setPromoPdcMotorType(saved.motorType || inferMotorTypeFromItem(activePromoPdcCourse) || null)
    setTimeout(() => {
      isHydratingPromoPdcRef.current = false
    }, 0)
  }, [isPromoCourse, activePromoPdcCourseId, promoPdcSelections])

  useEffect(() => {
    if (!isPromoCourse || !activePromoPdcCourse) return
    if (isHydratingPromoPdcRef.current) return
    setPromoPdcSelections(prev => {
      const key = activePromoPdcCourse._pdcKey
      const nextEntry = {
        date: promoPdcDate,
        slot: promoPdcSlot,
        date2: promoPdcDate2,
        slot2: promoPdcSlot2,
        selectingDay2: promoPdcSelectingDay2,
        motorType: effectivePromoPdcMotorType,
      }
      const prevEntry = prev[key]

      if (
        prevEntry &&
        prevEntry.date === nextEntry.date &&
        prevEntry.slot === nextEntry.slot &&
        prevEntry.date2 === nextEntry.date2 &&
        prevEntry.slot2 === nextEntry.slot2 &&
        prevEntry.selectingDay2 === nextEntry.selectingDay2 &&
        prevEntry.motorType === nextEntry.motorType
      ) {
        return prev
      }

      return {
        ...prev,
        [key]: nextEntry,
      }
    })
  }, [
    isPromoCourse,
    activePromoPdcCourse,
    promoPdcDate,
    promoPdcSlot,
    promoPdcDate2,
    promoPdcSlot2,
    promoPdcSelectingDay2,
    promoPdcMotorType,
    effectivePromoPdcMotorType,
  ])

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

    // Regular courses (online/TDC or regular PDC) use 1 day advance. 
    // Promo bundles keep 2 days advance for PDC components.
    const advanceDays = isPromoCourse ? (isTDCCourse ? 1 : 2) : 1;
    minAllowedDate.setDate(today.getDate() + advanceDays)

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
    fetchSlotsForDate()
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
        const pickedDate = slot.date || promoPdcDate
        if (isCrossCourseDateConflict(pickedDate, slot.session)) {
          showNotification('This date is already used by another PDC course. You may only reuse the same date with the opposite half-day session.', 'warning')
          return
        }
        // Picking PDC Day 1
        setPromoPdcSlot(slot)
        setPromoPdcSlot2(null)
        setPromoPdcDate2(null)
        setPromoPdcRawSlots2([])
        if (isHalfDay(slot.session)) {
          setPromoPdcSelectingDay2(true)
          showNotification(`PDC Day 1 selected (${slot.session}). Pick a different date above for Day 2.`, 'info')
        } else {
          setPromoPdcSelectingDay2(false)
        }
      } else {
        // Picking PDC Day 2 — must match session
        if (slot.session !== promoPdcSlot?.session) {
          showNotification(`Day 2 must be the same session: ${promoPdcSlot?.session}`, 'warning')
          return
        }
        const pickedDate = slot.date || promoPdcDate2
        if (isCrossCourseDateConflict(pickedDate, slot.session)) {
          showNotification('This date is already used by another PDC course. Use the opposite half-day session only.', 'warning')
          return
        }
        setPromoPdcSlot2(slot)
        showNotification('Both PDC days selected! Ready to proceed.', 'success')
      }
      return
    }

    const halfDay = !isTDCCourse && isHalfDay(slot.session)

    if (!halfDay) {
      if (selectedSlot && !selectedSlot2 && isHalfDay(selectedSlot.session)) {
        showNotification(`A Day 1 session (${selectedSlot.session}) is already selected. Please select a matching Day 2 session or click Change to reset.`, 'warning')
        return
      }
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

  const handleCalendarSlotClick = (slot, day) => {
    if (slot.available_slots === 0) return
    const halfDay = isHalfDay(slot.session)
    const clickedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)

    if (!halfDay) {
      if (selectedSlot && !selectedSlot2 && isHalfDay(selectedSlot.session)) {
        showNotification(`A Day 1 session (${selectedSlot.session}) is already selected. Please select a matching Day 2 session or click Change to reset.`, 'warning')
        return
      }
      setSelectedSlot(slot)
      setSelectedDate(clickedDate)
      setSelectingDay2(false)
      setSelectedSlot2(null)
      setSelectedDate2(null)
      return
    }

    if (!selectingDay2) {
      setSelectedSlot(slot)
      setSelectedDate(clickedDate)
      setSelectingDay2(true)
      setSelectedSlot2(null)
      setSelectedDate2(null)
      showNotification(`Day 1 selected (${slot.session}). Pick another date for Day 2.`, 'info')
    } else {
      if (selectedDate && clickedDate.toDateString() === selectedDate.toDateString()) {
        showNotification('Day 2 must be a different date than Day 1.', 'warning')
        return
      }
      if (slot.session !== selectedSlot?.session) {
        showNotification(`Day 2 must be the same session type: ${selectedSlot?.session}`, 'warning')
        return
      }
      setSelectedSlot2(slot)
      setSelectedDate2(clickedDate)
      showNotification('Both days selected! Ready to proceed.', 'success')
    }
  }

  const handleProceedToPayment = () => {

    // Promo bundle: requires both TDC + PDC slots
    if (isPromoCourse) {
      if (isPromoOnlineTdcLockedBundle) {
        const scheduleData = {
          date: promoTdcSlot?.date ? new Date(promoTdcSlot.date + 'T00:00:00') : null,
          slot: promoTdcSlot?.id || null,
          slotDetails: promoTdcSlot ? {
            id: promoTdcSlot.id,
            session: promoTdcSlot.session,
            type: promoTdcSlot.type,
            time: promoTdcSlot.time_range,
            available: promoTdcSlot.available_slots,
            total: promoTdcSlot.total_capacity,
            date: promoTdcSlot.date,
            end_date: promoTdcSlot.end_date,
          } : null,
          pdcDate: null,
          pdcSlot: null,
          pdcSlotDetails: null,
          pdcDate2: null,
          pdcSlot2: null,
          pdcSlotDetails2: null,
          pdcSelections: {},
          isOnlineTdcNoSchedule: true,
          pdcScheduleLockedUntilCompletion: true,
          pdcScheduleLockReason: 'Online TDC must be marked complete prior to assigning PDC schedule.',
          providerName: 'drivetech.ph / OTDC.ph'
        }
        setScheduleSelection(scheduleData)
        if (selectedCourse && !selectedCourse.fromCartBundle) {
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
              addonsConfig: selectedCourse.addonsConfig,
              selectedAddons: selectedCourse.selectedAddons,
              quantity: 1,
              type: courseType,
            }])
          }
        }
        showNotification('Online TDC and requested PDC bundle added! Proceeding to payment...', 'success')
        onNavigate('payment')
        return
      }
      
      if (!promoTdcSlot && String(promoTdcType || '').toUpperCase() !== 'ONLINE') {
        showNotification('Please select a TDC schedule (Step 1)', 'error')
        setPromoStep(1)
        return
      }
      if (promoPdcCourses.length > 0) {
        const missing = promoPdcCourses.find(c => !getIsPromoPdcComplete(c._pdcKey))
        if (missing) {
          showNotification(`Please complete schedule for ${missing.name}`, 'warning')
          setActivePromoPdcCourseId(missing._pdcKey)
          setPromoStep(2)
          return
        }
      } else if (!promoPdcSlot) {
        showNotification('Please select a PDC schedule (Step 2)', 'error')
        setPromoStep(2)
        return
      }

      const pdcSelectionsPayload = promoPdcCourses.reduce((acc, course) => {
        const sel = promoPdcSelections[course._pdcKey]
        if (!sel?.slot) return acc
        acc[course._pdcKey] = {
          courseId: course.id,
          courseName: course.name,
          courseType: course.type,
          pdcDate: sel.date || null,
          pdcSlot: sel.slot?.id || null,
          pdcSlotDetails: sel.slot ? {
            id: sel.slot.id,
            session: sel.slot.session,
            type: sel.slot.type,
            time: sel.slot.time_range,
            available: sel.slot.available_slots,
            total: sel.slot.total_capacity,
            date: sel.date || null,
          } : null,
          pdcDate2: sel.slot2 ? (sel.date2 || null) : null,
          pdcSlot2: sel.slot2 ? sel.slot2.id : null,
          pdcSlotDetails2: sel.slot2 ? {
            id: sel.slot2.id,
            session: sel.slot2.session,
            type: sel.slot2.type,
            time: sel.slot2.time_range,
            available: sel.slot2.available_slots,
            total: sel.slot2.total_capacity,
            date: sel.date2 || null,
          } : null,
        }
        return acc
      }, {})

      const primaryPdc = activePromoPdcCourse ? pdcSelectionsPayload[activePromoPdcCourse._pdcKey] : null

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
        pdcDate: primaryPdc?.pdcDate || promoPdcDate,
        pdcSlot: primaryPdc?.pdcSlot || promoPdcSlot?.id,
        pdcSlotDetails: primaryPdc?.pdcSlotDetails || (promoPdcSlot ? {
          id: promoPdcSlot.id,
          session: promoPdcSlot.session,
          type: promoPdcSlot.type,
          time: promoPdcSlot.time_range,
          available: promoPdcSlot.available_slots,
          total: promoPdcSlot.total_capacity,
          date: promoPdcDate,
        } : null),
        pdcDate2: primaryPdc?.pdcDate2 || (promoPdcSlot2 ? promoPdcDate2 : null),
        pdcSlot2: primaryPdc?.pdcSlot2 || (promoPdcSlot2 ? promoPdcSlot2.id : null),
        pdcSlotDetails2: primaryPdc?.pdcSlotDetails2 || (promoPdcSlot2 ? {
          id: promoPdcSlot2.id,
          session: promoPdcSlot2.session,
          type: promoPdcSlot2.type,
          time: promoPdcSlot2.time_range,
          available: promoPdcSlot2.available_slots,
          total: promoPdcSlot2.total_capacity,
          date: promoPdcDate2,
        } : null),
        pdcSelections: pdcSelectionsPayload,
      }
      setScheduleSelection(scheduleData)
      if (selectedCourse && !selectedCourse.fromCartBundle) {
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
            addonsConfig: selectedCourse.addonsConfig,
            selectedAddons: selectedCourse.selectedAddons,
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
          addonsConfig: selectedCourse.addonsConfig,
          selectedAddons: selectedCourse.selectedAddons,
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
  // Only filter by transmission if the selected courseType is explicitly a transmission variant (manual/automatic/mt/at)
  const transmissionKeywords = ['manual', 'automatic', 'at', 'mt'];
  const isTransmissionType = !isTDCCourse && courseType &&
    transmissionKeywords.some(k => courseType.toLowerCase().includes(k));

  const normalizeTransmission = (transStr) => {
    if (!transStr) return '';
    const norm = transStr.toLowerCase().trim();
    if (norm === 'mt' || norm.includes('manual')) return 'manual';
    if (norm === 'at' || norm.includes('automatic')) return 'automatic';
    return norm; // 'both' or 'any'
  };

  const filteredPdcSlots = pdcSlots.filter(slot => {
    // Filter by course_type (motorcycle vs car, etc.)
    if (!pdcCourseTypeMatches(slot.course_type)) return false;

    // Only apply transmission filter when student's courseType is a known transmission type
    if (isTransmissionType && slot.transmission &&
      slot.transmission.toLowerCase() !== 'both' &&
      slot.transmission.toLowerCase() !== 'any') {

      const transmissionNorm = normalizeTransmission(slot.transmission);
      const selectedNorm = normalizeTransmission(courseType);

      if (transmissionNorm !== selectedNorm) {
        return false;
      }
    }

    // Session type filter
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
    
    if (promoPdcType === 'Tricycle') {
      return ct.includes('tricycle') || ct.includes('a1')
    }
    if (promoPdcType === 'B1B2') {
      return ct.includes('van') || ct.includes('l300') || ct.includes('b1') || ct.includes('b2')
    }

    if (!ct || ct === 'both' || ct === 'any' || ct === 'all') {
      if (promoPdcType === 'Motorcycle') return ct.includes('motor') || ct.includes('bike') || !ct
      return true
    }
    if (promoPdcType === 'Motorcycle') {
      const isMotor = ct.includes('motorcycle') || ct.includes('motor') || ct.includes('moto') || ct.includes('bike')
      if (!isMotor) return false
      if (effectivePromoPdcMotorType === 'MT') return !tr || tr === 'both' || tr === 'any' || tr.includes('manual') || tr === 'mt'
      if (effectivePromoPdcMotorType === 'AT') return !tr || tr === 'both' || tr === 'any' || tr.includes('auto') || tr === 'at'
      return true
    }
    // Car types — exclude motorcycle + special vehicle slots
    if (ct.includes('motorcycle') || ct.includes('motor') || ct.includes('moto') || ct.includes('bike') ||
      ct.includes('tricycle') || ct.includes('van') || ct.includes('l300') || ct.includes('a1') || ct.includes('b1') ||
      ct.includes('b2') || ct.includes('v1')) return false
      
    if (promoPdcType === 'CarAT') return !tr || tr === 'both' || tr === 'any' || tr.includes('auto') || tr === 'at'
    if (promoPdcType === 'CarMT') return !tr || tr === 'both' || tr === 'any' || tr.includes('manual') || tr === 'mt'
    return true
  }
  const promoPdcFiltered = promoPdcRawSlots
    .filter(promoPdcSlotMatches)
    .filter(slot => !isCrossCourseDateConflict(slot.date, slot.session))
    .sort((a, b) => ({ morning: 1, afternoon: 2, 'whole day': 3 }[(a.session || '').toLowerCase()] || 99) - ({ morning: 1, afternoon: 2, 'whole day': 3 }[(b.session || '').toLowerCase()] || 99))
  // Day 2 slots must match vehicle type AND must match the same session as Day 1
  const promoPdcFiltered2 = promoPdcRawSlots2
    .filter(promoPdcSlotMatches)
    .filter(slot => !isCrossCourseDateConflict(slot.date, slot.session))
    .sort((a, b) => ({ morning: 1, afternoon: 2, 'whole day': 3 }[(a.session || '').toLowerCase()] || 99) - ({ morning: 1, afternoon: 2, 'whole day': 3 }[(b.session || '').toLowerCase()] || 99))

  const { daysInMonth: promoPdcDaysInMonth, startingDayOfWeek: promoPdcStartDay } = getDaysInMonth(promoPdcCalMonth)

  // Promo PDC min selectable date: TDC end_date + 2 days (student must finish TDC first)
  const promoPdcMinDate = (() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const base = new Date(today)
    if (!promoTdcSlot) return base
    const tdcEnd = promoTdcSlot.end_date || promoTdcSlot.date
    if (!tdcEnd) return base
    const tdcEndDate = new Date(tdcEnd + 'T00:00:00')
    const afterTdc = new Date(tdcEndDate)
    afterTdc.setDate(afterTdc.getDate() + 3) // Advance two days base on TDC last day
    return afterTdc > base ? afterTdc : base
  })()

  // All promo PDC slots filtered by vehicle/transmission type (for calendar pills)
  const promoPdcAllFiltered = promoPdcAllRawSlots.filter(promoPdcSlotMatches)

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

  // Slots for the currently "active" date in the calendar (used primarily for mobile list view)
  const slotsForActiveDate = (() => {
    const d = selectingDay2 ? selectedDate2 : selectedDate
    if (!d) return []
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const dstr = `${y}-${m}-${day}`

    let slots = filteredPdcSlots.filter(s => s.date === dstr)

    // PDC Day 2 must match Day 1's session type (Morning or Afternoon)
    if (!isTDCCourse && selectingDay2 && selectedSlot && isHalfDay(selectedSlot.session)) {
      slots = slots.filter(s => s.session === selectedSlot.session)
    }

    slots.sort((a, b) => ({ morning: 1, afternoon: 2, 'whole day': 3 }[(a.session || '').toLowerCase()] || 99) - ({ morning: 1, afternoon: 2, 'whole day': 3 }[(b.session || '').toLowerCase()] || 99));

    return slots
  })()

  // Show TDC slots for TDC courses (month-filtered), or slots for picked date for PDC
  const relevantSlots = isTDCCourse ? tdcSlotsForMonth : slotsForActiveDate

  const sessionIcon = (session) => {
    if (session === 'Morning') return '🌅'
    if (session === 'Afternoon') return '☀️'
    return '🕐'
  }

  const sessionColor = (session, selected, type = 'pdc') => {
    if (selected) return { bg: 'linear-gradient(135deg, #2157da 0%, #1a3a8a 100%)', text: '#fff', badge: 'rgba(255,255,255,0.2)', badgeText: '#fff' }

    if (type?.toLowerCase() === 'tdc') {
      return { bg: '#f5f3ff', text: '#7c3aed', badge: '#ddd6fe', badgeText: '#7c3aed' }
    }

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
        {/* Mobile Back Button (Top) */}
        <div className="block sm:hidden mb-6 flex flex-col gap-3" data-aos="fade-down">
          <button
            onClick={() => onNavigate('courses')}
            className="w-full py-3.5 bg-white text-gray-700 border-2 border-gray-200 rounded-2xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Courses
          </button>
          {isPromoCourse && promoStep === 2 && (
            <button
              onClick={() => { setPromoStep(1) }}
              className="w-full py-3.5 bg-white text-[#2157da] border-2 border-[#2157da] rounded-2xl font-bold hover:bg-blue-50 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
              Change TDC
            </button>
          )}
        </div>

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
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">
                    {selectedCartItems.length > 1 ? 'Courses in Transaction' : 'Selected Course'}
                  </p>
                  <p className="text-sm font-bold text-gray-900 leading-tight">
                    {selectedCartItems.length > 1 ? `${selectedCartItems.length} Courses Selected` : selectedCourse.name}
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Calendar (Hidden for TDC and Promo which has its own flow) */}
        {!isTDCCourse && !isPromoCourse && (

          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-3 sm:p-7 mb-6" data-aos="fade-up" data-aos-delay="100">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <button
                onClick={handlePrevMonth}
                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl border border-gray-200 hover:border-[#2157da] hover:bg-blue-50 transition-all"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-base sm:text-xl font-black text-gray-900">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h2>
              <button
                onClick={handleNextMonth}
                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl border border-gray-200 hover:border-[#2157da] hover:bg-blue-50 transition-all"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 sm:gap-2 mb-1 sm:mb-2">
              {dayNames.map((day) => (
                <div key={day} className="text-center text-[9px] sm:text-xs font-black text-gray-400 uppercase tracking-wider py-1 sm:py-2">
                  {/* On mobile show only first letter, on sm+ show 3-letter abbreviation */}
                  <span className="sm:hidden">{day[0]}</span>
                  <span className="hidden sm:inline">{day}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5 sm:gap-2">
              {[...Array(startingDayOfWeek)].map((_, index) => (
                <div key={`empty-${index}`} className="min-h-[52px] sm:min-h-[140px]"></div>
              ))}
              {[...Array(daysInMonth)].map((_, index) => {
                const day = index + 1
                const cellDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
                const isBeforeDay1 = selectingDay2 && selectedDate && cellDate < selectedDate
                const isAvailable = isDateAvailable(day) && !isBeforeDay1
                const isToday = new Date().getDate() === day &&
                  new Date().getMonth() === currentMonth.getMonth() &&
                  new Date().getFullYear() === currentMonth.getFullYear()

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

                const isSelected = isDay1Marker || isDay1Selected || isDay2Selected

                // Get real slots from DB for this day only (no dummies)
                const currentDayStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                let daySlots = filteredPdcSlots.filter(s => s.date === currentDayStr)

                // Sort: Morning → Afternoon → Whole Day
                daySlots = daySlots.sort((a, b) => {
                  const order = { 'morning': 1, 'afternoon': 2, 'whole day': 3 };
                  return (order[a.session?.toLowerCase()] || 99) - (order[b.session?.toLowerCase()] || 99);
                });

                const formatTimeRange = (range) => {
                  if (!range) return ''
                  return range.toLowerCase()
                    .replace(/ - /g, ' / ')
                    .replace(/ am/g, 'am')
                    .replace(/ pm/g, 'pm')
                    .replace(/^0(\d:)/, '$1');
                }

                const hasRealSlots = daySlots.length > 0;
                const hasAvailability = daySlots.some(s => s.available_slots > 0);

                const slotCellBorder = isDay1Marker
                  ? 'border-orange-300 bg-orange-50'
                  : isDay2Selected || isDay1Selected
                    ? 'border-[#2563eb] border-2 bg-blue-50/40 shadow-md'
                    : isToday
                      ? 'border-[#2563eb] bg-blue-50/30'
                      : !isAvailable
                        ? 'border-transparent bg-gray-50/50'
                        : hasRealSlots && hasAvailability
                          ? 'border-orange-300/60 bg-orange-50/25 hover:border-orange-400 hover:shadow-sm'
                          : hasRealSlots && !hasAvailability
                            ? 'border-red-200/60 bg-red-50/20'
                            : 'border-gray-200/80 bg-white hover:border-gray-300';

                return (
                  <div
                    key={day}
                    onClick={() => {
                      if (!isAvailable || isDay1Marker) return;
                      handleDateClick(day);
                    }}
                    className={`min-h-[52px] sm:min-h-[140px] rounded-lg sm:rounded-xl border flex flex-col overflow-hidden transition-all relative
                      ${!isAvailable || isDay1Marker ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:shadow-md'}
                      ${slotCellBorder}`}
                  >
                    {/* Day number */}
                    <div className="flex items-center justify-between px-1 sm:px-2.5 pt-1.5 sm:pt-2.5 pb-0.5 sm:pb-1 flex-shrink-0">
                      <span className={`text-[10px] sm:text-[13px] font-bold leading-none ${isDay1Selected || isDay2Selected ? 'text-[#2563eb]' :
                          isDay1Marker ? 'text-orange-500' :
                            isToday ? 'text-[#2563eb]' : 'text-gray-500'
                        }`}>{day}</span>
                      {isToday && <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-[#2563eb] opacity-60 flex-shrink-0"></span>}
                    </div>

                    {/* Mobile: dot indicators only - made pointer-events-none so they don't block cell click */}
                    <div className="flex sm:hidden flex-wrap gap-0.5 px-0.5 pb-1 pointer-events-none">
                      {daySlots.slice(0, 4).map((slot) => {
                        const isFullyBooked = slot.available_slots === 0;
                        const isSlotSelected = selectedSlot?.id === slot.id || selectedSlot2?.id === slot.id;
                        return (
                          <div
                            key={slot.id}
                            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isSlotSelected ? 'bg-[#2563eb]' :
                                isFullyBooked ? 'bg-red-400' :
                                  slot.session === 'Morning' ? 'bg-orange-400' :
                                    slot.session === 'Afternoon' ? 'bg-yellow-400' :
                                      'bg-blue-400'
                              }`}
                          />
                        );
                      })}
                    </div>

                    {/* Desktop: Slot pills — full labels */}
                    <div className="hidden sm:flex flex-col gap-[3px] px-1.5 pb-2 flex-1">
                      {daySlots.map(slot => {
                        const isFullyBooked = slot.available_slots === 0;
                        const isSlotSelected = selectedSlot?.id === slot.id || selectedSlot2?.id === slot.id;
                        const isTdc = slot.type?.toLowerCase() === 'tdc';
                        const sessionLabel = (() => {
                          const sn = (slot.session || '').toLowerCase();
                          if (sn.includes('morning')) return 'Morning Class';
                          if (sn.includes('afternoon')) return 'Afternoon Class';
                          if (sn.includes('whole')) return 'Whole Day';
                          return slot.session || (isTdc ? 'TDC' : 'PDC');
                        })();
                        const countLabel = isFullyBooked ? 'FULL' : `${slot.available_slots} Slots`;

                        const isSessionMismatch = selectingDay2 && selectedSlot && slot.session !== selectedSlot.session;
                        return (
                          <div
                            key={slot.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isFullyBooked) return;
                              if (isSessionMismatch) {
                                showNotification(`For Day 2, please select the same session type: ${selectedSlot.session}`, 'warning');
                                return;
                              }
                              handleCalendarSlotClick(slot, day);
                            }} className={`w-full text-left rounded-[7px] border px-1.5 py-1 flex flex-col gap-[2px] ${!isFullyBooked && !isSessionMismatch ? 'cursor-pointer hover:shadow-md transition-all' : 'cursor-not-allowed'} ${isSlotSelected
                                ? 'border-[#2563eb] bg-[#2563eb] text-white shadow-sm'
                                : (isFullyBooked || isSessionMismatch)
                                  ? 'border-red-200 bg-red-50 text-red-500 opacity-70'
                                  : isTdc
                                    ? 'border-violet-200 bg-violet-50 text-violet-700'
                                    : 'border-orange-200 bg-orange-50 text-orange-700'
                              }`}
                          >
                            <div className="flex items-center justify-between gap-1 leading-none">
                              <span className="text-[9px] sm:text-[10px] font-black truncate flex-1 min-w-0">{sessionLabel}</span>
                              <span className={`text-[8px] font-bold flex-shrink-0 px-1 rounded leading-[1.5] ${isSlotSelected ? 'bg-white/25 text-white' :
                                  isFullyBooked ? 'bg-red-100 text-red-600' :
                                    isTdc ? 'bg-violet-100 text-violet-700' : 'bg-orange-100 text-orange-700'
                                }`}>{countLabel}</span>
                            </div>
                            <div className="text-[7px] sm:text-[8px] font-medium opacity-75 truncate leading-none">
                              {formatTimeRange(slot.time_range)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Mobile Legend (compact) */}
            <div className="flex sm:hidden flex-wrap justify-center gap-3 mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-orange-400"></div><span className="text-[10px] font-semibold text-gray-500">Morning</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div><span className="text-[10px] font-semibold text-gray-500">Afternoon</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-400"></div><span className="text-[10px] font-semibold text-gray-500">Whole Day</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-400"></div><span className="text-[10px] font-semibold text-gray-500">Full</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#2563eb]"></div><span className="text-[10px] font-semibold text-gray-500">Selected</span></div>
            </div>

            {/* Desktop Calendar Legend Guide */}
            <div className="hidden sm:flex flex-wrap justify-center gap-4 sm:gap-6 mt-6 pt-5 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-orange-50 border border-orange-300/60 rounded-lg"></div>
                <span className="text-[12px] sm:text-[13px] font-semibold text-gray-500">Has Slots</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-[#2563eb] rounded-lg"></div>
                <span className="text-[12px] sm:text-[13px] font-semibold text-gray-500">Selected</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-blue-50 border border-[#2563eb] rounded-lg"></div>
                <span className="text-[12px] sm:text-[13px] font-semibold text-gray-500">Today</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-red-50 border border-red-200/60 rounded-lg"></div>
                <span className="text-[12px] sm:text-[13px] font-semibold text-gray-500">Fully Booked</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-orange-50 border border-orange-300 rounded-[5px]"></div>
                <span className="text-[12px] sm:text-[13px] font-semibold text-gray-500">PDC Slot</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-violet-50 border border-violet-200 rounded-[5px]"></div>
                <span className="text-[12px] sm:text-[13px] font-semibold text-gray-500">TDC Slot</span>
              </div>
            </div>
          </div>
        )}

        {/* Slot Selection Panel - ONLY FOR TDC since PDC renders them in calendar directly */}
        {!isPromoCourse && (isTDCCourse || selectedDate) ? (
          <div className={`bg-white rounded-3xl shadow-lg border border-gray-100 p-5 sm:p-7 mb-6 ${!isTDCCourse ? 'sm:hidden' : ''}`} data-aos="fade-up" data-aos-delay="200">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-black text-gray-900">
                  {isTDCCourse
                    ? 'Available TDC Schedules'
                    : (selectingDay2 && selectedSlot)
                      ? `Available ${selectedSlot.session} Slots (Day 2)`
                      : 'Available Time Slots'
                  }
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {isTDCCourse
                    ? tdcViewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                    : (selectingDay2 ? selectedDate2 : selectedDate)?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                  }
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
                  There are no schedule slots set up for this month yet. Please choose another month or check back later.
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
                      <div
                        className="h-1.5 w-full flex-shrink-0"
                        style={{ background: isDay1 ? 'rgba(255,255,255,0.3)' : isDay2 ? '#22c55e' : sessionMeta.color }}
                      />
                      <div className="p-5 flex flex-col flex-1">
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
                        <p
                          className="text-[11px] font-bold uppercase tracking-wider mb-2 leading-tight"
                          style={{ color: isDay1 ? 'rgba(255,255,255,0.65)' : '#94a3b8' }}
                        >
                          {courseLabel}
                        </p>
                        <p
                          className="text-base font-black mb-1"
                          style={{ color: isDay1 ? '#fff' : isDay2 ? '#166534' : '#1e293b' }}
                        >
                          {slot.session} Session
                        </p>
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
                            {(slot.total_capacity || 0) - (slot.available_slots || 0)} / {slot.total_capacity} Students Enrolled
                          </p>
                        </div>
                      </div>
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
            ? (effectivePromoPdcMotorType === 'MT' ? 'Motorcycle (Manual)' : effectivePromoPdcMotorType === 'AT' ? 'Motorcycle (Automatic)' : 'Motorcycle')
            : promoPdcType === 'CarAT' ? 'Car (Automatic)' : 'Car (Manual)'
          const totalSteps = 2
          const pdcDoneCount = promoPdcCourses.filter(c => getIsPromoPdcComplete(c._pdcKey)).length
          const allPdcDone = promoPdcCourses.length > 0 ? pdcDoneCount === promoPdcCourses.length : !!promoPdcSlot
          return (
            <div data-aos="fade-up" data-aos-delay="100">

              {/* Step indicator */}
              <div className="flex items-center gap-3 mb-5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
                <span className="text-2xl">🏷️</span>
                <div className="flex-1 min-w-0 text-center">
                  <p className="font-black text-amber-900 text-sm">
                    {promoHasTdc ? 'Promo Bundle — 2-Step Schedule' : 'PDC Bundle — Schedule Overview'}
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">{selectedCourse?.name}</p>
                </div>
                <div className="flex items-center gap-3">
                  {promoHasTdc && (
                    <>
                      <div className={`flex items-center gap-1.5 ${promoStep === 1 || isPromoOnlineTdcLockedBundle ? 'opacity-100' : 'opacity-60'}`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs ${promoTdcSlot ? 'bg-green-500 text-white' : promoStep === 1 || isPromoOnlineTdcLockedBundle ? 'bg-[#2157da] text-white' : 'bg-gray-200 text-gray-500'}`}>
                          {promoTdcSlot && !isPromoOnlineTdcLockedBundle ? '✓' : '1'}
                        </div>
                        <span className="text-xs font-bold text-gray-700 hidden sm:block">TDC</span>
                      </div>
                      <div className="w-6 h-0.5 bg-gray-300 rounded" />
                    </>
                  )}
                  <div className={`flex items-center gap-1.5 ${promoStep === 2 || isPromoOnlineTdcLockedBundle ? 'opacity-100' : 'opacity-60'}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs ${allPdcDone && !isPromoOnlineTdcLockedBundle ? 'bg-green-500 text-white' : promoStep === 2 || isPromoOnlineTdcLockedBundle ? 'bg-[#2157da] text-white' : 'bg-gray-200 text-gray-500'}`}>
                      {allPdcDone && !isPromoOnlineTdcLockedBundle ? '✓' : promoHasTdc ? '2' : '1'}
                    </div>
                    <span className="text-xs font-bold text-gray-700 hidden sm:block">PDC {promoPdcCourses.length > 1 ? `(${pdcDoneCount}/${promoPdcCourses.length})` : ''}</span>
                  </div>
                </div>
              </div>

              {isPromoOnlineTdcLockedBundle && (
                <div className="mb-5 bg-blue-50 border border-blue-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-4 border-b border-blue-200/50 pb-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-xl shrink-0">💻</div>
                    <div className="flex-1 text-center pr-10">
                      <p className="text-lg font-black text-blue-900">Online TDC Selected</p>
                      <p className="text-xs text-blue-800 mt-0.5">
                        No branch scheduling is required. You can proceed directly to Enrollment.
                      </p>
                    </div>
                  </div>
                  {promoPdcCourses.length > 0 && (
                    <div className="mt-2 text-blue-900">
                      <p className="text-xs font-bold uppercase tracking-wider mb-2 opacity-80">Practical Courses Included:</p>
                      <div className="space-y-2 pl-1 border-l-2 border-blue-200 ml-1">
                        {promoPdcCourses.map(c => {
                          const courseKind = getPromoPdcTypeFromItem(c);
                          const courseTx = courseKind === 'Motorcycle' ? inferMotorTypeFromItem(c) : null;
                          return (
                            <div key={c._pdcKey} className="flex flex-col pl-3">
                              <span className="text-sm font-bold text-gray-800">{c.name}</span>
                              <span className="text-xs text-blue-800/80 leading-relaxed max-w-sm">
                                {courseKind.includes('Car') ? (courseKind.includes('AT') ? 'Automatic' : 'Manual') : (courseTx ? `Motorcycle · ${courseTx}` : 'Motorcycle')}
                                {' '}· <span className="font-bold underline">Only the branch manager can set your PDC schedule date</span> because you need to finish your Online TDC before taking your practical courses.
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ---- STEP 1: TDC Slot Selection ---- */}
              {!isPromoOnlineTdcLockedBundle && promoStep === 1 && (
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

                  {isPromoOnlineTdcLockedBundle ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                      <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center"><span className="text-3xl">💻</span></div>
                      <p className="text-base font-black text-blue-900">Online TDC Selected</p>
                      <p className="text-sm text-blue-700">No branch slot selection is required for Online TDC. You can proceed directly to Enrollment.</p>
                    </div>
                  ) : loadingPromoTdc ? (
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
                        const colors = sessionColor(slot.session, isSel, slot.type)
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
                            <p className={`text-xs font-bold ${isSel ? 'text-blue-100' : 'text-gray-500'}`}>{(slot.total_capacity || 0) - (slot.available_slots || 0)} / {slot.total_capacity} enrolled</p>
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
              {!isPromoOnlineTdcLockedBundle && promoStep === 2 && (
                <>
                  {promoPdcCourses.length > 1 && (
                    <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-5 sm:p-7 mb-4">
                      {/* Active Course Schedule Summary Bar */}
                      {(() => {
                        const sel = activePromoPdcCourse?._pdcKey ? promoPdcSelections[activePromoPdcCourse._pdcKey] : null;
                        const isDone = activePromoPdcCourse?._pdcKey && getIsPromoPdcComplete(activePromoPdcCourse._pdcKey);
                        if (!isDone) return null;
                        
                        const d1 = new Date(sel.date);
                        const d2 = new Date(sel.date2);
                        const s1 = sel.slotDetails;
                        const s2 = sel.slotDetails2;
                        
                        return (
                          <div className="bg-green-50 border border-green-200 rounded-2xl p-3 mb-5 flex items-center gap-4">
                            <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
                              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <div className="flex-1 text-center sm:text-left">
                              <h4 className="text-sm font-black text-green-800">PDC Both Days Selected!</h4>
                              <p className="text-[10px] sm:text-xs text-green-700 mt-0.5">
                                <span className="font-bold">Day 1:</span> {s1?.session} · {d1.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                <span className="mx-2 opacity-50">|</span>
                                <span className="font-bold">Day 2:</span> {s2?.session} · {d2.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </p>
                            </div>
                            <button 
                              onClick={() => {
                                const newSels = { ...promoPdcSelections };
                                delete newSels[activePromoPdcCourse._pdcKey];
                                setPromoPdcSelections(newSels);
                                setPromoPdcDate(null);
                                setPromoPdcSlot(null);
                                setPromoPdcDate2(null);
                                setPromoPdcSlot2(null);
                              }}
                              className="text-xs font-black text-green-600 hover:text-green-800 underline uppercase tracking-tight"
                            >
                              Change
                            </button>
                          </div>
                        );
                      })()}

                      <h3 className="text-base font-black text-gray-900 mb-3">Select PDC Course To Schedule</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {promoPdcCourses.map((course) => {
                          const isActive = activePromoPdcCourse?._pdcKey === course._pdcKey
                          const done = getIsPromoPdcComplete(course._pdcKey)
                          return (
                            <button
                              key={course._pdcKey}
                              onClick={() => setActivePromoPdcCourseId(course._pdcKey)}
                              className={`p-3 rounded-2xl border-2 text-left transition-all ${isActive ? 'border-[#2157da] bg-blue-50' : 'border-gray-200 bg-white hover:border-[#2157da]'} `}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className={`font-black text-sm ${isActive ? 'text-[#2157da]' : 'text-gray-900'}`}>{course.name}</p>
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${isActive ? 'bg-[#2157da] text-white' : 'bg-gray-100 text-gray-400'}`}>
                                  {(() => {
                                    const kind = getPromoPdcTypeFromItem(course)
                                    const tx = inferMotorTypeFromItem(course)
                                    if (kind === 'Tricycle') return 'TRI'
                                    if (kind === 'B1B2') return 'VAN/L300'
                                    if (kind === 'Motorcycle') return tx || 'MOTO'
                                    return tx || (kind.includes('AT') ? 'AT' : 'MT')
                                  })()}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1">
                                <p className="text-xs text-gray-500">{done ? 'Schedule Complete' : 'Schedule Pending'}</p>
                                {done && (
                                  <div className="w-3.5 h-3.5 bg-green-500 rounded-full flex items-center justify-center">
                                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                                  </div>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* ---- Motor Type Selector (Motorcycle PDC bundles only) ---- */}
                  {promoPdcType === 'Motorcycle' && !fixedPromoPdcMotorType && (
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
                              className={`p-4 rounded-2xl border-2 text-left transition-all ${isSel
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
                  {(promoPdcType !== 'Motorcycle' || effectivePromoPdcMotorType) && (
                    <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-5 sm:p-7 mb-4">
                      <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-black text-sm">2</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-gray-900">{promoPdcSelectingDay2 ? 'Step 2: Select PDC Day 2' : 'Step 2: Select PDC Schedule'}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">{promoPdcSelectingDay2 ? `Pick a different date from the calendar — must match ${promoPdcSlot?.session}` : `${pdcTypeLabel} — pick a date from the calendar`}</p>
                        </div>
                      </div>

                      {/* ---- PDC Day 1 selected banner (half-day) - MOVED TO TOP ---- */}
                      {promoPdcSlot && isHalfDay(promoPdcSlot.session) && !promoPdcSlot2 && (
                        <div className="bg-blue-50 border-2 border-[#2157da] rounded-2xl p-4 mb-6 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="w-10 h-10 bg-[#2157da] rounded-xl flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-black text-sm">1</span>
                          </div>
                          <div className="flex-1">
                            <p className="font-black text-[#2157da] text-sm">PDC Day 1 Selected — {promoPdcSlot.session} · {promoPdcSlot.time_range}</p>
                            <p className="text-xs text-blue-600 mt-0.5">{promoPdcSlot.session} sessions require 2 days. Pick a different date above for <strong>Day 2</strong>.</p>
                          </div>
                          <button onClick={() => { setPromoPdcSlot(null); setPromoPdcSlot2(null); setPromoPdcSelectingDay2(false); setPromoPdcDate2(null); setPromoPdcRawSlots2([]) }}
                            className="text-xs text-[#2157da] underline hover:no-underline font-bold flex-shrink-0">Change Day 1</button>
                        </div>
                      )}

                      {/* ---- PDC Day 2 complete banner - MOVED TO TOP ---- */}
                      {promoPdcSlot && promoPdcSlot2 && (
                        <div className="bg-green-50 border-2 border-green-500 rounded-2xl p-4 mb-6 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          </div>
                          <div className="flex-1">
                            <p className="font-black text-green-800 text-sm">PDC Both Days Selected!</p>
                            <p className="text-xs text-green-700 mt-0.5">
                              Day 1: {promoPdcSlot.session} · {new Date(promoPdcDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} &nbsp;|&nbsp;
                              Day 2: {promoPdcSlot2.session} · {new Date(promoPdcDate2).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                          <button onClick={() => { setPromoPdcSlot(null); setPromoPdcSlot2(null); setPromoPdcSelectingDay2(false); setPromoPdcDate2(null); setPromoPdcRawSlots2([]) }}
                            className="text-xs text-green-700 underline hover:no-underline font-bold flex-shrink-0">Change</button>
                        </div>
                      )}

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
                          const cellDate = new Date(promoPdcCalMonth.getFullYear(), promoPdcCalMonth.getMonth(), day)
                          const isDay2 = promoPdcSelectingDay2 && promoPdcDate;
                          const minAllowedDate = isDay2 ? new Date(promoPdcDate.getTime() + 86400000) : promoPdcMinDate;
                          const avail = cellDate >= minAllowedDate && cellDate.getDay() !== 0
                          const today = new Date(); today.setHours(0, 0, 0, 0)
                          const isToday = cellDate.getTime() === today.getTime()
                          const isSel = promoPdcDate?.getDate() === day && promoPdcDate?.getMonth() === promoPdcCalMonth.getMonth() && promoPdcDate?.getFullYear() === promoPdcCalMonth.getFullYear()
                          const isSel2 = promoPdcDate2?.getDate() === day && promoPdcDate2?.getMonth() === promoPdcCalMonth.getMonth() && promoPdcDate2?.getFullYear() === promoPdcCalMonth.getFullYear()
                          const currentDayStr = `${promoPdcCalMonth.getFullYear()}-${String(promoPdcCalMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                          const daySlots = promoPdcAllFiltered
                            .filter(s => s.date === currentDayStr)
                            .sort((a, b) => ({ morning: 1, afternoon: 2, 'whole day': 3 }[(a.session || '').toLowerCase()] || 99) - ({ morning: 1, afternoon: 2, 'whole day': 3 }[(b.session || '').toLowerCase()] || 99))
                          const hasRealSlots = daySlots.length > 0
                          const hasAvailability = daySlots.some(s => s.available_slots > 0)
                          const slotCellBorder = isSel2
                            ? 'border-[#2563eb] border-2 bg-blue-50/40 shadow-md'
                            : isSel
                              ? 'border-[#2563eb] border-2 bg-blue-50/40 shadow-md'
                              : isToday
                                ? 'border-[#2563eb] bg-blue-50/30'
                                : (!avail && !isSel)
                                  ? 'border-transparent bg-gray-50/50'
                                  : hasRealSlots && hasAvailability
                                    ? 'border-orange-300/60 bg-orange-50/25 hover:border-orange-400 hover:shadow-sm'
                                    : hasRealSlots && !hasAvailability
                                      ? 'border-red-200/60 bg-red-50/20'
                                      : 'border-gray-200/80 bg-white hover:border-gray-300';
                          return (
                            <div key={day}
                              onClick={() => {
                                if (!avail && !isSel) return;
                                if (promoPdcSelectingDay2) {
                                  if (promoPdcDate && cellDate.getTime() === promoPdcDate.getTime()) {
                                    showNotification('Day 2 must be a different date than Day 1.', 'warning');
                                    return;
                                  }
                                  setPromoPdcDate2(new Date(promoPdcCalMonth.getFullYear(), promoPdcCalMonth.getMonth(), day));
                                } else {
                                  setPromoPdcDate(new Date(promoPdcCalMonth.getFullYear(), promoPdcCalMonth.getMonth(), day));
                                }
                                fetchPromoPdcAllSlots();
                              }}
                              className={`min-h-[52px] sm:min-h-[140px] rounded-lg sm:rounded-xl border flex flex-col overflow-hidden transition-all relative ${(!avail && !isSel) ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:shadow-md'
                                } ${slotCellBorder}`}
                            >
                              <div className="flex items-center justify-between px-2.5 pt-2.5 pb-1 flex-shrink-0">
                                <span className={`text-[13px] font-bold leading-none ${isSel2 ? 'text-[#2563eb]' : isSel ? 'text-[#2563eb]' : isToday ? 'text-[#2563eb]' : 'text-gray-500'
                                  }`}>{day}</span>
                                {isToday && !isSel && <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] opacity-60 flex-shrink-0"></span>}
                                {isSel && <span className="text-[8px] font-black text-white bg-[#2563eb] px-1 rounded-sm">D1</span>}
                                {isSel2 && <span className="text-[8px] font-black text-white bg-[#2563eb] px-1 rounded-sm">D2</span>}
                              </div>

                              {/* Mobile: dot indicators only - made pointer-events-none so they don't block cell click */}
                              <div className="flex sm:hidden flex-wrap gap-0.5 px-0.5 pb-1 pointer-events-none">
                                {daySlots.slice(0, 4).map((slot) => {
                                  const isFullyBooked = slot.available_slots === 0;
                                  const isSlotSelected = promoPdcSlot?.id === slot.id || promoPdcSlot2?.id === slot.id;
                                  const isCrossCourseConflict = isCrossCourseDateConflict(currentDayStr, slot.session);
                                  return (
                                    <div
                                      key={slot.id}
                                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isSlotSelected ? 'bg-[#2563eb]' :
                                          isCrossCourseConflict ? 'bg-gray-400' :
                                            isFullyBooked ? 'bg-red-400' :
                                              slot.session === 'Morning' ? 'bg-orange-400' :
                                                slot.session === 'Afternoon' ? 'bg-yellow-400' :
                                                  'bg-blue-400'
                                        }`}
                                    />
                                  );
                                })}
                              </div>

                              {/* Desktop: Slot pills — full labels */}
                              <div className="hidden sm:flex flex-col gap-[3px] px-1.5 pb-2 flex-1">

                                {daySlots.map(slot => {
                                  const isFullyBooked = slot.available_slots === 0
                                  const isSlotSel = promoPdcSlot?.id === slot.id
                                  const isSlotSel2 = promoPdcSlot2?.id === slot.id
                                  const isSessionMismatch = promoPdcSelectingDay2 && promoPdcSlot && slot.session !== promoPdcSlot.session;
                                  const isCrossCourseConflict = isCrossCourseDateConflict(currentDayStr, slot.session);

                                  const sessionLabel = (() => {
                                    const sn = (slot.session || '').toLowerCase()
                                    if (sn.includes('morning')) return 'Morning Class'
                                    if (sn.includes('afternoon')) return 'Afternoon Class'
                                    if (sn.includes('whole')) return 'Whole Day'
                                    return slot.session || 'PDC'
                                  })()

                                  const countLabel = isFullyBooked ? 'FULL' : `${slot.available_slots} Slots`
                                  const timeStr = (slot.time_range || '').toLowerCase().replace(/ - /g, ' / ').replace(/ am/g, 'am').replace(/ pm/g, 'pm')

                                  return (
                                    <div key={slot.id} onClick={(e) => {
                                      e.stopPropagation();
                                      if (isFullyBooked) return;
                                      if (isSessionMismatch) {
                                        showNotification(`For Day 2, please select the same session type: ${promoPdcSlot.session}`, 'warning');
                                        return;
                                      }
                                      if (isCrossCourseConflict) {
                                        showNotification('This date is already used by another PDC course. Use the opposite half-day session only.', 'warning');
                                        return;
                                      }
                                      if (promoPdcSelectingDay2) {
                                        setPromoPdcDate2(new Date(promoPdcCalMonth.getFullYear(), promoPdcCalMonth.getMonth(), day));
                                      } else {
                                        setPromoPdcDate(new Date(promoPdcCalMonth.getFullYear(), promoPdcCalMonth.getMonth(), day));
                                      }
                                      handleSlotClick(slot);
                                    }} className={`w-full text-left rounded-[7px] border px-1.5 py-1 flex flex-col gap-[2px] ${!isFullyBooked && !isSessionMismatch && !isCrossCourseConflict ? 'cursor-pointer hover:shadow-md transition-all' : 'cursor-not-allowed opacity-50'} ${isSlotSel2 ? 'border-[#2563eb] bg-[#2563eb] text-white shadow-sm'
                                        : isSlotSel ? 'border-[#2563eb] bg-[#2563eb] text-white shadow-sm'
                                          : (isFullyBooked || isSessionMismatch || isCrossCourseConflict) ? 'border-red-200 bg-red-50 text-red-500 opacity-70'
                                            : 'border-orange-200 bg-orange-50 text-orange-700'
                                      }`}>
                                      <div className="flex items-center justify-between gap-1 leading-none">
                                        <span className="text-[9px] sm:text-[10px] font-black truncate flex-1 min-w-0">{sessionLabel}</span>
                                        <span className={`text-[8px] font-bold flex-shrink-0 px-1 rounded leading-[1.5] ${(isSlotSel || isSlotSel2) ? 'bg-white/25 text-white'
                                            : (isFullyBooked || isSessionMismatch) ? 'bg-red-100 text-red-600'
                                              : 'bg-orange-100 text-orange-700'
                                          }`}>{countLabel}</span>
                                      </div>
                                      <div className={`text-[7px] sm:text-[8px] font-medium truncate leading-none ${isSessionMismatch ? 'opacity-40' : 'opacity-75'}`}>{timeStr}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* PDC Day 1 Slots */}
                  {(promoPdcType !== 'Motorcycle' || effectivePromoPdcMotorType) && promoPdcDate && !promoPdcSelectingDay2 && (
                    <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-5 sm:p-7 mb-4 sm:hidden">
                      <div className="flex items-center justify-between mb-5">
                        <div>
                          <h3 className="text-lg font-black text-gray-900">PDC Time Slots — {pdcTypeLabel} <span className="text-sm font-bold text-gray-400">(Day 1)</span></h3>
                          <p className="text-xs text-gray-500 mt-1">{new Date(promoPdcDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
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
                            const isDay1 = promoPdcSlot?.id === slot.id
                            const isSel = promoPdcSlot?.id === slot.id
                            const isDay2 = false
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
                                <div
                                  className="h-1.5 w-full flex-shrink-0"
                                  style={{ background: isDay1 ? 'rgba(255,255,255,0.3)' : isDay2 ? '#22c55e' : sessionMeta.color }}
                                />
                                <div className="p-5 flex flex-col flex-1">
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
                                  <p
                                    className="text-[11px] font-bold uppercase tracking-wider mb-2 leading-tight"
                                    style={{ color: isDay1 ? 'rgba(255,255,255,0.65)' : '#94a3b8' }}
                                  >
                                    {courseLabel}
                                  </p>
                                  <p
                                    className="text-base font-black mb-1"
                                    style={{ color: isDay1 ? '#fff' : isDay2 ? '#166534' : '#1e293b' }}
                                  >
                                    {slot.session} Session
                                  </p>
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
                                      {(slot.total_capacity || 0) - (slot.available_slots || 0)} / {slot.total_capacity} Students Enrolled
                                    </p>
                                  </div>
                                </div>
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
                  )}


                  {/* PDC Day 2 Slots */}
                  {promoPdcSelectingDay2 && !promoPdcSlot2 && promoPdcDate2 && (
                    <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-5 sm:p-7 mb-4 sm:hidden">
                      <div className="flex items-center justify-between mb-5">
                        <div>
                          <h3 className="text-lg font-black text-gray-900">PDC Time Slots — {pdcTypeLabel} <span className="text-sm font-bold text-gray-400">(Day 2)</span></h3>
                          <p className="text-xs text-gray-500 mt-1">{new Date(promoPdcDate2).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · {promoPdcSlot?.session} session only</p>
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
                            const isDay1 = false
                            const isSel = promoPdcSlot2?.id === slot.id
                            const isDay2 = promoPdcSlot2?.id === slot.id
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

                            const cardBg = isDay1 ? 'linear-gradient(135deg, #1a4fba 0%, #1e3a8a 100%)' : isDay2 ? 'linear-gradient(135deg, #1a4fba 0%, #1e3a8a 100%)'
                              : isFull
                                ? '#f8fafc'
                                : 'white';
                            const cardBorder = isDay1 ? 'transparent' : isDay2 ? 'transparent'
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
                                      ? 'shadow-xl shadow-blue-500/30 scale-[1.02]'
                                      : 'hover:border-[#2157da] hover:shadow-lg hover:scale-[1.02] hover:-translate-y-0.5'
                                  }`}
                              >
                                <div
                                  className="h-1.5 w-full flex-shrink-0"
                                  style={{ background: isDay1 ? 'rgba(255,255,255,0.3)' : isDay2 ? 'rgba(255,255,255,0.3)' : sessionMeta.color }}
                                />
                                <div className="p-5 flex flex-col flex-1">
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
                                            ? { background: 'rgba(255,255,255,0.18)', color: '#fff' }
                                            : { background: statusBg, color: statusText }
                                      }
                                    >
                                      {isDay1 ? '✓ DAY 1' : isDay2 ? '✓ DAY 2' : statusLabel}
                                    </span>
                                  </div>
                                  <p
                                    className="text-[11px] font-bold uppercase tracking-wider mb-2 leading-tight"
                                    style={{ color: isDay1 ? 'rgba(255,255,255,0.65)' : '#94a3b8' }}
                                  >
                                    {courseLabel}
                                  </p>
                                  <p
                                    className="text-base font-black mb-1"
                                    style={{ color: isDay1 ? '#fff' : isDay2 ? '#fff' : '#1e293b' }}
                                  >
                                    {slot.session} Session
                                  </p>
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
                                      {(slot.total_capacity || 0) - (slot.available_slots || 0)} / {slot.total_capacity} Students Enrolled
                                    </p>
                                  </div>
                                </div>
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
                  )}
                </>
              )}

              {/* Promo Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6" data-aos="fade-up" data-aos-delay="300">
                <button onClick={() => onNavigate('courses')} className="hidden sm:flex flex-1 py-4 bg-white text-gray-700 border-2 border-gray-200 rounded-2xl font-bold hover:bg-gray-50 hover:border-gray-300 transition-all items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                  Back to Courses
                </button>
                {promoStep === 1 ? (
                  <button
                    onClick={() => {
                      if (isPromoOnlineTdcLockedBundle) {
                        handleProceedToPayment()
                        return
                      }
                      if (!promoTdcSlot) {
                        showNotification('Please select a TDC schedule first', 'error')
                        return
                      }
                      setPromoStep(2)
                    }}
                    disabled={!isPromoOnlineTdcLockedBundle && !promoTdcSlot}
                    className={`flex-1 py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-2 ${isPromoOnlineTdcLockedBundle || promoTdcSlot ? 'bg-gradient-to-r from-[#2157da] to-[#1a3a8a] text-white hover:shadow-2xl hover:shadow-blue-500/40 hover:scale-105 active:scale-100' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                  >
                    {isPromoOnlineTdcLockedBundle
                      ? <><span>Proceed to Enrollment</span><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg></>
                      : promoTdcSlot
                        ? <><span>Next: Select PDC Schedule</span><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg></>
                        : 'Select TDC Slot to Continue'}
                  </button>
                ) : (
                  <>
                    <button onClick={() => { setPromoStep(1) }} className="hidden sm:flex py-4 px-6 bg-white text-[#2157da] border-2 border-[#2157da] rounded-2xl font-bold hover:bg-blue-50 transition-all items-center justify-center gap-2 flex-shrink-0">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                      Change TDC
                    </button>
                    <button
                      onClick={handleProceedToPayment}
                      disabled={isPromoOnlineTdcLockedBundle ? false : (promoPdcCourses.length > 0 ? promoPdcCourses.some(c => !getIsPromoPdcComplete(c._pdcKey)) : (!promoPdcSlot || (isHalfDay(promoPdcSlot?.session) && !promoPdcSlot2)))}
                      className={`flex-1 py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-2 ${(isPromoOnlineTdcLockedBundle || (promoPdcCourses.length > 0 ? promoPdcCourses.every(c => getIsPromoPdcComplete(c._pdcKey)) : (promoPdcSlot && (!isHalfDay(promoPdcSlot?.session) || promoPdcSlot2)))) ? 'bg-gradient-to-r from-[#2157da] to-[#1a3a8a] text-white hover:shadow-2xl hover:shadow-blue-500/40 hover:scale-105 active:scale-100' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                    >
                      {isPromoOnlineTdcLockedBundle
                        ? <><span>Proceed to Enrollment</span><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg></>
                        : (promoPdcCourses.length > 0 ? promoPdcCourses.every(c => getIsPromoPdcComplete(c._pdcKey)) : (promoPdcSlot && (!isHalfDay(promoPdcSlot?.session) || promoPdcSlot2)))
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
        {/* Day 1 slot panel — appears after a date is clicked in the calendar */}
        {false && !isPromoCourse && !isTDCCourse && selectedDate && !selectingDay2 && !selectedSlot && (() => {
          const day1DateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
          const day1Slots = filteredPdcSlots.filter(s => s.date === day1DateStr)
          return (
            <div className="bg-white rounded-3xl shadow-lg border-2 border-dashed border-[#2157da] p-5 sm:p-7 mb-6" data-aos="fade-up">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-[#2157da] rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-black text-sm">1</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-black text-gray-900">Select Day 1 Time Slot</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
              {day1Slots.length === 0 ? (
                <div className="text-center py-8">
                  <span className="text-3xl">📭</span>
                  <p className="text-sm font-bold text-gray-700 mt-2">No slots available on this date</p>
                  <p className="text-xs text-gray-500 mt-1">Pick a different date from the calendar above.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {day1Slots.map(slot => {
                    const isFull = slot.available_slots === 0
                    const isSel = selectedSlot?.id === slot.id
                    const colors = sessionColor(slot.session, isSel)
                    return (
                      <button
                        key={slot.id}
                        onClick={() => { setSelectedSlot(slot); setSelectedDate(selectedDate); if (isHalfDay(slot.session)) { setSelectingDay2(true); setSelectedSlot2(null); setSelectedDate2(null); setDbSlots2([]); showNotification(`Day 1 selected (${slot.session}). Pick a different date above for Day 2.`, 'info') } else { setSelectingDay2(false); setSelectedSlot2(null); setSelectedDate2(null); setDbSlots2([]) } }}
                        disabled={isFull}
                        style={isSel ? { background: colors.bg } : {}}
                        className={`relative p-4 rounded-2xl text-left border-2 transition-all ${isSel ? 'border-transparent shadow-xl shadow-blue-500/30 scale-105'
                            : isFull ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60'
                              : 'bg-white border-gray-200 hover:border-[#2157da] hover:shadow-md hover:scale-105'
                          }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">{sessionIcon(slot.session)}</span>
                          <div className="flex-1">
                            <p className={`font-black text-sm ${isSel ? 'text-white' : 'text-gray-900'}`}>{slot.session} Session</p>
                            <p className={`text-xs font-bold ${isSel ? 'text-blue-100' : 'text-gray-500'}`}>🕐 {slot.time_range}</p>
                          </div>
                          {isSel && <span className="text-[10px] font-black bg-white/20 text-white px-2 py-0.5 rounded-lg">DAY 1 ✓</span>}
                        </div>
                        <div className={`h-1.5 rounded-full overflow-hidden ${isSel ? 'bg-white/20' : 'bg-gray-200'} mb-2`}>
                          <div
                            className={`h-full rounded-full ${isSel ? 'bg-white' : isFull ? 'bg-red-500' : 'bg-green-500'}`}
                            style={{ width: `${((slot.total_capacity - slot.available_slots) / slot.total_capacity) * 100}%` }}
                          />
                        </div>
                        <p className={`text-xs font-bold ${isSel ? 'text-blue-100' : 'text-gray-500'}`}>
                          {(slot.total_capacity || 0) - (slot.available_slots || 0)} / {slot.total_capacity} enrolled
                        </p>
                        {isFull && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-black mt-1 inline-block">FULL</span>}
                        {isSel && (
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
              )}
            </div>
          )
        })()}

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
        {false && !isPromoCourse && selectingDay2 && !selectedSlot2 && (
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
                    const colors2 = sessionColor(slot.session, isSel2, slot.type)
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
                          {(slot.total_capacity || 0) - (slot.available_slots || 0)} / {slot.total_capacity} enrolled
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
              className="hidden sm:flex flex-1 py-4 bg-white text-gray-700 border-2 border-gray-200 rounded-2xl font-bold hover:bg-gray-50 hover:border-gray-300 transition-all items-center justify-center gap-2"
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
