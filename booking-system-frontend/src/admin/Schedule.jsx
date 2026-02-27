import React, { useState, useEffect } from 'react';
import './css/schedule.css';
import { schedulesAPI, branchesAPI, authAPI, coursesAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';

const Schedule = () => {
    const { showNotification } = useNotification();

    // Use local date for initialization to avoid UTC mismatch (e.g. previous day)
    const getLocalDateString = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const today = getLocalDateString();
    const [selectedDate, setSelectedDate] = useState(getLocalDateString()); // Auto-select today on load
    const [viewDate, setViewDate] = useState(new Date()); // For month navigation
    const [showModal, setShowModal] = useState(false);
    const [showStudentModal, setShowStudentModal] = useState(false);
    const [showAutoModal, setShowAutoModal] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState('');
    const [courses, setCourses] = useState([]);

    const [formData, setFormData] = useState({
        type: 'tdc',
        time: '08:00 AM - 05:00 PM', // Default for Whole Day
        session: 'Whole Day',
        slots: 15,
        course_type: '',
        transmission: ''
    });

    const [autoData, setAutoData] = useState({
        startDate: getLocalDateString(),
        endDate: '',
        daysOfWeek: [1, 2, 3, 4, 5, 6], // Default Mon-Sat
        type: 'tdc',
        course_type: '',
        transmission: '',
        session: 'Whole Day',
        time: '08:00 AM - 05:00 PM',
        slots: 15
    });

    // Database state
    const [slots, setSlots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // API returns slots comprising the selected date (including multi-day overlaps)
    // So we can use slots directly, or filter ensuring overlap just to be safe
    // Also ensuring Sundays are ALWAYS empty (closed)
    const isSelectedSunday = () => {
        if (!selectedDate) return false;
        const [y, m, d] = selectedDate.split('-').map(Number);
        // Month is 0-indexed in JS Date
        return new Date(y, m - 1, d).getDay() === 0;
    };

    const filteredSlots = isSelectedSunday() ? [] : (slots.length > 0 ? slots : []);

    // Load slots from database
    useEffect(() => {
        loadSlots();
    }, [selectedDate, selectedBranch]);

    const [userRole, setUserRole] = useState(null);

    useEffect(() => {
        const fetchBranchesAndProfile = async () => {
            try {
                // Fetch profile first to determine restrictions
                const profileRes = await authAPI.getProfile();
                let role = 'guest';
                let profileBranchId = null;

                if (profileRes.success) {
                    role = profileRes.user.role;
                    profileBranchId = profileRes.user.branchId;
                    setUserRole(role);
                }

                // Fetch branches
                const response = await branchesAPI.getAll();
                let loadedBranches = response.branches || [];

                // Restrict viewing for staff
                if (role === 'staff' && profileBranchId) {
                    loadedBranches = loadedBranches.filter(b => String(b.id) === String(profileBranchId));
                    setSelectedBranch(String(profileBranchId));
                }

                // Fetch courses
                try {
                    const coursesRes = await coursesAPI.getAll();
                    if (coursesRes && coursesRes.courses) {
                        setCourses(coursesRes.courses);
                    }
                } catch (courseErr) {
                    console.error('Error fetching courses:', courseErr);
                }

                setBranches(loadedBranches);
            } catch (error) {
                console.error('Error fetching branches or profile:', error);
            }
        };
        fetchBranchesAndProfile();
    }, []);

    // Debug modal state changes
    useEffect(() => {
        console.log('showModal changed to:', showModal);
    }, [showModal]);

    const loadSlots = async () => {
        try {
            setLoading(true);
            setError(null);
            console.log('Loading slots for date:', selectedDate, 'branch:', selectedBranch);
            const response = await schedulesAPI.getSlotsByDate(selectedDate, selectedBranch || null);
            console.log('API Response:', response);

            // Transform database data to match component structure
            const transformedSlots = response.map(slot => {
                // Formatting helper that strictly treats ISO strings as YYYY-MM-DD literals
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
                    // Keep raw session value intact — use sessionLabel for display only
                    sessionLabel: `${slot.session} ${slot.type.toUpperCase()}`,
                    students: slot.enrollments || []
                };
            });
            console.log('Transformed slots:', transformedSlots);
            setSlots(transformedSlots);
        } catch (err) {
            console.error('Error loading slots:', err);
            setError('Failed to load slots. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const getAvailableTransmissions = (courseName) => {
        if (!courseName) return [];
        const course = courses.find(c => c.name === courseName);
        if (!course) return [];

        let available = [];
        const mainType = course.course_type || '';
        if (['manual', 'automatic'].includes(mainType.toLowerCase())) {
            available.push(mainType.charAt(0).toUpperCase() + mainType.slice(1).toLowerCase());
        }

        let pricingData = course.pricing_data;
        if (typeof pricingData === 'string') {
            try { pricingData = JSON.parse(pricingData); } catch (e) { pricingData = null; }
        }

        if (Array.isArray(pricingData)) {
            pricingData.forEach(p => {
                if (p && p.type && ['manual', 'automatic'].includes(p.type.toLowerCase())) {
                    const formattedType = p.type.charAt(0).toUpperCase() + p.type.slice(1).toLowerCase();
                    if (!available.includes(formattedType)) {
                        available.push(formattedType);
                    }
                }
            });
        }
        return available;
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
            if (value === 'tdc') {
                // TDC is always Whole Day — force it
                setFormData({ ...formData, [name]: value, session: 'Whole Day', time: '08:00 AM - 05:00 PM', course_type: '', transmission: '' });
            } else {
                // PDC: clear session so user MUST explicitly pick Morning/Afternoon/Whole Day
                setFormData({ ...formData, [name]: value, session: '', time: '', course_type: '', transmission: '' });
            }
        } else if (name === 'course_type') {
            const transmissions = getAvailableTransmissions(value);
            setFormData({
                ...formData,
                [name]: value,
                transmission: transmissions.length > 0 ? (transmissions.includes(formData.transmission) ? formData.transmission : transmissions[0]) : ''
            });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleAutoInputChange = (e) => {
        const { name, value, type, checked } = e.target;

        if (type === 'checkbox') {
            const dayValue = parseInt(value);
            if (checked) {
                setAutoData({ ...autoData, daysOfWeek: [...autoData.daysOfWeek, dayValue] });
            } else {
                setAutoData({ ...autoData, daysOfWeek: autoData.daysOfWeek.filter(d => d !== dayValue) });
            }
            return;
        }

        if (name === 'slots' && value < 1 && value !== '') return;

        if (name === 'session') {
            let autoTime = '';
            if (value === 'Morning') autoTime = '08:00 AM - 12:00 PM';
            else if (value === 'Afternoon') autoTime = '01:00 PM - 05:00 PM';
            else if (value === 'Whole Day') autoTime = '08:00 AM - 05:00 PM';
            setAutoData({ ...autoData, [name]: value, time: autoTime });
        } else if (name === 'type') {
            if (value === 'tdc') {
                setAutoData({ ...autoData, [name]: value, session: 'Whole Day', time: '08:00 AM - 05:00 PM', course_type: '', transmission: '' });
            } else {
                setAutoData({ ...autoData, [name]: value, session: '', time: '', course_type: '', transmission: '' });
            }
        } else if (name === 'course_type') {
            const transmissions = getAvailableTransmissions(value);
            setAutoData({
                ...autoData,
                [name]: value,
                transmission: transmissions.length > 0 ? (transmissions.includes(autoData.transmission) ? autoData.transmission : transmissions[0]) : ''
            });
        } else {
            setAutoData({ ...autoData, [name]: value });
        }
    };

    const handleAutoGenerate = async (e) => {
        e.preventDefault();
        setIsGenerating(true);
        try {
            if (!autoData.startDate || !autoData.endDate) {
                showNotification("Please select both start and end dates.", "error");
                setIsGenerating(false);
                return;
            }

            if (autoData.startDate < today) {
                showNotification("Start date cannot be in the past.", "error");
                setIsGenerating(false);
                return;
            }

            if (autoData.daysOfWeek.length === 0) {
                showNotification("Please select at least one day of the week.", "error");
                setIsGenerating(false);
                return;
            }

            let currentDate = new Date(autoData.startDate + 'T00:00:00');
            const end = new Date(autoData.endDate + 'T23:59:59'); // Make sure end represents end of day

            let slotCount = 0;
            const todayDate = new Date(today + 'T00:00:00');

            // Collect all api calls
            const creationPromises = [];

            while (currentDate <= end) {
                const dayOfWk = currentDate.getDay();

                // Only if day is selected, it's not Sunday, and date is not in the past
                if (autoData.daysOfWeek.includes(dayOfWk) && dayOfWk !== 0 && currentDate >= todayDate) {
                    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

                    const slotPayload = {
                        date: dateStr,
                        type: autoData.type,
                        session: autoData.session,
                        time_range: autoData.time,
                        total_capacity: parseInt(autoData.slots),
                        branch_id: selectedBranch || null,
                        course_type: autoData.course_type,
                        transmission: autoData.transmission
                    };

                    creationPromises.push(schedulesAPI.createSlot(slotPayload));
                    slotCount++;

                    // TDC takes 2 dates, so skip the next valid day?
                    // Usually TDC covers 2 days per single slot entry. So if we insert one TDC on Mon, it covers Mon-Tue.
                    // Depending on preference, users might want to skip the next day for TDC, but to keep it simple, 
                    // we'll just insert exactly on the days selected. If you meant to skip, uncomment below:
                    /*
                    if (autoData.type === 'tdc') {
                        currentDate.setDate(currentDate.getDate() + 1);
                        if (currentDate.getDay() === 0) currentDate.setDate(currentDate.getDate() + 1);
                    }
                    */
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }

            if (creationPromises.length === 0) {
                showNotification("No valid dates found in the selected range.", "warning");
                setIsGenerating(false);
                return;
            }

            // Await all created slots (batch)
            await Promise.allSettled(creationPromises);

            showNotification(`Successfully generated ${slotCount} slots!`, 'success');
            await loadSlots();
            setShowAutoModal(false);
        } catch (err) {
            console.error('Error generating slots:', err);
            showNotification('An error occurred while generating slots.', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveSlot = async (e) => {
        e.preventDefault();
        try {
            const baseCapacity = parseInt(formData.slots);

            const slotData = {
                date: selectedDate,
                type: formData.type,
                session: formData.session,
                time_range: formData.time,
                total_capacity: baseCapacity,
                branch_id: selectedBranch || null,
                course_type: formData.course_type,
                transmission: formData.transmission
            };

            if (editingId) {
                // Update existing slot
                const currentSlot = slots.find(s => s.id === editingId);
                const currentAvailableSlots = currentSlot?.available_slots || baseCapacity;
                const oldTotalCapacity = currentSlot?.total_capacity || baseCapacity;

                let newAvailableSlots = currentAvailableSlots;
                if (baseCapacity > oldTotalCapacity) {
                    newAvailableSlots = currentAvailableSlots + (baseCapacity - oldTotalCapacity);
                } else if (baseCapacity < oldTotalCapacity) {
                    newAvailableSlots = Math.max(0, currentAvailableSlots - (oldTotalCapacity - baseCapacity));
                }
                slotData.available_slots = newAvailableSlots;

                await schedulesAPI.updateSlot(editingId, slotData);
                showNotification('Slot updated successfully!', 'success');
            } else {
                // Create new slot — always a single entry for the selected date
                slotData.available_slots = baseCapacity;
                await schedulesAPI.createSlot(slotData);
                showNotification('Slot added successfully!', 'success');
            }

            await loadSlots();
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
            // slot.session is now the RAW value ('Morning', 'Afternoon', 'Whole Day')
            // since we stopped corrupting it in loadSlots
            setFormData({
                type: slot.type,
                time: slot.time_range || slot.time,
                session: slot.session,
                slots: slot.total_capacity || slot.slots,
                course_type: slot.course_type || '', // Wait for user if empty
                transmission: slot.transmission || (slot.type === 'tdc' ? '' : 'Manual')
            });
        } else {
            setEditingId(null);
            setFormData({
                type: 'tdc',
                time: '08:00 AM - 05:00 PM',
                session: 'Whole Day',
                slots: 15,
                course_type: '',
                transmission: ''
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

    const handleAttendanceUpdate = async (enrollmentId, currentStatus) => {
        try {
            const newStatus = currentStatus === 'completed' ? 'enrolled' : 'completed';
            await schedulesAPI.updateEnrollmentStatus(enrollmentId, newStatus);
            showNotification(`Student marked as ${newStatus === 'completed' ? 'Attended' : 'Enrolled'}!`, 'success');
            // Refresh modal list immediately
            const enrollments = await schedulesAPI.getSlotEnrollments(selectedSlot.id);
            setSelectedSlot({
                ...selectedSlot,
                students: enrollments.map(enrollment => ({
                    id: enrollment.id,
                    name: `${enrollment.student.first_name} ${enrollment.student.last_name}`,
                    phone: enrollment.student.contact_numbers || 'N/A',
                    status: enrollment.enrollment_status
                }))
            });
            await loadSlots(); // bg table slot counts update
        } catch (err) {
            console.error('Error updating status:', err);
            showNotification('Failed to update attendance.', 'error');
        }
    };

    const handleNoShowUpdate = async (enrollmentId) => {
        if (!window.confirm("Mark this student as NO-SHOW? This will remove them from the slot, require a ₱1,000 fee for rescheduling, and send them an email notification automatically.")) return;

        try {
            await schedulesAPI.markNoShow(enrollmentId);
            showNotification('Student marked as No-Show. Rescheduling Email Sent!', 'success');
            // Refresh modal list immediately
            const enrollments = await schedulesAPI.getSlotEnrollments(selectedSlot.id);
            setSelectedSlot({
                ...selectedSlot,
                students: enrollments.map(enrollment => ({
                    id: enrollment.id,
                    name: `${enrollment.student.first_name} ${enrollment.student.last_name}`,
                    phone: enrollment.student.contact_numbers || 'N/A',
                    status: enrollment.enrollment_status
                }))
            });
            await loadSlots(); // bg table slot counts update
        } catch (err) {
            console.error('Error marking no show:', err);
            showNotification('Failed to process No-Show action.', 'error');
        }
    };

    // Calculate day offset for display (e.g. Day 2 of 2)
    // Calculate day offset for display (e.g. Day 2 of 2)
    // Calculate day offset for display (e.g. Day 2 of 2), skipping Sundays
    const getDayInfo = (slot, viewDateStr) => {
        if (!slot.end_date || slot.date === slot.end_date) return null;

        // Use strict string date parsing
        const parseDate = (d) => {
            const [y, m, dstr] = d.split('-').map(Number);
            return new Date(y, m - 1, dstr); // Local midnight
        };

        const start = parseDate(slot.date);
        const current = parseDate(viewDateStr);
        const end = parseDate(slot.end_date);

        // Helper to count valid days (excluding Sundays)
        const countValidDays = (startDate, targetDate) => {
            let count = 0;
            let d = new Date(startDate);
            while (d <= targetDate) {
                if (d.getDay() !== 0) count++; // Count if not Sunday
                d.setDate(d.getDate() + 1);
            }
            return count;
        };

        const currentDayNum = countValidDays(start, current);
        const totalDaysNum = countValidDays(start, end);

        // If current day is 0 (e.g. looking at a date before start?), return null
        if (currentDayNum < 1) return null;

        return `Day ${currentDayNum} of ${totalDaysNum}`;
    };

    return (
        <div className="schedule-module">

            {/* Top Branch Filter Bar */}
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
                        disabled={userRole === 'staff'}
                    >
                        {userRole !== 'staff' && <option value="">All Branches / Default View</option>}
                        {branches.map(branch => {
                            let formattedName = branch.name;
                            const prefixes = ['Master Driving School ', 'Master Prime Driving School ', 'Masters Prime Holdings Corp. ', 'Master Prime Holdings Corp. '];
                            for (const prefix of prefixes) {
                                if (formattedName.startsWith(prefix)) {
                                    formattedName = formattedName.substring(prefix.length);
                                    break;
                                }
                            }
                            return <option key={branch.id} value={branch.id}>{formattedName}</option>
                        })}
                    </select>
                </div>
            </div>

            <div className="schedule-content">
                <div className="calendar-view">
                    <div className="calendar-header-nav">
                        <button className="month-nav-btn" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="15 18 9 12 15 6"></polyline>
                            </svg>
                        </button>
                        <h3 style={{ margin: 0 }}>{viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
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
                                // Day check for Sunday
                                const dayOfWeek = new Date(year, month, d).getDay();
                                const isSelected = selectedDate === dateStr;
                                const isToday = today === dateStr;
                                const isSunday = dayOfWeek === 0; // Sunday = 0
                                const isPast = dateStr < today; // Disable past dates
                                const isDisabled = isPast || isSunday; // Disable past dates and Sundays
                                const daySlots = slots.filter(s => {
                                    // Skip Sundays entirely
                                    if (dayOfWeek === 0) return false;
                                    const sStart = s.date;
                                    const sEnd = s.end_date || s.date;
                                    return dateStr >= sStart && dateStr <= sEnd;
                                });
                                const isAllFull = daySlots.length > 0 && daySlots.every(slot => slot.available_slots === 0);
                                const slotStatus = daySlots.length === 0 ? 'no-slots' : (isAllFull ? 'full-slots' : 'has-slots');

                                days.push(
                                    <div
                                        key={d}
                                        className={`calendar-day day-${dayOfWeek} ${slotStatus} ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${isDisabled ? 'is-past disabled' : ''}`}
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
                                                    title={`${slot.sessionLabel} (${slot.available_slots}/${slot.total_capacity} available)`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // Edit only — do NOT change the selected date
                                                        openModal(slot);
                                                    }}
                                                >
                                                    <div className="mini-slot-header">{slot.type?.toUpperCase()}</div>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span className="badge">{filteredSlots.length} Slots Found</span>
                            <button
                                className="add-btn"
                                onClick={() => setShowAutoModal(true)}
                                style={{
                                    padding: '6px 12px',
                                    background: 'var(--primary-light)',
                                    color: 'var(--primary-color)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '0.85rem',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                ⚡ Auto-Generate
                            </button>
                        </div>
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
                                {/* Time Column */}
                                <div className="slot-time">
                                    <div className="clock-icon">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                    </div>
                                    <span className="slot-time-label">{slot.time_range || slot.time}</span>
                                </div>

                                {/* Details Column */}
                                <div className="slot-details">
                                    <h4>
                                        {slot.sessionLabel}
                                        <span className={`slot-type-badge ${slot.type}`}>
                                            {slot.type?.toUpperCase()}
                                        </span>
                                        {slot.course_type && (
                                            <span style={{ fontSize: '0.7em', padding: '2px 6px', background: '#e2e8f0', color: '#475569', borderRadius: '4px', marginLeft: '6px', whiteSpace: 'nowrap' }}>
                                                {slot.course_type}
                                                {slot.transmission ? ` · ${slot.transmission}` : ''}
                                            </span>
                                        )}
                                    </h4>
                                    {slot.branch_id ? (
                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>
                                            📍 {branches.find(b => b.id === slot.branch_id)?.name || 'Unknown Branch'}
                                        </p>
                                    ) : (
                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>
                                            📍 Unassigned / Default Branch
                                        </p>
                                    )}
                                    {getDayInfo(slot, selectedDate) && (
                                        <p style={{ margin: (slot.branch_id ? '2px 0 0 0' : '4px 0 0 0') }}>📅 {getDayInfo(slot, selectedDate)} &nbsp;({slot.date} → {slot.end_date})</p>
                                    )}
                                </div>

                                {/* Capacity Column */}
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
                                            <>{slot.total_capacity - slot.available_slots} / {slot.total_capacity} Booked ({slot.available_slots} left)</>
                                        )}
                                    </span>
                                </div>

                                {/* Actions Column */}
                                <div className="slot-actions">
                                    <button className="edit-btn" onClick={() => openModal(slot)}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z"></path></svg>
                                        Edit
                                    </button>
                                    <button className="view-students-btn" onClick={() => openStudentModal(slot)}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
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
                                    <select name="session" value={formData.session} onChange={handleInputChange} required>
                                        <option value="" disabled>-- Select Session --</option>
                                        <option value="Morning" disabled={formData.type === 'tdc'}>🌅 Morning (08:00 AM – 12:00 PM)</option>
                                        <option value="Afternoon" disabled={formData.type === 'tdc'}>☀️ Afternoon (01:00 PM – 05:00 PM)</option>
                                        <option value="Whole Day">🕐 Whole Day (08:00 AM – 05:00 PM)</option>
                                    </select>
                                </div>

                                <div className="form-row">
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>{formData.type === 'tdc' ? 'Modality' : 'Course Type'}</label>
                                        <select name="course_type" value={formData.course_type} onChange={handleInputChange} required>
                                            <option value="" disabled>-- Select {formData.type === 'tdc' ? 'Modality' : 'Course'} --</option>
                                            {formData.type === 'tdc' ? (
                                                <>
                                                    <option value="F2F">Face-to-Face (F2F)</option>
                                                    <option value="Online">Online</option>
                                                </>
                                            ) : (
                                                courses.filter(c => c.category?.toLowerCase() === formData.type).map(c => (
                                                    <option key={c.id} value={c.name}>{c.name}</option>
                                                ))
                                            )}
                                        </select>
                                    </div>
                                    {formData.type === 'pdc' && (() => {
                                        const transmissions = getAvailableTransmissions(formData.course_type);
                                        if (transmissions.length === 0) return null;
                                        return (
                                            <div className="form-group" style={{ flex: 1 }}>
                                                <label>Transmission</label>
                                                <select name="transmission" value={formData.transmission} onChange={handleInputChange} required>
                                                    {transmissions.map(t => (
                                                        <option key={t} value={t}>{t}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Info Banner — only shown for TDC since it auto-spans 2 consecutive school days */}
                                {formData.type === 'tdc' && (() => {
                                    const getNextSchoolDayLabel = (dateStr) => {
                                        const [y, m, d] = dateStr.split('-').map(Number);
                                        const next = new Date(y, m - 1, d);
                                        next.setHours(12, 0, 0, 0);
                                        next.setDate(next.getDate() + 1);
                                        if (next.getDay() === 0) next.setDate(next.getDate() + 1);
                                        return next.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                    };
                                    const startLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                    const endLabel = getNextSchoolDayLabel(selectedDate);
                                    return (
                                        <div style={{
                                            background: 'linear-gradient(135deg, #2157da 0%, #1a3a8a 100%)',
                                            borderRadius: '12px',
                                            padding: '14px 18px',
                                            marginBottom: '4px',
                                            color: '#fff',
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: '12px'
                                        }}>
                                            <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>📅</span>
                                            <div>
                                                <p style={{ margin: '0 0 4px 0', fontWeight: '700', fontSize: '0.92rem' }}>
                                                    TDC — 1 booking covers both days (Day 1 &amp; Day 2)
                                                </p>
                                                <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.85 }}>
                                                    One TDC slot entry will cover <strong>{startLabel}</strong> → <strong>{endLabel}</strong> (Sundays skipped automatically).
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })()}

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
                                    {selectedSlot.sessionLabel} | {selectedSlot.time_range || selectedSlot.time}
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
                                            <th style={{ textAlign: 'center' }}>Actions</th>
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
                                                <td style={{ textAlign: 'center' }}>
                                                    {student.status !== 'no-show' && student.status !== 'cancelled' && (
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                            <button
                                                                onClick={() => handleAttendanceUpdate(student.id, student.status)}
                                                                style={{
                                                                    padding: '6px 12px',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: '600',
                                                                    borderRadius: '6px',
                                                                    border: 'none',
                                                                    background: student.status === 'completed' ? '#f59e0b' : '#10b981',
                                                                    color: 'white',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                {student.status === 'completed' ? 'Undo' : 'Attended'}
                                                            </button>
                                                            <button
                                                                onClick={() => handleNoShowUpdate(student.id)}
                                                                style={{
                                                                    padding: '6px 12px',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: '600',
                                                                    borderRadius: '6px',
                                                                    border: 'none',
                                                                    background: '#ef4444',
                                                                    color: 'white',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                Mark No-Show
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
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

            {/* Auto-Generate Modal */}
            {showAutoModal && (
                <div className="modal-overlay">
                    <div className="modal-container user-modal" style={{ maxWidth: '650px', width: '95%' }}>
                        <div className="modal-header" style={{ background: '#ffffff', color: '#1e293b', padding: '25px 25px 25px 25px', borderRadius: '16px 16px 0 0', borderBottom: '2px solid #e2e8f0', position: 'relative' }}>
                            <div style={{ paddingRight: '60px' }}>
                                <h2 style={{ margin: '0', fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>⚡ Auto-Generate Slots</h2>
                                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>Quickly create multiple slots over a date range.</p>
                            </div>
                            <button
                                className="close-modal"
                                onClick={() => setShowAutoModal(false)}
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
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                &times;
                            </button>
                        </div>
                        <form onSubmit={handleAutoGenerate}>
                            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', padding: '25px' }}>
                                <div className="form-row">
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>Start Date</label>
                                        <input type="date" name="startDate" value={autoData.startDate} min={today} onChange={handleAutoInputChange} required />
                                    </div>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>End Date</label>
                                        <input type="date" name="endDate" value={autoData.endDate} min={autoData.startDate || today} onChange={handleAutoInputChange} required />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Days of the Week</label>
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '5px' }}>
                                        {[
                                            { id: 1, label: 'Mon' }, { id: 2, label: 'Tue' }, { id: 3, label: 'Wed' },
                                            { id: 4, label: 'Thu' }, { id: 5, label: 'Fri' }, { id: 6, label: 'Sat' }
                                        ].map(day => (
                                            <label key={day.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', background: '#f1f5f9', padding: '6px 12px', borderRadius: '8px', border: autoData.daysOfWeek.includes(day.id) ? '2px solid var(--primary-color)' : '2px solid transparent' }}>
                                                <input
                                                    type="checkbox"
                                                    value={day.id}
                                                    checked={autoData.daysOfWeek.includes(day.id)}
                                                    onChange={handleAutoInputChange}
                                                    style={{ margin: 0 }}
                                                />
                                                <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>{day.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <small style={{ display: 'block', marginTop: '8px', color: '#64748b' }}>*Sundays are automatically excluded.</small>
                                </div>

                                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '20px 0' }} />

                                <div className="form-group">
                                    <label>Type</label>
                                    <select name="type" value={autoData.type} onChange={handleAutoInputChange}>
                                        <option value="tdc">TDC (Theoretical)</option>
                                        <option value="pdc">PDC (Practical)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Session</label>
                                    <select name="session" value={autoData.session} onChange={handleAutoInputChange} required>
                                        <option value="" disabled>-- Select Session --</option>
                                        <option value="Morning" disabled={autoData.type === 'tdc'}>🌅 Morning (08:00 AM – 12:00 PM)</option>
                                        <option value="Afternoon" disabled={autoData.type === 'tdc'}>☀️ Afternoon (01:00 PM – 05:00 PM)</option>
                                        <option value="Whole Day">🕐 Whole Day (08:00 AM – 05:00 PM)</option>
                                    </select>
                                </div>

                                <div className="form-row">
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>{autoData.type === 'tdc' ? 'Modality' : 'Course Type'}</label>
                                        <select name="course_type" value={autoData.course_type} onChange={handleAutoInputChange} required>
                                            <option value="" disabled>-- Select {autoData.type === 'tdc' ? 'Modality' : 'Course'} --</option>
                                            {autoData.type === 'tdc' ? (
                                                <>
                                                    <option value="F2F">Face-to-Face (F2F)</option>
                                                    <option value="Online">Online</option>
                                                </>
                                            ) : (
                                                courses.filter(c => c.category?.toLowerCase() === autoData.type).map(c => (
                                                    <option key={c.id} value={c.name}>{c.name}</option>
                                                ))
                                            )}
                                        </select>
                                    </div>
                                    {autoData.type === 'pdc' && (() => {
                                        const transmissions = getAvailableTransmissions(autoData.course_type);
                                        if (transmissions.length === 0) return null;
                                        return (
                                            <div className="form-group" style={{ flex: 1 }}>
                                                <label>Transmission</label>
                                                <select name="transmission" value={autoData.transmission} onChange={handleAutoInputChange} required>
                                                    {transmissions.map(t => (
                                                        <option key={t} value={t}>{t}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        );
                                    })()}
                                </div>

                                <div className="form-row">
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>Total Capacity per Slot</label>
                                        <input type="number" name="slots" min="1" value={autoData.slots} onChange={handleAutoInputChange} required />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="cancel-btn" onClick={() => setShowAutoModal(false)} disabled={isGenerating}>Cancel</button>
                                <button type="submit" className="confirm-btn" disabled={isGenerating}>
                                    {isGenerating ? 'Generating...' : 'Start Auto-Generate'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Schedule;
