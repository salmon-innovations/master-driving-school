import React, { useState, useEffect } from 'react';
import './css/booking.css';
import { adminAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import Pagination from './components/Pagination';

const BK_PAGE_SIZE = 10;
const logo = '/images/logo.png';

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

    // Fetch bookings from database
    useEffect(() => {
        loadBookings();
    }, []);

    const loadBookings = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await adminAPI.getAllBookings(null, 100);
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
                        branchName = branchName
                            .replace('Master Driving School ', '')
                            .replace('Master Prime Driving School ', '')
                            .replace('Masters Prime Holdings Corp. ', '')
                            .replace('Master Prime Holdings Corp. ', '')
                            .trim()
                            .toUpperCase();
                    }

                    // Build schedule date display (supports multi-day courses)
                    const formatD = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    let scheduleDateDisplay = booking.booking_date ? formatD(booking.booking_date) : 'N/A';
                    let scheduleDay2 = null;
                    let scheduleTime = booking.booking_time || '';

                    const details = booking.schedule_details || booking.schedule_dates;
                    if (details && details.length > 0) {
                        try {
                            const firstDetail = details[0];
                            if (typeof firstDetail === 'string') {
                                // Legacy fallback
                                const sortedDates = [...new Set(details.map(d => new Date(d).toISOString().split('T')[0]))].sort();
                                scheduleDateDisplay = formatD(sortedDates[0]);
                                if (sortedDates.length > 1) scheduleDay2 = formatD(sortedDates[1]);
                            } else if (firstDetail && typeof firstDetail === 'object') {
                                const type = booking.course_name?.includes('TDC') ? 'TDC' : 'PDC';
                                if (firstDetail.time_range) scheduleTime = firstDetail.time_range;

                                if (type === 'PDC' && details.length > 1) {
                                    // PDC: multiple distinct slots
                                    const sortedDates = [...new Set(details.map(d => new Date(d.date).toISOString().split('T')[0]))].sort();
                                    scheduleDateDisplay = formatD(sortedDates[0]);
                                    if (sortedDates.length > 1) scheduleDay2 = formatD(sortedDates[1]);
                                } else {
                                    // TDC: single slot spanning date → end_date
                                    scheduleDateDisplay = formatD(firstDetail.date);
                                    if (firstDetail.end_date &&
                                        new Date(firstDetail.end_date).toISOString().split('T')[0] !==
                                        new Date(firstDetail.date).toISOString().split('T')[0]) {
                                        scheduleDay2 = formatD(firstDetail.end_date);
                                    }
                                }
                            }
                        } catch (e) {
                            console.error('Error parsing schedule dates:', e);
                        }
                    } else {
                        // No enrollment yet — fall back to notes-based slot data (pending StarPay)
                        const ns = booking.notes_slot;
                        const ns2 = booking.notes_slot2;
                        if (ns) {
                            scheduleDateDisplay = formatD(ns.date);
                            if (ns.time_range) scheduleTime = ns.time_range;
                            if (ns2) {
                                // PDC 2-day: slot2 has its own date
                                scheduleDay2 = formatD(ns2.date);
                            } else if (ns.end_date &&
                                new Date(ns.end_date).toISOString().split('T')[0] !==
                                new Date(ns.date).toISOString().split('T')[0]) {
                                // TDC: single slot with end_date
                                scheduleDay2 = formatD(ns.end_date);
                            }
                        }
                    }

                    let category = booking.course_name?.includes('TDC') ? 'TDC' : booking.course_name?.includes('PDC') ? 'PDC' : 'Course';

                    let specificCategory = category;
                    if (category === 'PDC' && booking.course_name) {
                        const nameUpper = booking.course_name.toUpperCase();
                        if (nameUpper.includes('MOTORCYCLE')) specificCategory = 'PDC Motorcycle';
                        else if (nameUpper.includes('CAR')) specificCategory = 'PDC Car';
                        else if (nameUpper.includes('B1') || nameUpper.includes('B2')) specificCategory = 'PDC B1/B2';
                    }

                    let courseTypeLabel = booking.course_type ? ` - ${booking.course_type.toLowerCase() === 'f2f' ? 'F2F' : booking.course_type.charAt(0).toUpperCase() + booking.course_type.slice(1)}` : '';
                    let displayType = specificCategory + courseTypeLabel;

                    return {
                        id: `BK-${String(booking.id).padStart(3, '0')}`,
                        student: booking.student_name || 'N/A',
                        typeCategory: category,
                        type: displayType,
                        fullCourseName: booking.course_name || 'N/A',
                        branch: branchName,
                        date: scheduleDateDisplay,
                        date2: scheduleDay2,
                        time: scheduleTime,
                        status: status,
                        amount: `₱ ${Number(booking.total_amount || 0).toLocaleString()}`,
                        paymentType: booking.payment_type || 'Full Payment',
                        paymentMethod: booking.payment_method || 'Online Payment',
                        rawId: booking.id,
                        // Extra fields for payment history panel
                        coursePrice: Number(booking.course_price || 0),
                        amountPaid: Number(booking.total_amount || 0),
                        paymentDate: booking.created_at,
                        transactionId: booking.transaction_id || null,
                        rawNotes: booking.notes || '',
                    };
                });
                setBookings(transformedBookings);
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
        const matchesSearch = booking.student.toLowerCase().includes(searchTerm.toLowerCase()) ||
            booking.id.toLowerCase().includes(searchTerm.toLowerCase());
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

    const handleViewClick = async (booking) => {
        setSelectedBooking(booking);
        setShowViewModal(true);
        // Re-fetch in background so payment fields are always fresh
        try {
            const response = await adminAPI.getAllBookings(null, 100);
            if (response.success) {
                const fresh = response.bookings.find(b => b.id === booking.rawId);
                if (fresh) {
                    setSelectedBooking(prev => ({
                        ...prev,
                        coursePrice: Number(fresh.course_price || 0),
                        amountPaid: Number(fresh.total_amount || 0),
                        paymentDate: fresh.created_at,
                        transactionId: fresh.transaction_id || null,
                        rawNotes: fresh.notes || '',
                    }));
                }
            }
        } catch (_) { /* silent */ }
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
                            placeholder="Search student or ID..."
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

            {/* View Booking Modal */}
            {showViewModal && selectedBooking && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowViewModal(false)}>
                    <div className="bk-modal">
                        <div className="bk-modal-header">
                            <div className="modal-header-left">
                                <div className="modal-header-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                </div>
                                <div>
                                    <h2>Booking Details</h2>
                                    <p>{selectedBooking.id}</p>
                                </div>
                            </div>
                            <div className="modal-header-right">
                                <button className="bk-modal-close" onClick={() => setShowViewModal(false)}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>
                        </div>
                        <div className="bk-modal-body">
                            <div className="bk-modal-status-center">
                                <div className={`status-pill ${selectedBooking.status.toLowerCase()}`}>
                                    {selectedBooking.status}
                                </div>
                            </div>

                            <div className="bk-modal-sections">
                                {/* Student Information */}
                                <div className="bk-modal-card bk-modal-student">
                                    <div className="bk-modal-card-label">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                            <circle cx="12" cy="7" r="4"></circle>
                                        </svg>
                                        <label>Student Name</label>
                                    </div>
                                    <div className="bk-modal-card-value">{selectedBooking.student}</div>
                                </div>

                                {/* Course & Branch Grid */}
                                <div className="bk-modal-grid">
                                    <div className="bk-modal-card">
                                        <div className="bk-modal-card-label">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2">
                                                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                                                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                                            </svg>
                                            <label>Course</label>
                                        </div>
                                        <div className="bk-modal-card-value bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text font-black">{selectedBooking.type}</div>
                                        <div className="bk-modal-card-sub text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded inline-block mt-2 font-medium">{selectedBooking.fullCourseName}</div>
                                    </div>

                                    <div className="bk-modal-card">
                                        <div className="bk-modal-card-label">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                                <circle cx="12" cy="10" r="3"></circle>
                                            </svg>
                                            <label>Branch</label>
                                        </div>
                                        <div className="bk-modal-card-value">{selectedBooking.branch}</div>
                                    </div>
                                </div>

                                {/* Payment History */}
                                <div className="bk-modal-payment">
                                    <div className="bk-modal-payment-header">
                                        <div className="bk-modal-card-label">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                                                <line x1="1" y1="10" x2="23" y2="10"></line>
                                            </svg>
                                            <label>Payment History</label>
                                        </div>
                                        <span className="bk-verified-badge">VERIFIED</span>
                                    </div>

                                    {/* Course price header + table body */}
                                    {(() => {
                                        // Fallback: parse the always-present `amount` string (e.g. "₱ 700")
                                        const amountFallback = parseFloat(
                                            (selectedBooking.amount || '').replace(/[^0-9.]/g, '')
                                        ) || 0;
                                        const coursePrice = Number(selectedBooking.coursePrice) || amountFallback;
                                        const amountPaid  = Number(selectedBooking.amountPaid)  || amountFallback;
                                        const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
                                        const isDown = (selectedBooking.paymentType || '').toLowerCase().includes('down');
                                        const hasRescheduleFee = (selectedBooking.rawNotes || '').toLowerCase().includes('rescheduling fee');
                                        const balance = coursePrice - amountPaid;
                                        const paidInFull = amountPaid >= coursePrice && coursePrice > 0;

                                        const rowStyle = { display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', gap: '6px', padding: '8px 6px', borderBottom: '1px solid var(--border-color)', alignItems: 'center' };
                                        const valStyle = { fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-color)' };
                                        const dateStyle = { fontSize: '0.8rem', color: 'var(--secondary-text)', fontWeight: 500 };

                                        return (
                                            <>
                                                {/* Course price header */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0 10px', borderBottom: '2px solid var(--border-color)', marginBottom: '6px' }}>
                                                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--secondary-text)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Course Total Price</span>
                                                    <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-color)' }}>₱{coursePrice.toLocaleString()}</span>
                                                </div>

                                                {/* Column headers */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', gap: '6px', padding: '5px 6px', background: 'var(--bg-color)', borderRadius: '6px', marginBottom: '4px' }}>
                                                    {['Date', 'Type', 'Method', 'Amount'].map(h => (
                                                        <span key={h} style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--secondary-text)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</span>
                                                    ))}
                                                </div>

                                                {/* Row 1 — initial payment */}
                                                <div style={rowStyle}>
                                                    <span style={dateStyle}>{fmtDate(selectedBooking.paymentDate)}</span>
                                                    <span style={{ ...valStyle, color: isDown ? '#f59e0b' : '#16a34a' }}>{isDown ? 'Downpayment' : 'Full Payment'}</span>
                                                    <span style={valStyle}>{selectedBooking.paymentMethod}</span>
                                                    <span style={{ ...valStyle, color: '#16a34a', fontWeight: 800 }}>₱{amountPaid.toLocaleString()}</span>
                                                </div>

                                                {/* Row 2 — rescheduling fee (if noted) */}
                                                {hasRescheduleFee && (
                                                    <div style={rowStyle}>
                                                        <span style={dateStyle}>—</span>
                                                        <span style={{ ...valStyle, color: '#ef4444' }}>Reschedule Fee</span>
                                                        <span style={valStyle}>Cash</span>
                                                        <span style={{ ...valStyle, color: '#ef4444', fontWeight: 800 }}>₱1,000</span>
                                                    </div>
                                                )}

                                                {/* Outstanding balance row */}
                                                {!paidInFull && balance > 0 && (
                                                    <div style={{ ...rowStyle, background: '#fff7ed', borderRadius: '6px', border: '1px solid #fed7aa', borderBottom: '1px solid #fed7aa' }}>
                                                        <span style={{ ...dateStyle, color: '#c2410c' }}>Outstanding</span>
                                                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#c2410c' }}>Balance Due</span>
                                                        <span style={{ fontSize: '0.82rem', color: '#c2410c' }}>—</span>
                                                        <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#ea580c' }}>₱{balance.toLocaleString()}</span>
                                                    </div>
                                                )}

                                                {/* Total paid summary */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 6px 4px', marginTop: '4px' }}>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--secondary-text)' }}>
                                                        {paidInFull ? '✅ Paid in Full' : 'Total Paid'}
                                                    </span>
                                                    <span style={{ fontWeight: 800, fontSize: '1rem', color: paidInFull ? '#16a34a' : '#f59e0b' }}>
                                                        ₱{(amountPaid + (hasRescheduleFee ? 1000 : 0)).toLocaleString()}
                                                    </span>
                                                </div>

                                                {selectedBooking.transactionId && (
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--secondary-text)', padding: '4px 6px 0' }}>
                                                        Transaction ID: <strong>{selectedBooking.transactionId}</strong>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>

                                {/* Schedule Information */}
                                <div className="bk-modal-card">
                                    <div className="bk-modal-card-label" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                            <line x1="16" y1="2" x2="16" y2="6"></line>
                                            <line x1="8" y1="2" x2="8" y2="6"></line>
                                            <line x1="3" y1="10" x2="21" y2="10"></line>
                                        </svg>
                                        <label>Schedule Details</label>
                                    </div>
                                    <div className="bk-modal-schedule-content" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {selectedBooking.date2 ? (
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                <div style={{ background: 'var(--card-bg)', padding: '16px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--secondary-text)', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.5px' }}>DAY 1</div>
                                                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-color)' }}>{selectedBooking.date}</div>
                                                </div>
                                                <div style={{ background: 'var(--primary-light)', padding: '16px 12px', borderRadius: '12px', border: '1px solid rgba(33, 87, 218, 0.2)', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--primary-color)', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.5px' }}>DAY 2</div>
                                                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary-color)' }}>{selectedBooking.date2}</div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ background: 'var(--card-bg)', padding: '16px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                                                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-color)' }}>{selectedBooking.date}</div>
                                            </div>
                                        )}
                                        {selectedBooking.time && (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--secondary-text)', background: 'var(--bg-color)', padding: '12px', borderRadius: '12px', marginTop: '4px' }}>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{selectedBooking.time}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="bk-modal-footer">
                            <button className="bk-modal-btn-close" onClick={() => setShowViewModal(false)}>Close</button>
                            {selectedBooking.status === 'Collectable' && (
                                <button className="bk-modal-btn-action" onClick={() => { updateStatus(selectedBooking.id, 'Paid'); setShowViewModal(false); }}>Mark as Paid</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="booking-stats">
                <div className="mini-stat">
                    <div className="mini-stat-icon blue">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                    </div>
                    <div className="mini-stat-content">
                        <span className="label">Total Bookings</span>
                        <span className="value">{loading ? <span className="bk-skeleton-text">--</span> : bookings.length}</span>
                        <span className="mini-stat-subtitle">All time records</span>
                    </div>
                </div>
                <div className="mini-stat">
                    <div className="mini-stat-icon orange">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    </div>
                    <div className="mini-stat-content">
                        <span className="label">Collectable</span>
                        <span className="value orange">{loading ? <span className="bk-skeleton-text">--</span> : bookings.filter(b => b.status === 'Collectable').length}</span>
                        <span className="mini-stat-subtitle">Awaiting payment</span>
                    </div>
                </div>
                <div className="mini-stat">
                    <div className="mini-stat-icon green">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    </div>
                    <div className="mini-stat-content">
                        <span className="label">Paid</span>
                        <span className="value green">{loading ? <span className="bk-skeleton-text">--</span> : bookings.filter(b => b.status === 'Paid').length}</span>
                        <span className="mini-stat-subtitle">Completed payments</span>
                    </div>
                </div>
                <div className="mini-stat">
                    <div className="mini-stat-icon red">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                    </div>
                    <div className="mini-stat-content">
                        <span className="label">Cancelled</span>
                        <span className="value red">{loading ? <span className="bk-skeleton-text">--</span> : bookings.filter(b => b.status === 'Cancelled').length}</span>
                        <span className="mini-stat-subtitle">Cancelled bookings</span>
                    </div>
                </div>
            </div>

            <div className="booking-content">
                <div className="filters-row">
                    <div className="status-tabs">
                        {['All', 'Collectable', 'Paid', 'Cancelled'].map(status => (
                            <button
                                key={status}
                                className={`status-tab ${statusFilter === status ? 'active' : ''}`}
                                onClick={() => setStatusFilter(status)}
                            >
                                {status}
                            </button>
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
                        <thead>
                            <tr>
                                <th>Booking ID</th>
                                <th>Student</th>
                                <th>Course</th>
                                <th>Branch</th>
                                <th>Schedule</th>
                                <th>Payment</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
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
                                        <td><div className="bk-skeleton-cell" style={{ width: '50px' }}></div></td>
                                        <td><div className="bk-skeleton-cell" style={{ width: '90px' }}></div></td>
                                        <td><div className="bk-skeleton-cell" style={{ width: '100px' }}></div></td>
                                        <td><div className="bk-skeleton-cell" style={{ width: '80px' }}></div></td>
                                        <td><div className="bk-skeleton-cell" style={{ width: '70px', borderRadius: '20px' }}></div></td>
                                        <td><div className="bk-skeleton-cell" style={{ width: '80px' }}></div></td>
                                    </tr>
                                ))
                            ) : filteredBookings.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="no-data">
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
                                <tr key={booking.id} className="bk-table-row">
                                    <td className="bk-id">{booking.id}</td>
                                    <td>
                                        <div className="bk-table-student">
                                            <div className="bk-student-avatar">
                                                {booking.student.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                            </div>
                                            <div className="student-info">
                                                <span className="name">{booking.student}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`type-badge ${booking.typeCategory.toLowerCase()}`}>
                                            {booking.type}
                                        </span>
                                    </td>
                                    <td className="bk-branch">{booking.branch}</td>
                                    <td>
                                        <div className="schedule-info">
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                {booking.date2 ? (
                                                    <>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span style={{ fontSize: '0.65rem', padding: '2px 6px', background: 'var(--primary-light)', color: 'var(--primary-color)', borderRadius: '4px', fontWeight: '800', letterSpacing: '0.5px' }}>D1</span>
                                                            <span className="date" style={{ fontSize: '0.85rem' }}>{booking.date}</span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span style={{ fontSize: '0.65rem', padding: '2px 6px', background: 'var(--primary-light)', color: 'var(--primary-color)', borderRadius: '4px', fontWeight: '800', letterSpacing: '0.5px' }}>D2</span>
                                                            <span className="date" style={{ fontSize: '0.85rem' }}>{booking.date2}</span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <span className="date" style={{ fontSize: '0.85rem' }}>{booking.date}</span>
                                                )}
                                                {booking.time && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--secondary-text)" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                                        <span className="time">{booking.time}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="bk-payment">
                                        <div className="payment-info">
                                            <span className="amount">{booking.amount}</span>
                                            <span className="method">{booking.paymentType} via {booking.paymentMethod}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`status-pill ${booking.status.toLowerCase()}`}>
                                            {booking.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="action-btns">
                                            {booking.status === 'Collectable' && (
                                                <>
                                                    <button className="approve-btn" title="Mark as Paid" onClick={() => updateStatus(booking.id, 'Paid')}>
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                    </button>
                                                    <button className="reject-btn" title="Cancel" onClick={() => updateStatus(booking.id, 'Cancelled')}>
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                    </button>
                                                </>
                                            )}
                                            <button className="view-btn" title="View Details" onClick={() => handleViewClick(booking)}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
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
