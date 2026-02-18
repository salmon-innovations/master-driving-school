import React, { useState, useEffect } from 'react';
import './css/schedule.css';
import { schedulesAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';

const Schedule = () => {
    const { showNotification } = useNotification();
    const today = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]); // Auto-select today on load
    const [viewDate, setViewDate] = useState(new Date()); // For month navigation
    const [showModal, setShowModal] = useState(false);
    const [showStudentModal, setShowStudentModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [selectedSlot, setSelectedSlot] = useState(null);

    const [formData, setFormData] = useState({
        type: 'tdc',
        time: '08:00 AM - 05:00 PM', // Default for Whole Day
        session: 'Whole Day',
        slots: 15
    });

    // Database state
    const [slots, setSlots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const filteredSlots = slots.filter(slot => slot.date === selectedDate);

    // Load slots from database
    useEffect(() => {
        loadSlots();
    }, [selectedDate]);

    // Debug modal state changes
    useEffect(() => {
        console.log('showModal changed to:', showModal);
    }, [showModal]);

    const loadSlots = async () => {
        try {
            setLoading(true);
            setError(null);
            console.log('Loading slots for date:', selectedDate);
            const response = await schedulesAPI.getSlotsByDate(selectedDate);
            console.log('API Response:', response);
            // Transform database data to match component structure
            const transformedSlots = response.map(slot => ({
                ...slot,
                date: selectedDate, // Add the date field from the selected date
                session: `${slot.session} ${slot.type.toUpperCase()}`,
                students: slot.enrollments || []
            }));
            console.log('Transformed slots:', transformedSlots);
            setSlots(transformedSlots);
        } catch (err) {
            console.error('Error loading slots:', err);
            setError('Failed to load slots. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (name === 'slots' && value < 1 && value !== '') return;

        // Auto-set time based on session
        if (name === 'session') {
            let autoTime = '';
            if (value === 'Morning') autoTime = '08:00 AM - 12:00 PM';
            else if (value === 'Afternoon') autoTime = '01:00 PM - 05:00 PM';
            else if (value === 'Whole Day') autoTime = '08:00 AM - 05:00 PM';

            setFormData({ ...formData, [name]: value, time: autoTime });
        } else if (name === 'type') {
            // If switching to TDC, set session to Whole Day
            if (value === 'tdc') {
                setFormData({ ...formData, [name]: value, session: 'Whole Day', time: '08:00 AM - 05:00 PM' });
            } else {
                // If switching to PDC while Whole Day is selected, revert to Morning
                if (formData.session === 'Whole Day') {
                    setFormData({ ...formData, [name]: value, session: 'Morning', time: '08:00 AM - 12:00 PM' });
                } else {
                    setFormData({ ...formData, [name]: value });
                }
            }
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleSaveSlot = async (e) => {
        e.preventDefault();
        try {
            const slotData = {
                date: selectedDate,
                type: formData.type,
                session: formData.session,
                time_range: formData.time,
                total_capacity: parseInt(formData.slots)
            };

            let savedSlot;
            if (editingId) {
                // Update existing slot
                // Find the current slot to preserve available_slots properly
                const currentSlot = slots.find(s => s.id === editingId);
                const currentAvailableSlots = currentSlot?.available_slots || parseInt(formData.slots);
                const oldTotalCapacity = currentSlot?.total_capacity || parseInt(formData.slots);
                const newTotalCapacity = parseInt(formData.slots);
                
                // If capacity increased, add the difference to available slots
                // If capacity decreased, reduce available slots proportionally
                let newAvailableSlots = currentAvailableSlots;
                if (newTotalCapacity > oldTotalCapacity) {
                    newAvailableSlots = currentAvailableSlots + (newTotalCapacity - oldTotalCapacity);
                } else if (newTotalCapacity < oldTotalCapacity) {
                    // Ensure we don't go below 0
                    const reduction = oldTotalCapacity - newTotalCapacity;
                    newAvailableSlots = Math.max(0, currentAvailableSlots - reduction);
                }
                
                slotData.available_slots = newAvailableSlots;
                
                savedSlot = await schedulesAPI.updateSlot(editingId, slotData);
                setSlots(slots.map(slot =>
                    slot.id === editingId
                        ? { ...slot, ...savedSlot, session: `${savedSlot.session} ${savedSlot.type.toUpperCase()}`, students: slot.students }
                        : slot
                ));
                showNotification('Slot updated successfully!', 'success');
            } else {
                // Create new slot - available_slots equals total_capacity initially
                slotData.available_slots = parseInt(formData.slots);
                savedSlot = await schedulesAPI.createSlot(slotData);
                const transformedSlot = {
                    ...savedSlot,
                    date: selectedDate,
                    session: `${savedSlot.session} ${savedSlot.type.toUpperCase()}`,
                    students: []
                };
                setSlots([...slots, transformedSlot]);
                showNotification('Slot added to database successfully!', 'success');
            }
            closeModal();
        } catch (err) {
            console.error('Error saving slot:', err);
            setError('Failed to save slot. Please try again.');
            showNotification('Error saving slot. Please try again.', 'error');
        }
    };

    const openModal = (slot = null) => {
        console.log('openModal called with:', slot);
        if (slot) {
            setEditingId(slot.id);
            // Extract session type from display format
            // "Morning TDC" -> "Morning"
            // "Afternoon PDC" -> "Afternoon"  
            // "Whole Day TDC" -> "Whole Day"
            const parts = slot.session.split(' ');
            const sessionType = parts.slice(0, -1).join(' '); // Remove last word (type), keep the rest
            setFormData({
                type: slot.type,
                time: slot.time_range || slot.time,
                session: sessionType,
                slots: slot.total_capacity || slot.slots
            });
        } else {
            setEditingId(null);
            setFormData({
                type: 'tdc',
                time: '08:00 AM - 05:00 PM', // Default for Whole Day
                session: 'Whole Day',
                slots: 15
            });
        }
        console.log('Setting showModal to true');
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingId(null);
    };

    const openStudentModal = async (slot) => {
        try {
            setSelectedSlot(slot);
            // Load enrollments for this slot
            const enrollments = await schedulesAPI.getSlotEnrollments(slot.id);
            setSelectedSlot({
                ...slot,
                students: enrollments.map(enrollment => ({
                    id: enrollment.id,
                    name: `${enrollment.student.first_name} ${enrollment.student.last_name}`,
                    phone: enrollment.student.contact_numbers || 'N/A',
                    status: enrollment.enrollment_status
                }))
            });
            setShowStudentModal(true);
        } catch (err) {
            console.error('Error loading enrollments:', err);
            setError('Failed to load student enrollments. Please try again.');
        }
    };

    return (
        <div className="schedule-module">


            <div className="schedule-content">
                <div className="calendar-view">
                    <div className="calendar-header-nav">
                        <button className="month-nav-btn" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="15 18 9 12 15 6"></polyline>
                            </svg>
                        </button>
                        <h3>{viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
                        <button className="month-nav-btn" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </button>
                    </div>

                    <div className="calendar-grid">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="calendar-day-header">{day}</div>
                        ))}
                        {(() => {
                            const year = viewDate.getFullYear();
                            const month = viewDate.getMonth();
                            const firstDay = new Date(year, month, 1).getDay();
                            const daysInMonth = new Date(year, month + 1, 0).getDate();
                            const days = [];

                            // Padding for start of month
                            for (let i = 0; i < firstDay; i++) {
                                days.push(<div key={`pad-${i}`} className="calendar-day empty"></div>);
                            }

                            // Actual days
                            for (let d = 1; d <= daysInMonth; d++) {
                                // Format date string directly to avoid timezone conversion issues
                                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                const dateObj = new Date(year, month, d);
                                const isSelected = selectedDate === dateStr;
                                const isToday = today === dateStr;
                                const isSunday = dateObj.getDay() === 0; // Sunday = 0
                                const isPast = dateStr < today; // Disable past dates
                                const isDisabled = isPast || isSunday; // Disable past dates and Sundays
                                const daySlots = slots.filter(s => s.date === dateStr);
                                const isAllFull = daySlots.length > 0 && daySlots.every(slot => slot.available_slots === 0);
                                const slotStatus = daySlots.length === 0 ? 'no-slots' : (isAllFull ? 'full-slots' : 'has-slots');

                                days.push(
                                    <div
                                        key={d}
                                        className={`calendar-day day-${dateObj.getDay()} ${slotStatus} ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${isDisabled ? 'is-past disabled' : ''}`}
                                        onClick={() => {
                                            if (!isDisabled) {
                                                setSelectedDate(dateStr);
                                                // Auto-open modal for creating new slot
                                                setTimeout(() => openModal(), 100);
                                            }
                                        }}
                                    >
                                        <div className="day-header">
                                            <span className="day-num">{d}</span>
                                        </div>
                                        <div className="day-slots-container">
                                            {daySlots.map(slot => (
                                                <div
                                                    key={slot.id}
                                                    className={`mini-slot-item ${slot.type} ${slot.available_slots === 0 ? 'full' : ''}`}
                                                    title={`${slot.session} (${slot.available_slots}/${slot.total_capacity} available)`}
                                                    onClick={(e) => {
                                                        if (!isDisabled) {
                                                            e.stopPropagation();
                                                            setSelectedDate(dateStr);
                                                            setTimeout(() => openModal(slot), 100);
                                                        }
                                                    }}
                                                >
                                                    <div className="mini-slot-header">{slot.type.toUpperCase()}</div>
                                                    <div className="mini-slot-info">
                                                        <span className="mini-time">{(slot.time_range || slot.time).split(' - ')[0]}</span>
                                                        <span className="mini-status">{slot.available_slots === 0 ? 'FULL' : `${slot.available_slots} S`}</span>
                                                    </div>
                                                </div>
                                            ))}
                                                                                    </div>
                                    </div>
                                );
                            }
                            return days;
                        })()}
                    </div>
                </div>

                <div className="slots-grid">
                    <div className="section-title">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <button className="month-nav-btn" onClick={() => {
                                const [year, month, day] = selectedDate.split('-').map(Number);
                                const newDate = new Date(year, month - 1, day - 1);
                                const newDateStr = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`;
                                setSelectedDate(newDateStr);
                            }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="15 18 9 12 15 6"></polyline>
                                </svg>
                            </button>
                            <h3>Available Slots for {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</h3>
                            <button className="month-nav-btn" onClick={() => {
                                const [year, month, day] = selectedDate.split('-').map(Number);
                                const newDate = new Date(year, month - 1, day + 1);
                                const newDateStr = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`;
                                setSelectedDate(newDateStr);
                            }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                            </button>
                        </div>
                        <span className="badge">{filteredSlots.length} Slots Found</span>
                    </div>

                    <div className="slots-list">
                        {loading ? (
                            <div className="loading-state">
                                <p>Loading slots...</p>
                            </div>
                        ) : error ? (
                            <div className="error-state">
                                <p>{error}</p>
                                <button onClick={loadSlots} className="retry-btn">Retry</button>
                            </div>
                        ) : filteredSlots.length > 0 ? filteredSlots.map(slot => (
                            <div key={slot.id} className="slot-card">
                                <div className="slot-time">
                                    <div className="clock-icon">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                    </div>
                                    <span>{slot.time_range || slot.time}</span>
                                </div>
                                <div className="slot-details">
                                    <h4>{slot.session}</h4>
                                </div>
                                <div className={`slot-capacity ${slot.available_slots === 0 ? 'full' : ''}`}>
                                    <div className="progress-bar">
                                        <div
                                            className="progress-fill"
                                            style={{
                                                width: `${((slot.total_capacity - slot.available_slots) / slot.total_capacity) * 100}%`,
                                                background: slot.available_slots === 0 ? '#ef4444' : ''
                                            }}
                                        ></div>
                                    </div>
                                    <span className="capacity-text">
                                        {slot.available_slots === 0 ? (
                                            <span className="status-full">FULLY BOOKED</span>
                                        ) : (
                                            <>{slot.total_capacity - slot.available_slots} / {slot.total_capacity} Booked ({slot.available_slots} Left)</>
                                        )}
                                    </span>
                                </div>
                                <div className="slot-actions">
                                    <button className="edit-btn" onClick={() => openModal(slot)}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z"></path></svg>
                                        Edit
                                    </button>
                                    <button className="view-students-btn" onClick={() => openStudentModal(slot)}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                                        Students ({slot.students?.length || 0})
                                    </button>
                                </div>
                            </div>
                        )) : (
                            <div className="no-slots">
                                <p>No slots scheduled for this date.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Edit/Add Slot Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-container">
                        <div className="modal-header" style={{ background: '#ffffff', color: '#1e293b', padding: '25px 25px 25px 25px', borderRadius: '16px 16px 0 0', borderBottom: '2px solid #e2e8f0', position: 'relative' }}>
                            <div style={{ paddingRight: '60px' }}>
                                <h2 style={{ margin: '0', fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>{editingId ? 'Edit Slot' : 'Set New Slot'}</h2>
                            </div>
                            <button 
                                className="close-modal" 
                                onClick={closeModal}
                                style={{ 
                                    position: 'absolute',
                                    top: '25px',
                                    right: '25px',
                                    background: '#f1f5f9', 
                                    border: 'none', 
                                    color: '#64748b', 
                                    fontSize: '24px', 
                                    width: '40px', 
                                    height: '40px', 
                                    minWidth: '40px',
                                    minHeight: '40px',
                                    borderRadius: '8px', 
                                    cursor: 'pointer', 
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#e2e8f0';
                                    e.currentTarget.style.color = '#1e293b';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#f1f5f9';
                                    e.currentTarget.style.color = '#64748b';
                                }}
                            >
                                &times;
                            </button>
                        </div>
                        <form onSubmit={handleSaveSlot}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Type</label>
                                    <select name="type" value={formData.type} onChange={handleInputChange}>
                                        <option value="tdc">TDC (Theoretical)</option>
                                        <option value="pdc">PDC (Practical)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Session</label>
                                    <select name="session" value={formData.session} onChange={handleInputChange}>
                                        <option value="Morning" disabled={formData.type === 'tdc'}>Morning Session</option>
                                        <option value="Afternoon" disabled={formData.type === 'tdc'}>Afternoon Session</option>
                                        <option value="Whole Day">Whole Day Session</option>
                                    </select>
                                </div>
                                <div className="form-row">
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>Total Capacity</label>
                                        <input
                                            type="number"
                                            name="slots"
                                            min="1"
                                            value={formData.slots}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                    <div className="form-group" style={{ flex: 2 }}>
                                        <label>Time Range</label>
                                        <select
                                            name="time"
                                            value={formData.time}
                                            onChange={handleInputChange}
                                            required
                                        >
                                            <option value="">Select Time</option>
                                            <option value="08:00 AM - 12:00 PM">08:00 AM - 12:00 PM</option>
                                            <option value="01:00 PM - 05:00 PM">01:00 PM - 05:00 PM</option>
                                            <option value="08:00 AM - 05:00 PM">08:00 AM - 05:00 PM</option>
                                            <option value="07:00 AM - 09:00 AM">07:00 AM - 09:00 AM</option>
                                            <option value="08:00 AM - 10:00 AM">08:00 AM - 10:00 AM</option>
                                            <option value="09:00 AM - 11:00 AM">09:00 AM - 11:00 AM</option>
                                            <option value="10:00 AM - 12:00 PM">10:00 AM - 12:00 PM</option>
                                            <option value="01:00 PM - 03:00 PM">01:00 PM - 03:00 PM</option>
                                            <option value="03:00 PM - 05:00 PM">03:00 PM - 05:00 PM</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="cancel-btn" onClick={closeModal}>Cancel</button>
                                <button type="submit" className="confirm-btn">{editingId ? 'Update Slot' : 'Create Slot'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* View Students Modal */}
            {showStudentModal && selectedSlot && (
                <div className="modal-overlay">
                    <div className="modal-container student-list-modal">
                        <div className="modal-header" style={{ background: '#ffffff', color: '#1e293b', padding: '25px 25px 25px 25px', borderRadius: '16px 16px 0 0', borderBottom: '2px solid #e2e8f0', position: 'relative' }}>
                            <div style={{ paddingRight: '60px' }}>
                                <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>Enrolled Students</h2>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                                    {selectedSlot.session} | {selectedSlot.time_range || selectedSlot.time}
                                </p>
                            </div>
                            <button 
                                className="close-modal" 
                                onClick={() => setShowStudentModal(false)}
                                style={{ 
                                    position: 'absolute',
                                    top: '25px',
                                    right: '25px',
                                    background: '#f1f5f9', 
                                    border: 'none', 
                                    color: '#64748b', 
                                    fontSize: '24px', 
                                    width: '40px', 
                                    height: '40px', 
                                    minWidth: '40px',
                                    minHeight: '40px',
                                    borderRadius: '8px', 
                                    cursor: 'pointer', 
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#e2e8f0';
                                    e.currentTarget.style.color = '#1e293b';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#f1f5f9';
                                    e.currentTarget.style.color = '#64748b';
                                }}
                            >
                                &times;
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="student-table-wrapper">
                                <table className="student-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Contact</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedSlot.students?.length > 0 ? selectedSlot.students.map(student => (
                                            <tr key={student.id}>
                                                <td className="st-name">{student.name}</td>
                                                <td className="st-phone">{student.phone}</td>
                                                <td>
                                                    <span className={`st-status ${student.status.toLowerCase()}`}>
                                                        {student.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan="3" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                                                    No students enrolled in this slot yet.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="confirm-btn" onClick={() => setShowStudentModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Schedule;
