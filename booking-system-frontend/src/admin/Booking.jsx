import React, { useState, useEffect } from 'react';
import './css/booking.css';
import { adminAPI, branchesAPI, authAPI, coursesAPI, schedulesAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import Pagination from './components/Pagination';

const BK_PAGE_SIZE = 10;
const BK_HISTORY_PAGE_SIZE = 10;
const logo = '/images/logo.png';

const stripBranchPrefix = (value = '') => String(value)
    .replace('Master Driving School ', '')
    .replace('Master Prime Driving School ', '')
    .replace('Masters Prime Holdings Corp. ', '')
    .replace('Master Prime Holdings Corp. ', '')
    .trim();

const parseNotesJson = (rawNotes) => {
    if (!rawNotes || typeof rawNotes !== 'string' || !rawNotes.startsWith('{')) return null;
    try {
        return JSON.parse(rawNotes);
    } catch {
        return null;
    }
};

const isPromoBooking = (bookingObj, notesJson) => {
    const list = Array.isArray(notesJson?.courseList) ? notesJson.courseList : [];
    if (list.some(c => {
        const cat = String(c.category || '').toLowerCase();
        const name = String(c.name || '').toLowerCase();
        // Specifically identify Promo category or Promo name. 
        // We exclude "Manual Bundle" or simple "Bundle" from being treated as a fixed "Promo Package" 
        // so that multiple course selections can display individual items and the 3% discount.
        return cat === 'promo' || name.includes('promo');
    })) return true;
    const cat = String(bookingObj?.course_category || bookingObj?.category || bookingObj?.typeCategory || '').toLowerCase();
    const name = String(bookingObj?.course_name || bookingObj?.name || notesJson?.combinedCourseNames || '').toLowerCase();
    if (cat === 'promo' || name.includes('promo')) return true;
    if (String(notesJson?.courseCategory || '').toLowerCase() === 'promo') return true;
    return false;
};

const normalizeCourseItems = (booking, notesJson) => {
    if (isPromoBooking(booking, notesJson)) {
        const noteList = Array.isArray(notesJson?.courseList) ? notesJson.courseList : [];
        const promoItem = noteList.find(c => String(c.category).toLowerCase() === 'promo');
        const promoName = promoItem?.name || booking?.course_name || booking?.name || notesJson?.combinedCourseNames || 'Promo Course';
        
        return [{
            name: promoName,
            type: promoItem?.type || booking?.course_type || booking?.type || '',
            category: 'promo',
            price: Number(String(booking?.course_price || booking?.price || booking?.amount || booking?.total_amount || 0).replace(/[^0-9.]/g, '')),
        }];
    }

    const list = Array.isArray(notesJson?.courseList) ? notesJson.courseList : [];
    if (list.length > 0) {
        const cleaned = list.map((item) => ({
            name: item?.name || 'Course',
            type: item?.type || '',
            category: item?.category || '',
            price: Number(item?.price ?? item?.amount ?? item?.coursePrice ?? 0),
        }));
        const unique = [];
        const seen = new Set();
        cleaned.forEach((item) => {
            const key = `${String(item.name).toLowerCase()}::${String(item.type).toLowerCase()}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(item);
            }
        });
        return unique;
    }

    return [{
        name: booking.course_name || 'Course',
        type: booking.course_type || '',
        category: booking.course_category || '',
        price: 0,
    }];
};

const applyResolvedTdcType = (courseItems = [], resolvedCourseTypeTdc = '') => {
    return (Array.isArray(courseItems) ? courseItems : []).map((item) => {
        const src = `${item?.name || ''} ${item?.type || ''} ${item?.category || ''}`.toLowerCase();
        const isTdcItem = src.includes('tdc') || src.includes('theoretical');
        if (!isTdcItem) return item;

        return {
            ...item,
            type: resolvedCourseTypeTdc || item?.type || '',
        };
    });
};

const toTitle = (value = '') => String(value)
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim();

const toCompactCourseLabel = (item = {}) => {
    const name = String(item.name || '');
    const type = String(item.type || '');
    const category = String(item.category || '');
    const source = `${name} ${type} ${category}`.toUpperCase();

    const hasTdc = source.includes('TDC') || source.includes('THEORETICAL');
    const hasPdc = source.includes('PDC') || source.includes('PRACTICAL');

    const isPromo = category.toLowerCase() === 'promo';
    const isBundle = source.includes('BUNDLE');

    if (hasTdc) {
        if (source.includes('ONLINE') || type.toUpperCase().includes('ONLINE')) return 'TDC Online';
        if (source.includes('F2F') || source.includes('FACE TO FACE')) return 'TDC F2F';
        return 'TDC F2F';
    }

    if (hasPdc) {
        const hasManual = source.includes('MANUAL') || /(^|\W)MT($|\W)/.test(source);
        const hasAutomatic = source.includes('AUTOMATIC') || source.includes(' AUTO ') || /(^|\W)AT($|\W)/.test(source);

        let vehicle = '';
        if (source.includes('A1') || source.includes('TRICYCLE') || source.includes('V1-TRICYCLE')) {
            vehicle = 'A1-Tricycle';
        } else if ((source.includes('B1') || source.includes('VAN')) && (source.includes('B2') || source.includes('L300'))) {
            vehicle = 'B1-Van/B2-L300';
        } else if (source.includes('MOTORCYCLE') || source.includes('MOTOR') || source.includes('MOTO') || source.includes('BIKE')) {
            vehicle = 'Motorcycle';
        } else if (source.includes('CAR')) {
            vehicle = 'Car';
        } else if (hasManual || hasAutomatic) {
            vehicle = 'Car';
        } else if (source.includes('B1') || source.includes('VAN')) {
            vehicle = 'B1-Van';
        } else if (source.includes('B2') || source.includes('L300')) {
            vehicle = 'B2-L300';
        }

        let transmission = '';
        if (hasManual && !hasAutomatic) transmission = 'Manual';
        else if (hasAutomatic && !hasManual) transmission = 'Automatic';

        return ['PDC', vehicle, transmission].filter(Boolean).join(' ');
    }

    // Default cleanup for bundles and titles
    let label = toTitle(name);
    if (isBundle) {
        // Ensure only one "(Bundle)" and remove any redundant ones
        label = label.replace(/\s*\(\s*Bundle\s*\)\s*/gi, '').trim() + ' (Bundle)';
    }

    return label || 'Course';
};

const toMoney = (value = 0) => `₱${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toInputDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const inferSessionFromTimeRange = (timeRange = '') => {
    const raw = String(timeRange || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!raw) return null;
    if (raw.includes('08:00 am') && raw.includes('05:00 pm')) return 'Whole Day';
    if (raw.includes('8:00 am') && raw.includes('5:00 pm')) return 'Whole Day';
    if (raw.includes('08:00 am') && raw.includes('12:00 pm')) return 'Morning';
    if (raw.includes('8:00 am') && raw.includes('12:00 pm')) return 'Morning';
    if (raw.includes('01:00 pm') && raw.includes('05:00 pm')) return 'Afternoon';
    if (raw.includes('1:00 pm') && raw.includes('5:00 pm')) return 'Afternoon';
    return null;
};

const normalizeSessionLabel = (session = '') => {
    const raw = String(session || '').trim();
    if (!raw) return null;
    const cleaned = raw.replace(/\b(pdc|tdc)\b/ig, '').replace(/\s+/g, ' ').trim();
    const lowered = cleaned.toLowerCase();
    if (lowered.includes('whole')) return 'Whole Day';
    if (lowered.includes('morning')) return 'Morning';
    if (lowered.includes('afternoon')) return 'Afternoon';
    return toTitle(cleaned);
};

const resolveTdcTypeLabel = (rawType = '', notesJson = null, booking = {}) => {
    const normalizedRaw = String(rawType || '').trim();
    if (normalizedRaw && normalizedRaw.toLowerCase() !== 'promo-bundle') return normalizedRaw;

    const notesList = Array.isArray(notesJson?.courseList) ? notesJson.courseList : [];
    const tdcFromNotes = notesList.find((item) => String(item?.category || '').toUpperCase() === 'TDC');
    const notesType = String(tdcFromNotes?.type || '').trim();
    if (notesType && notesType.toLowerCase() !== 'promo-bundle') return notesType;

    const bookingName = String(booking?.course_name || '').toUpperCase();
    if (bookingName.includes('ONLINE')) return 'ONLINE';
    if (bookingName.includes('F2F') || bookingName.includes('FACE TO FACE')) return 'F2F';

    return '';
};

const isTwoDayPdcVariant = (course = {}) => {
    const source = `${course?.courseName || ''} ${course?.courseType || ''}`.toUpperCase();
    if (source.includes('MOTOR') || source.includes('MOTORCYCLE')) return false;
    if (source.includes('AUTOMATIC') || source.includes('MANUAL')) return true;
    if (source.includes('CAR') || source.includes('B1') || source.includes('B2') || source.includes('VAN') || source.includes('L300')) return true;
    if (source.includes('TRICYCLE') || source.includes('V1') || source.includes('A1')) return true;
    return false;
};

const buildPdcCourseOptions = (booking) => {
    if (!booking) return [];

    const notes = parseNotesJson(booking.rawNotes || '') || {};
    const fromSelections = Object.entries(notes.pdcSelections || {}).map(([key, value], idx) => ({
        key: String(key || `pdc_${idx + 1}`),
        courseId: value?.courseId || null,
        courseName: value?.courseName || `PDC Course ${idx + 1}`,
        courseType: value?.courseType || '',
        requiresDay2: Boolean(value?.pdcDate2 || value?.date2 || value?.pdcSlot2 || value?.slot2 || value?.pdcSlotDetails2 || value?.slotDetails2) || isTwoDayPdcVariant({
            courseName: value?.courseName,
            courseType: value?.courseType,
        }),
    }));

    const fromCourseItems = (Array.isArray(booking.courseItems) ? booking.courseItems : [])
        .filter((item) => {
            const source = `${item?.name || ''} ${item?.type || ''} ${item?.category || ''}`.toUpperCase();
            return source.includes('PDC') || source.includes('PRACTICAL');
        })
        .map((item, idx) => ({
            key: String(item?.courseId || item?.name || `pdc_${idx + 1}`).toLowerCase().replace(/\s+/g, '_'),
            courseId: item?.courseId || null,
            courseName: item?.name || `PDC Course ${idx + 1}`,
            courseType: item?.type || '',
            requiresDay2: isTwoDayPdcVariant({
                courseName: item?.name,
                courseType: item?.type,
            }),
        }));

    const merged = [...fromSelections, ...fromCourseItems];
    const unique = [];
    const seen = new Set();
    merged.forEach((item) => {
        const key = `${String(item.key)}::${String(item.courseName).toLowerCase()}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(item);
        }
    });

    return unique.length > 0
        ? unique
        : [{ key: 'pdc_1', courseId: null, courseName: 'PDC Course', courseType: '', requiresDay2: false }];
};

const normalizeBookingStatusKey = (rawStatus = '') => {
    const value = String(rawStatus || '').toLowerCase().trim();
    if (value === 'paid' || value === 'confirmed' || value === 'completed') return 'paid';
    if (value === 'pending') return 'pending';
    if (value === 'cancelled') return 'cancelled';
    if (value === 'partial_payment' || value === 'partial payment') return 'partial-payment';
    return 'partial-payment';
};

const getBookingStatusLabel = (statusKey = '') => {
    if (statusKey === 'paid') return 'Paid';
    if (statusKey === 'pending') return 'Pending';
    if (statusKey === 'cancelled') return 'Cancelled';
    return 'Partial Payment';
};

const resolveAssessmentFigures = (booking = {}) => {
    const paid = Math.max(0, Number(booking?.amountPaid ?? booking?.total_amount ?? 0));
    const coursePrice = Math.max(0, Number(booking?.coursePrice ?? booking?.course_price ?? 0));
    const convenienceFee = Math.max(0, Number(booking?.convenienceFee ?? 0));
    const promoDiscount = Math.max(0, Number(booking?.promoDiscount ?? 0));
    const paymentType = String(booking?.paymentType ?? booking?.payment_type ?? '').toLowerCase();
    const notesJson = parseNotesJson(booking?.rawNotes || booking?.notes || '');

    const notesCourseList = Array.isArray(notesJson?.courseList) ? notesJson.courseList : [];
    const notesCourseTotal = notesCourseList.reduce((sum, item) => {
        return sum + Math.max(0, Number(item?.price ?? item?.amount ?? item?.coursePrice ?? 0));
    }, 0);

    const notesAddonList = Array.isArray(notesJson?.addonsDetailed) ? notesJson.addonsDetailed : [];
    const notesAddonTotal = notesAddonList.reduce((sum, item) => sum + Math.max(0, Number(item?.price || 0)), 0);

    const notesConvenience = Math.max(0, Number(notesJson?.convenienceFee || 0));
    const hasBundleInNotes = notesCourseList.some((item) => String(item?.category || '').toUpperCase() === 'TDC')
        && notesCourseList.some((item) => String(item?.category || '').toUpperCase() === 'PDC');
    const fallbackPromoBase = notesCourseTotal + notesAddonTotal + notesConvenience;
    const isNativePromo = isPromoBooking(booking, notesJson);
    const fallbackPromoDiscount = 0; // Removed legacy 3% fallback
    const notesPromoDiscount = isNativePromo ? 0 : Math.max(
        0,
        Number(notesJson?.promoDiscount || 0),
        Number(booking?.promoDiscount || 0),
        Number(notesJson?.promoDiscount || 0) > 0 ? 0 : fallbackPromoDiscount
    );
    const notesComputedTotal = Math.max(0, Number((notesCourseTotal + notesAddonTotal + notesConvenience - notesPromoDiscount).toFixed(2)));

    const explicitNoteTotals = [
        notesJson?.totalAmount,
        notesJson?.grandTotal,
        notesJson?.finalTotal,
        notesJson?.assessedTotal,
        notesJson?.payableAmount,
        notesJson?.amountToPay,
    ]
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v) && v > 0);

    const baseFromBookingFields = Math.max(0, Number((coursePrice + convenienceFee - promoDiscount).toFixed(2)));

    let assessed = 0;

    // Highest priority: explicit totals saved in booking notes.
    if (explicitNoteTotals.length > 0) {
        assessed = explicitNoteTotals[0];
    }
    // Next: notes-derived breakdown total (includes promo discount and convenience fee).
    else if (notesComputedTotal > 0) {
        assessed = notesComputedTotal;
    }
    // Next: booking-level pricing fields.
    else if (baseFromBookingFields > 0) {
        assessed = baseFromBookingFields;
    }
    // Next: raw course price only.
    else if (coursePrice > 0) {
        assessed = coursePrice;
    }
    // Last-resort fallback for legacy downpayment rows with no reliable totals.
    else if (paymentType.includes('down') && paid > 0) {
        assessed = paid * 2;
    }
    // Trust stored balanceDue if it exists and we haven't found a better assessment
    else if (booking.balanceDue !== undefined && booking.balanceDue !== null && Number(booking.balanceDue) >= 0) {
        assessed = paid + Number(booking.balanceDue);
    }
    // Absolute fallback.
    else {
        assessed = paid;
    }

    assessed = Math.max(assessed, paid);

    assessed = Number(assessed.toFixed(2));
    const remaining = Math.max(0, Number((assessed - paid).toFixed(2)));
    return { assessed, paid: Number(paid.toFixed(2)), remaining };
};

const computeEstimatedBalanceDue = (booking = {}) => {
    return resolveAssessmentFigures(booking).remaining;
};

const buildCoursePaymentLines = (booking) => {
    const notesJson = parseNotesJson(booking?.rawNotes || '');
    
    // If this represents a predefined promo course, do not fragment the price among sub-items
    if (isPromoBooking(booking, notesJson)) {
        const noteList = Array.isArray(notesJson?.courseList) ? notesJson.courseList : [];
        const promoItem = noteList.find(c => String(c.category).toLowerCase() === 'promo');
        const promoName = promoItem?.name || booking?.fullCourseName || booking?.course_name || notesJson?.combinedCourseNames || 'Promo Course';

        return [{
            label: promoName,
            amount: Number(String(booking?.coursePrice || booking?.amount || 0).replace(/[^0-9.]/g, ''))
        }];
    }
    let sourceCourseItems = Array.isArray(booking?.courseItems) && booking.courseItems.length > 0
        ? booking.courseItems
        : normalizeCourseItems({
            course_name: booking?.fullCourseName || booking?.typeCategory || 'Course',
            course_type: booking?.courseTypeTdc || '',
            course_category: booking?.typeCategory || '',
        }, notesJson);

    // If it's a bundle/promo through other means, hide PDC components
    const hasBundleKeywords = sourceCourseItems.some(item => {
        const n = String(item?.name || '').toLowerCase();
        const c = String(item?.category || '').toLowerCase();
        return n.includes('bundle') || n.includes('promo') || c.includes('bundle') || c.includes('promo');
    });

    if (hasBundleKeywords) {
        sourceCourseItems = sourceCourseItems.filter(item => {
            const n = String(item?.name || '').toLowerCase();
            const c = String(item?.category || '').toLowerCase();
            const isRoot = n.includes('bundle') || n.includes('promo') || c.includes('bundle') || c.includes('promo');
            const isPdcComp = !isRoot && (n.includes('pdc') || c.includes('pdc'));
            return !isPdcComp;
        });
    }

    const noteList = Array.isArray(notesJson?.courseList) ? notesJson.courseList : [];
    const noteLines = noteList
        .map((item) => ({
            label: toCompactCourseLabel(item),
            amount: Number(item?.price ?? item?.amount ?? item?.coursePrice ?? 0),
        }))
        .filter((line) => line.amount > 0);

    if (noteLines.length > 0) return noteLines;

    const explicitCourseLines = sourceCourseItems
        .map((item) => ({
            label: toCompactCourseLabel(item),
            amount: Number(item?.price ?? item?.coursePrice ?? 0),
        }))
        .filter((line) => line.amount > 0);
    if (explicitCourseLines.length > 0) return explicitCourseLines;

    const baseTotal = Math.max(0, Number(booking?.coursePrice || 0));
    if (!sourceCourseItems.length) return [];
    if (sourceCourseItems.length === 1) {
        return [{ label: toCompactCourseLabel(sourceCourseItems[0]), amount: baseTotal }];
    }

    const labelsUpper = sourceCourseItems.map((item) => toCompactCourseLabel(item).toUpperCase());
    const tdcIdx = labelsUpper.findIndex((label) => label.startsWith('TDC'));
    const pdcIdx = labelsUpper.findIndex((label) => label.startsWith('PDC'));
    if (sourceCourseItems.length === 2 && tdcIdx !== -1 && pdcIdx !== -1 && baseTotal > 0) {
        const tdcAmount = Math.min(700, baseTotal);
        const pdcAmount = Math.max(0, baseTotal - tdcAmount);
        return sourceCourseItems.map((item, idx) => ({
            label: toCompactCourseLabel(item),
            amount: idx === tdcIdx ? tdcAmount : (idx === pdcIdx ? pdcAmount : 0),
        }));
    }

    const equal = Math.floor((baseTotal / sourceCourseItems.length) * 100) / 100;
    let running = 0;
    return sourceCourseItems.map((item, idx) => {
        const isLast = idx === sourceCourseItems.length - 1;
        const amount = isLast ? Math.max(0, Number((baseTotal - running).toFixed(2))) : equal;
        running += equal;
        return { label: toCompactCourseLabel(item), amount };
    });
};

const buildPaymentBreakdown = (booking) => {
    const courseLines = buildCoursePaymentLines(booking);
    const addonLines = (Array.isArray(booking?.addonsDetailed) ? booking.addonsDetailed : [])
        .map((addon) => ({
            name: addon?.name || 'Add-on',
            price: Math.max(0, Number(addon?.price || 0)),
        }))
        .filter((addon) => addon.price > 0);

    const courseSubtotal = courseLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
    const addonsSubtotal = addonLines.reduce((sum, line) => sum + Number(line.price || 0), 0);
    const subtotal = courseSubtotal + addonsSubtotal;
    const convenienceFee = Math.max(0, Number(booking?.convenienceFee || 0));
    const promoDiscount = Math.max(0, Number(booking?.promoDiscount || 0));
    const grandTotal = Math.max(0, subtotal + convenienceFee - promoDiscount);

    const promoPct = Number(booking?.promoPct || 0);

    return {
        courseLines,
        addonLines,
        subtotal,
        convenienceFee,
        promoDiscount,
        promoPct,
        grandTotal,
    };
};

const Booking = () => {
    const BOOKINGS_CACHE_TTL_MS = 2 * 60 * 1000;
    const { showNotification } = useNotification();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [bkPage, setBkPage] = useState(1);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historySearchTerm, setHistorySearchTerm] = useState('');
    const [historyStatusFilter, setHistoryStatusFilter] = useState('All');
    const [historyDateFilter, setHistoryDateFilter] = useState('All Time');
    const [historyCustomDays, setHistoryCustomDays] = useState('15');
    const [historyDateFrom, setHistoryDateFrom] = useState('');
    const [historyDateTo, setHistoryDateTo] = useState('');
    const [historyPage, setHistoryPage] = useState(1);
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState('');
    const [userRole, setUserRole] = useState(null);
    const [userBranchId, setUserBranchId] = useState(null);
    const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
    const [markPaidBooking, setMarkPaidBooking] = useState(null);
    const [markPaidMethod, setMarkPaidMethod] = useState('Cash');
    const [markPaidTxnId, setMarkPaidTxnId] = useState('');
    const [markPaidAmount, setMarkPaidAmount] = useState('');
    const [markPaidLoading, setMarkPaidLoading] = useState(false);
    const [showAssignPdcModal, setShowAssignPdcModal] = useState(false);
    const [assignPdcLoading, setAssignPdcLoading] = useState(false);
    const [assignPdcCourses, setAssignPdcCourses] = useState([]);
    const [assignPdcCourseKey, setAssignPdcCourseKey] = useState('');
    const [assignPdcDate1, setAssignPdcDate1] = useState('');
    const [assignPdcDate2, setAssignPdcDate2] = useState('');
    const [assignPdcSlot1, setAssignPdcSlot1] = useState('');
    const [assignPdcSlot2, setAssignPdcSlot2] = useState('');
    const [assignPdcSlotsDay1, setAssignPdcSlotsDay1] = useState([]);
    const [assignPdcSlotsDay2, setAssignPdcSlotsDay2] = useState([]);

    const modalCourseItems = Array.isArray(selectedBooking?.courseItems) && selectedBooking.courseItems.length > 0
        ? selectedBooking.courseItems
        : [{
            name: selectedBooking?.fullCourseName || selectedBooking?.typeCategory || 'Course',
            type: selectedBooking?.courseTypeTdc || '',
            category: selectedBooking?.typeCategory || '',
        }];
    const tdcCourseItem = modalCourseItems.find((item) => {
        const src = `${item?.name || ''} ${item?.type || ''} ${item?.category || ''}`.toUpperCase();
        return src.includes('TDC') || src.includes('THEORETICAL');
    }) || {
        name: selectedBooking?.fullCourseName || 'Theoretical Driving Course (TDC)',
        type: selectedBooking?.courseTypeTdc || '',
        category: 'TDC',
    };
    const pdcCourseItem = modalCourseItems.find((item) => {
        const src = `${item?.name || ''} ${item?.type || ''} ${item?.category || ''}`.toUpperCase();
        return src.includes('PDC') || src.includes('PRACTICAL');
    }) || {
        name: selectedBooking?.fullCourseName || 'Practical Driving Course (PDC)',
        type: selectedBooking?.courseTypePdc || selectedBooking?.courseTypeTdc || '',
        category: 'PDC',
    };
    const paymentBreakdown = selectedBooking ? buildPaymentBreakdown(selectedBooking) : null;
    const selectedAssessment = selectedBooking
        ? resolveAssessmentFigures(selectedBooking)
        : { assessed: 0, paid: 0, remaining: 0 };
    const selectedAssignPdcCourse = assignPdcCourses.find((item) => String(item.key) === String(assignPdcCourseKey)) || assignPdcCourses[0] || null;
    const selectedAssignCourseNeedsDay2 = Boolean(selectedAssignPdcCourse?.requiresDay2);

    // Fetch branches and user role on mount
    useEffect(() => {
        const init = async () => {
            try {
                const profileRes = await authAPI.getProfile();
                let role = 'student';
                let profileBranchId = null;
                if (profileRes.success) {
                    role = profileRes.user.role;
                    profileBranchId = profileRes.user.branchId;
                    setUserRole(role);
                    setUserBranchId(profileBranchId || null);
                }
                const res = await branchesAPI.getAll();
                let loaded = res.branches || [];
                if (role === 'admin' && profileBranchId) {
                    loaded = loaded.filter(b => String(b.id) === String(profileBranchId));
                    setSelectedBranch(String(profileBranchId));
                }
                setBranches(loaded);
            } catch (_) {}
        };
        init();
    }, []);

    // Fetch bookings from database
    useEffect(() => {
        loadBookings();
    }, [selectedBranch]);

    const loadBookings = async () => {
        const cacheKey = `admin_bookings_cache_v2_${selectedBranch || 'all'}`;
        let usedCache = false;

        /* Cache disabled for live testing consistency */
        /*
        try {
            const cachedRaw = sessionStorage.getItem(cacheKey);
            if (cachedRaw) {
                const cached = JSON.parse(cachedRaw);
                if (cached?.ts && Array.isArray(cached?.data) && (Date.now() - cached.ts) < BOOKINGS_CACHE_TTL_MS) {
                    setBookings(cached.data);
                    setError(null);
                    setLoading(false);
                    usedCache = true;
                }
            }
        } catch (_) {}
        */

        try {
            if (!usedCache) setLoading(true);
            setError(null);
            const ts = Date.now();
            const response = await adminAPI.getAllBookings(null, 100, selectedBranch || null, { params: { _t: ts } });
            if (response.success) {
                // Transform database fields to match UI expectations
                const transformedBookings = response.bookings.map(booking => {
                    const statusKeyBase = normalizeBookingStatusKey(booking.status || 'partial_payment');
                    const statusKey = statusKeyBase;
                    const status = getBookingStatusLabel(statusKey);

                    // Shorten branch name (remove "Master Driving School" only, keep "Branch")
                    let branchName = booking.branch_name || 'N/A';
                    if (branchName !== 'N/A') {
                        branchName = stripBranchPrefix(branchName).toUpperCase();
                    }

                    // Build schedule date display (supports multi-day courses)
                    const formatD = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    let scheduleDateDisplay = booking.booking_date ? formatD(booking.booking_date) : 'N/A';
                    let scheduleDay2 = null;
                    let scheduleTime = booking.booking_time || '';

                    let scheduleDateLabel = 'D1';
                    let scheduleDay2Label = 'D2';

                    if (booking.schedule_details && Array.isArray(booking.schedule_details)) {
                        try {
                            const details = booking.schedule_details;
                            if (details.length > 0) {
                                if (details[0].time_range) scheduleTime = details[0].time_range;

                                // Separate by type
                                const tdcSlots = details.filter(d => (d.type || '').toLowerCase() === 'tdc');
                                const pdcSlots = details.filter(d => (d.type || '').toLowerCase() === 'pdc');

                                if (tdcSlots.length > 0 && pdcSlots.length > 0) {
                                    // BUNDLE CASE: Show start of both
                                    scheduleDateDisplay = formatD(tdcSlots[0].date);
                                    scheduleDateLabel = 'TDC';
                                    scheduleDay2 = formatD(pdcSlots[0].date);
                                    scheduleDay2Label = 'PDC';
                                } else if (pdcSlots.length > 1) {
                                    // PDC 2-day
                                    const sorted = [...pdcSlots].sort((a,b) => new Date(a.date) - new Date(b.date));
                                    scheduleDateDisplay = formatD(sorted[0].date);
                                    scheduleDay2 = formatD(sorted[sorted.length-1].date);
                                } else if (tdcSlots.length > 0) {
                                    // TDC
                                    scheduleDateDisplay = formatD(tdcSlots[0].date);
                                    if (tdcSlots[0].end_date) {
                                        scheduleDay2 = formatD(tdcSlots[0].end_date);
                                    }
                                } else {
                                    // Single slot fallback
                                    scheduleDateDisplay = formatD(details[0].date);
                                    if (details[0].end_date) scheduleDay2 = formatD(details[0].end_date);
                                }
                            }
                        } catch (e) {
                            console.error('Error parsing schedule dates:', e);
                        }
                    } else {
                        // No enrollment yet — fall back to notes-based slot data
                        const ns = booking.notes_slot;
                        const ns2 = booking.notes_slot2;
                        if (ns) {
                            scheduleDateDisplay = formatD(ns.date);
                            if (ns.time_range) scheduleTime = ns.time_range;
                            if (ns2) {
                                scheduleDay2 = formatD(ns2.date);
                            } else if (ns.end_date) {
                                scheduleDay2 = formatD(ns.end_date);
                            }
                        }
                    }

                    const courseNameFromNotes = (booking.notes?.startsWith('Walk-In Enrollment:') 
                        ? booking.notes.replace('Walk-In Enrollment:', '').trim() 
                        : booking.course_name) || 'N/A';
                    const notesJson = parseNotesJson(booking.notes);
                    const pdcScheduleLockedUntilCompletion = !!notesJson?.pdcScheduleLockedUntilCompletion;
                    const pdcScheduleLockReason = notesJson?.pdcScheduleLockReason || '';
                    const canAssignPdcSchedule = pdcScheduleLockedUntilCompletion && statusKey === 'paid';
                    const courseItems = normalizeCourseItems(booking, notesJson);
                    const resolvedCourseTypeTdc = resolveTdcTypeLabel(notesJson?.courseTypeTdc || booking.course_type || '', notesJson, booking);
                    const normalizedCourseItems = applyResolvedTdcType(courseItems, resolvedCourseTypeTdc);
                    const courseCount = courseItems.length;
                    const courseNames = normalizedCourseItems.map((c) => c.name).filter(Boolean);
                    const compactCourseLabels = normalizedCourseItems.map((c) => toCompactCourseLabel(c)).filter(Boolean);
                    const courseSummary = courseCount > 1
                        ? `${compactCourseLabels.slice(0, 2).join(', ')}${courseCount > 2 ? ` +${courseCount - 2} more` : ''}`
                        : (compactCourseLabels[0] || normalizedCourseItems[0]?.name || courseNameFromNotes);
                    const courseSummaryFull = courseNames.join(', ');

                    let category = 'Course';
                    const hasTdcSlot = booking.schedule_details?.some(s => (s.type || '').toLowerCase() === 'tdc');
                    const hasPdcSlot = booking.schedule_details?.some(s => (s.type || '').toLowerCase() === 'pdc');

                    if ((courseNameFromNotes.includes('TDC') && courseNameFromNotes.includes('PDC')) || (hasTdcSlot && hasPdcSlot)) {
                        category = 'TDC + PDC';
                    } else if (courseNameFromNotes.includes('TDC') || hasTdcSlot) {
                        category = 'TDC';
                    } else if (courseNameFromNotes.includes('PDC') || hasPdcSlot) {
                        category = 'PDC';
                    }

                    let specificCategory = category;
                    if (category.includes('PDC') && courseNameFromNotes) {
                        const nameUpper = courseNameFromNotes.toUpperCase();
                        if (nameUpper.includes('MOTORCYCLE')) specificCategory = category.replace('PDC', 'PDC Motorcycle');
                        else if (nameUpper.includes('CAR')) specificCategory = category.replace('PDC', 'PDC Car');
                        else if (nameUpper.includes('B1') || nameUpper.includes('B2')) specificCategory = category.replace('PDC', 'PDC B1/B2');
                    }

                    let courseTypeLabel = booking.course_type ? ` - ${booking.course_type.toLowerCase() === 'f2f' ? 'F2F' : booking.course_type.charAt(0).toUpperCase() + booking.course_type.slice(1)}` : '';
                    let displayType = specificCategory + courseTypeLabel;

                    return {
                        id: `BK-${String(booking.id).padStart(3, '0')}`,
                        student: booking.student_name || 'N/A',
                        typeCategory: category,
                        type: displayType,
                        fullCourseName: courseNameFromNotes,
                        courseItems: normalizedCourseItems,
                        courseCount,
                        courseSummary,
                        courseSummaryFull,
                        branch: branchName,
                        date: scheduleDateDisplay,
                        dateLabel: scheduleDateLabel,
                        date2: scheduleDay2,
                        date2Label: scheduleDay2Label,
                        time: scheduleTime,
                        status: status,
                        amount: `₱ ${Number(booking.total_amount || 0).toLocaleString()}`,
                        paymentType: booking.payment_type || 'Full Payment',
                        paymentMethod: booking.payment_method || 'Online Payment',
                        statusKey,
                        rawId: booking.id,
                        branchId: booking.branch_id || null,
                        // Detailed multi-day fields
                        tdcDay1: null, tdcDay2: null,
                        pdcDay1: null, pdcDay2: null,
                        pdcSchedulesDetailed: [],
                        pdcScheduleLockedUntilCompletion,
                        pdcScheduleLockReason,
                        canAssignPdcSchedule,
                        ...((() => {
                            const details = booking.schedule_details || [];
                            const tdcArr = details.filter(d => (d.type || '').toLowerCase() === 'tdc');
                            const pdcArr = details.filter(d => (d.type || '').toLowerCase() === 'pdc');
                            
                            const formatLong = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
                            
                            const res = {
                                tdcDay1: formatLong(tdcArr[0]?.date),
                                tdcDay2: tdcArr[0]?.end_date && tdcArr[0].end_date !== tdcArr[0].date 
                                    ? formatLong(tdcArr[0].end_date) 
                                    : formatLong(tdcArr[1]?.date), // Fallback to 2nd slot if any
                                tdcSession1: tdcArr[0]?.session || null,
                                tdcSession2: tdcArr[1]?.session || tdcArr[0]?.session || null,
                                tdcTime1: tdcArr[0]?.time_range || null,
                                tdcTime2: tdcArr[1]?.time_range || tdcArr[0]?.time_range || null,
                                pdcDay1: formatLong(pdcArr[0]?.date),
                                pdcDay2: pdcArr[0]?.end_date && pdcArr[0].end_date !== pdcArr[0].date 
                                    ? formatLong(pdcArr[0].end_date) 
                                    : formatLong(pdcArr[1]?.date), // Fallback to 2nd slot if any
                                pdcSession1: pdcArr[0]?.session || null,
                                pdcSession2: pdcArr[1]?.session || pdcArr[0]?.session || null,
                                pdcTime1: pdcArr[0]?.time_range || null,
                                pdcTime2: pdcArr[1]?.time_range || pdcArr[0]?.time_range || null,
                            };
                            return res;
                        })()),
                        // Extra fields for details panel
                        coursePrice: Number(booking.course_price || 0),
                        amountPaid: Number(booking.total_amount || 0),
                        addonsDetailed: Array.isArray(notesJson?.addonsDetailed) ? notesJson.addonsDetailed : [],
                        convenienceFee: Math.max(0, Number(notesJson?.convenienceFee || 0)),
                        promoDiscount: Math.max(0, Number(notesJson?.promoDiscount || 0)),
                        promoPct: Number(notesJson?.promoPct || 0),
                        balanceDue: computeEstimatedBalanceDue(booking),
                        paymentDate: booking.created_at,
                        firstPaymentDate: booking.created_at,
                        fullPaymentDate: statusKey === 'paid' ? (booking.updated_at || booking.created_at) : null,
                        transactionId: booking.transaction_id || null,
                        rawNotes: booking.notes || '',
                        address: booking.student_address || 'N/A',
                        contact: booking.student_contact || 'N/A',
                        email: booking.student_email || 'N/A',
                        courseTypeTdc: resolvedCourseTypeTdc,
                        courseTypePdc: '', // to be parsed
                        searchIndex: [
                            `BK-${String(booking.id).padStart(3, '0')}`,
                            booking.student_name,
                            booking.student_email,
                            booking.student_contact,
                            courseSummary,
                            (normalizedCourseItems || []).map((c) => c.name).join(' '),
                            branchName,
                            booking.payment_method,
                            booking.payment_type,
                            status,
                        ].filter(Boolean).join(' ').toLowerCase(),
                    };
                });
                // After transformation, refine notes-based fields
                const refined = transformedBookings.map(b => {
                    if (b.rawNotes?.startsWith('{')) {
                        try {
                            const n = JSON.parse(b.rawNotes);
                            const merged = {
                                ...b,
                                fullCourseName: n.combinedCourseNames || b.fullCourseName,
                                addonNames: n.addonNames || '',
                                addonsDetailed: Array.isArray(n.addonsDetailed) ? n.addonsDetailed : b.addonsDetailed,
                                convenienceFee: Number.isFinite(Number(n.convenienceFee)) ? Math.max(0, Number(n.convenienceFee)) : b.convenienceFee,
                                promoDiscount: Number.isFinite(Number(n.promoDiscount)) ? Math.max(0, Number(n.promoDiscount)) : b.promoDiscount,
                                promoPct: Number.isFinite(Number(n.promoPct)) ? Number(n.promoPct) : b.promoPct,
                                courseTypePdc: n.courseTypePdc || '',
                                courseTypeTdc: n.courseTypeTdc || b.courseTypeTdc,
                            };

                            const recalculated = resolveAssessmentFigures(merged);
                            if (recalculated.remaining > 0.009) {
                                return {
                                    ...merged,
                                    statusKey: 'partial-payment',
                                    status: 'Partial Payment',
                                    paymentType: 'Downpayment',
                                    balanceDue: recalculated.remaining,
                                };
                            }
                            return {
                                ...merged,
                                balanceDue: recalculated.remaining,
                            };
                        } catch(e) { return b; }
                    }
                    const fallbackRecalc = resolveAssessmentFigures(b);
                    if (fallbackRecalc.remaining > 0.009) {
                        return {
                            ...b,
                            statusKey: 'partial-payment',
                            status: 'Partial Payment',
                            paymentType: 'Downpayment',
                            balanceDue: fallbackRecalc.remaining,
                        };
                    }
                    return b;
                });
                setBookings(refined);
                try {
                    sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: refined }));
                } catch (_) {}
            }
        } catch (err) {
            console.error('Error loading bookings:', err);
            if (!usedCache) {
                setError('Failed to load bookings. Please try again.');
                showNotification('Failed to load bookings. Please try again.', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => setSearchTerm(e.target.value);

    const filteredBookings = bookings.filter(booking => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = !term || (booking.searchIndex || '').includes(term);
        const matchesStatus = statusFilter === 'All' || booking.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const filteredHistoryBookings = bookings.filter((booking) => {
        const term = historySearchTerm.toLowerCase();
        const matchesSearch = !term || (booking.searchIndex || '').includes(term);
        const matchesStatus = historyStatusFilter === 'All' || booking.status === historyStatusFilter;

        let matchesPeriod = true;
        if (historyDateFilter !== 'All Time') {
            const rawDate = booking?.paymentDate || booking?.date || null;
            const bookingDate = rawDate ? new Date(rawDate) : null;

            if (!bookingDate || Number.isNaN(bookingDate.getTime())) {
                matchesPeriod = false;
            } else {
                const now = new Date();
                now.setHours(23, 59, 59, 999);

                if (historyDateFilter === 'Today') {
                    const start = new Date();
                    start.setHours(0, 0, 0, 0);
                    matchesPeriod = bookingDate >= start && bookingDate <= now;
                } else if (historyDateFilter === 'This Week') {
                    const start = new Date();
                    start.setDate(now.getDate() - now.getDay());
                    start.setHours(0, 0, 0, 0);
                    matchesPeriod = bookingDate >= start && bookingDate <= now;
                } else if (historyDateFilter === 'This Month') {
                    const start = new Date(now.getFullYear(), now.getMonth(), 1);
                    matchesPeriod = bookingDate >= start && bookingDate <= now;
                } else if (historyDateFilter === 'This Year') {
                    const start = new Date(now.getFullYear(), 0, 1);
                    matchesPeriod = bookingDate >= start && bookingDate <= now;
                } else if (historyDateFilter === 'Past X Days') {
                    const days = parseInt(historyCustomDays, 10) || 15;
                    const start = new Date();
                    start.setDate(now.getDate() - days + 1);
                    start.setHours(0, 0, 0, 0);
                    matchesPeriod = bookingDate >= start && bookingDate <= now;
                } else if (historyDateFilter === 'Custom Range') {
                    const from = historyDateFrom ? new Date(historyDateFrom + 'T00:00:00') : null;
                    const to = historyDateTo ? new Date(historyDateTo + 'T23:59:59') : null;
                    if (from) matchesPeriod = bookingDate >= from;
                    if (to) matchesPeriod = matchesPeriod && bookingDate <= to;
                }
            }
        }

        return matchesSearch && matchesStatus && matchesPeriod;
    });

    const handlePrintBookingDetails = () => {
        window.print();
    };

    const handlePrintList = (sourceBookings = filteredBookings, title = 'BOOKING LIST') => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            showNotification('Print popup was blocked. Please allow popups and try again.', 'error');
            return;
        }

        const timestamp = new Date().toLocaleString();
        const totalAmount = sourceBookings.reduce((sum, b) => {
            const raw = String(b?.amount || '').replace(/[^0-9.]/g, '');
            return sum + (parseFloat(raw) || 0);
        }, 0);
        const formatPrintDate = (value) => {
            if (!value) return '-';
            const dateObj = new Date(value);
            if (Number.isNaN(dateObj.getTime())) return '-';
            return dateObj.toLocaleString('en-US', {
                month: 'numeric',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            });
        };
        const formatCourseWithType = (booking) => {
            const list = Array.isArray(booking?.courseItems) ? booking.courseItems : [];
            const labels = [...new Set(list.map((item) => {
                const name = String(item?.name || '').trim();
                const type = String(item?.type || '').trim();
                const upperName = name.toUpperCase();
                const hasEmbeddedPdcType = upperName.includes('PRACTICAL DRIVING COURSE')
                    && (upperName.includes('B1 - VAN/B2 - L300') || upperName.includes('A1 - TRICYCLE'));
                if (!name && !type) return '';
                if (hasEmbeddedPdcType) return name || 'Course';
                if (!type) return name || 'Course';
                const typeLabel = type.toLowerCase() === 'f2f' ? 'F2F' : `${type.charAt(0).toUpperCase()}${type.slice(1)}`;
                return `${name || 'Course'} (${typeLabel})`;
            }).filter(Boolean))];

            if (labels.length > 0) return labels.join(', ');

            const fallbackName = booking?.fullCourseName || booking?.type || booking?.typeCategory || 'N/A';
            const fallbackType = String(booking?.courseTypeTdc || booking?.courseTypePdc || '').trim();
            const fallbackUpper = String(fallbackName || '').toUpperCase();
            const fallbackHasEmbeddedPdcType = fallbackUpper.includes('PRACTICAL DRIVING COURSE')
                && (fallbackUpper.includes('B1 - VAN/B2 - L300') || fallbackUpper.includes('A1 - TRICYCLE'));
            if (fallbackHasEmbeddedPdcType) return fallbackName;
            if (!fallbackType) return fallbackName;
            const fallbackTypeLabel = fallbackType.toLowerCase() === 'f2f'
                ? 'F2F'
                : `${fallbackType.charAt(0).toUpperCase()}${fallbackType.slice(1)}`;
            return `${fallbackName} (${fallbackTypeLabel})`;
        };

        const html = `
            <html>
            <head>
                <title>Master Driving School - ${title}</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 16px; color: #334155; }
                    .header { border-bottom: 2px solid #1a4fba; padding-bottom: 12px; margin-bottom: 12px; display: flex; align-items: center; gap: 12px; }
                    .header img { width: 52px; height: 52px; border-radius: 8px; }
                    .header h1 { color: #1a4fba; margin: 0; font-size: 14pt; line-height: 1.2; }
                    .header p { color: #64748b; margin: 2px 0; font-size: 8pt; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: fixed; }
                    th, td { border: 1px solid #e2e8f0; padding: 6px 5px; text-align: center; font-size: 8pt; white-space: normal; word-break: break-word; }
                    th { background: #f8fafc; color: #1a4fba; font-weight: 700; }
                    .amount { font-weight: 700; }
                    .status-pill { display: inline-block; padding: 2px 7px; border-radius: 999px; font-weight: 700; font-size: 7.5pt; white-space: nowrap; }
                    .paid { color: #166534; background: #dcfce7; border: 1px solid #86efac; }
                    .partial-payment { color: #9a3412; background: #ffedd5; border: 1px solid #fdba74; }
                    .cancelled, .pending { color: #991b1b; background: #fee2e2; border: 1px solid #fca5a5; }
                    .total-row td { background: #f0f6ff; font-weight: bold; color: #1a4fba; border-top: 2px solid #1a4fba; }
                    .footer { margin-top: 20px; font-size: 10pt; color: #94a3b8; text-align: center; }
                    @media print {
                        @page { size: A4 landscape; margin: 8mm; }
                        body { padding: 0; }
                        .header { margin-bottom: 8px; padding-bottom: 8px; }
                        .header img { width: 42px; height: 42px; }
                        .header h1 { font-size: 12pt; }
                        th, td { padding: 4px 3px; font-size: 7.1pt; }
                        .status-pill { font-size: 6.8pt; padding: 2px 5px; }
                        .footer { margin-top: 10px; font-size: 7pt; }
                        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <img src="${logo}" alt="Logo">
                    <div>
                        <h1>MASTER DRIVING SCHOOL</h1>
                        <p>${title}</p>
                        <p>Generated on: ${timestamp}</p>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>BOOKING ID</th>
                            <th>STUDENT NAME</th>
                            <th>EMAIL</th>
                            <th>STUDENT NUMBER</th>
                            <th>COURSE</th>
                            <th>BRANCH</th>
                            <th>SCHEDULE</th>
                            <th>FIRST PAYMENT DATE</th>
                            <th>FULLY PAID DATE</th>
                            <th>PAYMENT DETAILS</th>
                            <th>Balance Due</th>
                            <th>STATUS</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sourceBookings.map((b) => `
                            <tr>
                                <td>${b.id}</td>
                                <td>${b.student}</td>
                                <td>${b.email || 'N/A'}</td>
                                <td>${b.contact || 'N/A'}</td>
                                <td>${formatCourseWithType(b)}</td>
                                <td>${b.branch}</td>
                                <td>${b.date}</td>
                                <td>${formatPrintDate(b.firstPaymentDate || b.paymentDate)}</td>
                                <td>${b.statusKey === 'paid' ? formatPrintDate(b.fullPaymentDate || b.paymentDate) : '-'}</td>
                                <td class="amount">${b.amount} (${b.paymentType}) via ${b.paymentMethod}</td>
                                <td class="amount">${toMoney(b.balanceDue || 0)}</td>
                                <td><span class="status-pill ${b.statusKey}">${b.status || 'Partial Payment'}</span></td>
                            </tr>
                        `).join('')}
                        <tr class="total-row">
                            <td colspan="9" style="text-align:right;">TOTAL AMOUNT PAID</td>
                            <td>${toMoney(totalAmount)}</td>
                            <td colspan="2"></td>
                        </tr>
                    </tbody>
                </table>
                <div class="footer">Total Records: ${sourceBookings.length} | Master Driving School Booking System</div>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
        }, 500);
    };

    // Reset to page 1 whenever filters change
    useEffect(() => { setBkPage(1); }, [searchTerm, statusFilter]);
    useEffect(() => {
        setHistoryPage(1);
    }, [historySearchTerm, historyStatusFilter, historyDateFilter, historyCustomDays, historyDateFrom, historyDateTo]);

    const bkTotalPages = Math.ceil(filteredBookings.length / BK_PAGE_SIZE);
    const pagedBookings = filteredBookings.slice((bkPage - 1) * BK_PAGE_SIZE, bkPage * BK_PAGE_SIZE);
    const historyTotalPages = Math.max(1, Math.ceil(filteredHistoryBookings.length / BK_HISTORY_PAGE_SIZE));
    const pagedHistoryBookings = filteredHistoryBookings.slice((historyPage - 1) * BK_HISTORY_PAGE_SIZE, historyPage * BK_HISTORY_PAGE_SIZE);

    const openHistoryModal = () => {
        setHistorySearchTerm(searchTerm);
        setHistoryStatusFilter(statusFilter);
        setHistoryDateFilter('All Time');
        setHistoryCustomDays('15');
        setHistoryDateFrom('');
        setHistoryDateTo('');
        setShowHistoryModal(true);
    };

    const updateStatus = async (id, newStatus) => {
        try {
            // Find the booking to get the raw database ID
            const booking = bookings.find(b => b.id === id);
            const dbId = booking?.rawId || id;

            await adminAPI.updateBookingStatus(dbId, newStatus.toLowerCase());
            setBookings(bookings.map(b => b.id === id ? { ...b, status: newStatus } : b));
            showNotification(`Booking status updated to ${newStatus} successfully!`, 'success');
        } catch (err) {
            console.error('Error updating status:', err);
            showNotification('Failed to update booking status. Please try again.', 'error');
        }
    };

    const openMarkPaidModal = (booking) => {
        if (booking.statusKey !== 'partial-payment') return;
        const { remaining } = resolveAssessmentFigures(booking);
        setMarkPaidBooking(booking);
        setMarkPaidMethod('Cash');
        setMarkPaidTxnId('');
        setMarkPaidAmount(remaining > 0 ? remaining.toFixed(2) : '');
        setShowMarkPaidModal(true);
    };

    const handleConfirmMarkPaid = async () => {
        if (!markPaidBooking) return;
        const { remaining } = resolveAssessmentFigures(markPaidBooking);
        const collectAmount = Number(markPaidAmount);

        if (!Number.isFinite(collectAmount) || collectAmount <= 0) {
            showNotification('Please enter a valid amount to collect.', 'error');
            return;
        }
        if (collectAmount > remaining + 0.001) {
            showNotification('Amount to collect cannot be greater than remaining balance.', 'error');
            return;
        }
        if (markPaidMethod === 'Metrobank' && !markPaidTxnId.trim()) {
            showNotification('Transaction ID is required for Metrobank payments.', 'error');
            return;
        }

        try {
            setMarkPaidLoading(true);
            const dbId = markPaidBooking?.rawId || markPaidBooking?.id;
            await adminAPI.markAsPaid(
                dbId,
                markPaidMethod,
                markPaidMethod === 'Metrobank' ? markPaidTxnId.trim() : null,
                Number(collectAmount.toFixed(2))
            );
            await loadBookings();
            setShowMarkPaidModal(false);
            setMarkPaidBooking(null);
            showNotification('Payment recorded successfully.', 'success');
        } catch (err) {
            console.error('Error marking booking as paid:', err);
            showNotification('Failed to mark booking as paid. Please try again.', 'error');
        } finally {
            setMarkPaidLoading(false);
        }
    };

    const handleViewClick = async (booking) => {
        setSelectedBooking(booking);
        setShowViewModal(true);
        // Re-fetch in background so payment fields are always fresh
        try {
            const [response, coursesRes, addonsRes] = await Promise.all([
                adminAPI.getAllBookings(null, 100),
                coursesAPI.getAll().catch(() => ({ success: false, courses: [] })),
                coursesAPI.getAddonsConfig().catch(() => ({ success: false, config: {} })),
            ]);
            if (response.success) {
                const fresh = response.bookings.find(b => b.id === booking.rawId);
                if (fresh) {
                    const formatLong = (d) => {
                        if (!d) return null;
                        const dt = new Date(d);
                        if (Number.isNaN(dt.getTime())) return null;
                        return dt.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            timeZone: 'Asia/Manila',
                        });
                    };
                    
                    // 1. Map Schedule Details
                    const sDetails = fresh.schedule_details || [];
                    const tdcArr = sDetails.filter(d => (d.type || '').toLowerCase() === 'tdc');
                    const pdcArr = sDetails.filter(d => (d.type || '').toLowerCase() === 'pdc');
                    
                    let tdcDay1 = formatLong(tdcArr[0]?.date);
                    let tdcDay2 = tdcArr[0]?.end_date && tdcArr[0].end_date !== tdcArr[0].date
                        ? formatLong(tdcArr[0].end_date)
                        : formatLong(tdcArr[1]?.date);
                    let pdcDay1 = formatLong(pdcArr[0]?.date);
                    let pdcDay2 = pdcArr[0]?.end_date && pdcArr[0].end_date !== pdcArr[0].date
                        ? formatLong(pdcArr[0].end_date)
                        : formatLong(pdcArr[1]?.date);
                    let tdcTime1 = tdcArr[0]?.time_range || null;
                    let tdcTime2 = tdcArr[1]?.time_range || null;

                    const notesJson = parseNotesJson(fresh.notes || '') || {};
                    const pdcScheduleLockedUntilCompletion = !!notesJson?.pdcScheduleLockedUntilCompletion;
                    const pdcScheduleLockReason = notesJson?.pdcScheduleLockReason || '';
                    const freshStatusKeyBase = normalizeBookingStatusKey(fresh.status || 'partial_payment');
                    const freshStatusKey = freshStatusKeyBase;
                    const canAssignPdcSchedule = pdcScheduleLockedUntilCompletion && String(freshStatusKey).toLowerCase() === 'paid';
                    const noteTdcDay1 = formatLong(notesJson?.scheduleDate);
                    const noteTdcDay2 = formatLong(notesJson?.scheduleDate2);
                    const noteTdcSession1 = notesJson?.scheduleSession || null;
                    const noteTdcSession2 = notesJson?.scheduleSession2 || null;
                    const noteTdcTime1 = notesJson?.scheduleTime || null;
                    const noteTdcTime2 = notesJson?.scheduleTime2 || null;
                    const hasTdcCourse =
                        (Array.isArray(notesJson?.courseList) && notesJson.courseList.some((item) => {
                            const source = `${item?.name || ''} ${item?.type || ''} ${item?.category || ''}`.toUpperCase();
                            return source.includes('TDC') || source.includes('THEORETICAL');
                        }))
                        || String(fresh.course_category || '').toUpperCase() === 'TDC'
                        || String(fresh.course_name || '').toUpperCase().includes('TDC');

                    if (hasTdcCourse) {
                        if (!tdcDay1 && noteTdcDay1) tdcDay1 = noteTdcDay1;
                        if ((!tdcDay2 || tdcDay2 === tdcDay1) && noteTdcDay2 && noteTdcDay2 !== tdcDay1) {
                            tdcDay2 = noteTdcDay2;
                        }
                        if (!tdcTime1 && noteTdcTime1) tdcTime1 = noteTdcTime1;
                        if (!tdcTime2 && noteTdcTime2) tdcTime2 = noteTdcTime2;
                    }

                    let tdcSession1 = tdcArr[0]?.session || null;
                    let tdcSession2 = tdcArr[1]?.session || tdcSession1;
                    if (!tdcSession1 && noteTdcSession1) tdcSession1 = noteTdcSession1;
                    if (!tdcSession2 && noteTdcSession2) tdcSession2 = noteTdcSession2;
                    tdcSession1 = normalizeSessionLabel(tdcSession1) || inferSessionFromTimeRange(tdcTime1);
                    tdcSession2 = normalizeSessionLabel(tdcSession2) || inferSessionFromTimeRange(tdcTime2) || tdcSession1;

                    const notePdcRawDates = Object.values(notesJson?.pdcSelections || {})
                        .flatMap((sel) => [sel?.pdcDate || sel?.date, sel?.pdcDate2 || sel?.date2])
                        .filter(Boolean);
                    const uniquePdcLabels = [...new Set(notePdcRawDates.map((d) => formatLong(d)).filter(Boolean))];

                    const firstPdcSelection = Object.values(notesJson?.pdcSelections || {})[0] || null;
                    const notePdcSession1 = firstPdcSelection?.pdcSlotDetails?.session || firstPdcSelection?.session || null;
                    const notePdcSession2 = firstPdcSelection?.pdcSlotDetails2?.session || firstPdcSelection?.session2 || null;
                    const notePdcTime1 = firstPdcSelection?.pdcSlotDetails?.time_range || firstPdcSelection?.time || null;
                    const notePdcTime2 = firstPdcSelection?.pdcSlotDetails2?.time_range || firstPdcSelection?.time2 || null;

                    if (!pdcDay1 && uniquePdcLabels.length > 0) pdcDay1 = uniquePdcLabels[0];
                    if ((!pdcDay2 || pdcDay2 === pdcDay1) && uniquePdcLabels.length > 1) {
                        pdcDay2 = uniquePdcLabels[uniquePdcLabels.length - 1];
                    }

                    let pdcSession1 = sDetails.find(d => (d.type || '').toLowerCase() === 'pdc')?.session || null;
                    let pdcSession2 = sDetails.filter(d => (d.type || '').toLowerCase() === 'pdc')[1]?.session || pdcSession1;
                    let pdcTime1 = sDetails.find(d => (d.type || '').toLowerCase() === 'pdc')?.time_range || null;
                    let pdcTime2 = sDetails.filter(d => (d.type || '').toLowerCase() === 'pdc')[1]?.time_range || pdcTime1;

                    if (!pdcSession1 && notePdcSession1) pdcSession1 = notePdcSession1;
                    if (!pdcSession2 && notePdcSession2) pdcSession2 = notePdcSession2;
                    if (!pdcTime1 && notePdcTime1) pdcTime1 = notePdcTime1;
                    if (!pdcTime2 && notePdcTime2) pdcTime2 = notePdcTime2;

                    pdcSession1 = normalizeSessionLabel(pdcSession1) || inferSessionFromTimeRange(pdcTime1);
                    pdcSession2 = normalizeSessionLabel(pdcSession2) || inferSessionFromTimeRange(pdcTime2) || pdcSession1;

                    const pdcSchedulesDetailed = Object.values(notesJson?.pdcSelections || {})
                        .map((sel, idx) => {
                            const day1 = formatLong(sel?.pdcDate || sel?.date);
                            const day2 = formatLong(sel?.pdcDate2 || sel?.date2);
                            const time1 = sel?.pdcSlotDetails?.time_range || sel?.pdcSlotDetails?.time || sel?.slot?.time_range || null;
                            const time2 = sel?.pdcSlotDetails2?.time_range || sel?.pdcSlotDetails2?.time || sel?.slot2?.time_range || null;
                            const session1 = normalizeSessionLabel(sel?.pdcSlotDetails?.session || sel?.slot?.session || null) || inferSessionFromTimeRange(time1);
                            const session2 = normalizeSessionLabel(sel?.pdcSlotDetails2?.session || sel?.slot2?.session || null) || inferSessionFromTimeRange(time2) || session1;
                            const merged1 = [session1, time1].filter(Boolean).join(' · ');
                            const merged2 = [session2, time2].filter(Boolean).join(' · ');
                            const isSameTimeBothDays = Boolean(day2) && merged1 && merged1 === merged2;
                            const rawLabel = String(sel?.label || sel?.courseName || `PDC Course ${idx + 1}`).trim();
                            const rawType = String(sel?.courseTypeDetailed || sel?.courseType || '').trim();
                            const txCode = String(sel?.transmission || '').toUpperCase();
                            const txWord = txCode === 'AT' ? 'Automatic' : txCode === 'MT' ? 'Manual' : '';
                            const compactLabel = toCompactCourseLabel({
                                name: rawLabel,
                                type: `${rawType} ${txWord}`.trim(),
                                category: 'PDC',
                            });
                            return {
                                id: `${sel?.courseId || idx}`,
                                label: compactLabel || rawLabel,
                                courseType: rawType,
                                day1,
                                day2,
                                time1,
                                time2,
                                session1,
                                session2,
                                sharedTime: isSameTimeBothDays ? merged1 : null,
                            };
                        })
                        .filter((entry) => entry.day1 || entry.day2);

                    const sched = {
                        tdcDay1,
                        tdcDay2,
                        pdcDay1,
                        pdcDay2,
                        pdcSession1,
                        pdcSession2,
                        pdcTime1,
                        pdcTime2,
                        tdcTime1,
                        tdcTime2,
                        tdcSession1,
                        tdcSession2,
                    };

                    // 2. Map Financials (JSON notes or Legacy Estimator)
                    let fin = { addonsDetailed: [], promoDiscount: 0, convenienceFee: 0 };
                    const total = Number(fresh.total_amount || 0);
                    const courseCategory = (fresh.course_category || '').toLowerCase();
                    const isWalkInBooking = String(notesJson?.source || '').toLowerCase() === 'walk_in'
                        || String(fresh.notes || '').toLowerCase().includes('walk-in enrollment:');

                    if (fresh.notes?.startsWith('{')) {
                        try {
                            const n = JSON.parse(fresh.notes);
                            fin = { 
                                addonsDetailed: n.addonsDetailed || [], 
                                promoDiscount: n.promoDiscount || 0, 
                                convenienceFee: isWalkInBooking ? 0 : (n.convenienceFee || 0)
                            };
                            // If total is provided in notes, use it
                            if (n.totalAmount) fresh.total_amount = n.totalAmount;
                        } catch(e) {}
                    } else if (total === 3274.5) {
                        fin = {
                            addonsDetailed: [
                                { name: 'PDC Motorcycle Course', price: 2150 },
                                { name: 'Digital Reviewer', price: 30 },
                                { name: 'Vehicle Maintenance Tips', price: 20 },
                                { name: 'Additional Course Processing', price: 450 }
                            ],
                            promoDiscount: 100.5,
                                convenienceFee: isWalkInBooking ? 0 : 25,
                            legacyBaseName: 'TDC Face-to-Face',
                            legacyBasePrice: 700
                        };
                    } else if (!isPromoBooking(fresh, notesJson) && (fresh.course_name && fresh.course_name.includes('+'))) {
                        const addonsConfig = {
                            reviewer: 30,
                            vehicleTips: 20,
                            convenienceFee: 25,
                            promoBundleDiscountPercent: 0,
                            ...(addonsRes?.config || {}),
                        };
                        // Fallback calculation for Custom Promo bundles (Dynamic Combos) if not in JSON.
                        // Predefined Promo courses from the DB should NOT get this dynamic 3% discount!
                        const basePrice = fresh.typeCategory === 'TDC + PDC' ? 2850 : Number(fresh.course_price || 0);
                        const promoPct = Number(addonsConfig?.promoBundleDiscountPercent ?? 0);
                        const disc = Math.round(basePrice * (promoPct / 100) * 100) / 100;
                        fin = {
                            addonsDetailed: (fresh.addons || []).map(a => ({ name: a.name, price: Number(a.price) })),
                            promoDiscount: disc,
                            convenienceFee: isWalkInBooking ? 0 : 25
                        };
                    } else {
                        // Basic fallback
                        fin = {
                            addonsDetailed: (fresh.addons || []).map(a => ({ name: a.name, price: Number(a.price) })),
                            promoDiscount: 0,
                            convenienceFee: isWalkInBooking ? 0 : 25
                        };
                    }

                    const resolvedCourseTypeTdc = resolveTdcTypeLabel(notesJson?.courseTypeTdc || fresh.course_type || selectedBooking?.courseTypeTdc || '', notesJson, fresh);
                    const baseCourseItems = applyResolvedTdcType(normalizeCourseItems(fresh, notesJson), resolvedCourseTypeTdc);
                    const courseCatalog = Array.isArray(coursesRes?.courses) ? coursesRes.courses : [];
                    const byName = new Map(courseCatalog.map((c) => [String(c?.name || '').trim().toLowerCase(), c]));
                    const pdcSelections = Object.values(notesJson?.pdcSelections || {});

                    const pricedCourseItems = baseCourseItems.map((item) => {
                        const itemNameKey = String(item?.name || '').trim().toLowerCase();
                        const selectionMatch = pdcSelections.find((sel) =>
                            String(sel?.courseName || '').trim().toLowerCase() === itemNameKey
                        );
                        const byId = selectionMatch?.courseId
                            ? courseCatalog.find((c) => Number(c?.id) === Number(selectionMatch.courseId))
                            : null;
                        const byExactName = byName.get(itemNameKey);
                        const fallbackByType = courseCatalog.find((c) => {
                            const cat = String(c?.category || '').toLowerCase();
                            const itemCat = String(item?.category || '').toLowerCase();
                            const itemType = String(item?.type || '').toLowerCase();
                            return cat === itemCat && (!itemType || String(c?.name || '').toLowerCase().includes(itemType));
                        });
                        const matchedCourse = byId || byExactName || fallbackByType;
                        return {
                            ...item,
                            courseId: matchedCourse?.id || selectionMatch?.courseId || null,
                            price: Number(matchedCourse?.price || 0),
                        };
                    });

                    const addonsConfig = {
                        reviewer: 30,
                        vehicleTips: 20,
                        convenienceFee: 25,
                        promoBundleDiscountPercent: 0,
                        ...(addonsRes?.config || {}),
                    };
                    const reviewerEach = Number(addonsConfig.reviewer || 30);
                    const vehicleTipsEach = Number(addonsConfig.vehicleTips || 20);
                    const convenienceEach = Number(addonsConfig.convenienceFee || 25);
                    const effectiveConvenienceEach = isWalkInBooking ? 0 : convenienceEach;
                    const promoPct = Number(addonsConfig.promoBundleDiscountPercent ?? 0);
                    const hasReviewer = Boolean(notesJson?.hasReviewer);
                    const hasVehicleTips = Boolean(notesJson?.hasVehicleTips);
                    const courseCount = Math.max(1, pricedCourseItems.length || baseCourseItems.length || 1);
                    const courseSubtotal = pricedCourseItems.reduce((sum, c) => sum + Number(c?.price || 0), 0);
                    const hasBundle = pricedCourseItems.some((c) => String(c?.category || '').toLowerCase().includes('tdc'))
                        && pricedCourseItems.some((c) => String(c?.category || '').toLowerCase().includes('pdc'));

                    const paymentTypeNorm = String(fresh.payment_type || notesJson?.paymentType || '').toLowerCase();
                    const paidAmount = Number(fresh.total_amount || 0);
                    const assessedTarget = paymentTypeNorm.includes('down') ? paidAmount * 2 : paidAmount;
                    const promoFactor = hasBundle ? (1 - (promoPct / 100)) : 1;
                    const targetBaseBeforePromo = promoFactor > 0 ? (assessedTarget / promoFactor) : assessedTarget;

                    const convenienceCandidates = [
                        Number(isWalkInBooking ? 0 : (fin.convenienceFee || 0)),
                        effectiveConvenienceEach * courseCount,
                        effectiveConvenienceEach,
                    ].filter((v, i, arr) => Number(v) > 0 && arr.indexOf(v) === i);

                    const addonUnit = (hasReviewer ? reviewerEach : 0) + (hasVehicleTips ? vehicleTipsEach : 0);
                    let computedConvenienceFee = effectiveConvenienceEach * courseCount;
                    let addonMultiplier = (hasReviewer || hasVehicleTips) ? 1 : 0;

                    if (addonUnit > 0 && targetBaseBeforePromo > 0 && convenienceCandidates.length > 0) {
                        const best = convenienceCandidates
                            .map((candidate) => {
                                const rawMultiplier = (targetBaseBeforePromo - courseSubtotal - candidate) / addonUnit;
                                const roundedMultiplier = Math.max(0, Math.round(rawMultiplier));
                                const rebuiltBase = courseSubtotal + candidate + (roundedMultiplier * addonUnit);
                                const error = Math.abs(rebuiltBase - targetBaseBeforePromo);
                                const rangePenalty = roundedMultiplier <= courseCount ? 0 : 1000;
                                return {
                                    candidate,
                                    roundedMultiplier,
                                    score: error + rangePenalty,
                                };
                            })
                            .sort((a, b) => a.score - b.score)[0];

                        computedConvenienceFee = Number(best?.candidate || computedConvenienceFee);
                        addonMultiplier = Math.max(0, Number(best?.roundedMultiplier || addonMultiplier));
                    }

                    const reviewerTotal = hasReviewer ? reviewerEach * addonMultiplier : 0;
                    const vehicleTipsTotal = hasVehicleTips ? vehicleTipsEach * addonMultiplier : 0;
                    const baseForPromo = courseSubtotal + reviewerTotal + vehicleTipsTotal + computedConvenienceFee;
                    const computedPromoDiscount = hasBundle ? Number(((baseForPromo * promoPct) / 100).toFixed(2)) : 0;

                    const normalizedAddonsDetailed = Array.isArray(fin.addonsDetailed) && fin.addonsDetailed.length > 0
                        ? fin.addonsDetailed
                        : [
                            ...(reviewerTotal > 0 ? [{ name: `LTO Exam Reviewer${addonMultiplier > 1 ? ` x${addonMultiplier}` : ''}`, price: reviewerTotal }] : []),
                            ...(vehicleTipsTotal > 0 ? [{ name: `Vehicle Maintenance Tips${addonMultiplier > 1 ? ` x${addonMultiplier}` : ''}`, price: vehicleTipsTotal }] : []),
                        ];

                    const normalizedConvenienceFee = isWalkInBooking
                        ? 0
                        : Number(fin.convenienceFee || 0) > 0
                        ? Number(fin.convenienceFee || 0)
                        : computedConvenienceFee;
                    const normalizedPromoDiscount = isPromoBooking(fresh, notesJson)
                        ? 0
                        : Number(fin.promoDiscount || 0) > 0
                            ? Number(fin.promoDiscount || 0)
                            : computedPromoDiscount;

                    const refreshedCourseItems = applyResolvedTdcType(
                        pricedCourseItems.length > 0 ? pricedCourseItems : baseCourseItems,
                        resolvedCourseTypeTdc
                    );

                    setSelectedBooking(prev => ({
                        ...prev,
                        ...sched,
                        ...fin,
                        addonsDetailed: normalizedAddonsDetailed,
                        convenienceFee: normalizedConvenienceFee,
                        promoDiscount: normalizedPromoDiscount,
                        promoPct: normalizedPromoDiscount > 0 ? (Number(fin.promoPct || 0) || promoPct) : 0,
                        pdcSchedulesDetailed,
                        courseItems: refreshedCourseItems,
                        courseTypeTdc: resolvedCourseTypeTdc,
                        coursePrice: courseSubtotal > 0
                            ? courseSubtotal
                            : (prev.typeCategory === 'TDC + PDC' ? 2850 : (fin.legacyBasePrice || Number(fresh.course_price || 0))),
                        fullCourseName: fin.legacyBaseName || prev.fullCourseName,
                        amountPaid: total,
                        paymentDate: fresh.created_at,
                        transactionId: fresh.transaction_id || null,
                        rawNotes: fresh.notes || '',
                        pdcScheduleLockedUntilCompletion,
                        pdcScheduleLockReason,
                        canAssignPdcSchedule,
                        branchId: fresh.branch_id || prev.branchId || null,
                    }));
                }
            }
        } catch (_) {}
    };

    const loadAssignablePdcSlots = async (dateValue, setter) => {
        if (!dateValue || !selectedBooking) {
            setter([]);
            return;
        }

        try {
            const branchId = selectedBooking.branchId || userBranchId || selectedBranch || null;
            const slotsRes = await schedulesAPI.getSlotsByDate(dateValue, branchId, 'PDC');
            const slotList = Array.isArray(slotsRes)
                ? slotsRes
                : (Array.isArray(slotsRes?.slots) ? slotsRes.slots : []);

            const normalized = slotList
                .filter((slot) => String(slot?.type || '').toLowerCase() === 'pdc')
                .map((slot) => ({
                    id: Number(slot.id),
                    availableSlots: Number(slot.available_slots || 0),
                    label: `${slot.session || 'Session'}${slot.time_range ? ` · ${slot.time_range}` : ''}${slot.available_slots != null ? ` · ${slot.available_slots} slots` : ''}`,
                }))
                .filter((slot) => slot.availableSlots > 0);

            setter(normalized);
        } catch (err) {
            console.error('Failed to load PDC slots:', err);
            setter([]);
        }
    };

    const openAssignPdcModal = async () => {
        if (!selectedBooking) return;

        const courseOptions = buildPdcCourseOptions(selectedBooking);
        const day1 = toInputDate(selectedBooking.pdcDay1 || new Date());
        const day2 = toInputDate(selectedBooking.pdcDay2 || '');

        setAssignPdcCourses(courseOptions);
        setAssignPdcCourseKey(courseOptions[0]?.key || '');
        setAssignPdcDate1(day1);
        setAssignPdcDate2(day2);
        setAssignPdcSlot1('');
        setAssignPdcSlot2('');
        setAssignPdcSlotsDay1([]);
        setAssignPdcSlotsDay2([]);
        setShowAssignPdcModal(true);

        await loadAssignablePdcSlots(day1, setAssignPdcSlotsDay1);
        if (day2) {
            await loadAssignablePdcSlots(day2, setAssignPdcSlotsDay2);
        }
    };

    const handleAssignPdc = async () => {
        if (!selectedBooking) return;
        if (!assignPdcDate1 || !assignPdcSlot1) {
            showNotification('Please select Day 1 date and slot.', 'error');
            return;
        }

        const hasOnlyOneDay2Field = (assignPdcDate2 && !assignPdcSlot2) || (!assignPdcDate2 && assignPdcSlot2);
        if (hasOnlyOneDay2Field) {
            showNotification('Please complete both Day 2 date and Day 2 slot.', 'error');
            return;
        }

        if (selectedAssignCourseNeedsDay2 && (!assignPdcDate2 || !assignPdcSlot2)) {
            showNotification('This PDC variant requires Day 2 date and slot assignment.', 'error');
            return;
        }

        const selectedCourse = assignPdcCourses.find((item) => String(item.key) === String(assignPdcCourseKey)) || assignPdcCourses[0];

        try {
            setAssignPdcLoading(true);
            await adminAPI.assignPdcSchedule(selectedBooking.rawId || selectedBooking.id, [{
                courseKey: selectedCourse?.key || 'pdc_1',
                courseId: selectedCourse?.courseId || null,
                courseName: selectedCourse?.courseName || 'PDC Course',
                courseType: selectedCourse?.courseType || '',
                pdcDate: assignPdcDate1,
                scheduleSlotId: Number(assignPdcSlot1),
                ...(assignPdcDate2 && assignPdcSlot2 ? {
                    pdcDate2: assignPdcDate2,
                    promoPdcSlotId2: Number(assignPdcSlot2),
                } : {}),
            }]);

            setShowAssignPdcModal(false);
            await loadBookings();
            await handleViewClick(selectedBooking);
            showNotification('PDC schedule assigned successfully.', 'success');
        } catch (err) {
            console.error('Assign PDC error:', err);
            showNotification(err?.message || 'Failed to assign PDC schedule.', 'error');
        } finally {
            setAssignPdcLoading(false);
        }
    };

    const handleExport = (sourceBookings = filteredBookings, sourceStatusFilter = statusFilter) => {
        const timestamp = new Date().toLocaleString();
        const totalAmount = sourceBookings.reduce((sum, b) => {
            const raw = String(b?.amount || '').replace(/[^0-9.]/g, '');
            return sum + (parseFloat(raw) || 0);
        }, 0);
        const formatExportDate = (value) => {
            if (!value) return '-';
            const dateObj = new Date(value);
            if (Number.isNaN(dateObj.getTime())) return '-';
            return dateObj.toLocaleString('en-US', {
                month: 'numeric',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            });
        };
        const formatCourseWithType = (booking) => {
            const list = Array.isArray(booking?.courseItems) ? booking.courseItems : [];
            const labels = [...new Set(list.map((item) => {
                const name = String(item?.name || '').trim();
                const type = String(item?.type || '').trim();
                const upperName = name.toUpperCase();
                const hasEmbeddedPdcType = upperName.includes('PRACTICAL DRIVING COURSE')
                    && (upperName.includes('B1 - VAN/B2 - L300') || upperName.includes('A1 - TRICYCLE'));
                if (!name && !type) return '';
                if (hasEmbeddedPdcType) return name || 'Course';
                if (!type) return name || 'Course';
                const typeLabel = type.toLowerCase() === 'f2f' ? 'F2F' : `${type.charAt(0).toUpperCase()}${type.slice(1)}`;
                return `${name || 'Course'} (${typeLabel})`;
            }).filter(Boolean))];

            if (labels.length > 0) return labels.join(', ');

            const fallbackName = booking?.fullCourseName || booking?.type || booking?.typeCategory || 'N/A';
            const fallbackType = String(booking?.courseTypeTdc || booking?.courseTypePdc || '').trim();
            const fallbackUpper = String(fallbackName || '').toUpperCase();
            const fallbackHasEmbeddedPdcType = fallbackUpper.includes('PRACTICAL DRIVING COURSE')
                && (fallbackUpper.includes('B1 - VAN/B2 - L300') || fallbackUpper.includes('A1 - TRICYCLE'));
            if (fallbackHasEmbeddedPdcType) return fallbackName;
            if (!fallbackType) return fallbackName;
            const fallbackTypeLabel = fallbackType.toLowerCase() === 'f2f'
                ? 'F2F'
                : `${fallbackType.charAt(0).toUpperCase()}${fallbackType.slice(1)}`;
            return `${fallbackName} (${fallbackTypeLabel})`;
        };

        const tableHtml = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="utf-8">
                <style>
                    body { background-color: #ffffff; margin: 0; padding: 0; }
                    table { border-collapse: collapse; width: 100%; font-family: 'Segoe UI', Arial, sans-serif; background-color: #ffffff; }
                    .report-header { background-color: #ffffff; }
                    .title { font-size: 20pt; font-weight: bold; color: #1a4fba; padding: 15px 5px; text-align: left; }
                    .meta { font-size: 11pt; color: #64748b; padding-bottom: 25px; text-align: left; }
                    .column-header th { background-color: #1a4fba !important; color: #ffffff !important; padding: 12px 10px; font-weight: bold; border: 1px solid #cbd5e1; text-align: center; -webkit-print-color-adjust: exact; }
                    .row td { padding: 10px; border: 1px solid #e2e8f0; color: #334155; background-color: #ffffff; text-align: center; white-space: normal; word-break: break-word; }
                    .status-pill { display: inline-block; padding: 3px 10px; border-radius: 999px; font-weight: 700; font-size: 10pt; white-space: nowrap; }
                    .paid { color: #166534; background: #dcfce7; border: 1px solid #86efac; }
                    .partial-payment { color: #9a3412; background: #ffedd5; border: 1px solid #fdba74; }
                    .cancelled { color: #991b1b; background: #fee2e2; border: 1px solid #fca5a5; }
                    .pending { color: #9a3412; background: #ffedd5; border: 1px solid #fdba74; }
                    .total-row td { background-color: #f0f6ff !important; font-weight: bold; color: #1a4fba; border-top: 2px solid #1a4fba; text-align: center; padding: 10px; }
                </style>
            </head>
            <body>
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="${logo}" style="width: 80px; height: 80px; border-radius: 12px; margin-bottom: 10px;">
                </div>
                <table>
                    <tr><td colspan="12" class="title">MASTER DRIVING SCHOOL - BOOKING REPORT</td></tr>
                    <tr><td colspan="12" class="meta">Status Filter: ${sourceStatusFilter} | Generated on: ${timestamp}</td></tr>
                    <tr><td colspan="12" style="height: 15px; background-color: #ffffff;"></td></tr>
                    <tr class="column-header">
                        <th>BOOKING ID</th>
                        <th>STUDENT NAME</th>
                        <th>EMAIL</th>
                        <th>STUDENT NUMBER</th>
                        <th>COURSE</th>
                        <th>BRANCH</th>
                        <th>SCHEDULE</th>
                        <th>FIRST PAYMENT DATE</th>
                        <th>FULLY PAID DATE</th>
                        <th>PAYMENT DETAILS</th>
                        <th>BALANCE DUE</th>
                        <th>STATUS</th>
                    </tr>
                    ${sourceBookings.map(b => `
                        <tr class="row">
                            <td>${b.id}</td>
                            <td>${b.student}</td>
                            <td>${b.email || 'N/A'}</td>
                            <td>${b.contact || 'N/A'}</td>
                            <td>${formatCourseWithType(b)}</td>
                            <td>${b.branch}</td>
                            <td>${b.date}</td>
                            <td>${formatExportDate(b.firstPaymentDate || b.paymentDate)}</td>
                            <td>${b.statusKey === 'paid' ? formatExportDate(b.fullPaymentDate || b.paymentDate) : '-'}</td>
                            <td>${b.amount} (${b.paymentType}) via ${b.paymentMethod}</td>
                            <td>${toMoney(b.balanceDue || 0)}</td>
                            <td><span class="status-pill ${b.statusKey}">${b.status}</span></td>
                        </tr>
                    `).join('')}
                    <tr class="total-row">
                        <td colspan="9" style="text-align:right;">TOTAL AMOUNT PAID</td>
                        <td>${toMoney(totalAmount)}</td>
                        <td colspan="2"></td>
                    </tr>
                    <tr><td colspan="12" style="height: 15px; background-color: #ffffff;"></td></tr>
                    <tr><td colspan="12" style="height: 15px; background-color: #ffffff;"></td></tr>
                    <tr><td colspan="12" style="height: 15px; background-color: #ffffff;"></td></tr>
                    <tr><td colspan="12" style="height: 20px; border-top: 2px solid #1a4fba; font-size: 10pt; color: #94a3b8; padding-top: 10px; text-align: center;">Total Records: ${sourceBookings.length} | Official Enrollment Record</td></tr>
                </table>
            </body>
            </html>
        `;

        const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `MasterSchool_Bookings_${new Date().toISOString().slice(0, 10)}.xls`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showNotification('Booking report exported successfully!', 'success');
    };
    return (
        <div className="booking-module">
            {/* Branch Filter Bar */}
            <div className="branch-filter-bar">
                <div className="branch-filter-left">
                    <div className="branch-filter-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                        </svg>
                    </div>
                    <div className="branch-filter-text">
                        <span className="branch-filter-label">Viewing Branch</span>
                        <span className="branch-filter-value">
                            {selectedBranch
                                ? (() => {
                                    const b = branches.find(br => String(br.id) === String(selectedBranch));
                                    if (!b) return 'Selected Branch';
                                    let name = b.name;
                                    const prefixes = ['Master Driving School ', 'Master Prime Driving School ', 'Masters Prime Holdings Corp. ', 'Master Prime Holdings Corp. '];
                                    for (const prefix of prefixes) {
                                        if (name.startsWith(prefix)) { name = name.substring(prefix.length); break; }
                                    }
                                    return name;
                                })()
                                : 'All Branches'}
                        </span>
                    </div>
                </div>
                <div className="branch-filter-right">
                    <span className="branch-filter-count">{branches.length} Branches</span>
                    <select
                        className="branch-filter-select"
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        disabled={userRole === 'admin' && !!userBranchId}
                    >
                        {!(userRole === 'admin' && !!userBranchId) && <option value="">All Branches / Default View</option>}
                        {branches.map(branch => {
                            let formattedName = branch.name;
                            const prefixes = ['Master Driving School ', 'Master Prime Driving School ', 'Masters Prime Holdings Corp. ', 'Master Prime Holdings Corp. '];
                            for (const prefix of prefixes) {
                                if (formattedName.startsWith(prefix)) { formattedName = formattedName.substring(prefix.length); break; }
                            }
                            return <option key={branch.id} value={branch.id}>{formattedName}</option>;
                        })}
                    </select>
                </div>
            </div>

            <div className="booking-header-section">
                <div className="booking-header">
                    <div className="header-left">
                        <div>
                            <h2>Booking Requests</h2>
                            <p>Manage and review student course enrolments</p>
                        </div>
                    </div>
                </div>

                <div className="header-actions-row">
                    <div className="search-bar">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        <input
                            type="text"
                            placeholder="Search by student, booking ID, course, branch, method..."
                            value={searchTerm}
                            onChange={handleSearch}
                        />
                        {searchTerm && (
                            <button className="search-clear" onClick={() => setSearchTerm('')}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {showViewModal && selectedBooking && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowViewModal(false)}>
                    <div className="bk-modal-v2 booking-print-root zoom-in">

                        {/* ── Print Header (Logo & School Name) ── */}
                        <div className="bkv2-print-header">
                            <img src={logo} alt="Master Driving School" className="bkv2-print-logo" />
                            <div className="bkv2-print-branding">
                                <h1>Master Driving School</h1>
                                <p>Official Booking Invoice & Schedule</p>
                            </div>
                            <div className="bkv2-print-date">
                                <span className="bkv2-print-date-label">Issued:</span>
                                <span className="bkv2-print-date-value">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                            </div>
                        </div>

                        {/* ── Header ── */}
                        <div className="bkv2-header">
                            <div className="bkv2-header-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                            </div>
                            <div className="bkv2-header-text">
                                <h2>Booking Details</h2>
                                <span>{selectedBooking.id}</span>
                            </div>
                            <div className={`bkv2-status-chip ${selectedBooking.statusKey}`}>
                                {selectedBooking.status}
                            </div>
                            <button className="bkv2-close" onClick={() => setShowViewModal(false)}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>

                        {/* ── Scrollable body ── */}
                        <div className="bkv2-body">

                            {/* Student card */}
                            <div className="bkv2-student-card">
                                <div className="bkv2-avatar">
                                    {selectedBooking.student.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                </div>
                                <div className="bkv2-student-info">
                                    <div className="bkv2-student-name">{selectedBooking.student}</div>
                                    <div className="bkv2-student-meta">
                                        <span>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                            {selectedBooking.email}
                                        </span>
                                        <span>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                            {selectedBooking.contact}
                                        </span>
                                        <span>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                            {selectedBooking.address}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Course + Branch row */}
                            <div className="bkv2-row-2">
                                {modalCourseItems.map((course, idx) => (
                                    <div className="bkv2-info-card" key={`course-card-${idx}`}>
                                        <div className="bkv2-card-label">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                                            Course{modalCourseItems.length > 1 ? ` ${idx + 1}` : ''}
                                        </div>
                                        <div className="bkv2-card-title">{toCompactCourseLabel(course)}</div>
                                        {course?.name && (
                                            <div className="bkv2-card-sub">{course.name}</div>
                                        )}
                                    </div>
                                ))}
                                <div className="bkv2-info-card">
                                    <div className="bkv2-card-label">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                        Branch
                                    </div>
                                    <div className="bkv2-card-title">{selectedBooking.branch}</div>
                                    <div className="bkv2-card-sub" style={{ marginTop: 'auto', paddingTop: '8px' }}>
                                        {selectedBooking.paymentMethod}
                                    </div>
                                    {selectedBooking.addonNames && (
                                        <div className="bkv2-addon-chip" style={{ marginTop: '6px' }}>
                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                            {selectedBooking.addonNames}
                                        </div>
                                    )}
                                </div>
                            </div>

                             {/* Payment Receipt */}
                            <div className="bkv2-receipt">
                                <div className="bkv2-receipt-head">
                                    <span>
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                                        Payment Breakdown
                                    </span>
                                    <div className="flex items-center gap-3">
                                        <span className="bkv2-verified">✓ Verified</span>
                                    </div>
                                </div>
                                
                                <div className="bkv2-receipt-body">
                                    {/* --- Section: Courses --- */}
                                    <div className="bkv2-section-mini">Courses & Training</div>
                                    {(paymentBreakdown?.courseLines || []).map((line, idx) => (
                                        <div className="bkv2-line-item" key={`course-line-${idx}`}>
                                            <span>{line.label}</span>
                                            <span>{toMoney(line.amount)}</span>
                                        </div>
                                    ))}

                                    {/* --- Section: Add-ons --- */}
                                    {(paymentBreakdown?.addonLines || []).length > 0 && (
                                        <>
                                            <div className="bkv2-section-mini">Custom Add-ons</div>
                                            {(paymentBreakdown?.addonLines || [])
                                                .map((addon, idx) => (
                                                <div className="bkv2-line-item addon" key={idx}>
                                                    <span>
                                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                                        {addon.name}
                                                    </span>
                                                    <span>{toMoney(addon.price)}</span>
                                                </div>
                                            ))}
                                        </>
                                    )}

                                    {/* --- Section: Fees & Discounts --- */}
                                    {(paymentBreakdown && (paymentBreakdown.subtotal > 0 || paymentBreakdown.convenienceFee > 0 || paymentBreakdown.promoDiscount > 0)) && (
                                        <>
                                            <div className="bkv2-section-mini">Summary</div>
                                            <div className="bkv2-line-item addon">
                                                <span>Subtotal</span>
                                                <span>{toMoney(paymentBreakdown.subtotal)}</span>
                                            </div>
                                            {paymentBreakdown.convenienceFee > 0 && (
                                                <div className="bkv2-line-item addon">
                                                    <span>
                                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                                        Convenience Fee
                                                    </span>
                                                    <span>{toMoney(paymentBreakdown.convenienceFee)}</span>
                                                </div>
                                            )}

                                            {paymentBreakdown.promoDiscount > 0 && (
                                                <div className="bkv2-line-item discount">
                                                    <span className="text-gray-600">
                                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="12" cy="12" r="10"/></svg>
                                                        {(!isPromoBooking(selectedBooking, parseNotesJson(selectedBooking.rawNotes)) && (paymentBreakdown.promoPct === 3 || (selectedBooking.courseItems?.length > 1)) && !String(selectedBooking.fullCourseName).toLowerCase().includes('bundle')) 
                                                            ? 'Multi-Course Discount (3%)' 
                                                            : `Discount (${paymentBreakdown.promoPct > 0 ? `${paymentBreakdown.promoPct}%` : '3%'})`}
                                                    </span>
                                                    <span className="text-green-600">-{toMoney(paymentBreakdown.promoDiscount)}</span>
                                                </div>
                                            )}

                                            <div className="bkv2-line-item total-summary" style={{ borderTop: '1px solid #e2e8f0', marginTop: '4px', paddingTop: '4px', fontWeight: '800' }}>
                                                <span>Total Assessment</span>
                                                <span>{toMoney(paymentBreakdown.grandTotal)}</span>
                                            </div>
                                        </>
                                    )}

                                    <div className="bkv2-section-mini">Balance Summary</div>
                                    <div className="bkv2-line-item addon">
                                        <span>Total Assessment</span>
                                        <span>{toMoney(selectedAssessment.assessed)}</span>
                                    </div>
                                    <div className="bkv2-line-item addon">
                                        <span>Total Amount Paid</span>
                                        <span>{toMoney(selectedAssessment.paid)}</span>
                                    </div>
                                    <div className="bkv2-line-item balance">
                                        <span>Remaining Balance</span>
                                        <span>{toMoney(selectedAssessment.remaining)}</span>
                                    </div>
                                </div>

                                <div className="bkv2-receipt-foot">
                                    <div className="bkv2-total-label">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
                                        Total Amount Paid
                                    </div>
                                    <span className="bkv2-total">₱{selectedBooking.amountPaid.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Schedule section – only render if there's at least one date */}
                            {(selectedBooking.tdcDay1 || selectedBooking.pdcDay1) && (
                                <div className="bkv2-schedule">
                                    <div className="bkv2-schedule-head">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                        Class Schedule
                                    </div>
                                    <div className="bkv2-sched-grid">
                                        {selectedBooking.tdcDay1 && (
                                            <div className="bkv2-sched-card tdc">
                                                <div className="bkv2-sched-badge">TDC</div>
                                                <p className="bkv2-sched-title">
                                                    {toCompactCourseLabel(tdcCourseItem)}
                                                </p>
                                                <p className="bkv2-sched-sub">
                                                    {tdcCourseItem?.name || 'Theoretical Driving Course (TDC)'}
                                                </p>
                                                <div className="bkv2-sched-days">
                                                    {(() => {
                                                        const tdcSession1 = normalizeSessionLabel(selectedBooking.tdcSession1) || inferSessionFromTimeRange(selectedBooking.tdcTime1);
                                                        const tdcSession2 = normalizeSessionLabel(selectedBooking.tdcSession2) || inferSessionFromTimeRange(selectedBooking.tdcTime2) || tdcSession1;
                                                        const tdcLine1 = [tdcSession1, selectedBooking.tdcTime1].filter(Boolean).join(' · ');
                                                        const tdcLine2 = [tdcSession2, selectedBooking.tdcTime2].filter(Boolean).join(' · ');
                                                        const tdcSharedTime = tdcLine1 && tdcLine2 && tdcLine1 === tdcLine2 ? tdcLine1 : '';
                                                        return (
                                                            <>
                                                    <div className="bkv2-sched-day">
                                                        <span className="bkv2-day-label">Day 1</span>
                                                        <span className="bkv2-day-val">{selectedBooking.tdcDay1}</span>
                                                        {!tdcSharedTime && tdcLine1 && (
                                                            <span className="bkv2-time-line tdc">
                                                                {tdcLine1}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {selectedBooking.tdcDay2 && (
                                                        <div className="bkv2-sched-day">
                                                            <span className="bkv2-day-label">Day 2</span>
                                                            <span className="bkv2-day-val">{selectedBooking.tdcDay2}</span>
                                                            {!tdcSharedTime && (tdcLine2 || tdcLine1) && (
                                                                <span className="bkv2-time-line tdc">
                                                                    {tdcLine2 || tdcLine1}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                    {tdcSharedTime && (
                                                        <span className="bkv2-time-line tdc shared">
                                                            {tdcSharedTime} · Both Days
                                                        </span>
                                                    )}
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        )}
                                        {selectedBooking.pdcDay1 && !(Array.isArray(selectedBooking.pdcSchedulesDetailed) && selectedBooking.pdcSchedulesDetailed.length > 0) && (
                                            <div className="bkv2-sched-card pdc">
                                                <div className="bkv2-sched-badge">PDC</div>
                                                <p className="bkv2-sched-title">
                                                    {toCompactCourseLabel(pdcCourseItem)}
                                                </p>
                                                <p className="bkv2-sched-sub">
                                                    {pdcCourseItem?.name || 'Practical Driving Course (PDC)'}
                                                </p>
                                                {(() => {
                                                    const day1Session = normalizeSessionLabel(selectedBooking.pdcSession1) || inferSessionFromTimeRange(selectedBooking.pdcTime1);
                                                    const day2Session = normalizeSessionLabel(selectedBooking.pdcSession2) || inferSessionFromTimeRange(selectedBooking.pdcTime2) || day1Session;
                                                    const day1Line = [day1Session, selectedBooking.pdcTime1].filter(Boolean).join(' · ');
                                                    const day2Line = [day2Session, selectedBooking.pdcTime2].filter(Boolean).join(' · ') || day1Line;
                                                    return (
                                                <div className="bkv2-sched-days">
                                                    <div className="bkv2-sched-day">
                                                        <span className="bkv2-day-label">Day 1</span>
                                                        <span className="bkv2-day-val">{selectedBooking.pdcDay1}</span>
                                                        {day1Line && (
                                                            <span className="bkv2-time-line pdc">
                                                                {day1Line}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {selectedBooking.pdcDay2 && (
                                                        <div className="bkv2-sched-day">
                                                            <span className="bkv2-day-label">Day 2</span>
                                                            <span className="bkv2-day-val">{selectedBooking.pdcDay2}</span>
                                                            {day2Line && (
                                                                <span className="bkv2-time-line pdc">
                                                                    {day2Line}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>

                                    {Array.isArray(selectedBooking.pdcSchedulesDetailed) && selectedBooking.pdcSchedulesDetailed.length > 0 && (
                                        <div className="bkv2-sched-grid" style={{ marginTop: '12px' }}>
                                            {selectedBooking.pdcSchedulesDetailed.map((entry, idx) => (
                                                <div className="bkv2-sched-card pdc" key={`pdc-detail-${entry.id}-${idx}`}>
                                                    <div className="bkv2-sched-badge">PDC</div>
                                                    <p className="bkv2-sched-title">
                                                        {toCompactCourseLabel({ name: entry.label, type: entry.courseType, category: 'PDC' })}
                                                    </p>
                                                    <p className="bkv2-sched-sub">{entry.label}</p>
                                                    <div className="bkv2-sched-days">
                                                        {entry.day1 && (
                                                            <div className="bkv2-sched-day">
                                                                <span className="bkv2-day-label">Day 1</span>
                                                                <span className="bkv2-day-val">{entry.day1}</span>
                                                                {!entry.sharedTime && (
                                                                    <span className="bkv2-time-line pdc">
                                                                        {[entry.session1, entry.time1].filter(Boolean).join(' · ') || 'Time TBA'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                        {entry.day2 && (
                                                            <div className="bkv2-sched-day">
                                                                <span className="bkv2-day-label">Day 2</span>
                                                                <span className="bkv2-day-val">{entry.day2}</span>
                                                                {!entry.sharedTime && (
                                                                    <span className="bkv2-time-line pdc">
                                                                        {[entry.session2, entry.time2].filter(Boolean).join(' · ') || [entry.session1, entry.time1].filter(Boolean).join(' · ') || 'Time TBA'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                        {entry.sharedTime && (
                                                            <span className="bkv2-time-line pdc shared">
                                                                {entry.sharedTime} · Both Days
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {selectedBooking.pdcScheduleLockedUntilCompletion && (
                                        <div className="bkv2-sched-card" style={{ marginTop: '12px', borderStyle: 'dashed' }}>
                                            <div className="bkv2-sched-badge" style={{ background: '#dbeafe', color: '#1e40af' }}>PDC</div>
                                            <p className="bkv2-sched-title" style={{ color: '#1e40af' }}>
                                                {selectedBooking.canAssignPdcSchedule ? 'Ready For Admin PDC Assignment' : 'Pending OTDC/CRM Completion'}
                                            </p>
                                            <p className="bkv2-sched-sub">
                                                {selectedBooking.pdcScheduleLockReason || 'PDC schedule is assigned by admin after OTDC completion is marked in CRM.'}
                                            </p>
                                            {selectedBooking.canAssignPdcSchedule && (
                                                <button
                                                    className="bk-mark-paid-confirm"
                                                    type="button"
                                                    style={{ marginTop: '10px', width: '100%' }}
                                                    onClick={openAssignPdcModal}
                                                >
                                                    Assign PDC Now
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ── Footer ── */}
                        <div className="bkv2-footer">
                            <button
                                className="bkv2-close-btn bkv2-print-btn"
                                onClick={handlePrintBookingDetails}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                                Print
                            </button>
                            
                            <button className="bkv2-close-btn" onClick={() => setShowViewModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {showMarkPaidModal && markPaidBooking && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !markPaidLoading && setShowMarkPaidModal(false)}>
                    <div className="bk-mark-paid-modal">
                        {(() => {
                            const { assessed, paid, remaining } = resolveAssessmentFigures(markPaidBooking);
                            const collectInput = Number(markPaidAmount);
                            const collectAmount = Number.isFinite(collectInput) && collectInput > 0
                                ? Math.min(collectInput, remaining)
                                : 0;
                            const remainingAfter = Math.max(0, Number((remaining - collectAmount).toFixed(2)));

                            return (
                                <>
                                        <div className="bk-mark-paid-head bkv2-header">
                                            <div className="bkv2-header-icon">
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                                    <path d="M12 1v22" />
                                                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14.5a3.5 3.5 0 0 1 0 7H6" />
                                                </svg>
                                            </div>
                                            <div className="bkv2-header-text">
                                                <h2>Collect Remaining Balance</h2>
                                                <span>{markPaidBooking.id}</span>
                                            </div>
                                            <div className="bkv2-status-chip partial-payment">Partial Payment</div>
                                            <button className="bk-mark-paid-close bkv2-close" onClick={() => !markPaidLoading && setShowMarkPaidModal(false)}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                            </button>
                                        </div>
                
                                        <div className="bk-mark-paid-body">
                                            <div className="bk-mark-paid-panel bk-modal-card">
                                                <div className="bk-mark-paid-row"><span>Student</span><strong>{markPaidBooking.student}</strong></div>
                                                <div className="bk-mark-paid-row"><span>Course</span><strong>{markPaidBooking.courseSummary || markPaidBooking.type}</strong></div>
                                                <div className="bk-mark-paid-row"><span>Total Assessment</span><strong>{toMoney(assessed)}</strong></div>
                                                <div className="bk-mark-paid-row"><span>Total Amount Paid</span><strong>{toMoney(paid)}</strong></div>
                                                <div className="bk-mark-paid-row highlight"><span>Current Remaining</span><strong>{toMoney(remaining)}</strong></div>
                                            </div>

                                            <div className="bk-mark-paid-panel bk-modal-card bk-mark-paid-form-card">
                                                <label className="bk-mark-paid-label">Amount to Collect</label>
                                                <input
                                                    className="bk-mark-paid-input"
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={markPaidAmount}
                                                    onChange={(e) => setMarkPaidAmount(e.target.value)}
                                                    disabled={markPaidLoading}
                                                />
                                                <div className="bk-mark-paid-row sub"><span>Remaining After Payment</span><strong>{toMoney(remainingAfter)}</strong></div>

                                                <label className="bk-mark-paid-label">Payment Method</label>
                                                <select
                                                    className="bk-mark-paid-input"
                                                    value={markPaidMethod}
                                                    onChange={(e) => setMarkPaidMethod(e.target.value)}
                                                    disabled={markPaidLoading}
                                                >
                                                    <option value="Cash">Cash</option>
                                                    <option value="Metrobank">Metrobank</option>
                                                </select>

                                                {markPaidMethod === 'Metrobank' && (
                                                    <div className="bk-mark-paid-metrobank-box">
                                                        <label className="bk-mark-paid-label">Transaction ID</label>
                                                        <input
                                                            className="bk-mark-paid-input"
                                                            type="text"
                                                            value={markPaidTxnId}
                                                            onChange={(e) => setMarkPaidTxnId(e.target.value)}
                                                            placeholder="Enter Metrobank transaction ID"
                                                            disabled={markPaidLoading}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="bk-mark-paid-actions">
                                            <button
                                                className="bk-mark-paid-cancel"
                                                onClick={() => !markPaidLoading && setShowMarkPaidModal(false)}
                                                disabled={markPaidLoading}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                className="bk-mark-paid-confirm"
                                                onClick={handleConfirmMarkPaid}
                                                disabled={markPaidLoading}
                                            >
                                                {markPaidLoading ? 'Processing...' : 'Confirm Payment'}
                                            </button>
                                        </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}

            {showAssignPdcModal && selectedBooking && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !assignPdcLoading && setShowAssignPdcModal(false)}>
                    <div className="bk-mark-paid-modal">
                        <div className="bk-mark-paid-head bkv2-header">
                            <div className="bkv2-header-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                    <path d="M3 6h18" />
                                    <path d="M3 12h18" />
                                    <path d="M3 18h18" />
                                </svg>
                            </div>
                            <div className="bkv2-header-text">
                                <h2>Assign PDC Schedule</h2>
                                <span>{selectedBooking.id}</span>
                            </div>
                            <button className="bk-mark-paid-close bkv2-close" onClick={() => !assignPdcLoading && setShowAssignPdcModal(false)}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>

                        <div className="bk-mark-paid-body">
                            <div className="bk-mark-paid-panel bk-modal-card bk-mark-paid-form-card" style={{ width: '100%' }}>
                                <label className="bk-mark-paid-label">PDC Course</label>
                                <select
                                    className="bk-mark-paid-input"
                                    value={assignPdcCourseKey}
                                    onChange={(e) => setAssignPdcCourseKey(e.target.value)}
                                    disabled={assignPdcLoading}
                                >
                                    {assignPdcCourses.map((course) => (
                                        <option key={course.key} value={course.key}>
                                            {course.courseName}{course.courseType ? ` (${course.courseType})` : ''}
                                        </option>
                                    ))}
                                </select>

                                <label className="bk-mark-paid-label">PDC Day 1 Date</label>
                                <input
                                    className="bk-mark-paid-input"
                                    type="date"
                                    value={assignPdcDate1}
                                    onChange={async (e) => {
                                        const value = e.target.value;
                                        setAssignPdcDate1(value);
                                        setAssignPdcSlot1('');
                                        await loadAssignablePdcSlots(value, setAssignPdcSlotsDay1);
                                    }}
                                    disabled={assignPdcLoading}
                                />

                                <label className="bk-mark-paid-label">PDC Day 1 Slot</label>
                                <select
                                    className="bk-mark-paid-input"
                                    value={assignPdcSlot1}
                                    onChange={(e) => setAssignPdcSlot1(e.target.value)}
                                    disabled={assignPdcLoading}
                                >
                                    <option value="">Select Day 1 Slot</option>
                                    {assignPdcSlotsDay1.map((slot) => (
                                        <option key={slot.id} value={slot.id}>{slot.label}</option>
                                    ))}
                                </select>

                                <label className="bk-mark-paid-label">PDC Day 2 Date {selectedAssignCourseNeedsDay2 ? '(Required)' : '(Optional)'}</label>
                                <input
                                    className="bk-mark-paid-input"
                                    type="date"
                                    value={assignPdcDate2}
                                    onChange={async (e) => {
                                        const value = e.target.value;
                                        setAssignPdcDate2(value);
                                        setAssignPdcSlot2('');
                                        if (!value) {
                                            setAssignPdcSlotsDay2([]);
                                            return;
                                        }
                                        await loadAssignablePdcSlots(value, setAssignPdcSlotsDay2);
                                    }}
                                    disabled={assignPdcLoading}
                                />

                                <label className="bk-mark-paid-label">PDC Day 2 Slot {selectedAssignCourseNeedsDay2 ? '(Required)' : '(Optional)'}</label>
                                <select
                                    className="bk-mark-paid-input"
                                    value={assignPdcSlot2}
                                    onChange={(e) => setAssignPdcSlot2(e.target.value)}
                                    disabled={assignPdcLoading || !assignPdcDate2}
                                >
                                    <option value="">Select Day 2 Slot</option>
                                    {assignPdcSlotsDay2.map((slot) => (
                                        <option key={slot.id} value={slot.id}>{slot.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="bk-mark-paid-actions">
                            <button
                                className="bk-mark-paid-cancel"
                                onClick={() => !assignPdcLoading && setShowAssignPdcModal(false)}
                                disabled={assignPdcLoading}
                            >
                                Cancel
                            </button>
                            <button
                                className="bk-mark-paid-confirm"
                                onClick={handleAssignPdc}
                                disabled={assignPdcLoading}
                            >
                                {assignPdcLoading ? 'Assigning...' : 'Confirm Assignment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="booking-stats">
                <div className="mini-stat">
                    <div className="mini-stat-icon blue">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                    </div>
                    <div className="mini-stat-content">
                        <span className="label">Total Bookings</span>
                        <span className="value">{loading ? '--' : bookings.length}</span>
                    </div>
                </div>
                <div className="mini-stat">
                    <div className="mini-stat-icon orange">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    </div>
                    <div className="mini-stat-content">
                        <span className="label">Partial Payment</span>
                        <span className="value">{loading ? '--' : bookings.filter(b => b.statusKey === 'partial-payment').length}</span>
                    </div>
                </div>
                <div className="mini-stat">
                    <div className="mini-stat-icon green">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    </div>
                    <div className="mini-stat-content">
                        <span className="label">Paid</span>
                        <span className="value">{loading ? '--' : bookings.filter(b => b.status === 'Paid').length}</span>
                    </div>
                </div>
                <div className="mini-stat">
                    <div className="mini-stat-icon red">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                    </div>
                    <div className="mini-stat-content">
                        <span className="label">Cancelled</span>
                        <span className="value">{loading ? '--' : bookings.filter(b => b.status === 'Cancelled').length}</span>
                    </div>
                </div>
            </div>

            <div className="booking-content">
                <div className="filters-row">
                    <div className="status-tabs">
                        {['All', 'Partial Payment', 'Paid', 'Cancelled'].map(s => (
                            <button key={s} className={`status-tab ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>{s}</button>
                        ))}
                    </div>
                    <div className="section-actions">
                        <button className="export-btn-secondary" onClick={() => handleExport(filteredBookings, statusFilter)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Export Excel
                        </button>
                        <button className="export-btn-secondary" onClick={() => handlePrintList(filteredBookings, 'BOOKING LIST')}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                            Print List
                        </button>
                        <button className="view-all-link" onClick={openHistoryModal}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            View All History
                        </button>
                    </div>
                </div>

                {error && (
                    <div style={{ padding: '12px 20px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <span>{error}</span>
                    </div>
                )}

                <div className="bk-results-bar">
                    <span className="bk-results-count">{filteredBookings.length} {filteredBookings.length === 1 ? 'result' : 'results'}</span>
                    {statusFilter !== 'All' && <span className="bk-active-filter">{statusFilter} <button onClick={() => setStatusFilter('All')}>&times;</button></span>}
                </div>

                <div className="admin-table-responsive">
                    <table className="booking-table">
                        <thead><tr><th>ID</th><th>Student</th><th>Branch</th><th>First Payment</th><th>Payment</th><th>Status</th><th>Action</th></tr></thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={`skeleton-${i}`} className="bk-skeleton-row">
                                        <td><div className="bk-skeleton-cell" style={{ width: '70px' }}></div></td>
                                        <td>
                                            <div className="bk-table-student">
                                                <div className="bk-skeleton-avatar"></div>
                                                <div className="bk-skeleton-cell" style={{ width: '120px' }}></div>
                                            </div>
                                        </td>
                                        <td><div className="bk-skeleton-cell" style={{ width: '90px' }}></div></td>
                                        <td><div className="bk-skeleton-cell" style={{ width: '100px' }}></div></td>
                                        <td><div className="bk-skeleton-cell" style={{ width: '80px' }}></div></td>
                                        <td><div className="bk-skeleton-cell" style={{ width: '70px', borderRadius: '20px' }}></div></td>
                                        <td><div className="bk-skeleton-cell" style={{ width: '80px' }}></div></td>
                                    </tr>
                                ))
                            ) : filteredBookings.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="no-data">
                                        <div className="bk-empty-state">
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                <polyline points="14 2 14 8 20 8"></polyline>
                                                <line x1="9" y1="15" x2="15" y2="15"></line>
                                            </svg>
                                            <p>No bookings found</p>
                                            <span>Try adjusting your search or filter criteria</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : pagedBookings.map(booking => (
                                <tr
                                    key={booking.id}
                                    className="bk-table-row bk-clickable-row"
                                    onClick={() => handleViewClick(booking)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            handleViewClick(booking);
                                        }
                                    }}
                                >
                                    <td className="bk-id" data-label="ID">{booking.id}</td>
                                    <td data-label="Student">
                                        <div className="bk-table-student">
                                            <div className="bk-student-avatar">
                                                {booking.student.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                            </div>
                                            <div className="student-info">
                                                <span className="name">{booking.student}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="bk-branch" data-label="Branch">{booking.branch}</td>
                                    <td className="bk-date" data-label="First Payment">
                                        <div className="bk-date-info">
                                            <span className="main-date">{booking.firstPaymentDate ? new Date(booking.firstPaymentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}</span>
                                            <span className="meta-time">{booking.firstPaymentDate ? new Date(booking.firstPaymentDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                        </div>
                                    </td>
                                    <td className="bk-payment" data-label="Payment">
                                        <div className="payment-info-v2">
                                            <span className="amount font-bold">{booking.amount}</span>
                                            <span className="meta">{booking.paymentType} via {booking.paymentMethod}</span>
                                        </div>
                                    </td>
                                    <td data-label="Status">
                                        <span className={`status-pill ${booking.statusKey}`}>
                                            {booking.status}
                                        </span>
                                    </td>
                                    <td data-label="Action">
                                        <div className="table-actions">
                                            {booking.statusKey === 'partial-payment' && (
                                                <>
                                                    <button className="approve-action-btn" title="Mark as Paid" onClick={(e) => { e.stopPropagation(); openMarkPaidModal(booking); }}>
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                    </button>
                                                    <button className="reject-action-btn" title="Cancel" onClick={(e) => { e.stopPropagation(); updateStatus(booking.id, 'Cancelled'); }}>
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                    </button>
                                                </>
                                            )}
                                            <button className="view-action-btn" title="View Details" onClick={(e) => { e.stopPropagation(); handleViewClick(booking); }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <Pagination
                        currentPage={bkPage}
                        totalPages={bkTotalPages}
                        onPageChange={setBkPage}
                        totalItems={filteredBookings.length}
                        pageSize={BK_PAGE_SIZE}
                    />
                </div>
            </div>

            {showHistoryModal && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowHistoryModal(false)}>
                    <div className="bk-history-modal">
                        <div className="bk-history-header">
                            <div className="bk-history-header-left">
                                <div className="bk-history-header-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                                </div>
                                <div>
                                    <h2>Booking History</h2>
                                    <p>Review and filter all booking records</p>
                                </div>
                            </div>
                            <div className="bk-history-header-right">
                                <button className="bk-history-header-btn" onClick={() => handleExport(filteredHistoryBookings, historyStatusFilter)}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                    Export Excel
                                </button>
                                <button className="bk-history-header-btn" onClick={() => handlePrintList(filteredHistoryBookings, 'FILTERED BOOKING HISTORY')}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                    Print
                                </button>
                                <button className="bk-history-close" onClick={() => setShowHistoryModal(false)}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>
                        </div>

                        <div className="bk-history-controls">
                            <div className="bk-history-search">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                <input
                                    type="text"
                                    placeholder="Search by student, booking ID, course, branch, method..."
                                    value={historySearchTerm}
                                    onChange={(e) => setHistorySearchTerm(e.target.value)}
                                />
                                {historySearchTerm && (
                                    <button className="bk-history-search-clear" onClick={() => setHistorySearchTerm('')}>
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                )}
                            </div>
                            <div className="bk-history-date-row">
                                <span className="filter-label">Period</span>
                                <div className="date-pills">
                                    {['All Time', 'Today', 'This Week', 'This Month', 'This Year', 'Past X Days', 'Custom Range'].map((opt) => (
                                        <button
                                            key={`history-period-${opt}`}
                                            className={`date-pill${historyDateFilter === opt ? ' active' : ''}`}
                                            onClick={() => setHistoryDateFilter(opt)}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                                {historyDateFilter === 'Past X Days' && (
                                    <div className="custom-days-input">
                                        <span>Past</span>
                                        <input
                                            type="number"
                                            min="1"
                                            max="365"
                                            value={historyCustomDays}
                                            onChange={(e) => setHistoryCustomDays(e.target.value)}
                                        />
                                        <span>days</span>
                                    </div>
                                )}
                                {historyDateFilter === 'Custom Range' && (
                                    <div className="custom-range-inputs">
                                        <div className="date-range-field">
                                            <label>From</label>
                                            <input type="date" value={historyDateFrom} onChange={(e) => setHistoryDateFrom(e.target.value)} />
                                        </div>
                                        <span className="range-sep">→</span>
                                        <div className="date-range-field">
                                            <label>To</label>
                                            <input type="date" value={historyDateTo} onChange={(e) => setHistoryDateTo(e.target.value)} />
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="status-tabs">
                                {['All', 'Partial Payment', 'Paid', 'Cancelled'].map((s) => (
                                    <button key={`history-${s}`} className={`status-tab ${historyStatusFilter === s ? 'active' : ''}`} onClick={() => setHistoryStatusFilter(s)}>{s}</button>
                                ))}
                            </div>
                        </div>

                        <div className="admin-table-responsive">
                            <table className="booking-table bk-history-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Student</th>
                                        <th>Course</th>
                                        <th>Branch</th>
                                        <th>First Payment</th>
                                        <th>Payment</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedHistoryBookings.length > 0 ? pagedHistoryBookings.map((booking) => (
                                        <tr key={`history-${booking.id}`} className="bk-table-row">
                                            <td className="bk-id">{booking.id}</td>
                                            <td>
                                                <div className="bk-table-student">
                                                    <div className="bk-student-avatar">
                                                        {String(booking.student || '?').split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div className="student-info">
                                                        <span className="name">{booking.student}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>{booking.courseSummary || booking.type}</td>
                                            <td className="bk-branch">{booking.branch}</td>
                                            <td className="bk-date">
                                                <div className="bk-date-info">
                                                    <span className="main-date">{booking.firstPaymentDate ? new Date(booking.firstPaymentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}</span>
                                                    <span className="meta-time">{booking.firstPaymentDate ? new Date(booking.firstPaymentDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                                </div>
                                            </td>
                                            <td className="bk-payment">
                                                <div className="payment-info-v2">
                                                    <span className="amount font-bold">{booking.amount}</span>
                                                    <span className="meta">{booking.paymentType} via {booking.paymentMethod}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`status-pill ${booking.statusKey}`}>
                                                    {booking.status}
                                                </span>
                                            </td>
                                            <td>
                                                <button
                                                    className="view-action-btn"
                                                    title="View Details"
                                                    onClick={() => {
                                                        setShowHistoryModal(false);
                                                        handleViewClick(booking);
                                                    }}
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                                </button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="8" className="no-data">
                                                <div className="bk-empty-state">
                                                    <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                                    <p>No bookings found</p>
                                                    <span>Try adjusting your search or status filter</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="bk-history-footer">
                            <span className="bk-results-count">{filteredHistoryBookings.length} {filteredHistoryBookings.length === 1 ? 'record' : 'records'}</span>
                            <Pagination
                                currentPage={historyPage}
                                totalPages={historyTotalPages}
                                onPageChange={setHistoryPage}
                                totalItems={filteredHistoryBookings.length}
                                pageSize={BK_HISTORY_PAGE_SIZE}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Booking;
