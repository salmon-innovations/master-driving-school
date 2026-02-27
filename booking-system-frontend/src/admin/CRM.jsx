import React, { useState, useEffect } from 'react';
import './css/crm.css';
import { adminAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';

const CRMManagement = () => {
    const { showNotification } = useNotification();

    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Course Management Modal State
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [studentBookings, setStudentBookings] = useState([]);
    const [showCoursesModal, setShowCoursesModal] = useState(false);
    const [loadingCourses, setLoadingCourses] = useState(false);

    useEffect(() => {
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
        if (formattedName === 'Not Assigned' || formattedName === 'Not enrolled' || formattedName === 'All Branches' || formattedName === 'Unassigned') return formattedName;
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
            // Fetch all users (limiting to a large number to ensure we get all)
            const response = await adminAPI.getAllUsers(null, 5000);
            if (response.users) {
                // Filter only students and walk-in students
                const filteredStudents = response.users.filter(user =>
                    user.role === 'student' || user.role === 'walkin_student'
                );
                setStudents(filteredStudents);
            }
        } catch (error) {
            console.error('Error fetching students:', error);
            showNotification('Failed to load students data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
    };

    const filteredStudents = students.filter(student => {
        const fullName = `${student.first_name || ''} ${student.last_name || ''}`.toLowerCase();
        const email = (student.email || '').toLowerCase();
        const search = searchTerm.toLowerCase();
        return fullName.includes(search) || email.includes(search);
    });

    const handleManageCourses = async (student) => {
        setSelectedStudent(student);
        setShowCoursesModal(true);
        setLoadingCourses(true);
        try {
            // Fetch all bookings and filter for this student
            const response = await adminAPI.getAllBookings(null, 5000);
            if (response.success) {
                const bookings = response.bookings.filter(b => b.user_id === student.id);
                setStudentBookings(bookings);
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
                // Update local state
                setStudentBookings(prev => prev.map(booking =>
                    booking.id === bookingId ? { ...booking, status: 'completed' } : booking
                ));
            }
        } catch (error) {
            console.error('Error marking course complete:', error);
            showNotification(error.response?.data?.error || 'Failed to update course status', 'error');
        }
    };

    return (
        <div className="crm-container">
            {/* Header */}
            <div className="crm-header" style={{ marginBottom: '30px' }}>
                <div className="header-left">
                    <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-color)' }}>Student Database</h1>
                    <p style={{ color: 'var(--secondary-text)' }}>View and manage all enrolled and walk-in students</p>
                </div>
            </div>

            {/* Controls */}
            <div className="crm-filters" style={{ marginBottom: '20px', display: 'flex', gap: '15px' }}>
                <div className="search-box" style={{ flex: 1, position: 'relative' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
                    <input
                        type="text"
                        placeholder="Search students by name or email..."
                        value={searchTerm}
                        onChange={handleSearch}
                        style={{ width: '100%', padding: '14px 15px 14px 45px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-color)' }}
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--primary-light)', color: 'var(--primary-color)', padding: '0 20px', borderRadius: '12px', fontWeight: 'bold' }}>
                    Total: {filteredStudents.length}
                </div>
            </div>

            {/* Students Table */}
            <div className="crm-table-container" style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--secondary-text)' }}>Loading students...</div>
                ) : (
                    <table className="crm-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr>
                                <th style={{ padding: '16px 20px', background: 'var(--bg-color)', color: 'var(--secondary-text)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)' }}>Student Info</th>
                                <th style={{ padding: '16px 20px', background: 'var(--bg-color)', color: 'var(--secondary-text)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)' }}>Contact</th>
                                <th style={{ padding: '16px 20px', background: 'var(--bg-color)', color: 'var(--secondary-text)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)' }}>Type</th>
                                <th style={{ padding: '16px 20px', background: 'var(--bg-color)', color: 'var(--secondary-text)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)' }}>Branch</th>
                                <th style={{ padding: '16px 20px', background: 'var(--bg-color)', color: 'var(--secondary-text)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)' }}>Status</th>
                                <th style={{ padding: '16px 20px', background: 'var(--bg-color)', color: 'var(--secondary-text)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStudents.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: 'var(--secondary-text)' }}>
                                        No students found.
                                    </td>
                                </tr>
                            ) : (
                                filteredStudents.map(student => (
                                    <tr key={student.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                                    {(student.first_name?.[0] || '') + (student.last_name?.[0] || '')}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: '600', color: 'var(--text-color)' }}>
                                                        {student.first_name} {student.last_name}
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--secondary-text)' }}>
                                                        Age: {student.age || 'N/A'} • {student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : 'Unknown'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ color: 'var(--text-color)', fontSize: '0.9rem' }}>{student.email || 'No email provided'}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--secondary-text)', marginTop: '4px' }}>{student.contact_numbers || student.contact_number || 'No phone'}</div>
                                        </td>
                                        <td style={{ padding: '16px 20px' }}>
                                            <span style={{
                                                padding: '6px 12px',
                                                borderRadius: '20px',
                                                fontSize: '0.75rem',
                                                fontWeight: 'bold',
                                                background: student.role === 'walkin_student' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                                color: student.role === 'walkin_student' ? '#d97706' : '#10b981',
                                                textTransform: 'uppercase'
                                            }}>
                                                {student.role === 'walkin_student' ? 'Walk-In Student' : 'Online Student'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ color: 'var(--text-color)', fontSize: '0.9rem', fontWeight: '500' }}>
                                                {student.branch_name ? formatBranchName(student.branch_name) : 'Unassigned'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 20px' }}>
                                            <span style={{
                                                padding: '6px 12px',
                                                borderRadius: '20px',
                                                fontSize: '0.75rem',
                                                fontWeight: 'bold',
                                                background: student.status === 'active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                                                color: student.status === 'active' ? '#10b981' : '#64748b',
                                                textTransform: 'uppercase'
                                            }}>
                                                {student.status || 'Active'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                                            <button
                                                onClick={() => handleManageCourses(student)}
                                                style={{
                                                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '8px 16px',
                                                    borderRadius: '8px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
                                                    transition: 'transform 0.2s',
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                                onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                            >
                                                Manage Courses
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Manage Courses Modal */}
            {showCoursesModal && selectedStudent && (
                <div className="modal-overlay" style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div style={{
                        background: 'var(--card-bg)', width: '90%', maxWidth: '750px',
                        borderRadius: '20px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                        border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column',
                        maxHeight: '90vh'
                    }}>
                        {/* Modal Header */}
                        <div style={{ padding: '25px', borderBottom: '1px solid var(--border-color)', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ margin: '0 0 5px 0', fontSize: '1.4rem', color: 'var(--text-color)' }}>Student Courses</h2>
                                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--secondary-text)' }}>
                                    {selectedStudent.first_name} {selectedStudent.last_name} • {selectedStudent.email}
                                </p>
                            </div>
                            <button onClick={() => setShowCoursesModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--secondary-text)', padding: '5px' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: '25px', overflowY: 'auto', flex: 1 }}>
                            {loadingCourses ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--secondary-text)' }}>Loading courses...</div>
                            ) : studentBookings.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-color)', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--secondary-text)" strokeWidth="1" style={{ marginBottom: '15px', opacity: 0.5 }}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                                    <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-color)' }}>No Courses Found</h3>
                                    <p style={{ margin: 0, color: 'var(--secondary-text)' }}>This student hasn't enrolled in any courses yet.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gap: '15px' }}>
                                    {studentBookings.map(booking => (
                                        <div key={booking.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px', background: 'var(--bg-color)', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: booking.status === 'completed' ? '4px solid #10b981' : '4px solid #3b82f6', transition: 'transform 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                            <div>
                                                <h4 style={{ margin: '0 0 5px 0', fontSize: '1.1rem', color: 'var(--text-color)' }}>{booking.course_name}</h4>
                                                <div style={{ display: 'flex', gap: '15px', fontSize: '0.85rem', color: 'var(--secondary-text)' }}>
                                                    <span>Enrolled: {new Date(booking.created_at).toLocaleDateString()}</span>
                                                    <span>Branch: {booking.branch_name || 'N/A'}</span>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                <span style={{
                                                    padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase',
                                                    background: booking.status === 'completed' ? '#d1fae5' : booking.status === 'cancelled' ? '#fee2e2' : '#dbeafe',
                                                    color: booking.status === 'completed' ? '#065f46' : booking.status === 'cancelled' ? '#991b1b' : '#1e40af'
                                                }}>
                                                    {booking.status}
                                                </span>

                                                {booking.status !== 'completed' && booking.status !== 'cancelled' && (
                                                    <button
                                                        onClick={() => handleMarkCompleted(booking.id)}
                                                        style={{
                                                            background: '#10b981', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)', transition: 'background 0.2s'
                                                        }}
                                                        onMouseOver={(e) => e.currentTarget.style.background = '#059669'}
                                                        onMouseOut={(e) => e.currentTarget.style.background = '#10b981'}
                                                    >
                                                        Mark Completed
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CRMManagement;
