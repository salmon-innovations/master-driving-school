import React, { useState } from 'react';
import './css/booking.css';
const logo = '/images/logo.png';

const Booking = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);

    // Mock data for bookings
    const [bookings, setBookings] = useState([
        { id: 'BK-001', student: 'Juan Dela Cruz', type: 'TDC', branch: 'Lipa Branch', date: '2024-03-20', time: '08:00 AM - 12:00 PM', status: 'Pending', amount: 'P 2,500', paymentType: 'Full Payment', paymentMethod: 'GCash' },
        { id: 'BK-002', student: 'Maria Santos', type: 'PDC', branch: 'Batangas Branch', date: '2024-03-21', time: '01:00 PM - 03:00 PM', status: 'Confirmed', amount: 'P 5,000', paymentType: 'Down Payment', paymentMethod: 'StarPay' },
        { id: 'BK-003', student: 'Jose Rizal', type: 'TDC', branch: 'Tanauan Branch', date: '2024-03-22', time: '08:00 AM - 12:00 PM', status: 'Pending', amount: 'P 2,500', paymentType: 'Full Payment', paymentMethod: 'StarPay' },
        { id: 'BK-004', student: 'Andres Bonifacio', type: 'PDC', branch: 'Lipa Branch', date: '2024-03-23', time: '10:00 AM - 12:00 PM', status: 'Cancelled', amount: 'P 4,500', paymentType: 'Full Payment', paymentMethod: 'GCash' },
        { id: 'BK-005', student: 'Emilio Aguinaldo', type: 'TDC', branch: 'Lipa Branch', date: '2024-03-24', time: '01:00 PM - 05:00 PM', status: 'Confirmed', amount: 'P 2,500', paymentType: 'Down Payment', paymentMethod: 'GCash' },
    ]);

    const handleSearch = (e) => setSearchTerm(e.target.value);

    const filteredBookings = bookings.filter(booking => {
        const matchesSearch = booking.student.toLowerCase().includes(searchTerm.toLowerCase()) ||
            booking.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || booking.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const updateStatus = (id, newStatus) => {
        setBookings(bookings.map(b => b.id === id ? { ...b, status: newStatus } : b));
    };

    const handleViewClick = (booking) => {
        setSelectedBooking(booking);
        setShowViewModal(true);
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
                    .status-confirmed { color: #16a34a; font-weight: bold; }
                    .status-pending { color: #ea580c; font-weight: bold; }
                    .status-cancelled { color: #dc2626; font-weight: bold; }
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
                            <td class="${b.status.toLowerCase() === 'confirmed' ? 'status-confirmed' : b.status.toLowerCase() === 'pending' ? 'status-pending' : 'status-cancelled'}">${b.status.toUpperCase()}</td>
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
    };

    return (
        <div className="booking-module">
            <div className="booking-header-section">
                <div className="booking-header">
                    <div className="header-left">
                        <h2>Booking Requests</h2>
                        <p>Manage and review student course enrolments</p>
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
                    </div>
                </div>
            </div>

            {/* View Booking Modal */}
            {showViewModal && selectedBooking && (
                <div className="modal-overlay">
                    <div className="modal-container user-modal" style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2>Booking Details</h2>
                            <button className="close-modal" onClick={() => setShowViewModal(false)}>&times;</button>
                        </div>
                        <div className="modal-body" style={{ padding: '25px' }}>
                            <div className="booking-details-header" style={{ textAlign: 'center', marginBottom: '30px' }}>
                                <div className={`status-pill ${selectedBooking.status.toLowerCase()}`} style={{ display: 'inline-block', marginBottom: '15px' }}>
                                    {selectedBooking.status}
                                </div>
                                <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#1e293b' }}>{selectedBooking.id}</h1>
                                <p style={{ color: '#64748b' }}>Submitted on March 15, 2024</p>
                            </div>

                            <div className="details-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div className="detail-field">
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Student Name</label>
                                    <div style={{ fontWeight: '600', color: '#334155' }}>{selectedBooking.student}</div>
                                </div>
                                <div className="detail-field">
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Course Type</label>
                                    <div style={{ fontWeight: '600', color: '#334155' }}>{selectedBooking.type} Training</div>
                                </div>
                                <div className="detail-field">
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Branch Office</label>
                                    <div style={{ fontWeight: '600', color: '#334155' }}>{selectedBooking.branch}</div>
                                </div>
                                <div className="detail-field">
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Amount Due</label>
                                    <div style={{ fontWeight: '700', color: '#1a4fba' }}>{selectedBooking.amount}</div>
                                </div>
                            </div>

                            <div className="detail-field" style={{ marginTop: '20px', padding: '15px', background: '#f8fafc', borderRadius: '12px' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Payment Mode ({selectedBooking.paymentType})</label>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: '600', color: '#334155' }}>{selectedBooking.paymentMethod} (Transaction ID: 9283741)</span>
                                    <span style={{ fontSize: '0.7rem', background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>VERIFIED</span>
                                </div>
                            </div>

                            <div className="detail-field" style={{ marginTop: '20px' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Schedule Summary</label>
                                <div style={{ fontWeight: '600', color: '#334155' }}>{selectedBooking.date} | {selectedBooking.time}</div>
                            </div>
                        </div>
                        <div className="modal-footer" style={{ borderTop: '1px solid #f1f5f9', padding: '20px', display: 'flex', gap: '10px' }}>
                            <button className="prev-btn" style={{ flex: 1 }} onClick={() => setShowViewModal(false)}>Close View</button>
                            {selectedBooking.status === 'Pending' && (
                                <button className="add-btn" style={{ flex: 1 }} onClick={() => { updateStatus(selectedBooking.id, 'Confirmed'); setShowViewModal(false); }}>Confirm Booking</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="booking-stats">
                <div className="mini-stat">
                    <span className="label">Total Bookings</span>
                    <span className="value">{bookings.length}</span>
                </div>
                <div className="mini-stat">
                    <span className="label">Pending Approval</span>
                    <span className="value orange">{bookings.filter(b => b.status === 'Pending').length}</span>
                </div>
                <div className="mini-stat">
                    <span className="label">Confirmed</span>
                    <span className="value green">{bookings.filter(b => b.status === 'Confirmed').length}</span>
                </div>
            </div>

            <div className="booking-content">
                <div className="filters-row">
                    <div className="status-tabs">
                        {['All', 'Pending', 'Confirmed', 'Cancelled'].map(status => (
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
                            {filteredBookings.map(booking => (
                                <tr key={booking.id}>
                                    <td className="bk-id">{booking.id}</td>
                                    <td>
                                        <div className="student-info">
                                            <span className="name">{booking.student}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`type-badge ${booking.type.toLowerCase()}`}>
                                            {booking.type}
                                        </span>
                                    </td>
                                    <td className="bk-branch">{booking.branch}</td>
                                    <td>
                                        <div className="schedule-info">
                                            <span className="date">{booking.date}</span>
                                            <span className="time">{booking.time}</span>
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
                                            {booking.status === 'Pending' && (
                                                <>
                                                    <button className="approve-btn" title="Approve" onClick={() => updateStatus(booking.id, 'Confirmed')}>
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                    </button>
                                                    <button className="reject-btn" title="Reject" onClick={() => updateStatus(booking.id, 'Cancelled')}>
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
                            {filteredBookings.length === 0 && (
                                <tr>
                                    <td colSpan="8" className="no-data">
                                        No bookings found matching your search.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Booking;
