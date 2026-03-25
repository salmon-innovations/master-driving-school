import React, { useState, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';
import { branchesAPI, coursesAPI, schedulesAPI, adminAPI } from '../services/api';
import './css/walkInEnrollment.css';
import { getZipFromAddress } from '../utils/philippineZipCodes';

const logo = '/images/logo.png';

const CONVENIENCE_FEE = 25;
const DEFAULT_ADDONS = [
    { id: 'addon-reviewer', name: 'Driving School Reviewer', price: 30, icon: '📖' },
    { id: 'addon-tips', name: 'Vehicle Maintenance Tips', price: 20, icon: '🔧' }
];

// getZipFromAddress handles zip lookup — imported from '../utils/philippineZipCodes'
// For branch auto-fill, reuse getZipFromAddress since branch names
// (e.g. 'Manila', 'Antipolo') are included in the comprehensive city map.
const getZipForBranch = (name) => getZipFromAddress(name);

const formatLocalDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const getMinSchedDate = (daysAhead = 2) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + daysAhead);
    return formatLocalDate(d);
};


const WalkInEnrollment = ({ onEnroll, adminProfile }) => {
    const { showNotification } = useNotification();
    const [step, setStep] = useState(() => {
        try { return parseInt(sessionStorage.getItem('walkin_step') || '1', 10) || 1; } catch { return 1; }
    });
    const [loading, setLoading] = useState(false);
    const [branches, setBranches] = useState([]);

    // Format branch name - remove company prefixes for cleaner display
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
    const [courses, setCourses] = useState([]);

    // Schedule selection state
    const [scheduleSlots, setScheduleSlots] = useState([]);
    const [selectedScheduleDate, setSelectedScheduleDate] = useState('');
    const [viewDate, setViewDate] = useState(new Date());
    const [loadingSchedule, setLoadingSchedule] = useState(false);
    const today = formatLocalDate(new Date());
    const [formErrors, setFormErrors] = useState({});
    const [pdcSessionFilter, setPdcSessionFilter] = useState('All');
    const [tdcTypeFilter, setTdcTypeFilter] = useState('All');

    // All PDC slots for calendar display (loaded upfront, used to show slot pills on calendar days)
    const [pdcAllSlots, setPdcAllSlots] = useState([]);
    // Pre-filtered PDC slots for the calendar — only slots matching the selected course type & transmission
    const [pdcCalendarSlots, setPdcCalendarSlots] = useState([]);

    // Course availability check for Step 2
    const [courseAvailability, setCourseAvailability] = useState({});
    const [checkingCourseAvail, setCheckingCourseAvail] = useState(false);

    // Type availability check for Step 3
    const [typeAvailability, setTypeAvailability] = useState({});
    const [checkingTypeAvail, setCheckingTypeAvail] = useState(false);

    const [promoStep, setPromoStep] = useState(1);
    const [promoTdcViewDate, setPromoTdcViewDate] = useState(new Date());
    const [promoTdcRawSlots, setPromoTdcRawSlots] = useState([]);
    const [loadingPromoTdc, setLoadingPromoTdc] = useState(false);
    const [promoPdcCalMonth, setPromoPdcCalMonth] = useState(new Date());
    const [promoPdcDate, setPromoPdcDate] = useState(null);
    const [promoPdcRawSlots, setPromoPdcRawSlots] = useState([]);
    const [loadingPromoPdc, setLoadingPromoPdc] = useState(false);
    const [promoPdcSelectingDay2, setPromoPdcSelectingDay2] = useState(false);
    const [promoPdcDay2CalMonth, setPromoPdcDay2CalMonth] = useState(new Date());
    const [promoPdcDate2, setPromoPdcDate2] = useState(null);
    const [promoPdcRawSlots2, setPromoPdcRawSlots2] = useState([]);
    const [loadingPromoPdc2, setLoadingPromoPdc2] = useState(false);
    const [promoPdcMotorType, setPromoPdcMotorType] = useState(null);

    const defaultFormData = {
        firstName: '', middleName: '', lastName: '', age: '', gender: '', birthday: '', nationality: '', maritalStatus: '',
        address: '', zipCode: '', birthPlace: '', contactNumbers: '', email: '', emergencyContactPerson: '', emergencyContactNumber: '',
        course: null, courseType: '', branchId: '', branchName: '',
        scheduleDate: '', scheduleSlotId: null, scheduleSession: '', scheduleTime: '',
        scheduleDate2: '', scheduleSlotId2: null, scheduleSession2: '', scheduleTime2: '',
        promoPdcSlotId2: null, promoPdcDate2: '', promoPdcSession2: '', promoPdcTime2: '',
        paymentMethod: 'Cash', amountPaid: '', paymentStatus: 'Full Payment', transactionNo: '',
        addons: []
    };

    const [formData, setFormData] = useState(() => {
        try {
            const saved = sessionStorage.getItem('walkin_formData');
            return saved ? { ...defaultFormData, ...JSON.parse(saved) } : defaultFormData;
        } catch { return defaultFormData; }
    });

    // Transform database courses to match UI structure
    const packages = courses.map(course => {
        // Resolve the effective price for the currently selected branch.
        // If a branch is selected and the course has a custom price for that branch, use it.
        // Otherwise fall back to the course default price.
        const defaultPrice = parseFloat(course.price) || 0;
        const branchEffectivePrice = (() => {
            if (!formData.branchId || !Array.isArray(course.branch_prices)) return defaultPrice;
            const bp = course.branch_prices.find(b => String(b.branch_id) === String(formData.branchId));
            if (bp && bp.price > 0 && parseFloat(bp.price) !== defaultPrice) return parseFloat(bp.price);
            return defaultPrice;
        })();

        // Build type options array
        const typeOptions = [];

        const discount = parseFloat(course.discount) || 0;

        // Price enforcement logic to match requested rates
        const getEnforcedPrice = (name, type, dbPrice) => {
            const n = (name || '').toLowerCase();
            const t = (type || '').toLowerCase();
            if (n.includes('tdc')) {
                if (t.includes('online')) return 1200;
                return 800; // Face-to-Face
            }
            if (n.includes('van') || n.includes('l300')) return 5000;
            if (n.includes('car')) return 4000;
            if (n.includes('motorcycle')) return 2500;
            if (n.includes('tricycle')) return 2500;
            return dbPrice;
        };

        const enforcedBasePrice = getEnforcedPrice(course.name, course.course_type, branchEffectivePrice);

        // Add main course type with its price (branch-adjusted)
        if (course.course_type) {
            typeOptions.push({
                value: course.course_type.toLowerCase().replace(/\s+/g, '-'),
                label: course.course_type.toUpperCase(),
                price: enforcedBasePrice - discount,
                originalPrice: enforcedBasePrice,
                discount: discount
            });
        }

        // Add pricing variations as additional type options
        if (course.pricing_data && Array.isArray(course.pricing_data)) {
            course.pricing_data.forEach(variation => {
                const varPrice = parseFloat(variation.price) || 0;
                const enforcedVarPrice = getEnforcedPrice(course.name, variation.type, varPrice);
                typeOptions.push({
                    value: variation.type.toLowerCase().replace(/\s+/g, '-'),
                    label: variation.type.toUpperCase(),
                    price: enforcedVarPrice - discount,
                    originalPrice: enforcedVarPrice,
                    discount: discount
                });
            });
        }

        // If no type options, create a default one
        if (typeOptions.length === 0) {
            typeOptions.push({
                value: 'standard',
                label: 'STANDARD',
                price: enforcedBasePrice - discount,
                originalPrice: enforcedBasePrice,
                discount: discount
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
            image: courseImages.length > 0 ? courseImages[0] : '/images/default-course.jpg',
            features: features,
            hasTypeOption: true,
            typeOptions: typeOptions,
            category: course.category || 'Basic',
            price: enforcedBasePrice - discount,
            originalPrice: enforcedBasePrice,
            course_type: course.course_type || '',
            description: course.description || 'Professional driving course with comprehensive training'
        };
    });

    // Persist step and formData to sessionStorage on every change
    useEffect(() => {
        try { sessionStorage.setItem('walkin_step', String(step)); } catch { }
    }, [step]);

    useEffect(() => {
        try { sessionStorage.setItem('walkin_formData', JSON.stringify(formData)); } catch { }
    }, [formData]);

    // Lifecycle: keep state during SPA navigation (sidebar click)
    // Only clear if the user explicitly refreshes or closes the tab if desired, 
    // but the user wants it to stay when clicking sidebar.
    useEffect(() => {
        // We no longer clear the state on unmount.
        // This ensures that navigating to other admin pages and back preserves progress.
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch branches
                const branchResponse = await branchesAPI.getAll();
                if (branchResponse.success) {
                    setBranches(branchResponse.branches);

                    // Staff: auto-select their assigned branch (locked)
                    // Admin: default to first branch but can change
                    if (adminProfile?.rawRole === 'staff' && adminProfile?.branchId) {
                        const userBranch = branchResponse.branches.find(b => b.id === adminProfile.branchId);
                        if (userBranch) {
                            setFormData(prev => {
                                if (prev.branchId) return prev; // Keep existing saved branch
                                return {
                                    ...prev,
                                    branchId: String(userBranch.id),
                                    branchName: userBranch.name,
                                    zipCode: prev.zipCode || getZipForBranch(userBranch.name)
                                };
                            });
                        }
                    } else if (branchResponse.branches.length > 0) {
                        setFormData(prev => {
                            if (prev.branchId) return prev; // Keep existing saved branch
                            return {
                                ...prev,
                                branchId: String(branchResponse.branches[0].id),
                                branchName: branchResponse.branches[0].name,
                                zipCode: prev.zipCode || getZipForBranch(branchResponse.branches[0].name)
                            };
                        });
                    }
                }

                // Fetch courses
                const coursesResponse = await coursesAPI.getAll();
                if (coursesResponse.success) {
                    // Only show active courses
                    const activeCourses = coursesResponse.courses.filter(c => c.status === 'active');
                    console.log('Fetched active courses:', activeCourses);
                    setCourses(activeCourses);
                } else {
                    console.error('Failed to fetch courses:', coursesResponse);
                }
            } catch (err) {
                console.error('Error fetching data:', err);
                showNotification('Failed to load courses and branches', 'error');
            } finally {
                setLoading(false);
            }
        };
        setLoading(true);
        fetchData();
    }, [adminProfile]);

    // Load schedule slots when date is selected OR all upcoming for TDC
    useEffect(() => {
        if (step !== 3) return;
        if (formData.course?.category === 'Promo') return; // Promo has its own fetch logic

        const loadScheduleSlots = async () => {
            try {
                setLoadingSchedule(true);
                let slots = [];

                const isTDC = formData.course?.category === 'TDC';

                if (isTDC) {
                    // Fetch all upcoming TDC slots without requiring a date
                    slots = await schedulesAPI.getSlotsByDate(null, formData.branchId, 'TDC');
                } else {
                    // PDC requires a specific date selected on the calendar
                    if (!selectedScheduleDate) {
                        setScheduleSlots([]);
                        setLoadingSchedule(false);
                        return;
                    }
                    slots = await schedulesAPI.getSlotsByDate(selectedScheduleDate, formData.branchId, 'PDC');
                }

                // Transform and filter available slots
                const transformedSlots = slots.map(slot => {
                    const formatDateSafe = (d) => {
                        if (!d) return d;
                        if (typeof d === 'string') return d.split('T')[0];
                        const date = new Date(d);
                        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                    };

                    const startDate = formatDateSafe(slot.date);
                    const endDate = slot.end_date ? formatDateSafe(slot.end_date) : startDate;

                    return {
                        ...slot,
                        date: startDate,
                        end_date: endDate,
                        session: `${slot.session} ${slot.type.toUpperCase()}`,
                        students: slot.enrollments || []
                    };
                }).filter(slot => slot); // Keep all slots to show 'FULL' status in calendar

                setScheduleSlots(transformedSlots);
            } catch (err) {
                console.error('Error loading schedule slots:', err);
                showNotification('Failed to load schedule slots', 'error');
            } finally {
                setLoadingSchedule(false);
            }
        };

        loadScheduleSlots();
    }, [selectedScheduleDate, step, formData.course?.category, formData.branchId]);

    // Helper to transform raw slots from API
    const transformSlots = (slots) => slots.map(slot => {
        const fmt = (d) => {
            if (!d) return d;
            if (typeof d === 'string') return d.split('T')[0];
            const dt = new Date(d);
            return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        };
        const startDate = fmt(slot.date);
        const endDate = slot.end_date ? fmt(slot.end_date) : startDate;
        return { ...slot, date: startDate, end_date: endDate, session: `${slot.session} ${slot.type.toUpperCase()}`, students: slot.enrollments || [] };
    }); // removed .filter(available_slots > 0) to allow showing FULL in calendar

    const isTDC = formData.course?.category === 'TDC';
    const isPromo = formData.course?.category === 'Promo';
    const promoTdcType = isPromo ? (formData.course?.course_type?.split('+')[0] || 'F2F') : null;
    const promoPdcType = isPromo ? (formData.course?.course_type?.split('+')[1] || 'Motorcycle') : null;

    // Promo: fetch TDC slots when entering step 3
    useEffect(() => {
        if (step !== 3 || !isPromo) return;
        setLoadingPromoTdc(true);
        schedulesAPI.getSlotsByDate(null, formData.branchId, 'TDC')
            .then(slots => setPromoTdcRawSlots(transformSlots(slots)))
            .catch(err => { console.error(err); showNotification('Failed to load TDC slots', 'error'); })
            .finally(() => setLoadingPromoTdc(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, isPromo, formData.branchId]);

    // Promo TDC: auto-advance view to first available month
    useEffect(() => {
        if (!isPromo || promoTdcRawSlots.length === 0) return;
        const months = [...new Set(promoTdcRawSlots.map(s => {
            const d = new Date(s.date + 'T00:00:00');
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }))].sort();
        if (months.length > 0) {
            const [y, m] = months[0].split('-').map(Number);
            setPromoTdcViewDate(new Date(y, m - 1, 1));
        }
    }, [promoTdcRawSlots, isPromo]);

    // Promo: fetch PDC Day 1 slots when date selected
    useEffect(() => {
        if (!promoPdcDate || !isPromo) return;
        const dateStr = `${promoPdcDate.getFullYear()}-${String(promoPdcDate.getMonth() + 1).padStart(2, '0')}-${String(promoPdcDate.getDate()).padStart(2, '0')}`;
        setLoadingPromoPdc(true);
        schedulesAPI.getSlotsByDate(dateStr, formData.branchId, 'PDC')
            .then(slots => setPromoPdcRawSlots(transformSlots(slots)))
            .catch(err => { console.error(err); showNotification('Failed to load PDC slots', 'error'); })
            .finally(() => setLoadingPromoPdc(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [promoPdcDate, isPromo, formData.branchId]);

    // Promo: fetch PDC Day 2 slots when date selected
    useEffect(() => {
        if (!promoPdcDate2 || !isPromo) return;
        const dateStr = `${promoPdcDate2.getFullYear()}-${String(promoPdcDate2.getMonth() + 1).padStart(2, '0')}-${String(promoPdcDate2.getDate()).padStart(2, '0')}`;
        setLoadingPromoPdc2(true);
        schedulesAPI.getSlotsByDate(dateStr, formData.branchId, 'PDC')
            .then(slots => setPromoPdcRawSlots2(transformSlots(slots)))
            .catch(err => { console.error(err); showNotification('Failed to load PDC Day 2 slots', 'error'); })
            .finally(() => setLoadingPromoPdc2(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [promoPdcDate2, isPromo, formData.branchId]);

    // PDC (regular + promo): fetch ALL upcoming PDC slots for calendar slot indicators
    useEffect(() => {
        if (step !== 3) return;
        const cat = formData.course?.category;
        if (cat !== 'PDC' && cat !== 'Promo') return;
        schedulesAPI.getSlotsByDate(null, formData.branchId, 'PDC')
            .then(slots => setPdcAllSlots(transformSlots(slots)))
            .catch(err => console.error('Error loading PDC calendar slots:', err));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, formData.course?.category, formData.branchId]);

    // Compute calendar-display slots whenever the raw list, selected course, or selected type changes
    useEffect(() => {
        if (!formData.course || formData.course.category !== 'PDC') {
            setPdcCalendarSlots([]);
            return;
        }
        const courseTypeVal = (formData.courseType || '').toLowerCase();
        const courseName = (formData.course.name || '').toLowerCase();
        const isMoto = courseName.includes('motorcycle');
        const isTricycle = courseName.includes('tricycle');
        const isB1B2 = courseName.includes('b1') || courseName.includes('b2') ||
            courseName.includes('van') || courseName.includes('l300');
        // Determine target transmission — applies to ALL vehicle types (motorcycle, car, etc.)
        const wantsAT = courseTypeVal.includes('automatic') || courseTypeVal === 'carat';
        const wantsMT = !wantsAT && (courseTypeVal.includes('manual') || courseTypeVal === 'carmt');
        const filtered = pdcAllSlots.filter(s => {
            const ct = (s.course_type || '').toLowerCase();
            const tx = (s.transmission || '').toLowerCase();
            // Do not force a strict course-name contains match here.
            // Many slots store generic values (e.g. "manual"/"automatic") in course_type,
            // which previously hid valid slots from Step 3 calendar.
            // Vehicle bucket filter — exclude slots for the wrong vehicle type
            if (isMoto && !ct.includes('motorcycle')) return false;
            if (isTricycle && !ct.includes('tricycle')) return false;
            if (isB1B2 && !(ct.includes('b1') || ct.includes('b2'))) return false;
            if (!isMoto && !isTricycle && !isB1B2) {
                if (ct.includes('motorcycle') || ct.includes('tricycle') ||
                    ct.includes('b1') || ct.includes('b2')) return false;
            }
            // Transmission match — strictly applied to ALL vehicle types when a type is chosen
            const slotTx = (s.transmission || '').toLowerCase();
            const isUniversalTx = slotTx === 'both' || slotTx === 'any' || slotTx === 'all' || !slotTx;
            
            if (wantsAT) return isUniversalTx || slotTx.includes('automatic') || slotTx === 'at';
            if (wantsMT) return isUniversalTx || slotTx.includes('manual') || slotTx === 'mt';
            
            // No specific transmission preference or type not explicitly AT/MT (e.g. car generic)
            return true;
        });
        setPdcCalendarSlots(filtered);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pdcAllSlots, formData.courseType, formData.course?.id]);

    // Step 2: check slot availability for each course card
    useEffect(() => {
        if (step !== 2 || !formData.branchId || courses.length === 0) return;
        setCheckingCourseAvail(true);
        Promise.all([
            schedulesAPI.getSlotsByDate(null, formData.branchId, 'TDC').catch(() => []),
            schedulesAPI.getSlotsByDate(null, formData.branchId, 'PDC').catch(() => [])
        ]).then(([rawTdc, rawPdc]) => {
            const tdcSlots = transformSlots(rawTdc);
            const pdcSlots = transformSlots(rawPdc);
            const hasTdcSlot = (type) => {
                const t = (type || '').toLowerCase();
                if (t.includes('online')) return tdcSlots.some(s => (s.course_type || '').toLowerCase().includes('online'));
                return tdcSlots.some(s => !(s.course_type || '').toLowerCase().includes('online'));
            };
            // courseName is passed for disambiguation when course_type alone is ambiguous
            // (e.g. a Motorcycle PDC course that was saved with course_type='Manual')
            const hasPdcSlot = (type, courseName = '') => {
                const t = (type || '').toLowerCase();
                const n = (courseName || '').toLowerCase();
                const isMoto = t.includes('motorcycle') || t.includes('moto') || n.includes('motorcycle');
                const isTricycle = t.includes('tricycle') || t.includes('v1') || n.includes('tricycle');
                const isB1B2 = t.includes('b1') || t.includes('b2') || t.includes('van') || t.includes('l300')
                    || n.includes('b1') || n.includes('b2') || n.includes('van') || n.includes('l300');
                // Tricycle (course_type: V1-Tricycle)
                if (isTricycle)
                    return pdcSlots.some(s => (s.course_type || '').toLowerCase().includes('tricycle'));
                // B1/B2 Van-L300
                if (isB1B2)
                    return pdcSlots.some(s => { const ct = (s.course_type || '').toLowerCase(); return ct.includes('b1') || ct.includes('b2'); });
                // Motorcycle — checked BEFORE manual/automatic so a motorcycle course
                // saved with course_type='Manual' is matched correctly via its name
                if (isMoto)
                    return pdcSlots.some(s => (s.course_type || '').toLowerCase().includes('motorcycle'));
                // Car AT (promo: 'carat', or direct course_type: 'automatic')
                if (t === 'carat' || t.includes('automatic'))
                    return pdcSlots.some(s => {
                        const ct = (s.course_type || '').toLowerCase();
                        if (ct.includes('motorcycle') || ct.includes('tricycle') || ct.includes('b1') || ct.includes('b2')) return false;
                        const tx = (s.transmission || '').toLowerCase();
                        return tx.includes('automatic') || tx === 'at';
                    });
                // Car MT (promo: 'carmt'/'car', or direct course_type: 'manual')
                if (t === 'carmt' || t === 'car' || t.includes('manual'))
                    return pdcSlots.some(s => {
                        const ct = (s.course_type || '').toLowerCase();
                        if (ct.includes('motorcycle') || ct.includes('tricycle') || ct.includes('b1') || ct.includes('b2')) return false;
                        const tx = (s.transmission || '').toLowerCase();
                        return tx.includes('manual') || tx === 'mt';
                    });
                // Unknown type — be strict: don't assume any slot qualifies
                return false;
            };
            const avail = {};
            packages.forEach(pkg => {
                const cat = pkg.category;
                const ct = (pkg.course_type || '').trim();
                const cn = pkg.name || '';
                if (cat === 'TDC') {
                    avail[pkg.id] = hasTdcSlot(ct);
                } else if (cat === 'PDC') {
                    avail[pkg.id] = hasPdcSlot(ct, cn);
                } else if (cat === 'Promo') {
                    const [tdcPart, pdcPart] = ct.split('+');
                    avail[pkg.id] = hasTdcSlot(tdcPart) && hasPdcSlot(pdcPart);
                } else {
                    avail[pkg.id] = true;
                }
            });
            setCourseAvailability(avail);
        }).finally(() => setCheckingCourseAvail(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, formData.branchId, courses.length]);

    // Step 3: check slot availability per type button
    useEffect(() => {
        if (step !== 3 || !formData.branchId || !formData.course?.typeOptions?.length) return;
        const cat = formData.course.category;
        if (cat === 'Promo') return; // Promo handles its own flow
        setTypeAvailability({});
        setCheckingTypeAvail(true);
        Promise.all([
            cat === 'TDC' ? schedulesAPI.getSlotsByDate(null, formData.branchId, 'TDC').catch(() => []) : Promise.resolve([]),
            cat === 'PDC' ? schedulesAPI.getSlotsByDate(null, formData.branchId, 'PDC').catch(() => []) : Promise.resolve([])
        ]).then(([rawTdc, rawPdc]) => {
            const tdcSlots = transformSlots(rawTdc);
            const pdcSlots = transformSlots(rawPdc);
            const checkTdc = (type) => {
                const t = (type || '').toLowerCase();
                if (t.includes('online')) return tdcSlots.some(s => (s.course_type || '').toLowerCase().includes('online'));
                return tdcSlots.some(s => !(s.course_type || '').toLowerCase().includes('online'));
            };
            const courseName = (formData.course?.name || '').toLowerCase();
            const checkPdc = (type) => {
                const t = (type || '').toLowerCase();
                // Also check course name to handle courses with ambiguous course_type
                // (e.g. Motorcycle PDC course saved with course_type='Manual')
                const isMoto = t.includes('motorcycle') || t.includes('moto') || courseName.includes('motorcycle');
                const isTricycle = t.includes('tricycle') || t.includes('v1') || courseName.includes('tricycle');
                const isB1B2 = t.includes('b1') || t.includes('b2') || t.includes('van') || t.includes('l300')
                    || courseName.includes('b1') || courseName.includes('b2');
                if (isTricycle)
                    return pdcSlots.some(s => (s.course_type || '').toLowerCase().includes('tricycle'));
                if (isB1B2)
                    return pdcSlots.some(s => { const ct = (s.course_type || '').toLowerCase(); return ct.includes('b1') || ct.includes('b2'); });
                if (isMoto)
                    return pdcSlots.some(s => (s.course_type || '').toLowerCase().includes('motorcycle'));
                if (t === 'carat' || t.includes('automatic'))
                    return pdcSlots.some(s => {
                        const ct = (s.course_type || '').toLowerCase();
                        if (ct.includes('motorcycle') || ct.includes('tricycle') || ct.includes('b1') || ct.includes('b2')) return false;
                        const tx = (s.transmission || '').toLowerCase();
                        return tx.includes('automatic') || tx === 'at';
                    });
                if (t === 'carmt' || t === 'car' || t.includes('manual'))
                    return pdcSlots.some(s => {
                        const ct = (s.course_type || '').toLowerCase();
                        if (ct.includes('motorcycle') || ct.includes('tricycle') || ct.includes('b1') || ct.includes('b2')) return false;
                        const tx = (s.transmission || '').toLowerCase();
                        return tx.includes('manual') || tx === 'mt';
                    });
                return false;
            };
            const avail = {};
            formData.course.typeOptions.forEach(opt => {
                if (cat === 'TDC') avail[opt.value] = checkTdc(opt.value);
                else if (cat === 'PDC') avail[opt.value] = checkPdc(opt.value);
                else avail[opt.value] = true;
            });
            setTypeAvailability(avail);
        }).finally(() => setCheckingTypeAvail(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, formData.branchId, formData.course?.id]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        
        if (name === 'birthday') {
            const birthDate = new Date(value);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            
            const ageStr = age >= 0 ? age.toString() : '';
            
            setFormData(prev => ({ 
                ...prev, 
                [name]: value,
                age: ageStr
            }));

            // Validate age
            if (ageStr && (parseInt(ageStr) < 16 || parseInt(ageStr) > 100)) {
                setFormErrors(prev => ({ 
                    ...prev, 
                    [name]: '', 
                    age: 'Age must be between 16 and 100' 
                }));
            } else {
                setFormErrors(prev => ({ 
                    ...prev, 
                    [name]: '', 
                    age: '' 
                }));
            }
            return;
        }

        setFormData(prev => {
            const updated = { ...prev, [name]: value };

            // Auto-fill zip code based on Philippine city/municipality in address
            if (name === 'address') {
                updated.zipCode = getZipFromAddress(value);
            }
            return updated;
        });

        // Clear error for the field when user types
        if (formErrors[name]) {
            setFormErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const handleLettersOnly = (e) => {
        const { name, value } = e.target;
        const lettersOnly = value.replace(/[^a-zA-Z\s\-'ñÑ]/g, '');
        setFormData(prev => ({ ...prev, [name]: lettersOnly }));
        if (formErrors[name]) {
            setFormErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const handleZipCode = (e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
        setFormData(prev => ({ ...prev, zipCode: digits }));
        if (formErrors.zipCode) {
            setFormErrors(prev => ({ ...prev, zipCode: '' }));
        }
    };

    const handleAge = (e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 3);
        const ageVal = digits ? parseInt(digits) : null;
        
        setFormData(prev => {
            const updates = { age: digits };
            
            if (ageVal !== null && ageVal >= 1 && ageVal <= 100) {
                const currentYear = new Date().getFullYear();
                const birthYear = currentYear - ageVal;
                
                if (prev.birthday) {
                    const parts = prev.birthday.split('-');
                    if (parts.length === 3) {
                        updates.birthday = `${birthYear}-${parts[1]}-${parts[2]}`;
                    } else {
                        updates.birthday = `${birthYear}-01-01`;
                    }
                } else {
                    updates.birthday = `${birthYear}-01-01`;
                }
            }
            
            return { ...prev, ...updates };
        });

        if (digits && (parseInt(digits) < 16 || parseInt(digits) > 100)) {
            setFormErrors(prev => ({ ...prev, age: 'Age must be between 16 and 100' }));
        } else if (formErrors.age) {
            setFormErrors(prev => ({ ...prev, age: '' }));
            if (digits) {
                setFormErrors(prev => ({ ...prev, birthday: '' }));
            }
        }
    };

    const handlePhoneChange = (fieldName, value) => {
        const digits = value.replace(/\D/g, '');
        // Must start with 09
        if (digits.length >= 1 && digits[0] !== '0') return;
        if (digits.length >= 2 && digits[1] !== '9') return;
        // Limit to 11 digits
        const limited = digits.slice(0, 11);
        // Format as 09XX XXX XXXX
        let formatted = limited;
        if (limited.length > 4) formatted = `${limited.slice(0, 4)} ${limited.slice(4)}`;
        if (limited.length > 7) formatted = `${limited.slice(0, 4)} ${limited.slice(4, 7)} ${limited.slice(7)}`;
        setFormData(prev => ({ ...prev, [fieldName]: formatted }));
        if (limited.length === 11) {
            setFormErrors(prev => ({ ...prev, [fieldName]: '' }));
        } else if (limited.length > 0) {
            setFormErrors(prev => ({ ...prev, [fieldName]: 'Must be 11 digits (09XX XXX XXXX)' }));
        } else {
            setFormErrors(prev => ({ ...prev, [fieldName]: '' }));
        }
    };

    const handleEmailChange = (value) => {
        setFormData(prev => ({ ...prev, email: value }));
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (value && !emailRegex.test(value)) {
            setFormErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }));
        } else {
            setFormErrors(prev => ({ ...prev, email: '' }));
        }
    };

    const validateStep1 = () => {
        const errors = {};
        // Personal Info
        if (!formData.firstName.trim()) errors.firstName = 'First name is required';
        if (!formData.lastName.trim()) errors.lastName = 'Last name is required';
        if (!formData.age) {
            errors.age = 'Age is required';
        } else if (parseInt(formData.age) < 16 || parseInt(formData.age) > 100) {
            errors.age = 'Age must be between 16 and 100';
        }
        if (!formData.gender) errors.gender = 'Please select a gender';
        if (!formData.birthday) {
            errors.birthday = 'Birthday is required';
        } else {
            const bday = new Date(formData.birthday);
            const ageDiff = new Date().getFullYear() - bday.getFullYear();
            if (ageDiff < 16) errors.birthday = 'Must be at least 16 years old';
        }
        if (!formData.nationality.trim()) errors.nationality = 'Nationality is required';
        if (!formData.maritalStatus) errors.maritalStatus = 'Please select marital status';

        // Contact Details
        if (!formData.address.trim()) errors.address = 'Address is required';
        if (!formData.zipCode.trim()) {
            errors.zipCode = 'Zip code is required';
        } else if (formData.zipCode.length !== 4) {
            errors.zipCode = 'Zip code must be 4 digits';
        }
        if (!formData.birthPlace.trim()) errors.birthPlace = 'Birth place is required';
        const contactDigits = formData.contactNumbers.replace(/\D/g, '');
        if (!contactDigits || contactDigits.length !== 11 || !contactDigits.startsWith('09')) {
            errors.contactNumbers = 'Contact number must be 11 digits starting with 09';
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!formData.email || !emailRegex.test(formData.email)) {
            errors.email = 'Please enter a valid email address';
        }

        // Emergency Contact
        if (!formData.emergencyContactPerson.trim()) errors.emergencyContactPerson = 'Emergency contact person is required';
        const emergencyDigits = formData.emergencyContactNumber.replace(/\D/g, '');
        if (!emergencyDigits || emergencyDigits.length !== 11 || !emergencyDigits.startsWith('09')) {
            errors.emergencyContactNumber = 'Emergency contact must be 11 digits starting with 09';
        }
        setFormErrors(errors);
        if (Object.keys(errors).length > 0) {
            showNotification('Please fix the highlighted errors before continuing', 'warning');
            return false;
        }
        return true;
    };

    const handleScheduleSelect = (slot) => {
        if (!formData.courseType) {
            showNotification('Please select a course type first (e.g., Manual / Automatic or F2F / Online).', 'warning');
            return;
        }
        const isTDC = formData.course?.category === 'TDC';
        const isPDC = !isTDC;
        const sessionName = slot.session.toLowerCase();

        // Check if this slot requires 2 days for PDC (usually Morning or Afternoon sessions)
        const isHalfDay = isPDC && (sessionName.includes('morning') || sessionName.includes('afternoon') || sessionName.includes('4 hours'));

        if (isHalfDay) {
            // First click
            if (!formData.scheduleSlotId || (formData.scheduleSlotId && formData.scheduleSlotId2)) {
                setFormData(prev => ({
                    ...prev,
                    scheduleDate: slot.date,
                    scheduleSlotId: slot.id,
                    scheduleSession: slot.session,
                    scheduleTime: slot.time_range,
                    scheduleDate2: '',
                    scheduleSlotId2: null,
                    scheduleSession2: '',
                    scheduleTime2: ''
                }));
                showNotification(`Day 1 selected! Please select Day 2 schedule for ${slot.session}.`, 'info');
            } else {
                // Second click
                if (slot.id === formData.scheduleSlotId) {
                    showNotification('Please select a different slot for Day 2.', 'warning');
                    return;
                }
                if (slot.date === formData.scheduleDate) {
                    showNotification('Day 2 must be on a different date from Day 1.', 'warning');
                    return;
                }
                if (slot.session !== formData.scheduleSession) {
                    showNotification(`For Day 2, please select the same session type: ${formData.scheduleSession}`, 'warning');
                    return;
                }
                setFormData(prev => ({
                    ...prev,
                    scheduleDate2: slot.date,
                    scheduleSlotId2: slot.id,
                    scheduleSession2: slot.session,
                    scheduleTime2: slot.time_range
                }));
                showNotification('Day 2 selected successfully! Schedule complete.', 'success');
                nextStep();
            }
        } else {
            // Single slot selection (TDC spans its own end_date backend, or PDC Whole Day)
            setFormData(prev => ({
                ...prev,
                scheduleDate: slot.date,
                scheduleSlotId: slot.id,
                scheduleSession: slot.session,
                scheduleTime: slot.time_range,
                scheduleDate2: slot.end_date && slot.end_date !== slot.date ? slot.end_date : '',
                scheduleSlotId2: null,
                scheduleSession2: '',
                scheduleTime2: ''
            }));
            showNotification('Schedule selected successfully!', 'success');
            nextStep();
        }
    };

    const handleCourseSelect = (pkg) => {
        setFormData(prev => ({
            ...prev,
            course: pkg,
            courseType: '',
            scheduleDate: '', scheduleSlotId: null, scheduleSession: '', scheduleTime: '',
            scheduleDate2: '', scheduleSlotId2: null, scheduleSession2: '', scheduleTime2: '',
            promoPdcSlotId2: null, promoPdcDate2: '', promoPdcSession2: '', promoPdcTime2: '',
            addons: [...DEFAULT_ADDONS]
        }));
        setSelectedScheduleDate('');
        setScheduleSlots([]);
        setTdcTypeFilter('All');
        // Reset promo state
        setPromoStep(1);
        setPromoTdcRawSlots([]);
        setPromoPdcCalMonth(new Date());
        setPromoPdcDate(null);
        setPromoPdcRawSlots([]);
        setPromoPdcSelectingDay2(false);
        setPromoPdcDay2CalMonth(new Date());
        setPromoPdcDate2(null);
        setPromoPdcRawSlots2([]);
        setPromoPdcMotorType(null);
        setStep(3);
    };

    const nextStep = () => setStep(prev => Math.min(prev + 1, 5));
    const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

    const toggleAddon = (addon) => {
        setFormData(prev => {
            const exists = prev.addons.find(a => a.id === addon.id);
            if (exists) {
                return { ...prev, addons: prev.addons.filter(a => a.id !== addon.id) };
            } else {
                return { ...prev, addons: [...prev.addons, addon] };
            }
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            setLoading(true);

            const dynamicCourse = packages.find(p => p.id === formData.course?.id) || formData.course;
            const selectedPrice = dynamicCourse?.typeOptions?.find(opt => opt.value === formData.courseType)?.price || dynamicCourse?.price || 0;
            const addonsTotal = (formData.addons || []).reduce((sum, a) => sum + (a.price || 0), 0);
            const isBundle = formData.course?.category === 'Promo';
            const bundleDiscount = isBundle ? (selectedPrice + addonsTotal) * 0.03 : 0;
            const subtotal = (selectedPrice + addonsTotal - bundleDiscount) + CONVENIENCE_FEE;
            
            const requiredAmount = formData.paymentStatus === 'Downpayment' ? subtotal * 0.5 : subtotal;
            const changeAmount = formData.amountPaid ? Math.max(0, Number(formData.amountPaid) - requiredAmount) : 0;
            const actualAmountToRecord = Number(formData.amountPaid) - changeAmount;

            const enrollmentData = {
                // Student Info
                firstName: formData.firstName,
                middleName: formData.middleName,
                lastName: formData.lastName,
                age: formData.age,
                gender: formData.gender,
                birthday: formData.birthday,
                nationality: formData.nationality,
                maritalStatus: formData.maritalStatus,
                address: formData.address,
                zipCode: formData.zipCode,
                birthPlace: formData.birthPlace,
                contactNumbers: formData.contactNumbers,
                email: formData.email,
                emergencyContactPerson: formData.emergencyContactPerson,
                emergencyContactNumber: formData.emergencyContactNumber,

                // Course & Branch
                courseId: formData.course?.id,
                courseCategory: formData.course?.category,
                courseType: formData.courseType,
                branchId: formData.branchId,

                // Schedule (supports 1 or 2 slots; for Promo: slot1=TDC, slot2=PDC Day1, promoPdcSlotId2=PDC Day2)
                scheduleSlotId: formData.scheduleSlotId,
                scheduleDate: formData.scheduleDate,
                ...(formData.scheduleSlotId2 ? {
                    scheduleSlotId2: formData.scheduleSlotId2,
                    scheduleDate2: formData.scheduleDate2,
                } : {}),
                ...(formData.promoPdcSlotId2 ? {
                    promoPdcSlotId2: formData.promoPdcSlotId2,
                    promoPdcDate2: formData.promoPdcDate2,
                } : {}),

                // Payment
                paymentMethod: formData.paymentMethod,
                amountPaid: actualAmountToRecord,
                paymentStatus: formData.paymentStatus,
                transactionNo: formData.transactionNo,
                addons: formData.addons || [],
                convenienceFee: CONVENIENCE_FEE,

                // Metadata
                enrollmentType: 'walk-in',
                enrolledBy: adminProfile?.email || 'admin'
            };

            // Call the walk-in enrollment API
            const result = await adminAPI.walkInEnrollment(enrollmentData);

            const newEnrollee = {
                name: `${formData.firstName} ${formData.lastName}`,
                course: `${formData.course?.shortName || formData.course?.name} (${formData.courseType})`,
                branch: formData.branchName,
                date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                status: formData.paymentStatus,
                method: formData.paymentMethod,
                schedule: `${formData.scheduleDate} - ${formData.scheduleSession}`
            };

            if (onEnroll) {
                onEnroll(newEnrollee);
            }

            showNotification('Walk-in enrollment successful! Confirmation email with login credentials and schedule sent to student.', 'success');

            // Clear persisted wizard state so next student starts fresh
            try { sessionStorage.removeItem('walkin_step'); sessionStorage.removeItem('walkin_formData'); } catch { }

            // Reset to first step
            setStep(1);
            setSelectedScheduleDate('');
            setScheduleSlots([]);
            setFormErrors({});
            setFormData({
                firstName: '', middleName: '', lastName: '', age: '', gender: '', birthday: '', nationality: '', maritalStatus: '',
                address: '', zipCode: '', birthPlace: '', contactNumbers: '', email: '', emergencyContactPerson: '', emergencyContactNumber: '',
                course: null, courseType: '', branchId: formData.branchId, branchName: formData.branchName,
                scheduleDate: '', scheduleSlotId: null, scheduleSession: '', scheduleTime: '',
                scheduleDate2: '', scheduleSlotId2: null, scheduleSession2: '', scheduleTime2: '',
                paymentMethod: 'Cash', amountPaid: '', paymentStatus: 'Full Payment', transactionNo: '',
                addons: []
            });
        } catch (error) {
            console.error('Enrollment error:', error);
            showNotification(error.message || 'Failed to complete enrollment. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const renderStep1 = () => (
        <div className="step-content animate-fadeIn space-y-8">
            {/* Personal Information Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-gray-50">
                    <div className="w-10 h-10 bg-[#2157da] text-white rounded-xl flex items-center justify-center font-black shadow-lg shadow-blue-500/20">1</div>
                    <div>
                        <h3 className="text-xl font-black text-gray-900 leading-tight">Personal Information</h3>
                        <p className="text-sm text-gray-500">Provide the basic details of the student</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    {/* First Name */}
                    <div className="md:col-span-4 flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-700 flex items-center gap-1">
                            First Name <span className="text-red-500">*</span>
                        </label>
                        <input 
                            type="text" 
                            name="firstName" 
                            value={formData.firstName} 
                            onChange={handleLettersOnly} 
                            required 
                            placeholder="e.g. Juan"
                            className={`w-full px-4 py-3.5 bg-gray-50 border-2 rounded-2xl outline-none transition-all ${formErrors.firstName ? 'border-red-500 ring-4 ring-red-50' : 'border-gray-100 focus:border-[#2157da] focus:ring-4 focus:ring-blue-50'}`} 
                        />
                        {formErrors.firstName && <span className="text-xs font-bold text-red-500 mt-1">{formErrors.firstName}</span>}
                    </div>

                    {/* Middle Initial */}
                    <div className="md:col-span-4 flex flex-col justify-end gap-2">
                        <div className="flex flex-wrap justify-between items-center gap-2">
                           <label className="text-sm font-bold text-gray-700 leading-none">Middle Initial</label>
                           <div className="flex items-center gap-2">
                             <label className="flex items-center gap-1 cursor-pointer text-xs font-medium text-gray-500 hover:text-[#2157da] transition-colors">
                               <input 
                                 type="radio" 
                                 name="middleNameType" 
                                 checked={formData.middleName !== 'N/A'} 
                                 onChange={() => setFormData(prev => ({ ...prev, middleName: '' }))}
                                 className="w-3 h-3 text-[#2157da]"
                               />
                               Has
                             </label>
                             <label className="flex items-center gap-1 cursor-pointer text-xs font-medium text-gray-500 hover:text-[#2157da] transition-colors">
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
                            onChange={handleLettersOnly} 
                            disabled={formData.middleName === 'N/A'}
                            placeholder={formData.middleName === 'N/A' ? 'N/A' : 'Initial'}
                            className={`w-full px-3 py-3.5 bg-gray-50 border-2 rounded-2xl text-center outline-none transition-all ${formData.middleName === 'N/A' ? 'bg-gray-100 border-gray-200 opacity-50 cursor-not-allowed' : 'border-gray-100 focus:border-[#2157da] focus:ring-4 focus:ring-blue-50'}`} 
                        />
                    </div>

                    {/* Last Name */}
                    <div className="md:col-span-4 flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-700 flex items-center gap-1">
                            Last Name <span className="text-red-500">*</span>
                        </label>
                        <input 
                            type="text" 
                            name="lastName" 
                            value={formData.lastName} 
                            onChange={handleLettersOnly} 
                            required 
                            placeholder="e.g. Dela Cruz"
                            className={`w-full px-4 py-3.5 bg-gray-50 border-2 rounded-2xl outline-none transition-all ${formErrors.lastName ? 'border-red-500 ring-4 ring-red-50' : 'border-gray-100 focus:border-[#2157da] focus:ring-4 focus:ring-blue-50'}`} 
                        />
                        {formErrors.lastName && <span className="text-xs font-bold text-red-500 mt-1">{formErrors.lastName}</span>}
                    </div>

                    {/* Row 2: Birthday, Age, Gender */}
                    <div className="md:col-span-5 flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-700">Birthday <span className="text-red-500">*</span></label>
                        <input 
                            type="date" 
                            name="birthday" 
                            value={formData.birthday} 
                            onChange={handleChange} 
                            required 
                            className={`w-full px-4 py-3.5 bg-gray-50 border-2 rounded-2xl outline-none transition-all ${formErrors.birthday ? 'border-red-500 ring-4 ring-red-50' : 'border-gray-100 focus:border-[#2157da] focus:ring-4 focus:ring-blue-50'}`} 
                        />
                        {formErrors.birthday && <span className="text-xs font-bold text-red-500 mt-1">{formErrors.birthday}</span>}
                    </div>

                    <div className="md:col-span-3 flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-700">Age (16-100) <span className="text-red-500">*</span></label>
                        <input 
                            type="text" 
                            name="age" 
                            value={formData.age} 
                            onChange={handleAge} 
                            required 
                            className={`w-full px-4 py-3.5 bg-gray-50 border-2 rounded-2xl outline-none transition-all ${formErrors.age ? 'border-red-500 ring-4 ring-red-50' : 'border-gray-100 focus:border-[#2157da] focus:ring-4 focus:ring-blue-50'}`} 
                        />
                        {formErrors.age && <span className="text-xs font-bold text-red-500 mt-1">{formErrors.age}</span>}
                    </div>

                    <div className="md:col-span-4 flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-700">Gender <span className="text-red-500">*</span></label>
                        <select 
                            name="gender" 
                            value={formData.gender} 
                            onChange={handleChange} 
                            required 
                            className={`w-full px-4 py-3.5 bg-gray-50 border-2 rounded-2xl outline-none transition-all ${formErrors.gender ? 'border-red-500 ring-4 ring-red-50' : 'border-gray-100 focus:border-[#2157da] focus:ring-4 focus:ring-blue-50'}`}
                        >
                            <option value="">Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                        {formErrors.gender && <span className="text-xs font-bold text-red-500 mt-1">{formErrors.gender}</span>}
                    </div>

                    {/* Row 3: Nationality, Status */}
                    <div className="md:col-span-6 flex flex-col gap-2 text-left">
                        <label className="text-sm font-bold text-gray-700">Nationality <span className="text-red-500">*</span></label>
                        <input 
                            type="text"
                            name="nationality" 
                            value={formData.nationality} 
                            onChange={handleChange} 
                            required 
                            placeholder="e.g. Filipino"
                            className={`w-full px-4 py-3.5 bg-gray-50 border-2 rounded-2xl focus:border-[#2157da] focus:ring-4 focus:ring-blue-50 outline-none transition-all ${formErrors.nationality ? 'border-red-500 ring-4 ring-red-50' : 'border-gray-100'}`}
                        />
                        {formErrors.nationality && <span className="text-xs font-bold text-red-500 mt-1">{formErrors.nationality}</span>}
                    </div>

                    <div className="md:col-span-6 flex flex-col gap-2 text-left">
                        <label className="text-sm font-bold text-gray-700">Marital Status <span className="text-red-500">*</span></label>
                        <select 
                            name="maritalStatus" 
                            value={formData.maritalStatus} 
                            onChange={handleChange} 
                            required 
                            className={`w-full px-4 py-3.5 bg-gray-50 border-2 rounded-2xl focus:border-[#2157da] focus:ring-4 focus:ring-blue-50 outline-none transition-all ${formErrors.maritalStatus ? 'border-red-500 ring-4 ring-red-50' : 'border-gray-100'}`}
                        >
                            <option value="">Select Status</option>
                            <option value="Single">Single</option>
                            <option value="Married">Married</option>
                            <option value="Widowed">Widowed</option>
                            <option value="Separated">Separated</option>
                        </select>
                        {formErrors.maritalStatus && <span className="text-xs font-bold text-red-500 mt-1">{formErrors.maritalStatus}</span>}
                    </div>
                </div>
            </div>

            {/* Contact Details Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-gray-50">
                    <div className="w-10 h-10 bg-green-500 text-white rounded-xl flex items-center justify-center font-black shadow-lg shadow-green-500/20">2</div>
                    <div>
                        <h3 className="text-xl font-black text-gray-900 leading-tight">Contact Details</h3>
                        <p className="text-sm text-gray-500">How can we reach the student?</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-12 flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-700">Complete Address <span className="text-red-500">*</span></label>
                        <input 
                            type="text" 
                            name="address" 
                            value={formData.address} 
                            onChange={handleChange} 
                            required 
                            placeholder="Street, Barangay, City, Province"
                            className={`w-full px-4 py-3.5 bg-gray-50 border-2 rounded-2xl focus:border-[#2157da] focus:ring-4 focus:ring-blue-50 outline-none transition-all ${formErrors.address ? 'border-red-500 ring-4 ring-red-50' : 'border-gray-100'}`} 
                        />
                        {formErrors.address && <span className="text-xs font-bold text-red-500 mt-1">{formErrors.address}</span>}
                    </div>

                    <div className="md:col-span-3 flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-700">Zip Code <span className="text-sm font-normal text-gray-400">(4 digits)</span> <span className="text-red-500">*</span></label>
                        <input 
                            type="text" 
                            name="zipCode" 
                            value={formData.zipCode} 
                            onChange={handleZipCode} 
                            maxLength={4}
                            required 
                            className={`w-full px-4 py-3.5 bg-gray-50 border-2 rounded-2xl focus:border-[#2157da] focus:ring-4 focus:ring-blue-50 outline-none transition-all font-mono font-bold ${formErrors.zipCode ? 'border-red-500 ring-4 ring-red-50' : 'border-gray-100'}`} 
                        />
                        {formErrors.zipCode && <span className="text-xs font-bold text-red-500 mt-1">{formErrors.zipCode}</span>}
                    </div>

                    <div className="md:col-span-3 flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-700">Birth Place <span className="text-red-500">*</span></label>
                        <input 
                            type="text" 
                            name="birthPlace" 
                            value={formData.birthPlace} 
                            onChange={handleChange} 
                            required 
                            className={`w-full px-4 py-3.5 bg-gray-50 border-2 rounded-2xl focus:border-[#2157da] focus:ring-4 focus:ring-blue-50 outline-none transition-all ${formErrors.birthPlace ? 'border-red-500 ring-4 ring-red-50' : 'border-gray-100'}`} 
                        />
                        {formErrors.birthPlace && <span className="text-xs font-bold text-red-500 mt-1">{formErrors.birthPlace}</span>}
                    </div>

                    <div className="md:col-span-3 flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-700">Contact Number <span className="text-red-500">*</span></label>
                        <input 
                            type="tel" 
                            name="contactNumbers" 
                            value={formData.contactNumbers} 
                            onChange={(e) => handlePhoneChange('contactNumbers', e.target.value)} 
                            maxLength={13}
                            required 
                            placeholder="09XX XXX XXXX"
                            className={`w-full px-4 py-3.5 bg-gray-50 border-2 rounded-2xl focus:border-[#2157da] focus:ring-4 focus:ring-blue-50 outline-none transition-all ${formErrors.contactNumbers ? 'border-red-500 ring-4 ring-red-50' : 'border-gray-100'}`} 
                        />
                        {formErrors.contactNumbers && <span className="text-xs font-bold text-red-500 mt-1">{formErrors.contactNumbers}</span>}
                    </div>

                    <div className="md:col-span-3 flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-700">Email Address <span className="text-red-500">*</span></label>
                        <input 
                            type="email" 
                            name="email" 
                            value={formData.email} 
                            onChange={(e) => handleEmailChange(e.target.value)} 
                            required 
                            placeholder="example@gmail.com"
                            className={`w-full px-4 py-3.5 bg-gray-50 border-2 rounded-2xl focus:border-[#2157da] focus:ring-4 focus:ring-blue-50 outline-none transition-all ${formErrors.email ? 'border-red-500 ring-4 ring-red-50' : 'border-gray-100'}`} 
                        />
                        {formErrors.email && <span className="text-xs font-bold text-red-500 mt-1">{formErrors.email}</span>}
                    </div>
                </div>
            </div>

            {/* Emergency Contact Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-gray-50">
                    <div className="w-10 h-10 bg-red-500 text-white rounded-xl flex items-center justify-center font-black shadow-lg shadow-red-500/20">3</div>
                    <div>
                        <h3 className="text-xl font-black text-gray-900 leading-tight">Emergency Contact</h3>
                        <p className="text-sm text-gray-500">In case of any emergency, who should we call?</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-700">Contact Person Name <span className="text-red-500">*</span></label>
                        <input 
                            type="text" 
                            name="emergencyContactPerson" 
                            value={formData.emergencyContactPerson} 
                            onChange={handleLettersOnly} 
                            placeholder="Full name of emergency contact" 
                            required 
                            className={`w-full px-4 py-3.5 bg-gray-50 border-2 rounded-2xl focus:border-[#2157da] focus:ring-4 focus:ring-blue-50 outline-none transition-all ${formErrors.emergencyContactPerson ? 'border-red-500 ring-4 ring-red-50' : 'border-gray-100'}`} 
                        />
                        {formErrors.emergencyContactPerson && <span className="text-xs font-bold text-red-500 mt-1">{formErrors.emergencyContactPerson}</span>}
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-700">Emergency Contact Number <span className="text-red-500">*</span></label>
                        <input
                            type="tel"
                            name="emergencyContactNumber"
                            value={formData.emergencyContactNumber}
                            onChange={(e) => handlePhoneChange('emergencyContactNumber', e.target.value)}
                            placeholder="09XX XXX XXXX"
                            maxLength={13}
                            required
                            className={`w-full px-4 py-3.5 bg-gray-50 border-2 rounded-2xl focus:border-[#2157da] focus:ring-4 focus:ring-blue-50 outline-none transition-all font-mono font-bold ${formErrors.emergencyContactNumber ? 'border-red-500 ring-4 ring-red-50' : 'border-gray-100'}`} 
                        />
                        {formErrors.emergencyContactNumber && <span className="text-xs font-bold text-red-500 mt-1">{formErrors.emergencyContactNumber}</span>}
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-4">
                <button 
                    type="button" 
                    onClick={() => { if (validateStep1()) nextStep(); }} 
                    className="flex items-center justify-center gap-3 px-10 py-4 bg-[#2157da] text-white rounded-2xl font-black text-lg hover:bg-[#1a3a8a] transform hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-blue-500/30"
                >
                    Next: Select Course
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                </button>
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="step-content animate-fadeIn">
            <div className="section-header center mb-8">
                <h2>Select Course</h2>
                <p>Choose the driving course for the client</p>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--secondary-text)' }}>
                    Loading courses...
                </div>
            ) : packages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--secondary-text)' }}>
                    <p>No active courses available at the moment.</p>
                    <p style={{ fontSize: '0.875rem', marginTop: '8px' }}>Please add courses in Course Management to proceed.</p>
                </div>
            ) : (
                <div className="courses-grid">
                    {checkingCourseAvail && (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '12px', fontSize: '0.875rem', color: 'var(--secondary-text)' }}>
                            Checking slot availability...
                        </div>
                    )}
                    {packages.map((pkg) => {
                        // Get the minimum price from all type options
                        const minPrice = Math.min(...pkg.typeOptions.map(opt => opt.price)) + CONVENIENCE_FEE;
                        const maxPrice = Math.max(...pkg.typeOptions.map(opt => opt.price)) + CONVENIENCE_FEE;
                        const priceDisplay = minPrice === maxPrice
                            ? `₱${minPrice.toLocaleString()}`
                            : `₱${minPrice.toLocaleString()} - ₱${maxPrice.toLocaleString()}`;
                        const isAvailable = courseAvailability[pkg.id] !== false;
                        const availChecked = pkg.id in courseAvailability;
                        const canSelect = availChecked && isAvailable;

                        return (
                            <div key={pkg.id} className={`course-card ${formData.course?.id === pkg.id ? 'selected' : ''} ${availChecked && !isAvailable ? 'no-slots-card' : ''}`}
                                style={availChecked && !isAvailable ? { opacity: 0.55, filter: 'grayscale(40%)', pointerEvents: 'none' } : undefined}>
                                <div className="course-img">
                                    <img src={pkg.image} alt={pkg.name} onError={(e) => e.target.style.display = 'none'} />
                                    <div className="course-overlay">
                                        <span>{priceDisplay}</span>
                                    </div>
                                    {availChecked && !isAvailable && (
                                        <div style={{ position: 'absolute', top: '8px', right: '8px', background: '#dc2626', color: '#fff', fontSize: '0.65rem', fontWeight: '800', padding: '3px 8px', borderRadius: '20px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                                            No Slots
                                        </div>
                                    )}
                                </div>
                                <div className="course-info">
                                    <h4>{pkg.category}</h4>
                                    <h3>{pkg.name}</h3>
                                    <p className="duration">⏱ {pkg.duration}</p>
                                    <ul className="features">
                                        {pkg.features.slice(0, 3).map((f, i) => <li key={i}>✓ {f}</li>)}
                                    </ul>
                                    <button
                                        type="button"
                                        onClick={() => canSelect && handleCourseSelect(pkg)}
                                        className="select-pkg-btn"
                                        disabled={!canSelect}
                                        style={!canSelect ? { background: '#9ca3af', cursor: 'not-allowed', opacity: 0.8 } : undefined}
                                        title={availChecked && !isAvailable ? 'No available slots for this course at the selected branch' : undefined}
                                    >
                                        {availChecked && !isAvailable ? 'No Available Slots' : !availChecked ? 'Checking...' : formData.course?.id === pkg.id ? 'Selected' : 'Select Course'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="step-actions">
                <button type="button" onClick={prevStep} className="back-btn">
                    <svg className="mr-2" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Form
                </button>
            </div>
        </div>
    );

    const renderStep3 = () => {
        // For TDC: group slots by month for pagination
        const tdcSlotsByMonth = isTDC ? scheduleSlots.reduce((acc, slot) => {
            const d = new Date(slot.date + 'T00:00:00');
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!acc[key]) acc[key] = [];
            acc[key].push(slot);
            return acc;
        }, {}) : {};
        const tdcMonthKeys = Object.keys(tdcSlotsByMonth).sort();
        const currentMonthKey = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
        const tdcSlotsForMonth = isTDC ? (tdcSlotsByMonth[currentMonthKey] || []) : scheduleSlots;
        const hasPrevSlotMonth = tdcMonthKeys.some(k => k < currentMonthKey);
        const hasNextSlotMonth = tdcMonthKeys.some(k => k > currentMonthKey);

        // True when Day 1 half-day is chosen but Day 2 hasn't been picked yet
        const isSelectingDay2 = !isTDC &&
            !!formData.scheduleSlotId &&
            !formData.scheduleSlotId2 &&
            (formData.scheduleSession.toLowerCase().includes('morning') ||
                formData.scheduleSession.toLowerCase().includes('afternoon') ||
                formData.scheduleSession.toLowerCase().includes('4 hours'));
        const lockedDay1Date = isSelectingDay2 ? formData.scheduleDate : null;

        const goToPrevMonth = () => {
            const prev = tdcMonthKeys.filter(k => k < currentMonthKey);
            if (prev.length > 0) {
                const [y, m] = prev[prev.length - 1].split('-').map(Number);
                setViewDate(new Date(y, m - 1, 1));
            }
        };

        const goToNextMonth = () => {
            const next = tdcMonthKeys.filter(k => k > currentMonthKey);
            if (next.length > 0) {
                const [y, m] = next[0].split('-').map(Number);
                setViewDate(new Date(y, m - 1, 1));
            }
        };

        // =====================================================================
        // PROMO BUNDLE: 2-step flow (TDC first, then PDC)
        // =====================================================================
        if (isPromo) {
            // TDC slot filtering + month pagination
            const promoTdcFiltered = promoTdcRawSlots.filter(s => {
                if (!promoTdcType) return true;
                const sType = (s.course_type || '').trim().toUpperCase();
                if (promoTdcType.toUpperCase() === 'F2F') return sType === 'F2F' || !s.course_type || sType === '';
                if (promoTdcType.toUpperCase() === 'ONLINE') return sType === 'ONLINE' || sType.includes('ONLINE');
                return true;
            });
            const promoTdcByMonth = promoTdcFiltered.reduce((acc, s) => {
                const d = new Date(s.date + 'T00:00:00');
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (!acc[key]) acc[key] = [];
                acc[key].push(s);
                return acc;
            }, {});
            const promoTdcMonthKeys = Object.keys(promoTdcByMonth).sort();
            const promoTdcCurMonthKey = `${promoTdcViewDate.getFullYear()}-${String(promoTdcViewDate.getMonth() + 1).padStart(2, '0')}`;
            const promoTdcSlotsForMonth = promoTdcByMonth[promoTdcCurMonthKey] || [];
            const hasPromoTdcPrev = promoTdcMonthKeys.some(k => k < promoTdcCurMonthKey);
            const hasPromoTdcNext = promoTdcMonthKeys.some(k => k > promoTdcCurMonthKey);

            // PDC slot matching function
            const matchPdcSlot = (slot) => {
                if (!promoPdcType) return true;
                const slotTx = (slot.transmission || '').toLowerCase().trim();
                const slotCT = (slot.course_type || '').toLowerCase().trim();
                if (promoPdcType === 'Motorcycle') {
                    if (!slotCT.includes('motorcycle')) return false;
                    if (promoPdcMotorType === 'MT') return slotTx.includes('manual') || slotTx === 'mt';
                    if (promoPdcMotorType === 'AT') return slotTx.includes('automatic') || slotTx === 'at';
                    return true;
                }
                if (promoPdcType === 'CarAT') return slotTx.includes('automatic') || slotTx === 'at' || slotTx === 'auto';
                if (promoPdcType === 'CarMT' || promoPdcType === 'Car') return slotTx.includes('manual') || slotTx === 'mt';
                return true;
            };
            const promoPdcCalendarSlots = pdcAllSlots.filter(matchPdcSlot);
            const promoPdcFilteredSlots = promoPdcRawSlots.filter(matchPdcSlot);
            const promoPdcDay1Session = formData.scheduleSession2;
            const promoPdcFiltered2Slots = promoPdcRawSlots2.filter(matchPdcSlot)
                .filter(s => !promoPdcDay1Session || s.session === promoPdcDay1Session);
            // PDC calendar helpers
            const pdcYear = promoPdcCalMonth.getFullYear();
            const pdcMonth = promoPdcCalMonth.getMonth();
            const pdcFirstDay = new Date(pdcYear, pdcMonth, 1).getDay();
            const pdcDaysInMonth = new Date(pdcYear, pdcMonth + 1, 0).getDate();
            const pdc2Year = promoPdcDay2CalMonth.getFullYear();
            const pdc2Month = promoPdcDay2CalMonth.getMonth();
            const pdc2FirstDay = new Date(pdc2Year, pdc2Month, 1).getDay();
            const pdc2DaysInMonth = new Date(pdc2Year, pdc2Month + 1, 0).getDate();
            const minPdcDateStr = (() => {
                // If TDC is already selected, PDC must be at least 2 days after TDC ends
                if (formData.scheduleSlotId) {
                    const tdcSlot = promoTdcRawSlots.find(s => s.id === formData.scheduleSlotId);
                    if (tdcSlot) {
                        const tdcEndDate = tdcSlot.end_date || tdcSlot.date;
                        const d = new Date(tdcEndDate + 'T00:00:00');
                        d.setDate(d.getDate() + 2);
                        return formatLocalDate(d);
                    }
                }
                return getMinSchedDate(2);
            })();
            const pdcIsHalfDay = promoPdcDay1Session && (
                promoPdcDay1Session.toLowerCase().includes('morning') ||
                promoPdcDay1Session.toLowerCase().includes('afternoon') ||
                promoPdcDay1Session.toLowerCase().includes('4 hours')
            );
            const promoCanProceed = !!formData.scheduleSlotId && !!formData.scheduleSlotId2 &&
                (!pdcIsHalfDay || !!formData.promoPdcSlotId2);

            const handlePromoTdcSelect = (slot) => {
                setFormData(prev => ({ ...prev, scheduleSlotId: slot.id, scheduleDate: slot.date, scheduleSession: slot.session, scheduleTime: slot.time_range }));
                setPromoStep(2); // Auto-advance to PDC selection
                showNotification('TDC schedule selected! Please select a PDC schedule.', 'success');
            };
            const handlePromoPdcDay1Select = (slot) => {
                const pdcDateStr = promoPdcDate
                    ? `${promoPdcDate.getFullYear()}-${String(promoPdcDate.getMonth() + 1).padStart(2, '0')}-${String(promoPdcDate.getDate()).padStart(2, '0')}`
                    : slot.date;
                setFormData(prev => ({
                    ...prev,
                    scheduleSlotId2: slot.id, scheduleDate2: pdcDateStr,
                    scheduleSession2: slot.session, scheduleTime2: slot.time_range,
                    promoPdcSlotId2: null, promoPdcDate2: '', promoPdcSession2: '', promoPdcTime2: ''
                }));
                setPromoPdcDate2(null); setPromoPdcRawSlots2([]);
                const half = slot.session.toLowerCase().includes('morning') || slot.session.toLowerCase().includes('afternoon') || slot.session.toLowerCase().includes('4 hours');
                if (half) {
                    setPromoPdcSelectingDay2(true);
                    showNotification(`PDC Day 1 selected (${slot.session}). Pick a date below for Day 2.`, 'info');
                } else {
                    setPromoPdcSelectingDay2(false);
                    showNotification('PDC schedule selected!', 'success');
                }
            };
            const handlePromoPdcDay2Select = (slot) => {
                if (promoPdcDay1Session && slot.session !== promoPdcDay1Session) {
                    showNotification(`Day 2 must match Day 1 session: ${promoPdcDay1Session}`, 'warning');
                    return;
                }
                const date2Str = promoPdcDate2
                    ? `${promoPdcDate2.getFullYear()}-${String(promoPdcDate2.getMonth() + 1).padStart(2, '0')}-${String(promoPdcDate2.getDate()).padStart(2, '0')}`
                    : slot.date;
                setFormData(prev => ({ ...prev, promoPdcSlotId2: slot.id, promoPdcDate2: date2Str, promoPdcSession2: slot.session, promoPdcTime2: slot.time_range }));
                showNotification('PDC Day 2 selected! Both days complete.', 'success');
            };

            const slotIcon = (session) => {
                if (session?.toLowerCase().includes('morning'))
                    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><line x1="12" y1="2" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>;
                if (session?.toLowerCase().includes('afternoon'))
                    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 18a5 5 0 0 0-10 0" /><line x1="12" y1="2" x2="12" y2="9" /><path d="M4.22 10.22l1.42 1.42" /><path d="M18.36 11.64l1.42-1.42" /><line x1="2" y1="18" x2="22" y2="18" /></svg>;
                return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
            };

            const renderPromoSlotCard = (slot, isSelected, onClick, chip) => {
                const availLow = slot.available_slots < 5;
                const slotDateLabel = slot.end_date && slot.date !== slot.end_date
                    ? `${new Date(slot.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(slot.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                    : new Date(slot.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                return (
                    <div key={slot.id} className={`slot-card${isSelected ? ' slot-card--selected' : ''}`} onClick={onClick}>
                        {isSelected && <div className="slot-card__accent" />}
                        <div className="slot-card__body">
                            <div className="slot-card__date-row">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                                {slotDateLabel}
                            </div>
                            <div className="slot-card__top">
                                <div className="slot-card__icon">{slotIcon(slot.session)}</div>
                                <div>
                                    <p className="slot-card__session">{slot.session}</p>
                                    <p className="slot-card__time">{slot.time_range}</p>
                                </div>
                            </div>
                            {chip && <span className="slot-card__chip">{chip}</span>}
                            <div className="slot-card__footer">
                                <div className={`slot-card__avail-badge${availLow ? ' slot-card__avail-badge--low' : ''}`}>
                                    {slot.available_slots}<span>/{slot.total_capacity}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            };

            const renderPromoCalendar = (calMonth, setCalMonth, onDateClick, selectedDate, disabledDateStr, slotsData = []) => {
                const cy = calMonth.getFullYear(), cm = calMonth.getMonth();
                const firstDay = new Date(cy, cm, 1).getDay();
                const daysInMon = new Date(cy, cm + 1, 0).getDate();
                
                return (
                    <div className="schedule-calendar-wrap">
                        {/* Session filter removed as requested */}
                        <div className="month-nav-bar">
                            <button className="month-nav-btn-icon" onClick={() => setCalMonth(new Date(cy, cm - 1, 1))}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
                            </button>
                            <h3 className="month-label">{calMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
                            <button className="month-nav-btn-icon" onClick={() => setCalMonth(new Date(cy, cm + 1, 1))}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                            </button>
                        </div>
                        <div className="calendar-grid-7">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="cal-day-header">{d}</div>)}
                            {Array.from({ length: firstDay }).map((_, i) => <div key={`pad-${i}`} className="cal-day cal-day--pad" />)}
                            {Array.from({ length: daysInMon }).map((_, i) => {
                                const d = i + 1;
                                const dateStr = `${cy}-${String(cm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                const isToday = today === dateStr;
                                const isSunday = new Date(cy, cm, d).getDay() === 0;
                                const isLockedDay1 = disabledDateStr && disabledDateStr === dateStr;
                                const isDisabled = dateStr < minPdcDateStr || isSunday || isLockedDay1;
                                const selDateStr = selectedDate
                                    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
                                    : '';
                                const isSelected = selDateStr === dateStr;

                                let daySlots = isDisabled ? [] : slotsData.filter(s => dateStr >= s.date && dateStr <= (s.end_date || s.date));
                                
                                // Apply Session Filter for Promo PDC
                                // Show all sessions without filter
                                if (false) { // Condition disabled
                                }

                                const slotStatus = isDisabled ? '' : daySlots.length === 0 ? ' no-slots' : daySlots.every(s => s.available_slots === 0) ? ' full-slots' : ' has-slots';
                                let cls = 'cal-day' + slotStatus;
                                if (isDisabled) cls += ' cal-day--disabled';
                                if (isToday) cls += ' cal-day--today';
                                
                                return (
                                    <div key={d} className={cls} title={isLockedDay1 ? 'Day 1 date' : undefined} onClick={() => !isDisabled && onDateClick(new Date(cy, cm, d))}>
                                        <div className="cal-day-header-mini">
                                            <span className="cal-day-num">{d}</span>
                                            {isToday && <span className="cal-day--today-dot" />}
                                        </div>
                                        {!isDisabled && (
                                            <div className="day-slots-container">
                                                {(() => {
                                                    const morningSlots = daySlots.filter(s => (s.session || '').toLowerCase().includes('morning'));
                                                    const afternoonSlots = daySlots.filter(s => (s.session || '').toLowerCase().includes('afternoon'));
                                                    const wholeDaySlots = daySlots.filter(s => (s.session || '').toLowerCase().includes('whole'));

                                                    const renderSubBox = (label, slots, type) => {
                                                        const hasSlots = slots.length > 0;
                                                        const anySelected = hasSlots && slots.some(s => formData.scheduleSlotId === s.id || formData.scheduleSlotId2 === s.id || formData.promoPdcSlotId2 === s.id);
                                                        const isFull = hasSlots && slots.every(s => s.available_slots === 0);
                                                        const hasMultiple = slots.length > 1;

                                                        const statusClass = !hasSlots ? ' empty' : isFull ? ' full' : '';
                                                        const selectedSlotId = hasSlots ? slots.find(s => formData.scheduleSlotId === s.id || formData.scheduleSlotId2 === s.id || formData.promoPdcSlotId2 === s.id)?.id || "" : "";
                                                        
                                                        return (
                                                                <div 
                                                                    key={type} 
                                                                    className={`session-sub-box ${type}${anySelected ? ' selected' : ''}${statusClass}`}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onDateClick(new Date(cy, cm, d));
                                                                        if (!hasSlots || isFull) return;
                                                                        if (promoStep === 2 && !formData.scheduleSlotId2) {
                                                                            handlePromoPdcDay1Select(slots[0]);
                                                                        } else if (promoPdcSelectingDay2) {
                                                                            handlePromoPdcDay2Select(slots[0]);
                                                                        }
                                                                    }}
                                                                >
                                                                    <div className="session-sub-label">
                                                                        <span>{label}</span>
                                                                    </div>
                                                                    {!hasSlots && <span className="no-slot-tag">NO SLOT</span>}
                                                                    {hasSlots && isFull && <span className="full-tag">FULL</span>}
                                                                    {hasSlots && (
                                                                        hasMultiple ? (
                                                                            <select 
                                                                                className="session-mini-select"
                                                                                value={selectedSlotId}
                                                                                onClick={(e) => e.stopPropagation()}
                                                                                onChange={(e) => {
                                                                                    const id = parseInt(e.target.value);
                                                                                    const s = slots.find(x => x.id === id);
                                                                                    if (anySelected) return;
                                                                                    if (s) {
                                                                                        onDateClick(new Date(cy, cm, d));
                                                                                        if (promoStep === 2 && !formData.scheduleSlotId2) {
                                                                                            handlePromoPdcDay1Select(s);
                                                                                        } else if (promoPdcSelectingDay2) {
                                                                                            handlePromoPdcDay2Select(s);
                                                                                        }
                                                                                    }
                                                                                }}
                                                                            >
                                                                                <option value="" disabled>Pick Time</option>
                                                                                {slots.map(s => (
                                                                                    <option key={s.id} value={s.id} disabled={s.available_slots === 0}>
                                                                                        {s.time_range} ({s.available_slots === 0 ? 'FULL' : `${s.available_slots}S`})
                                                                                    </option>
                                                                                ))}
                                                                            </select>
                                                                        ) : (
                                                                            <div className="session-sub-time">{slots[0].time_range}</div>
                                                                        )
                                                                    )}
                                                                </div>
                                                        );
                                                    };

                                                    return (
                                                        <>
                                                            {renderSubBox('Morning', morningSlots, 'morning')}
                                                            {renderSubBox('Afternoon', afternoonSlots, 'afternoon')}
                                                            {renderSubBox('Whole Day', wholeDaySlots, 'whole')}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            };

            return (
                <div className="step-content animate-fadeIn">
                    <div className="section-title">
                        <span className="step-badge">3</span>
                        <h3>Select Schedule</h3>
                    </div>

                    {formData.course && (
                        <div className="selected-course-summary mb-6">
                            <div className="summary-label">Selected Course:</div>
                            <div className="summary-value">{formData.course.name}</div>
                            <div style={{ marginTop: '8px', fontSize: '0.875rem', color: 'var(--secondary-text)' }}>
                                Category: <strong>{formData.course.category}</strong> | Duration: <strong>{formData.course.duration}</strong>
                            </div>
                        </div>
                    )}

                    {/* Promo 2-step indicator */}
                    <div className="schedule-banner" style={{ marginBottom: '20px', background: 'linear-gradient(135deg, #fef3c780, #fde68a40)', borderColor: '#f59e0b', borderWidth: '1.5px' }}>
                        <svg className="schedule-banner__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
                        <div className="schedule-banner__body">
                            <div className="schedule-banner__title" style={{ color: '#92400e' }}>Promo Bundle — 2-Step Schedule</div>
                            <div className="schedule-banner__desc" style={{ color: '#78350f' }}>Step 1: Select TDC schedule · Step 2: Select PDC schedule</div>
                        </div>
                        <div className="schedule-banner__actions">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {[{ label: 'TDC', done: !!formData.scheduleSlotId, active: promoStep === 1 }, { label: 'PDC', done: !!formData.scheduleSlotId2, active: promoStep === 2 }].map((item, idx) => (
                                    <React.Fragment key={item.label}>
                                        {idx > 0 && <div style={{ width: '16px', height: '2px', background: '#d97706' }} />}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <div style={{ width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.72rem', background: item.done ? '#22c55e' : item.active ? 'var(--primary-color)' : '#e5e7eb', color: item.done || item.active ? '#fff' : '#6b7280' }}>
                                                {item.done ? '✓' : idx + 1}
                                            </div>
                                            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#92400e' }}>{item.label}</span>
                                        </div>
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* TDC selected banner */}
                    {formData.scheduleSlotId && (
                        <div className="schedule-banner schedule-banner--success">
                            <svg className="schedule-banner__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                            <div className="schedule-banner__body">
                                <div className="schedule-banner__title">TDC Schedule Selected</div>
                                <div className="schedule-banner__desc">
                                    <strong>{new Date(formData.scheduleDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong> — {formData.scheduleSession} ({formData.scheduleTime})
                                </div>
                            </div>
                            <div className="schedule-banner__actions">
                                <button className="change-btn change-btn--green" onClick={() => {
                                    setPromoStep(1);
                                    setFormData(prev => ({ ...prev, scheduleSlotId: null, scheduleDate: '', scheduleSession: '', scheduleTime: '', scheduleSlotId2: null, scheduleDate2: '', scheduleSession2: '', scheduleTime2: '', promoPdcSlotId2: null, promoPdcDate2: '', promoPdcSession2: '', promoPdcTime2: '' }));
                                    setPromoPdcDate(null); setPromoPdcRawSlots([]); setPromoPdcSelectingDay2(false); setPromoPdcDate2(null); setPromoPdcRawSlots2([]); setPromoPdcMotorType(null);
                                }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                                    Change TDC
                                </button>
                            </div>
                        </div>
                    )}

                    {promoStep === 1 && !formData.scheduleSlotId && (
                        <div className="slots-section">
                            <div style={{ marginBottom: '24px' }}>
                                <div className="month-nav-bar">
                                    <button className="month-nav-btn-icon" onClick={() => {
                                        const prev = promoTdcMonthKeys.filter(k => k < promoTdcCurMonthKey);
                                        if (prev.length > 0) {
                                            const [y, m] = prev[prev.length - 1].split('-').map(Number);
                                            setPromoTdcViewDate(new Date(y, m - 1, 1));
                                        }
                                    }} disabled={!hasPromoTdcPrev}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
                                    </button>
                                    <div style={{ textAlign: 'center' }}>
                                        <h3 className="month-label">{promoTdcViewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
                                    </div>
                                    <button className="month-nav-btn-icon" onClick={() => {
                                        const next = promoTdcMonthKeys.filter(k => k > promoTdcCurMonthKey);
                                        if (next.length > 0) {
                                            const [y, m] = next[0].split('-').map(Number);
                                            setPromoTdcViewDate(new Date(y, m - 1, 1));
                                        }
                                    }} disabled={!hasPromoTdcNext}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                                    </button>
                                </div>
                            </div>
                            <h4 className="slots-header">
                                Available TDC Schedules — {promoTdcViewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </h4>
                            {loadingPromoTdc ? (
                                <div className="slots-loading">Loading TDC slots...</div>
                            ) : promoTdcSlotsForMonth.length === 0 ? (
                                <div className="slots-empty">
                                    <p className="slots-empty__title">No available slots in {promoTdcViewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                                </div>
                            ) : (
                                <div className="slots-grid">
                                    {promoTdcSlotsForMonth.map(slot => 
                                        renderPromoSlotCard(slot, formData.scheduleSlotId === slot.id, () => handlePromoTdcSelect(slot), slot.course_type || 'F2F')
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {promoStep === 2 && (
                        <>
                            {formData.scheduleSlotId2 && (
                                <div className="schedule-banner schedule-banner--success" style={{ marginTop: '16px' }}>
                                    <svg className="schedule-banner__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                                    <div className="schedule-banner__body">
                                        <div className="schedule-banner__title">PDC Schedule Selected</div>
                                        <div className="schedule-banner__desc">
                                            Day 1: <strong>{new Date(formData.scheduleDate2 + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                                            {pdcIsHalfDay && formData.promoPdcSlotId2 && (
                                                <> · Day 2: <strong>{new Date(formData.promoPdcDate2 + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></>
                                            )}
                                             — {formData.scheduleSession2}
                                        </div>
                                    </div>
                                    <div className="schedule-banner__actions">
                                        <button className="change-btn change-btn--green" onClick={() => {
                                            setFormData(prev => ({ ...prev, scheduleSlotId2: null, scheduleDate2: '', scheduleSession2: '', scheduleTime2: '', promoPdcSlotId2: null, promoPdcDate2: '', promoPdcSession2: '', promoPdcTime2: '' }));
                                            setPromoPdcDate(null); setPromoPdcRawSlots([]); setPromoPdcSelectingDay2(false); setPromoPdcDate2(null); setPromoPdcRawSlots2([]);
                                        }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                                            Change PDC
                                        </button>
                                    </div>
                                </div>
                            )}

                            {!promoPdcSelectingDay2 && !formData.scheduleSlotId2 && (
                                <>
                                    {promoPdcType === 'Motorcycle' && (
                                        <div className="type-selector-card" style={{ marginTop: '16px' }}>
                                            <div className="type-selector-title">Select Transmission</div>
                                            <div className="type-btn-group">
                                                <button type="button" className={`type-btn${promoPdcMotorType === 'MT' ? ' active' : ''}`} onClick={() => { setPromoPdcMotorType('MT'); setPromoPdcDate(null); }}>Manual (MT)</button>
                                                <button type="button" className={`type-btn${promoPdcMotorType === 'AT' ? ' active' : ''}`} onClick={() => { setPromoPdcMotorType('AT'); setPromoPdcDate(null); }}>Automatic (AT)</button>
                                            </div>
                                        </div>
                                    )}

                                    {(!promoPdcType || promoPdcType !== 'Motorcycle' || promoPdcMotorType) && (
                                        <>
                                            <div style={{ marginTop: '16px' }}>
                                                {renderPromoCalendar(promoPdcCalMonth, setPromoPdcCalMonth, (d) => setPromoPdcDate(d), promoPdcDate, null, promoPdcCalendarSlots)}
                                            </div>
                                            {promoPdcDate && (
                                                <div className="slots-section">
                                                    <h4 className="slots-header">PDC Slots — {promoPdcDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</h4>
                                                    {loadingPromoPdc ? (
                                                        <div className="slots-loading">Loading slots...</div>
                                                    ) : promoPdcFilteredSlots.length === 0 ? (
                                                        <div className="slots-empty">
                                                            <p className="slots-empty__title">No slots available</p>
                                                        </div>
                                                    ) : (
                                                        <div className="slots-grid">
                                                            {promoPdcFilteredSlots.map(slot => 
                                                                renderPromoSlotCard(slot, formData.scheduleSlotId2 === slot.id, () => handlePromoPdcDay1Select(slot), slot.transmission)
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </>
                            )}

                            {promoPdcSelectingDay2 && (
                                <>
                                    <div className="schedule-banner schedule-banner--info" style={{ marginTop: '16px' }}>
                                        <svg className="schedule-banner__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                        <div className="schedule-banner__body">
                                            <div className="schedule-banner__title">Day 2 Selection Required</div>
                                            <div className="schedule-banner__desc">Now pick a date for <strong>Day 2</strong>.</div>
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '16px' }}>
                                        {renderPromoCalendar(promoPdcDay2CalMonth, setPromoPdcDay2CalMonth, (d) => setPromoPdcDate2(d), promoPdcDate2, formData.scheduleDate2, promoPdcCalendarSlots)}
                                    </div>
                                    {promoPdcDate2 && (
                                        <div className="slots-section">
                                            <h4 className="slots-header">Day 2 Slots — {promoPdcDate2.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</h4>
                                            {loadingPromoPdc2 ? (
                                                <div className="slots-loading">Loading slots...</div>
                                            ) : promoPdcFiltered2Slots.length === 0 ? (
                                                <div className="slots-empty">
                                                    <p className="slots-empty__title">No valid slots available</p>
                                                    <p className="slots-empty__sub">Find a slot for '{promoPdcDay1Session}'</p>
                                                </div>
                                            ) : (
                                                <div className="slots-grid">
                                                    {promoPdcFiltered2Slots.map(slot => 
                                                        renderPromoSlotCard(slot, formData.promoPdcSlotId2 === slot.id, () => handlePromoPdcDay2Select(slot), slot.transmission)
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}

                    <div className="step-actions">
                        <button type="button" className="back-btn" onClick={prevStep}>
                            <svg className="mr-2" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back
                        </button>
                        {promoStep === 2 && promoCanProceed && (
                            <button type="button" className="next-btn" onClick={nextStep}>
                                Next: Enrollment
                                <svg className="ml-2" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
            );
        }
// =====================================================================
                    // END PROMO — regular TDC/PDC flow continues below
                    // =====================================================================

                    return (
                    <div className="step-content animate-fadeIn walkin-schedule-theme">
                        <div className="section-title">
                            <span className="step-badge">3</span>
                            <h3>Select Schedule</h3>
                        </div>

                        {formData.course && (
                            <div className="selected-course-summary mb-6">
                                <div className="summary-label">Selected Course:</div>
                                <div className="summary-value">{formData.course.name}</div>
                                <div style={{ marginTop: '8px', fontSize: '0.875rem', color: 'var(--secondary-text)' }}>
                                    Category: <strong>{formData.course.category}</strong> | Duration: <strong>{formData.course.duration}</strong>
                                </div>
                            </div>
                        )}

                        {/* Course Type Selection */}
                        {formData.course?.hasTypeOption && formData.course.typeOptions.length > 0 && (
                            <div className={`type-selector-card${formData.courseType ? ' has-selection' : ''}`}>
                                <div className="type-selector-title">
                                    Select Type
                                    {formData.course.category === 'PDC' && <span style={{ fontWeight: '400', color: 'var(--secondary-text)', fontSize: '0.82rem' }}>— e.g. Manual / Automatic</span>}
                                    {formData.course.category === 'TDC' && <span style={{ fontWeight: '400', color: 'var(--secondary-text)', fontSize: '0.82rem' }}>— e.g. F2F / Online</span>}
                                    <span style={{ color: 'red' }}>*</span>
                                </div>
                                <div className="type-selector-sub">Choose your preferred type before selecting a schedule.</div>
                                {checkingTypeAvail && (
                                    <div style={{ fontSize: '0.78rem', color: 'var(--secondary-text)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                                        Checking slot availability…
                                    </div>
                                )}
                                <div className="type-btn-group">
                                    {formData.course.typeOptions.map(opt => {
                                        const typeChecked = !checkingTypeAvail && (opt.value in typeAvailability);
                                        const typeDisabled = typeChecked && typeAvailability[opt.value] === false;
                                        const isLoading = checkingTypeAvail;
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                className={`type-btn${formData.courseType === opt.value ? ' active' : ''}${typeDisabled ? ' type-btn--disabled' : ''}${isLoading ? ' type-btn--checking' : ''}`}
                                                disabled={typeDisabled || isLoading}
                                                title={typeDisabled ? 'No available slots for this type' : isLoading ? 'Checking availability…' : undefined}
                                                onClick={() => {
                                                    if (typeDisabled || isLoading) return;
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        courseType: opt.value,
                                                        scheduleDate: '', scheduleSlotId: null, scheduleSession: '', scheduleTime: '',
                                                        scheduleDate2: '', scheduleSlotId2: null, scheduleSession2: '', scheduleTime2: ''
                                                    }));
                                                    setSelectedScheduleDate('');
                                                }}
                                            >
                                                <span className="type-btn__label">{opt.label}</span>
                                                {typeDisabled && <span className="type-btn__no-slots">No Slots</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                                {!formData.courseType && (
                                    <div className="type-error-msg">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                                        Please select a type to view available schedules.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* PDC Day 2 Selection Prompts */}
                        {!isTDC && formData.scheduleSlotId && !formData.scheduleSlotId2 && formData.scheduleSession && (formData.scheduleSession.toLowerCase().includes('morning') || formData.scheduleSession.toLowerCase().includes('afternoon') || formData.scheduleSession.toLowerCase().includes('4 hours')) && (
                            <div className="schedule-banner schedule-banner--info">
                                <svg className="schedule-banner__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                <div className="schedule-banner__body">
                                    <div className="schedule-banner__title">Day 2 Selection Required</div>
                                    <div className="schedule-banner__desc">
                                        Day 1: <strong>{new Date(formData.scheduleDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong> — {formData.scheduleSession} ({formData.scheduleTime}). Now pick a date for <strong>Day 2</strong>.
                                    </div>
                                </div>
                                <div className="schedule-banner__actions">
                                    <button className="change-btn change-btn--primary" onClick={() => { setFormData(prev => ({ ...prev, scheduleDate: '', scheduleSlotId: null, scheduleSession: '', scheduleTime: '', scheduleDate2: '', scheduleSlotId2: null, scheduleSession2: '', scheduleTime2: '' })); setPromoPdcDate(null); setPromoPdcRawSlots([]); setPromoPdcSelectingDay2(false); setPromoPdcDate2(null); setPromoPdcRawSlots2([]); }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                                        Change Day 1
                                    </button>
                                </div>
                            </div>
                        )}
                        {
                            !isTDC && formData.scheduleSlotId && formData.scheduleSlotId2 && (
                                <div className="schedule-banner schedule-banner--success">
                                    <svg className="schedule-banner__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                                    <div className="schedule-banner__body">
                                        <div className="schedule-banner__title">Schedule Complete</div>
                                        <div className="schedule-banner__desc">
                                            Day 1: <strong>{new Date(formData.scheduleDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong> · Day 2: <strong>{new Date(formData.scheduleDate2 + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong> — {formData.scheduleSession}
                                        </div>
                                    </div>
                                    <div className="schedule-banner__actions">
                                        <button className="change-btn change-btn--green" onClick={() => { setFormData(prev => ({ ...prev, scheduleDate2: '', scheduleSlotId2: null, scheduleSession2: '', scheduleTime2: '' })); setPromoPdcDate(null); setPromoPdcRawSlots([]); setPromoPdcSelectingDay2(false); setPromoPdcDate2(null); setPromoPdcRawSlots2([]); }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                                            Change Day 2
                                        </button>
                                        <button className="change-btn change-btn--grey" onClick={() => { setFormData(prev => ({ ...prev, scheduleDate: '', scheduleSlotId: null, scheduleSession: '', scheduleTime: '', scheduleDate2: '', scheduleSlotId2: null, scheduleSession2: '', scheduleTime2: '' })); setPromoPdcDate(null); setPromoPdcRawSlots([]); setPromoPdcSelectingDay2(false); setPromoPdcDate2(null); setPromoPdcRawSlots2([]); }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                                            Change Day 1
                                        </button>
                                    </div>
                                </div>
                            )
                        }

                        {/* TDC Selected Schedule Banner */}
                        {
                            isTDC && formData.scheduleSlotId && (
                                <div className="schedule-banner schedule-banner--success">
                                    <svg className="schedule-banner__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                                    <div className="schedule-banner__body">
                                        <div className="schedule-banner__title">TDC Schedule Selected</div>
                                        <div className="schedule-banner__desc">
                                            <strong>{new Date(formData.scheduleDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong> — {formData.scheduleSession} ({formData.scheduleTime})
                                        </div>
                                    </div>
                                    <div className="schedule-banner__actions">
                                        <button className="change-btn change-btn--green" onClick={() => setFormData(prev => ({ ...prev, scheduleDate: '', scheduleSlotId: null, scheduleSession: '', scheduleTime: '' }))}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                                            Change
                                        </button>
                                    </div>
                                </div>
                            )
                        }

                        {/* PDC Whole Day selected banner (single-slot, no Day 2 needed) */}
                        {
                            !isTDC && formData.scheduleSlotId && !formData.scheduleSlotId2 && !isSelectingDay2 && (
                                <div className="schedule-banner schedule-banner--success">
                                    <svg className="schedule-banner__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                                    <div className="schedule-banner__body">
                                        <div className="schedule-banner__title">Schedule Selected</div>
                                        <div className="schedule-banner__desc">
                                            <strong>{new Date(formData.scheduleDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong> — {formData.scheduleSession} ({formData.scheduleTime})
                                        </div>
                                    </div>
                                    <div className="schedule-banner__actions">
                                        <button className="change-btn change-btn--green" onClick={() => { setFormData(prev => ({ ...prev, scheduleDate: '', scheduleSlotId: null, scheduleSession: '', scheduleTime: '', scheduleDate2: '', scheduleSlotId2: null, scheduleSession2: '', scheduleTime2: '' })); setSelectedScheduleDate(''); }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                                            Change
                                        </button>
                                    </div>
                                </div>
                            )
                        }

                        {
                            !isTDC && formData.courseType && (
                                <div className="policy-banner">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2" style={{ flexShrink: 0 }}>
                                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                                    <div className="policy-banner__text">
                                        <div className="policy-banner__title">Schedule Policy</div>
                                        <div className="policy-banner__desc">Schedules must be booked at least <strong>2 days in advance</strong>. Sundays are not available.</div>
                                    </div>
                                </div>
                            )}

                    {
                        !isTDC && formData.courseType && (
                            <div className="schedule-calendar-wrap">
                                <div className="month-nav-bar">
                                    <button className="month-nav-btn-icon" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
                                    </button>
                                    <h3 className="month-label">{viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
                                    <button className="month-nav-btn-icon" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                                    </button>
                                </div>
                                <div className="calendar-grid-7">
                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                        <div key={day} className="cal-day-header">{day}</div>
                                    ))}
                                    {/* Legend integration */}
                                    <div className="cal-legend-minimal" style={{ gridColumn: 'span 7', display: 'flex', gap: '15px', justifyContent: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-color)', marginBottom: '5px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', fontWeight: '800', color: '#9a3412' }}>
                                            <div style={{ width: '8px', height: '8px', background: 'rgba(249, 115, 22, 0.1)', border: '1px solid #fed7aa', borderRadius: '2px' }}></div>
                                            Morning
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', fontWeight: '800', color: '#713f12' }}>
                                            <div style={{ width: '8px', height: '8px', background: 'rgba(254, 252, 232, 1)', border: '1px solid #fde68a', borderRadius: '2px' }}></div>
                                            Afternoon
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', fontWeight: '800', color: '#1e3a5f' }}>
                                            <div style={{ width: '8px', height: '8px', background: 'rgba(239, 246, 255, 1)', border: '1px solid #bfdbfe', borderRadius: '2px' }}></div>
                                            Whole Day
                                        </div>
                                    </div>
                                    {(() => {
                                        const year = viewDate.getFullYear();
                                        const month = viewDate.getMonth();
                                        const firstDay = new Date(year, month, 1).getDay();
                                        const daysInMonth = new Date(year, month + 1, 0).getDate();
                                        const days = [];
                                        for (let i = 0; i < firstDay; i++) {
                                            days.push(<div key={`pad-${i}`} className="cal-day cal-day--pad" />);
                                        }
                                        const minDateStr = getMinSchedDate(2);
                                        for (let d = 1; d <= daysInMonth; d++) {
                                            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                            const isSelected = selectedScheduleDate === dateStr;
                                            const isToday = today === dateStr;
                                            const isSunday = new Date(year, month, d).getDay() === 0;
                                            const isLockedDay1 = !!lockedDay1Date && lockedDay1Date === dateStr;
                                            const isDisabled = dateStr < minDateStr || isSunday || isLockedDay1;
                                            const daySlots = isDisabled ? [] : pdcCalendarSlots.filter(s => dateStr >= s.date && dateStr <= (s.end_date || s.date));
                                            const slotStatus = isDisabled ? '' : daySlots.length === 0 ? ' no-slots' : daySlots.every(s => s.available_slots === 0) ? ' full-slots' : ' has-slots';
                                            let cls = 'cal-day' + slotStatus;
                                            if (isDisabled) cls += ' cal-day--disabled';
                                            else if (isSelected) cls += ' cal-day--selected';
                                            if (isToday) cls += ' cal-day--today';
                                            days.push(
                                                <div key={d} className={cls} title={isLockedDay1 ? 'Day 1 date is already selected' : undefined} onClick={() => !isDisabled && setSelectedScheduleDate(dateStr)}>
                                                    <div className="cal-day-header-mini">
                                                        <span className="cal-day-num">{d}</span>
                                                        {isToday && <span className="cal-day--today-dot" />}
                                                    </div>
                                                    <div className="day-slots-container">
                                                        {(() => {
                                                            const morningSlots = daySlots.filter(s => (s.session || '').toLowerCase().includes('morning'));
                                                            const afternoonSlots = daySlots.filter(s => (s.session || '').toLowerCase().includes('afternoon'));
                                                            const wholeDaySlots = daySlots.filter(s => (s.session || '').toLowerCase().includes('whole'));

                                                            const renderSubBox = (label, slots, type) => {
                                                                // Always show the box, but handle empty slots as "No Slots"
                                                                const hasSlots = slots.length > 0;
                                                                const anySelected = hasSlots && slots.some(s => formData.scheduleSlotId === s.id || formData.scheduleSlotId2 === s.id);
                                                                const selectedSlotId = hasSlots ? slots.find(s => formData.scheduleSlotId === s.id || formData.scheduleSlotId2 === s.id)?.id || "" : "";
                                                                const allFull = hasSlots && slots.every(s => s.available_slots === 0);
                                                                const hasMultiple = slots.length > 1;

                                                                const statusClass = !hasSlots ? ' empty' : allFull ? ' full' : '';
                                                                
                                                                return (
                                                                    <div 
                                                                        key={type} 
                                                                        className={`session-sub-box ${type}${anySelected ? ' selected' : ''}${statusClass}`}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setSelectedScheduleDate(dateStr);
                                                                            if (!hasSlots || allFull) return;
                                                                            if (!hasMultiple) handleScheduleSelect(slots[0]);
                                                                        }}
                                                                    >
                                                                        <div className="session-sub-label">
                                                                            <span>{label}</span>
                                                                        </div>
                                                                        {!hasSlots && <span className="no-slot-tag">NO SLOT</span>}
                                                                        {hasSlots && allFull && <span className="full-tag">FULL</span>}
                                                                        {hasSlots && (
                                                                             hasMultiple ? (
                                                                                 <select 
                                                                                     className="session-mini-select"
                                                                                     value={selectedSlotId}
                                                                                     onClick={(e) => e.stopPropagation()}
                                                                                     onChange={(e) => {
                                                                                         const id = parseInt(e.target.value);
                                                                                         const s = slots.find(x => x.id === id);
                                                                                         if (s) {
                                                                                             setSelectedScheduleDate(dateStr);
                                                                                             handleScheduleSelect(s);
                                                                                         }
                                                                                     }}
                                                                                 >
                                                                                     <option value="" disabled>Pick Time</option>
                                                                                     {slots.map(s => (
                                                                                         <option key={s.id} value={s.id} disabled={s.available_slots === 0}>
                                                                                             {s.time_range} ({s.available_slots === 0 ? 'FULL' : `${s.available_slots}S`})
                                                                                         </option>
                                                                                     ))}
                                                                                 </select>
                                                                             ) : (
                                                                                 <div className="session-sub-time">{slots[0].time_range}</div>
                                                                             )
                                                                        )}
                                                                    </div>
                                                                );
                                                            };

                                                            return (
                                                                <>
                                                                    {renderSubBox('Morning', morningSlots, 'morning')}
                                                                    {renderSubBox('Afternoon', afternoonSlots, 'afternoon')}
                                                                    {renderSubBox('Whole Day', wholeDaySlots, 'whole')}
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return days;
                                    })()}
                                </div>
                            </div>
                        )
                    }

                    {
                        formData.courseType && (isTDC || (!isTDC && selectedScheduleDate)) && (
                            <div className="slots-section">
                                {isTDC && (
                                    <div style={{ marginBottom: '24px' }}>
                                        <div className="month-nav-bar">
                                            <button className="month-nav-btn-icon" onClick={goToPrevMonth} disabled={!hasPrevSlotMonth}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
                                            </button>
                                            <div style={{ textAlign: 'center' }}>
                                                <h3 className="month-label">{viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
                                                {tdcMonthKeys.length > 1 && <div style={{ fontSize: '0.75rem', color: 'var(--secondary-text)', marginTop: '2px' }}>{tdcMonthKeys.length} months with available schedules</div>}
                                            </div>
                                            <button className="month-nav-btn-icon" onClick={goToNextMonth} disabled={!hasNextSlotMonth}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                                            </button>
                                        </div>
                                        {tdcMonthKeys.length > 1 && (
                                            <div className="tdc-month-dots">
                                                {tdcMonthKeys.map(key => (
                                                    <div
                                                        key={key}
                                                        className={`tdc-month-dot${key === currentMonthKey ? ' tdc-month-dot--active' : ''}`}
                                                        style={{ width: key === currentMonthKey ? '24px' : '8px' }}
                                                        onClick={() => { const [y, m] = key.split('-').map(Number); setViewDate(new Date(y, m - 1, 1)); }}
                                                        title={new Date(key + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {isTDC && (
                                    <h4 className="slots-header">
                                        Available TDC Schedules — {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                    </h4>
                                )}

                                {!isTDC && (
                                    isSelectingDay2 ? (
                                        <div className="day2-lock-badge">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                            Showing {formData.scheduleSession} slots only — select Day 2
                                        </div>
                                    ) : null
                                )}

                                {(() => {
                                    const filteredPdcSlots = isTDC
                                        ? tdcSlotsForMonth.filter(slot => {
                                            if (!formData.courseType) return true;
                                            const slotType = (slot.course_type || '').toLowerCase().trim();
                                            const selectedType = formData.courseType.toLowerCase().trim();
                                            return slotType === selectedType || slotType.includes(selectedType) || selectedType.includes(slotType);
                                        })
                                        : []; // Empty array for PDC as slots are now handled in calendar

                                    return loadingSchedule ? (
                                        <div className="slots-loading">Loading available slots...</div>
                                    ) : (isTDC && filteredPdcSlots.length === 0) ? (
                                        <div className="slots-empty">
                                            <p className="slots-empty__title">No available slots in {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                                            <p className="slots-empty__sub">Try navigating to another month using the arrows above or check back later.</p>
                                        </div>
                                    ) : isTDC ? (
                                        <div className="slots-grid">
                                            {filteredPdcSlots.map(slot => 
                                                renderPromoSlotCard(slot, formData.scheduleSlotId === slot.id, () => handleScheduleSelect(slot), slot.course_type || 'F2F')
                                            )}
                                        </div>
                                    ) : null;
                                })()}
                                <div className="step-actions">
                                    <button type="button" className="back-btn" onClick={prevStep}>
                                        Back
                                    </button>
                                    {!formData.courseType ? (
                                        <div style={{ fontSize: '0.875rem', color: '#dc2626', fontStyle: 'italic' }}>
                                            Please select a course type above to proceed.
                                        </div>
                                    ) : !isTDC && !selectedScheduleDate && !formData.scheduleSlotId ? (
                                        <div style={{ fontSize: '0.875rem', color: 'var(--secondary-text)', fontStyle: 'italic' }}>
                                            Please select a date from the calendar to view slots.
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        )
                    }
                </div>
            );
        };

        const renderStep4 = () => {
            const dynamicCourse = packages.find(p => p.id === formData.course?.id) || formData.course;
            const selectedTypeOpt = dynamicCourse?.typeOptions?.find(opt => opt.value === formData.courseType);
            const selectedPrice = selectedTypeOpt?.price || dynamicCourse?.price || 0;
            const addonsTotal = (formData.addons || []).reduce((sum, a) => sum + (a.price || 0), 0);
            
            // Subtotal includes course + addons
            const subtotal = selectedPrice + addonsTotal;
            // Standard 3% discount on subtotal for all walk-ins as requested
            const discount = subtotal * 0.03;
            // Total amount includes convenience fee (not discounted)
            const totalAmount = subtotal - discount + CONVENIENCE_FEE;
            
            const requiredAmount = formData.paymentStatus === 'Downpayment' ? totalAmount * 0.5 : totalAmount;
            const balanceDue = totalAmount - (Number(formData.amountPaid) || 0);
            const change = formData.amountPaid ? Math.max(0, Number(formData.amountPaid) - requiredAmount) : 0;

            return (
                <div className="step-content animate-fadeIn">
                    <div className="section-title">
                        <span className="step-badge">4</span>
                        <h3>Enrollment & Payment</h3>
                    </div>

                    <div className="form-card-inner">
                        {/* ── Booking Summary Card ── */}
                        {formData.course && (
                            <div className="payment-summary-card">
                                <div className="payment-summary-card__left">
                                    <div className="payment-summary-card__icon">
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v4" /><rect x="2" y="10" width="20" height="12" rx="2" /><circle cx="12" cy="16" r="2" /></svg>
                                    </div>
                                    <div>
                                        <p className="payment-summary-card__course-name">{formData.course.name}</p>
                                        <div className="payment-summary-card__meta">
                                            <span className="payment-summary-card__pill">{formData.course.category}</span>
                                            <span className="payment-summary-card__dot">·</span>
                                            <span>{formData.course.duration}</span>
                                        </div>
                                    </div>
                                </div>
                                {(selectedTypeOpt || isPromo) && (
                                    <div className="payment-summary-card__right">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            {selectedTypeOpt && <span className="payment-summary-card__type-label" style={{ margin: 0 }}>TYPE</span>}
                                            {selectedTypeOpt && <span className="payment-summary-card__type-value">{selectedTypeOpt.label}</span>}
                                        </div>
                                        <div className="payment-summary-card__price-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                            <span className="payment-summary-card__price" style={{ fontSize: '1.4rem' }}>₱{selectedPrice.toLocaleString()}</span>
                                            <span className="payment-summary-card__fee-info" style={{ color: 'var(--primary-color)', opacity: 1, fontWeight: '800', fontSize: '0.75rem' }}>+ ₱{CONVENIENCE_FEE} Convenience Fee</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Add-ons Selection (Standardized placement) ── */}
                        <div className="payment-form-section" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
                            <p className="payment-form-section__title">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                                Optional Add-ons
                            </p>
                            <div className="addon-selection-grid">
                                {DEFAULT_ADDONS.map(addon => {
                                    const isSelected = formData.addons.some(a => a.id === addon.id);
                                    return (
                                        <div 
                                            key={addon.id} 
                                            className={`addon-card${isSelected ? ' selected' : ''}`}
                                            onClick={() => toggleAddon(addon)}
                                        >
                                            <div className="addon-icon">{addon.icon}</div>
                                            <div className="addon-info">
                                                <div className="addon-name">{addon.name}</div>
                                                <div className="addon-price">₱{addon.price.toLocaleString()}</div>
                                            </div>
                                            <div className="addon-check">
                                                {isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── Payment Breakdown ── */}
                        <div className="payment-breakdown">
                            <span className="breakdown-title">Final Billing Breakdown</span>
                            <div className="breakdown-row">
                                <span>Course Fee ({formData.courseType || 'Standard'})</span>
                                <span>₱{selectedPrice.toLocaleString()}</span>
                            </div>
                            {formData.addons.map(a => (
                                <div key={a.id} className="breakdown-row">
                                    <span>{a.name}</span>
                                    <span>₱{a.price.toLocaleString()}</span>
                                </div>
                            ))}
                            <div className="breakdown-row" style={{ marginTop: '5px', paddingTop: '5px', borderTop: '1px dashed #e2e8f0' }}>
                                <span style={{ color: '#64748b' }}>Subtotal</span>
                                <span style={{ color: '#64748b' }}>₱{subtotal.toLocaleString()}</span>
                            </div>
                            <div className="breakdown-row" style={{ color: '#059669', fontWeight: '600' }}>
                                <span>3% Discount (Walk-In Promo)</span>
                                <span>- ₱{discount.toLocaleString()}</span>
                            </div>
                            <div className="breakdown-row">
                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    Convenience Fee
                                    <span style={{ fontSize: '0.65rem', padding: '1px 5px', color: '#1a4fba', border: '1px solid #1a4fba', borderRadius: '4px' }}>SEPARATE</span>
                                </span>
                                <span>₱{CONVENIENCE_FEE.toLocaleString()}</span>
                            </div>
                            <div className="breakdown-row total">
                                <span>Total Amount Due</span>
                                <span>₱{totalAmount.toLocaleString()}</span>
                            </div>

                            {formData.paymentStatus === 'Downpayment' && (
                                <div className="breakdown-row dpt-badge" style={{ marginTop: '10px', background: '#fffbeb', padding: '10px', borderRadius: '8px', border: '1px solid #fde68a' }}>
                                    <div>
                                        <div style={{ fontWeight: '700', color: '#92400e', fontSize: '0.85rem' }}>DOWNPAYMENT (DPT) MODE</div>
                                        <div style={{ fontSize: '0.75rem', color: '#b45309' }}>50% of total amount required today</div>
                                    </div>
                                    <div style={{ fontWeight: '800', color: '#92400e', fontSize: '1.1rem' }}>₱{requiredAmount.toLocaleString()}</div>
                                </div>
                            )}
                        </div>

                        {/* ── Payment Form ── */}
                        <div className="payment-form-section">
                            <p className="payment-form-section__title">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                                Branch & Payment Method
                            </p>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Branch</label>
                                    <select
                                        name="branchId"
                                        value={formData.branchId}
                                        onChange={(e) => {
                                            const branch = branches.find(b => b.id === parseInt(e.target.value));
                                            setFormData(prev => ({ 
                                                ...prev, 
                                                branchId: e.target.value, 
                                                branchName: branch ? branch.name : '',
                                                zipCode: (branch && !prev.zipCode) ? getZipForBranch(branch.name) : prev.zipCode
                                            }));
                                        }}
                                        disabled={adminProfile?.rawRole === 'staff'}
                                    >
                                        {branches.map(b => <option key={b.id} value={b.id}>{formatBranchName(b.name)}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Payment Method</label>
                                    <select name="paymentMethod" value={formData.paymentMethod} onChange={handleChange}>
                                        <option value="Cash">Cash</option>
                                        <option value="Starpay">Starpay</option>
                                        <option value="MetroBank">MetroBank</option>
                                    </select>
                                </div>
                                {['Starpay', 'MetroBank'].includes(formData.paymentMethod) && (
                                    <div className="form-group">
                                        <label>
                                            Transaction No.
                                            <span style={{ color: 'red', marginLeft: '2px' }}>*</span>
                                            <span className="field-hint">{formData.paymentMethod} reference</span>
                                        </label>
                                        <input type="text" name="transactionNo" value={formData.transactionNo} onChange={handleChange} placeholder={`Enter ${formData.paymentMethod} transaction number`} required />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="payment-form-section">
                            <p className="payment-form-section__title">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                                Amount & Status
                            </p>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>
                                        Amount Paid (₱)
                                        {formData.paymentStatus === 'Downpayment' && (
                                            <span className="field-hint">50% — ₱{requiredAmount.toLocaleString()} required</span>
                                        )}
                                    </label>
                                    <input type="number" name="amountPaid" value={formData.amountPaid} onChange={handleChange} placeholder={`₱${requiredAmount.toLocaleString()}`} required />
                                    {formData.amountPaid && Number(formData.amountPaid) >= requiredAmount && (
                                        <div className="amount-required-row">
                                            <span className="amount-required-row__label">Required</span>
                                            <span className="amount-required-row__value">₱{requiredAmount.toLocaleString()}</span>
                                            {change > 0 && (
                                                <span className="amount-change-badge">Change: ₱{change.toLocaleString()}</span>
                                            )}
                                        </div>
                                    )}
                                    {formData.amountPaid && Number(formData.amountPaid) > 0 && Number(formData.amountPaid) < requiredAmount && (
                                        <div className="amount-required-row amount-required-row--short">
                                            <span className="amount-required-row__label">Still needed</span>
                                            <span className="amount-required-row__value">₱{(requiredAmount - Number(formData.amountPaid)).toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Payment Status</label>
                                    <select name="paymentStatus" value={formData.paymentStatus} onChange={handleChange}>
                                        <option value="Full Payment">Full Payment</option>
                                        <option value="Downpayment">Downpayment</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {(() => {
                        const paid = Number(formData.amountPaid);
                        const hasAmount = formData.amountPaid !== '' && !isNaN(paid) && paid > 0;
                        const isEnough = hasAmount && paid >= requiredAmount;
                        const needsTxn = ['Starpay', 'MetroBank'].includes(formData.paymentMethod);
                        const hasTxn = !!(formData.transactionNo && formData.transactionNo.trim());
                        const canProceed = isEnough && (!needsTxn || hasTxn);

                        let hint = null;
                        if (!hasAmount) hint = 'Enter the amount paid to continue.';
                        else if (!isEnough) hint = `Amount is short by ₱${(requiredAmount - paid).toLocaleString()}.`;
                        else if (needsTxn && !hasTxn) hint = `Enter the ${formData.paymentMethod} transaction number to continue.`;

                        return (
                            <>
                                <div className="step-actions">
                                    <button type="button" onClick={prevStep} className="back-btn">
                                        <svg className="mr-2" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                        Back
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => canProceed && nextStep()}
                                        className="next-btn"
                                        disabled={!canProceed}
                                        style={{ opacity: canProceed ? 1 : 0.45, cursor: canProceed ? 'pointer' : 'not-allowed' }}
                                    >
                                        Review Enrollment
                                        <svg className="ml-2" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                </div>
                                {hint && <p className="step4-hint">{hint}</p>}
                            </>
                        );
                    })()}
                </div>
            );
        };

        const renderStep5 = () => (
            <div className="step-content animate-fadeIn">
                <div className="section-title">
                    <span className="step-badge">5</span>
                    <h3>Review Details</h3>
                </div>

                <div className="review-container">
                    <div className="review-section">
                        <h4>Student Info</h4>
                        <p><strong>Name:</strong> {formData.firstName} {formData.middleName} {formData.lastName}</p>
                        <p><strong>Contact:</strong> {formData.contactNumbers} | {formData.email}</p>
                        <p><strong>Address:</strong> {formData.address}</p>
                    </div>
                    <div className="review-section">
                        <h4>Course & Branch</h4>
                        <p><strong>Course:</strong> {formData.course?.name}</p>
                        <p><strong>Type:</strong> {formData.courseType}</p>
                        {formData.addons.length > 0 && <p><strong>Add-ons:</strong> {formData.addons.map(a => a.name).join(', ')}</p>}
                        <p><strong>Branch:</strong> {formatBranchName(formData.branchName)}</p>
                    </div>
                    <div className="review-section">
                        <h4>Schedule</h4>
                        {isPromo ? (
                            <>
                                <p style={{ fontWeight: '700', color: 'var(--primary-color)', marginBottom: '4px', fontSize: '0.85rem' }}>TDC:</p>
                                <p><strong>Date:</strong> {formData.scheduleDate ? new Date(formData.scheduleDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not selected'}</p>
                                <p><strong>Session:</strong> {formData.scheduleSession || 'Not selected'}</p>
                                <p><strong>Time:</strong> {formData.scheduleTime || 'Not selected'}</p>
                                <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '10px 0' }} />
                                <p style={{ fontWeight: '700', color: 'var(--primary-color)', marginBottom: '4px', fontSize: '0.85rem' }}>PDC{formData.promoPdcSlotId2 ? ' — Day 1' : ''}:</p>
                                <p><strong>Date:</strong> {formData.scheduleDate2 ? new Date(formData.scheduleDate2 + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not selected'}</p>
                                <p><strong>Session:</strong> {formData.scheduleSession2 || 'Not selected'}</p>
                                <p><strong>Time:</strong> {formData.scheduleTime2 || 'Not selected'}</p>
                                {formData.promoPdcSlotId2 && (
                                    <>
                                        <p style={{ fontWeight: '700', color: 'var(--primary-color)', marginBottom: '4px', marginTop: '8px', fontSize: '0.85rem' }}>PDC — Day 2:</p>
                                        <p><strong>Date:</strong> {new Date(formData.promoPdcDate2 + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                                        <p><strong>Session:</strong> {formData.promoPdcSession2}</p>
                                        <p><strong>Time:</strong> {formData.promoPdcTime2}</p>
                                    </>
                                )}
                            </>
                        ) : formData.scheduleDate2 ? (
                            <>
                                <p style={{ fontWeight: '600', color: 'var(--primary-color)', marginBottom: '4px', fontSize: '0.85rem' }}>Day 1:</p>
                                <p><strong>Date:</strong> {formData.scheduleDate ? new Date(formData.scheduleDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not selected'}</p>
                                <p><strong>Session:</strong> {formData.scheduleSession || 'Not selected'}</p>
                                <p><strong>Time:</strong> {formData.scheduleTime || 'Not selected'}</p>
                                <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '10px 0' }} />
                                <p style={{ fontWeight: '600', color: 'var(--primary-color)', marginBottom: '4px', fontSize: '0.85rem' }}>Day 2:</p>
                                <p><strong>Date:</strong> {new Date(formData.scheduleDate2 + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                                <p><strong>Session:</strong> {formData.scheduleSession2 || 'Not selected'}</p>
                                <p><strong>Time:</strong> {formData.scheduleTime2 || 'Not selected'}</p>
                            </>
                        ) : (
                            <>
                                <p><strong>Date:</strong> {formData.scheduleDate ? new Date(formData.scheduleDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not selected'}</p>
                                <p><strong>Session:</strong> {formData.scheduleSession || 'Not selected'}</p>
                                <p><strong>Time:</strong> {formData.scheduleTime || 'Not selected'}</p>
                            </>
                        )}
                    </div>
                    <div className="review-section">
                        <h4>Payment Summary</h4>
                        <div className="review-payment-grid">
                            <p><strong>Method:</strong> {formData.paymentMethod}</p>
                            {['GCash', 'Starpay'].includes(formData.paymentMethod) && (
                                <p><strong>Transaction No:</strong> {formData.transactionNo}</p>
                            )}
                            <p><strong>Payment Status:</strong> {formData.paymentStatus}</p>
                            <p><strong>Amount Paid Today:</strong> ₱{Number(formData.amountPaid).toLocaleString()}</p>
                            {formData.paymentStatus === 'Downpayment' && (
                                <p style={{ color: '#b45309', fontWeight: '700' }}>
                                    <strong>Remaining Balance:</strong> ₱{balanceDue.toLocaleString()}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="step-actions">
                    <button type="button" onClick={prevStep} className="back-btn" disabled={loading}>
                        <svg className="mr-2" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                    </button>
                    <button type="button" onClick={handleSubmit} className="submit-enroll-btn" disabled={loading} style={{ opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                        {loading ? (
                            <>
                                <svg className="mr-2 spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ animation: 'spin 1s linear infinite' }}>
                                    <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing...
                            </>
                        ) : (
                            <>
                                <svg className="mr-2" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Confirm & Enroll
                            </>
                        )}
                    </button>
                </div>
            </div>
        );

        return (
            <div className="walk-in-container slide-up">
                <div className="walk-in-header">
                    <div className="header-info">
                        <h2>Walk-in Enrollment</h2>
                        <p>Physical registration for students at the branch</p>
                    </div>
                    <div className="step-indicator">
                        <div className={`step-dot ${step >= 1 ? 'active' : ''}`}>1</div>
                        <div className={`step-line ${step >= 2 ? 'active' : ''}`}></div>
                        <div className={`step-dot ${step >= 2 ? 'active' : ''}`}>2</div>
                        <div className={`step-line ${step >= 3 ? 'active' : ''}`}></div>
                        <div className={`step-dot ${step >= 3 ? 'active' : ''}`}>3</div>
                        <div className={`step-line ${step >= 4 ? 'active' : ''}`}></div>
                        <div className={`step-dot ${step >= 4 ? 'active' : ''}`}>4</div>
                        <div className={`step-line ${step >= 5 ? 'active' : ''}`}></div>
                        <div className={`step-dot ${step >= 5 ? 'active' : ''}`}>5</div>
                    </div>
                </div>

                <div className="enrollment-wizard">
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && renderStep3()}
                    {step === 4 && renderStep4()}
                    {step === 5 && renderStep5()}
                </div>
            </div>
        );
    };

    export default WalkInEnrollment;