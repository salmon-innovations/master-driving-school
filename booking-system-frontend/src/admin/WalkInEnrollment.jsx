import React, { useState, useEffect, useRef } from 'react';
import { useNotification } from '../context/NotificationContext';
import { branchesAPI, coursesAPI, schedulesAPI, adminAPI } from '../services/api';
import './css/walkInEnrollment.css';
import { getZipFromAddress } from '../utils/philippineZipCodes';
import NationalitySelect from '../components/NationalitySelect';

const logo = '/images/logo.png';

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

    // Regular PDC Step 3: vehicle type + transmission tracked separately before combining into courseType
    const [pdcVehicleType, setPdcVehicleType] = useState(''); // e.g. 'car', 'motorcycle', 'tricycle', 'b1b2'
    const [pdcTransmission, setPdcTransmission] = useState(''); // 'mt' | 'at' | ''

    // Student search / auto-fill state
    const [studentSearchQuery, setStudentSearchQuery] = useState('');
    const [studentSearchResults, setStudentSearchResults] = useState([]);
    const [studentSearchLoading, setStudentSearchLoading] = useState(false);
    const [showStudentDropdown, setShowStudentDropdown] = useState(false);
    const [selectedStudentId, setSelectedStudentId] = useState(null);

    const [promoStep, setPromoStep] = useState(() => {
        try { return parseInt(sessionStorage.getItem('walkin_promoStep') || '1', 10) || 1; } catch { return 1; }
    });
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
    const [promoPdcSelections, setPromoPdcSelections] = useState(() => {
        try {
            const saved = sessionStorage.getItem('walkin_promoPdcSelections');
            return saved ? JSON.parse(saved) : {};
        } catch { return {}; }
    });
    const [activePromoPdcCourseId, setActivePromoPdcCourseId] = useState(null);
    const isHydratingPromoPdcRef = useRef(false);

    const defaultFormData = {
        firstName: '', middleName: '', lastName: '', age: '', gender: '', birthday: '', nationality: '', maritalStatus: '',
        address: '', zipCode: '', birthPlace: '', contactNumbers: '', email: '', emergencyContactPerson: '', emergencyContactNumber: '',
        course: null, courseType: '', 
        branchId: adminProfile?.branchId ? String(adminProfile.branchId) : '', 
        branchName: adminProfile?.branch || '',
        promoTdcType: '',
        selectedCourses: [],
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

        // Add main course type with its price (branch-adjusted)
        if (course.course_type) {
            typeOptions.push({
                value: course.course_type.toLowerCase().replace(/\s+/g, '-'),
                label: course.course_type.toUpperCase(),
                price: branchEffectivePrice,
                original_price: branchEffectivePrice,
                discount: discount
            });
        }

        // Add pricing variations as additional type options
        if (course.pricing_data && Array.isArray(course.pricing_data)) {
            course.pricing_data.forEach(variation => {
                const varPrice = parseFloat(variation.price) || 0;
                typeOptions.push({
                    value: variation.type.toLowerCase().replace(/\s+/g, '-'),
                    label: variation.type.toUpperCase(),
                    price: varPrice,
                    original_price: varPrice,
                    discount: discount
                });
            });
        }

        // If no type options, create a default one
        if (typeOptions.length === 0) {
            typeOptions.push({
                value: 'standard',
                label: 'STANDARD',
                price: branchEffectivePrice,
                original_price: branchEffectivePrice,
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
            price: branchEffectivePrice - discount,
            original_price: branchEffectivePrice,
            course_type: course.course_type || '',
            description: course.description || 'Professional driving course with comprehensive training'
        };
    });

    // Persist step, formData, promoStep and promoPdcSelections to sessionStorage on every change
    useEffect(() => {
        try { sessionStorage.setItem('walkin_step', String(step)); } catch { }
    }, [step]);

    useEffect(() => {
        try { sessionStorage.setItem('walkin_formData', JSON.stringify(formData)); } catch { }
    }, [formData]);

    useEffect(() => {
        try { sessionStorage.setItem('walkin_promoStep', String(promoStep)); } catch { }
    }, [promoStep]);

    useEffect(() => {
        try { sessionStorage.setItem('walkin_promoPdcSelections', JSON.stringify(promoPdcSelections)); } catch { }
    }, [promoPdcSelections]);

    // Lifecycle: keep state during SPA navigation (sidebar click)
    // Only clear if the user explicitly refreshes or closes the tab if desired, 
    // but the user wants it to stay when clicking sidebar.
    useEffect(() => {
        // We no longer clear the state on unmount.
        // This ensures that navigating to other admin pages and back preserves progress.
    }, []);

    useEffect(() => {
        if (adminProfile?.branchId && !formData.branchId) {
            setFormData(prev => ({
                ...prev,
                branchId: String(adminProfile.branchId),
                branchName: adminProfile.branch || ''
            }));
        }
    }, [adminProfile, formData.branchId]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [branchResponse, coursesResponse] = await Promise.all([
                    branchesAPI.getAll(),
                    coursesAPI.getAll()
                ]);

                if (branchResponse.success) {
                    setBranches(branchResponse.branches);

                    // Admin with assigned branch: auto-select and lock their assigned branch
                    // Super admin or admin with all-branch scope: default to first branch and can change
                    if (adminProfile?.rawRole === 'admin' && adminProfile?.branchId) {
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

                if (coursesResponse.success) {
                    // Only show active courses
                    const activeCourses = coursesResponse.courses.filter(c => c.status === 'active');
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

    const getSlotKind = (slot) => {
        const rawType = String(slot?.type || '').toLowerCase();
        if (rawType.includes('tdc') || rawType.includes('theoretical')) return 'TDC';
        if (rawType.includes('pdc') || rawType.includes('practical')) return 'PDC';

        // Fallback: infer from course_type when type is inconsistent/missing.
        const rawCourseType = String(slot?.course_type || '').toLowerCase();
        if (rawCourseType.includes('online') || rawCourseType.includes('f2f')) return 'TDC';
        if (rawCourseType.includes('motorcycle') || rawCourseType.includes('moto') || rawCourseType.includes('tricycle') || rawCourseType.includes('b1') || rawCourseType.includes('b2') || rawCourseType.includes('van') || rawCourseType.includes('l300') || rawCourseType.includes('car') || rawCourseType.includes('manual') || rawCourseType.includes('automatic')) return 'PDC';

        return null;
    };

    const partitionSlotsByKind = (slots = []) => {
        const tdc = [];
        const pdc = [];
        slots.forEach((slot) => {
            const kind = getSlotKind(slot);
            if (kind === 'TDC') tdc.push(slot);
            if (kind === 'PDC') pdc.push(slot);
        });
        return { tdc, pdc };
    };

    const mergeSlotsById = (...slotGroups) => {
        const map = new Map();
        slotGroups.flat().forEach((slot) => {
            if (!slot) return;
            const key = String(slot.id ?? `${slot.date}-${slot.time_range}-${slot.course_type}-${slot.session}`);
            if (!map.has(key)) map.set(key, slot);
        });
        return [...map.values()];
    };

    const isSlotOpen = (slot) => {
        const available = Number(slot?.available_slots);
        if (Number.isFinite(available)) return available > 0;

        const capacity = Number(slot?.total_capacity);
        if (Number.isFinite(capacity)) return capacity > 0;

        // If backend payload misses both, don't hard-fail the course card.
        return true;
    };

    const isTDC = formData.course?.category === 'TDC';
    const isPromo = formData.course?.category === 'Promo' || formData.course?.category === 'Bundle';
    const promoDerivedTdcType = isPromo ? (() => {
        const raw = String(formData.course?.course_type || '').toUpperCase();
        if (!raw.includes('+')) return 'F2F';
        const tdcPart = raw.split('+')[0];
        if (tdcPart.includes('ONLINE') || tdcPart.includes('OTDC')) return 'ONLINE';
        if (tdcPart.includes('F2F')) return 'F2F';
        return tdcPart.trim() || 'F2F';
    })() : null;
    const promoTdcType = isPromo ? (formData.promoTdcType || promoDerivedTdcType) : null;
    const promoPdcType = isPromo ? (formData.course?.course_type?.split('+')[1] || 'Motorcycle') : null;
    const promoTdcTypeOptions = isPromo ? (() => {
        const fixedTdcType = String(promoDerivedTdcType || '').toUpperCase();
        if (fixedTdcType === 'F2F') return ['F2F'];
        if (fixedTdcType === 'ONLINE') return ['ONLINE'];

        const opts = formData.course?._tdcCourse?.typeOptions || [];
        const hasOnline = opts.some(opt => (opt.label || '').toLowerCase().includes('online') || (opt.value || '').toLowerCase().includes('online'));
        const hasF2f = opts.some(opt => {
            const str = ((opt.label || '') + ' ' + (opt.value || '')).toLowerCase();
            return str.includes('f2f') || str.includes('face to face') || str.includes('face-to-face');
        });
        const types = [];
        if (hasF2f) types.push('F2F');
        if (hasOnline) types.push('ONLINE');
        return types.length > 0 ? types : ['F2F', 'ONLINE'];
    })() : [];

    const isOnlineTdcNoSchedule = (isTDC || isPromo) && (() => {
        // Selected type / explicit promoTdcType signals (highest priority, always honoured)
        if (String(formData.courseType || '').toLowerCase().includes('online')) return true;
        if (String(formData.courseType || '').toLowerCase().includes('otdc')) return true;
        if (String(formData.promoTdcType || '').toLowerCase().includes('online')) return true;
        if (String(formData.promoTdcType || '').toLowerCase().includes('otdc')) return true;

        // For PROMO courses: course_type (bundle key from Config) is the ONLY authoritative source.
        // NEVER read course.name — the admin can freely rename "FREE TDC + PDC MOTOR MANUAL"
        // to anything (e.g. "OTDC + 4 PDC") without changing the actual TDC type.
        if (isPromo) {
            const bundleKey = String(formData.course?.course_type || '').toLowerCase();
            const tdcPart = bundleKey.split('+')[0].trim();
            if (tdcPart.includes('online') || tdcPart.includes('otdc')) return true;
            if (String(promoDerivedTdcType || '').toLowerCase().includes('online')) return true;
            return false; // F2F or unknown → NOT online
        }

        // For regular TDC courses: course_type then fall back to name/shortName
        if (String(formData.course?.course_type || '').toLowerCase().includes('otdc')) return true;
        if (String(formData.course?.course_type || '').toLowerCase().includes('online')) return true;
        if (String(formData.course?.name || '').toLowerCase().includes('otdc')) return true;
        if (String(formData.course?.shortName || '').toLowerCase().includes('otdc')) return true;

        return false;
    })();

    useEffect(() => {
        const hasTdc = !!formData.course?._tdcCourse;
        if (isPromo && (!hasTdc || isOnlineTdcNoSchedule) && promoStep === 1) {
            setPromoStep(2);
        }
    }, [isPromo, isOnlineTdcNoSchedule, promoStep, formData.course]);

    const getPromoPdcCourseKey = (item) => `${item?.id || 'na'}::${(item?.name || '').toLowerCase()}::${(item?.course_type || '').toLowerCase()}`;

    const getPromoPdcCourseMeta = (item) => {
        const label = `${item?.name || ''} ${item?.shortName || ''} ${item?.course_type || ''}`.toLowerCase();

        const hasAT = /(^|\W)(at|a\/t|automatic)($|\W)/i.test(label);
        const hasMT = /(^|\W)(mt|manual)($|\W)/i.test(label);

        const isB1B2 = /(^|\W)(b1|b2|van|l300)($|\W)/i.test(label);
        const isTricycle = /(^|\W)(a1|tricycle)($|\W)/i.test(label);
        const isMotorcycle = /(^|\W)(motorcycle|motor|moto|bike)($|\W)/i.test(label) && !isTricycle;

        if (isB1B2) {
            return {
                kind: 'B1B2',
                label: 'B1 VAN / B2 L300',
                fixedTransmission: null,
                preferredTransmission: null,
            };
        }

        if (isTricycle) {
            return {
                kind: 'Tricycle',
                label: 'Tricycle',
                fixedTransmission: null,
                preferredTransmission: null,
            };
        }

        if (isMotorcycle) {
            return {
                kind: 'Motorcycle',
                label: 'Motorcycle',
                fixedTransmission: null,
                preferredTransmission: hasAT ? 'AT' : hasMT ? 'MT' : null,
            };
        }

        if (hasAT) {
            return { kind: 'Car', label: 'Car', fixedTransmission: null, preferredTransmission: 'AT' };
        }
        if (hasMT) {
            return { kind: 'Car', label: 'Car', fixedTransmission: null, preferredTransmission: 'MT' };
        }

        return { kind: 'Car', label: 'Car', fixedTransmission: null, preferredTransmission: null };
    };

    const getPromoPdcGroupKey = (item) => {
        const kind = getPromoPdcCourseMeta(item).kind;
        if (kind === 'CarAT' || kind === 'CarMT') return 'Car';
        return kind;
    };

    const getPromoTransmissionCode = (value) => {
        const label = String(value || '').toLowerCase();
        if (!label) return null;
        const hasAT = /(^|\W)(at|a\/t|automatic)($|\W)/i.test(label);
        const hasMT = /(^|\W)(mt|manual)($|\W)/i.test(label);
        if (hasAT && !hasMT) return 'AT';
        if (hasMT && !hasAT) return 'MT';
        return null;
    };

    const isHalfDaySession = (session) => {
        const s = String(session || '').toLowerCase();
        return s.includes('morning') || s.includes('afternoon') || s.includes('4 hours');
    };

    // --- PDC type-selector helpers (regular/walk-in Step 3 only) ---
    // Maps a PDC typeOption value to a vehicle category key.
    // courseName is used as a fallback when the option value has no explicit vehicle keyword
    // (e.g., a Motorcycle PDC course that stores its options as just "Manual"/"Automatic").
    const getPdcVehicleGroup = (optValue, courseName = '') => {
        const v = String(optValue || '').toLowerCase().replace(/-/g, ' ');
        const c = String(courseName || '').toLowerCase();
        // Check option value first for explicit vehicle keywords
        if (/(motorcycle|motor|moto|bike)/.test(v)) return 'motorcycle';
        if (/(tricycle|a1[^0-9]|v1[^0-9])/.test(v)) return 'tricycle';
        if (/(b1|b2|van|l300)/.test(v)) return 'b1b2';
        // If option value is generic (only transmission words like manual/automatic),
        // fall back to course name to determine the correct vehicle group.
        if (/(motorcycle|motor|moto|bike)/.test(c)) return 'motorcycle';
        if (/(tricycle|a1[^0-9]|v1[^0-9])/.test(c)) return 'tricycle';
        if (/(b1|b2|van|l300)/.test(c)) return 'b1b2';
        return 'car'; // default — Car PDC
    };
    // Extracts transmission code ('mt', 'at', or null) from a PDC typeOption value.
    const getPdcTxFromOption = (optValue) => {
        const v = String(optValue || '').toLowerCase().replace(/-/g, ' ');
        if (/\bautomatic\b|\bat\b/.test(v)) return 'at';
        if (/\bmanual\b|\bmt\b/.test(v)) return 'mt';
        return null;
    };

    const parsePromoPdcParts = (courseTypeValue) => {
        const raw = String(courseTypeValue || '');
        const plusIndex = raw.indexOf('+');
        if (plusIndex < 0) return [];
        const pdcRaw = raw.slice(plusIndex + 1).trim();
        if (!pdcRaw) return [];

        const parts = pdcRaw
            .split('|')
            .map(part => String(part || '').trim())
            .filter(Boolean);

        // Expand patterns like "4 PDC" or "2 PDC" into separate items
        const expandedParts = [];
        parts.forEach(part => {
            const match = part.match(/^(\d+)\s*PDC$/i);
            if (match) {
                const count = parseInt(match[1], 10);
                for (let i = 0; i < count; i++) {
                    expandedParts.push('PDC');
                }
            } else {
                expandedParts.push(part);
            }
        });

        return expandedParts;
    };

    const buildFallbackPromoPdcCourse = (promoCourse, part, index) => {
        const meta = getPromoPdcCourseMeta({ name: part, shortName: part, course_type: part });
        return {
            id: `promo-${promoCourse?.id || 'na'}-pdc-${index}`,
            name: `Practical Driving Course - ${meta.label}`,
            shortName: meta.label,
            category: 'PDC',
            course_type: part,
            duration: '8 Hours',
            price: 0,
            original_price: 0,
            typeOptions: [],
        };
    };

    const enrichSinglePromoCourse = (promoCourse) => {
        if (!promoCourse || promoCourse.category !== 'Promo') return promoCourse;
        // Always re-resolve — don't short-circuit based on stale sessionStorage data.
        // (Old _pdcCourses from a previous run may have wrong count or wrong IDs.)

        const promoType = String(promoCourse.course_type || '').toUpperCase();
        const tdcRaw = promoType.includes('+') ? promoType.split('+')[0] : '';
        const tdcPart = (tdcRaw.includes('ONLINE') || tdcRaw.includes('OTDC')) ? 'ONLINE' : tdcRaw.includes('F2F') ? 'F2F' : tdcRaw.trim();
        const parsedPdcParts = parsePromoPdcParts(promoCourse.course_type);

        const allTdcCourses = packages.filter(pkg => pkg.category === 'TDC');
        const allPdcCourses = packages.filter(pkg => pkg.category === 'PDC');

        const resolvedTdc = allTdcCourses.find((pkg) => {
            const labels = (pkg.typeOptions || []).map(opt => String(opt.label || '').toLowerCase());
            if (tdcPart === 'ONLINE') return labels.some(label => label.includes('online'));
            if (tdcPart === 'F2F') return labels.some(label => label.includes('f2f') || label.includes('face to face') || label.includes('face-to-face'));
            return false;
        }) || allTdcCourses[0] || null;

        const resolvedPdc = parsedPdcParts.map((part, index) => {
            const desiredMeta = getPromoPdcCourseMeta({ name: part, shortName: part, course_type: part });
            let best = null;
            let bestScore = -1;

            allPdcCourses.forEach((pkg) => {
                const meta = getPromoPdcCourseMeta(pkg);

                let score = 0;
                if (meta.kind === desiredMeta.kind) score += 5;

                if (score <= 0) return;

                const searchable = `${pkg.name || ''} ${pkg.shortName || ''} ${pkg.course_type || ''}`.toLowerCase();
                const token = String(part || '').toLowerCase();
                if (token && searchable.includes(token)) score += 1;

                if (score > bestScore) {
                    bestScore = score;
                    best = pkg;
                }
            });

            return best || buildFallbackPromoPdcCourse(promoCourse, part, index + 1);
        }).filter(Boolean);

        return {
            ...promoCourse,
            _tdcCourse: promoCourse._tdcCourse || resolvedTdc,
            _pdcCourse: promoCourse._pdcCourse || resolvedPdc[0] || null,
            _pdcCourses: resolvedPdc,
        };
    };

    const promoPdcCourses = isPromo
        ? (() => {
            const isManualBundle = !!formData.course?._isManualBundle;
            // Always re-enrich the promo course from the live packages list so that
            // "4 PDC" is always expanded into 4 tracks, regardless of what was cached
            // in sessionStorage (which may have had a stale 1-track _pdcCourses).
            const freshCourse = isManualBundle ? formData.course : enrichSinglePromoCourse(formData.course);
            const source = (freshCourse?._pdcCourses && freshCourse._pdcCourses.length > 0
                ? freshCourse._pdcCourses
                : freshCourse?._pdcCourse
                    ? [freshCourse._pdcCourse]
                    : parsePromoPdcParts(formData.course?.course_type).map((part, index) =>
                        buildFallbackPromoPdcCourse(formData.course, part, index + 1)
                    ));

            // Bundle definition is the source of truth for allowed transmissions.
            const bundleTransmissionsByGroup = new Map();
            parsePromoPdcParts(formData.course?.course_type).forEach((part) => {
                const partMeta = getPromoPdcCourseMeta({ name: part, shortName: part, course_type: part });
                const groupKey = getPromoPdcGroupKey({ name: part, shortName: part, course_type: part });
                const supportsTransmission = partMeta.kind === 'Car' || partMeta.kind === 'CarAT' || partMeta.kind === 'CarMT' || partMeta.kind === 'Motorcycle';
                if (!supportsTransmission) return;

                const tx = getPromoTransmissionCode(part) || partMeta.preferredTransmission;
                if (!tx) return;
                if (!bundleTransmissionsByGroup.has(groupKey)) {
                    bundleTransmissionsByGroup.set(groupKey, new Set());
                }
                bundleTransmissionsByGroup.get(groupKey).add(tx);
            });

            const grouped = [];
            const seenGroups = new Set();
            const transmissionsByGroup = new Map();

            source.forEach((item, index) => {
                const meta = getPromoPdcCourseMeta(item);
                const groupKey = isManualBundle ? getPromoPdcCourseKey(item) : getPromoPdcGroupKey(item);
                const tx = meta.preferredTransmission || getPromoTransmissionCode(`${item?.course_type || ''} ${item?.name || ''} ${item?.shortName || ''}`);
                if (tx) {
                    if (!transmissionsByGroup.has(groupKey)) {
                        transmissionsByGroup.set(groupKey, new Set());
                    }
                    transmissionsByGroup.get(groupKey).add(tx);
                }
            });

            source.forEach((item, index) => {
                const meta = getPromoPdcCourseMeta(item);
                // Use a combination of groupKey AND index for the unique track key to allow multiple courses of same vehicle type
                const trackKey = `${isManualBundle ? getPromoPdcCourseKey(item) : getPromoPdcGroupKey(item)}-${index}`;
                const groupKey = isManualBundle ? getPromoPdcCourseKey(item) : getPromoPdcGroupKey(item);

                const txSet = transmissionsByGroup.get(groupKey);
                const hasTxControl = meta.kind === 'Car' || meta.kind === 'CarAT' || meta.kind === 'CarMT' || meta.kind === 'Motorcycle';
                const txFromBundle = bundleTransmissionsByGroup.get(groupKey);
                const allowBothForManualBundle = isManualBundle && (meta.kind === 'Car' || meta.kind === 'CarAT' || meta.kind === 'CarMT' || meta.kind === 'Motorcycle');
                const allowedTransmissions = hasTxControl
                    ? (allowBothForManualBundle
                        ? ['MT', 'AT']
                        : (txFromBundle && txFromBundle.size > 0
                            ? [...txFromBundle]
                            : (txSet && txSet.size > 0 ? [...txSet] : ['MT', 'AT'])))
                    : [];
                const fixedTransmission = allowBothForManualBundle
                    ? null
                    : (hasTxControl && allowedTransmissions.length === 1 ? allowedTransmissions[0] : null);

                grouped.push({
                    ...item,
                    _pdcKey: trackKey,
                    _pdcKind: meta.kind,
                    _pdcLabel: meta.label,
                    _fixedTransmission: fixedTransmission || meta.fixedTransmission,
                    _preferredTransmission: meta.preferredTransmission || fixedTransmission,
                    _allowedTransmissions: allowedTransmissions,
                });
            });

            return grouped;
        })()
        : [];
    // For Walk-In enrollments, we do NOT lock PDC scheduling even if TDC is Online.
    // Staff should have full control to book everything immediately.
    const isPromoOnlineTdcLockedBundle = false;

    const activePromoPdcCourse = promoPdcCourses.find(c => c._pdcKey === activePromoPdcCourseId) || promoPdcCourses[0] || null;
    const activePromoPdcCourseKey = activePromoPdcCourse?._pdcKey || null;

    const activePromoPdcType = activePromoPdcCourse
        ? activePromoPdcCourse._pdcKind
        : promoPdcType;

    const allowedPromoPdcTransmissions = activePromoPdcCourse?._allowedTransmissions || ['MT', 'AT'];
    const fixedPromoPdcTransmission = activePromoPdcCourse?._fixedTransmission || null;
    const effectivePromoPdcTransmission = fixedPromoPdcTransmission || promoPdcMotorType || (allowedPromoPdcTransmissions.length === 1 ? allowedPromoPdcTransmissions[0] : null);
    const showsTransmissionSelector = ['Motorcycle', 'Car', 'CarAT', 'CarMT'].includes(activePromoPdcType);
    const requiresTransmissionChoice = showsTransmissionSelector && !fixedPromoPdcTransmission && allowedPromoPdcTransmissions.length > 1;

    const getIsPromoPdcComplete = (courseKey) => {
        const sel = promoPdcSelections[courseKey];
        if (!sel?.scheduleSlotId) return false;
        return !isHalfDaySession(sel.scheduleSession2) || !!sel.promoPdcSlotId2;
    };

    useEffect(() => {
        if (!isPromo) return;
        if (!promoPdcCourses.length) {
            setActivePromoPdcCourseId(null);
            return;
        }
        if (!activePromoPdcCourseId || !promoPdcCourses.some(c => c._pdcKey === activePromoPdcCourseId)) {
            setActivePromoPdcCourseId(promoPdcCourses[0]._pdcKey);
        }
    }, [isPromo, promoPdcCourses, activePromoPdcCourseId]);

    useEffect(() => {
        if (!isPromo || !activePromoPdcCourseKey) return;
        isHydratingPromoPdcRef.current = true;
        const saved = promoPdcSelections[activePromoPdcCourseKey];

        if (!saved) {
            setFormData(prev => ({
                ...prev,
                scheduleSlotId2: null, scheduleDate2: '', scheduleSession2: '', scheduleTime2: '',
                promoPdcSlotId2: null, promoPdcDate2: '', promoPdcSession2: '', promoPdcTime2: ''
            }));
            setPromoPdcDate(null);
            setPromoPdcDate2(null);
            setPromoPdcSelectingDay2(false);
            setPromoPdcMotorType(fixedPromoPdcTransmission || activePromoPdcCourse?._preferredTransmission || null);
            setTimeout(() => { isHydratingPromoPdcRef.current = false; }, 0);
            return;
        }

        setFormData(prev => ({
            ...prev,
            scheduleSlotId2: saved.scheduleSlotId || null,
            scheduleDate2: saved.scheduleDate || '',
            scheduleSession2: saved.scheduleSession2 || '',
            scheduleTime2: saved.scheduleTime2 || '',
            promoPdcSlotId2: saved.promoPdcSlotId2 || null,
            promoPdcDate2: saved.promoPdcDate2 || '',
            promoPdcSession2: saved.promoPdcSession2 || '',
            promoPdcTime2: saved.promoPdcTime2 || ''
        }));
        setPromoPdcDate(saved.scheduleDate ? new Date(`${saved.scheduleDate}T00:00:00`) : null);
        setPromoPdcDate2(saved.promoPdcDate2 ? new Date(`${saved.promoPdcDate2}T00:00:00`) : null);
        setPromoPdcSelectingDay2(saved.selectingDay2 || false);
        setPromoPdcMotorType(saved.transmission || saved.motorType || null);
        setTimeout(() => { isHydratingPromoPdcRef.current = false; }, 0);
    }, [isPromo, activePromoPdcCourseKey, promoPdcSelections, fixedPromoPdcTransmission]);

    useEffect(() => {
        if (!isPromo || !activePromoPdcCourseKey) return;
        if (isHydratingPromoPdcRef.current) return;
        const courseKey = activePromoPdcCourseKey;
        const nextSelection = {
            courseId: activePromoPdcCourse?.id,
            courseName: activePromoPdcCourse?.name,
            courseType: activePromoPdcCourse?.course_type || activePromoPdcType,
            courseTypeDetailed: activePromoPdcCourse?.course_type || activePromoPdcType,
            courseLabel: activePromoPdcCourse?.name || activePromoPdcCourse?._pdcLabel || activePromoPdcType || 'PDC',
            transmission: effectivePromoPdcTransmission || null,
            motorType: effectivePromoPdcTransmission || null,
            scheduleSlotId: formData.scheduleSlotId2,
            scheduleDate: formData.scheduleDate2,
            scheduleSession2: formData.scheduleSession2,
            scheduleTime2: formData.scheduleTime2,
            promoPdcSlotId2: formData.promoPdcSlotId2,
            promoPdcDate2: formData.promoPdcDate2,
            promoPdcSession2: formData.promoPdcSession2,
            promoPdcTime2: formData.promoPdcTime2,
            selectingDay2: promoPdcSelectingDay2,
        };
        setPromoPdcSelections(prev => {
            const prevSelection = prev[courseKey];
            if (prevSelection && JSON.stringify(prevSelection) === JSON.stringify(nextSelection)) {
                return prev;
            }
            return {
                ...prev,
                [courseKey]: nextSelection
            };
        });
    }, [
        isPromo,
        activePromoPdcCourseKey,
        activePromoPdcCourse?.id,
        activePromoPdcCourse?.name,
        activePromoPdcType,
        effectivePromoPdcTransmission,
        formData.scheduleSlotId2,
        formData.scheduleDate2,
        formData.scheduleSession2,
        formData.scheduleTime2,
        formData.promoPdcSlotId2,
        formData.promoPdcDate2,
        formData.promoPdcSession2,
        formData.promoPdcTime2,
        promoPdcSelectingDay2,
    ]);

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
        if (cat !== 'PDC' && cat !== 'Promo' && cat !== 'Bundle') return;
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
        // Use course_type (the bundle/config key) as primary vehicle classifier.
        // Fall back to course.name only when course_type has no vehicle keywords.
        const courseTypeKey = (formData.course.course_type || '').toLowerCase();
        const courseName = (formData.course.name || '').toLowerCase();
        const classifySource = courseTypeKey || courseName;
        const isMoto = classifySource.includes('motorcycle') || classifySource.includes('motor') || classifySource.includes('moto');
        const isTricycle = classifySource.includes('tricycle');
        const isB1B2 = classifySource.includes('b1') || classifySource.includes('b2') ||
            classifySource.includes('van') || classifySource.includes('l300');
        // Determine target transmission — applies to ALL vehicle types (motorcycle, car, etc.)
        const wantsAT = courseTypeVal.includes('automatic') || courseTypeVal === 'carat';
        const wantsMT = !wantsAT && (courseTypeVal.includes('manual') || courseTypeVal === 'carmt');
        const filtered = pdcAllSlots.filter(s => {
            const ct = (s.course_type || '').toLowerCase();
            const tx = (s.transmission || '').toLowerCase();
            // Do not force a strict course-name contains match here.
            // Many slots store generic values (e.g. "manual"/"automatic") in course_type,
            // which previously hid valid slots from Step 3 calendar.
            // Vehicle bucket filter — selectively exclude explicitly wrong vehicle types
            if (isMoto && (ct.includes('car') || ct.includes('b1') || ct.includes('b2') || ct.includes('tricycle') || ct.includes('l300'))) return false;
            if (isTricycle && (ct.includes('motorcycle') || ct.includes('moto') || ct.includes('car') || ct.includes('b1') || ct.includes('b2') || ct.includes('van') || ct.includes('l300'))) return false;
            if (isB1B2 && (ct.includes('motorcycle') || ct.includes('moto') || ct.includes('tricycle') || ct.includes('car'))) return false;
            if (!isMoto && !isTricycle && !isB1B2) {
                // If it's a generic car course (not strictly moto, tricycle, or B1B2)
                if (ct.includes('motorcycle') || ct.includes('moto') || ct.includes('tricycle') || ct.includes('b1') || ct.includes('b2') || ct.includes('van') || ct.includes('l300')) return false;
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
            schedulesAPI.getSlotsByDate(null, formData.branchId, null).catch(() => []),
            schedulesAPI.getSlotsByDate(null, formData.branchId, 'TDC').catch(() => []),
            schedulesAPI.getSlotsByDate(null, formData.branchId, 'PDC').catch(() => []),
        ]).then(([rawAll, rawTdc, rawPdc]) => {
            const allSlots = transformSlots(Array.isArray(rawAll) ? rawAll : []);
            const typedTdc = transformSlots(Array.isArray(rawTdc) ? rawTdc : []);
            const typedPdc = transformSlots(Array.isArray(rawPdc) ? rawPdc : []);
            const partitioned = partitionSlotsByKind(allSlots);
            const tdcSlots = mergeSlotsById(partitioned.tdc, typedTdc);
            const pdcSlots = mergeSlotsById(partitioned.pdc, typedPdc);

            const hasTdcSlot = () => {
                return tdcSlots.some((slot) => isSlotOpen(slot));
            };
            const hasPdcSlot = (courseType, courseName = '') => {
                const t = (courseType || '').toLowerCase();
                const n = (courseName || '').toLowerCase();

                // Categorize based on specific part type (t) first.
                // Fall back to bundle name (n) only if (t) doesn't have vehicle keywords.
                const tHasMoto = t.includes('motorcycle') || t.includes('moto') || t.includes('motor');
                const tHasTricycle = t.includes('tricycle') || t.includes('v1') || t.includes('a1');
                const tHasB1B2 = t.includes('b1') || t.includes('b2') || t.includes('van') || t.includes('l300');
                const tHasCar = t.includes('car');
                const tHasAnyVehicle = tHasMoto || tHasTricycle || tHasB1B2 || tHasCar;

                const isMoto = tHasMoto || (!tHasAnyVehicle && n.includes('motorcycle'));
                const isTricycle = tHasTricycle || (!tHasAnyVehicle && (n.includes('tricycle') || n.includes('v1') || n.includes('a1')));
                const isB1B2 = tHasB1B2 || (!tHasAnyVehicle && (n.includes('b1') || n.includes('b2') || n.includes('van') || n.includes('l300')));

                const tHasAT = t.includes('automatic') || t.includes('(at)');
                const tHasMT = t.includes('manual') || t.includes('(mt)');
                const tHasAnyTX = tHasAT || tHasMT;

                const reqAT = tHasAT || (!tHasAnyTX && (n.includes('automatic') || n.includes('(at)')));
                const reqMT = tHasMT || (!tHasAnyTX && (n.includes('manual') || n.includes('(mt)')));

                // Filter PDC slots by category first
                return pdcSlots.some(s => {
                    if (!isSlotOpen(s)) return false;
                    const ct = (s.course_type || '').toLowerCase();
                    const st = (s.transmission || '').toLowerCase();
                    const isUniversalTx = st === 'both' || st === 'any' || st === 'all' || !st;

                    // Check transmission strictly if a specific one is requested
                    if (reqAT && !st.includes('at') && !st.includes('automatic') && !isUniversalTx) return false;
                    if (reqMT && !st.includes('mt') && !st.includes('manual') && !isUniversalTx) return false;

                    if (!ct) return true;
                    if (isTricycle) return ct.includes('tricycle') || ct.includes('v1') || ct.includes('a1');
                    if (isB1B2) return ct.includes('b1') || ct.includes('b2') || ct.includes('van') || ct.includes('l300');
                    if (isMoto) return ct.includes('motorcycle') || ct.includes('moto') || ct.includes('motor');
                    
                    // Generic Car (default)
                    return !ct.includes('motorcycle') && !ct.includes('moto') && !ct.includes('motor') && 
                           !ct.includes('tricycle') && !ct.includes('v1') && !ct.includes('a1') &&
                           !ct.includes('b1') && !ct.includes('b2') && !ct.includes('van') && !ct.includes('l300');
                });
            };
            const avail = {};
            packages.forEach(pkg => {
                const cat = pkg.category;
                const ct = (pkg.course_type || '').trim();
                const cn = pkg.name || '';
                const isOnlineTdc = ct.toLowerCase().includes('online') || ct.toLowerCase().includes('otdc') || cn.toLowerCase().includes('otdc');

                if (cat === 'TDC') {
                    const hasSharedTdc = isOnlineTdc || hasTdcSlot();
                    avail[pkg.id] = {
                        ok: hasSharedTdc,
                        components: [
                            { ok: hasSharedTdc, label: isOnlineTdc ? 'Online TDC' : 'Theoretical Driving Course' }
                        ]
                    };
                } else if (cat === 'PDC') {
                    const ok = hasPdcSlot(ct, cn);
                    avail[pkg.id] = {
                        ok: ok,
                        components: [
                            { ok, label: pkg.shortName || pkg.name }
                        ]
                    };
                } else if (cat === 'Promo') {
                    const pdcParts = parsePromoPdcParts(ct);
                    const partsToCheck = pdcParts.length > 0 ? pdcParts : [ct.split('+')[1] || ''];
                    const tdcOk = isOnlineTdc || hasTdcSlot();
                    
                    const components = [
                        { ok: tdcOk, label: isOnlineTdc ? 'Online TDC' : 'Theoretical Driving Course' }
                    ];
                    
                    partsToCheck.forEach(part => {
                        const meta = getPromoPdcCourseMeta({ name: part, shortName: part, course_type: part });
                        components.push({ ok: hasPdcSlot(part, cn), label: `PDC - ${meta.label}` });
                    });

                    avail[pkg.id] = {
                        ok: tdcOk && components.every(c => c.ok),
                        components
                    };
                } else if (cat === 'Bundle') {
                    const bundleTdc = pkg?._tdcCourse;
                    const bundlePdcs = pkg?._pdcCourses || (pkg?._pdcCourse ? [pkg._pdcCourse] : []);
                    const tdcOk = !bundleTdc || (String(bundleTdc.course_type || '').toLowerCase().includes('online') || hasTdcSlot());
                    
                    const components = [];
                    if (bundleTdc) {
                        components.push({ ok: tdcOk, label: bundleTdc.shortName || 'TDC' });
                    }
                    bundlePdcs.forEach(p => {
                        components.push({ ok: hasPdcSlot(p.course_type || '', p.name || ''), label: p.shortName || p.name });
                    });

                    avail[pkg.id] = {
                        ok: tdcOk && components.every(c => c.ok),
                        components
                    };
                } else {
                    avail[pkg.id] = { ok: true };
                }
            });
            setCourseAvailability(avail);
        }).catch((err) => {
            console.error('Step 2 availability check failed:', err);
            setCourseAvailability({});
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
            schedulesAPI.getSlotsByDate(null, formData.branchId, null).catch(() => []),
            cat === 'TDC' ? schedulesAPI.getSlotsByDate(null, formData.branchId, 'TDC').catch(() => []) : Promise.resolve([]),
            cat === 'PDC' ? schedulesAPI.getSlotsByDate(null, formData.branchId, 'PDC').catch(() => []) : Promise.resolve([]),
        ]).then(([rawAll, rawTdc, rawPdc]) => {
            const allSlots = transformSlots(Array.isArray(rawAll) ? rawAll : []);
            const partitioned = partitionSlotsByKind(allSlots);
            const tdcSlots = mergeSlotsById(partitioned.tdc, transformSlots(Array.isArray(rawTdc) ? rawTdc : []));
            const pdcSlots = mergeSlotsById(partitioned.pdc, transformSlots(Array.isArray(rawPdc) ? rawPdc : []));

            const checkTdc = (type) => {
                const t = (type || '').toLowerCase();
                if (t.includes('online')) {
                    // Online TDC is provider-managed; no local slot is required for walk-in encoding.
                    return true;
                }
                return tdcSlots.some(s => isSlotOpen(s) && !(s.course_type || '').toLowerCase().includes('online'));
            };
            const courseName = (formData.course?.name || '').toLowerCase();
            const checkPdc = (type) => {
                const t = (type || '').toLowerCase();
                const cn = (formData.course?.name || '').toLowerCase();
                
                // Categorization logic same as hasPdcSlot
                const tHasMoto = t.includes('motorcycle') || t.includes('moto') || t.includes('motor');
                const tHasTricycle = t.includes('tricycle') || t.includes('v1') || t.includes('a1');
                const tHasB1B2 = t.includes('b1') || t.includes('b2') || t.includes('van') || t.includes('l300');
                const tHasCar = t.includes('car');
                const tHasAnyVehicle = tHasMoto || tHasTricycle || tHasB1B2 || tHasCar;

                const isMoto = tHasMoto || (!tHasAnyVehicle && cn.includes('motorcycle'));
                const isTricycle = tHasTricycle || (!tHasAnyVehicle && (cn.includes('tricycle') || cn.includes('v1') || cn.includes('a1')));
                const isB1B2 = tHasB1B2 || (!tHasAnyVehicle && (cn.includes('b1') || cn.includes('b2') || cn.includes('van') || cn.includes('l300')));

                if (isTricycle)
                    return pdcSlots.some(s => isSlotOpen(s) && ((s.course_type || '').toLowerCase().includes('tricycle') || (s.course_type || '').toLowerCase().includes('v1') || (s.course_type || '').toLowerCase().includes('a1')));
                if (isB1B2)
                    return pdcSlots.some(s => {
                        if (!isSlotOpen(s)) return false;
                        const ct = (s.course_type || '').toLowerCase();
                        return ct.includes('b1') || ct.includes('b2') || ct.includes('van') || ct.includes('l300');
                    });
                if (isMoto)
                    return pdcSlots.some(s => isSlotOpen(s) && ((s.course_type || '').toLowerCase().includes('motorcycle') || (s.course_type || '').toLowerCase().includes('moto') || (s.course_type || '').toLowerCase().includes('motor')));
                
                if (t === 'carat' || t.includes('automatic'))
                    return pdcSlots.some(s => {
                        if (!isSlotOpen(s)) return false;
                        const ct = (s.course_type || '').toLowerCase();
                        if (ct.includes('motorcycle') || ct.includes('motor') || ct.includes('tricycle') || ct.includes('v1') || ct.includes('b1') || ct.includes('b2')) return false;
                        const tx = (s.transmission || '').toLowerCase();
                        return tx.includes('automatic') || tx === 'at' || tx === 'both' || tx === 'any' || tx === 'all' || !tx;
                    });
                if (t === 'carmt' || t === 'car' || t.includes('manual'))
                    return pdcSlots.some(s => {
                        if (!isSlotOpen(s)) return false;
                        const ct = (s.course_type || '').toLowerCase();
                        if (ct.includes('motorcycle') || ct.includes('motor') || ct.includes('tricycle') || ct.includes('v1') || ct.includes('b1') || ct.includes('b2')) return false;
                        const tx = (s.transmission || '').toLowerCase();
                        return tx.includes('manual') || tx === 'mt' || tx === 'both' || tx === 'any' || tx === 'all' || !tx;
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
        }).catch((err) => {
            console.error('Step 3 type availability check failed:', err);
            setTypeAvailability({});
        }).finally(() => setCheckingTypeAvail(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, formData.branchId, formData.course?.id]);

    // Search students for auto-fill
    const handleStudentSearch = async (query) => {
        setStudentSearchQuery(query);
        if (!query || query.trim().length < 2) {
            setStudentSearchResults([]);
            setShowStudentDropdown(false);
            return;
        }
        setStudentSearchLoading(true);
        setShowStudentDropdown(true);
        try {
            const res = await adminAPI.searchStudents(query.trim());
            setStudentSearchResults(res.students || []);
        } catch (err) {
            console.error('Student search error:', err);
            setStudentSearchResults([]);
        } finally {
            setStudentSearchLoading(false);
        }
    };

    const handleStudentSelect = (student) => {
        setSelectedStudentId(student.id);
        setFormData(prev => ({
            ...prev,
            firstName: student.first_name || '',
            middleName: student.middle_name || '',
            lastName: student.last_name || '',
            age: student.age ? String(student.age) : '',
            gender: student.gender || '',
            birthday: student.birthday ? student.birthday.split('T')[0] : '',
            nationality: student.nationality || '',
            maritalStatus: student.marital_status || '',
            address: student.address || '',
            zipCode: student.zip_code || '',
            birthPlace: student.birth_place || '',
            contactNumbers: student.contact_numbers || '',
            email: student.email || '',
            emergencyContactPerson: student.emergency_contact_person || '',
            emergencyContactNumber: student.emergency_contact_number || '',
        }));
        setFormErrors({});
        setStudentSearchQuery(`${student.first_name} ${student.last_name}`);
        setShowStudentDropdown(false);
        setStudentSearchResults([]);
        showNotification(`✅ Details auto-filled for ${student.first_name} ${student.last_name}`, 'success');
    };

    const clearStudentSearch = () => {
        setStudentSearchQuery('');
        setStudentSearchResults([]);
        setShowStudentDropdown(false);
        setSelectedStudentId(null);
    };

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
        }
    };

    const resetScheduleState = () => {
        setSelectedScheduleDate('');
        setScheduleSlots([]);
        setTdcTypeFilter('All');
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
        setPromoPdcSelections({});
        setActivePromoPdcCourseId(null);
        // Reset regular-PDC split selectors
        setPdcVehicleType('');
        setPdcTransmission('');
    };

    const handleCourseToggle = (pkg) => {
        setFormData(prev => {
            const sel = prev.selectedCourses || [];
            const exists = sel.find(c => c.id === pkg.id);
            let updated;

            if (exists) {
                updated = sel.filter(c => c.id !== pkg.id);
            } else {
                if (pkg.category === 'Promo') {
                    // Selecting a promo clears everything else
                    updated = [pkg];
                } else {
                    // Selecting regular items
                    // 1. Remove any existing Promo selections
                    const withoutPromo = sel.filter(c => c.category !== 'Promo');
                    
                    if (pkg.category === 'TDC') {
                        // Max 1 TDC - replace previous TDC if exists
                        const withoutTdc = withoutPromo.filter(c => c.category !== 'TDC');
                        updated = [...withoutTdc, pkg];
                    } else {
                        // Add PDC (allowing multiple)
                        updated = [...withoutPromo, pkg];
                    }
                }
            }

            return {
                ...prev, selectedCourses: updated, course: null, courseType: '',
                scheduleDate: '', scheduleSlotId: null, scheduleSession: '', scheduleTime: '',
                scheduleDate2: '', scheduleSlotId2: null, scheduleSession2: '', scheduleTime2: '',
                promoPdcSlotId2: null, promoPdcDate2: '', promoPdcSession2: '', promoPdcTime2: ''
            };
        });
        resetScheduleState();
    };

    const handleProceedToStep3 = () => {
        const sel = formData.selectedCourses;
        if (!sel || sel.length === 0) return;

        let course;
        if (sel.length === 1 && sel[0].category === 'Promo') {
            course = enrichSinglePromoCourse(sel[0]);
        } else if (sel.length > 1) {
            // Manual bundle selection
            const tdc = sel.find(c => c.category === 'TDC');
            const pdcs = sel.filter(c => c.category === 'PDC');
            
            // Create a virtual "Bundle" course to trigger the multi-track scheduling UI without mixing with Promo logic
            course = {
                id: 'manual-bundle-' + Date.now(),
                name: 'Manual Bundle: ' + sel.map(c => c.shortName || c.name).join(' + '),
                category: 'Bundle',
                _isManualBundle: true,
                _tdcCourse: tdc || null,
                _pdcCourses: pdcs,
                _pdcCourse: pdcs[0] || null,
                // Construct a course_type for summary display
                course_type: (tdc ? 'TDC + ' : '') + pdcs.map(p => p.shortName || p.name).join(' | '),
                price: sel.reduce((sum, c) => sum + (c.price || 0), 0),
                original_price: sel.reduce((sum, c) => sum + (c.original_price || 0), 0),
                duration: sel.reduce((sum, c) => {
                    const hrs = parseInt(c.duration) || 0;
                    return sum + hrs;
                }, 0) + ' Hours',
                typeOptions: tdc ? tdc.typeOptions : (pdcs[0]?.typeOptions || [])
            };
        } else {
            // Single regular course
            course = sel[0];
        }

        let courseType = '';
        // If it's a single TDC/PDC with options, we might need a default courseType
        if (course.category !== 'Promo' && course.typeOptions?.length > 0) {
            courseType = course.typeOptions[0].value;
        }

        setFormData(prev => ({
            ...prev, course, courseType,
            promoTdcType: (course?.category === 'Promo') ? (() => {
                const raw = String(course.course_type || '').toUpperCase();
                if (!raw.includes('+')) return 'F2F';
                const tdcPart = raw.split('+')[0];
                if (tdcPart.includes('ONLINE') || tdcPart.includes('OTDC')) return 'ONLINE';
                if (tdcPart.includes('F2F')) return 'F2F';
                return tdcPart.trim() || 'F2F';
            })() : '',
            scheduleDate: '', scheduleSlotId: null, scheduleSession: '', scheduleTime: '',
            scheduleDate2: '', scheduleSlotId2: null, scheduleSession2: '', scheduleTime2: '',
            promoPdcSlotId2: null, promoPdcDate2: '', promoPdcSession2: '', promoPdcTime2: '',
            addons: [...DEFAULT_ADDONS],
        }));
        resetScheduleState();
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
            const selectedTypeOpt = dynamicCourse?.typeOptions?.find(opt => opt.value === formData.courseType);
            
            const isRegularPromoBundle = isPromo && !!formData.course?._isManualBundle;
            const regularBundleCourses = isRegularPromoBundle
                ? [
                    ...(formData.course?._tdcCourse ? [formData.course._tdcCourse] : []),
                    ...((formData.course?._pdcCourses && formData.course._pdcCourses.length > 0)
                        ? formData.course._pdcCourses
                        : (formData.course?._pdcCourse ? [formData.course._pdcCourse] : []))
                ]
                : [];
            const selectedPrice = isRegularPromoBundle
                ? regularBundleCourses.reduce((sum, c) => {
                    if (c.category === 'TDC' && selectedTypeOpt) {
                        return sum + selectedTypeOpt.price;
                    }
                    return sum + Number(c.price || 0);
                }, 0)
                : (selectedTypeOpt?.price || dynamicCourse?.price || 0);
            
            const isOnlineTdcNoSchedule =
                ['TDC', 'PROMO', 'BUNDLE'].includes(String(formData.course?.category || '').toUpperCase()) &&
                (String(formData.courseType || '').toLowerCase().includes('online') ||
                    String(formData.courseType || '').toLowerCase().includes('otdc') ||
                    String(formData.promoTdcType || '').toLowerCase().includes('online') ||
                    String(formData.promoTdcType || '').toLowerCase().includes('otdc') ||
                    String(formData.course?.name || '').toLowerCase().includes('otdc') ||
                    String(formData.course?.shortName || '').toLowerCase().includes('otdc'));
            
            const addonsTotal = (formData.addons || []).reduce((sum, a) => sum + (a.price || 0), 0);
            const subtotal = selectedPrice + addonsTotal;
            
            // Calculate Saturday Surcharge (₱150 per Saturday for PDC)
            const calculateSaturdaySurcharge = () => {
                if (isOnlineTdcNoSchedule) return 0;
                let surcharge = 0;
                
                // Regular PDC
                if (formData.course?.category === 'PDC') {
                    if (formData.scheduleDate) {
                        const d1 = new Date(formData.scheduleDate);
                        if (d1.getDay() === 6) surcharge += 150;
                    }
                    if (formData.scheduleDate2) {
                        const d2 = new Date(formData.scheduleDate2);
                        if (d2.getDay() === 6) surcharge += 150;
                    }
                }

                // Promo PDC Selections
                if (isPromo) {
                    Object.values(promoPdcSelections).forEach(sel => {
                        if (sel.scheduleDate) {
                            const d1 = new Date(sel.scheduleDate);
                            if (d1.getDay() === 6) surcharge += 150;
                        }
                        if (sel.promoPdcDate2) {
                            const d2 = new Date(sel.promoPdcDate2);
                            if (d2.getDay() === 6) surcharge += 150;
                        }
                    });
                }
                return surcharge;
            };

            const saturdaySurchargeAmount = calculateSaturdaySurcharge();
            const discountPct = formData.course?._isManualBundle ? 3 : (selectedTypeOpt?.discount || dynamicCourse?.discount || 0);
            const promoDiscount = discountPct > 0 ? Number((subtotal * (discountPct / 100)).toFixed(2)) : 0;
            
            // Embed surcharge into subtotal and total amount
            const embeddedSubtotal = subtotal + saturdaySurchargeAmount;
            const totalAmountDue = Math.max(0, Number((embeddedSubtotal - promoDiscount).toFixed(2)));

            const enteredAmount = Number(formData.amountPaid || 0);
            const changeAmount = Math.max(0, enteredAmount - totalAmountDue);
            const actualAmountToRecord = Math.max(0, enteredAmount - changeAmount);
            const isPromoPdcLocked = isPromoOnlineTdcLockedBundle;
            const submitPdcCourses = formData.course?._isManualBundle
                ? (formData.course?._pdcCourses || [])
                : (isPromo ? promoPdcCourses : []);
            const hasPromoPdcCourses = isPromo && submitPdcCourses.length > 0;

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
                courseId: formData.course?._isManualBundle
                    ? formData.course._tdcCourse?.id
                    : formData.course?.id,
                courseIds: formData.course?._isManualBundle
                    ? [
                        formData.course._tdcCourse?.id,
                        ...((formData.course._pdcCourses || []).map(c => c.id))
                    ].filter(Boolean)
                    : [formData.course?.id].filter(Boolean),
                courseCategory: formData.course?.category,
                courseType: isOnlineTdcNoSchedule ? 'Online' : formData.courseType,
                branchId: formData.branchId,
                courseList: (() => {
                    const dynamicCourse = packages.find(p => p.id === formData.course?.id) || formData.course;
                    
                    // Calculate Saturday Surcharge to embed it into the item price
                    let itemSurcharge = 0;
                    if (formData.course?.category === 'PDC') {
                        if (formData.scheduleDate && new Date(formData.scheduleDate).getDay() === 6) itemSurcharge += 150;
                        if (formData.scheduleDate2 && new Date(formData.scheduleDate2).getDay() === 6) itemSurcharge += 150;
                    }
                    if (isPromo) {
                        Object.values(promoPdcSelections).forEach(sel => {
                            if (sel.scheduleDate && new Date(sel.scheduleDate).getDay() === 6) itemSurcharge += 150;
                            if (sel.promoPdcDate2 && new Date(sel.promoPdcDate2).getDay() === 6) itemSurcharge += 150;
                        });
                    }

                    const items = [];
                    // Add primary course (bundle or single)
                    items.push({
                        id: dynamicCourse?.id,
                        name: dynamicCourse?.name,
                        category: dynamicCourse?.category,
                        type: formData.courseType,
                        price: Number(selectedPrice) + itemSurcharge
                    });
                    // Add all component courses for manual bundles
                    if (formData.course?._isManualBundle) {
                        if (formData.course._tdcCourse) {
                            items.push({
                                id: formData.course._tdcCourse.id,
                                name: formData.course._tdcCourse.name,
                                category: formData.course._tdcCourse.category,
                                type: isOnlineTdcNoSchedule ? 'Online' : 'Standard',
                                price: 0
                            });
                        }
                        (formData.course._pdcCourses || []).forEach(c => {
                            items.push({
                                id: c.id,
                                name: c.name,
                                category: c.category,
                                type: c.course_type || 'Standard',
                                price: 0 
                            });
                        });
                    } else if (hasPromoPdcCourses) {
                        submitPdcCourses.forEach(c => {
                            items.push({
                                id: c.id,
                                name: c.name,
                                category: c.category,
                                type: c.course_type || '',
                                price: 0
                            });
                        });
                    }
                    return items;
                })(),
                isOnlineTdcNoSchedule,
                ...((formData.course?._isManualBundle || hasPromoPdcCourses) ? {
                    pdcCourseId: formData.course._pdcCourse?.id || submitPdcCourses?.[0]?.id,
                    pdcCourseIds: submitPdcCourses.map(c => c.id).filter(Boolean),
                    promoPdcSchedules: isPromoPdcLocked ? [] : submitPdcCourses.map((course, idx) => {
                        const key = course?._pdcKey || getPromoPdcCourseKey(course);
                        const sel = promoPdcSelections[key] || null;
                        if (!sel?.scheduleSlotId) return null;
                        const resolvedCourseName = String(sel.courseName || course?.name || course?.shortName || `PDC ${idx + 1}`).trim();
                        const resolvedCourseType = String(sel.courseTypeDetailed || course?.course_type || sel.courseType || course?._pdcKind || 'PDC').trim();
                        const resolvedTransmission = sel.transmission || sel.motorType || null;
                        const transmissionLabel = resolvedTransmission === 'AT'
                            ? 'Automatic (AT)'
                            : resolvedTransmission === 'MT'
                                ? 'Manual (MT)'
                                : '';
                        const mergedLower = `${resolvedCourseName} ${resolvedCourseType}`.toLowerCase();
                        const withType = resolvedCourseType && !mergedLower.includes(resolvedCourseType.toLowerCase())
                            ? `${resolvedCourseName} (${resolvedCourseType})`
                            : resolvedCourseName;
                        const scheduleLabel = sel.courseLabel
                            || (transmissionLabel && !mergedLower.includes(String(resolvedTransmission || '').toLowerCase())
                                ? `${withType} - ${transmissionLabel}`
                                : withType);
                        return {
                            courseId: course.id,
                            label: scheduleLabel,
                            courseName: resolvedCourseName,
                            courseType: resolvedCourseType,
                            courseTypeDetailed: resolvedCourseType,
                            transmission: resolvedTransmission,
                            scheduleSlotId: sel.scheduleSlotId,
                            scheduleDate: sel.scheduleDate,
                            scheduleSession: sel.scheduleSession2,
                            scheduleTime: sel.scheduleTime2,
                            promoPdcSlotId2: sel.promoPdcSlotId2 || null,
                            promoPdcDate2: sel.promoPdcDate2 || '',
                            promoPdcSession2: sel.promoPdcSession2 || '',
                            promoPdcTime2: sel.promoPdcTime2 || '',
                        };
                    }).filter(Boolean),
                    isManualBundle: !!formData.course?._isManualBundle,
                } : {}),

                // Schedule (supports 1 or 2 slots; for Promo: slot1=TDC, slot2=PDC Day1, promoPdcSlotId2=PDC Day2)
                scheduleSlotId: isOnlineTdcNoSchedule ? null : formData.scheduleSlotId,
                scheduleDate: isOnlineTdcNoSchedule ? null : formData.scheduleDate,
                ...(!isPromoPdcLocked && formData.scheduleSlotId2 ? {
                    scheduleSlotId2: formData.scheduleSlotId2,
                    scheduleDate2: formData.scheduleDate2,
                } : {}),
                ...(!isPromoPdcLocked && formData.promoPdcSlotId2 ? {
                    promoPdcSlotId2: formData.promoPdcSlotId2,
                    promoPdcDate2: formData.promoPdcDate2,
                } : {}),
                pdcScheduleLockedUntilCompletion: isPromoPdcLocked,
                pdcScheduleLockReason: isPromoPdcLocked
                    ? 'Branch Manager will assigns your PDC schedule after OTDC is marked complete.'
                    : null,

                // Payment
                paymentMethod: formData.paymentMethod,
                amountPaid: actualAmountToRecord,
                paymentStatus: formData.paymentStatus,
                transactionNo: formData.transactionNo,
                addons: formData.addons || [],
                subtotal: embeddedSubtotal,
                promoDiscount,
                promoPct: discountPct,
                totalAmount: totalAmountDue,
                saturdaySurcharge: 0,
                convenienceFee: 0,

                // Metadata
                enrollmentType: 'walk-in',
                tdcScheduleLabel: `TDC ${String(promoTdcType || formData.courseType || '').toUpperCase()}`.trim(),
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
                schedule: isOnlineTdcNoSchedule
                    ? 'Online TDC - No local branch schedule required'
                    : isPromoPdcLocked
                        ? 'OTDC selected. PDC schedules are admin-assigned after OTDC is marked complete.'
                        : `${formData.scheduleDate} - ${formData.scheduleSession}`
            };

            if (onEnroll) {
                onEnroll(newEnrollee);
            }

            showNotification('Walk-in enrollment successful! Confirmation email with login credentials and schedule sent to student.', 'success');

            // Clear persisted wizard state so next student starts fresh
            try {
                sessionStorage.removeItem('walkin_step');
                sessionStorage.removeItem('walkin_formData');
                sessionStorage.removeItem('walkin_promoStep');
                sessionStorage.removeItem('walkin_promoPdcSelections');
            } catch { }

            // Reset to first step
            setStep(1);
            setSelectedScheduleDate('');
            setScheduleSlots([]);
            setFormErrors({});
            setPromoPdcSelections({});
            setActivePromoPdcCourseId(null);
            setFormData({
                firstName: '', middleName: '', lastName: '', age: '', gender: '', birthday: '', nationality: '', maritalStatus: '',
                address: '', zipCode: '', birthPlace: '', contactNumbers: '', email: '', emergencyContactPerson: '', emergencyContactNumber: '',
                course: null, courseType: '', branchId: formData.branchId, branchName: formData.branchName,
                promoTdcType: '',
                selectedCourses: [],
                scheduleDate: '', scheduleSlotId: null, scheduleSession: '', scheduleTime: '',
                scheduleDate2: '', scheduleSlotId2: null, scheduleSession2: '', scheduleTime2: '',
                promoPdcSlotId2: null, promoPdcDate2: '', promoPdcSession2: '', promoPdcTime2: '',
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
            {/* Returning Student Search Bar */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-3xl p-6 border-2 border-blue-100 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 bg-[#2157da] text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" stroke="white" strokeWidth="2" /><path d="M20 20l-3-3" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>
                    </div>
                    <div>
                        <h3 className="text-base font-black text-gray-900 leading-tight">Returning Student?</h3>
                        <p className="text-xs text-blue-600 font-medium">Search by name or email to auto-fill details</p>
                    </div>
                    {selectedStudentId && (
                        <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 border border-green-200 rounded-full text-xs font-bold">
                            <svg width="12" height="12" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                            Auto-filled
                        </span>
                    )}
                </div>
                <div style={{ position: 'relative' }}>
                    <div className="flex gap-3">
                        <div style={{ position: 'relative', flex: 1 }}>
                            <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                                {studentSearchLoading
                                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#3b82f6" strokeWidth="2" strokeDasharray="40" strokeDashoffset="20" style={{ animation: 'spin 1s linear infinite', transformOrigin: 'center' }} /></svg>
                                    : <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" stroke="#6b7280" strokeWidth="1.8" /><path d="M20 20l-3-3" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" /></svg>
                                }
                            </div>
                            <input
                                type="text"
                                value={studentSearchQuery}
                                onChange={e => handleStudentSearch(e.target.value)}
                                onFocus={() => { if (studentSearchResults.length > 0) setShowStudentDropdown(true); }}
                                onBlur={() => setTimeout(() => setShowStudentDropdown(false), 200)}
                                placeholder="Search student by first name, last name, or email…"
                                className="w-full py-3.5 bg-white border-2 border-blue-100 rounded-2xl outline-none transition-all focus:border-[#2157da] focus:ring-4 focus:ring-blue-50"
                                style={{ paddingLeft: '44px', paddingRight: studentSearchQuery ? '44px' : '16px' }}
                            />
                            {studentSearchQuery && (
                                <button
                                    type="button"
                                    onClick={clearStudentSearch}
                                    style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)' }}
                                    className="text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                                </button>
                            )}
                        </div>
                    </div>
                    {/* Dropdown Results */}
                    {showStudentDropdown && (
                        <div style={{
                            position: 'absolute',
                            top: 'calc(100% + 8px)',
                            left: 0,
                            right: 0,
                            background: 'white',
                            border: '2px solid #dbeafe',
                            borderRadius: '16px',
                            boxShadow: '0 12px 40px rgba(33,87,218,0.15)',
                            zIndex: 100,
                            overflow: 'hidden',
                            maxHeight: '320px',
                            overflowY: 'auto'
                        }}>
                            {studentSearchLoading && (
                                <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ display: 'inline-block', marginRight: '8px', animation: 'spin 1s linear infinite', transformOrigin: 'center', verticalAlign: 'middle' }}>
                                        <circle cx="12" cy="12" r="10" stroke="#3b82f6" strokeWidth="2" strokeDasharray="40" strokeDashoffset="20" />
                                    </svg>
                                    Searching students…
                                </div>
                            )}
                            {!studentSearchLoading && studentSearchResults.length === 0 && (
                                <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔍</div>
                                    No students found for &ldquo;{studentSearchQuery}&rdquo;
                                </div>
                            )}
                            {!studentSearchLoading && studentSearchResults.map(student => (
                                <button
                                    key={student.id}
                                    type="button"
                                    onMouseDown={() => handleStudentSelect(student)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        width: '100%',
                                        padding: '12px 16px',
                                        background: 'none',
                                        border: 'none',
                                        borderBottom: '1px solid #f3f4f6',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        transition: 'background 0.15s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                >
                                    <div style={{
                                        width: '38px', height: '38px', flexShrink: 0,
                                        background: 'linear-gradient(135deg, #2157da, #3b82f6)',
                                        borderRadius: '50%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', fontWeight: '800', fontSize: '0.95rem'
                                    }}>
                                        {(student.first_name?.[0] || '?').toUpperCase()}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: '700', color: '#111827', fontSize: '0.95rem', marginBottom: '2px' }}>
                                            {student.first_name} {student.middle_name && student.middle_name !== 'N/A' ? student.middle_name + ' ' : ''}{student.last_name}
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: '#6b7280', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                            {student.email && <span>📧 {student.email}</span>}
                                            {student.contact_numbers && <span>📱 {student.contact_numbers}</span>}
                                        </div>
                                    </div>
                                    <div style={{ flexShrink: 0, background: '#dbeafe', color: '#1d4ed8', borderRadius: '8px', padding: '4px 10px', fontSize: '0.72rem', fontWeight: '700' }}>
                                        Auto-fill
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

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
                        <NationalitySelect
                            value={formData.nationality}
                            onChange={handleChange}
                            className={`w-full px-4 py-3.5 bg-gray-50 border-2 rounded-2xl focus:border-[#2157da] focus:ring-4 focus:ring-blue-50 outline-none transition-all pr-10 ${formErrors.nationality ? 'border-red-500 ring-4 ring-red-50' : 'border-gray-100'}`}
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
                            placeholder="example@domain.com"
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
                <p>Choose one or multiple courses</p>
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
            ) : (() => {
                const selectedCourses = formData.selectedCourses || [];
                const selectedTDC = selectedCourses.find(c => c.category === 'TDC');
                const selectedPDCs = selectedCourses.filter(c => c.category === 'PDC');
                const selectedPromoCourse = selectedCourses.find(c => c.category === 'Promo');
                const isPromoBundle = !!(selectedTDC && selectedPDCs.length > 0) || selectedPDCs.length > 1;
                const isPromoCourseMode = !!selectedPromoCourse;
                const bundleRaw = selectedCourses.reduce((s, c) => s + (c.price || 0), 0);
                const bundleDiscount = 0;
                const regularPackages = packages
                    .filter(pkg => pkg.category !== 'Promo')
                    .sort((a, b) => getCourseOrder(a) - getCourseOrder(b));
                const promoPackages = packages
                    .filter(pkg => pkg.category === 'Promo')
                    .sort((a, b) => getCourseOrder(a) - getCourseOrder(b));
                const hasRegularSelection = selectedCourses.some(c => c.category !== 'Promo');

                const renderCourseRow = (pkg) => {
                    const minPrice = Math.min(...pkg.typeOptions.map(opt => opt.price));
                    const maxPrice = Math.max(...pkg.typeOptions.map(opt => opt.price));
                    const priceDisplay = minPrice === maxPrice ? `₱${minPrice.toLocaleString()}` : `₱${minPrice.toLocaleString()} - ₱${maxPrice.toLocaleString()}`;
                    const availInfo = courseAvailability[pkg.id];
                    const isAvailable = availInfo === undefined ? true : (typeof availInfo === 'boolean' ? availInfo : availInfo.ok);
                    const availChecked = pkg.id in courseAvailability;
                    const isSelected = formData.selectedCourses?.some(c => c.id === pkg.id);
                    const blockedByPromoMode = !!selectedPromoCourse && !isSelected && pkg.category !== 'Promo';
                    const blockedByRegularMode = hasRegularSelection && !isSelected && pkg.category === 'Promo';
                    const blockedByMode = blockedByPromoMode || blockedByRegularMode;
                    const hasNoSlots = availChecked && !isAvailable;
                    const wouldReplace = pkg.category === 'TDC' && selectedTDC && selectedTDC.id !== pkg.id;

                    // Slot availability check is final — bundles must satisfy all component requirements (TDC and PDC)
                    const canSelect = availChecked && isAvailable && !blockedByMode;

                    return (
                        <div key={pkg.id} className={`course-row ${isSelected ? 'selected' : ''}`}
                            onClick={() => canSelect && handleCourseToggle(pkg)}
                            style={hasNoSlots ? { opacity: 0.8, cursor: 'not-allowed' } : undefined}>

                            <div className="course-thumbnail" style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                position: 'relative',
                                color: 'white',
                                flexShrink: 0
                            }}>
                                <img 
                                    src={pkg.image} 
                                    alt={pkg.name} 
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                    }} 
                                />
                                <span style={{ 
                                    display: pkg.image ? 'none' : 'flex', 
                                    fontSize: '1.5rem', 
                                    fontWeight: '900',
                                    zIndex: 1 
                                }}>
                                    {(pkg.shortName || pkg.name || '?').charAt(0).toUpperCase()}
                                </span>
                            </div>

                            <div className="course-main-content">
                                    <div className="course-category-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                        <span className="course-category-tag" style={{ marginTop: '2px' }}>{pkg.category}</span>
                                        {hasNoSlots && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                <span className="no-slots-chip" style={{ background: '#ef4444', color: '#fff', boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)', padding: '2px 8px' }}>No Slots</span>
                                                {availInfo?.components?.some(c => !c.ok) && (
                                                    <div style={{ 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        gap: '4px', 
                                                        background: '#fff1f2', 
                                                        border: '1px solid #fecaca', 
                                                        borderRadius: '6px', 
                                                        padding: '2px 8px',
                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                                                    }}>
                                                        <span style={{ fontSize: '9px', fontWeight: 800, color: '#b91c1c', borderRight: '1px solid #fecaca', paddingRight: '6px', marginRight: '2px', textTransform: 'uppercase', lineHeight: 1 }}>Full:</span>
                                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                            {availInfo.components.filter(c => !c.ok).map((c, i) => (
                                                                <span key={i} style={{ fontSize: '10px', color: '#dc2626', fontWeight: 700, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                                    <span style={{ color: '#ef4444', fontWeight: 900 }}>✗</span> {c.label}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                <h3 className="course-row-title">{pkg.name}</h3>
                                <div className="course-sub-meta">
                                    <span>⏱ {pkg.duration}</span>
                                    <span>• {pkg.features?.length || 0} features included</span>
                                </div>
                            </div>

                            <div className="course-pill-area">
                                {pkg.features?.slice(0, 2).map((f, i) => (
                                    <span key={i} className="feature-pill">✓ {f}</span>
                                ))}
                            </div>

                            <div className="course-price-area">
                                <div className="price-box">
                                    <span className="price-value">{priceDisplay}</span>
                                    <span className="price-label">COURSE FEE</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); canSelect && handleCourseToggle(pkg); }}
                                    className={`row-action-btn ${isSelected ? 'selected' : ''} ${hasNoSlots ? 'no-slots-btn' : ''}`}
                                    disabled={!canSelect || hasNoSlots}
                                >
                                    {hasNoSlots ? 'No Slots'
                                        : !availChecked ? 'Checking...'
                                            : isSelected ? '✓ Selected'
                                                : blockedByPromoMode ? 'Locked'
                                                    : blockedByRegularMode ? 'Locked'
                                                        : wouldReplace ? 'Replace'
                                                            : isSelected ? '✓ Selected' : 'Select Course'}
                                </button>
                            </div>
                        </div>
                    );
                };

                return (<>
                    {/* Promo tip */}


                    {isPromoCourseMode && (
                        <div className="promo-tip-bar" style={{ background: '#eff6ff', borderColor: '#93c5fd' }}>
                            <span>🎫</span>
                            <span><strong>Promo Course Mode:</strong> Using a single promo bundle card. Regular TDC/PDC picks are disabled until this is removed.</span>
                        </div>
                    )}

                    {checkingCourseAvail && (
                        <div style={{ textAlign: 'center', padding: '12px', fontSize: '0.875rem', color: 'var(--secondary-text)' }}>
                            Checking slot availability...
                        </div>
                    )}

                    <div className="course-section-container">
                        <div className="course-section-header regular">
                            <div className="section-indicator"></div>
                            <h2>Regular Packages</h2>
                            <span className="section-pill">Standard Courses</span>
                        </div>
                        <div className="courses-list">
                            {regularPackages.map(renderCourseRow)}
                        </div>
                    </div>

                    {promoPackages.length > 0 && (
                        <div className="course-section-container promo">
                            <div className="course-section-header promo">
                                <div className="section-indicator"></div>
                                <h2>Promo Bundle Packages</h2>
                                <span className="section-pill">Bundle Mode</span>
                            </div>
                            <div className="courses-list">
                                {promoPackages.map(renderCourseRow)}
                            </div>
                        </div>
                    )}



                    {/* Single course tip */}
                    {selectedCourses.length === 1 && !isPromoBundle && !isPromoCourseMode && (
                        <div className="single-course-hint">
                            <span>✓ <strong>{selectedCourses[0].shortName || selectedCourses[0].name}</strong> selected</span>
                            {selectedCourses[0].category === 'PDC' && <span className="hint-tip">💡 Also pick a TDC for Promo Bundle!</span>}
                            {selectedCourses[0].category === 'TDC' && <span className="hint-tip">💡 Also pick a PDC for Promo Bundle!</span>}
                        </div>
                    )}

                    {isPromoCourseMode && (
                        <div className="single-course-hint" style={{ borderColor: '#93c5fd', background: '#eff6ff' }}>
                            <span>✓ <strong>{selectedPromoCourse?.shortName || selectedPromoCourse?.name || 'Promo bundle course'}</strong> selected</span>
                            <span className="hint-tip">Step 3 will use the promo-course scheduling flow.</span>
                        </div>
                    )}

                    {selectedPDCs.length > 1 && (
                        <div className="single-course-hint" style={{ borderColor: '#bfdbfe', background: '#eff6ff' }}>
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-[10px] font-black">!</div>
                                <span><strong>{selectedPDCs.length} PDC courses</strong> selected</span>
                            </div>
                            <span className="hint-tip">A manual bundle will be created. You will schedule each PDC track in Step 3.</span>
                        </div>
                    )}

                    <div className="step-actions">
                        <button type="button" onClick={prevStep} className="back-btn">
                            <svg className="mr-2" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to Form
                        </button>
                        {selectedCourses.length > 0 && (
                            <button type="button" className="next-btn" onClick={handleProceedToStep3}>
                                {(isPromoBundle || isPromoCourseMode) ? '🎁 Next: Select Schedules' : 'Next: Select Schedule'}
                                <svg className="ml-2" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        )}
                    </div>
                </>);
            })()}
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
        // Shared helpers (used by both promo and regular TDC flows)
        // =====================================================================
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

        // =====================================================================
        // PROMO BUNDLE: 2-step flow (TDC first, then PDC)
        // =====================================================================
        if (isPromo) {
            const isManualPromoBundle = !!formData.course?._isManualBundle;
            const hasTdcCourse = !!formData.course?._tdcCourse;
            const promoFlowTitle = isManualPromoBundle 
                ? (hasTdcCourse ? 'Regular Bundle — 2-Step Schedule' : 'Manual Multi-Course Schedule') 
                : 'Promo Course Bundle — 2-Step Schedule';
            const promoFlowDesc = isManualPromoBundle
                ? (hasTdcCourse 
                    ? 'Step 1: Select TDC schedule · Step 2: Select selected PDC track schedules'
                    : 'Select schedules for each of your selected PDC tracks.')
                : 'Step 1: Select TDC schedule · Step 2: Select promo PDC schedules';
            const pdcDoneCount = promoPdcCourses.filter(c => getIsPromoPdcComplete(c._pdcKey)).length;
            const allPromoPdcDone = (promoPdcCourses.length > 0)
                ? pdcDoneCount === promoPdcCourses.length
                : (isManualPromoBundle ? true : !!formData.scheduleSlotId2);

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
                if (!activePromoPdcType) return true;
                const slotTx = (slot.transmission || '').toLowerCase().trim();
                const slotCT = (slot.course_type || '').toLowerCase().trim();
                const slotName = (slot.name || '').toLowerCase().trim();

                const isManual = slotTx.includes('manual') || slotTx === 'mt' || slotCT.includes('manual') || slotCT.includes('(mt)') || slotCT.endsWith(' mt') || slotName.includes('manual') || slotName.includes('(mt)');
                const isAuto = slotTx.includes('automatic') || slotTx === 'at' || slotCT.includes('automatic') || slotCT.includes('(at)') || slotCT.endsWith(' at') || slotName.includes('automatic') || slotName.includes('(at)');

                // Promo transmission selection should be strict: AT shows AT only, MT shows MT only.
                const matchesStrictPromoTx = () => {
                    if (effectivePromoPdcTransmission === 'AT') return isAuto;
                    if (effectivePromoPdcTransmission === 'MT') return isManual;
                    return true;
                };

                const isMotoSlot = slotCT.includes('motorcycle') || slotCT.includes('moto') || slotCT.includes('bike');
                const isTricycleSlot = slotCT.includes('tricycle') || slotCT.includes('a1');
                const isB1B2Slot = slotCT.includes('b1') || slotCT.includes('b2') || slotCT.includes('van') || slotCT.includes('l300');
                const isCarSlot = slotCT.includes('car') || isB1B2Slot || isTricycleSlot;
                const isExplicitCarSlot = slotCT.includes('car') || slotCT.includes('sedan');

                if (activePromoPdcType === 'B1B2') {
                    return isB1B2Slot;
                }

                if (activePromoPdcType === 'Tricycle') {
                    if (!isTricycleSlot) return false;
                    if (effectivePromoPdcTransmission === 'AT' || effectivePromoPdcTransmission === 'MT') return matchesStrictPromoTx();
                    return true;
                }

                if (activePromoPdcType === 'Motorcycle') {
                    if (isCarSlot) return false;
                    if (effectivePromoPdcTransmission === 'AT' || effectivePromoPdcTransmission === 'MT') return matchesStrictPromoTx();
                    return true;
                }
                if (activePromoPdcType === 'CarAT' || activePromoPdcType === 'CarMT' || activePromoPdcType === 'Car') {
                    if (isMotoSlot || isTricycleSlot || isB1B2Slot) return false;

                    // Mirror Motorcycle behavior: selected transmission decides what appears.
                    // For CarAT/CarMT, default to their implied transmission only when no selection is set.
                    const desiredTx = effectivePromoPdcTransmission || (
                        activePromoPdcType === 'CarAT' ? 'AT' :
                            activePromoPdcType === 'CarMT' ? 'MT' :
                                null
                    );

                    if (desiredTx === 'AT') return isAuto;
                    if (desiredTx === 'MT') return isManual;
                    return true;
                }
                return true;
            };
            const normalizePromoSessionKey = (session) => {
                const s = String(session || '').toLowerCase();
                if (s.includes('morning')) return 'morning';
                if (s.includes('afternoon')) return 'afternoon';
                if (s.includes('whole')) return 'whole';
                return s.trim();
            };
            const isPromoSessionTakenByOtherCourse = (slot) => {
                if (!slot?.date || !slot?.session || !activePromoPdcCourseKey) return false;
                const slotSessionKey = normalizePromoSessionKey(slot.session);
                return Object.entries(promoPdcSelections).some(([courseKey, sel]) => {
                    if (courseKey === activePromoPdcCourseKey) return false;
                    const entries = [
                        { date: sel?.scheduleDate, session: sel?.scheduleSession2 },
                        { date: sel?.promoPdcDate2, session: sel?.promoPdcSession2 },
                    ].filter(e => e.date && e.session);
                    return entries.some(e => {
                        if (e.date !== slot.date) return false;
                        const takenSessionKey = normalizePromoSessionKey(e.session);
                        // Whole day blocks all sessions on that date, and vice versa.
                        if (takenSessionKey === 'whole' || slotSessionKey === 'whole') return true;
                        return takenSessionKey === slotSessionKey;
                    });
                });
            };
            const promoPdcCalendarSlots = pdcAllSlots
                .filter(matchPdcSlot)
                .filter(s => !isPromoSessionTakenByOtherCourse(s));
            const promoPdcFilteredSlots = promoPdcRawSlots
                .filter(matchPdcSlot)
                .filter(s => !isPromoSessionTakenByOtherCourse(s));
            const promoPdcDay1Session = formData.scheduleSession2;
            const promoPdcFiltered2Slots = promoPdcRawSlots2.filter(matchPdcSlot)
                .filter(s => !isPromoSessionTakenByOtherCourse(s))
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
                        // Keep a full 2-day gap after TDC completion before PDC starts.
                        // Example: TDC ends Apr 7 -> earliest PDC is Apr 10.
                        d.setDate(d.getDate() + 3);
                        return formatLocalDate(d);
                    }
                }
                return getMinSchedDate(0);
            })();
            const pdcIsHalfDay = promoPdcDay1Session && (
                promoPdcDay1Session.toLowerCase().includes('morning') ||
                promoPdcDay1Session.toLowerCase().includes('afternoon') ||
                promoPdcDay1Session.toLowerCase().includes('4 hours')
            );
            const promoCanProceed = ((!hasTdcCourse || !!formData.scheduleSlotId || isOnlineTdcNoSchedule)) && allPromoPdcDone;

            const handlePromoTdcSelect = (slot) => {
                setFormData(prev => ({ ...prev, scheduleSlotId: slot.id, scheduleDate: slot.date, scheduleSession: slot.session, scheduleTime: slot.time_range }));
                setPromoStep(2); // Auto-advance to PDC selection
                showNotification('TDC schedule selected! Please select a PDC schedule.', 'success');
            };
            const handlePromoPdcDay1Select = (slot) => {
                if (isPromoSessionTakenByOtherCourse(slot)) {
                    showNotification('This date/session is already used by another selected PDC course.', 'warning');
                    return;
                }
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
                    showNotification(`${activePromoPdcCourse?.shortName || activePromoPdcCourse?.name || 'PDC'} Day 1 selected (${slot.session}). Pick a date below for Day 2.`, 'info');
                } else {
                    setPromoPdcSelectingDay2(false);
                    showNotification(`${activePromoPdcCourse?.shortName || activePromoPdcCourse?.name || 'PDC'} schedule selected!`, 'success');
                }
            };
            const handlePromoPdcDay2Select = (slot) => {
                if (isPromoSessionTakenByOtherCourse(slot)) {
                    showNotification('This date/session is already used by another selected PDC course.', 'warning');
                    return;
                }
                if (promoPdcDay1Session && slot.session !== promoPdcDay1Session) {
                    showNotification(`Day 2 must match Day 1 session: ${promoPdcDay1Session}`, 'warning');
                    return;
                }
                const date2Str = promoPdcDate2
                    ? `${promoPdcDate2.getFullYear()}-${String(promoPdcDate2.getMonth() + 1).padStart(2, '0')}-${String(promoPdcDate2.getDate()).padStart(2, '0')}`
                    : slot.date;
                setFormData(prev => ({ ...prev, promoPdcSlotId2: slot.id, promoPdcDate2: date2Str, promoPdcSession2: slot.session, promoPdcTime2: slot.time_range }));
                showNotification(`${activePromoPdcCourse?.shortName || activePromoPdcCourse?.name || 'PDC'} Day 2 selected!`, 'success');
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
                        <div className="cal-legend-row">
                            <div className="cal-legend-item morning-legend">
                                <span className="cal-legend-dot morning-dot"></span>
                                Morning
                            </div>
                            <div className="cal-legend-item afternoon-legend">
                                <span className="cal-legend-dot afternoon-dot"></span>
                                Afternoon
                            </div>
                            <div className="cal-legend-item whole-legend">
                                <span className="cal-legend-dot whole-dot"></span>
                                Whole Day
                            </div>
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
                                                        // Hide completely if no slots exist for this session
                                                        if (!slots || slots.length === 0) return null;

                                                        const hasSlots = slots.length > 0;
                                                        const anySelected = hasSlots && slots.some(s => formData.scheduleSlotId === s.id || formData.scheduleSlotId2 === s.id || formData.promoPdcSlotId2 === s.id);
                                                        const isFull = hasSlots && slots.every(s => s.available_slots === 0);
                                                        const hasMultiple = slots.length > 1;
                                                        const selectedSlotId = hasSlots ? slots.find(s => formData.scheduleSlotId === s.id || formData.scheduleSlotId2 === s.id || formData.promoPdcSlotId2 === s.id)?.id || "" : "";

                                                        const sessionLabel = (() => {
                                                            const sn = label.toLowerCase();
                                                            if (sn.includes('morning')) return 'Morning Class';
                                                            if (sn.includes('afternoon')) return 'Afternoon Class';
                                                            if (sn.includes('whole')) return 'Whole Day';
                                                            return label;
                                                        })();

                                                        const timeStr = slots[0].time_range.toLowerCase().replace(/ - /g, ' / ').replace(/ am/g, 'am').replace(/ pm/g, 'pm');

                                                        return (
                                                            <div
                                                                key={type}
                                                                className={`session-sub-box ${type}${anySelected ? ' selected' : ''}${isFull ? ' full' : ''}`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onDateClick(new Date(cy, cm, d));
                                                                    if (isFull) return;
                                                                    if (!hasMultiple) {
                                                                        if (promoStep === 2 && !formData.scheduleSlotId2) {
                                                                            handlePromoPdcDay1Select(slots[0]);
                                                                        } else if (promoPdcSelectingDay2) {
                                                                            handlePromoPdcDay2Select(slots[0]);
                                                                        }
                                                                    }
                                                                }}
                                                            >
                                                                <div className="session-sub-content">
                                                                    <div className="flex items-center justify-between gap-1 leading-none mb-1">
                                                                        <span className="session-sub-label-text text-[9px] font-black truncate">{sessionLabel}</span>
                                                                        <span className="session-sub-count-tag text-[8px] font-bold px-1 rounded bg-white/20">
                                                                            {isFull ? 'FULL' : `${slots[0].available_slots} Slots`}
                                                                        </span>
                                                                    </div>
                                                                    {hasMultiple ? (
                                                                        <select
                                                                            className="session-mini-select"
                                                                            value={selectedSlotId}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            onChange={(e) => {
                                                                                const id = parseInt(e.target.value);
                                                                                const s = slots.find(x => x.id === id);
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
                                                                        <div className="session-sub-time-mini text-[7px] font-medium opacity-80">{timeStr}</div>
                                                                    )}
                                                                </div>
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
                            <div className="schedule-banner__title" style={{ color: '#92400e' }}>{promoFlowTitle}</div>
                            <div className="schedule-banner__desc" style={{ color: '#78350f' }}>{promoFlowDesc}</div>
                        </div>
                        <div className="schedule-banner__actions">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {([
                                    hasTdcCourse ? { label: 'TDC', done: !!formData.scheduleSlotId || isOnlineTdcNoSchedule, active: (promoStep === 1 && !isPromoOnlineTdcLockedBundle) } : null,
                                    { label: 'PDC', done: allPromoPdcDone, active: promoStep === 2 }
                                ].filter(Boolean)).map((item, idx) => (
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

                    {isPromo && isOnlineTdcNoSchedule && (
                        <div className="schedule-banner schedule-banner--info" style={{ marginBottom: '16px' }}>
                            <svg className="schedule-banner__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 16V12M12 8H12.01" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            <div className="schedule-banner__body">
                                <div className="schedule-banner__title">Online TDC Selected</div>
                                <div className="schedule-banner__desc">
                                    {promoPdcCourses.length > 0 
                                        ? 'No branch slot selection is required for Online TDC. Please select schedules for your PDC tracks below.' 
                                        : 'No branch slot selection is required for Online TDC. You can proceed directly to enrollment.'}
                                </div>
                            </div>
                        </div>
                    )}

                    {promoStep === 2 && promoPdcCourses.length > 0 && (
                        <div className="schedule-banner schedule-banner--info" style={{ marginBottom: '14px' }}>
                            <svg className="schedule-banner__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" /></svg>
                            <div className="schedule-banner__body">
                                <div className="schedule-banner__title">PDC Schedule Progress</div>
                                <div className="schedule-banner__desc">Completed {pdcDoneCount} of {promoPdcCourses.length} PDC course schedules</div>
                            </div>
                        </div>
                    )}

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
                            <div className="type-selector-card" style={{ marginBottom: '16px' }}>
                                <div className="type-selector-title">
                                    Select TDC Type
                                    <span style={{ fontWeight: '400', color: 'var(--secondary-text)', fontSize: '0.82rem' }}>— F2F or Online</span>
                                </div>
                                <div className="type-selector-sub">Choose a TDC type to filter available schedules.</div>
                                <div className="type-btn-group">
                                    {promoTdcTypeOptions.map(type => (
                                        <button
                                            key={type}
                                            type="button"
                                            className={`type-btn${promoTdcType === type ? ' active' : ''}`}
                                            onClick={() => {
                                                setFormData(prev => {
                                                    const targetType = type.toLowerCase();
                                                    const matchingOpt = prev.course?.typeOptions?.find(opt => 
                                                        (opt.value || '').toLowerCase() === targetType || 
                                                        (opt.label || '').toLowerCase().includes(targetType)
                                                    );
                                                    return {
                                                        ...prev,
                                                        promoTdcType: type,
                                                        courseType: matchingOpt?.value || prev.courseType,
                                                        scheduleSlotId: null,
                                                        scheduleDate: '',
                                                        scheduleSession: '',
                                                        scheduleTime: ''
                                                    };
                                                });
                                            }}
                                        >
                                            {type === 'ONLINE' ? 'Online' : 'F2F'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {!isOnlineTdcNoSchedule && (
                                <>
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
                                </>
                            )}
                        </div>
                    )}

                    {promoStep === 2 && !isPromoOnlineTdcLockedBundle && (
                        <>
                            <>
                                {formData.scheduleSlotId2 && (
                                    <div className="schedule-banner schedule-banner--success" style={{ marginTop: '16px' }}>
                                        <svg className="schedule-banner__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                                        <div className="schedule-banner__body">
                                            <div className="schedule-banner__title">{activePromoPdcCourse?.shortName || activePromoPdcCourse?.name || 'PDC'} Schedule Selected</div>
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

                                {promoPdcCourses.length > 1 && (
                                    <div className="type-selector-card" style={{ marginTop: '12px' }}>
                                        <div className="type-selector-title">Select PDC Course To Schedule</div>
                                        <div className="type-selector-sub">Each selected PDC course needs its own schedule.</div>
                                        <div className="type-btn-group" style={{ flexWrap: 'wrap' }}>
                                            {promoPdcCourses.map((course, idx) => {
                                                const done = getIsPromoPdcComplete(course._pdcKey);
                                                const active = course._pdcKey === activePromoPdcCourseId;
                                                return (
                                                    <button
                                                        key={course._pdcKey}
                                                        type="button"
                                                        className={`type-btn${active ? ' active' : ''}`}
                                                        onClick={() => {
                                                            setActivePromoPdcCourseId(course._pdcKey);
                                                            setPromoPdcDate(null);
                                                            setPromoPdcDate2(null);
                                                        }}
                                                    >
                                                        {done ? '✓ ' : ''}{course.shortName || course.name} - {course._pdcLabel} {promoPdcCourses.length > 1 ? `(#${idx + 1})` : ''}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Active PDC course info — shown whenever in PDC scheduling (promoStep === 2) */}
                                {activePromoPdcCourse && (() => {
                                    const trackIdx = promoPdcCourses.findIndex(c => c._pdcKey === activePromoPdcCourse._pdcKey);
                                    const courseName = activePromoPdcCourse.name || activePromoPdcCourse.shortName || 'PDC';
                                    const vehicleLabel = activePromoPdcCourse._pdcLabel || activePromoPdcCourse._pdcKind || '';
                                    const trackLabel = promoPdcCourses.length > 1 ? `Track #${trackIdx + 1} of ${promoPdcCourses.length}` : '';
                                    const isDone = getIsPromoPdcComplete(activePromoPdcCourse._pdcKey);
                                    return (
                                        <div style={{
                                            marginTop: '12px', marginBottom: '4px',
                                            background: isDone ? 'linear-gradient(135deg,#f0fdf4,#dcfce7)' : 'linear-gradient(135deg,#eff6ff,#dbeafe)',
                                            border: `1.5px solid ${isDone ? '#86efac' : '#93c5fd'}`,
                                            borderRadius: '10px', padding: '10px 14px',
                                            display: 'flex', alignItems: 'center', gap: '10px',
                                        }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isDone ? '#16a34a' : '#2563eb'} strokeWidth="2">
                                                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                                            </svg>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '12px', color: isDone ? '#15803d' : '#1d4ed8', letterSpacing: '0.02em' }}>
                                                    {isDone ? '✓ Scheduled' : 'Now Scheduling'}{trackLabel ? ` — ${trackLabel}` : ''}
                                                </div>
                                                <div style={{ fontSize: '13px', color: '#1e293b', marginTop: '2px' }}>
                                                    <strong>{courseName}</strong>{vehicleLabel ? <span style={{ color: '#6b7280', fontWeight: 400 }}> · {vehicleLabel}</span> : null}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {!promoPdcSelectingDay2 && !formData.scheduleSlotId2 && (
                                    <>
                                        {showsTransmissionSelector && (
                                            <div className="type-selector-card" style={{ marginTop: '16px' }}>
                                                <div className="type-selector-title">
                                                    {fixedPromoPdcTransmission ? (formData.course?._isManualBundle ? 'Selected Transmission' : 'Transmission (Fixed by Course)') : 'Select Transmission'}
                                                </div>
                                                {fixedPromoPdcTransmission ? (
                                                    <div className="type-btn-group">
                                                        <button type="button" className="type-btn active" disabled>
                                                            {fixedPromoPdcTransmission === 'MT' ? 'Manual (MT)' : 'Automatic (AT)'}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="type-btn-group">
                                                        {allowedPromoPdcTransmissions.includes('MT') && (
                                                            <button type="button" className={`type-btn${effectivePromoPdcTransmission === 'MT' ? ' active' : ''}`} onClick={() => { setPromoPdcMotorType('MT'); setPromoPdcDate(null); }}>Manual (MT)</button>
                                                        )}
                                                        {allowedPromoPdcTransmissions.includes('AT') && (
                                                            <button type="button" className={`type-btn${effectivePromoPdcTransmission === 'AT' ? ' active' : ''}`} onClick={() => { setPromoPdcMotorType('AT'); setPromoPdcDate(null); }}>Automatic (AT)</button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {(!requiresTransmissionChoice || !!effectivePromoPdcTransmission) && (
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

                                {(promoPdcSelectingDay2 || !!formData.promoPdcSlotId2) && (
                                    <>
                                        {!formData.promoPdcSlotId2 && (
                                            <div className="schedule-banner schedule-banner--info" style={{ marginTop: '16px' }}>
                                                <svg className="schedule-banner__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                                <div className="schedule-banner__body">
                                                    <div className="schedule-banner__title">Day 2 Selection Required</div>
                                                    <div className="schedule-banner__desc">Now pick a date for <strong>Day 2</strong>.</div>
                                                </div>
                                            </div>
                                        )}
                                        <div style={{ marginTop: '16px' }}>
                                            {renderPromoCalendar(promoPdcDay2CalMonth, setPromoPdcDay2CalMonth, (d) => setPromoPdcDate2(d), promoPdcDate2, formData.scheduleDate2, promoPdcCalendarSlots)}
                                        </div>
                                        {promoPdcDate2 && !formData.promoPdcSlotId2 && (
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
                        </>
                    )}

                    {promoStep === 2 && isPromoOnlineTdcLockedBundle && (
                        <div className="schedule-banner" style={{ marginTop: '24px', background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', border: '1.5px solid #93c5fd', borderRadius: '12px', padding: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                </div>
                                <div className="schedule-banner__body">
                                    <h4 className="schedule-banner__title" style={{ color: '#1e40af', fontSize: '1.1rem', marginBottom: '4px' }}>PDC Scheduling Restricted</h4>
                                    <div className="schedule-banner__desc" style={{ color: '#1e3a8a', fontSize: '0.95rem', lineHeight: '1.5' }}>
                                        For <strong>Online TDC bundles</strong>, practical schedules cannot be set during enrollment.
                                        The student must first complete the Online TDC course before they can be assigned to a PDC slot.
                                    </div>
                                </div>
                            </div>
                            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #bfdbfe', color: '#1e40af', fontSize: '0.85rem', fontWeight: 500 }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginRight: '6px', verticalAlign: 'middle' }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                                Note: You may proceed to payment and enrollment now.
                            </div>
                        </div>
                    )}

                    <div className="step-actions">
                        <button type="button" className="back-btn" onClick={prevStep}>
                            <svg className="mr-2" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back
                        </button>
                        {(promoCanProceed && promoStep === 2) && (
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
                    formData.course.category === 'PDC'
                        ? /* PDC: two-level selector — vehicle type first, then transmission */ (() => {
                            // Group typeOptions by vehicle category.
                            // Pass the course name as fallback so that Motorcycle/Tricycle courses
                            // with generic option values ("Manual"/"Automatic") are bucketed correctly.
                            const pdcCourseName = formData.course.name || '';
                            const vehicleGroups = {};
                            formData.course.typeOptions.forEach(opt => {
                                const vg = getPdcVehicleGroup(opt.value, pdcCourseName);
                                if (!vehicleGroups[vg]) vehicleGroups[vg] = [];
                                vehicleGroups[vg].push(opt);
                            });
                            const vehicleGroupKeys = Object.keys(vehicleGroups);

                            // Auto-select the only vehicle group — skip the redundant selector click
                            // (e.g., PDC Motorcycle course always has only one group: 'motorcycle')
                            const effectivePdcVehicleType = vehicleGroupKeys.length === 1
                                ? vehicleGroupKeys[0]
                                : pdcVehicleType;
                            if (vehicleGroupKeys.length === 1 && pdcVehicleType !== vehicleGroupKeys[0]) {
                                // Defer the state update to avoid setState-during-render
                                Promise.resolve().then(() => setPdcVehicleType(vehicleGroupKeys[0]));
                            }

                            // Options for the currently-selected vehicle group
                            const currentGroupOpts = effectivePdcVehicleType ? (vehicleGroups[effectivePdcVehicleType] || []) : [];
                            const uniqueTransmissions = [...new Set(currentGroupOpts.map(opt => getPdcTxFromOption(opt.value)).filter(Boolean))];
                            const needsTransmission = uniqueTransmissions.length > 0;

                            const vehicleLabels = { car: 'Car', motorcycle: 'Motorcycle', tricycle: 'Tricycle', b1b2: 'B1 Van / B2 L300' };
                            const singleGroupLabel = vehicleGroupKeys.length === 1 ? (vehicleLabels[vehicleGroupKeys[0]] || vehicleGroupKeys[0]) : null;

                            return (
                                <div className={`type-selector-card${formData.courseType ? ' has-selection' : ''}`}>
                                    {/* Step A: Vehicle type — only show selector when there are multiple vehicle groups */}
                                    <div className="type-selector-title">
                                        {singleGroupLabel ? `${singleGroupLabel} — Select Transmission` : 'Select Vehicle Type'}
                                        <span style={{ color: 'red' }}>*</span>
                                    </div>
                                    <div className="type-selector-sub">{singleGroupLabel ? `Select a transmission to view available ${singleGroupLabel} schedules.` : 'Choose your vehicle type before selecting a schedule.'}</div>
                                    {checkingTypeAvail && (
                                        <div style={{ fontSize: '0.78rem', color: 'var(--secondary-text)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                                            Checking slot availability…
                                        </div>
                                    )}
                                    {/* Only show vehicle type buttons when there are multiple vehicle types */}
                                    {vehicleGroupKeys.length > 1 && (
                                        <div className="type-btn-group">
                                            {vehicleGroupKeys.map(vg => {
                                                const optsForGroup = vehicleGroups[vg];
                                                const allDisabled = !checkingTypeAvail && optsForGroup.every(opt => {
                                                    const checked = opt.value in typeAvailability;
                                                    return checked && typeAvailability[opt.value] === false;
                                                });
                                                const isSelected = effectivePdcVehicleType === vg;
                                                return (
                                                    <button
                                                        key={vg}
                                                        type="button"
                                                        className={`type-btn${isSelected ? ' active' : ''}${allDisabled ? ' type-btn--disabled' : ''}${checkingTypeAvail ? ' type-btn--checking' : ''}`}
                                                        disabled={allDisabled || checkingTypeAvail}
                                                        title={allDisabled ? 'No available slots for this vehicle type' : checkingTypeAvail ? 'Checking availability…' : undefined}
                                                        onClick={() => {
                                                            if (allDisabled || checkingTypeAvail) return;
                                                            setPdcVehicleType(vg);
                                                            setPdcTransmission('');
                                                            const groupOpts = vehicleGroups[vg];
                                                            const txCodes = [...new Set(groupOpts.map(o => getPdcTxFromOption(o.value)).filter(Boolean))];
                                                            if (txCodes.length === 0) {
                                                                // No transmission needed — auto-select the single option
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    courseType: groupOpts[0].value,
                                                                    scheduleDate: '', scheduleSlotId: null, scheduleSession: '', scheduleTime: '',
                                                                    scheduleDate2: '', scheduleSlotId2: null, scheduleSession2: '', scheduleTime2: ''
                                                                }));
                                                                setSelectedScheduleDate('');
                                                            } else {
                                                                // Transmission still to be chosen — clear courseType
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    courseType: '',
                                                                    scheduleDate: '', scheduleSlotId: null, scheduleSession: '', scheduleTime: '',
                                                                    scheduleDate2: '', scheduleSlotId2: null, scheduleSession2: '', scheduleTime2: ''
                                                                }));
                                                                setSelectedScheduleDate('');
                                                            }
                                                        }}
                                                    >
                                                        <span className="type-btn__label">{vehicleLabels[vg] || (vg.charAt(0).toUpperCase() + vg.slice(1))}</span>
                                                        {allDisabled && <span className="type-btn__no-slots">No Slots</span>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Step B: Transmission — only if vehicle type is selected (or auto-selected) and options exist */}
                                    {effectivePdcVehicleType && needsTransmission && (
                                        <>
                                            {vehicleGroupKeys.length > 1 && (
                                                <div className="type-selector-title" style={{ marginTop: '14px' }}>
                                                    Select Transmission
                                                    <span style={{ fontWeight: '400', color: 'var(--secondary-text)', fontSize: '0.82rem' }}>— Manual or Automatic</span>
                                                    <span style={{ color: 'red' }}>*</span>
                                                </div>
                                            )}
                                            <div className="type-btn-group">
                                                {uniqueTransmissions.map(tx => {
                                                    const matchingOpt = currentGroupOpts.find(opt => getPdcTxFromOption(opt.value) === tx);
                                                    const typeChecked = matchingOpt && !checkingTypeAvail && (matchingOpt.value in typeAvailability);
                                                    const typeDisabled = typeChecked && typeAvailability[matchingOpt.value] === false;
                                                    const isSelectedTx = pdcTransmission === tx;
                                                    return (
                                                        <button
                                                            key={tx}
                                                            type="button"
                                                            className={`type-btn${isSelectedTx ? ' active' : ''}${typeDisabled ? ' type-btn--disabled' : ''}${checkingTypeAvail ? ' type-btn--checking' : ''}`}
                                                            disabled={typeDisabled || checkingTypeAvail || !matchingOpt}
                                                            title={typeDisabled ? 'No available slots for this transmission' : checkingTypeAvail ? 'Checking availability…' : undefined}
                                                            onClick={() => {
                                                                if (typeDisabled || checkingTypeAvail || !matchingOpt) return;
                                                                setPdcTransmission(tx);
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    courseType: matchingOpt.value,
                                                                    scheduleDate: '', scheduleSlotId: null, scheduleSession: '', scheduleTime: '',
                                                                    scheduleDate2: '', scheduleSlotId2: null, scheduleSession2: '', scheduleTime2: ''
                                                                }));
                                                                setSelectedScheduleDate('');
                                                            }}
                                                        >
                                                            <span className="type-btn__label">{tx === 'at' ? 'Automatic (AT)' : 'Manual (MT)'}</span>
                                                            {typeDisabled && <span className="type-btn__no-slots">No Slots</span>}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}

                                    {!formData.courseType && (
                                        <div className="type-error-msg">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                                            {pdcVehicleType && needsTransmission
                                                ? 'Please select a transmission to view available schedules.'
                                                : 'Please select a vehicle type to view available schedules.'}
                                        </div>
                                    )}
                                </div>
                            );
                        })()
                        : /* TDC: original flat type selector (unchanged) */
                        <div className={`type-selector-card${formData.courseType ? ' has-selection' : ''}`}>
                            <div className="type-selector-title">
                                Select Type
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
                                    const isOnlineTdcType = formData.course?.category === 'TDC' && String(opt.value || '').toLowerCase().includes('online');
                                    const typeChecked = !checkingTypeAvail && (opt.value in typeAvailability);
                                    const typeDisabled = !isOnlineTdcType && typeChecked && typeAvailability[opt.value] === false;
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

                {isOnlineTdcNoSchedule && (
                    <div className="schedule-banner schedule-banner--info">
                        <svg className="schedule-banner__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M8 12h8" /></svg>
                        <div className="schedule-banner__body">
                            <div className="schedule-banner__title">Online TDC Selected</div>
                            <div className="schedule-banner__desc">No branch slot selection is required for Online TDC. You can proceed directly to Enrollment.</div>
                        </div>
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
                                <div className="policy-banner__desc">Practical schedules can be booked for any available date, including today. Sundays are not available.</div>
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
                            <div className="cal-legend-row">
                                <div className="cal-legend-item morning-legend">
                                    <span className="cal-legend-dot morning-dot"></span>
                                    Morning
                                </div>
                                <div className="cal-legend-item afternoon-legend">
                                    <span className="cal-legend-dot afternoon-dot"></span>
                                    Afternoon
                                </div>
                                <div className="cal-legend-item whole-legend">
                                    <span className="cal-legend-dot whole-dot"></span>
                                    Whole Day
                                </div>
                            </div>
                            <div className="calendar-grid-7">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                    <div key={day} className="cal-day-header">{day}</div>
                                ))}
                                {(() => {
                                    const year = viewDate.getFullYear();
                                    const month = viewDate.getMonth();
                                    const firstDay = new Date(year, month, 1).getDay();
                                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                                    const days = [];
                                    for (let i = 0; i < firstDay; i++) {
                                        days.push(<div key={`pad-${i}`} className="cal-day cal-day--pad" />);
                                    }
                                    const minDateStr = (() => { const d = new Date(today); d.setDate(d.getDate() + 0); return d.toISOString().split('T')[0]; })();
                                    for (let d = 1; d <= daysInMonth; d++) {
                                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                        const isSelected = selectedScheduleDate === dateStr;
                                        const isToday = today === dateStr;
                                        const isSunday = new Date(year, month, d).getDay() === 0;
                                        const isDisabled = dateStr < minDateStr || isSunday;
                                        const daySlots = isDisabled ? [] : pdcCalendarSlots.filter(s => dateStr >= s.date && dateStr <= (s.end_date || s.date));
                                        const slotStatus = isDisabled ? '' : daySlots.length === 0 ? ' no-slots' : daySlots.every(s => s.available_slots === 0) ? ' full-slots' : ' has-slots';
                                        let cls = 'cal-day' + slotStatus;
                                        if (isDisabled) cls += ' cal-day--disabled';
                                        else if (isSelected) cls += ' cal-day--selected';
                                        if (isToday) cls += ' cal-day--today';
                                        days.push(
                                            <div key={d} className={cls} onClick={() => !isDisabled && setSelectedScheduleDate(dateStr)}>
                                                <div className="cal-day-header-mini flex items-center justify-between px-2 pt-2 pb-1">
                                                    <span className={`cal-day-num text-[13px] font-bold ${isToday ? 'text-[#2157da]' : ''}`}>{d}</span>
                                                    {isToday && <div className="w-1.5 h-1.5 rounded-full bg-[#2157da] opacity-60 flex-shrink-0" />}
                                                </div>
                                                <div className="day-slots-container">
                                                    {(() => {
                                                        const morningSlots = daySlots.filter(s => (s.session || '').toLowerCase().includes('morning'));
                                                        const afternoonSlots = daySlots.filter(s => (s.session || '').toLowerCase().includes('afternoon'));
                                                        const wholeDaySlots = daySlots.filter(s => (s.session || '').toLowerCase().includes('whole'));

                                                        const renderSubBox = (label, slots, type) => {
                                                            // Hide completely if no slots exist for this session
                                                            if (!slots || slots.length === 0) return null;

                                                            const hasSlots = slots.length > 0;
                                                            const isSelected = hasSlots && slots.some(s => formData.scheduleSlotId === s.id || formData.scheduleSlotId2 === s.id);
                                                            const currentSlotId = hasSlots ? slots.find(s => formData.scheduleSlotId === s.id || formData.scheduleSlotId2 === s.id)?.id || "" : "";
                                                            const allFull = hasSlots && slots.every(s => s.available_slots === 0);
                                                            const hasMultiple = slots.length > 1;

                                                            const sessionLabel = (() => {
                                                                const sn = label.toLowerCase();
                                                                if (sn.includes('morning')) return 'Morning Class';
                                                                if (sn.includes('afternoon')) return 'Afternoon Class';
                                                                if (sn.includes('whole')) return 'Whole Day';
                                                                return label;
                                                            })();

                                                            const timeStr = slots[0].time_range.toLowerCase().replace(/ - /g, ' / ').replace(/ am/g, 'am').replace(/ pm/g, 'pm');

                                                            return (
                                                                <div
                                                                    key={type}
                                                                    className={`session-sub-box ${type}${isSelected ? ' selected' : ''}${allFull ? ' full' : ''}`}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectedScheduleDate(dateStr);
                                                                        if (allFull) return;
                                                                        if (!hasMultiple) handleScheduleSelect(slots[0]);
                                                                    }}
                                                                >
                                                                    <div className="session-sub-content">
                                                                        <div className="flex items-center justify-between gap-1 leading-none mb-1">
                                                                            <span className="session-sub-label-text text-[9px] font-black truncate">{sessionLabel}</span>
                                                                            <span className="session-sub-count-tag text-[8px] font-bold px-1 rounded bg-white/20">
                                                                                {allFull ? 'FULL' : `${slots[0].available_slots} Slots`}
                                                                            </span>
                                                                        </div>

                                                                        {hasSlots && (
                                                                            hasMultiple ? (
                                                                                <select
                                                                                    className="session-mini-select"
                                                                                    value={currentSlotId}
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
                                                                                            {s.time_range} ({s.available_slots} Slots)
                                                                                        </option>
                                                                                    ))}
                                                                                </select>
                                                                            ) : (
                                                                                <div className="session-sub-time-mini text-[7px] font-medium opacity-80">{timeStr}</div>
                                                                            )
                                                                        )}
                                                                    </div>
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
                    formData.courseType && isTDC && !String(formData.courseType || '').toLowerCase().includes('online') && (
                        <div className="slots-section">
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

                            <h4 className="slots-header">
                                Available TDC Schedules — {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </h4>

                            {(() => {
                                const filteredPdcSlots = tdcSlotsForMonth.filter(slot => {
                                    if (!formData.courseType) return true;
                                    const slotType = (slot.course_type || '').toLowerCase().trim();
                                    const selectedType = formData.courseType.toLowerCase().trim();
                                    return slotType === selectedType || slotType.includes(selectedType) || selectedType.includes(slotType);
                                });

                                return loadingSchedule ? (
                                    <div className="slots-loading">Loading available slots...</div>
                                ) : filteredPdcSlots.length === 0 ? (
                                    <div className="slots-empty">
                                        <p className="slots-empty__title">No available slots in {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                                        <p className="slots-empty__sub">Try navigating to another month using the arrows above or check back later.</p>
                                    </div>
                                ) : (
                                    <div className="slots-grid">
                                        {filteredPdcSlots.map(slot =>
                                            renderPromoSlotCard(slot, formData.scheduleSlotId === slot.id, () => handleScheduleSelect(slot), slot.course_type || 'F2F')
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    )
                }

                {
                    formData.courseType && !isTDC && selectedScheduleDate && isSelectingDay2 && (
                        <div className="day2-lock-badge" style={{ marginTop: '24px' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                            Showing {formData.scheduleSession} slots only — select Day 2
                        </div>
                    )
                }

                {/* Always-visible Back button + Next when schedule is fully picked */}
                <div className="step-actions step-actions--always mt-8">
                    <button type="button" className="back-btn" onClick={prevStep}>
                        <svg className="mr-2" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                    </button>
                    {/* Show Next button when schedule is fully selected */}
                    {(String(formData.courseType || '').toLowerCase().includes('online') && isTDC) || (formData.scheduleSlotId && (!isSelectingDay2 || formData.scheduleSlotId2)) ? (
                        <button type="button" className="next-btn" onClick={nextStep}>
                            Next: Enrollment
                            <svg className="ml-2" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    ) : null}
                </div>
            </div>
        );
    };

    const renderStep4 = () => {
        const dynamicCourse = packages.find(p => p.id === formData.course?.id) || formData.course;
        const selectedTypeOpt = dynamicCourse?.typeOptions?.find(opt => opt.value === formData.courseType);
        const isRegularPromoBundle = isPromo && !!formData.course?._isManualBundle;
        const regularBundleCourses = isRegularPromoBundle
            ? [
                ...(formData.course?._tdcCourse ? [formData.course._tdcCourse] : []),
                ...((formData.course?._pdcCourses && formData.course._pdcCourses.length > 0)
                    ? formData.course._pdcCourses
                    : (formData.course?._pdcCourse ? [formData.course._pdcCourse] : []))
            ]
            : [];
        const selectedPrice = isRegularPromoBundle
            ? regularBundleCourses.reduce((sum, c) => {
                if (c.category === 'TDC' && selectedTypeOpt) {
                    return sum + selectedTypeOpt.price;
                }
                return sum + Number(c.price || 0);
            }, 0)
            : (selectedTypeOpt?.price || dynamicCourse?.price || 0);
        const regularBundleOriginalTotal = regularBundleCourses.reduce((sum, c) => {
            const itemPrice = Number(c?.price || 0);
            const itemOriginal = Number(c?.original_price ?? c?.originalPrice ?? itemPrice);
            return sum + itemOriginal;
        }, 0);
        const originalPrice = isRegularPromoBundle
            ? regularBundleOriginalTotal
            : (selectedTypeOpt?.original_price || dynamicCourse?.original_price || 0);
        const addonsTotal = (formData.addons || []).reduce((sum, a) => sum + (a.price || 0), 0);
        const subtotal = selectedPrice + addonsTotal;
        
        // Calculate Saturday Surcharge (₱150 per Saturday for PDC)
        const calculateSaturdaySurcharge = () => {
            if (isOnlineTdcNoSchedule) return 0;
            let surcharge = 0;
            
            // Regular PDC
            if (formData.course?.category === 'PDC') {
                if (formData.scheduleDate) {
                    const d1 = new Date(formData.scheduleDate);
                    if (d1.getDay() === 6) surcharge += 150;
                }
                if (formData.scheduleDate2) {
                    const d2 = new Date(formData.scheduleDate2);
                    if (d2.getDay() === 6) surcharge += 150;
                }
            }

            // Promo PDC Selections
            if (isPromo) {
                Object.values(promoPdcSelections).forEach(sel => {
                    if (sel.scheduleDate) {
                        const d1 = new Date(sel.scheduleDate);
                        if (d1.getDay() === 6) surcharge += 150;
                    }
                    if (sel.promoPdcDate2) {
                        const d2 = new Date(sel.promoPdcDate2);
                        if (d2.getDay() === 6) surcharge += 150;
                    }
                });
            }
            return surcharge;
        };

        // Embed surcharge into subtotal and total amount
        const saturdaySurchargeAmount = calculateSaturdaySurcharge();
        const displaySelectedPrice = selectedPrice + saturdaySurchargeAmount;
        const discountPct = formData.course?._isManualBundle ? 3 : (selectedTypeOpt?.discount || dynamicCourse?.discount || 0);
        const discountLabel = formData.course?._isManualBundle ? 'Multi-Course Discount (3%)' : `Discount (${discountPct}%)`;
        const promoDiscount = discountPct > 0 ? Number((subtotal * (discountPct / 100)).toFixed(2)) : 0;
        const embeddedSubtotal = subtotal + saturdaySurchargeAmount;
        const totalAmount = Math.max(0, Number((embeddedSubtotal - promoDiscount).toFixed(2)));

        const promoPdcSummaryCourses = isPromo
            ? ((formData.course?._pdcCourses && formData.course._pdcCourses.length > 0)
                ? formData.course._pdcCourses
                : formData.course?._pdcCourse ? [formData.course._pdcCourse] : [])
            : [];

        let courseTypeDisplay = '';
        if (isPromo) {
            const tdcDisplay = promoTdcType === 'F2F' ? 'TDC F2F' : `TDC ${promoTdcType || 'F2F'}`;
            const pdcDisplay = `${promoPdcSummaryCourses.length || 1} PDC course${(promoPdcSummaryCourses.length || 1) > 1 ? 's' : ''}`;
            courseTypeDisplay = `${tdcDisplay} + ${pdcDisplay}`;
        } else if (selectedTypeOpt) {
            courseTypeDisplay = selectedTypeOpt.label;
        }

        const requiredAmount = formData.paymentStatus === 'Downpayment' ? 1 : totalAmount;
        const balanceDue = totalAmount - (Number(formData.amountPaid) || 0);
        const change = formData.amountPaid ? Math.max(0, Number(formData.amountPaid) - totalAmount) : 0;

        return (
            <div className="step-content animate-fadeIn">
                <div className="section-title">
                    <span className="step-badge">4</span>
                    <h3>Enrollment & Payment</h3>
                </div>

                <div className="form-card-inner">
                    {/* ── Booking Summary Card ── */}
                    {/* ── Booking Summary Card(s) ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {formData.course && !isPromo && !formData.course?._isManualBundle && (
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
                                            {courseTypeDisplay && (
                                                <>
                                                    <span className="payment-summary-card__dot">·</span>
                                                    <span style={{ fontWeight: '700', color: 'var(--primary-color)' }}>{courseTypeDisplay}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="payment-summary-card__right">
                                    {selectedTypeOpt && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <span className="payment-summary-card__type-label" style={{ margin: 0 }}>TYPE</span>
                                            <span className="payment-summary-card__type-value">{selectedTypeOpt.label}</span>
                                        </div>
                                    )}
                                    <div className="payment-summary-card__price-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                        {originalPrice > selectedPrice && (
                                            <span className="payment-summary-card__price" style={{ fontSize: '0.9rem', color: '#94a3b8', textDecoration: 'line-through', fontWeight: 'bold' }}>
                                                ₱{originalPrice.toLocaleString()}
                                            </span>
                                        )}
                                        <span className="payment-summary-card__price" style={{ fontSize: '1.4rem' }}>
                                            ₱{selectedPrice.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {formData.course && isPromo && !isRegularPromoBundle && (
                            <div className="payment-summary-card">
                                <div className="payment-summary-card__left">
                                    <div className="payment-summary-card__icon">
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v4" /><rect x="2" y="10" width="20" height="12" rx="2" /><circle cx="12" cy="16" r="2" /></svg>
                                    </div>
                                    <div>
                                        <p className="payment-summary-card__course-name">{formData.course.name}</p>
                                        <div className="payment-summary-card__meta">
                                            <span className="payment-summary-card__pill">PROMO</span>
                                            <span className="payment-summary-card__dot">·</span>
                                            <span>{formData.course.duration}</span>
                                            {courseTypeDisplay && (
                                                <>
                                                    <span className="payment-summary-card__dot">·</span>
                                                    <span style={{ fontWeight: '700', color: 'var(--primary-color)' }}>{courseTypeDisplay}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="payment-summary-card__right">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <span className="payment-summary-card__type-label" style={{ margin: 0 }}>PROMO</span>
                                        <span className="payment-summary-card__type-value">BUNDLE</span>
                                    </div>
                                    <div className="payment-summary-card__price-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                        {originalPrice > selectedPrice && (
                                            <span className="payment-summary-card__price" style={{ fontSize: '0.9rem', color: '#94a3b8', textDecoration: 'line-through', fontWeight: 'bold' }}>
                                                ₱{originalPrice.toLocaleString()}
                                            </span>
                                        )}
                                        <span className="payment-summary-card__price" style={{ fontSize: '1.4rem' }}>
                                            ₱{selectedPrice.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {isRegularPromoBundle && regularBundleCourses.length > 0 && (
                            <div className="payment-form-section" style={{ marginTop: '2px' }}>
                                <p className="payment-form-section__title">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 7h18M7 3v4m10-4v4M5 11h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z" /></svg>
                                    Selected Courses Breakdown (Regular Promo Bundle)
                                </p>
                                <div style={{ display: 'grid', gap: '10px' }}>
                                    {regularBundleCourses.map((course, idx) => {
                                        const itemPrice = Number(course?.price || 0);
                                        const itemOriginal = Number(course?.original_price ?? course?.originalPrice ?? itemPrice);
                                        const typeLabel = String(course?.course_type || '').toUpperCase();
                                        return (
                                            <div key={`${course?.id || course?.name || 'course'}-${idx}`} className="payment-summary-card" style={{ margin: 0 }}>
                                                <div className="payment-summary-card__left">
                                                    <div className="payment-summary-card__icon">
                                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v4" /><rect x="2" y="10" width="20" height="12" rx="2" /><circle cx="12" cy="16" r="2" /></svg>
                                                    </div>
                                                    <div>
                                                        <p className="payment-summary-card__course-name">{course?.name || 'Selected course'}</p>
                                                        <div className="payment-summary-card__meta">
                                                            <span className="payment-summary-card__pill">{course?.category || 'COURSE'}</span>
                                                            {course?.duration && (
                                                                <>
                                                                    <span className="payment-summary-card__dot">·</span>
                                                                    <span>{course.duration}</span>
                                                                </>
                                                            )}
                                                            {typeLabel && (
                                                                <>
                                                                    <span className="payment-summary-card__dot">·</span>
                                                                    <span style={{ fontWeight: '700', color: 'var(--primary-color)' }}>{typeLabel}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="payment-summary-card__right">
                                                    <div className="payment-summary-card__price-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                                        {itemOriginal > itemPrice && (
                                                            <span className="payment-summary-card__price" style={{ fontSize: '0.9rem', color: '#94a3b8', textDecoration: 'line-through', fontWeight: 'bold' }}>
                                                                ₱{itemOriginal.toLocaleString()}
                                                            </span>
                                                        )}
                                                        <span className="payment-summary-card__price" style={{ fontSize: '1.2rem' }}>
                                                            ₱{itemPrice.toLocaleString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>



                    {/* ── Add-ons Selection ── */}
                    <div className="payment-form-section addons-section">
                        <p className="payment-form-section__title">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
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
                                            {isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
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
                            <span>
                                {formData.course?._isManualBundle 
                                    ? formData.course.name.replace('Manual Bundle: ', '')
                                    : `Course Fee (${formData.courseType || 'Standard'})`}
                            </span>
                            <span>₱{displaySelectedPrice.toLocaleString()}</span>
                        </div>
                        {formData.addons.map(a => (
                            <div key={a.id} className="breakdown-row">
                                <span>{a.name}</span>
                                <span>₱{a.price.toLocaleString()}</span>
                            </div>
                        ))}
                        <div className="breakdown-row" style={{ marginTop: '5px', paddingTop: '5px', borderTop: '1px dashed #e2e8f0' }}>
                            <span style={{ color: '#64748b' }}>Subtotal</span>
                            <span style={{ color: '#64748b' }}>₱{embeddedSubtotal.toLocaleString()}</span>
                        </div>
                        {discountPct > 0 && (
                            <div className="breakdown-row" style={{ color: '#ef4444', fontWeight: 'bold' }}>
                                <span>{discountLabel}</span>
                                <span>-₱{promoDiscount.toLocaleString()}</span>
                            </div>
                        )}
                        <div className="breakdown-row total">
                            <span>Total Amount Due</span>
                            <span>₱{totalAmount.toLocaleString()}</span>
                        </div>

                        {formData.paymentStatus === 'Downpayment' && (
                            <div className="breakdown-row dpt-badge" style={{ marginTop: '10px', background: '#fffbeb', padding: '10px', borderRadius: '8px', border: '1px solid #fde68a' }}>
                                <div>
                                    <div style={{ fontWeight: '700', color: '#92400e', fontSize: '0.85rem' }}>DOWNPAYMENT (DPT) MODE</div>
                                    <div style={{ fontSize: '0.75rem', color: '#b45309' }}>Any amount can be accepted and recorded today</div>
                                </div>
                                <div style={{ fontWeight: '800', color: '#92400e', fontSize: '1.1rem' }}>Flexible</div>
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
                                    disabled={adminProfile?.rawRole === 'admin' && !!adminProfile?.branchId}
                                >
                                    {branches.map(b => <option key={b.id} value={b.id}>{formatBranchName(b.name)}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Payment Method</label>
                                <select name="paymentMethod" value={formData.paymentMethod} onChange={handleChange}>
                                    <option value="Cash">Cash</option>
                                    <option value="StarPay">StarPay</option>
                                </select>
                            </div>
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
                                        <span className="field-hint">Enter any amount for downpayment</span>
                                    )}
                                </label>
                                <input type="number" name="amountPaid" value={formData.amountPaid} onChange={handleChange} placeholder={formData.paymentStatus === 'Downpayment' ? 'Enter any amount' : `₱${requiredAmount.toLocaleString()}`} required />
                                {formData.paymentStatus !== 'Downpayment' && formData.amountPaid && Number(formData.amountPaid) >= requiredAmount && (
                                    <div className="amount-required-row">
                                        <span className="amount-required-row__label">Required</span>
                                        <span className="amount-required-row__value">₱{requiredAmount.toLocaleString()}</span>
                                        {change > 0 && (
                                            <span className="amount-change-badge">Change: ₱{change.toLocaleString()}</span>
                                        )}
                                    </div>
                                )}
                                {formData.paymentStatus !== 'Downpayment' && formData.amountPaid && Number(formData.amountPaid) > 0 && Number(formData.amountPaid) < requiredAmount && (
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
                    const canProceed = isEnough;

                    let hint = null;
                    if (!hasAmount) hint = 'Enter the amount paid to continue.';
                    else if (!isEnough) {
                        hint = formData.paymentStatus === 'Downpayment'
                            ? 'Enter any amount greater than ₱0 to continue.'
                            : `Amount is short by ₱${(requiredAmount - paid).toLocaleString()}.`;
                    }

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

    const renderStep5 = () => {
        const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not selected';

        // Determine schedule label prefixes
        const isTdcCourse = formData.course?.category === 'TDC';
        const isOnlineTdcNoSchedule =
            ['TDC', 'PROMO', 'BUNDLE'].includes(String(formData.course?.category || '').toUpperCase()) &&
            (String(formData.courseType || '').toLowerCase().includes('online') ||
                String(formData.courseType || '').toLowerCase().includes('otdc') ||
                String(formData.promoTdcType || '').toLowerCase().includes('online') ||
                String(formData.promoTdcType || '').toLowerCase().includes('otdc') ||
                String(formData.course?.name || '').toLowerCase().includes('otdc') ||
                String(formData.course?.shortName || '').toLowerCase().includes('otdc'));
        const sessionPrefix = isTdcCourse ? 'TDC' : (formData.course?.category === 'PDC' ? 'PDC' : '');

        // Recalculate balance for downpayment
        const dynamicCourse = packages.find(p => p.id === formData.course?.id) || formData.course;
        const selectedTypeOpt = dynamicCourse?.typeOptions?.find(opt => opt.value === formData.courseType);
        const isRegularPromoBundle = isPromo && !!formData.course?._isManualBundle;
        const regularBundleCourses = isRegularPromoBundle
            ? [
                ...(formData.course?._tdcCourse ? [formData.course._tdcCourse] : []),
                ...((formData.course?._pdcCourses && formData.course._pdcCourses.length > 0)
                    ? formData.course._pdcCourses
                    : (formData.course?._pdcCourse ? [formData.course._pdcCourse] : []))
            ]
            : [];
        const selectedPrice = isRegularPromoBundle
            ? regularBundleCourses.reduce((sum, c) => {
                if (c.category === 'TDC' && selectedTypeOpt) {
                    return sum + selectedTypeOpt.price;
                }
                return sum + Number(c.price || 0);
            }, 0)
            : (selectedTypeOpt?.price || dynamicCourse?.price || 0);
        const addonsTotal = (formData.addons || []).reduce((sum, a) => sum + (a.price || 0), 0);
        const subtotal = selectedPrice + addonsTotal;
        
        // Calculate Saturday Surcharge (₱150 per Saturday for PDC)
        const calculateSaturdaySurcharge = () => {
            if (isOnlineTdcNoSchedule) return 0;
            let surcharge = 0;
            
            // Regular PDC
            if (formData.course?.category === 'PDC') {
                if (formData.scheduleDate) {
                    const d1 = new Date(formData.scheduleDate);
                    if (d1.getDay() === 6) surcharge += 150;
                }
                if (formData.scheduleDate2) {
                    const d2 = new Date(formData.scheduleDate2);
                    if (d2.getDay() === 6) surcharge += 150;
                }
            }

            // Promo PDC Selections
            if (isPromo) {
                Object.values(promoPdcSelections).forEach(sel => {
                    if (sel.scheduleDate) {
                        const d1 = new Date(sel.scheduleDate);
                        if (d1.getDay() === 6) surcharge += 150;
                    }
                    if (sel.promoPdcDate2) {
                        const d2 = new Date(sel.promoPdcDate2);
                        if (d2.getDay() === 6) surcharge += 150;
                    }
                });
            }
            return surcharge;
        };

        const saturdaySurchargeAmount = calculateSaturdaySurcharge();
        const displaySelectedPrice = selectedPrice + saturdaySurchargeAmount;
        const embeddedSubtotal = subtotal + saturdaySurchargeAmount;
        const discountPct = formData.course?._isManualBundle ? 3 : (selectedTypeOpt?.discount || dynamicCourse?.discount || 0);
        const discountLabel = formData.course?._isManualBundle ? 'Multi-Course Discount (3%)' : `Discount (${discountPct}%)`;
        const promoDiscount = discountPct > 0 ? Number((embeddedSubtotal * (discountPct / 100)).toFixed(2)) : 0;
        const totalAmount = Math.max(0, Number((embeddedSubtotal - promoDiscount).toFixed(2)));
        const balanceDue = Math.max(0, Number((totalAmount - (Number(formData.amountPaid) || 0)).toFixed(2)));

        const promoPdcSummaryCount = (formData.course?._pdcCourses && formData.course._pdcCourses.length > 0)
            ? formData.course._pdcCourses.length
            : (formData.course?._pdcCourse ? 1 : 0);
        let courseTypeDisplay = '';
        if (isPromo) {
            const tdcDisplay = promoTdcType === 'F2F' ? 'TDC F2F' : `TDC ${promoTdcType || 'F2F'}`;
            const pdcDisplay = `${promoPdcSummaryCount || 1} PDC course${(promoPdcSummaryCount || 1) > 1 ? 's' : ''}`;
            courseTypeDisplay = `${tdcDisplay} + ${pdcDisplay}`;
        } else if (selectedTypeOpt) {
            courseTypeDisplay = selectedTypeOpt.label;
        }

        const selectedPromoTdcSlot = isPromo
            ? promoTdcRawSlots.find((slot) => String(slot.id) === String(formData.scheduleSlotId))
            : null;
        const promoTdcDay1Date = formData.scheduleDate || selectedPromoTdcSlot?.date || '';
        const promoTdcDay2Date = (selectedPromoTdcSlot?.end_date && selectedPromoTdcSlot.end_date !== (selectedPromoTdcSlot?.date || promoTdcDay1Date))
            ? selectedPromoTdcSlot.end_date
            : '';
        const promoTdcSession = formData.scheduleSession || selectedPromoTdcSlot?.session || 'Not selected';
        const promoTdcTime = formData.scheduleTime || selectedPromoTdcSlot?.time_range || 'Not selected';

        return (
            <div className="step-content animate-fadeIn">
                <div className="section-title">
                    <span className="step-badge">5</span>
                    <h3>Review Details</h3>
                </div>

                <div className="review-container">
                    {/* ── Student Info ── */}
                    <div className="review-section">
                        <h4>Student Info</h4>
                        <p><strong>Name:</strong> {formData.firstName} {formData.middleName && formData.middleName !== 'N/A' ? formData.middleName + ' ' : ''}{formData.lastName}</p>
                        <p><strong>Contact:</strong> {formData.contactNumbers}{formData.email ? ` | ${formData.email}` : ''}</p>
                        <p><strong>Address:</strong> {formData.address}{formData.zipCode ? `, ${formData.zipCode}` : ''}</p>
                    </div>

                    {/* ── Course & Branch ── */}
                    <div className="review-section">
                        <h4>Course &amp; Branch</h4>
                        {isPromo ? (
                            <>
                                <p>
                                    <strong>Course:</strong>
                                    {formData.course?.name || 'Promo Bundle'}
                                </p>
                                <p>
                                    <strong>Type:</strong>
                                    {courseTypeDisplay || (promoTdcType === 'F2F' ? 'TDC F2F + PDC' : 'TDC Online + PDC')}
                                </p>
                            </>
                        ) : (
                            <>
                                <p><strong>Course:</strong> {formData.course?.name}</p>
                                <p><strong>Type:</strong> {formData.courseType}</p>
                            </>
                        )}
                        {formData.addons?.length > 0 && (
                            <p><strong>Add-ons:</strong> {formData.addons.map(a => a.name).join(', ')}</p>
                        )}
                        <p><strong>Branch:</strong> {formatBranchName(formData.branchName)}</p>
                    </div>

                    {/* ── Schedule ── */}
                    <div className="review-section">
                        <h4>Schedule</h4>
                        {isOnlineTdcNoSchedule ? (
                            <>
                                <p><strong>Mode:</strong> Online TDC</p>
                                <p><strong>Branch Slot:</strong> Not required</p>
                                <p style={{ color: 'var(--secondary-text)', marginTop: '6px' }}>
                                    Please expect an email regarding your online course. Kindly check your inbox (including spam/junk) and follow the instructions. If not received, please contact us.
                                </p>
                            </>
                        ) : isPromo ? (
                            <>
                                <>
                                    {/* TDC schedule */}
                                    <p style={{ fontWeight: '700', color: 'var(--primary-color)', marginBottom: '4px', fontSize: '0.85rem' }}>TDC — Day 1:</p>
                                    <p><strong>Date:</strong> {fmtDate(promoTdcDay1Date)}</p>
                                    <p><strong>Session:</strong> {promoTdcSession}</p>
                                    <p><strong>Time:</strong> {promoTdcTime}</p>

                                    {promoTdcDay2Date && (
                                        <>
                                            <div style={{ borderTop: '1px solid var(--border-color)', margin: '10px 0' }} />
                                            <p style={{ fontWeight: '700', color: 'var(--primary-color)', marginBottom: '4px', fontSize: '0.85rem' }}>TDC — Day 2:</p>
                                            <p><strong>Date:</strong> {fmtDate(promoTdcDay2Date)}</p>
                                            <p><strong>Session:</strong> {promoTdcSession}</p>
                                            <p><strong>Time:</strong> {promoTdcTime}</p>
                                        </>
                                    )}
                                </>

                                {isOnlineTdcNoSchedule ? (
                                    <>
                                        <div style={{ borderTop: '1px solid var(--border-color)', margin: '10px 0' }} />
                                        <p style={{ fontWeight: '700', color: 'var(--primary-color)', marginBottom: '4px', fontSize: '0.85rem' }}>Practical Driving Courses:</p>
                                        <p><strong>Schedule:</strong> Branch Manager will assigns your PDC schedule after OTDC is marked complete.</p>
                                    </>
                                ) : (
                                    (promoPdcCourses.length > 0 ? promoPdcCourses : (formData.course?._pdcCourse ? [formData.course._pdcCourse] : [])).map((course, idx) => {
                                        const key = course?._pdcKey || getPromoPdcCourseKey(course);
                                        const sel = promoPdcSelections[key] || {};
                                        const courseLabel = course?.shortName || course?.name || `PDC ${idx + 1}`;

                                        return (
                                            <div key={`sched-${key}-${idx}`}>
                                                <div style={{ borderTop: '1px solid var(--border-color)', margin: '10px 0' }} />
                                                <p style={{ fontWeight: '700', color: 'var(--primary-color)', marginBottom: '4px', fontSize: '0.85rem' }}>{courseLabel} — Day 1:</p>
                                                <p><strong>Date:</strong> {fmtDate(sel.scheduleDate)}</p>
                                                <p><strong>Session:</strong> {sel.scheduleSession2 || 'Not selected'}</p>
                                                <p><strong>Time:</strong> {sel.scheduleTime2 || 'Not selected'}</p>

                                                {sel.promoPdcSlotId2 && (
                                                    <>
                                                        <div style={{ borderTop: '1px solid var(--border-color)', margin: '10px 0' }} />
                                                        <p style={{ fontWeight: '700', color: 'var(--primary-color)', marginBottom: '4px', fontSize: '0.85rem' }}>{courseLabel} — Day 2:</p>
                                                        <p><strong>Date:</strong> {fmtDate(sel.promoPdcDate2)}</p>
                                                        <p><strong>Session:</strong> {sel.promoPdcSession2 || 'Not selected'}</p>
                                                        <p><strong>Time:</strong> {sel.promoPdcTime2 || 'Not selected'}</p>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </>
                        ) : formData.scheduleDate2 ? (
                            <>
                                <p style={{ fontWeight: '700', color: 'var(--primary-color)', marginBottom: '4px', fontSize: '0.85rem' }}>{sessionPrefix ? `${sessionPrefix} — ` : ''}Day 1:</p>
                                <p><strong>Date:</strong> {fmtDate(formData.scheduleDate)}</p>
                                <p><strong>Session:</strong> {formData.scheduleSession || 'Not selected'}</p>
                                <p><strong>Time:</strong> {formData.scheduleTime || 'Not selected'}</p>
                                <div style={{ borderTop: '1px solid var(--border-color)', margin: '10px 0' }} />
                                <p style={{ fontWeight: '700', color: 'var(--primary-color)', marginBottom: '4px', fontSize: '0.85rem' }}>{sessionPrefix ? `${sessionPrefix} — ` : ''}Day 2:</p>
                                <p><strong>Date:</strong> {fmtDate(formData.scheduleDate2)}</p>
                                <p><strong>Session:</strong> {formData.scheduleSession2 || formData.scheduleSession || 'Not selected'}</p>
                                <p><strong>Time:</strong> {formData.scheduleTime2 || formData.scheduleTime || 'Not selected'}</p>
                            </>
                        ) : (
                            <>
                                <p><strong>Date:</strong> {fmtDate(formData.scheduleDate)}</p>
                                <p><strong>Session:</strong> {formData.scheduleSession || 'Not selected'}</p>
                                <p><strong>Time:</strong> {formData.scheduleTime || 'Not selected'}</p>
                            </>
                        )}
                    </div>

                    {/* ── Payment Summary ── */}
                    <div className="review-section">
                        <h4>Payment Summary</h4>
                        <div className="review-payment-grid">
                            <p><strong>Method:</strong> {formData.paymentMethod}</p>
                            <p><strong>Payment Status:</strong> {formData.paymentStatus}</p>
                            <p><strong>Subtotal:</strong> ₱{embeddedSubtotal.toLocaleString()}</p>
                            {/* Saturday Surcharge is now embedded in subtotal above */}
                            {discountPct > 0 && (
                                <p style={{ color: '#ef4444' }}><strong>{discountLabel}:</strong> -₱{promoDiscount.toLocaleString()}</p>
                            )}
                            <p><strong>Total Amount Due:</strong> ₱{totalAmount.toLocaleString()}</p>
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
                                Confirm &amp; Enroll
                            </>
                        )}
                    </button>
                </div>
            </div>
        );
    };

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