import React, { useState, useEffect } from 'react';
import './css/sale.css';
import { adminAPI, coursesAPI, branchesAPI, authAPI } from '../services/api';
const logo = `${window.location.origin}/images/logo.png`;
import Pagination from './components/Pagination';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie
} from 'recharts';

const parseNotesJson = (rawNotes) => {
    if (!rawNotes || typeof rawNotes !== 'string' || !rawNotes.startsWith('{')) return null;
    try {
        return JSON.parse(rawNotes);
    } catch {
        return null;
    }
};

const getCourseSummaryFromTransaction = (txn) => {
    const notesJson = parseNotesJson(txn?.notes);
    const list = Array.isArray(notesJson?.courseList) ? notesJson.courseList.filter(Boolean) : [];
    if (list.length > 0) {
        const names = [...new Set(list.map((c) => c?.name).filter(Boolean))];
        const shortLabel = names.length > 1
            ? `${names.length} courses: ${names.slice(0, 2).join(', ')}${names.length > 2 ? ` +${names.length - 2} more` : ''}`
            : (names[0] || txn?.course_name || 'N/A');
        return {
            courseSummary: shortLabel,
            courseSummaryFull: names.join(', '),
            courseCount: names.length || 1,
            courseNames: names,
        };
    }
    return {
        courseSummary: txn?.course_name || 'N/A',
        courseSummaryFull: txn?.course_name || 'N/A',
        courseCount: 1,
        courseNames: [txn?.course_name || 'N/A'],
    };
};

const getCourseSummaryFromBooking = (booking) => {
    const notesJson = parseNotesJson(booking?.notes);
    const list = Array.isArray(notesJson?.courseList) ? notesJson.courseList.filter(Boolean) : [];
    if (list.length > 0) {
        const labels = [...new Set(list.map((item) => toCompactCourseLabel(item)).filter(Boolean))];
        return {
            courseSummary: labels.join(', '),
            courseCount: labels.length,
        };
    }

    return {
        courseSummary: booking?.course_name || 'N/A',
        courseCount: 1,
    };
};

const isRecordedPaymentStatus = (status) => {
    const value = String(status || '').toLowerCase();
    return value === 'success' || value === 'paid' || value === 'collectable';
};

const isCompletedPaymentStatus = (status) => {
    const value = String(status || '').toLowerCase();
    return value === 'success' || value === 'paid';
};

const getEffectiveBalanceDue = (booking = {}) => {
    const rawDue = Number(parseFloat(booking?.balance_due || 0).toFixed(2));
    if (rawDue > 0) return rawDue;

    const paid = Number(parseFloat(booking?.total_amount || 0).toFixed(2));
    const listedCoursePrice = Number(parseFloat(booking?.course_price || 0).toFixed(2));
    const isDownpayment = String(booking?.payment_type || '').toLowerCase().includes('down');

    const assessed = isDownpayment
        ? Math.max(listedCoursePrice, paid * 2, paid)
        : Math.max(listedCoursePrice, paid);

    return Math.max(0, Number((assessed - paid).toFixed(2)));
};

const toCompactCourseLabel = (item = {}) => {
    const source = `${item?.name || ''} ${item?.type || ''} ${item?.category || ''}`.toUpperCase();
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

        let transmission = '';
        if (source.includes('MANUAL')) transmission = 'Manual';
        else if (source.includes('AUTOMATIC')) transmission = 'Automatic';

        return ['PDC', vehicle, transmission].filter(Boolean).join(' ');
    }

    return item?.name || 'Course';
};

const computeReceiptBreakdown = (txn, coursesList = []) => {
    const notesJson = parseNotesJson(txn?.notes || '');
    const courseList = Array.isArray(notesJson?.courseList) && notesJson.courseList.length > 0
        ? notesJson.courseList
        : [{ name: txn?.courseFull || txn?.course || 'Course', type: '', category: '' }];

    const byName = new Map((coursesList || []).map((c) => [String(c?.name || '').trim().toLowerCase(), Number(c?.price || 0)]));
    const courseLines = courseList.map((item) => ({
        label: toCompactCourseLabel(item),
        amount: byName.get(String(item?.name || '').trim().toLowerCase()) || 0,
        rawName: item?.name || 'Course',
    }));

    const courseSubtotal = courseLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
    const hasReviewer = Boolean(notesJson?.hasReviewer);
    const hasVehicleTips = Boolean(notesJson?.hasVehicleTips);
    const reviewerEach = 30;
    const vehicleTipsEach = 20;
    const convenienceEach = 25;
    const promoPct = 3;

    const hasBundle = courseList.some((c) => String(c?.category || c?.name || '').toLowerCase().includes('tdc'))
        && courseList.some((c) => String(c?.category || c?.name || '').toLowerCase().includes('pdc'));

    const paidAmount = Number(txn?.rawAmount || 0);
    const isDownpayment = String(txn?.paymentType || '').toLowerCase().includes('down');
    const assessedTarget = isDownpayment ? paidAmount * 2 : paidAmount;
    const promoFactor = hasBundle ? (1 - (promoPct / 100)) : 1;
    const targetBaseBeforePromo = promoFactor > 0 ? (assessedTarget / promoFactor) : assessedTarget;

    const addonUnit = (hasReviewer ? reviewerEach : 0) + (hasVehicleTips ? vehicleTipsEach : 0);
    const convenienceCandidates = [
        convenienceEach * Math.max(1, courseList.length),
        convenienceEach,
    ];

    let addonMultiplier = (hasReviewer || hasVehicleTips) ? 1 : 0;
    let convenienceFee = convenienceEach;
    if (addonUnit > 0 && targetBaseBeforePromo > 0) {
        const best = convenienceCandidates
            .map((candidate) => {
                const rawMultiplier = (targetBaseBeforePromo - courseSubtotal - candidate) / addonUnit;
                const rounded = Math.max(0, Math.round(rawMultiplier));
                const rebuilt = courseSubtotal + candidate + (rounded * addonUnit);
                return { candidate, rounded, error: Math.abs(rebuilt - targetBaseBeforePromo) };
            })
            .sort((a, b) => a.error - b.error)[0];
        addonMultiplier = Number(best?.rounded ?? addonMultiplier);
        convenienceFee = Number(best?.candidate ?? convenienceFee);
    }

    const reviewerTotal = hasReviewer ? reviewerEach * addonMultiplier : 0;
    const vehicleTipsTotal = hasVehicleTips ? vehicleTipsEach * addonMultiplier : 0;
    const addonLines = [
        ...(reviewerTotal > 0 ? [{ name: `LTO Exam Reviewer${addonMultiplier > 1 ? ` x${addonMultiplier}` : ''}`, price: reviewerTotal }] : []),
        ...(vehicleTipsTotal > 0 ? [{ name: `Vehicle Maintenance Tips${addonMultiplier > 1 ? ` x${addonMultiplier}` : ''}`, price: vehicleTipsTotal }] : []),
    ];

    const subtotal = courseSubtotal + reviewerTotal + vehicleTipsTotal;
    const promoDiscount = hasBundle ? Number((((subtotal + convenienceFee) * promoPct) / 100).toFixed(2)) : 0;
    const netTotal = Number((subtotal + convenienceFee - promoDiscount).toFixed(2));
    const remainingBalance = String(txn?.status || '').toLowerCase() === 'collectable'
        ? Math.max(0, Number((netTotal - paidAmount).toFixed(2)))
        : 0;

    return {
        courseLines,
        addonLines,
        subtotal,
        convenienceFee,
        promoDiscount,
        netTotal,
        remainingBalance,
    };
};

