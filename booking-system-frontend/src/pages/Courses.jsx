import { useCallback, useState, useEffect } from 'react'
import { useNotification } from '../context/NotificationContext'
import { coursesAPI, branchesAPI, schedulesAPI } from '../services/api'

function Courses({ onNavigate, cart, setCart, isLoggedIn, preSelectedBranch, setSelectedCourseForSchedule, setScheduleSelection }) {
  const { showNotification } = useNotification()
  const [sortBy, setSortBy] = useState('best-selling')
  const [priceFilter, setPriceFilter] = useState('all')
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [courseType, setCourseType] = useState('online')
  const [quantity, setQuantity] = useState(1)
  const [addonsConfig, setAddonsConfig] = useState({ reviewer: 30, vehicleTips: 20, convenienceFee: 25, promoBundleDiscountPercent: 3, customAddons: [] })
  const [selectedAddons, setSelectedAddons] = useState({ reviewer: true, vehicleTips: true, convenienceFee: true })
  const [courses, setCourses] = useState([])
  const [branchContacts, setBranchContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [mainImage, setMainImage] = useState(null)
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [hasAvailableSlots, setHasAvailableSlots] = useState(true)
  const [slotAvailabilityDetail, setSlotAvailabilityDetail] = useState(null) // null | { hasTdc, hasPdc, tdcLabel, pdcLabel }
  const [isMobileScreen, setIsMobileScreen] = useState(window.innerWidth < 1024)
  // Per-promo-package slot availability in the listing view: { [courseId]: { loading, hasTdc, hasPdc, tdcLabel, pdcLabel } }
  const [promoListingAvailability, setPromoListingAvailability] = useState({})

  // Format branch name - remove company prefixes
  const formatBranchName = (name) => {
    if (!name) return name;

    const prefixes = [
      'Master Driving School ',
      'Master Prime Driving School ',
      'Masters Prime Holdings Corp. ',
      'Master Prime Holdings Corp. '
    ];

    let formattedName = name;
    for (const prefix of prefixes) {
      if (formattedName.startsWith(prefix)) {
        formattedName = formattedName.substring(prefix.length);
        break;
      }
    }

    return formattedName;
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const [coursesRes, branchesRes, addonsRes] = await Promise.all([
          coursesAPI.getAll(),
          branchesAPI.getAll(),
          coursesAPI.getAddonsConfig()
        ]);

        if (addonsRes?.success && addonsRes.config) {
          const config = { reviewer: 30, vehicleTips: 20, convenienceFee: 25, promoBundleDiscountPercent: 3, ...addonsRes.config, customAddons: addonsRes.config.customAddons || [] };
          setAddonsConfig(config);
          
          const newSelected = { reviewer: true, vehicleTips: true, convenienceFee: true };
          if (config.customAddons) {
              config.customAddons.forEach(addon => {
                  newSelected[addon.id] = true;
              });
          }
          setSelectedAddons(newSelected);
        }

        if (coursesRes.success) {
          const activeCourses = coursesRes.courses.filter(c => c.status === 'active');
          setCourses(activeCourses);
        } else {
          showNotification('Failed to fetch courses', 'error');
        }

        if (branchesRes.success) {
          setBranchContacts(branchesRes.branches);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        showNotification('An error occurred while loading data', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [showNotification]);

  useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  const packages = courses.map(course => {
    // Resolve the effective price for the currently selected branch.
    // If a branch is selected and the course has a custom price for that branch, use it.
    // Otherwise fall back to the course default price.
    const defaultPrice = parseFloat(course.price) || 0;
    const branchEffectivePrice = (() => {
      if (!preSelectedBranch || !Array.isArray(course.branch_prices)) return defaultPrice;
      const bp = course.branch_prices.find(b => String(b.branch_id) === String(preSelectedBranch.id));
      if (bp && bp.price > 0 && parseFloat(bp.price) !== defaultPrice) return parseFloat(bp.price);
      return defaultPrice;
    })();

    // Build type options array
    const typeOptions = [];

    // Add main course type with its price (branch-adjusted)
    if (course.course_type) {
      typeOptions.push({
        value: course.course_type.toLowerCase().replace(/\s+/g, '-'),
        label: course.course_type.toUpperCase(),
        price: branchEffectivePrice,
        discount: parseFloat(course.discount) || 0
      });
    }

    // Add pricing variations as additional type options
    if (course.pricing_data && Array.isArray(course.pricing_data)) {
      course.pricing_data.forEach(variation => {
        typeOptions.push({
          value: variation.type.toLowerCase().replace(/\s+/g, '-'),
          label: variation.type.toUpperCase(),
          price: parseFloat(variation.price),
          discount: parseFloat(variation.discount) || parseFloat(course.discount) || 0
        });
      });
    }

    // If no type options, create a default one
    if (typeOptions.length === 0) {
      typeOptions.push({
        value: 'standard',
        label: 'STANDARD',
        price: branchEffectivePrice,
        discount: parseFloat(course.discount) || 0
      });
    }

    // Parse images - handle both array and JSON string formats
    let courseImages = [];
    if (course.image_url) {
      try {
        courseImages = typeof course.image_url === 'string'
          ? JSON.parse(course.image_url)
          : course.image_url;

        // Ensure it's an array
        if (!Array.isArray(courseImages)) {
          courseImages = [courseImages];
        }

        // Add data URI prefix if it's a base64 string without it
        courseImages = courseImages.map(img => {
          if (img && !img.startsWith('data:') && !img.startsWith('http') && !img.startsWith('/')) {
            return `data:image/jpeg;base64,${img}`;
          }
          return img;
        });
      } catch (e) {
        courseImages = [];
      }
    }

    // Extract features from description or use defaults
    const features = course.description
      ? course.description.split(/[.\n]/).filter(f => f.trim() && f.length > 10).slice(0, 5)
      : [
        'Comprehensive driving training',
        'Experienced certified instructors',
        'LTO exam preparation',
        'Flexible schedule options',
        'Modern training facilities'
      ];

    // Determine display name and short name
    const displayName = course.name || 'Unnamed Course';
    const shortName = displayName.includes('(')
      ? displayName.split('(')[0].trim()
      : displayName.split('-')[0].trim();

    return {
      id: course.id,
      name: displayName,
      shortName: shortName,
      duration: `${course.duration || 8} Hours`,
      price: branchEffectivePrice,
      image: courseImages.length > 0 ? courseImages[0] : '/images/default-course.jpg',
      allImages: courseImages,
      features: features,
      hasTypeOption: true,
      typeOptions: typeOptions,
      category: course.category || 'Basic',
      brand: 'MASTER DRIVING SCHOOL PH',
      description: course.description || 'Professional driving course with comprehensive training',
      contact: 'Please contact our sales representative for enrollment assistance.',
      terms: 'Please be reminded that upon checking out you agree to our company terms and conditions. To check the available schedule for walk in you may call the numbers below:',
      enrolled: parseInt(course.enrolled) || 0,
      popular: false
    };
  });

  // Calculate Best Sellers dynamically
  const sortedByEnrollments = [...packages].sort((a, b) => b.enrolled - a.enrolled);
  const bestSellerIds = sortedByEnrollments
    .filter(pkg => pkg.enrolled > 0)
    .slice(0, 3)
    .map(pkg => pkg.id);

  packages.forEach(pkg => {
    pkg.popular = bestSellerIds.includes(pkg.id);
  });

  // Check promo bundle slot availability for listing view whenever branch or courses change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!preSelectedBranch) {
      setPromoListingAvailability({});
      return;
    }
    const promoPackagesList = courses
      .filter(c => String(c.category || '').toLowerCase() === 'promo')
      .map(c => ({ id: c.id, typeOptions: (() => {
        const opts = [];
        if (c.course_type) opts.push({ value: c.course_type.toLowerCase().replace(/\s+/g, '-') });
        if (c.pricing_data) c.pricing_data.forEach(v => opts.push({ value: v.type.toLowerCase().replace(/\s+/g, '-') }));
        return opts;
      })() }));
    if (promoPackagesList.length === 0) return;

    const checkPromoAvailability = async () => {
      const loadingMap = {};
      promoPackagesList.forEach(pkg => { loadingMap[pkg.id] = { loading: true }; });
      setPromoListingAvailability(loadingMap);
      try {
        const allSlots = await schedulesAPI.getSlotsByDate(null, preSelectedBranch.id);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tdcMinDate = new Date(today); tdcMinDate.setDate(today.getDate() + 1);
        const pdcMinDate = new Date(today); pdcMinDate.setDate(today.getDate() + 2);
        const results = {};
        for (const pkg of promoPackagesList) {
          const defaultTypeValue = (pkg.typeOptions?.[0]?.value || '').toLowerCase();
          const tdcPart = defaultTypeValue.includes('+') ? defaultTypeValue.split('+')[0].trim() : defaultTypeValue;
          const pdcPart = defaultTypeValue.includes('+') ? defaultTypeValue.split('+').slice(1).join('+').trim() : '';

          const isOnlineTdc = tdcPart.includes('online') || tdcPart.includes('otdc');
          const hasTdc = isOnlineTdc ? true : (Array.isArray(allSlots) && allSlots.some(s => {
            if (s.type?.toLowerCase() !== 'tdc') return false;
            const sd = new Date((s.date || s.start_date) + 'T00:00:00');
            if (sd < tdcMinDate) return false;
            if (tdcPart && tdcPart !== 'f2f' && s.course_type && s.course_type.toLowerCase() !== tdcPart) return false;
            return s.available_slots == null || s.available_slots > 0;
          }));

          // Multi-part PDC check for listing view
          const pdcPartsRaw = pdcPart.split('|').map(p => p.trim()).filter(Boolean);
          const pdcResults = pdcPartsRaw.map(p => {
             const pLower = p.toLowerCase();
             const isMoto = pLower.includes('motorcycle') || pLower.includes('motor') || pLower.includes('moto') || pLower.includes('bike');
             const isAT = pLower.includes('automatic') || pLower.includes('auto') || pLower.includes('at');
             const isMT = pLower.includes('manual') || pLower.includes('mt');
             const isTricycle = pLower.includes('tricycle') || pLower.includes('v1');
             const isB1B2 = pLower.includes('b1') || pLower.includes('b2') || pLower.includes('van') || pLower.includes('l300');
             
             return Array.isArray(allSlots) && allSlots.some(s => {
                if (s.type?.toLowerCase() !== 'pdc') return false;
                const sd = new Date((s.date || s.start_date) + 'T00:00:00');
                if (sd < pdcMinDate) return false;
                const ct = (s.course_type || '').toLowerCase();
                const tr = (s.transmission || '').toLowerCase();
                if (isAT && tr && tr !== 'both' && tr !== 'any' && !tr.includes('auto') && tr !== 'at') return false;
                if (isMT && tr && tr !== 'both' && tr !== 'any' && !tr.includes('manual') && tr !== 'mt') return false;
                if (!ct || ct === 'both' || ct === 'any' || ct === 'all') return s.available_slots == null || s.available_slots > 0;
                if (isTricycle) return ct.includes('tricycle');
                if (isB1B2) return ct.includes('b1') || ct.includes('b2') || ct.includes('van') || ct.includes('l300');
                if (isMoto) return ct.includes('motorcycle') || ct.includes('motor') || ct.includes('moto') || ct.includes('bike');
                return !ct.includes('motorcycle') && !ct.includes('motor') && !ct.includes('tricycle') && !ct.includes('b1') && !ct.includes('b2');
             });
          });

          const hasPdc = pdcResults.length === 0 || pdcResults.every(ok => ok);
          const tdcLabel = isOnlineTdc ? 'TDC (Online)' : (tdcPart === 'f2f' ? 'TDC (Face-to-Face)' : 'TDC');
          const pdcLabel = pdcPart.includes('|') ? `${pdcPartsRaw.length} PDC Tracks` : (pdcPart.includes('motor') ? 'PDC Motorcycle' : 'PDC Car');
          results[pkg.id] = { loading: false, hasTdc, hasPdc, tdcLabel, pdcLabel };
        }
        setPromoListingAvailability(results);
      } catch (e) {
        const openMap = {};
        promoPackagesList.forEach(pkg => { openMap[pkg.id] = { loading: false, hasTdc: true, hasPdc: true }; });
        setPromoListingAvailability(openMap);
      }
    };
    checkPromoAvailability();
  }, [preSelectedBranch?.id, courses.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const addToCart = (pkg, qty = 1, type = 'online') => {
    const normalizedQty = Math.max(1, Number(qty) || 1)
    const normalizedType = String(type || 'online')
    // Only store lightweight fields — images are base64 blobs that blow localStorage quota
    const cartItem = {
      id: pkg.id,
      name: pkg.name,
      shortName: pkg.shortName,
      duration: pkg.duration,
      price: pkg.price,
      category: pkg.category,
      typeOptions: pkg.typeOptions,
      hasTypeOption: pkg.hasTypeOption,
      quantity: normalizedQty,
      type: normalizedType,
      addonsConfig: addonsConfig,
      selectedAddons: selectedAddons,
      // Fixed: Preserve PDC bundle metadata so it reaches Payment.jsx and Backend
      pdcCourseIds: pkg.pdcCourseIds || pkg._pdcCourseIds || [],
      _pdcCourses: pkg._pdcCourses || pkg._pdcCourse ? (pkg._pdcCourses || [pkg._pdcCourse]) : [],
      pdcSelections: pkg.pdcSelections || {},
    }
    
    setCart(prevCart => {
      const existingIdx = prevCart.findIndex(item => item.id === cartItem.id && item.type === cartItem.type)
      if (existingIdx !== -1) {
        const nextCart = [...prevCart]
        // Overwrite the existing item with the new parameters (qty, addons, etc.)
        // instead of just adding to the quantity. This prevents the "doubling" bug
        // when users enroll, cancel, and enroll again.
        nextCart[existingIdx] = cartItem;
        return nextCart
      }
      return [...prevCart, cartItem]
    })
  }

  const isSelectedOnlineTdc = useCallback(() => {
    if (!selectedCourse) return false
    const isTdcCourse = selectedCourse?.type === 'tdc' || selectedCourse?.category === 'TDC' || (selectedCourse?.name || '').toLowerCase().includes('tdc') || (selectedCourse?.shortName || '').toLowerCase().includes('tdc')
    return isTdcCourse && String(courseType || '').toLowerCase().includes('online')
  }, [selectedCourse, courseType])

  const isSelectedPdcCourse = useCallback(() => {
    if (!selectedCourse) return false
    const category = String(selectedCourse?.category || '').toLowerCase()
    const name = `${selectedCourse?.name || ''} ${selectedCourse?.shortName || ''}`.toLowerCase()
    return category === 'pdc' || name.includes('pdc')
  }, [selectedCourse])

  const hasIncompleteOnlineTdc = async () => {
    if (!isLoggedIn) return false

    try {
      const res = await schedulesAPI.getMyEnrollments()
      const enrollments = Array.isArray(res?.enrollments) ? res.enrollments : []

      const onlineTdcBookings = enrollments.filter((row) => {
        const category = String(row?.course_category || '').toLowerCase()
        const type = String(row?.course_type || '').toLowerCase()
        const name = String(row?.course_name || row?.course_full_name || '').toLowerCase()
        const isTdc = category === 'tdc' || name.includes('tdc')
        const isOnline = type.includes('online')
        return isTdc && isOnline
      })

      if (onlineTdcBookings.length === 0) return false

      return onlineTdcBookings.some((row) => String(row?.booking_status || '').toLowerCase() !== 'completed')
    } catch (error) {
      console.error('Failed to validate online TDC completion:', error)
      return false
    }
  }

  const handleEnrollNow = async () => {

    if (!preSelectedBranch) {
      showNotification("Please select a branch first from the Branches page", "error")
      onNavigate('branches')
      return
    }

    if (selectedCourse) {
      if (isSelectedPdcCourse() && isLoggedIn) {
        const blockedByOnlineTdc = await hasIncompleteOnlineTdc()
        if (blockedByOnlineTdc) {
          showNotification('You cannot enroll in any PDC course yet. Your Online TDC must be marked Complete in CRM first.', 'error')
          return
        }
      }

      const persistPostVerifyRedirect = (target, isOnlineTdc = false) => {
        const payload = {
          next: target,
          source: 'courses',
          isOnlineTdcNoSchedule: Boolean(isOnlineTdc),
          createdAt: Date.now(),
        }
        sessionStorage.setItem('postVerifyRedirect', JSON.stringify(payload))
        localStorage.setItem('postVerifyRedirect', JSON.stringify(payload))
      }

      const isOnlineTdc = isSelectedOnlineTdc()

      // Only store lightweight fields to avoid localStorage QuotaExceededError (images are base64 blobs)
      setSelectedCourseForSchedule({
        id: selectedCourse.id,
        name: selectedCourse.name,
        shortName: selectedCourse.shortName,
        duration: selectedCourse.duration,
        price: selectedCourse.price,
        category: selectedCourse.category,
        typeOptions: selectedCourse.typeOptions,
        hasTypeOption: selectedCourse.hasTypeOption,
        selectedType: courseType,
        addonsConfig: addonsConfig,
        selectedAddons: selectedAddons,
        // Fixed: Preserve PDC bundle metadata
        pdcCourseIds: selectedCourse.pdcCourseIds || selectedCourse._pdcCourseIds || [],
        _pdcCourses: selectedCourse._pdcCourses || selectedCourse._pdcCourse ? (selectedCourse._pdcCourses || [selectedCourse._pdcCourse]) : [],
        pdcSelections: selectedCourse.pdcSelections || {},
      })

      if (isOnlineTdc) {
        addToCart(selectedCourse, quantity, courseType)
        const hasPdc = selectedCourse.pdcCourseIds?.length > 0 || selectedCourse._pdcCourseIds?.length > 0 || (courseType || '').includes('+');
        setScheduleSelection({
          noScheduleRequired: true,
          isOnlineTdcNoSchedule: true,
          providerName: 'drivetech.ph / OTDC.ph',
          pdcScheduleLockedUntilCompletion: hasPdc,
          pdcScheduleLockReason: hasPdc ? 'PDC schedule will be assigned by Admin after your online course is completed.' : null,
          pdcCourseIds: selectedCourse.pdcCourseIds || selectedCourse._pdcCourseIds || [],
        })
        persistPostVerifyRedirect('payment', true)
      } else {
        setScheduleSelection(null)
        persistPostVerifyRedirect('schedule')
      }

      if (!isLoggedIn) {
        onNavigate('signup')
      } else if (isOnlineTdc) {
        showNotification('Online TDC does not require schedule selection. Proceeding to payment.', 'success')
        onNavigate('payment')
      } else {
        onNavigate('schedule')
      }
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Token-based course_type matcher (same logic as Schedule.jsx)
  const buildCourseTypeChecker = (courseName, courseShortName) => {
    const stopWords = new Set(['practical', 'driving', 'course', 'pdc', 'tdc', 'theoretical', 'dc', 'a', 'an', 'the', 'and', 'or', 'for', 'of', 'in', 'to'])
    const extractTokens = (str) => (str || '').toLowerCase().replace(/[()\[\]{}'"]/g, ' ').split(/[\s\-\/,;|&+]+/).filter(t => t.length >= 2 && !stopWords.has(t))
    const courseTokens = new Set(extractTokens((courseName || '') + ' ' + (courseShortName || '')))
    return (slotCourseType) => {
      if (!slotCourseType) return true
      const norm = slotCourseType.toLowerCase().trim()
      if (norm === 'both' || norm === 'any' || norm === 'all') return true
      const slotTokens = extractTokens(slotCourseType)
      if (slotTokens.length === 0) return true
      return slotTokens.some(t => courseTokens.has(t))
    }
  }

  // Check slot availability whenever the viewed course, branch, or type changes
  const checkAvailability = useCallback(async () => {
    if (!selectedCourse || !preSelectedBranch) {
      setHasAvailableSlots(true)
      setSlotAvailabilityDetail(null)
      return
    }
    
    setAvailabilityLoading(true)
    try {
      const isOnlineOnlyTdc = !!selectedCourse && (isSelectedOnlineTdc() && !(courseType || '').includes('+') && !selectedCourse.pdcCourseIds?.length);
      if (isOnlineOnlyTdc) {
        setHasAvailableSlots(true)
        setSlotAvailabilityDetail(null)
        return
      }

      const name = (selectedCourse.name || '').toLowerCase()
      const shortName = (selectedCourse.shortName || '').toLowerCase()
      const category = selectedCourse.category || ''
      const isPromo = category === 'Promo'
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      if (isPromo) {
        // Promo bundles (TDC + PDC): BOTH parts must have available slots
        const allSlots = await schedulesAPI.getSlotsByDate(null, preSelectedBranch.id)
        const tdcPart = courseType.includes('+') ? courseType.split('+')[0].toLowerCase().trim() : courseType.toLowerCase()
        const pdcPart = courseType.includes('+') ? courseType.split('+').slice(1).join('+').toLowerCase().trim() : ''
        const tdcMinDate = new Date(today); tdcMinDate.setDate(today.getDate() + 1)
        const pdcMinDate = new Date(today); pdcMinDate.setDate(today.getDate() + 2)

        const hasTdc = (tdcPart === 'online' || tdcPart.includes('otdc')) ? true : (Array.isArray(allSlots) && allSlots.some(s => {
          if (s.type?.toLowerCase() !== 'tdc') return false
          const sd = new Date((s.date || s.start_date) + 'T00:00:00')
          if (sd < tdcMinDate) return false
          if (tdcPart && s.course_type && s.course_type.toLowerCase() !== tdcPart) return false
          return s.available_slots == null || s.available_slots > 0
        }))

        // Parse each PDC part separately (split by |)
        const pdcPartsRaw = pdcPart.split('|').map(p => p.trim()).filter(Boolean)
        const pdcResults = pdcPartsRaw.map(p => {
           const label = p.toUpperCase()
           const pLower = p.toLowerCase()
           const isMoto = pLower.includes('motorcycle') || pLower.includes('motor') || pLower.includes('moto') || pLower.includes('bike')
           const isAT = pLower.includes('automatic') || pLower.includes('auto') || pLower.includes('at')
           const isMT = pLower.includes('manual') || pLower.includes('mt')
           const isTricycle = pLower.includes('tricycle') || pLower.includes('v1')
           const isB1B2 = pLower.includes('b1') || pLower.includes('b2') || pLower.includes('van') || pLower.includes('l300')
           
           const ok = Array.isArray(allSlots) && allSlots.some(s => {
              if (s.type?.toLowerCase() !== 'pdc') return false
              const sd = new Date((s.date || s.start_date) + 'T00:00:00')
              if (sd < pdcMinDate) return false
              const ct = (s.course_type || '').toLowerCase()
              const tr = (s.transmission || '').toLowerCase()
              
              // Transmission check
              if (isAT && tr && tr !== 'both' && tr !== 'any' && !tr.includes('auto') && tr !== 'at') return false
              if (isMT && tr && tr !== 'both' && tr !== 'any' && !tr.includes('manual') && tr !== 'mt') return false
              
              if (!ct || ct === 'both' || ct === 'any' || ct === 'all') return s.available_slots == null || s.available_slots > 0
              
              if (isTricycle) return ct.includes('tricycle')
              if (isB1B2) return ct.includes('b1') || ct.includes('b2') || ct.includes('van') || ct.includes('l300')
              if (isMoto) return ct.includes('motorcycle') || ct.includes('motor') || ct.includes('moto') || ct.includes('bike')
              
              // Generic Car
              return !ct.includes('motorcycle') && !ct.includes('motor') && !ct.includes('tricycle') && !ct.includes('b1') && !ct.includes('b2')
           })
           return { label, ok }
        })

        const isOnlineTdcInBundle = tdcPart === 'online' || tdcPart.includes('otdc')
        const tdcLabel = isOnlineTdcInBundle ? 'TDC (Online)' : (tdcPart === 'f2f' ? 'TDC (Face-to-Face)' : 'TDC')
        setSlotAvailabilityDetail({ 
          tdc: { label: tdcLabel, ok: hasTdc }, 
          pdc: pdcResults.length > 0 ? pdcResults : [{ label: 'PDC', ok: true }] 
        })
        
        setHasAvailableSlots(isOnlineTdcInBundle || (hasTdc && (pdcResults.length === 0 || pdcResults.every(r => r.ok))))
        return
      }

      const isTDC = (category === 'TDC' || name.includes('tdc') || shortName.includes('tdc'))
      const slotType = isTDC ? 'TDC' : 'PDC'
      const slots = await schedulesAPI.getSlotsByDate(null, preSelectedBranch.id, slotType)
      const minDate = new Date(today)
      minDate.setDate(today.getDate() + (isTDC ? 1 : 2))
      const courseTypeMatches = buildCourseTypeChecker(selectedCourse.name, selectedCourse.shortName)
      const available = Array.isArray(slots) ? slots.filter(s => {
        const slotDate = new Date((s.date || s.start_date) + 'T00:00:00')
        if (slotDate < minDate) return false
        if (!isTDC && !courseTypeMatches(s.course_type)) return false
        if (!isTDC && courseType) {
          const tr = (s.transmission || '').toLowerCase()
          const cType = courseType.toLowerCase()
          if (cType.includes('automatic') || cType === 'at' || cType.includes('auto')) {
            if (tr && tr !== 'both' && tr !== 'any' && !tr.includes('auto') && tr !== 'at') return false
          } else if (cType.includes('manual') || cType === 'mt') {
            if (tr && tr !== 'both' && tr !== 'any' && !tr.includes('manual') && tr !== 'mt') return false
          }
        }
        return s.available_slots == null || s.available_slots > 0
      }) : []
      setHasAvailableSlots(available.length > 0)
    } catch (e) {
      setHasAvailableSlots(true) // fail open on error
    } finally {
      setAvailabilityLoading(false)
    }
  }, [selectedCourse, preSelectedBranch, courseType]);

  useEffect(() => {
    checkAvailability()
  }, [checkAvailability])

  const checkPromoAvailabilityListing = useCallback(async () => {
    if (!preSelectedBranch) {
      setPromoListingAvailability({});
      return;
    }
    const promoPackagesList = courses
      .filter(c => String(c.category || '').toLowerCase() === 'promo')
      .map(c => ({ id: c.id, typeOptions: (() => {
        const opts = [];
        if (c.course_type) opts.push({ value: c.course_type.toLowerCase().replace(/\s+/g, '-') });
        if (c.pricing_data) c.pricing_data.forEach(v => opts.push({ value: v.type.toLowerCase().replace(/\s+/g, '-') }));
        return opts;
      })() }));
    if (promoPackagesList.length === 0) return;

    const results = {};
    try {
      const allSlots = await schedulesAPI.getSlotsByDate(null, preSelectedBranch.id);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tdcMinDate = new Date(today); tdcMinDate.setDate(today.getDate() + 1);
      const pdcMinDate = new Date(today); pdcMinDate.setDate(today.getDate() + 2);
      
      for (const pkg of promoPackagesList) {
        const defaultTypeValue = (pkg.typeOptions?.[0]?.value || '').toLowerCase();
        const tdcPart = defaultTypeValue.includes('+') ? defaultTypeValue.split('+')[0].trim() : defaultTypeValue;
        const pdcPart = defaultTypeValue.includes('+') ? defaultTypeValue.split('+').slice(1).join('+').trim() : '';

        const isOnlineTdc = tdcPart.includes('online') || tdcPart.includes('otdc');
        const hasTdc = isOnlineTdc ? true : (Array.isArray(allSlots) && allSlots.some(s => {
          if (s.type?.toLowerCase() !== 'tdc') return false;
          const sd = new Date((s.date || s.start_date) + 'T00:00:00');
          if (sd < tdcMinDate) return false;
          return s.available_slots == null || s.available_slots > 0;
        }));

        const pdcPartsRaw = pdcPart.split('|').map(p => p.trim()).filter(Boolean);
        const pdcResults = pdcPartsRaw.map(p => {
           const pLower = p.toLowerCase();
           const isMoto = pLower.includes('motorcycle') || pLower.includes('motor') || pLower.includes('moto') || pLower.includes('bike');
           const isAT = pLower.includes('automatic') || pLower.includes('auto') || pLower.includes('at');
           const isMT = pLower.includes('manual') || pLower.includes('mt');
           const isTricycle = pLower.includes('tricycle') || pLower.includes('v1');
           const isB1B2 = pLower.includes('b1') || pLower.includes('b2') || pLower.includes('van') || pLower.includes('l300');
           
           return Array.isArray(allSlots) && allSlots.some(s => {
              if (s.type?.toLowerCase() !== 'pdc') return false;
              const sd = new Date((s.date || s.start_date) + 'T00:00:00');
              if (sd < pdcMinDate) return false;
              const ct = (s.course_type || '').toLowerCase();
              const tr = (s.transmission || '').toLowerCase();
              if (isAT && tr && tr !== 'both' && tr !== 'any' && !tr.includes('auto') && tr !== 'at') return false;
              if (isMT && tr && tr !== 'both' && tr !== 'any' && !tr.includes('manual') && tr !== 'mt') return false;
              if (!ct || ct === 'both' || ct === 'any' || ct === 'all') return s.available_slots == null || s.available_slots > 0;
              if (isTricycle) return ct.includes('tricycle');
              if (isB1B2) return ct.includes('b1') || ct.includes('b2') || ct.includes('van') || ct.includes('l300');
              if (isMoto) return ct.includes('motorcycle') || ct.includes('motor') || ct.includes('moto') || ct.includes('bike');
              return !ct.includes('motorcycle') && !ct.includes('motor') && !ct.includes('tricycle') && !ct.includes('b1') && !ct.includes('b2');
           });
        });

        const hasPdc = isOnlineTdc ? true : (pdcResults.length === 0 || pdcResults.every(ok => ok));
        const tdcLabel = isOnlineTdc ? 'TDC (Online)' : (tdcPart === 'f2f' ? 'TDC (Face-to-Face)' : 'TDC');
        const pdcLabel = pdcPart.includes('|') ? `${pdcPartsRaw.length} PDC Tracks` : (pdcPart.includes('motor') ? 'PDC Motorcycle' : 'PDC Car');
        results[pkg.id] = { loading: false, hasTdc, hasPdc, tdcLabel, pdcLabel };
      }
      setPromoListingAvailability(results);
    } catch (e) {
      promoPackagesList.forEach(pkg => { results[pkg.id] = { loading: false, hasTdc: true, hasPdc: true }; });
      setPromoListingAvailability(results);
    }
  }, [preSelectedBranch?.id, courses, isSelectedOnlineTdc]);

  useEffect(() => {
    checkPromoAvailabilityListing();
  }, [checkPromoAvailabilityListing]);

  // Handle Window Focus for Live Updates
  useEffect(() => {
    const handleFocus = async () => {
      // Re-fetch everything to ensure live updates
      try {
        const [coursesRes, branchesRes, addonsRes] = await Promise.all([
          coursesAPI.getAll(),
          branchesAPI.getAll(),
          coursesAPI.getAddonsConfig()
        ]);
        if (coursesRes.success) {
          const activeCourses = coursesRes.courses.filter(c => c.status === 'active');
          setCourses(activeCourses);
        }
        if (branchesRes.success) {
          setBranchContacts(branchesRes.branches);
        }
        if (addonsRes?.success && addonsRes.config) {
          setAddonsConfig(prev => ({ ...prev, ...addonsRes.config }));
        }
        // Re-check individual and listing availability
        await Promise.all([
          checkAvailability(),
          checkPromoAvailabilityListing()
        ]);
      } catch (err) {
        console.warn("Failed to background refresh live data:", err);
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [checkAvailability, checkPromoAvailabilityListing]);

  const handleViewCourse = (pkg) => {
    setSelectedCourse(pkg)
    setMainImage(pkg.image)
    // Set default course type based on available options
    if (pkg.typeOptions && pkg.typeOptions.length > 0) {
      setCourseType(pkg.typeOptions[0].value)
    } else {
      setCourseType('standard')
    }
    setQuantity(1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleBackToListing = () => {
    setSelectedCourse(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Filter and sort logic
  const getFilteredPackages = () => {
    let filtered = [...packages]

    // Apply price filter
    if (priceFilter !== 'all') {
      if (priceFilter === 'under-3000') {
        filtered = filtered.filter(pkg => pkg.price > 0 && pkg.price < 3000)
      } else if (priceFilter === '3000-4000') {
        filtered = filtered.filter(pkg => pkg.price >= 3000 && pkg.price < 4000)
      } else if (priceFilter === 'over-4000') {
        filtered = filtered.filter(pkg => pkg.price >= 4000)
      }
    }

    // Apply sorting
    if (sortBy === 'price-low-high') {
      filtered.sort((a, b) => a.price - b.price)
    } else if (sortBy === 'price-high-low') {
      filtered.sort((a, b) => b.price - a.price)
    } else if (sortBy === 'popular') {
      filtered.sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0))
    }

    return filtered
  }

  const filteredPackages = getFilteredPackages()
  
  const getCourseOrder = (pkg) => {
    const name = (pkg.name || '').toLowerCase();
    const category = (pkg.category || '').toLowerCase();
    if (category === 'tdc' || name.includes('theoretical')) return 1;
    if (name.includes('motorcycle')) return 2;
    if (name.includes('pdc') && name.includes('car')) return 3;
    if (name.includes('tricycle') || name.includes('a1')) return 4;
    if (name.includes('van') || name.includes('b1') || name.includes('b2') || name.includes('l300')) return 5;
    return 6;
  };

  const regularPackages = filteredPackages
    .filter(pkg => String(pkg.category || '').toLowerCase() !== 'promo')
    .sort((a, b) => getCourseOrder(a) - getCourseOrder(b));
  const promoBundlePackages = filteredPackages.filter(pkg => String(pkg.category || '').toLowerCase() === 'promo')

  const getPriceDisplay = (pkg, dash = ' - ') => {
    if (pkg.priceNote) return pkg.priceNote
    if (pkg.typeOptions && pkg.typeOptions.length > 0) {
      if (pkg.typeOptions.length === 1) return `₱${Number(pkg.typeOptions[0].price || 0).toLocaleString()}`
      const minPrice = Math.min(...pkg.typeOptions.map(o => Number(o.price || 0)))
      const maxPrice = Math.max(...pkg.typeOptions.map(o => Number(o.price || 0)))
      return minPrice === maxPrice
        ? `₱${minPrice.toLocaleString()}`
        : `₱${minPrice.toLocaleString()}${dash}₱${maxPrice.toLocaleString()}`
    }
    return `₱${Number(pkg.price || 0).toLocaleString()}`
  }

  const renderPromoSlotNote = (pkg) => {
    if (!preSelectedBranch) return null;
    const avail = promoListingAvailability[pkg.id];
    if (!avail) return null;
    if (avail.loading) return (
      <div className="text-[10px] text-gray-400 italic mt-1">Checking slot availability...</div>
    );
    const allOk = avail.hasTdc && avail.hasPdc;
    if (allOk) return null;
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 mt-1">
        <div className="flex items-start gap-1.5">
          <svg className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div>
            <p className="text-[10px] font-bold text-red-700 mb-0.5">No available slots at this branch:</p>
            <ul className="space-y-0.5">
              {avail.tdcLabel && (
                <li className={`text-[10px] flex items-center gap-1 ${avail.hasTdc ? 'text-green-700' : 'text-red-600 font-semibold'}`}>
                  <span>{avail.hasTdc ? '✓' : '✗'}</span>
                  <span>{avail.tdcLabel}{avail.hasTdc ? ' — Slots available' : ' — No slots available'}</span>
                </li>
              )}
              {avail.pdcLabel && (
                <li className={`text-[10px] flex items-center gap-1 ${avail.hasPdc ? 'text-green-700' : 'text-red-600 font-semibold'}`}>
                  <span>{avail.hasPdc ? '✓' : '✗'}</span>
                  <span>{avail.pdcLabel}{avail.hasPdc ? ' — Slots available' : ' — No slots available'}</span>
                </li>
              )}
              {!avail.tdcLabel && !avail.pdcLabel && (
                <li className="text-[10px] text-red-600">No upcoming slots found. Please check back later or contact the branch.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  const renderMobileCourseCards = (items) => (
    <div className="flex flex-col gap-4">
      {items.map((pkg) => {
        const isPromo = String(pkg.category || '').toLowerCase() === 'promo';
        const promoAvail = promoListingAvailability[pkg.id];
        const hasNoSlots = isPromo && preSelectedBranch && promoAvail && !promoAvail.loading && (!promoAvail.hasTdc || !promoAvail.hasPdc);
        return (
        <div
          key={pkg.id}
          className={`bg-white rounded-2xl shadow-md border border-gray-100 p-4 flex flex-col gap-3 active:scale-[0.99] transition-all ${pkg.popular ? 'border-l-4 border-l-[#F3B74C]' : ''} ${hasNoSlots ? 'border border-red-200' : ''}`}
        >
          <div className="flex items-start justify-between gap-2">
            <button
              className="text-left text-base font-bold text-[#2157da] hover:underline flex-1"
              onClick={() => handleViewCourse(pkg)}
            >
              {pkg.name}
              {String(pkg.category || '').toUpperCase() !== 'PROMO' && (String(pkg.category || '').toUpperCase() === 'TDC' || (pkg.name || '').toLowerCase().includes('tdc')) ? (
                <span className="text-[10px] text-gray-500 font-normal ml-2 block sm:inline">*REQUIRED FOR STUDENT PERMIT</span>
              ) : String(pkg.category || '').toUpperCase() !== 'PROMO' && (String(pkg.category || '').toUpperCase() === 'PDC' || (pkg.name || '').toLowerCase().includes('pdc')) ? (
                <span className="text-[10px] text-gray-500 font-normal ml-2 block sm:inline">*REQUIRED FOR DRIVERS LICENSE</span>
              ) : null}
            </button>
            {pkg.popular && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#F3B74C] text-[#2157da] shadow-sm whitespace-nowrap flex-shrink-0 mt-0.5">
                BEST SELLER
              </span>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <div className="flex items-center gap-1.5 text-gray-500 text-sm">
              <span>⏱</span>
              <span className="font-medium">{pkg.duration}</span>
            </div>
            <span className="text-[#2157da] font-black text-lg">{getPriceDisplay(pkg, ' – ')}</span>
          </div>
          <button
            onClick={() => handleViewCourse(pkg)}
            className={`w-full py-2.5 text-sm font-bold rounded-xl transition-all active:scale-95 ${pkg.popular ? 'bg-[#F3B74C] text-[#2157da] hover:bg-[#e1a63b]' : 'bg-[#2157da] text-white hover:bg-[#1a3a8a]'}`}
          >
            Select Course
          </button>
        </div>
        );
      })}
    </div>
  )

  const renderDesktopCourseTable = (items) => (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-[#2157da] text-white">
              <th className="py-4 px-6 font-semibold text-sm w-[45%]">Course Details</th>
              <th className="py-4 px-6 font-semibold text-sm text-center whitespace-nowrap w-[25%]">Duration</th>
              <th className="py-4 px-6 font-semibold text-sm text-right whitespace-nowrap w-[15%]">Price</th>
              <th className="py-4 px-6 font-semibold text-sm text-center w-[15%]">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map((pkg) => {
              const isPromo = String(pkg.category || '').toLowerCase() === 'promo';
              return (
              <tr
                key={pkg.id}
                className={`hover:bg-blue-50 transition-colors ${pkg.popular ? 'bg-orange-50/30' : ''}`}
              >
                <td className="py-4 px-6 align-middle">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3
                          className="text-sm sm:text-base font-bold text-[#2157da] cursor-pointer hover:underline"
                          onClick={() => handleViewCourse(pkg)}
                        >
                          {pkg.name}
                          {String(pkg.category || '').toUpperCase() !== 'PROMO' && (String(pkg.category || '').toUpperCase() === 'TDC' || (pkg.name || '').toLowerCase().includes('tdc')) ? (
                            <span className="text-[10px] text-gray-500 font-normal ml-2 italic">*REQUIRED FOR STUDENT PERMIT</span>
                          ) : String(pkg.category || '').toUpperCase() !== 'PROMO' && (String(pkg.category || '').toUpperCase() === 'PDC' || (pkg.name || '').toLowerCase().includes('pdc')) ? (
                            <span className="text-[10px] text-gray-500 font-normal ml-2 italic">*REQUIRED FOR DRIVERS LICENSE</span>
                          ) : null}
                        </h3>
                      {pkg.popular && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#F3B74C] text-[#2157da] shadow-sm whitespace-nowrap">
                          BEST SELLER
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600">
                      <ul className="flex gap-4 list-disc list-inside">
                        {pkg.features.slice(0, 2).map((feature, idx) => (
                          <li key={idx} className="truncate max-w-[200px] lg:max-w-xs" title={feature}>{feature}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-6 text-center text-sm font-medium text-gray-700 align-middle whitespace-nowrap">
                  {pkg.duration}
                </td>
                <td className="py-4 px-6 text-right font-black text-gray-800 text-base sm:text-lg align-middle whitespace-nowrap">
                  {getPriceDisplay(pkg)}
                </td>
                <td className="py-4 px-6 text-center align-middle">
                  <button
                    onClick={() => handleViewCourse(pkg)}
                    className={`inline-flex items-center justify-center px-6 py-2 border border-transparent text-sm font-bold rounded-md shadow-sm transition-all active:scale-95 whitespace-nowrap ${pkg.popular ? 'bg-[#F3B74C] text-[#2157da] hover:bg-[#e1a63b]' : 'bg-[#2157da] text-white hover:bg-[#1a3a8a]'}`}
                  >
                    Select
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  )

  let calcBasePrice = 0;
  if (selectedCourse) {
    const activeType = selectedCourse.typeOptions?.find(opt => opt.value === courseType);
    calcBasePrice = activeType?.price || parseFloat(selectedCourse.price) || 0;
  }

  // If a course is selected, show detail view
  if (selectedCourse) {
    return (
      <div className="py-12 sm:py-16 lg:py-20 bg-gray-50 min-h-[calc(100vh-4rem)] w-full font-primary">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          {/* Selected Branch Indicator */}
          {preSelectedBranch && (
            <div className="bg-gradient-to-r from-blue-50 to-blue-100/50 border-2 border-blue-300 rounded-2xl p-5 sm:p-6 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm" data-aos="fade-down">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#2157da] rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                  <span className="text-2xl">📍</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-[#2157da] uppercase tracking-wide mb-1">Enrolling at this branch</p>
                  <p className="text-base sm:text-lg font-bold text-gray-900 leading-tight">{formatBranchName(preSelectedBranch.name)}</p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('branches')}
                className="text-sm font-bold text-[#2157da] bg-white hover:bg-blue-50 px-5 py-2.5 rounded-xl border-2 border-[#2157da] transition-all hover:shadow-md active:scale-95 self-start sm:self-center"
              >
                Change Branch
              </button>
            </div>
          )}

          {/* Back to Listing */}
          <button
            onClick={handleBackToListing}
            className="flex items-center text-gray-700 hover:text-[#2157da] mb-8 font-medium"
            data-aos="fade-right"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            BACK TO LISTING
          </button>

          {/* Course Detail */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12" data-aos="fade-up">
            {/* Course Image */}
            <div className="relative">
              <div className="w-full aspect-square bg-gradient-to-br from-[#2157da] to-[#1a3a8a] rounded-lg overflow-hidden relative border border-gray-200 shadow-sm">
                {mainImage ? (
                  <img
                    src={mainImage}
                    alt={selectedCourse.name}
                    className="w-full h-full object-contain bg-white"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                ) : null}
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#2157da] to-[#1a3a8a] text-white" style={{ display: mainImage ? 'none' : 'flex' }}>
                  <div className="text-center">
                    <svg className="w-24 h-24 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <p className="text-xl font-bold">{selectedCourse.shortName}</p>
                  </div>
                </div>
              </div>

              {/* Thumbnail Images */}
              {selectedCourse.allImages && selectedCourse.allImages.length > 1 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {selectedCourse.allImages.map((img, i) => (
                    <div
                      key={i}
                      className={`w-20 h-20 bg-white rounded-md overflow-hidden cursor-pointer border-2 transition-all shadow-sm ${mainImage === img ? 'border-[#2157da] scale-105' : 'border-transparent hover:border-gray-300'}`}
                      onClick={() => setMainImage(img)}
                    >
                      <img src={img} alt={`${selectedCourse.name} thumbnail ${i + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Course Details & Breakdown */}
            <div className="text-left">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                {selectedCourse.brand || 'MASTER DRIVING SCHOOL PH'}
              </p>
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <h1 className="text-2xl sm:text-3xl font-black text-[#2157da]">
                  {selectedCourse.name}
                  {selectedCourse.category !== 'PROMO' && (selectedCourse.category === 'TDC' || (selectedCourse.name || '').toLowerCase().includes('tdc') || (selectedCourse.shortName || '').toLowerCase().includes('tdc')) ? (
                    <span className="text-xs sm:text-sm text-gray-500 font-normal ml-3">*REQUIRED FOR STUDENT PERMIT</span>
                  ) : selectedCourse.category !== 'PROMO' && (selectedCourse.category === 'PDC' || (selectedCourse.name || '').toLowerCase().includes('pdc')) ? (
                    <span className="text-xs sm:text-sm text-gray-500 font-normal ml-3">*REQUIRED FOR DRIVERS LICENSE</span>
                  ) : null}
                </h1>
              </div>

              {/* Top Breakdown List */}
              <div className="space-y-3.5 text-[0.95rem] text-gray-600 font-medium mb-8">
                <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                  <span>Course Price</span>
                  <span className="font-bold text-gray-900">
                    ₱{(calcBasePrice * quantity).toLocaleString()}
                  </span>
                </div>

                {((selectedAddons.reviewer ? parseFloat(addonsConfig.reviewer || 30) : 0) + (selectedAddons.vehicleTips ? parseFloat(addonsConfig.vehicleTips || 20) : 0) + (addonsConfig.customAddons || []).reduce((sum, addon) => sum + (selectedAddons[addon.id] ? parseFloat(addon.price || 0) : 0), 0)) > 0 && (
                  <div className="flex justify-between items-center py-0.5">
                    <span>Add-ons</span>
                    <span className="font-bold text-gray-900">₱{(((selectedAddons.reviewer ? parseFloat(addonsConfig.reviewer || 30) : 0) + (selectedAddons.vehicleTips ? parseFloat(addonsConfig.vehicleTips || 20) : 0) + (addonsConfig.customAddons || []).reduce((sum, addon) => sum + (selectedAddons[addon.id] ? parseFloat(addon.price || 0) : 0), 0)) * quantity).toLocaleString()}</span>
                  </div>
                )}

                <div className="flex justify-between items-center py-0.5">
                  <span>Convenience Fee</span>
                  <span className="font-bold text-gray-900">₱{(parseFloat(addonsConfig.convenienceFee || 25) * quantity).toLocaleString()}</span>
                </div>



                <div className="flex justify-between items-center pt-5 mt-4 border-t border-gray-100">
                  <span className="text-lg font-black text-[#1a2332]">Total Amount</span>
                  <span className="text-3xl font-black text-[#2157da]">
                    ₱{((
                      calcBasePrice +
                      (selectedAddons.reviewer ? parseFloat(addonsConfig.reviewer || 30) : 0) +
                      (selectedAddons.vehicleTips ? parseFloat(addonsConfig.vehicleTips || 20) : 0) +
                      (addonsConfig.customAddons || []).reduce((sum, addon) => sum + (selectedAddons[addon.id] ? parseFloat(addon.price || 0) : 0), 0) +
                      parseFloat(addonsConfig.convenienceFee || 25)
                    ) * quantity).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Type Selection */}
              {selectedCourse.hasTypeOption && selectedCourse.typeOptions && selectedCourse.typeOptions.length > 0 && (
                <div className="mb-6">
                  <label className="block text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider text-left">
                    TYPE
                  </label>
                  <div className="flex gap-2">
                    {selectedCourse.typeOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setCourseType(option.value)}
                        className={`px-5 py-2 text-sm font-medium transition-all ${courseType === option.value
                          ? 'bg-[#2157da] text-white rounded-full'
                          : 'bg-transparent text-gray-700 border border-gray-300 rounded-full hover:border-[#2157da]'
                          }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div className="mb-6 hidden">
                <label className="block text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider text-left">
                  QUANTITY
                </label>
                <div className="flex items-center gap-0 w-fit border border-gray-300 rounded-md overflow-hidden opacity-50 cursor-not-allowed">
                  <input
                    type="text"
                    value={1}
                    readOnly
                    className="w-12 h-10 text-center font-medium text-gray-800 bg-gray-100 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Available Add-ons check boxes */}
              <div className="mb-8">
                <label className="block text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider text-left">
                  AVAILABLE ADD-ONS
                </label>
                <div className="space-y-3">
                  {/* Reviewer Option */}
                  <label className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-colors ${selectedAddons.reviewer ? 'border-[#2157da] bg-blue-50/10' : 'border-gray-200 hover:border-blue-300'}`}>
                    <div className="flex items-center gap-4">
                      <input 
                        type="checkbox" 
                        checked={selectedAddons.reviewer} 
                        onChange={(e) => setSelectedAddons({...selectedAddons, reviewer: e.target.checked})} 
                        className="w-5 h-5 text-[#2157da] rounded border-gray-300 focus:ring-[#2157da]" 
                      />
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                        <div>
                          <p className="font-bold text-[#1a2332]">Driving School Reviewer</p>
                          <p className="text-[11px] text-gray-500">Comprehensive study guide for your theoretical exam</p>
                        </div>
                      </div>
                    </div>
                    <span className="font-bold text-[#2157da]">₱{(parseFloat(addonsConfig.reviewer || 30) * quantity).toLocaleString()}</span>
                  </label>

                  {/* Vehicle Tips Option */}
                  <label className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-colors ${selectedAddons.vehicleTips ? 'border-[#2157da] bg-blue-50/10' : 'border-gray-200 hover:border-blue-300'}`}>
                    <div className="flex items-center gap-4">
                      <input 
                        type="checkbox" 
                        checked={selectedAddons.vehicleTips} 
                        onChange={(e) => setSelectedAddons({...selectedAddons, vehicleTips: e.target.checked})} 
                        className="w-5 h-5 text-[#2157da] rounded border-gray-300 focus:ring-[#2157da]" 
                      />
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>
                        <div>
                          <p className="font-bold text-[#1a2332]">Vehicle Tips</p>
                          <p className="text-[11px] text-gray-500">Essential guide for practical driving preparation</p>
                        </div>
                      </div>
                    </div>
                    <span className="font-bold text-[#2157da]">₱{(parseFloat(addonsConfig.vehicleTips || 20) * quantity).toLocaleString()}</span>
                  </label>

                  {/* Custom Add-ons */}
                  {(addonsConfig.customAddons || []).map(addon => (
                  <label key={addon.id} className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-colors ${selectedAddons[addon.id] ? 'border-[#2157da] bg-blue-50/10' : 'border-gray-200 hover:border-blue-300'}`}>
                    <div className="flex items-center gap-4">
                      <input 
                        type="checkbox" 
                        checked={!!selectedAddons[addon.id]} 
                        onChange={(e) => setSelectedAddons({...selectedAddons, [addon.id]: e.target.checked})} 
                        className="w-5 h-5 text-[#2157da] rounded border-gray-300 focus:ring-[#2157da]" 
                      />
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        <div>
                          <p className="font-bold text-[#1a2332]">{addon.name || 'Additional Add-on'}</p>
                          {addon.fileName && <p className="text-[11px] text-[#2157da] flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg> Includes document</p>}
                        </div>
                      </div>
                    </div>
                    <span className="font-bold text-[#2157da]">₱{(parseFloat(addon.price || 0) * quantity).toLocaleString()}</span>
                  </label>
                  ))}
                </div>
              </div>

              {/* Online TDC Informational Note */}
              {isSelectedOnlineTdc() && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5 mb-8 shadow-sm" data-aos="zoom-in">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                      <p className="font-bold text-[#1e40af] text-sm mb-1 uppercase tracking-tight">Online TDC Selected</p>
                      <p className="text-[#1e3a8a] text-[0.8rem] font-medium leading-relaxed">
                        No branch slot selection is required for Online TDC. You can proceed directly to enrollment.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3 mb-8 relative">
                <button
                  onClick={() => {
                    addToCart(selectedCourse, quantity, courseType)
                    showNotification('Added to cart successfully!', 'success')
                  }}
                  className="w-full py-3 rounded-md font-bold transition-all text-sm uppercase bg-white border-2 border-[#2157da] text-[#2157da] hover:bg-blue-50"
                >
                  ADD TO CART
                </button>
                <button
                  onClick={handleEnrollNow}
                  disabled={availabilityLoading || (!hasAvailableSlots && !!preSelectedBranch)}
                  className={`w-full py-3 rounded-md font-bold transition-all text-sm uppercase ${
                    availabilityLoading
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : !hasAvailableSlots && preSelectedBranch
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : preSelectedBranch
                          ? 'bg-[#F3B74C] text-gray-800 hover:bg-[#e1a63b]'
                          : 'bg-[#2157da] text-white hover:bg-[#1a3a8a]'
                  }`}
                >
                  {availabilityLoading
                    ? 'Checking availability...'
                    : !hasAvailableSlots && preSelectedBranch
                      ? 'No Available Slots'
                      : preSelectedBranch
                        ? (isSelectedOnlineTdc() ? 'PROCEED TO PAYMENT' : 'ENROLL NOW')
                        : 'SELECT BRANCH TO ENROLL'}
                </button>

                {/* Slot availability detail note — shown when a course has no slots */}
                {!availabilityLoading && !hasAvailableSlots && preSelectedBranch && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-1">
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                      <div>
                        <p className="text-xs font-bold text-red-700 mb-1">No available slots at this branch:</p>
                        {slotAvailabilityDetail ? (
                          <ul className="space-y-0.5">
                            {/* Render TDC status */}
                            {slotAvailabilityDetail.tdc && (
                              <li className={`text-xs flex items-center gap-1.5 ${slotAvailabilityDetail.tdc.ok ? 'text-green-700' : 'text-red-600 font-semibold'}`}>
                                <span>{slotAvailabilityDetail.tdc.ok ? '✓' : '✗'}</span>
                                <span>{slotAvailabilityDetail.tdc.label}{slotAvailabilityDetail.tdc.ok ? ' — Slots available' : ' — No slots available'}</span>
                              </li>
                            )}
                            
                            {/* Render PDC statuses (could be multiple for bundles) */}
                            {Array.isArray(slotAvailabilityDetail.pdc) ? (
                              slotAvailabilityDetail.pdc.map((track, idx) => (
                                <li key={idx} className={`text-xs flex items-center gap-1.5 ${track.ok ? 'text-green-700' : 'text-red-600 font-semibold'}`}>
                                  <span>{track.ok ? '✓' : '✗'}</span>
                                  <span>{track.label}{track.ok ? ' — Slots available' : ' — No slots available'}</span>
                                </li>
                              ))
                            ) : (
                              slotAvailabilityDetail.pdcLabel && (
                                <li className={`text-xs flex items-center gap-1.5 ${slotAvailabilityDetail.hasPdc ? 'text-green-700' : 'text-red-600 font-semibold'}`}>
                                  <span>{slotAvailabilityDetail.hasPdc ? '✓' : '✗'}</span>
                                  <span>{slotAvailabilityDetail.pdcLabel}{slotAvailabilityDetail.hasPdc ? ' — Slots available' : ' — No slots available'}</span>
                                </li>
                              )
                            )}
                          </ul>
                        ) : (
                          <p className="text-xs text-red-600">No upcoming slots found. Please check back later or contact the branch.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Course Information */}
              <div className="space-y-4 text-sm leading-relaxed">
                <p className="text-gray-700">{selectedCourse.description}</p>
                <p className="text-gray-600">{selectedCourse.contact}</p>

                {/* A1 Tricycle Notice */}
                {selectedCourse && (selectedCourse.name.toLowerCase().includes('a1') || selectedCourse.name.toLowerCase().includes('tricycle')) && (
                  <div className="bg-blue-50 border-l-4 border-[#2157da] p-4 my-4 rounded-r-md">
                    <p className="text-[#2157da] font-medium text-sm">
                      <span className="font-bold mr-1">Note:</span>
                      For Practical Driving Course (PDC) - A1 TRICYCLE, students are required to rent their own Tricycle for the course instead of using the school's vehicle because we only have one unit for all branches.
                    </p>
                  </div>
                )}

                <p className="text-gray-600">
                  Please be reminded that upon checking out <span className="text-red-600 font-semibold">you agree to our company terms and conditions.</span> To check the available schedule for walk in you may call the numbers below:
                </p>
              </div>

              {/* Contact Numbers */}
              <div className="mt-10 mb-8">
                <h3 className="text-sm font-bold text-gray-800 mb-6 uppercase tracking-wider text-center">CONTACT NUMBERS:</h3>
                <div className="flex justify-center">
                  <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-4 max-w-md w-full">
                    {branchContacts.map((branch, idx) => (
                      <div key={idx} className="contents text-[13px] sm:text-sm">
                        <span className="font-bold text-gray-900 text-right">{formatBranchName(branch.name)}:</span>
                        <span className="font-mono text-[#2157da] font-medium text-left tracking-wide">{branch.contact_number}</span>
                      </div>
                    ))}
                    {branchContacts.length === 0 && (
                      <div className="col-span-2 text-sm text-gray-500 italic text-center">No contact numbers available at this time.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Default listing view
  return (
    <div className="py-12 sm:py-16 lg:py-20 bg-gray-50 min-h-[calc(100vh-4rem)] w-full">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#2157da] mb-3"
            data-aos="fade-down"
          >
            ALL COURSES
          </h1>
          <p
            className="text-sm sm:text-base text-gray-600"
            data-aos="fade-down"
            data-aos-delay="100"
          >
            Choose your courses and add them to cart
          </p>

          {/* Selected Branch Indicator */}
          {preSelectedBranch && (
            <div className="max-w-md mx-auto bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mt-6 flex items-center justify-between gap-3 shadow-sm" data-aos="fade-up" data-aos-delay="200">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 bg-[#2157da] rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">📍</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-[#2157da] uppercase tracking-wide">Branch</p>
                  <p className="text-xs font-bold text-gray-900 truncate">{formatBranchName(preSelectedBranch.name)}</p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('branches')}
                className="text-xs font-bold text-[#2157da] hover:underline flex-shrink-0"
              >
                Change
              </button>
            </div>
          )}
        </div>

        {/* Filter and Sort Section */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white p-4 rounded-lg shadow" data-aos="fade-up">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Price Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Price:</label>
              <select
                value={priceFilter}
                onChange={(e) => setPriceFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2157da]"
              >
                <option value="all">All Prices</option>
                <option value="under-3000">Under ₱3,000</option>
                <option value="3000-4000">₱3,000 - ₱4,000</option>
                <option value="over-4000">Over ₱4,000</option>
              </select>
            </div>

            {/* Product Count */}
            <div className="text-sm text-gray-600">
              {filteredPackages.length} {filteredPackages.length === 1 ? 'product' : 'products'}
            </div>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2157da]"
            >
              <option value="best-selling">Best selling</option>
              <option value="popular">Popular</option>
              <option value="price-low-high">Price: Low to High</option>
              <option value="price-high-low">Price: High to Low</option>
            </select>
          </div>
        </div>

        {/* Course Products */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2157da]"></div>
          </div>
        ) : filteredPackages.length === 0 ? (
          <div className="text-center py-20">
            <h3 className="text-xl font-bold text-gray-700">No courses available at the moment.</h3>
            <p className="text-gray-500 mt-2">Please check back later.</p>
          </div>
        ) : (
        <div className="space-y-8">
          {isMobileScreen ? (
            <>
              {regularPackages.length > 0 && (
                <div>
                  <h2 className="text-lg font-black text-[#1a3a8a] mb-3">Regular Courses</h2>
                  {renderMobileCourseCards(regularPackages)}
                </div>
              )}

              {promoBundlePackages.length > 0 && (
                <div>
                  <h2 className="text-lg font-black text-[#7c2d12] mb-3">Promo Bundle Package</h2>
                  {renderMobileCourseCards(promoBundlePackages)}
                </div>
              )}
            </>
          ) : (
            <>
              {regularPackages.length > 0 && (
                <section>
                  <h2 className="text-xl font-black text-[#1a3a8a] mb-3">Regular Courses</h2>
                  {renderDesktopCourseTable(regularPackages)}
                </section>
              )}

              {promoBundlePackages.length > 0 && (
                <section>
                  <h2 className="text-xl font-black text-[#7c2d12] mb-3">Promo Bundle Package</h2>
                  {renderDesktopCourseTable(promoBundlePackages)}
                </section>
              )}
            </>
          )}
        </div>
        )}
      </div>
    </div>
  )
}

export default Courses

