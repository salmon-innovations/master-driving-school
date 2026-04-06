import React, { useState, useEffect } from 'react';
import './css/crm.css';
import './css/sale.css';
import { adminAPI, authAPI, branchesAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import Pagination from './components/Pagination';

const CRM_PAGE_SIZE = 10;

const CRMManagement = () => {
    const { showNotification } = useNotification();

    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');
    const [crmPage, setCrmPage] = useState(1);
    const [branchFilter, setBranchFilter] = useState('All');
    const [branchesList, setBranchesList] = useState([]);

    // Auth / role state
    const [userRole, setUserRole] = useState(null);
    const [userBranchId, setUserBranchId] = useState(null);
    const isBranchScopedUser = userRole === 'staff' || (userRole === 'admin' && !!userBranchId);

    // Course Management Modal State
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [studentBookings, setStudentBookings] = useState([]);
    const [showCoursesModal, setShowCoursesModal] = useState(false);
    const [loadingCourses, setLoadingCourses] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                const profileRes = await authAPI.getProfile();
                if (profileRes.success) {
                    const role = profileRes.user.role;
                    const branchId = profileRes.user.branchId;
                    setUserRole(role);
                    setUserBranchId(branchId || null);
                    const branchRes = await branchesAPI.getAll();
                    if (branchRes.success && branchRes.branches) {
                        if ((role === 'staff' || (role === 'admin' && branchId)) && branchId) {
                            const staffBranch = branchRes.branches.find(b => String(b.id) === String(branchId));
                            if (staffBranch) {
                                setBranchesList([staffBranch]);
                                setBranchFilter(staffBranch.name);
                            }
                        } else {
                            setBranchesList(branchRes.branches);
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching profile:', error);
            }
        };
        init();
        fetchStudents();
    }, []);

    const formatBranchName = (name) => {
        if (!name) return name;
        const prefixes = [
            'Master Driving School ',
            'Master Prime Driving School ',
            'Masters Prime Holdings Corp. ',
            'Master Prime Holdings Corp. '
        ];
        let formattedName = name;
        if (['Not Assigned', 'Not enrolled', 'All Branches', 'Unassigned'].includes(formattedName)) return formattedName;
        for (const prefix of prefixes) {
            if (formattedName.startsWith(prefix)) {
                formattedName = formattedName.substring(prefix.length);
                break;
            }
        }
        return formattedName;
    };

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const response = await adminAPI.getAllUsers(null, 5000);
            if (response.users) {
                setStudents(response.users.filter(u => u.role === 'student' || u.role === 'walkin_student'));
            }
        } catch (error) {
            console.error('Error fetching students:', error);
            showNotification('Failed to load students data', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Branch-filtered base (for stats cards)
    const branchFilteredStudents = branchFilter === 'All'
        ? students
        : students.filter(s => s.branch_name && s.branch_name.toLowerCase() === branchFilter.toLowerCase());

    // All filters applied (for table)
    const filteredStudents = branchFilteredStudents.filter(student => {
        if (roleFilter === 'Online' && student.role !== 'student') return false;
        if (roleFilter === 'Walk-In' && student.role !== 'walkin_student') return false;
        const fullName = `${student.first_name || ''} ${student.last_name || ''}`.toLowerCase();
        const email = (student.email || '').toLowerCase();
        const search = searchTerm.toLowerCase();
        return fullName.includes(search) || email.includes(search);
    });

    const crmTotalPages = Math.ceil(filteredStudents.length / CRM_PAGE_SIZE);
    const pagedStudents = filteredStudents.slice((crmPage - 1) * CRM_PAGE_SIZE, crmPage * CRM_PAGE_SIZE);

    // Stats (react to branch filter)
    const onlineCount = branchFilteredStudents.filter(s => s.role === 'student').length;
    const walkinCount = branchFilteredStudents.filter(s => s.role === 'walkin_student').length;

    const handleManageCourses = async (student) => {
        setSelectedStudent(student);
        setShowCoursesModal(true);
        setLoadingCourses(true);
        try {
            const response = await adminAPI.getAllBookings(null, 5000);
            if (response.success) {
                setStudentBookings(response.bookings.filter(b => b.user_id === student.id));
            }
        } catch (error) {
            console.error('Error fetching student bookings:', error);
            showNotification('Failed to fetch student courses', 'error');
        } finally {
            setLoadingCourses(false);
        }
    };

    const handleMarkCompleted = async (bookingId) => {
        try {
            const response = await adminAPI.updateBookingStatus(bookingId, 'completed');
            if (response.success) {
                showNotification('Course marked as completed!', 'success');
                setStudentBookings(prev => prev.map(b =>
                    b.id === bookingId ? { ...b, status: 'completed' } : b
                ));
            }
        } catch (error) {
            console.error('Error marking course complete:', error);
            showNotification(error.response?.data?.error || 'Failed to update course status', 'error');
        }
    };

    return (
        <div className="crm-container">
            {/* Page Header */}
            <div className="sale-header-section">
                <div className="sale-header">
                    <div className="header-left">
                        <div>
                            <h2>Student Database</h2>
                            <p>View and manage all enrolled and walk-in students</p>
                        </div>
                    </div>
                </div>
            </div>

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
                            {branchFilter === 'All' ? 'All Branches' : formatBranchName(branchFilter)}
                        </span>
                    </div>
                </div>
                <div className="branch-filter-right">
                    {!isBranchScopedUser && (
                        <>
                            <span className="branch-filter-count">{branchesList.length} Branches</span>
                            <select
                                className="branch-filter-select"
                                value={branchFilter}
                                onChange={(e) => { setBranchFilter(e.target.value); setCrmPage(1); }}
                            >
                                <option value="All">All Branches</option>
                                {branchesList.map(b => (
                                    <option key={b.id} value={b.name}>{formatBranchName(b.name)}</option>
                                ))}
                            </select>
                        </>
                    )}
                </div>
            </div>

            {/* Stats Row */}
            <div className="revenue-stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: '20px' }}>
                {[
                    { label: 'Total Students', value: branchFilteredStudents.length, color: 'blue' },
                    { label: 'Online Students', value: onlineCount, color: 'green' },
                    { label: 'Walk-In Students', value: walkinCount, color: 'orange' },
                ].map((stat, idx) => (
                    <div key={idx} className={`rev-stat-card ${stat.color}`}>
                        <div className="rev-info">
                            <span className="label">{stat.label}</span>
                            <div className="value-group">
                                <h3>{stat.value.toLocaleString()}</h3>
                            </div>
                        </div>
                        <div className="rev-icon">
                            <div className="decoration-circle"></div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Students Table Section */}
            <div className="transactions-section" style={{ marginTop: '20px' }}>
                <div className="section-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <h3>Students</h3>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            {['All', 'Online', 'Walk-In'].map(f => (
                                <button
                                    key={f}
                                    onClick={() => { setRoleFilter(f); setCrmPage(1); }}
                                    style={{
                                        padding: '5px 14px', borderRadius: '20px', cursor: 'pointer',
                                        border: roleFilter === f ? 'none' : '1px solid var(--border-color)',
                                        background: roleFilter === f ? '#2157da' : 'transparent',
                                        color: roleFilter === f ? '#fff' : 'var(--text-secondary, #64748b)',
                                        fontSize: '12px', fontWeight: 600, transition: 'all 0.2s',
                                    }}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="section-actions">
                        <div className="search-box" style={{ minWidth: '260px' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <input
                                type="text"
                                placeholder="Search by name or email…"
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCrmPage(1); }}
                            />
                            {searchTerm && (
                                <button className="search-clear-btn" onClick={() => setSearchTerm('')}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            )}
                        </div>
                        <span style={{ padding: '6px 14px', background: 'var(--primary-light, #eff6ff)', color: '#2157da', borderRadius: '20px', fontWeight: 700, fontSize: '13px', whiteSpace: 'nowrap' }}>
                            {filteredStudents.length} students
                        </span>
                    </div>
                </div>

                <div className="txn-table-wrapper">
                    <table className="txn-table">
                        <thead>
                            <tr>
                                <th>Student</th>
                                <th>Contact</th>
                                <th>Type</th>
                                {userRole !== 'staff' && <th>Branch</th>}
                                <th>Status</th>
                                <th style={{ textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}>
                                        <td><div className="sale-skeleton-cell" style={{ width: '160px' }}></div></td>
                                        <td><div className="sale-skeleton-cell" style={{ width: '140px' }}></div></td>
                                        <td><div className="sale-skeleton-cell" style={{ width: '70px', borderRadius: '20px' }}></div></td>
                                        {userRole !== 'staff' && <td><div className="sale-skeleton-cell" style={{ width: '100px' }}></div></td>}
                                        <td><div className="sale-skeleton-cell" style={{ width: '60px', borderRadius: '20px' }}></div></td>
                                        <td><div className="sale-skeleton-cell" style={{ width: '90px', margin: '0 auto' }}></div></td>
                                    </tr>
                                ))
                            ) : filteredStudents.length === 0 ? (
                                <tr>
                                    <td colSpan={userRole !== 'staff' ? 6 : 5} className="sale-empty-state">
                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
                                        <p>No students found</p>
                                        <span>Try adjusting your search or filters</span>
                                    </td>
                                </tr>
                            ) : pagedStudents.map(student => (
                                <tr key={student.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '13px', flexShrink: 0 }}>
                                                {(student.first_name?.[0] || '').toUpperCase()}{(student.last_name?.[0] || '').toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="st-name">{student.first_name} {student.last_name}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-secondary, #64748b)', marginTop: '2px' }}>
                                                    Age: {student.age || '—'} · {student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : 'Unknown'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '13px', color: 'var(--text-color)' }}>{student.email || 'No email'}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-secondary, #64748b)', marginTop: '2px' }}>{student.contact_numbers || student.contact_number || 'No phone'}</div>
                                    </td>
                                    <td>
                                        <span className="status-pill" style={{
                                            background: student.role === 'walkin_student' ? 'rgba(245,158,11,0.12)' : 'rgba(33,87,218,0.08)',
                                            color: student.role === 'walkin_student' ? '#d97706' : '#2157da',
                                        }}>
                                            {student.role === 'walkin_student' ? 'Walk-In' : 'Online'}
                                        </span>
                                    </td>
                                    {userRole !== 'staff' && (
                                        <td style={{ fontSize: '13px', color: 'var(--text-secondary, #64748b)' }}>
                                            {student.branch_name ? formatBranchName(student.branch_name) : 'Unassigned'}
                                        </td>
                                    )}
                                    <td>
                                        <span className={`status-pill ${(student.status || 'active').toLowerCase() === 'active' ? 'success' : 'collectable'}`}>
                                            {student.status || 'Active'}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button
                                            className="export-btn-secondary"
                                            onClick={() => handleManageCourses(student)}
                                            style={{ background: 'linear-gradient(135deg,#2157da,#1a4fba)', color: '#fff', border: 'none', gap: '6px' }}
                                        >
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
                                            Courses
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <Pagination
                    currentPage={crmPage}
                    totalPages={crmTotalPages}
                    onPageChange={(p) => setCrmPage(p)}
                    totalItems={filteredStudents.length}
                    pageSize={CRM_PAGE_SIZE}
                />
            </div>

            {/* Manage Courses Modal */}
            {showCoursesModal && selectedStudent && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCoursesModal(false)}>
                    <div className="modal-container" style={{ maxWidth: '720px' }}>
                        {/* Header */}
                        <div className="modal-header">
                            <div className="modal-header-left">
                                <div className="modal-header-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
                                </div>
                                <div>
                                    <h2>{selectedStudent.first_name} {selectedStudent.last_name}</h2>
                                    <p>{selectedStudent.email}</p>
                                </div>
                            </div>
                            <button className="close-modal" onClick={() => setShowCoursesModal(false)}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="modal-body custom-scroll" style={{ padding: '24px 28px' }}>
                            {loadingCourses ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary, #64748b)' }}>Loading courses...</div>
                            ) : studentBookings.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-color, #f8fafc)', borderRadius: '12px', border: '1px dashed var(--border-color, #e2e8f0)' }}>
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" style={{ marginBottom: '12px' }}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                                    <p style={{ margin: '0 0 6px 0', fontWeight: 700, color: 'var(--text-color)' }}>No Courses Found</p>
                                    <span style={{ fontSize: '13px', color: 'var(--text-secondary, #64748b)' }}>This student hasn't enrolled in any courses yet.</span>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gap: '12px' }}>
                                    {studentBookings.map(booking => (
                                        <div key={booking.id} style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
                                            padding: '16px 20px', background: 'var(--bg-color, #f8fafc)',
                                            borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)',
                                            borderLeft: `4px solid ${booking.status === 'completed' ? '#10b981' : booking.status === 'cancelled' ? '#ef4444' : '#2157da'}`,
                                        }}>
                                            <div>
                                                <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700, color: 'var(--text-color)' }}>{booking.course_name}</h4>
                                                <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-secondary, #64748b)', flexWrap: 'wrap' }}>
                                                    <span>Enrolled: {new Date(booking.created_at).toLocaleDateString()}</span>
                                                    {booking.branch_name && <span>Branch: {formatBranchName(booking.branch_name)}</span>}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span className={`status-pill ${booking.status === 'completed' ? 'success' : booking.status === 'cancelled' ? 'failed' : 'collectable'}`}>
                                                    {booking.status}
                                                </span>
                                                {booking.status !== 'completed' && booking.status !== 'cancelled' && (
                                                    <button
                                                        className="mark-paid-btn"
                                                        onClick={() => handleMarkCompleted(booking.id)}
                                                        style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}
                                                    >
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                        Mark Completed
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="modal-footer">
                            <div className="history-summary">
                                <div className="summary-badge">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
                                    <span><strong>{studentBookings.length}</strong> course{studentBookings.length !== 1 ? 's' : ''}</span>
                                </div>
                            </div>
                            <button className="confirm-btn" onClick={() => setShowCoursesModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CRMManagement;
