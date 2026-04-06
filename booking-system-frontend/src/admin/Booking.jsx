import React, { useState, useEffect } from 'react';
import './css/booking.css';
import { adminAPI, branchesAPI, authAPI, coursesAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import Pagination from './components/Pagination';

const BK_PAGE_SIZE = 10;
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

const normalizeCourseItems = (booking, notesJson) => {
    const list = Array.isArray(notesJson?.courseList) ? notesJson.courseList : [];
    if (list.length > 0) {
        const cleaned = list.map((item) => ({
            name: item?.name || 'Course',
            type: item?.type || '',
            category: item?.category || '',
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
    }];
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

    if (hasTdc) {
        if (source.includes('F2F') || source.includes('FACE TO FACE')) return 'TDC F2F';
        if (source.includes('ONLINE')) return 'TDC Online';
        return 'TDC';
    }

    if (hasPdc) {
        let vehicle = '';
        if (source.includes('MOTORCYCLE')) vehicle = 'Motorcycle';
        else if (source.includes('CAR')) vehicle = 'Car';
        else if (source.includes('A1') || source.includes('TRICYCLE') || source.includes('V1-TRICYCLE')) vehicle = 'A1 - Tricycle';
        else if ((source.includes('B1') || source.includes('VAN')) && (source.includes('B2') || source.includes('L300'))) vehicle = 'B1 - VAN/B2 - L300';
        else if (source.includes('B1') || source.includes('VAN')) vehicle = 'B1 - VAN';
        else if (source.includes('B2') || source.includes('L300')) vehicle = 'B2 - L300';
        else if (source.includes('B1') || source.includes('B2')) vehicle = 'B1/B2';

        let transmission = '';
        if (source.includes('MANUAL')) transmission = 'Manual';
        else if (source.includes('AUTOMATIC')) transmission = 'Automatic';

        return ['PDC', vehicle, transmission].filter(Boolean).join(' ');
    }

    return toTitle(name) || 'Course';
};

const toMoney = (value = 0) => `₱${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const buildCoursePaymentLines = (booking) => {
    const notesJson = parseNotesJson(booking?.rawNotes || '');
    const sourceCourseItems = Array.isArray(booking?.courseItems) && booking.courseItems.length > 0
        ? booking.courseItems
        : normalizeCourseItems({
            course_name: booking?.fullCourseName || booking?.typeCategory || 'Course',
            course_type: booking?.courseTypeTdc || '',
            course_category: booking?.typeCategory || '',
        }, notesJson);

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

    return {
        courseLines,
        addonLines,
        subtotal,
        convenienceFee,
        promoDiscount,
        grandTotal,
    };
};

const Booking = () => {
    const { showNotification } = useNotification();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [bkPage, setBkPage] = useState(1);
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
    const paymentBreakdown = selectedBooking ? buildPaymentBreakdown(selectedBooking) : null;

    // Fetch branches and user role on mount
    useEffect(() => {
        const init = async () => {
            try {
                const profileRes = await authAPI.getProfile();
                let role = 'guest';
                let profileBranchId = null;
                if (profileRes.success) {
                    role = profileRes.user.role;
                    profileBranchId = profileRes.user.branchId;
                    setUserRole(role);
                    setUserBranchId(profileBranchId || null);
                }
                const res = await branchesAPI.getAll();
                let loaded = res.branches || [];
                if ((role === 'staff' || (role === 'admin' && profileBranchId)) && profileBranchId) {
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
        try {
            setLoading(true);
            setError(null);
            const response = await adminAPI.getAllBookings(null, 100, selectedBranch || null);
            if (response.success) {
                // Transform database fields to match UI expectations
                const transformedBookings = response.bookings.map(booking => {
                    // Normalize status
                    const rawStatus = (booking.status || 'collectable').toLowerCase();
                    let status;
                    if (rawStatus === 'pending') {
                        status = 'Pending'; // StarPay QR issued but not yet paid
                    } else if (rawStatus === 'paid' || rawStatus === 'confirmed' || rawStatus === 'completed') {
                        status = 'Paid';
                    } else if (rawStatus === 'cancelled') {
                        status = 'Cancelled';
                    } else {
                        status = 'Collectable';
                    }
                    // Only auto-promote collectable (not pending) to Paid for Full Payment
                    if (booking.payment_type === 'Full Payment' && status === 'Collectable') {
                        status = 'Paid';
                    }

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
                    const courseItems = normalizeCourseItems(booking, notesJson);
                    const courseCount = courseItems.length;
                    const courseNames = courseItems.map((c) => c.name).filter(Boolean);
                    const compactCourseLabels = courseItems.map((c) => toCompactCourseLabel(c)).filter(Boolean);
                    const courseSummary = courseCount > 1
                        ? `${compactCourseLabels.slice(0, 2).join(', ')}${courseCount > 2 ? ` +${courseCount - 2} more` : ''}`
                        : (compactCourseLabels[0] || courseItems[0]?.name || courseNameFromNotes);
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
                        courseItems,
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
                        rawId: booking.id,
                        // Detailed multi-day fields
                        tdcDay1: null, tdcDay2: null,
                        pdcDay1: null, pdcDay2: null,
                        pdcSchedulesDetailed: [],
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
                                pdcDay1: formatLong(pdcArr[0]?.date),
                                pdcDay2: pdcArr[0]?.end_date && pdcArr[0].end_date !== pdcArr[0].date 
                                    ? formatLong(pdcArr[0].end_date) 
                                    : formatLong(pdcArr[1]?.date) // Fallback to 2nd slot if any
                            };
                            return res;
                        })()),
                        // Extra fields for details panel
                        coursePrice: Number(booking.course_price || 0),
                        amountPaid: Number(booking.total_amount || 0),
                        paymentDate: booking.created_at,
                        transactionId: booking.transaction_id || null,
                        rawNotes: booking.notes || '',
                        address: booking.student_address || 'N/A',
                        contact: booking.student_contact || 'N/A',
                        email: booking.student_email || 'N/A',
                        courseTypeTdc: booking.course_type, // initial guess
                        courseTypePdc: '', // to be parsed
                        searchIndex: [
                            `BK-${String(booking.id).padStart(3, '0')}`,
                            booking.student_name,
                            booking.student_email,
                            booking.student_contact,
                            courseSummary,
                            (courseItems || []).map((c) => c.name).join(' '),
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
                            return {
                                ...b,
                                fullCourseName: n.combinedCourseNames || b.fullCourseName,
                                addonNames: n.addonNames || '',
                                courseTypePdc: n.courseTypePdc || '',
                                courseTypeTdc: n.courseTypeTdc || b.courseTypeTdc,
                            }
                        } catch(e) { return b; }
                    }
                    return b;
                });
                setBookings(refined);
            }
        } catch (err) {
            console.error('Error loading bookings:', err);
            setError('Failed to load bookings. Please try again.');
            showNotification('Failed to load bookings. Please try again.', 'error');
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

    // Reset to page 1 whenever filters change
    useEffect(() => { setBkPage(1); }, [searchTerm, statusFilter]);

    const bkTotalPages = Math.ceil(filteredBookings.length / BK_PAGE_SIZE);
    const pagedBookings = filteredBookings.slice((bkPage - 1) * BK_PAGE_SIZE, bkPage * BK_PAGE_SIZE);

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
        if (booking.status !== 'Collectable') return;
        const paid = Number(booking?.amountPaid || 0);
        const downpaymentFactor = String(booking?.paymentType || '').toLowerCase().includes('down') ? 2 : 1;
        const assessed = Math.max(Number(booking?.coursePrice || 0), paid * downpaymentFactor, paid);
        const remaining = Math.max(0, assessed - paid);
        setMarkPaidBooking(booking);
        setMarkPaidMethod('Cash');
        setMarkPaidTxnId('');
        setMarkPaidAmount(remaining > 0 ? remaining.toFixed(2) : '');
        setShowMarkPaidModal(true);
    };

    const handleConfirmMarkPaid = async () => {
        if (!markPaidBooking) return;
        const paid = Number(markPaidBooking?.amountPaid || 0);
        const downpaymentFactor = String(markPaidBooking?.paymentType || '').toLowerCase().includes('down') ? 2 : 1;
        const assessed = Math.max(Number(markPaidBooking?.coursePrice || 0), paid * downpaymentFactor, paid);
        const remaining = Math.max(0, Number((assessed - paid).toFixed(2)));
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
                    const noteTdcDay1 = formatLong(notesJson?.scheduleDate);
                    const noteTdcDay2 = formatLong(notesJson?.scheduleDate2);
                    const noteTdcSession1 = notesJson?.scheduleSession || null;
                    const noteTdcSession2 = notesJson?.scheduleSession2 || null;
                    const noteTdcTime1 = notesJson?.scheduleTime || null;
                    const noteTdcTime2 = notesJson?.scheduleTime2 || null;

                    if (!tdcDay1 && noteTdcDay1) tdcDay1 = noteTdcDay1;
                    if ((!tdcDay2 || tdcDay2 === tdcDay1) && noteTdcDay2 && noteTdcDay2 !== tdcDay1) {
                        tdcDay2 = noteTdcDay2;
                    }
                    if (!tdcTime1 && noteTdcTime1) tdcTime1 = noteTdcTime1;
                    if (!tdcTime2 && noteTdcTime2) tdcTime2 = noteTdcTime2;

                    const notePdcRawDates = Object.values(notesJson?.pdcSelections || {})
                        .flatMap((sel) => [sel?.pdcDate || sel?.date, sel?.pdcDate2 || sel?.date2])
                        .filter(Boolean);
                    const uniquePdcLabels = [...new Set(notePdcRawDates.map((d) => formatLong(d)).filter(Boolean))];

                    if (!pdcDay1 && uniquePdcLabels.length > 0) pdcDay1 = uniquePdcLabels[0];
                    if ((!pdcDay2 || pdcDay2 === pdcDay1) && uniquePdcLabels.length > 1) {
                        pdcDay2 = uniquePdcLabels[uniquePdcLabels.length - 1];
                    }

                    const pdcSchedulesDetailed = Object.values(notesJson?.pdcSelections || {})
                        .map((sel, idx) => {
                            const day1 = formatLong(sel?.pdcDate || sel?.date);
                            const day2 = formatLong(sel?.pdcDate2 || sel?.date2);
                            const time1 = sel?.pdcSlotDetails?.time_range || sel?.pdcSlotDetails?.time || sel?.slot?.time_range || null;
                            const time2 = sel?.pdcSlotDetails2?.time_range || sel?.pdcSlotDetails2?.time || sel?.slot2?.time_range || null;
                            const session1 = sel?.pdcSlotDetails?.session || sel?.slot?.session || null;
                            const session2 = sel?.pdcSlotDetails2?.session || sel?.slot2?.session || null;
                            const merged1 = [session1, time1].filter(Boolean).join(' · ');
                            const merged2 = [session2, time2].filter(Boolean).join(' · ');
                            const isSameTimeBothDays = Boolean(day2) && merged1 && merged1 === merged2;
                            return {
                                id: `${sel?.courseId || idx}`,
                                label: sel?.courseName || `PDC Course ${idx + 1}`,
                                courseType: sel?.courseType || '',
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
                        tdcTime1,
                        tdcTime2,
                        tdcSession1: noteTdcSession1,
                        tdcSession2: noteTdcSession2,
                    };

                    // 2. Map Financials (JSON notes or Legacy Estimator)
                    let fin = { addonsDetailed: [], promoDiscount: 0, convenienceFee: 0 };
                    const total = Number(fresh.total_amount || 0);
                    const courseCategory = (fresh.course_category || '').toLowerCase();

                    if (fresh.notes?.startsWith('{')) {
                        try {
                            const n = JSON.parse(fresh.notes);
                            fin = { 
                                addonsDetailed: n.addonsDetailed || [], 
                                promoDiscount: n.promoDiscount || 0, 
                                convenienceFee: n.convenienceFee || 0 
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
                            convenienceFee: 25,
                            legacyBaseName: 'TDC Face-to-Face',
                            legacyBasePrice: 700
                        };
                    } else if (courseCategory === 'promo' || (fresh.course_name && fresh.course_name.includes('+'))) {
                        // Fallback calculation for Promo bundles if not in JSON
                        const basePrice = fresh.typeCategory === 'TDC + PDC' ? 2850 : Number(fresh.course_price || 0);
                        const disc = Math.round(basePrice * 0.03 * 100) / 100; // 3%
                        fin = {
                            addonsDetailed: (fresh.addons || []).map(a => ({ name: a.name, price: Number(a.price) })),
                            promoDiscount: disc,
                            convenienceFee: 25
                        };
                    } else {
                        // Basic fallback
                        fin = {
                            addonsDetailed: (fresh.addons || []).map(a => ({ name: a.name, price: Number(a.price) })),
                            promoDiscount: 0,
                            convenienceFee: 25
                        };
                    }

                    const baseCourseItems = normalizeCourseItems(fresh, notesJson);
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
                        promoBundleDiscountPercent: 3,
                        ...(addonsRes?.config || {}),
                    };
                    const reviewerEach = Number(addonsConfig.reviewer || 30);
                    const vehicleTipsEach = Number(addonsConfig.vehicleTips || 20);
                    const convenienceEach = Number(addonsConfig.convenienceFee || 25);
                    const promoPct = Number(addonsConfig.promoBundleDiscountPercent || 3);
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
                        Number(fin.convenienceFee || 0),
                        convenienceEach * courseCount,
                        convenienceEach,
                    ].filter((v, i, arr) => Number(v) > 0 && arr.indexOf(v) === i);

                    const addonUnit = (hasReviewer ? reviewerEach : 0) + (hasVehicleTips ? vehicleTipsEach : 0);
                    let computedConvenienceFee = convenienceEach * courseCount;
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

                    const normalizedConvenienceFee = Number(fin.convenienceFee || 0) > 0
                        ? Number(fin.convenienceFee || 0)
                        : computedConvenienceFee;
                    const normalizedPromoDiscount = Number(fin.promoDiscount || 0) > 0
                        ? Number(fin.promoDiscount || 0)
                        : computedPromoDiscount;

                    const refreshedCourseItems = pricedCourseItems.length > 0 ? pricedCourseItems : baseCourseItems;

                    setSelectedBooking(prev => ({
                        ...prev,
                        ...sched,
                        ...fin,
                        addonsDetailed: normalizedAddonsDetailed,
                        convenienceFee: normalizedConvenienceFee,
                        promoDiscount: normalizedPromoDiscount,
                        pdcSchedulesDetailed,
                        courseItems: refreshedCourseItems,
                        coursePrice: courseSubtotal > 0
                            ? courseSubtotal
                            : (prev.typeCategory === 'TDC + PDC' ? 2850 : (fin.legacyBasePrice || Number(fresh.course_price || 0))),
                        fullCourseName: fin.legacyBaseName || prev.fullCourseName,
                        amountPaid: total,
                        paymentDate: fresh.created_at,
                        transactionId: fresh.transaction_id || null,
                        rawNotes: fresh.notes || '',
                    }));
                }
            }
        } catch (_) {}
    };

    const handleExport = () => {
        const timestamp = new Date().toLocaleString();

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
                    .row td { padding: 10px; border: 1px solid #e2e8f0; color: #334155; background-color: #ffffff; text-align: center; }
                    .status-paid { color: #16a34a; font-weight: bold; }
                    .status-collectable { color: #0ea5e9; font-weight: bold; }
                    .status-cancelled { color: #dc2626; font-weight: bold; }
                    .status-pending { color: #ea580c; font-weight: bold; }
                </style>
            </head>
            <body>
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="${logo}" style="width: 80px; height: 80px; border-radius: 12px; margin-bottom: 10px;">
                </div>
                <table>
                    <tr><td colspan="7" class="title">MASTER DRIVING SCHOOL - BOOKING REPORT</td></tr>
                    <tr><td colspan="7" class="meta">Status Filter: ${statusFilter} | Generated on: ${timestamp}</td></tr>
                    <tr><td colspan="7" style="height: 15px; background-color: #ffffff;"></td></tr>
                    <tr class="column-header">
                        <th>BOOKING ID</th>
                        <th>STUDENT NAME</th>
                        <th>COURSE</th>
                        <th>BRANCH</th>
                        <th>SCHEDULE</th>
                        <th>PAYMENT DETAILS</th>
                        <th>STATUS</th>
                    </tr>
                    ${filteredBookings.map(b => `
                        <tr class="row">
                            <td>${b.id}</td>
                            <td>${b.student}</td>
                            <td>${b.type}</td>
                            <td>${b.branch}</td>
                            <td>${b.date}</td>
                            <td>${b.amount} (${b.paymentType}) via ${b.paymentMethod}</td>
                            <td class="${b.status.toLowerCase() === 'paid' ? 'status-paid' : b.status.toLowerCase() === 'collectable' ? 'status-collectable' : b.status.toLowerCase() === 'pending' ? 'status-pending' : 'status-cancelled'}">${b.status.toUpperCase()}</td>
                        </tr>
                    `).join('')}
                    <tr><td colspan="7" style="height: 15px; background-color: #ffffff;"></td></tr>
                    <tr><td colspan="7" style="height: 15px; background-color: #ffffff;"></td></tr>
                    <tr><td colspan="7" style="height: 15px; background-color: #ffffff;"></td></tr>
                    <tr><td colspan="7" style="height: 20px; border-top: 2px solid #1a4fba; font-size: 10pt; color: #94a3b8; padding-top: 10px; text-align: center;">Total Records: ${filteredBookings.length} | Official Enrollment Record</td></tr>
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
                        disabled={userRole === 'staff' || (userRole === 'admin' && !!userBranchId)}
                    >
                        {!(userRole === 'staff' || (userRole === 'admin' && !!userBranchId)) && <option value="">All Branches / Default View</option>}
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
                    <div className="bk-modal-v2 zoom-in">

                        {/* ── Header ── */}
                        <div className="bkv2-header">
                            <div className="bkv2-header-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                            </div>
                            <div className="bkv2-header-text">
                                <h2>Booking Details</h2>
                                <span>{selectedBooking.id}</span>
                            </div>
                            <div className={`bkv2-status-chip ${selectedBooking.status.toLowerCase()}`}>
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
                                                    <span>
                                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                                                        Promo Discount (3%)
                                                    </span>
                                                    <span>−{toMoney(paymentBreakdown.promoDiscount)}</span>
                                                </div>
                                            )}
                                            <div className="bkv2-line-item">
                                                <span>Net Total</span>
                                                <span>{toMoney(paymentBreakdown.grandTotal)}</span>
                                            </div>
                                        </>
                                    )}
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
                                                        const tdcLine1 = [selectedBooking.tdcSession1, selectedBooking.tdcTime1].filter(Boolean).join(' · ');
                                                        const tdcLine2 = [selectedBooking.tdcSession2, selectedBooking.tdcTime2].filter(Boolean).join(' · ');
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
                                                <div className="bkv2-sched-days">
                                                    <div className="bkv2-sched-day">
                                                        <span className="bkv2-day-label">Day 1</span>
                                                        <span className="bkv2-day-val">{selectedBooking.pdcDay1}</span>
                                                    </div>
                                                    {selectedBooking.pdcDay2 && (
                                                        <div className="bkv2-sched-day">
                                                            <span className="bkv2-day-label">Day 2</span>
                                                            <span className="bkv2-day-val">{selectedBooking.pdcDay2}</span>
                                                        </div>
                                                    )}
                                                </div>
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
                                </div>
                            )}
                        </div>

                        {/* ── Footer ── */}
                        <div className="bkv2-footer">
                            <button className="bkv2-close-btn" onClick={() => setShowViewModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {showMarkPaidModal && markPaidBooking && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !markPaidLoading && setShowMarkPaidModal(false)}>
                    <div className="bk-mark-paid-modal">
                        {(() => {
                            const paid = Number(markPaidBooking?.amountPaid || 0);
                            const downpaymentFactor = String(markPaidBooking?.paymentType || '').toLowerCase().includes('down') ? 2 : 1;
                            const assessed = Math.max(Number(markPaidBooking?.coursePrice || 0), paid * downpaymentFactor, paid);
                            const remaining = Math.max(0, Number((assessed - paid).toFixed(2)));
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
                                            <div className="bkv2-status-chip collectable">Collectable</div>
                                            <button className="bk-mark-paid-close bkv2-close" onClick={() => !markPaidLoading && setShowMarkPaidModal(false)}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                            </button>
                                        </div>
                
                                        <div className="bk-mark-paid-body">
                                            <div className="bk-mark-paid-panel bk-modal-card">
                                                <div className="bk-mark-paid-row"><span>Student</span><strong>{markPaidBooking.student}</strong></div>
                                                <div className="bk-mark-paid-row"><span>Course</span><strong>{markPaidBooking.courseSummary || markPaidBooking.type}</strong></div>
                                                <div className="bk-mark-paid-row"><span>Total Assessment</span><strong>{toMoney(assessed)}</strong></div>
                                                <div className="bk-mark-paid-row"><span>Already Paid</span><strong>{toMoney(paid)}</strong></div>
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
                        <span className="label">Collectable</span>
                        <span className="value">{loading ? '--' : bookings.filter(b => b.status === 'Collectable').length}</span>
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
                        {['All', 'Collectable', 'Paid', 'Cancelled'].map(s => (
                            <button key={s} className={`status-tab ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>{s}</button>
                        ))}
                    </div>
                    <button className="export-btn" onClick={handleExport}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Export CSV
                    </button>
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

                <div className="booking-table-wrapper">
                    <table className="booking-table">
                        <thead><tr><th>ID</th><th>Student</th><th>Branch</th><th>Payment</th><th>Status</th><th>Action</th></tr></thead>
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
                                        <td><div className="bk-skeleton-cell" style={{ width: '80px' }}></div></td>
                                        <td><div className="bk-skeleton-cell" style={{ width: '70px', borderRadius: '20px' }}></div></td>
                                        <td><div className="bk-skeleton-cell" style={{ width: '80px' }}></div></td>
                                    </tr>
                                ))
                            ) : filteredBookings.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="no-data">
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
                                    <td className="bk-id">{booking.id}</td>
                                    <td>
                                        <div className="bk-table-student">
                                            <div className="bk-student-avatar">
                                                {booking.student.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                            </div>
                                            <div className="student-info">
                                                <span className="name">{booking.student}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="bk-branch">{booking.branch}</td>
                                    <td className="bk-payment">
                                        <div className="payment-info-v2">
                                            <span className="amount font-bold">{booking.amount}</span>
                                            <span className="meta">{booking.paymentType} via {booking.paymentMethod}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`status-pill ${booking.status.toLowerCase()}`}>
                                            {booking.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="table-actions">
                                            {booking.status === 'Collectable' && (
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
        </div>
    );
};

export default Booking;
