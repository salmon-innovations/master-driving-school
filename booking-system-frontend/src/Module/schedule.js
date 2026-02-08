import React, { useState } from 'react';
import './css/schedule.css';

const Schedule = () => {
    const today = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(today);
    const [viewDate, setViewDate] = useState(new Date()); // For month navigation
    const [showModal, setShowModal] = useState(false);
    const [showStudentModal, setShowStudentModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [selectedSlot, setSelectedSlot] = useState(null);

    const [formData, setFormData] = useState({
        type: 'tdc',
        time: '',
        session: '',
        slots: 15
    });

    // Mock data with dates
    const [slots, setSlots] = useState([
        {
            id: 1, date: today, type: 'tdc', time: '08:00 AM - 12:00 PM', session: 'Morning TDC', slots: 15, available: 12,
            students: [
                { id: 101, name: 'Juan Dela Cruz', status: 'Confirmed', phone: '09171234567' },
                { id: 102, name: 'Maria Santos', status: 'Pending', phone: '09187654321' },
                { id: 103, name: 'Jose Rizal', status: 'Confirmed', phone: '09199998888' }
            ]
        },
        { id: 2, date: today, type: 'tdc', time: '01:00 PM - 05:00 PM', session: 'Afternoon TDC', slots: 15, available: 14, students: [{ id: 104, name: 'Andres Bonifacio', status: 'Confirmed', phone: '09201112222' }] },
        { id: 3, date: today, type: 'pdc', time: '07:00 AM - 09:00 AM', session: 'PDC - Manual', slots: 1, available: 0, students: [{ id: 105, name: 'Emilio Aguinaldo', status: 'Confirmed', phone: '09213334444' }] },
        { id: 4, date: today, type: 'pdc', time: '09:00 AM - 11:00 AM', session: 'PDC - Automatic', slots: 1, available: 1, students: [] },
        { id: 5, date: today, type: 'pdc', time: '01:00 PM - 03:00 PM', session: 'PDC - Motorcycle', slots: 1, available: 1, students: [] },

        // Next Week - Mon
        { id: 6, date: '2026-02-09', type: 'tdc', time: '08:00 AM - 12:00 PM', session: 'Morning TDC', slots: 20, available: 15, students: [] },
        { id: 7, date: '2026-02-09', type: 'pdc', time: '01:00 PM - 03:00 PM', session: 'PDC - Manual', slots: 1, available: 0, students: [{ id: 106, name: 'Apolinario Mabini', status: 'Confirmed', phone: '09225556666' }] },

        // Next Week - Tue
        { id: 8, date: '2026-02-10', type: 'tdc', time: '01:00 PM - 05:00 PM', session: 'Afternoon TDC', slots: 20, available: 10, students: [] },
        { id: 9, date: '2026-02-10', type: 'pdc', time: '07:00 AM - 09:00 AM', session: 'PDC - Automatic', slots: 1, available: 0, students: [{ id: 107, name: 'Gregorio del Pilar', status: 'Confirmed', phone: '09237778888' }] },

        // Next Week - Wed
        { id: 10, date: '2026-02-11', type: 'tdc', time: '08:00 AM - 12:00 PM', session: 'Morning TDC', slots: 15, available: 5, students: [] },
        { id: 11, date: '2026-02-11', type: 'pdc', time: '09:00 AM - 11:00 AM', session: 'PDC - Motorcycle', slots: 1, available: 1, students: [] },
        { id: 12, date: '2026-02-11', type: 'pdc', time: '03:00 PM - 05:00 PM', session: 'PDC - Manual', slots: 1, available: 0, students: [{ id: 108, name: 'Gabriela Silang', status: 'Confirmed', phone: '09241110000' }] },

        // Next Week - Thu
        { id: 13, date: '2026-02-12', type: 'tdc', time: '01:00 PM - 05:00 PM', session: 'Afternoon TDC', slots: 15, available: 15, students: [] },
        { id: 14, date: '2026-02-12', type: 'pdc', time: '10:00 AM - 12:00 PM', session: 'PDC - Automatic', slots: 1, available: 0, students: [{ id: 109, name: 'Melchora Aquino', status: 'Confirmed', phone: '09252223333' }] },

        // Valentine's Day Season
        { id: 15, date: '2026-02-14', type: 'pdc', time: '08:00 AM - 10:00 AM', session: 'Special Weekend PDC', slots: 2, available: 1, students: [{ id: 110, name: 'Lapu-Lapu', status: 'Confirmed', phone: '09264445555' }] },
    ]);

    const filteredSlots = slots.filter(slot => slot.date === selectedDate);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (name === 'slots' && value < 1 && value !== '') return;
        setFormData({ ...formData, [name]: value });
    };

    const handleSaveSlot = (e) => {
        e.preventDefault();
        if (editingId) {
            setSlots(slots.map(slot =>
                slot.id === editingId
                    ? { ...slot, ...formData, slots: parseInt(formData.slots) }
                    : slot
            ));
        } else {
            const newSlot = {
                id: slots.length + 1,
                date: selectedDate,
                ...formData,
                available: formData.slots,
                slots: parseInt(formData.slots),
                students: []
            };
            setSlots([...slots, newSlot]);
        }
        closeModal();
    };

    const openModal = (slot = null) => {
        if (slot) {
            setEditingId(slot.id);
            setFormData({
                type: slot.type,
                time: slot.time,
                session: slot.session,
                slots: slot.slots
            });
        } else {
            setEditingId(null);
            setFormData({
                type: 'tdc',
                time: '',
                session: '',
                slots: 15
            });
        }
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingId(null);
    };

    const openStudentModal = (slot) => {
        setSelectedSlot(slot);
        setShowStudentModal(true);
    };

    return (
        <div className="schedule-module">


            <div className="schedule-content">
                <div className="calendar-view">
                    <div className="calendar-header-nav">
                        <button className="month-nav-btn" onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() - 1)))}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                        </button>
                        <h3>{viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
                        <button className="month-nav-btn" onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() + 1)))}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
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
                                const dateObj = new Date(year, month, d);
                                const dateStr = dateObj.toISOString().split('T')[0];
                                const isSelected = selectedDate === dateStr;
                                const isToday = today === dateStr;
                                const daySlots = slots.filter(s => s.date === dateStr);

                                days.push(
                                    <div
                                        key={d}
                                        className={`calendar-day day-${dateObj.getDay()} ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                                        onClick={() => setSelectedDate(dateStr)}
                                    >
                                        <div className="day-header">
                                            <span className="day-num">{d}</span>
                                        </div>
                                        <div className="day-slots-container">
                                            {daySlots.map(slot => (
                                                <div
                                                    key={slot.id}
                                                    className={`mini-slot-item ${slot.type} ${slot.available === 0 ? 'full' : ''}`}
                                                    title={`${slot.session} (${slot.available}/${slot.slots} available)`}
                                                >
                                                    <div className="mini-slot-header">{slot.type.toUpperCase()}</div>
                                                    <div className="mini-slot-info">
                                                        <span className="mini-time">{slot.time.split(' - ')[0]}</span>
                                                        <span className="mini-status">{slot.available === 0 ? 'FULL' : `${slot.available} S`}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            className="quick-add-slot"
                                            title="Add Slot for this date"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedDate(dateStr);
                                                openModal();
                                            }}
                                        >
                                            +
                                        </button>
                                    </div>
                                );
                            }
                            return days;
                        })()}
                    </div>
                </div>

                <div className="slots-grid">
                    <div className="section-title">
                        <h3>Available Slots for {new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</h3>
                        <span className="badge">{filteredSlots.length} Slots Found</span>
                    </div>

                    <div className="slots-list">
                        {filteredSlots.length > 0 ? filteredSlots.map(slot => (
                            <div key={slot.id} className="slot-card">
                                <div className="slot-time">
                                    <div className="clock-icon">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                    </div>
                                    <span>{slot.time}</span>
                                </div>
                                <div className="slot-details">
                                    <h4>{slot.session}</h4>
                                </div>
                                <div className={`slot-capacity ${slot.available === 0 ? 'full' : ''}`}>
                                    <div className="progress-bar">
                                        <div
                                            className="progress-fill"
                                            style={{
                                                width: `${((slot.slots - slot.available) / slot.slots) * 100}%`,
                                                background: slot.available === 0 ? '#ef4444' : ''
                                            }}
                                        ></div>
                                    </div>
                                    <span className="capacity-text">
                                        {slot.available === 0 ? (
                                            <span className="status-full">FULLY BOOKED</span>
                                        ) : (
                                            <>{slot.slots - slot.available} / {slot.slots} Booked ({slot.available} Left)</>
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
                        <div className="modal-header">
                            <h2>{editingId ? 'Edit Slot' : 'Set New Slot'}</h2>
                            <button className="close-modal" onClick={closeModal}>&times;</button>
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
                                    <label>Session Title</label>
                                    <input
                                        type="text"
                                        name="session"
                                        placeholder="e.g. Morning Session"
                                        value={formData.session}
                                        onChange={handleInputChange}
                                        required
                                    />
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
                                        <input
                                            type="text"
                                            name="time"
                                            placeholder="e.g. 08:00 AM - 12:00 PM"
                                            value={formData.time}
                                            onChange={handleInputChange}
                                            required
                                        />
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
                        <div className="modal-header">
                            <div>
                                <h2>Enrolled Students</h2>
                                <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
                                    {selectedSlot.session} | {selectedSlot.time}
                                </p>
                            </div>
                            <button className="close-modal" onClick={() => setShowStudentModal(false)}>&times;</button>
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