const SalePayment = () => {
    const [period, setPeriod] = useState('All Time');
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [courseFilter, setCourseFilter] = useState('All');
    const [dateFilter, setDateFilter] = useState('All Time');
    const [customDays, setCustomDays] = useState(15);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [coursesList, setCoursesList] = useState([]);
    const [branchFilter, setBranchFilter] = useState('All');
    const [branchesList, setBranchesList] = useState([]);

    const [transactions, setTransactions] = useState([]);
    const [allHistory, setAllHistory] = useState([]);
    const [unpaidBookings, setUnpaidBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [financialStats, setFinancialStats] = useState({
        revenue: 0,
        completed: 0,
        collectable: 0,
        refunds: 0
    });

    // Action Modal States
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [updateLoading, setUpdateLoading] = useState(false);

    // Mark as Paid Modal States
    const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
    const [markPaidBooking, setMarkPaidBooking] = useState(null);
    const [markPaidMethod, setMarkPaidMethod] = useState('Cash');
    const [markPaidTxnId, setMarkPaidTxnId] = useState('');
    const [markPaidAmount, setMarkPaidAmount] = useState('');
    const [markPaidLoading, setMarkPaidLoading] = useState(false);

    // Email receipt state
    const [sendingReceiptId, setSendingReceiptId] = useState(null);
    const [receiptToast, setReceiptToast] = useState(null); // { msg, type }

    // Auth / role state
    const [userRole, setUserRole] = useState(null);
    const [userBranchId, setUserBranchId] = useState(null);

    // Pagination states
    const SP_PAGE_SIZE = 10;
    const [recentPage, setRecentPage] = useState(1);
    const [unpaidPage, setUnpaidPage] = useState(1);
    const [historyPage, setHistoryPage] = useState(1);

    const fetchTransactions = async () => {
        try {
            setLoading(true);
            const [response, bookingsResponse] = await Promise.all([
                adminAPI.getAllTransactions(100),
                adminAPI.getAllBookings(null, 300),
            ]);
            let calculatedStats = { revenue: 0, completed: 0, collectable: 0, refunds: 0 };
            const bookingsById = new Map(
                (bookingsResponse?.success ? (bookingsResponse.bookings || []) : [])
                    .map((b) => [Number(b.id), b])
            );

            if (response.success) {
                const mappedTransactions = (response.transactions || []).map(t => {
                    const linkedBooking = bookingsById.get(Number(t.booking_id));
                    const { courseSummary, courseSummaryFull, courseCount, courseNames } = getCourseSummaryFromTransaction(t);
                    return {
                        id: t.transaction_id || 'N/A',
                        booking_id: t.booking_id,
                        student: t.student_name || 'Unknown',
                        course: courseSummary,
                        courseFull: courseSummaryFull,
                        courseCount,
                        courseNames,
                        notes: t.notes || linkedBooking?.notes || null,
                        paymentType: t.payment_type || linkedBooking?.payment_type || 'Full Payment',
                        rawDate: t.transaction_date,
                        date: t.transaction_date ? new Date(t.transaction_date).toLocaleDateString() : 'N/A',
                        amount: `P ${parseFloat(t.amount || 0).toLocaleString()}`,
                        rawAmount: parseFloat(t.amount || 0),
                        method: t.payment_method || 'N/A',
                        status: t.status || 'Collectable',
                        branch: t.branch_name || 'Unknown',
                        searchIndex: [
                            t.transaction_id,
                            t.booking_id,
                            t.student_name,
                            courseSummary,
                            (courseNames || []).join(' '),
                            t.payment_method,
                            t.status,
                            t.branch_name,
                        ].filter(Boolean).join(' ').toLowerCase(),
                    };
                });
                setTransactions(mappedTransactions.slice(0, 5));
                setAllHistory(mappedTransactions);

                calculatedStats = (response.transactions || []).reduce((acc, t) => {
                    const amt = parseFloat(t.amount || 0) || 0;
                    const status = t.status ? t.status.toLowerCase() : '';

                    if (isRecordedPaymentStatus(status)) {
                        acc.revenue += amt;
                    }

                    if (isCompletedPaymentStatus(status)) {
                        acc.completed += 1;
                    } else if (status === 'failed' || status === 'cancelled') {
                        acc.refunds += amt;
                    }
                    // Collectable is now calculated from unpaid bookings
                    return acc;
                }, { revenue: 0, completed: 0, collectable: 0, refunds: 0 });
            }

            const unpaidResponse = await adminAPI.getUnpaidBookings(200); // Fetch more to get accurate total
            if (unpaidResponse.success) {
                const mappedUnpaid = (unpaidResponse.bookings || []).map((booking) => {
                    const linkedBooking = bookingsById.get(Number(booking.id));
                    const merged = {
                        ...booking,
                        notes: booking?.notes || linkedBooking?.notes || null,
                    };
                    const { courseSummary, courseCount } = getCourseSummaryFromBooking(merged);
                    return {
                        ...merged,
                        course_summary: courseSummary,
                        course_count: courseCount,
                    };
                });

                setUnpaidBookings(mappedUnpaid);
                const totalCollectable = mappedUnpaid.reduce((sum, booking) => sum + (parseFloat(booking.balance_due || 0) || 0), 0);
                calculatedStats.collectable = totalCollectable;
            }

            setFinancialStats(calculatedStats);

        } catch (error) {
            console.error('Error fetching transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const fetchCoursesList = async () => {
            try {
                const response = await coursesAPI.getAll();
                if (response.success && response.courses) {
                    setCoursesList(response.courses);
                }
            } catch (error) {
                console.error('Error fetching courses:', error);
            }
        };
        const fetchBranchesList = async () => {
            try {
                const response = await branchesAPI.getAll();
                if (response.success && response.branches) {
                    setBranchesList(response.branches);
                }
            } catch (error) {
                console.error('Error fetching branches:', error);
            }
        };
        const fetchProfile = async () => {
            try {
                const profileRes = await authAPI.getProfile();
                if (profileRes.success) {
                    const role = profileRes.user.role;
                    const branchId = profileRes.user.branchId;
                    setUserRole(role);
                    setUserBranchId(branchId);
                    if (role === 'staff' && branchId) {
                        // Lock branch filter to this staff member's branch
                        const branchRes = await branchesAPI.getAll();
                        if (branchRes.success && branchRes.branches) {
                            const staffBranch = branchRes.branches.find(b => String(b.id) === String(branchId));
                            if (staffBranch) {
                                setBranchesList([staffBranch]);
                                setBranchFilter(staffBranch.name);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching profile:', error);
            }
        };
        fetchCoursesList();
        fetchBranchesList();
        fetchProfile();
        fetchTransactions();
    }, []);

    const handleDeleteBooking = async (id) => {
        if (!window.confirm('Are you sure you want to delete this booking record?')) return;
        try {
            const response = await adminAPI.deleteBooking(id);
            if (response.success) {
                fetchTransactions();
            }
        } catch (error) {
            console.error('Error deleting booking:', error);
            alert('Failed to delete booking');
        }
    };

    const handleUpdateBooking = async (e) => {
        e.preventDefault();
        setUpdateLoading(true);
        try {
            const response = await adminAPI.updateBookingStatus(selectedBooking.id, selectedBooking.status.toLowerCase());
            if (response.success) {
                setShowEditModal(false);
                fetchTransactions();
            }
        } catch (error) {
            console.error('Error updating booking:', error);
            alert('Failed to update booking');
        } finally {
            setUpdateLoading(false);
        }
    };

    const openMarkPaidModal = (booking) => {
        const remaining = getEffectiveBalanceDue(booking);
        setMarkPaidBooking(booking);
        setMarkPaidMethod(booking.payment_method || 'Cash');
        setMarkPaidTxnId('');
        setMarkPaidAmount(remaining > 0 ? String(remaining) : '0');
        setShowMarkPaidModal(true);
    };

    const handleMarkAsPaid = async () => {
        if (!markPaidBooking) return;
        const remaining = getEffectiveBalanceDue(markPaidBooking);
        const inputAmount = Number(markPaidAmount);
        const collectAmount = Number.isFinite(inputAmount) && inputAmount > 0
            ? Math.min(inputAmount, remaining)
            : 0;

        if (collectAmount <= 0 && remaining > 0) {
            alert('Please enter a valid amount to collect.');
            return;
        }

        if (markPaidMethod === 'Metrobank' && !String(markPaidTxnId || '').trim()) {
            alert('Transaction ID is required for Metrobank payments.');
            return;
        }

        setMarkPaidLoading(true);
        try {
            const response = await adminAPI.markAsPaid(
                markPaidBooking.id,
                markPaidMethod,
                markPaidMethod === 'Metrobank' ? String(markPaidTxnId || '').trim() : null,
                collectAmount
            );
            if (response.success) {
                setShowMarkPaidModal(false);
                setMarkPaidBooking(null);
                setMarkPaidTxnId('');
                setMarkPaidAmount('');
                fetchTransactions();
                setReceiptToast({ msg: 'Payment saved successfully.', type: 'success' });
                setTimeout(() => setReceiptToast(null), 4000);
            } else {
                alert(response.error || 'Failed to mark as paid');
            }
        } catch (error) {
            console.error('Error marking as paid:', error);
            alert('Failed to mark booking as paid');
        } finally {
            setMarkPaidLoading(false);
        }
    };

    const handleSendReceipt = async (bookingId) => {
        setSendingReceiptId(bookingId);
        try {
            const response = await adminAPI.sendReceipt(bookingId);
            if (response.success) {
                setReceiptToast({ msg: response.message || 'Receipt sent to student\'s email!', type: 'success' });
            } else {
                setReceiptToast({ msg: response.error || 'Failed to send receipt', type: 'error' });
            }
        } catch (error) {
            setReceiptToast({ msg: 'Failed to send receipt email', type: 'error' });
        } finally {
            setSendingReceiptId(null);
            setTimeout(() => setReceiptToast(null), 4000);
        }
    };

    // ── Period filter helper ─────────────────────────────────────────────────
    const applyPeriodFilter = (list, dateKey = 'rawDate') => {
        if (period === 'All Time') return list;
        const now = new Date(); now.setHours(23, 59, 59, 999);
        return list.filter(t => {
            const raw = t[dateKey];
            if (!raw) return false;
            const d = new Date(raw);
            if (period === 'Today') {
                const s = new Date(); s.setHours(0, 0, 0, 0);
                return d >= s && d <= now;
            } else if (period === 'This Week') {
                const s = new Date(); s.setDate(now.getDate() - now.getDay()); s.setHours(0, 0, 0, 0);
                return d >= s && d <= now;
            } else if (period === 'This Month') {
                const s = new Date(now.getFullYear(), now.getMonth(), 1);
                return d >= s && d <= now;
            } else if (period === 'This Year') {
                const s = new Date(now.getFullYear(), 0, 1);
                return d >= s && d <= now;
            }
            return true;
        });
    };

    // ── Branch-filtered base ────────────────────────────────────────────────
    const branchFilteredHistory = branchFilter === 'All'
        ? allHistory
        : allHistory.filter(t => t.branch && t.branch.toLowerCase() === branchFilter.toLowerCase());

    // ── Branch + Period combined base (drives entire page) ───────────────────
    const pageFilteredHistory = applyPeriodFilter(branchFilteredHistory);

    // ── Branch + Period filtered unpaid bookings ─────────────────────────────
    const branchFilteredUnpaid = (() => {
        let list = unpaidBookings;
        if (branchFilter !== 'All') {
            const branch = branchesList.find(br => br.name.toLowerCase() === branchFilter.toLowerCase());
            if (branch) list = list.filter(b => b.branch_id === branch.id);
        }
        return applyPeriodFilter(list, 'booking_date');
    })();

    // ── Stats cards (react to branch + period filters) ───────────────────────
    const branchStats = pageFilteredHistory.reduce((acc, t) => {
        const status = (t.status || '').toLowerCase();
        if (isRecordedPaymentStatus(status)) {
            acc.revenue += t.rawAmount || 0;
        }

        if (isCompletedPaymentStatus(status)) {
            acc.completed += 1;
        } else if (status === 'failed' || status === 'cancelled') {
            acc.refunds += t.rawAmount || 0;
        }
        return acc;
    }, { revenue: 0, completed: 0, refunds: 0 });

    const branchCollectable = branchFilteredUnpaid.reduce((sum, b) => sum + getEffectiveBalanceDue(b), 0);
    const collectableFromHistory = new Set(
        pageFilteredHistory
            .filter((t) => String(t.status || '').toLowerCase() === 'collectable')
            .map((t) => String(t.booking_id || ''))
            .filter(Boolean)
    ).size;
    const branchCollectableCount = Math.max(branchFilteredUnpaid.length, collectableFromHistory);

    const stats = [
        { label: 'Gross Revenue', value: `P ${branchStats.revenue.toLocaleString()}`, trend: '0%', color: 'blue' },
        { label: 'Completed Payments', value: branchStats.completed.toString(), trend: '0%', color: 'green' },
        { label: 'Collectable', value: branchCollectableCount.toString(), trend: `P ${branchCollectable.toLocaleString()}`, color: 'orange' },
        { label: 'Refunds / Cancelled', value: `P ${branchStats.refunds.toLocaleString()}`, trend: '0%', color: 'red' },
    ];

    // Chart data — derived from branch + period filtered history
    const paymentMethods = [
        { name: 'StarPay', value: 0, color: '#2157da' },
        { name: 'Cash',    value: 0, color: '#64748b' },
    ];

    const totalPayments = pageFilteredHistory.filter(t => isCompletedPaymentStatus(t.status)).length;
    if (totalPayments > 0) {
        pageFilteredHistory.forEach(t => {
            if (!isCompletedPaymentStatus(t.status)) return;
            const method = (t.method || '').trim();
            const found = paymentMethods.find(pm => pm.name.toLowerCase() === method.toLowerCase());
            if (found) found.value += 1;
        });
        paymentMethods.forEach(pm => {
            pm.value = Math.round((pm.value / totalPayments) * 100);
        });
    }

    let chartData = [];
    let chartLabel = "Weekly Comparison";

    if (period === 'Today') {
        chartLabel = "Hourly Breakdown";
        chartData = [
            { name: '12AM-6AM', amount: 0 },
            { name: '6AM-12PM', amount: 0 },
            { name: '12PM-6PM', amount: 0 },
            { name: '6PM-12AM', amount: 0 }
        ];
        pageFilteredHistory.forEach(t => {
            if (!isRecordedPaymentStatus(t.status) || !t.rawDate) return;
            const hr = new Date(t.rawDate).getHours();
            const amt = t.rawAmount || 0;
            if (hr < 6) chartData[0].amount += amt;
            else if (hr < 12) chartData[1].amount += amt;
            else if (hr < 18) chartData[2].amount += amt;
            else chartData[3].amount += amt;
        });
    } else if (period === 'This Week') {
        chartLabel = "Daily Comparison";
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        chartData = days.map(d => ({ name: d, amount: 0 }));
        pageFilteredHistory.forEach(t => {
            if (!isRecordedPaymentStatus(t.status) || !t.rawDate) return;
            const dayIdx = new Date(t.rawDate).getDay();
            chartData[dayIdx].amount += (t.rawAmount || 0);
        });
    } else if (period === 'This Year' || period === 'All Time') {
        chartLabel = period === 'This Year' ? "Monthly Comparison" : "Overall Comparison";
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        chartData = months.map(m => ({ name: m, amount: 0 }));
        pageFilteredHistory.forEach(t => {
            if (!isRecordedPaymentStatus(t.status) || !t.rawDate) return;
            const monthIdx = new Date(t.rawDate).getMonth();
            chartData[monthIdx].amount += (t.rawAmount || 0);
        });
    } else {
        // 'This Month'
        chartLabel = "Weekly Comparison";
        chartData = [
            { name: 'Week 1', amount: 0 },
            { name: 'Week 2', amount: 0 },
            { name: 'Week 3', amount: 0 },
            { name: 'Week 4', amount: 0 },
        ];
        pageFilteredHistory.forEach(t => {
            if (!isRecordedPaymentStatus(t.status) || !t.rawDate) return;
            const amt = t.rawAmount || 0;
            const day = new Date(t.rawDate).getDate();
            if (day <= 7) chartData[0].amount += amt;
            else if (day <= 14) chartData[1].amount += amt;
            else if (day <= 21) chartData[2].amount += amt;
            else chartData[3].amount += amt;
        });
    }

    // Recent transactions (branch + period filtered, paginated)
    const recentBase = pageFilteredHistory;
    useEffect(() => { setRecentPage(1); }, [period, branchFilter]);
    const recentTotalPages = Math.ceil(recentBase.length / SP_PAGE_SIZE);
    const recentTransactions = recentBase.slice((recentPage - 1) * SP_PAGE_SIZE, recentPage * SP_PAGE_SIZE);

    const filteredHistory = pageFilteredHistory.filter(t => {
        const searchTermLower = (searchTerm || '').toLowerCase();
        const matchesSearch = !searchTermLower || (t.searchIndex || '').includes(searchTermLower);
        const matchesStatus = statusFilter === 'All' || t.status === statusFilter;

        let matchesCourse = true;
        if (courseFilter !== 'All') {
            matchesCourse = (t.course || '').toLowerCase().includes(courseFilter.toLowerCase()) ||
                (Array.isArray(t.courseNames) && t.courseNames.some((name) => (name || '').toLowerCase().includes(courseFilter.toLowerCase())));
        }

        let matchesPeriod = true;
        if (dateFilter !== 'All Time' && t.rawDate) {
            const tDate = new Date(t.rawDate);
            const now = new Date();
            now.setHours(23, 59, 59, 999);
            if (dateFilter === 'Today') {
                const start = new Date(); start.setHours(0, 0, 0, 0);
                matchesPeriod = tDate >= start && tDate <= now;
            } else if (dateFilter === 'This Week') {
                const start = new Date(); start.setDate(now.getDate() - now.getDay()); start.setHours(0, 0, 0, 0);
                matchesPeriod = tDate >= start && tDate <= now;
            } else if (dateFilter === 'This Month') {
                const start = new Date(now.getFullYear(), now.getMonth(), 1);
                matchesPeriod = tDate >= start && tDate <= now;
            } else if (dateFilter === 'This Year') {
                const start = new Date(now.getFullYear(), 0, 1);
                matchesPeriod = tDate >= start && tDate <= now;
            } else if (dateFilter === 'Past X Days') {
                const days = parseInt(customDays, 10) || 15;
                const start = new Date(); start.setDate(now.getDate() - days + 1); start.setHours(0, 0, 0, 0);
                matchesPeriod = tDate >= start && tDate <= now;
            } else if (dateFilter === 'Custom Range') {
                const from = dateFrom ? new Date(dateFrom + 'T00:00:00') : null;
                const to = dateTo ? new Date(dateTo + 'T23:59:59') : null;
                if (from) matchesPeriod = tDate >= from;
                if (to) matchesPeriod = matchesPeriod && tDate <= to;
            }
        }

        return matchesSearch && matchesStatus && matchesCourse && matchesPeriod;
    });

    const filteredTotalSales = filteredHistory.reduce((sum, t) => {
        if (isRecordedPaymentStatus(t.status)) {
            return sum + (t.rawAmount || 0);
        }
        return sum;
    }, 0);

    // Reset history + unpaid page on filter changes
    useEffect(() => { setHistoryPage(1); }, [searchTerm, statusFilter, courseFilter, dateFilter, dateFrom, dateTo, customDays, branchFilter, period]);
    useEffect(() => { setUnpaidPage(1); }, [branchFilter, period]);

    const historyTotalPages = Math.ceil(filteredHistory.length / SP_PAGE_SIZE);
    const pagedHistory = filteredHistory.slice((historyPage - 1) * SP_PAGE_SIZE, historyPage * SP_PAGE_SIZE);

    const unpaidTotalPages = Math.ceil(branchFilteredUnpaid.length / SP_PAGE_SIZE);
    const pagedUnpaid = branchFilteredUnpaid.slice((unpaidPage - 1) * SP_PAGE_SIZE, unpaidPage * SP_PAGE_SIZE);

    const handlePrint = (data = transactions, title = "RECENT TRANSACTIONS") => {
        const printWindow = window.open('', '_blank');
        const timestamp = new Date().toLocaleString();
        const isUsers = title.includes('USERS');
        const totalAmount = isUsers
            ? data.reduce((sum, t) => sum + getEffectiveBalanceDue(t), 0)
            : data.reduce((sum, t) => {
                const raw = (t.amount || '').toString().replace(/[^0-9.]/g, '');
                return sum + (parseFloat(raw) || 0);
              }, 0);

        const html = `
            <html>
            <head>
                <title>Master Driving School - ${title}</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #334155; }
                    .header { border-bottom: 2px solid #1a4fba; padding-bottom: 20px; margin-bottom: 20px; display: flex; align-items: center; gap: 20px; }
                    .header img { width: 70px; height: 70px; object-fit: cover; border-radius: 12px; }
                    .header-text { text-align: left; }
                    .header h1 { color: #1a4fba; margin: 0; font-size: 22pt; line-height: 1.2; }
                    .header p { color: #64748b; margin: 2px 0; font-size: 10pt; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th { background: #f8fafc; color: #1a4fba; font-weight: bold; border-bottom: 2px solid #e2e8f0; }
                    th, td { padding: 12px; text-align: center; border: 1px solid #f1f5f9; }
                    .amount { font-weight: bold; }
                    .status-success { color: #16a34a; font-weight: bold; }
                    .status-collectable { color: #ea580c; font-weight: bold; }
                    .total-row td { background: #f0f6ff; font-weight: bold; color: #1a4fba; border-top: 2px solid #1a4fba; font-size: 11pt; }
                    .footer { margin-top: 30px; font-size: 10pt; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px; text-align: center; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <img src="${logo}" alt="Logo">
                    <div class="header-text">
                        <h1>MASTER DRIVING SCHOOL</h1>
                        <p>${title}</p>
                        <p>Generated on: ${timestamp}</p>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            ${isUsers ? `
                                <th>BOOKING ID</th>
                                <th>STUDENT NAME</th>
                                <th>COURSE</th>
                                <th>AMOUNT DUE</th>
                                <th>STATUS</th>
                                <th>CONTACT</th>
                            ` : `
                                <th>TXN ID</th>
                                <th>STUDENT NAME</th>
                                <th>COURSE</th>
                                <th>DATE</th>
                                <th>METHOD</th>
                                <th>AMOUNT</th>
                                <th>STATUS</th>
                            `}
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(t => isUsers ? `
                            <tr>
                                <td>BK-${t.id}</td>
                                <td>${t.student_name}</td>
                                <td>${t.course_summary || t.course_name}</td>
                                <td class="amount">P ${getEffectiveBalanceDue(t).toLocaleString()}</td>
                                <td class="status-collectable">${t.status.toUpperCase()}</td>
                                <td>${t.student_contact || 'N/A'}</td>
                            </tr>
                        ` : `
                            <tr>
                                <td>${t.id}</td>
                                <td>${t.student}</td>
                                <td title="${t.courseFull || t.course}">${t.course}</td>
                                <td>${t.date}</td>
                                <td>${t.method}</td>
                                <td class="amount">${t.amount}</td>
                                <td class="${t.status.toLowerCase() === 'success' ? 'status-success' : 'status-collectable'}">${t.status.toUpperCase()}</td>
                            </tr>
                        `).join('')}
                        <tr class="total-row">
                            ${isUsers
                                ? `<td colspan="3" style="text-align:right;">TOTAL AMOUNT DUE</td><td>P ${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td><td colspan="2"></td>`
                                : `<td colspan="5" style="text-align:right;">TOTAL AMOUNT</td><td>P ${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td><td></td>`
                            }
                        </tr>
                    </tbody>
                </table>
                <div class="footer">
                    Total Transactions: ${data.length} | Master Driving School Management System
                </div>
                <script>
                    window.onload = () => { window.print(); window.close(); }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    const handlePrintReceipt = (txn) => {
        const printWindow = window.open('', '_blank');
        const timestamp = new Date().toLocaleString();
        const breakdown = computeReceiptBreakdown(txn, coursesList);
        const isCollectable = String(txn?.status || '').toLowerCase() === 'collectable';
        const unpaidRef = unpaidBookings.find((b) => Number(b.id) === Number(txn?.booking_id));
        const remainingBalanceValue = isCollectable
            ? (Number(unpaidRef?.balance_due || 0) > 0 ? Number(unpaidRef.balance_due) : breakdown.remainingBalance)
            : 0;
        const toPeso = (v) => `P ${Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        const html = `
            <html>
            <head>
                <title>OFFICIAL RECEIPT - ${txn.id}</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #1e293b; max-width: 500px; margin: 0 auto; border: 1px dashed #cbd5e1; }
                    .header { border-bottom: 2px solid #1a4fba; padding-bottom: 15px; margin-bottom: 20px; display: flex; align-items: center; gap: 15px; }
                    .header img { width: 55px; height: 55px; border-radius: 8px; }
                    .header-text { text-align: left; }
                    .header h1 { font-size: 16pt; color: #1a4fba; margin: 0; line-height: 1.2; }
                    .header p { font-size: 8pt; color: #64748b; margin: 1px 0; }
                    .receipt-title { text-align: center; font-weight: bold; font-size: 14pt; margin: 15px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
                    .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 10pt; }
                    .info-label { color: #64748b; }
                    .info-value { font-weight: 600; color: #1e293b; }
                    .amount-box { background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; border: 1px solid #e2e8f0; }
                    .amount-label { font-size: 9pt; color: #64748b; margin-bottom: 5px; }
                    .amount-value { font-size: 20pt; font-weight: 800; color: #1a4fba; }
                    .status-tag { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 9pt; font-weight: bold; text-transform: uppercase; }
                    .status-success { background: #dcfce7; color: #16a34a; }
                    .status-collectable { background: #ffedd5; color: #ea580c; }
                    .breakdown { margin-top: 18px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
                    .breakdown-head { background: #f8fafc; color: #64748b; text-align: center; padding: 8px; font-size: 9pt; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
                    .line { display: flex; justify-content: space-between; gap: 12px; padding: 8px 12px; font-size: 10pt; border-top: 1px dashed #e2e8f0; }
                    .line:first-of-type { border-top: none; }
                    .line-strong { font-weight: 700; }
                    .line-discount { color: #dc2626; background: #fef2f2; }
                    .line-total { font-weight: 800; font-size: 11pt; }
                    .line-remaining { color: #ea580c; font-weight: 800; }
                    .footer { text-align: center; margin-top: 30px; font-size: 8pt; color: #94a3b8; line-height: 1.4; }
                    @media print { body { border: none; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <img src="${logo}" alt="Logo">
                    <div class="header-text">
                        <h1>MASTER DRIVING SCHOOL</h1>
                        <p>Building Champions on the Road</p>
                        <p>Official Billing Document</p>
                    </div>
                </div>
                <div class="receipt-title">OFFICIAL RECEIPT</div>
                <div class="info-row">
                    <span class="info-label">Transaction ID:</span>
                    <span class="info-value">${txn.id}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Booking ID:</span>
                    <span class="info-value">BK-${String(txn.booking_id || '').padStart(3, '0')}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Student Name:</span>
                    <span class="info-value">${txn.student}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Date:</span>
                    <span class="info-value">${txn.date}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Payment Method:</span>
                    <span class="info-value">${txn.method}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Status:</span>
                    <span class="status-tag ${txn.status.toLowerCase() === 'success' ? 'status-success' : 'status-collectable'}">${txn.status}</span>
                </div>
                <div class="breakdown">
                    <div class="breakdown-head">Payment Breakdown</div>
                    <div class="breakdown-head" style="background:#fff;">Courses & Training</div>
                    ${breakdown.courseLines.map((line) => `
                        <div class="line"><span>${line.label}</span><span class="line-strong">${toPeso(line.amount)}</span></div>
                    `).join('')}
                    <div class="breakdown-head" style="background:#fff;">Custom Add-ons</div>
                    ${breakdown.addonLines.length > 0
                        ? breakdown.addonLines.map((line) => `
                            <div class="line"><span>+ ${line.name}</span><span class="line-strong">${toPeso(line.price)}</span></div>
                        `).join('')
                        : `<div class="line"><span>No add-ons</span><span>${toPeso(0)}</span></div>`
                    }
                    <div class="breakdown-head" style="background:#fff;">Summary</div>
                    <div class="line"><span>Subtotal</span><span class="line-strong">${toPeso(breakdown.subtotal)}</span></div>
                    <div class="line"><span>Convenience Fee</span><span class="line-strong">${toPeso(breakdown.convenienceFee)}</span></div>
                    ${breakdown.promoDiscount > 0
                        ? `<div class="line line-discount"><span>Promo Discount (3%)</span><span class="line-strong">-${toPeso(breakdown.promoDiscount).replace('P ', '')}</span></div>`
                        : ''
                    }
                    <div class="line line-total"><span>Net Total</span><span>${toPeso(breakdown.netTotal)}</span></div>
                    ${isCollectable
                        ? `<div class="line line-remaining"><span>Remaining Balance</span><span>${toPeso(remainingBalanceValue)}</span></div>`
                        : ''
                    }
                </div>

                <div class="amount-box">
                    <div class="amount-label">TOTAL AMOUNT PAID</div>
                    <div class="amount-value">${txn.amount}</div>
                </div>
                <div class="footer">
                    Thank you for choosing Master Driving School!<br>
                    Keep this receipt for your enrollment records.<br>
                    Generated on ${timestamp}
                </div>
                <script>window.onload = () => { window.print(); window.close(); }</script>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    const handleExport = (data = transactions, title = "SALES REPORT") => {
        const timestamp = new Date().toLocaleString();
        const isUsers = title.includes('USERS');
        const totalAmount = isUsers
            ? data.reduce((sum, t) => sum + getEffectiveBalanceDue(t), 0)
            : data.reduce((sum, t) => {
                const raw = (t.amount || '').toString().replace(/[^0-9.]/g, '');
                return sum + (parseFloat(raw) || 0);
              }, 0);
        const colCount = isUsers ? 6 : 7;

        const tableHtml = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="utf-8">
                <style>
                    body { background-color: #ffffff; margin: 0; padding: 0; }
                    table { border-collapse: collapse; width: 100%; font-family: 'Segoe UI', Arial, sans-serif; background-color: #ffffff; }
                    .title { font-size: 20pt; font-weight: bold; color: #1a4fba; padding: 15px 5px; text-align: left; }
                    .meta { font-size: 11pt; color: #64748b; padding-bottom: 25px; text-align: left; }
                    .column-header th { background-color: #1a4fba !important; color: #ffffff !important; padding: 12px 10px; font-weight: bold; border: 1px solid #cbd5e1; text-align: center; }
                    .row td { padding: 10px; border: 1px solid #e2e8f0; color: #334155; background-color: #ffffff; text-align: center; }
                    .total-row td { background-color: #f0f6ff !important; font-weight: bold; color: #1a4fba; border-top: 2px solid #1a4fba; text-align: center; padding: 10px; }
                    .status-success { color: #16a34a; font-weight: bold; }
                    .status-collectable { color: #ea580c; font-weight: bold; }
                </style>
            </head>
            <body>
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="${logo}" style="width: 80px; height: 80px; border-radius: 12px; margin-bottom: 10px;">
                </div>
                <table>
                    <tr><td colspan="${colCount}" class="title">MASTER DRIVING SCHOOL - ${title}</td></tr>
                    <tr><td colspan="${colCount}" class="meta">Period: ${period} | Generated on: ${timestamp}</td></tr>
                    <tr><td colspan="${colCount}" style="height: 10px; background-color: #ffffff;"></td></tr>
                    <tr class="column-header">
                        ${isUsers ? `
                            <th>BOOKING ID</th>
                            <th>STUDENT NAME</th>
                            <th>COURSE</th>
                            <th>AMOUNT DUE</th>
                            <th>STATUS</th>
                            <th>CONTACT</th>
                        ` : `
                            <th>TRANSACTION ID</th>
                            <th>STUDENT NAME</th>
                            <th>COURSE</th>
                            <th>DATE</th>
                            <th>METHOD</th>
                            <th>AMOUNT</th>
                            <th>STATUS</th>
                        `}
                    </tr>
                    ${data.map(t => isUsers ? `
                        <tr class="row">
                            <td>BK-${t.id}</td>
                            <td>${t.student_name}</td>
                            <td>${t.course_summary || t.course_name}</td>
                            <td>P ${getEffectiveBalanceDue(t).toLocaleString()}</td>
                            <td>${t.status}</td>
                            <td>${t.student_contact || 'N/A'}</td>
                        </tr>
                    ` : `
                        <tr class="row">
                            <td>${t.id}</td>
                            <td>${t.student}</td>
                                <td title="${t.courseFull || t.course}">${t.course}</td>
                            <td>${t.date}</td>
                            <td>${t.method}</td>
                            <td>${t.amount}</td>
                            <td>${t.status}</td>
                        </tr>
                    `).join('')}
                    <tr class="total-row">
                        ${isUsers
                            ? `<td colspan="3" style="text-align:right;">TOTAL AMOUNT DUE</td><td>P ${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td><td colspan="2"></td>`
                            : `<td colspan="5" style="text-align:right;">TOTAL AMOUNT</td><td>P ${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td><td></td>`
                        }
                    </tr>
                    <tr><td colspan="${colCount}" style="height: 15px; background-color: #ffffff;"></td></tr>
                    <tr><td colspan="${colCount}" style="height: 20px; border-top: 2px solid #1a4fba; padding-top: 10px; font-size: 10pt; color: #94a3b8; text-align: center;">--- Confidential Financial Document ---</td></tr>
                </table>
            </body>
            </html>
        `;

        const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `MasterSchool_Sales_${new Date().toISOString().slice(0, 10)}.xls`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div className="sale-module">
            {/* Toast notification */}
            {receiptToast && (
                <div style={{
                    position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
                    background: receiptToast.type === 'success' ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${receiptToast.type === 'success' ? '#86efac' : '#fca5a5'}`,
                    color: receiptToast.type === 'success' ? '#15803d' : '#b91c1c',
                    padding: '12px 20px', borderRadius: '12px', fontWeight: 600,
                    fontSize: '14px', boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                    display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '360px',
                }}>
                    {receiptToast.type === 'success'
                        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                    }
                    {receiptToast.msg}
                </div>
            )}
            <div className="sale-header-section">
                <div className="sale-header">
                    <div className="header-left">
                        <div>
                            <h2>Sales &amp; Financials</h2>
                            <p>Financial overview and transaction history</p>
                        </div>
                    </div>
                    <div className="header-right">
                        <button
                            onClick={fetchTransactions}
                            disabled={loading}
                            className="refresh-btn"
                            title="Refresh transaction data"
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <polyline points="23 4 23 10 17 10" />
                                <polyline points="1 20 1 14 7 14" />
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                            </svg>
                            {loading ? 'Refreshing…' : 'Refresh'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Branch + Period Filter Bar — same style as Schedule page */}
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
                            {(() => {
                                if (branchFilter === 'All') return 'All Branches';
                                let formattedName = branchFilter;
                                const prefixes = ['Master Driving School ', 'Master Prime Driving School ', 'Masters Prime Holdings Corp. ', 'Master Prime Holdings Corp. '];
                                for (const prefix of prefixes) {
                                    if (formattedName.startsWith(prefix)) {
                                        formattedName = formattedName.substring(prefix.length);
                                        break;
                                    }
                                }
                                return formattedName;
                            })()}
                        </span>
                    </div>
                </div>
                <div className="branch-filter-right">
                    {userRole !== 'staff' && (
                        <>
                            <span className="branch-filter-count">{branchesList.length} Branches</span>
                            <select
                                className="branch-filter-select"
                                value={branchFilter}
                                onChange={(e) => setBranchFilter(e.target.value)}
                            >
                                <option value="All">All Branches</option>
                                {branchesList.map(b => {
                                    let formattedName = b.name;
                                    const prefixes = ['Master Driving School ', 'Master Prime Driving School ', 'Masters Prime Holdings Corp. ', 'Master Prime Holdings Corp. '];
                                    for (const prefix of prefixes) {
                                        if (formattedName.startsWith(prefix)) {
                                            formattedName = formattedName.substring(prefix.length);
                                            break;
                                        }
                                    }
                                    return <option key={b.id} value={b.name}>{formattedName}</option>;
                                })}
                            </select>
                        </>
                    )}
                    <select
                        className="branch-filter-select"
                        style={{ minWidth: '140px' }}
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                    >
                        <option>All Time</option>
                        <option>Today</option>
                        <option>This Week</option>
                        <option>This Month</option>
                        <option>This Year</option>
                    </select>
                </div>
            </div>


            <div className="revenue-stats-grid">
                {stats.map((stat, idx) => (
                    <div key={idx} className={`rev-stat-card ${stat.color}`}>
                        <div className="rev-info">
                            <span className="label">{stat.label}</span>
                            <div className="value-group">
                                <h3>{stat.value}</h3>
                                <span className={`trend ${stat.trend.startsWith('+') ? 'up' : 'down'}`}>
                                    {stat.trend}
                                </span>
                            </div>
                        </div>
                        <div className="rev-icon">
                            {/* Simple dynamic circle decoration */}
                            <div className="decoration-circle"></div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="sale-charts-row">
                <div className="main-sale-chart">
                    <div className="chart-card">
                        <div className="card-header">
                            <h3>Revenue Overview</h3>
                            <span>{chartLabel}</span>
                        </div>
                        <div className="chart-body">
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                                        contentStyle={{ borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-color)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)' }}
                                        labelStyle={{ color: 'var(--text-color)', fontWeight: 700 }}
                                        itemStyle={{ color: '#1a4fba' }}
                                    />
                                    <Bar dataKey="amount" fill="#1a4fba" radius={[6, 6, 0, 0]} barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="payment-method-chart">
                    <div className="chart-card">
                        <div className="card-header">
                            <h3>Payment Methods</h3>
                            <span>By Usage (%)</span>
                        </div>
                        <div className="chart-body pie-container">
                            <ResponsiveContainer width="100%" height={240}>
                                <PieChart>
                                    <Pie
                                        data={paymentMethods.filter(pm => pm.value > 0)}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {paymentMethods.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-color)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)' }}
                                        labelStyle={{ color: 'var(--text-color)', fontWeight: 700 }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="pie-legend">
                                {paymentMethods.filter(pm => pm.value > 0).map((pm, idx) => (
                                    <div
                                        key={idx}
                                        className="legend-item clickable-pm"
                                        onClick={() => {
                                            setSearchTerm(pm.name);
                                            setShowHistoryModal(true);
                                        }}
                                        title={`Filter by ${pm.name}`}
                                    >
                                        <span className="dot" style={{ background: pm.color }}></span>
                                        <span className="pm-name">{pm.name}</span>
                                        <span className="pm-val">{pm.value}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>



            {/* Recent Transactions Section */}
            <div className="transactions-section">
                <div className="section-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <h3>Recent Successful Transactions</h3>
                        <div className="quick-method-filters">
                            {paymentMethods.map(pm => (
                                <button
                                    key={pm.name}
                                    className={`method-btn ${pm.name.toLowerCase().replace(' ', '-')}`}
                                    style={{ '--dot-color': pm.color }}
                                    onClick={() => { setSearchTerm(pm.name); setShowHistoryModal(true); }}
                                >
                                    <span className="dot" style={{ background: pm.color }}></span>
                                    {pm.name}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="section-actions">
                        <button className="export-btn-secondary" onClick={() => handleExport(recentTransactions, "RECENT TRANSACTIONS")}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Export Excel
                        </button>
                        <button className="export-btn-secondary" onClick={() => handlePrint(recentTransactions, "RECENT TRANSACTIONS")}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                            Print List
                        </button>
                        <button className="view-all-link" onClick={() => setShowHistoryModal(true)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            View All History
                        </button>
                    </div>
                </div>
                <div className="txn-table-wrapper">
                    <table className="txn-table">
                        <thead>
                            <tr>
                                <th>Transaction ID</th>
                                <th>Student Name</th>
                                <th>Date</th>
                                <th>Method</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={`skel-${i}`}>
                                        <td><div className="sale-skeleton-cell" style={{ width: '100px' }}></div></td>
                                        <td><div className="sale-skeleton-cell" style={{ width: '120px' }}></div></td>
                                        <td><div className="sale-skeleton-cell" style={{ width: '80px' }}></div></td>
                                        <td><div className="sale-skeleton-cell" style={{ width: '70px', borderRadius: '20px' }}></div></td>
                                        <td><div className="sale-skeleton-cell" style={{ width: '80px' }}></div></td>
                                        <td><div className="sale-skeleton-cell" style={{ width: '70px', borderRadius: '20px' }}></div></td>
                                        <td><div className="sale-skeleton-cell" style={{ width: '30px', margin: '0 0 0 auto' }}></div></td>
                                    </tr>
                                ))
                            ) : recentTransactions.length > 0 ? recentTransactions.map(txn => (
                                <tr key={txn.id}>
                                    <td className="txn-id">{txn.id}</td>
                                    <td className="st-name">{txn.student}</td>
                                    <td>{txn.date}</td>
                                    <td>
                                        <span
                                            className={`method-tag ${txn.method?.toLowerCase().replace(' ', '-')} clickable-tag`}
                                            onClick={() => {
                                                setSearchTerm(txn.method);
                                                setShowHistoryModal(true);
                                            }}
                                            title="Filter by this method"
                                        >
                                            {txn.method || 'Cash'}
                                        </span>
                                    </td>
                                    <td className="amount">{txn.amount}</td>
                                    <td>
                                        <span className={`status-pill ${txn.status?.toLowerCase()}`}>
                                            {txn.status}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                            <button className="receipt-btn" onClick={() => handlePrintReceipt(txn)} title="Print Receipt">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                            </button>
                                            <button
                                                className="receipt-btn email-receipt-btn"
                                                onClick={() => handleSendReceipt(txn.booking_id)}
                                                disabled={sendingReceiptId === txn.booking_id}
                                                title="Send Receipt to Email"
                                            >
                                                {sendingReceiptId === txn.booking_id
                                                    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity=".25"></path><path d="M21 12a9 9 0 01-9 9"></path></svg>
                                                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                                }
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="7" className="sale-empty-state">
                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                                        <p>No transactions found</p>
                                        <span>Transactions will appear here once students enroll</span>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <Pagination
                    currentPage={recentPage}
                    totalPages={recentTotalPages}
                    onPageChange={setRecentPage}
                    totalItems={recentBase.length}
                    pageSize={SP_PAGE_SIZE}
                />
            </div>

            {/* Unpaid / Collectable Bookings Section */}
            {branchFilteredUnpaid.length > 0 && (
                <div className="transactions-section unpaid-section">
                    <div className="section-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <h3>Collectable Bookings</h3>
                            <span className="unpaid-count">{branchFilteredUnpaid.length}</span>
                        </div>
                        <div className="section-actions">
                            <button className="export-btn-secondary" onClick={() => handleExport(branchFilteredUnpaid, "UNPAID USERS")}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                Export
                            </button>
                            <button className="export-btn-secondary" onClick={() => handlePrint(branchFilteredUnpaid, "COLLECTABLE USERS")}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                Print
                            </button>
                        </div>
                    </div>
                    <div className="txn-table-wrapper">
                        <table className="txn-table">
                            <thead>
                                <tr>
                                    <th>Booking ID</th>
                                    <th>Student Name</th>
                                    <th>Course</th>
                                    <th>Paid</th>
                                    <th>Balance Due</th>
                                    <th>Payment Type</th>
                                    <th>Status</th>
                                    <th>Contact</th>
                                    <th style={{ textAlign: 'center' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pagedUnpaid.map(b => {
                                    const effectiveBalanceDue = getEffectiveBalanceDue(b);
                                    return (
                                    <tr key={b.id}>
                                        <td className="txn-id">BK-{String(b.id).padStart(3, '0')}</td>
                                        <td className="st-name">{b.student_name}</td>
                                        <td>
                                            <div>{b.course_summary || b.course_name}</div>
                                            {(Number(b.course_count || 1) > 1) && (
                                                <div style={{ fontSize: '11px', color: 'var(--text-secondary, #64748b)', marginTop: '2px' }}>
                                                    {b.course_count} courses availed
                                                </div>
                                            )}
                                        </td>
                                        <td className="amount" style={{ color: '#16a34a' }}>P {parseFloat(b.total_amount || 0).toLocaleString()}</td>
                                        <td className="amount" style={{ color: '#ea580c', fontWeight: 700 }}>P {effectiveBalanceDue.toLocaleString()}</td>
                                        <td>{b.payment_type}</td>
                                        <td>
                                            <span className="status-pill collectable">Collectable</span>
                                        </td>
                                        <td>{b.student_contact || 'N/A'}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                                <button
                                                    className="mark-paid-btn"
                                                    onClick={() => openMarkPaidModal(b)}
                                                    title="Collect remaining balance & mark as paid"
                                                >
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                    Mark as Paid
                                                </button>
                                                <button
                                                    className="receipt-btn email-receipt-btn"
                                                    onClick={() => handleSendReceipt(b.id)}
                                                    disabled={sendingReceiptId === b.id}
                                                    title="Send Balance Reminder to Email"
                                                >
                                                    {sendingReceiptId === b.id
                                                        ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity=".25"></path><path d="M21 12a9 9 0 01-9 9"></path></svg>
                                                        : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                                    }
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                        <Pagination
                            currentPage={unpaidPage}
                            totalPages={unpaidTotalPages}
                            onPageChange={setUnpaidPage}
                            totalItems={branchFilteredUnpaid.length}
                            pageSize={SP_PAGE_SIZE}
                        />
                    </div>
                </div>
            )}


            {/* Mark as Paid Confirmation Modal */}
            {showMarkPaidModal && markPaidBooking && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !markPaidLoading && setShowMarkPaidModal(false)}>
                    <div className="modal-container sale-mark-paid-modal">
                        {(() => {
                            const paid = Number(parseFloat(markPaidBooking?.total_amount || 0).toFixed(2));
                            const remaining = getEffectiveBalanceDue(markPaidBooking);
                            const assessed = Math.max(
                                Number(parseFloat(markPaidBooking?.course_price || 0).toFixed(2)),
                                Number((paid + remaining).toFixed(2))
                            );
                            const inputAmount = Number(markPaidAmount);
                            const collectAmount = Number.isFinite(inputAmount) && inputAmount > 0
                                ? Math.min(inputAmount, remaining)
                                : 0;
                            const remainingAfter = Math.max(0, Number((remaining - collectAmount).toFixed(2)));

                            return (
                                <>
                        {/* Header */}
                        <div className="modal-header sale-mark-paid-head">
                            <div className="modal-header-left">
                                <div className="modal-header-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 1v22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14.5a3.5 3.5 0 0 1 0 7H6" /></svg>
                                </div>
                                <div>
                                    <h2>Collect Remaining Balance</h2>
                                    <p>BK-{String(markPaidBooking.id || '').padStart(3, '0')}</p>
                                </div>
                            </div>
                            <div className="sale-mark-paid-chip">Collectable</div>
                            <button className="close-modal" onClick={() => !markPaidLoading && setShowMarkPaidModal(false)}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="sale-mark-paid-body">
                            <div className="sale-mark-paid-card">
                                <div className="sale-mark-paid-row">
                                    <span>Student</span>
                                    <strong>{markPaidBooking.student_name}</strong>
                                </div>
                                <div className="sale-mark-paid-row">
                                    <span>Course</span>
                                    <strong>{markPaidBooking.course_summary || markPaidBooking.course_name}</strong>
                                </div>
                                <div className="sale-mark-paid-row">
                                    <span>Total Assessment</span>
                                    <strong>P {assessed.toLocaleString()}</strong>
                                </div>
                                <div className="sale-mark-paid-row">
                                    <span>Already Paid</span>
                                    <strong>P {paid.toLocaleString()}</strong>
                                </div>
                                <div className="sale-mark-paid-row sale-mark-paid-highlight">
                                    <span>Current Remaining</span>
                                    <strong>P {remaining.toLocaleString()}</strong>
                                </div>
                            </div>

                            <div className="sale-mark-paid-card sale-mark-paid-form">
                                <label className="sale-mark-paid-label">Amount to Collect</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="sale-mark-paid-input"
                                    value={markPaidAmount}
                                    onChange={(e) => setMarkPaidAmount(e.target.value)}
                                    disabled={markPaidLoading}
                                />
                                <div className="sale-mark-paid-row sale-mark-paid-sub">
                                    <span>Remaining After Payment</span>
                                    <strong>P {remainingAfter.toLocaleString()}</strong>
                                </div>

                                <label className="sale-mark-paid-label">Payment Method</label>
                                <select
                                    value={markPaidMethod}
                                    onChange={(e) => setMarkPaidMethod(e.target.value)}
                                    className="sale-mark-paid-input"
                                    disabled={markPaidLoading}
                                >
                                    <option value="Cash">Cash</option>
                                    <option value="Metrobank">Metrobank</option>
                                </select>

                                {markPaidMethod === 'Metrobank' && (
                                    <>
                                        <label className="sale-mark-paid-label">Transaction ID</label>
                                        <input
                                            type="text"
                                            className="sale-mark-paid-input"
                                            value={markPaidTxnId}
                                            onChange={(e) => setMarkPaidTxnId(e.target.value)}
                                            placeholder="Enter Metrobank transaction ID"
                                            disabled={markPaidLoading}
                                        />
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="modal-footer sale-mark-paid-footer">
                            <button
                                className="export-btn-secondary"
                                onClick={() => !markPaidLoading && setShowMarkPaidModal(false)}
                                disabled={markPaidLoading}
                            >
                                Cancel
                            </button>
                            <button
                                className="confirm-btn"
                                onClick={handleMarkAsPaid}
                                disabled={markPaidLoading}
                            >
                                {markPaidLoading ? 'Processing…' : 'Confirm Payment'}
                            </button>
                        </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* View All History Modal */}
            {
                showHistoryModal && (
                    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowHistoryModal(false)}>
                        <div className="modal-container history-modal">

                            {/* Header */}
                            <div className="modal-header">
                                <div className="modal-header-left">
                                    <div className="modal-header-icon">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                                    </div>
                                    <div>
                                        <h2>Transaction History</h2>
                                        <p>Review and filter all recorded payments</p>
                                    </div>
                                </div>
                                <div className="modal-header-right">
                                    <button className="modal-header-btn" onClick={() => handleExport(filteredHistory, 'FILTERED TRANSACTION REPORT')} title="Export CSV">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                        Export
                                    </button>
                                    <button className="modal-header-btn" onClick={() => handlePrint(filteredHistory, 'FILTERED TRANSACTION HISTORY')} title="Print">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                        Print
                                    </button>
                                    <button className="close-modal" onClick={() => setShowHistoryModal(false)} title="Close">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="modal-controls">
                                {/* Search + Filters row */}
                                <div className="modal-filter-row">
                                    <div className="search-box">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                        <input
                                            type="text"
                                            placeholder="Search by student, txn ID, booking ID, course, method, branch..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                        {searchTerm && (
                                            <button className="search-clear-btn" onClick={() => setSearchTerm('')}>
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                            </button>
                                        )}
                                    </div>
                                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="modal-filter-select">
                                        <option value="All">All Status</option>
                                        <option value="Success">Success</option>
                                        <option value="Collectable">Collectable</option>
                                    </select>
                                    <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="modal-filter-select modal-filter-select--wide">
                                        <option value="All">All Courses</option>
                                        {coursesList.map(c => (
                                            <option key={c.id} value={c.name}>{c.name}</option>
                                        ))}
                                    </select>
                                    {userRole !== 'staff' && (
                                        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="modal-filter-select">
                                            <option value="All">All Branches</option>
                                            {branchesList.map(b => (
                                                <option key={b.id} value={b.name}>{b.name}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                {/* Date range row */}
                                <div className="modal-date-row">
                                    <span className="filter-label">Period</span>
                                    <div className="date-pills">
                                        {['All Time', 'Today', 'This Week', 'This Month', 'This Year', 'Past X Days', 'Custom Range'].map(opt => (
                                            <button
                                                key={opt}
                                                className={`date-pill${dateFilter === opt ? ' active' : ''}`}
                                                onClick={() => setDateFilter(opt)}
                                            >{opt}</button>
                                        ))}
                                    </div>
                                    {dateFilter === 'Past X Days' && (
                                        <div className="custom-days-input">
                                            <span>Past</span>
                                            <input
                                                type="number"
                                                min="1"
                                                max="365"
                                                value={customDays}
                                                onChange={(e) => setCustomDays(e.target.value)}
                                            />
                                            <span>days</span>
                                        </div>
                                    )}
                                    {dateFilter === 'Custom Range' && (
                                        <div className="custom-range-inputs">
                                            <div className="date-range-field">
                                                <label>From</label>
                                                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                                            </div>
                                            <span className="range-sep">→</span>
                                            <div className="date-range-field">
                                                <label>To</label>
                                                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Active filter chips */}
                                {(searchTerm || statusFilter !== 'All' || courseFilter !== 'All' || (userRole !== 'staff' && branchFilter !== 'All') || dateFilter !== 'All Time') && (
                                    <div className="active-filters-bar">
                                        <span className="active-filters-label">Filters:</span>
                                        {searchTerm && <span className="active-filter-chip">"{searchTerm}" <button onClick={() => setSearchTerm('')}>×</button></span>}
                                        {statusFilter !== 'All' && <span className="active-filter-chip">{statusFilter} <button onClick={() => setStatusFilter('All')}>×</button></span>}
                                        {courseFilter !== 'All' && <span className="active-filter-chip">{courseFilter} <button onClick={() => setCourseFilter('All')}>×</button></span>}
                                        {userRole !== 'staff' && branchFilter !== 'All' && <span className="active-filter-chip">📍 {branchFilter} <button onClick={() => setBranchFilter('All')}>×</button></span>}
                                        {dateFilter !== 'All Time' && <span className="active-filter-chip">{dateFilter === 'Past X Days' ? `Past ${customDays} days` : dateFilter} <button onClick={() => setDateFilter('All Time')}>×</button></span>}
                                        <button className="clear-all-filters" onClick={() => { setSearchTerm(''); setStatusFilter('All'); setCourseFilter('All'); if (userRole !== 'staff') setBranchFilter('All'); setDateFilter('All Time'); }}>Clear all</button>
                                    </div>
                                )}
                            </div>

                            {/* Table */}
                            <div className="modal-body custom-scroll">
                                <table className="txn-table">
                                    <thead>
                                        <tr>
                                            <th>Transaction ID</th>
                                            <th>Student Name</th>
                                            <th>Course</th>
                                            <th>Branch</th>
                                            <th>Date</th>
                                            <th>Method</th>
                                            <th>Amount</th>
                                            <th>Status</th>
                                            <th style={{ textAlign: 'center' }}>Receipt</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedHistory.length > 0 ? pagedHistory.map((txn, idx) => (
                                            <tr key={txn.id} className={idx % 2 === 1 ? 'row-alt' : ''}>
                                                <td className="txn-id">{txn.id}</td>
                                                <td className="st-name">{txn.student}</td>
                                                <td className="course-name" title={txn.courseFull || txn.course}>
                                                    <div>{txn.course}</div>
                                                    {txn.courseCount > 1 && (
                                                        <div style={{ fontSize: '11px', color: 'var(--text-secondary, #64748b)', marginTop: '2px' }}>
                                                            Multi-course booking
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ fontSize: '12px', color: 'var(--text-secondary, #64748b)' }}>{txn.branch || '—'}</td>
                                                <td className="date">{txn.date}</td>
                                                <td>
                                                    <span className={`method-tag ${txn.method.toLowerCase().replace(' ', '-')}`}>
                                                        {txn.method}
                                                    </span>
                                                </td>
                                                <td className="amount">{txn.amount}</td>
                                                <td>
                                                    <span className={`status-pill ${txn.status.toLowerCase()}`}>
                                                        {txn.status}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <button className="receipt-btn" onClick={() => handlePrintReceipt(txn)} title="Print Receipt">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan="9">
                                                    <div className="txn-empty-state">
                                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                                        <p>No transactions found</p>
                                                        <span>Try adjusting your search or filters</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                                <Pagination
                                    currentPage={historyPage}
                                    totalPages={historyTotalPages}
                                    onPageChange={setHistoryPage}
                                    totalItems={filteredHistory.length}
                                    pageSize={SP_PAGE_SIZE}
                                />
                            </div>

                            {/* Footer */}
                            <div className="modal-footer">
                                <div className="history-summary">
                                    <div className="summary-badge">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                        <span><strong>{filteredHistory.length}</strong> records</span>
                                    </div>
                                    <div className="summary-badge success">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                                        <span>Total: <strong>₱{filteredTotalSales.toLocaleString()}</strong></span>
                                    </div>
                                </div>
                                <button className="confirm-btn" onClick={() => setShowHistoryModal(false)}>
                                    Close
                                </button>
                            </div>

                        </div>
                    </div>
                )
            }
        </div>
    );
};

export default SalePayment;
