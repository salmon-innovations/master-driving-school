import React, { useState, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';
import { branchesAPI, coursesAPI, schedulesAPI, adminAPI } from '../services/api';
import './css/walkInEnrollment.css';

const logo = '/images/logo.png';

const WalkInEnrollment = ({ onEnroll, adminProfile }) => {
    const { showNotification } = useNotification();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [branches, setBranches] = useState([]);

    // Format branch name - remove company prefixes for cleaner display
    const formatBranchName = (name) => {
        if (!name) return name;
        const prefixes = [
            'Master Driving School ',
            'Master Prime Driving School ',
            'Masters Prime Holdings Corp. ',
            'Master Prime Holdings Corp. '
        ];
        let formattedName = name;
        for (const prefix of prefixes) {
            if (formattedName.startsWith(prefix)) {
                formattedName = formattedName.substring(prefix.length);
                break;
            }
        }
        return formattedName;
    };
    const [courses, setCourses] = useState([]);

    // Schedule selection state
    const [scheduleSlots, setScheduleSlots] = useState([]);
    const [selectedScheduleDate, setSelectedScheduleDate] = useState('');
    const [viewDate, setViewDate] = useState(new Date());
    const [loadingSchedule, setLoadingSchedule] = useState(false);
    const today = new Date().toISOString().split('T')[0];
    const [formErrors, setFormErrors] = useState({});
    const [pdcSessionFilter, setPdcSessionFilter] = useState('All');

    const [formData, setFormData] = useState({
        // Personal Details (Sign Up style)
        firstName: '',
        middleName: '',
        lastName: '',
        age: '',
        gender: '',
        birthday: '',
        nationality: '',
        maritalStatus: '',

        // Contact Details
        address: '',
        zipCode: '',
        birthPlace: '',
        contactNumbers: '',
        email: '',
        emergencyContactPerson: '',
        emergencyContactNumber: '',

        // Enrollment Details
        course: null, // Full course object
        courseType: '', // online/face-to-face or manual/automatic
        branchId: '',
        branchName: '',

        // Schedule Details
        scheduleDate: '',
        scheduleSlotId: null,
        scheduleSession: '',
        scheduleTime: '',
        // Second schedule for TDC (15-hour courses need 2 days)
        scheduleDate2: '',
        scheduleSlotId2: null,
        scheduleSession2: '',
        scheduleTime2: '',

        // Payment Details
        paymentMethod: 'Cash',
        amountPaid: '',
        paymentStatus: 'Full Payment',
        transactionNo: ''
    });

    // Transform database courses to match UI structure
    const packages = courses.map(course => {
        // Build type options array
        const typeOptions = [];

        // Add main course type with its price
        if (course.course_type) {
            typeOptions.push({
                value: course.course_type.toLowerCase().replace(/\s+/g, '-'),
                label: course.course_type.toUpperCase(),
                price: parseFloat(course.price)
            });
        }

        // Add pricing variations as additional type options
        if (course.pricing_data && Array.isArray(course.pricing_data)) {
            course.pricing_data.forEach(variation => {
                typeOptions.push({
                    value: variation.type.toLowerCase().replace(/\s+/g, '-'),
                    label: variation.type.toUpperCase(),
                    price: parseFloat(variation.price)
                });
            });
        }

        // If no type options, create a default one
        if (typeOptions.length === 0) {
            typeOptions.push({
                value: 'standard',
                label: 'STANDARD',
                price: parseFloat(course.price)
            });
        }

        // Parse images - handle both array and JSON string formats
        let courseImages = [];
        if (course.image_url) {
            try {
                courseImages = typeof course.image_url === 'string'
                    ? JSON.parse(course.image_url)
                    : course.image_url;

                // Ensure it's an array
                if (!Array.isArray(courseImages)) {
                    courseImages = [courseImages];
                }

                // Add data URI prefix if it's a base64 string without it
                courseImages = courseImages.map(img => {
                    if (img && !img.startsWith('data:') && !img.startsWith('http') && !img.startsWith('/')) {
                        return `data:image/jpeg;base64,${img}`;
                    }
                    return img;
                });
            } catch (e) {
                courseImages = [];
            }
        }

        // Extract features from description or use defaults
        const features = course.description
            ? course.description.split(/[.\n]/).filter(f => f.trim() && f.length > 10).slice(0, 5)
            : [
                'Comprehensive driving training',
                'Experienced certified instructors',
                'LTO exam preparation',
                'Flexible schedule options',
                'Modern training facilities'
            ];

        // Determine display name and short name
        const displayName = course.name || 'Unnamed Course';
        const shortName = displayName.includes('(')
            ? displayName.split('(')[0].trim()
            : displayName.split('-')[0].trim();

        return {
            id: course.id,
            name: displayName,
            shortName: shortName,
            duration: `${course.duration || 8} Hours`,
            price: parseFloat(course.price) || 0,
            image: courseImages.length > 0 ? courseImages[0] : '/images/default-course.jpg',
            features: features,
            hasTypeOption: true,
            typeOptions: typeOptions,
            category: course.category || 'Basic',
            description: course.description || 'Professional driving course with comprehensive training'
        };
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch branches
                const branchResponse = await branchesAPI.getAll();
                if (branchResponse.success) {
                    setBranches(branchResponse.branches);

                    // Staff: auto-select their assigned branch (locked)
                    // Admin/HRM: default to first branch but can change
                    if (adminProfile?.rawRole === 'staff' && adminProfile?.branchId) {
                        const userBranch = branchResponse.branches.find(b => b.id === adminProfile.branchId);
                        if (userBranch) {
                            setFormData(prev => ({
                                ...prev,
                                branchId: String(userBranch.id),
                                branchName: userBranch.name
                            }));
                        }
                    } else if (branchResponse.branches.length > 0) {
                        setFormData(prev => ({
                            ...prev,
                            branchId: String(branchResponse.branches[0].id),
                            branchName: branchResponse.branches[0].name
                        }));
                    }
                }

                // Fetch courses
                const coursesResponse = await coursesAPI.getAll();
                if (coursesResponse.success) {
                    // Only show active courses
                    const activeCourses = coursesResponse.courses.filter(c => c.status === 'active');
                    console.log('Fetched active courses:', activeCourses);
                    setCourses(activeCourses);
                } else {
                    console.error('Failed to fetch courses:', coursesResponse);
                }
            } catch (err) {
                console.error('Error fetching data:', err);
                showNotification('Failed to load courses and branches', 'error');
            } finally {
                setLoading(false);
            }
        };
        setLoading(true);
        fetchData();
    }, [adminProfile]);

    // Load schedule slots when date is selected OR all upcoming for TDC
    useEffect(() => {
        if (step !== 3) return;

        const loadScheduleSlots = async () => {
            try {
                setLoadingSchedule(true);
                let slots = [];

                const isTDC = formData.course?.category === 'TDC';

                if (isTDC) {
                    // Fetch all upcoming TDC slots without requiring a date
                    slots = await schedulesAPI.getSlotsByDate(null, formData.branchId, 'TDC');
                } else {
                    // PDC requires a specific date selected on the calendar
                    if (!selectedScheduleDate) {
                        setScheduleSlots([]);
                        setLoadingSchedule(false);
                        return;
                    }
                    slots = await schedulesAPI.getSlotsByDate(selectedScheduleDate, formData.branchId, 'PDC');
                }

                // Transform and filter available slots
                const transformedSlots = slots.map(slot => {
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
                        session: `${slot.session} ${slot.type.toUpperCase()}`,
                        students: slot.enrollments || []
                    };
                }).filter(slot => slot.available_slots > 0);

                setScheduleSlots(transformedSlots);
            } catch (err) {
                console.error('Error loading schedule slots:', err);
                showNotification('Failed to load schedule slots', 'error');
            } finally {
                setLoadingSchedule(false);
            }
        };

        loadScheduleSlots();
    }, [selectedScheduleDate, step, formData.course?.category, formData.branchId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear error for the field when user types
        if (formErrors[name]) {
            setFormErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const handleLettersOnly = (e) => {
        const { name, value } = e.target;
        const lettersOnly = value.replace(/[^a-zA-Z\s\-'ñÑ]/g, '');
        setFormData(prev => ({ ...prev, [name]: lettersOnly }));
        if (formErrors[name]) {
            setFormErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const handleZipCode = (e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
        setFormData(prev => ({ ...prev, zipCode: digits }));
        if (formErrors.zipCode) {
            setFormErrors(prev => ({ ...prev, zipCode: '' }));
        }
    };

    const handleAge = (e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 3);
        setFormData(prev => ({ ...prev, age: digits }));
        if (digits && (parseInt(digits) < 16 || parseInt(digits) > 100)) {
            setFormErrors(prev => ({ ...prev, age: 'Age must be between 16 and 100' }));
        } else if (formErrors.age) {
            setFormErrors(prev => ({ ...prev, age: '' }));
        }
    };

    const handlePhoneChange = (fieldName, value) => {
        const digits = value.replace(/\D/g, '');
        // Must start with 09
        if (digits.length >= 1 && digits[0] !== '0') return;
        if (digits.length >= 2 && digits[1] !== '9') return;
        // Limit to 11 digits
        const limited = digits.slice(0, 11);
        // Format as 09XX XXX XXXX
        let formatted = limited;
        if (limited.length > 4) formatted = `${limited.slice(0, 4)} ${limited.slice(4)}`;
        if (limited.length > 7) formatted = `${limited.slice(0, 4)} ${limited.slice(4, 7)} ${limited.slice(7)}`;
        setFormData(prev => ({ ...prev, [fieldName]: formatted }));
        if (limited.length === 11) {
            setFormErrors(prev => ({ ...prev, [fieldName]: '' }));
        } else if (limited.length > 0) {
            setFormErrors(prev => ({ ...prev, [fieldName]: 'Must be 11 digits (09XX XXX XXXX)' }));
        } else {
            setFormErrors(prev => ({ ...prev, [fieldName]: '' }));
        }
    };

    const handleEmailChange = (value) => {
        setFormData(prev => ({ ...prev, email: value }));
        if (value && !value.endsWith('@gmail.com')) {
            setFormErrors(prev => ({ ...prev, email: 'Email must end with @gmail.com' }));
        } else if (value && value.split('@')[0].length === 0) {
            setFormErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }));
        } else {
            setFormErrors(prev => ({ ...prev, email: '' }));
        }
    };

    const validateStep1 = () => {
        const errors = {};
        // Personal Info
        if (!formData.firstName.trim()) errors.firstName = 'First name is required';
        if (!formData.lastName.trim()) errors.lastName = 'Last name is required';
        if (!formData.age) {
            errors.age = 'Age is required';
        } else if (parseInt(formData.age) < 16 || parseInt(formData.age) > 100) {
            errors.age = 'Age must be between 16 and 100';
        }
        if (!formData.gender) errors.gender = 'Please select a gender';
        if (!formData.birthday) {
            errors.birthday = 'Birthday is required';
        } else {
            const bday = new Date(formData.birthday);
            const ageDiff = new Date().getFullYear() - bday.getFullYear();
            if (ageDiff < 16) errors.birthday = 'Must be at least 16 years old';
        }
        if (!formData.nationality.trim()) errors.nationality = 'Nationality is required';
        if (!formData.maritalStatus) errors.maritalStatus = 'Please select marital status';

        // Contact Details
        if (!formData.address.trim()) errors.address = 'Address is required';
        if (!formData.zipCode.trim()) {
            errors.zipCode = 'Zip code is required';
        } else if (formData.zipCode.length !== 4) {
            errors.zipCode = 'Zip code must be 4 digits';
        }
        if (!formData.birthPlace.trim()) errors.birthPlace = 'Birth place is required';
        const contactDigits = formData.contactNumbers.replace(/\D/g, '');
        if (!contactDigits || contactDigits.length !== 11 || !contactDigits.startsWith('09')) {
            errors.contactNumbers = 'Contact number must be 11 digits starting with 09';
        }
        if (!formData.email || !formData.email.endsWith('@gmail.com') || formData.email.split('@')[0].length === 0) {
            errors.email = 'Email must be a valid @gmail.com address';
        }

        // Emergency Contact
        if (!formData.emergencyContactPerson.trim()) errors.emergencyContactPerson = 'Emergency contact person is required';
        const emergencyDigits = formData.emergencyContactNumber.replace(/\D/g, '');
        if (!emergencyDigits || emergencyDigits.length !== 11 || !emergencyDigits.startsWith('09')) {
            errors.emergencyContactNumber = 'Emergency contact must be 11 digits starting with 09';
        }
        setFormErrors(errors);
        if (Object.keys(errors).length > 0) {
            showNotification('Please fix the highlighted errors before continuing', 'warning');
            return false;
        }
        return true;
    };

    const isTDC = formData.course?.category === 'TDC';

    const handleScheduleSelect = (slot) => {
        const isTDC = formData.course?.category === 'TDC';
        const isPDC = !isTDC;
        const sessionName = slot.session.toLowerCase();

        // Check if this slot requires 2 days for PDC (usually Morning or Afternoon sessions)
        const isHalfDay = isPDC && (sessionName.includes('morning') || sessionName.includes('afternoon') || sessionName.includes('4 hours'));

        if (isHalfDay) {
            // First click
            if (!formData.scheduleSlotId || (formData.scheduleSlotId && formData.scheduleSlotId2)) {
                setFormData(prev => ({
                    ...prev,
                    scheduleDate: slot.date,
                    scheduleSlotId: slot.id,
                    scheduleSession: slot.session,
                    scheduleTime: slot.time_range,
                    scheduleDate2: '',
                    scheduleSlotId2: null,
                    scheduleSession2: '',
                    scheduleTime2: ''
                }));
                showNotification(`Day 1 selected! Please select Day 2 schedule for ${slot.session}.`, 'info');
            } else {
                // Second click
                if (slot.id === formData.scheduleSlotId) {
                    showNotification('Please select a different slot for Day 2.', 'warning');
                    return;
                }
                if (slot.session !== formData.scheduleSession) {
                    showNotification(`For Day 2, please select the same session type: ${formData.scheduleSession}`, 'warning');
                    return;
                }
                setFormData(prev => ({
                    ...prev,
                    scheduleDate2: slot.date,
                    scheduleSlotId2: slot.id,
                    scheduleSession2: slot.session,
                    scheduleTime2: slot.time_range
                }));
                showNotification('Day 2 selected successfully! Schedule complete.', 'success');
                nextStep();
            }
        } else {
            // Single slot selection (TDC spans its own end_date backend, or PDC Whole Day)
            setFormData(prev => ({
                ...prev,
                scheduleDate: slot.date,
                scheduleSlotId: slot.id,
                scheduleSession: slot.session,
                scheduleTime: slot.time_range,
                scheduleDate2: slot.end_date && slot.end_date !== slot.date ? slot.end_date : '',
                scheduleSlotId2: null,
                scheduleSession2: '',
                scheduleTime2: ''
            }));
            showNotification('Schedule selected successfully!', 'success');
            nextStep();
        }
    };

    const handleCourseSelect = (pkg) => {
        // Detect Motorcycle PDC: schedule is assigned by admin, skip to payment step
        const isMotorcyclePDC = pkg.category?.toLowerCase().includes('pdc') || pkg.category?.toLowerCase() === 'pdc'
            ? (pkg.name?.toLowerCase().includes('motorcycle') || pkg.shortName?.toLowerCase().includes('motorcycle'))
            : false;

        setFormData(prev => ({
            ...prev,
            course: pkg,
            courseType: '', // Reset to empty so user must explicitly select type
            // Reset schedule selections when changing course
            scheduleDate: '', scheduleSlotId: null, scheduleSession: '', scheduleTime: '',
            scheduleDate2: '', scheduleSlotId2: null, scheduleSession2: '', scheduleTime2: ''
        }));
        setSelectedScheduleDate('');
        setScheduleSlots([]);

        if (isMotorcyclePDC) {
            // Skip schedule step — admin assigns motorcycle schedule separately
            setStep(4);
        } else {
            setStep(3); // Move to schedule selection step
        }
    };

    const nextStep = () => setStep(prev => Math.min(prev + 1, 5));
    const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            setLoading(true);

            const enrollmentData = {
                // Student Info
                firstName: formData.firstName,
                middleName: formData.middleName,
                lastName: formData.lastName,
                age: formData.age,
                gender: formData.gender,
                birthday: formData.birthday,
                nationality: formData.nationality,
                maritalStatus: formData.maritalStatus,
                address: formData.address,
                zipCode: formData.zipCode,
                birthPlace: formData.birthPlace,
                contactNumbers: formData.contactNumbers,
                email: formData.email,
                emergencyContactPerson: formData.emergencyContactPerson,
                emergencyContactNumber: formData.emergencyContactNumber,

                // Course & Branch
                courseId: formData.course?.id,
                courseCategory: formData.course?.category,
                courseType: formData.courseType,
                branchId: formData.branchId,

                // Schedule (supports 1 or 2 slots)
                scheduleSlotId: formData.scheduleSlotId,
                scheduleDate: formData.scheduleDate,
                ...(formData.scheduleSlotId2 ? {
                    scheduleSlotId2: formData.scheduleSlotId2,
                    scheduleDate2: formData.scheduleDate2,
                } : {}),

                // Payment
                paymentMethod: formData.paymentMethod,
                amountPaid: formData.amountPaid,
                paymentStatus: formData.paymentStatus,
                transactionNo: formData.transactionNo,

                // Metadata
                enrollmentType: 'walk-in',
                enrolledBy: adminProfile?.email || 'admin'
            };

            // Call the walk-in enrollment API
            const result = await adminAPI.walkInEnrollment(enrollmentData);

            const newEnrollee = {
                name: `${formData.firstName} ${formData.lastName}`,
                course: `${formData.course?.shortName || formData.course?.name} (${formData.courseType})`,
                branch: formData.branchName,
                date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                status: formData.paymentStatus,
                method: formData.paymentMethod,
                schedule: `${formData.scheduleDate} - ${formData.scheduleSession}`
            };

            if (onEnroll) {
                onEnroll(newEnrollee);
            }

            showNotification('Walk-in enrollment successful! Confirmation email with login credentials and schedule sent to student.', 'success');

            // Reset to first step
            setStep(1);
            setSelectedScheduleDate('');
            setScheduleSlots([]);
            setFormErrors({});
            setFormData({
                firstName: '', middleName: '', lastName: '', age: '', gender: '', birthday: '', nationality: '', maritalStatus: '',
                address: '', zipCode: '', birthPlace: '', contactNumbers: '', email: '', emergencyContactPerson: '', emergencyContactNumber: '',
                course: null, courseType: '', branchId: formData.branchId, branchName: formData.branchName,
                scheduleDate: '', scheduleSlotId: null, scheduleSession: '', scheduleTime: '',
                scheduleDate2: '', scheduleSlotId2: null, scheduleSession2: '', scheduleTime2: '',
                paymentMethod: 'Cash', amountPaid: '', paymentStatus: 'Full Payment', transactionNo: ''
            });
        } catch (error) {
            console.error('Enrollment error:', error);
            showNotification(error.message || 'Failed to complete enrollment. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const renderStep1 = () => (
        <div className="step-content animate-fadeIn">
            <div className="form-section">
                <div className="section-title">
                    <span className="step-badge">1</span>
                    <h3>Personal Information</h3>
                </div>
                <div className="form-grid">
                    <div className="form-group">
                        <label>First Name <span style={{ color: 'red' }}>*</span></label>
                        <input type="text" name="firstName" value={formData.firstName} onChange={handleLettersOnly} required style={{ borderColor: formErrors.firstName ? '#dc2626' : undefined }} />
                        {formErrors.firstName && <span style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '4px', display: 'block' }}>{formErrors.firstName}</span>}
                    </div>
                    <div className="form-group">
                        <label>Middle Name</label>
                        <input type="text" name="middleName" value={formData.middleName} onChange={handleLettersOnly} />
                    </div>
                    <div className="form-group">
                        <label>Last Name <span style={{ color: 'red' }}>*</span></label>
                        <input type="text" name="lastName" value={formData.lastName} onChange={handleLettersOnly} required style={{ borderColor: formErrors.lastName ? '#dc2626' : undefined }} />
                        {formErrors.lastName && <span style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '4px', display: 'block' }}>{formErrors.lastName}</span>}
                    </div>
                    <div className="form-group">
                        <label>Age <span style={{ color: 'red' }}>*</span> <span style={{ fontSize: '0.75rem', color: 'var(--secondary-text)', fontWeight: '400' }}>(16-100)</span></label>
                        <input type="text" name="age" value={formData.age} onChange={handleAge} required style={{ borderColor: formErrors.age ? '#dc2626' : undefined }} />
                        {formErrors.age && <span style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '4px', display: 'block' }}>{formErrors.age}</span>}
                    </div>
                    <div className="form-group">
                        <label>Gender <span style={{ color: 'red' }}>*</span></label>
                        <select name="gender" value={formData.gender} onChange={handleChange} required style={{ borderColor: formErrors.gender ? '#dc2626' : undefined }}>
                            <option value="">Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                        {formErrors.gender && <span style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '4px', display: 'block' }}>{formErrors.gender}</span>}
                    </div>
                    <div className="form-group">
                        <label>Birthday <span style={{ color: 'red' }}>*</span></label>
                        <input type="date" name="birthday" value={formData.birthday} onChange={handleChange} required style={{ borderColor: formErrors.birthday ? '#dc2626' : undefined }} />
                        {formErrors.birthday && <span style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '4px', display: 'block' }}>{formErrors.birthday}</span>}
                    </div>
                </div>
                <div className="form-grid mt-4">
                    <div className="form-group">
                        <label>Nationality <span style={{ color: 'red' }}>*</span></label>
                        <input type="text" name="nationality" value={formData.nationality} onChange={handleLettersOnly} required style={{ borderColor: formErrors.nationality ? '#dc2626' : undefined }} />
                        {formErrors.nationality && <span style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '4px', display: 'block' }}>{formErrors.nationality}</span>}
                    </div>
                    <div className="form-group">
                        <label>Marital Status <span style={{ color: 'red' }}>*</span></label>
                        <select name="maritalStatus" value={formData.maritalStatus} onChange={handleChange} required style={{ borderColor: formErrors.maritalStatus ? '#dc2626' : undefined }}>
                            <option value="">Select Status</option>
                            <option value="Single">Single</option>
                            <option value="Married">Married</option>
                            <option value="Widowed">Widowed</option>
                            <option value="Separated">Separated</option>
                        </select>
                        {formErrors.maritalStatus && <span style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '4px', display: 'block' }}>{formErrors.maritalStatus}</span>}
                    </div>
                </div>
            </div>

            <div className="form-section mt-8">
                <div className="section-title">
                    <span className="step-badge">2</span>
                    <h3>Contact Details</h3>
                </div>
                <div className="form-grid">
                    <div className="form-group full-width">
                        <label>Complete Address <span style={{ color: 'red' }}>*</span></label>
                        <input type="text" name="address" value={formData.address} onChange={handleChange} placeholder="Street, Barangay, City, Province" required style={{ borderColor: formErrors.address ? '#dc2626' : undefined }} />
                        {formErrors.address && <span style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '4px', display: 'block' }}>{formErrors.address}</span>}
                    </div>
                    <div className="form-group">
                        <label>Zip Code <span style={{ color: 'red' }}>*</span> <span style={{ fontSize: '0.75rem', color: 'var(--secondary-text)', fontWeight: '400' }}>(4 digits)</span></label>
                        <input type="text" name="zipCode" value={formData.zipCode} onChange={handleZipCode} placeholder="e.g., 1600" maxLength={4} required style={{ borderColor: formErrors.zipCode ? '#dc2626' : undefined }} />
                        {formErrors.zipCode && <span style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '4px', display: 'block' }}>{formErrors.zipCode}</span>}
                    </div>
                    <div className="form-group">
                        <label>Birth Place <span style={{ color: 'red' }}>*</span></label>
                        <input type="text" name="birthPlace" value={formData.birthPlace} onChange={handleChange} placeholder="City/Municipality" required style={{ borderColor: formErrors.birthPlace ? '#dc2626' : undefined }} />
                        {formErrors.birthPlace && <span style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '4px', display: 'block' }}>{formErrors.birthPlace}</span>}
                    </div>
                    <div className="form-group">
                        <label>Contact Number <span style={{ fontSize: '0.75rem', color: 'var(--secondary-text)', fontWeight: '400' }}>(09XX XXX XXXX)</span></label>
                        <input
                            type="tel"
                            name="contactNumbers"
                            value={formData.contactNumbers}
                            onChange={(e) => handlePhoneChange('contactNumbers', e.target.value)}
                            placeholder="09XX XXX XXXX"
                            maxLength={13}
                            required
                            style={{ borderColor: formErrors.contactNumbers ? '#dc2626' : undefined }}
                        />
                        {formErrors.contactNumbers && (
                            <span style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '4px', display: 'block' }}>{formErrors.contactNumbers}</span>
                        )}
                    </div>
                    <div className="form-group">
                        <label>Email Address <span style={{ fontSize: '0.75rem', color: 'var(--secondary-text)', fontWeight: '400' }}>(@gmail.com)</span></label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={(e) => handleEmailChange(e.target.value)}
                            placeholder="example@gmail.com"
                            required
                            style={{ borderColor: formErrors.email ? '#dc2626' : undefined }}
                        />
                        {formErrors.email && (
                            <span style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '4px', display: 'block' }}>{formErrors.email}</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="form-section mt-8">
                <div className="section-title">
                    <span className="step-badge">3</span>
                    <h3>Emergency Contact</h3>
                </div>
                <div className="form-grid">
                    <div className="form-group">
                        <label>Contact Person Name <span style={{ color: 'red' }}>*</span></label>
                        <input type="text" name="emergencyContactPerson" value={formData.emergencyContactPerson} onChange={handleLettersOnly} placeholder="Full name of emergency contact" required style={{ borderColor: formErrors.emergencyContactPerson ? '#dc2626' : undefined }} />
                        {formErrors.emergencyContactPerson && <span style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '4px', display: 'block' }}>{formErrors.emergencyContactPerson}</span>}
                    </div>
                    <div className="form-group">
                        <label>Emergency Contact Number <span style={{ fontSize: '0.75rem', color: 'var(--secondary-text)', fontWeight: '400' }}>(09XX XXX XXXX)</span></label>
                        <input
                            type="tel"
                            name="emergencyContactNumber"
                            value={formData.emergencyContactNumber}
                            onChange={(e) => handlePhoneChange('emergencyContactNumber', e.target.value)}
                            placeholder="09XX XXX XXXX"
                            maxLength={13}
                            required
                            style={{ borderColor: formErrors.emergencyContactNumber ? '#dc2626' : undefined }}
                        />
                        {formErrors.emergencyContactNumber && (
                            <span style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '4px', display: 'block' }}>{formErrors.emergencyContactNumber}</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="step-actions">
                <button type="button" onClick={() => { if (validateStep1()) nextStep(); }} className="next-btn">
                    Next: Select Course
                    <svg className="ml-2" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="step-content animate-fadeIn">
            <div className="section-header center mb-8">
                <h2>Select Course</h2>
                <p>Choose the driving course for the client</p>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--secondary-text)' }}>
                    Loading courses...
                </div>
            ) : packages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--secondary-text)' }}>
                    <p>No active courses available at the moment.</p>
                    <p style={{ fontSize: '0.875rem', marginTop: '8px' }}>Please add courses in Course Management to proceed.</p>
                </div>
            ) : (
                <div className="courses-grid">
                    {packages.map((pkg) => {
                        // Get the minimum price from all type options
                        const minPrice = Math.min(...pkg.typeOptions.map(opt => opt.price));
                        const maxPrice = Math.max(...pkg.typeOptions.map(opt => opt.price));
                        const priceDisplay = minPrice === maxPrice
                            ? `₱${minPrice.toLocaleString()}`
                            : `₱${minPrice.toLocaleString()} - ₱${maxPrice.toLocaleString()}`;

                        return (
                            <div key={pkg.id} className={`course-card ${formData.course?.id === pkg.id ? 'selected' : ''}`}>
                                <div className="course-img">
                                    <img src={pkg.image} alt={pkg.name} onError={(e) => e.target.style.display = 'none'} />
                                    <div className="course-overlay">
                                        <span>{priceDisplay}</span>
                                    </div>
                                </div>
                                <div className="course-info">
                                    <h4>{pkg.category}</h4>
                                    <h3>{pkg.name}</h3>
                                    <p className="duration">⏱ {pkg.duration}</p>
                                    <ul className="features">
                                        {pkg.features.slice(0, 3).map((f, i) => <li key={i}>✓ {f}</li>)}
                                    </ul>
                                    <button
                                        type="button"
                                        onClick={() => handleCourseSelect(pkg)}
                                        className="select-pkg-btn"
                                    >
                                        {formData.course?.id === pkg.id ? 'Selected' : 'Select Course'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="step-actions">
                <button type="button" onClick={prevStep} className="back-btn">
                    <svg className="mr-2" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Form
                </button>
            </div>
        </div>
    );

    const renderStep3 = () => {
        // For TDC: group slots by month for pagination
        const tdcSlotsByMonth = isTDC ? scheduleSlots.reduce((acc, slot) => {
            const d = new Date(slot.date + 'T00:00:00');
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!acc[key]) acc[key] = [];
            acc[key].push(slot);
            return acc;
        }, {}) : {};
        const tdcMonthKeys = Object.keys(tdcSlotsByMonth).sort();
        const currentMonthKey = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
        const tdcSlotsForMonth = isTDC ? (tdcSlotsByMonth[currentMonthKey] || []) : scheduleSlots;
        const hasPrevSlotMonth = tdcMonthKeys.some(k => k < currentMonthKey);
        const hasNextSlotMonth = tdcMonthKeys.some(k => k > currentMonthKey);

        const goToPrevMonth = () => {
            const prev = tdcMonthKeys.filter(k => k < currentMonthKey);
            if (prev.length > 0) {
                const [y, m] = prev[prev.length - 1].split('-').map(Number);
                setViewDate(new Date(y, m - 1, 1));
            }
        };

        const goToNextMonth = () => {
            const next = tdcMonthKeys.filter(k => k > currentMonthKey);
            if (next.length > 0) {
                const [y, m] = next[0].split('-').map(Number);
                setViewDate(new Date(y, m - 1, 1));
            }
        };

        return (
            <div className="step-content animate-fadeIn">
                <div className="section-title">
                    <span className="step-badge">3</span>
                    <h3>Select Schedule</h3>
                </div>

                {formData.course && (
                    <div className="selected-course-summary mb-6">
                        <div className="summary-label">Selected Course:</div>
                        <div className="summary-value">{formData.course.name}</div>
                        <div style={{ marginTop: '8px', fontSize: '0.875rem', color: 'var(--secondary-text)' }}>
                            Category: <strong>{formData.course.category}</strong> | Duration: <strong>{formData.course.duration}</strong>
                        </div>
                    </div>
                )}

                {/* PDC Day 2 Selection Prompts */}
                {!isTDC && formData.scheduleSlotId && !formData.scheduleSlotId2 && formData.scheduleSession && (formData.scheduleSession.toLowerCase().includes('morning') || formData.scheduleSession.toLowerCase().includes('afternoon') || formData.scheduleSession.toLowerCase().includes('4 hours')) && (
                    <div style={{ padding: '16px', background: 'var(--primary-light)', borderRadius: '12px', marginBottom: '24px', border: '2px solid var(--primary-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: '700', color: 'var(--primary-color)', marginBottom: '4px' }}>Day 2 Selection Required</div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-color)' }}>
                                    You selected <strong>Day 1</strong>. Please select another date for your <strong>Day 2 ({formData.scheduleSession})</strong> schedule to complete the booking.
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {!isTDC && formData.scheduleSlotId && formData.scheduleSlotId2 && (
                    <div style={{ padding: '16px', background: '#dcfce7', borderRadius: '12px', marginBottom: '24px', border: '2px solid #22c55e' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: '700', color: '#15803d', marginBottom: '4px' }}>Schedule Complete</div>
                                <div style={{ fontSize: '0.875rem', color: '#166534' }}>
                                    You have successfully selected both <strong>Day 1</strong> and <strong>Day 2</strong>.
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {!isTDC && (
                    <div style={{ padding: '16px', background: 'var(--primary-light)', borderRadius: '12px', marginBottom: '24px', border: '2px solid var(--primary-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: '700', color: 'var(--primary-color)', marginBottom: '4px' }}>Schedule Policy</div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-color)' }}>
                                    Schedules must be booked at least <strong>2 days in advance</strong>. Sundays are not available.
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {!isTDC && (
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                            <button
                                className="month-nav-btn"
                                onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
                                style={{ background: 'var(--card-bg)', border: '2px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer' }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="15 18 9 12 15 6"></polyline>
                                </svg>
                            </button>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700' }}>
                                {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </h3>
                            <button
                                className="month-nav-btn"
                                onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
                                style={{ background: 'var(--card-bg)', border: '2px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer' }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                            </button>
                        </div>

                        <div className="calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <div key={day} style={{ textAlign: 'center', fontWeight: '700', fontSize: '0.875rem', padding: '8px', color: 'var(--secondary-text)' }}>
                                    {day}
                                </div>
                            ))}
                            {(() => {
                                const year = viewDate.getFullYear();
                                const month = viewDate.getMonth();
                                const firstDay = new Date(year, month, 1).getDay();
                                const daysInMonth = new Date(year, month + 1, 0).getDate();
                                const days = [];
                                for (let i = 0; i < firstDay; i++) {
                                    days.push(<div key={`pad-${i}`} style={{ padding: '16px' }}></div>);
                                }
                                for (let d = 1; d <= daysInMonth; d++) {
                                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                    const dateObj = new Date(year, month, d);
                                    const isSelected = selectedScheduleDate === dateStr;
                                    const isToday = today === dateStr;
                                    const isSunday = dateObj.getDay() === 0;
                                    const todayDate = new Date(today);
                                    const minAllowedDate = new Date(todayDate);
                                    minAllowedDate.setDate(todayDate.getDate() + 2);
                                    const minDateStr = minAllowedDate.toISOString().split('T')[0];
                                    const isTooSoon = dateStr < minDateStr;
                                    const isDisabled = isTooSoon || isSunday;
                                    days.push(
                                        <div
                                            key={d}
                                            onClick={() => !isDisabled && setSelectedScheduleDate(dateStr)}
                                            style={{
                                                padding: '16px',
                                                textAlign: 'center',
                                                borderRadius: '12px',
                                                border: `2px solid ${isSelected ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                                background: isSelected ? 'var(--primary-light)' : isDisabled ? '#f5f5f5' : 'var(--card-bg)',
                                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                                fontWeight: isSelected || isToday ? '700' : '500',
                                                color: isDisabled ? '#ccc' : isSelected ? 'var(--primary-color)' : 'var(--text-color)',
                                                opacity: isDisabled ? 0.4 : 1,
                                                transition: 'all 0.2s ease',
                                                position: 'relative'
                                            }}
                                            onMouseEnter={(e) => !isDisabled && (e.currentTarget.style.transform = 'translateY(-2px)')}
                                            onMouseLeave={(e) => !isDisabled && (e.currentTarget.style.transform = 'translateY(0)')}
                                        >
                                            {d}
                                            {isToday && <div style={{ position: 'absolute', bottom: '4px', left: '50%', transform: 'translateX(-50%)', width: '4px', height: '4px', borderRadius: '50%', background: 'var(--primary-color)' }}></div>}
                                        </div>
                                    );
                                }
                                return days;
                            })()}
                        </div>
                    </div>
                )}

                {(isTDC || (!isTDC && selectedScheduleDate)) && (
                    <div style={{ marginTop: '32px' }}>
                        {isTDC && (
                            <div style={{ marginBottom: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginBottom: '8px' }}>
                                    <button
                                        onClick={goToPrevMonth}
                                        disabled={!hasPrevSlotMonth}
                                        style={{
                                            background: 'var(--card-bg)',
                                            border: '2px solid var(--border-color)',
                                            borderRadius: '8px',
                                            padding: '8px 12px',
                                            cursor: hasPrevSlotMonth ? 'pointer' : 'not-allowed',
                                            opacity: hasPrevSlotMonth ? 1 : 0.35
                                        }}
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <polyline points="15 18 9 12 15 6"></polyline>
                                        </svg>
                                    </button>
                                    <div style={{ textAlign: 'center' }}>
                                        <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-color)' }}>
                                            {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                        </h3>
                                        {tdcMonthKeys.length > 1 && (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--secondary-text)', marginTop: '2px' }}>
                                                {tdcMonthKeys.length} months with available schedules
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={goToNextMonth}
                                        disabled={!hasNextSlotMonth}
                                        style={{
                                            background: 'var(--card-bg)',
                                            border: '2px solid var(--border-color)',
                                            borderRadius: '8px',
                                            padding: '8px 12px',
                                            cursor: hasNextSlotMonth ? 'pointer' : 'not-allowed',
                                            opacity: hasNextSlotMonth ? 1 : 0.35
                                        }}
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <polyline points="9 18 15 12 9 6"></polyline>
                                        </svg>
                                    </button>
                                </div>
                                {tdcMonthKeys.length > 1 && (
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '10px' }}>
                                        {tdcMonthKeys.map(key => (
                                            <div
                                                key={key}
                                                onClick={() => {
                                                    const [y, m] = key.split('-').map(Number);
                                                    setViewDate(new Date(y, m - 1, 1));
                                                }}
                                                title={new Date(key + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                                style={{
                                                    width: key === currentMonthKey ? '24px' : '8px',
                                                    height: '8px',
                                                    borderRadius: '4px',
                                                    background: key === currentMonthKey ? 'var(--primary-color)' : 'var(--border-color)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.3s ease'
                                                }}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <h4 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: '700', textAlign: isTDC ? 'center' : 'left' }}>
                            {isTDC
                                ? `Available TDC Schedules — ${viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
                                : `Available Slots — ${new Date(selectedScheduleDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                            }
                        </h4>

                        {!isTDC && (
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                                {['All', 'Whole Day', 'Morning Class', 'Afternoon Class'].map(filter => (
                                    <button
                                        key={filter}
                                        onClick={() => setPdcSessionFilter(filter)}
                                        style={{
                                            padding: '8px 16px',
                                            borderRadius: '20px',
                                            border: `1px solid ${pdcSessionFilter === filter ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                            background: pdcSessionFilter === filter ? 'var(--primary-color)' : 'var(--card-bg)',
                                            color: pdcSessionFilter === filter ? '#fff' : 'var(--text-color)',
                                            fontSize: '0.875rem',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        {filter}
                                    </button>
                                ))}
                            </div>
                        )}

                        {(() => {
                            const filteredPdcSlots = isTDC ? tdcSlotsForMonth : tdcSlotsForMonth.filter(slot => {
                                if (pdcSessionFilter === 'All') return true;
                                if (pdcSessionFilter === 'Whole Day') return slot.session.toLowerCase().includes('whole');
                                if (pdcSessionFilter === 'Morning Class') return slot.session.toLowerCase().includes('morning');
                                if (pdcSessionFilter === 'Afternoon Class') return slot.session.toLowerCase().includes('afternoon');
                                return true;
                            });

                            return loadingSchedule ? (
                                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--secondary-text)' }}>
                                    Loading available slots...
                                </div>
                            ) : filteredPdcSlots.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--secondary-text)', background: 'var(--bg-color)', borderRadius: '12px', border: '2px dashed var(--border-color)' }}>
                                    <p style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>
                                        No available slots {isTDC ? `in ${viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}` : `for ${pdcSessionFilter !== 'All' ? pdcSessionFilter.toLowerCase() : 'this date'}`}
                                    </p>
                                    <p style={{ margin: '8px 0 0 0', fontSize: '0.875rem' }}>
                                        {isTDC
                                            ? (hasPrevSlotMonth || hasNextSlotMonth ? 'Try navigating to another month using the arrows above' : 'Please check back later')
                                            : 'Please try selecting another date or filter'}
                                    </p>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                                    {filteredPdcSlots.map(slot => {
                                        const isSelected1 = formData.scheduleSlotId === slot.id;
                                        const isSelected2 = formData.scheduleSlotId2 === slot.id;
                                        const isSelected = isSelected1 || isSelected2;

                                        return (
                                            <div
                                                key={slot.id}
                                                onClick={() => handleScheduleSelect(slot)}
                                                style={{
                                                    padding: '24px',
                                                    border: `2px solid ${isSelected ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                                    borderRadius: '16px',
                                                    background: isSelected ? 'var(--primary-light)' : 'var(--card-bg)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.3s ease',
                                                    position: 'relative'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (!isSelected) {
                                                        e.currentTarget.style.borderColor = 'var(--primary-color)';
                                                        e.currentTarget.style.transform = 'translateY(-4px)';
                                                        e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (!isSelected) {
                                                        e.currentTarget.style.borderColor = 'var(--border-color)';
                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                        e.currentTarget.style.boxShadow = 'none';
                                                    }
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: isSelected ? 'var(--primary-color)' : 'var(--primary-light)', color: isSelected ? 'white' : 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        {isSelected ? (
                                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <polyline points="20 6 9 17 4 12"></polyline>
                                                            </svg>
                                                        ) : (
                                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <circle cx="12" cy="12" r="10"></circle>
                                                                <polyline points="12 6 12 12 16 14"></polyline>
                                                            </svg>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: 'var(--text-color)' }}>
                                                            {slot.session}
                                                        </h4>
                                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: 'var(--secondary-text)' }}>
                                                            {slot.time_range}
                                                        </p>
                                                    </div>
                                                </div>

                                                {slot.end_date && slot.date !== slot.end_date ? (
                                                    <div style={{ padding: '8px 12px', background: 'var(--bg-color)', borderRadius: '6px', marginBottom: '12px', fontSize: '0.8rem', color: 'var(--text-color)', fontWeight: '600', border: '1px solid var(--border-color)' }}>
                                                        📅 {new Date(slot.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {new Date(slot.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </div>
                                                ) : (
                                                    <div style={{ padding: '8px 12px', background: 'var(--bg-color)', borderRadius: '6px', marginBottom: '12px', fontSize: '0.8rem', color: 'var(--text-color)', fontWeight: '600', border: '1px solid var(--border-color)' }}>
                                                        📅 {new Date(slot.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                                    </div>
                                                )}

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-color)', borderRadius: '8px' }}>
                                                    <span style={{ fontSize: '0.875rem', color: 'var(--secondary-text)' }}>Available Slots:</span>
                                                    <span style={{ fontSize: '1rem', fontWeight: '700', color: slot.available_slots < 5 ? '#ef4444' : 'var(--success)' }}>
                                                        {slot.available_slots}/{slot.total_capacity}
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            );
                        })()}
                    </div>
                )}

                <div className="step-actions">
                    <button type="button" className="back-btn" onClick={prevStep}>
                        Back
                    </button>
                    {!isTDC && !selectedScheduleDate && !formData.scheduleSlotId && (
                        <div style={{ fontSize: '0.875rem', color: 'var(--secondary-text)', fontStyle: 'italic' }}>
                            Please select a date from the calendar to view slots.
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderStep4 = () => {
        const selectedPrice = formData.course?.typeOptions?.find(opt => opt.value === formData.courseType)?.price || 0;
        const requiredAmount = formData.paymentStatus === 'Downpayment' ? selectedPrice * 0.5 : selectedPrice;
        const change = formData.amountPaid ? Math.max(0, Number(formData.amountPaid) - requiredAmount) : 0;

        return (
            <div className="step-content animate-fadeIn">
                <div className="section-title">
                    <span className="step-badge">4</span>
                    <h3>Enrollment & Payment</h3>
                </div>

                <div className="form-card-inner">
                    {formData.course && (
                        <div className="selected-course-summary mb-6">
                            <div className="summary-label">Selected Course:</div>
                            <div className="summary-value">{formData.course.name}</div>
                            <div style={{ marginTop: '8px', fontSize: '0.875rem', color: 'var(--secondary-text)' }}>
                                Category: <strong>{formData.course.category}</strong> | Duration: <strong>{formData.course.duration}</strong>
                            </div>
                            {formData.course.hasTypeOption && formData.course.typeOptions.length > 0 && (
                                <div className="mt-4">
                                    <label className="block text-xs font-bold mb-2" style={{ fontSize: '0.9rem', color: 'var(--text-color)' }}>
                                        SELECT TYPE {formData.course.category === 'TDC' && '(ONLINE OR F2F)'}
                                        {formData.course.category === 'PDC' && '(TRANSMISSION TYPE)'}
                                        <span style={{ color: 'red', marginLeft: '4px' }}>*</span>
                                    </label>
                                    <div className="flex gap-2" style={{ flexWrap: 'wrap', gap: '12px' }}>
                                        {formData.course.typeOptions.map(opt => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => {
                                                    console.log('Type selected:', opt.value);
                                                    setFormData(p => ({ ...p, courseType: opt.value }));
                                                }}
                                                className="px-4 py-1.5 text-xs rounded-full border transition-all"
                                                style={{
                                                    padding: '12px 24px',
                                                    fontSize: '0.95rem',
                                                    fontWeight: formData.courseType === opt.value ? '700' : '600',
                                                    background: formData.courseType === opt.value ? 'linear-gradient(135deg, var(--primary-color) 0%, var(--accent) 100%)' : 'var(--card-bg)',
                                                    color: formData.courseType === opt.value ? 'white' : 'var(--text-color)',
                                                    border: formData.courseType === opt.value ? '2px solid var(--primary-color)' : '2px solid var(--border-color)',
                                                    borderRadius: '12px',
                                                    boxShadow: formData.courseType === opt.value ? '0 4px 12px rgba(26, 79, 186, 0.3)' : 'none',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.3s ease'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (formData.courseType !== opt.value) {
                                                        e.currentTarget.style.borderColor = 'var(--primary-color)';
                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (formData.courseType !== opt.value) {
                                                        e.currentTarget.style.borderColor = 'var(--border-color)';
                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                    }
                                                }}
                                            >
                                                {opt.label}
                                                {opt.price && ` - ₱${opt.price.toLocaleString()}`}
                                            </button>
                                        ))}
                                    </div>
                                    {!formData.courseType && (
                                        <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#dc2626' }}>
                                            Please select a course type to continue
                                        </div>
                                    )}
                                    {formData.courseType && (
                                        <div style={{ marginTop: '16px', padding: '12px 16px', background: 'var(--primary-light)', borderRadius: '12px', border: '2px solid var(--primary-color)' }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--primary-color)', fontWeight: '800', marginBottom: '4px' }}>
                                                SELECTED TYPE
                                            </div>
                                            <div style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--text-color)' }}>
                                                {formData.course.typeOptions.find(opt => opt.value === formData.courseType)?.label}
                                            </div>
                                            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--primary-color)', marginTop: '4px' }}>
                                                ₱{(formData.course.typeOptions.find(opt => opt.value === formData.courseType)?.price || 0).toLocaleString()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="form-grid">
                        <div className="form-group">
                            <label>Branch</label>
                            <select
                                name="branchId"
                                value={formData.branchId}
                                onChange={(e) => {
                                    const branch = branches.find(b => b.id === parseInt(e.target.value));
                                    setFormData(prev => ({
                                        ...prev,
                                        branchId: e.target.value,
                                        branchName: branch ? branch.name : ''
                                    }));
                                }}
                                disabled={adminProfile?.rawRole === 'staff'}
                            >
                                {branches.map(b => <option key={b.id} value={b.id}>{formatBranchName(b.name)}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Payment Method</label>
                            <select name="paymentMethod" value={formData.paymentMethod} onChange={handleChange}>
                                <option value="Cash">Cash</option>
                                <option value="GCash">GCash</option>
                                <option value="Bank Transfer">Starpay</option>
                            </select>
                        </div>
                        {['GCash', 'Bank Transfer'].includes(formData.paymentMethod) && (
                            <div className="form-group">
                                <label>Transaction No. <span style={{ color: 'red' }}>*</span></label>
                                <input
                                    type="text"
                                    name="transactionNo"
                                    value={formData.transactionNo}
                                    onChange={handleChange}
                                    placeholder="Enter Transaction No."
                                    required
                                />
                            </div>
                        )}
                        <div className="form-group" style={{ position: 'relative' }}>
                            <label>Amount Paid (₱) {formData.paymentStatus === 'Downpayment' && <span style={{ fontSize: '0.75rem', color: 'var(--secondary-text)', fontWeight: 'normal', marginLeft: '4px' }}>(50% Required: ₱{requiredAmount.toLocaleString()})</span>}</label>
                            <input type="number" name="amountPaid" value={formData.amountPaid} onChange={handleChange} required />
                            {formData.amountPaid && Number(formData.amountPaid) > requiredAmount && (
                                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: '4px', fontSize: '0.85rem', color: 'var(--success)', fontWeight: '700' }}>
                                    Change: ₱{change.toLocaleString()}
                                </div>
                            )}
                        </div>
                        <div className="form-group">
                            <label>Payment Status</label>
                            <select name="paymentStatus" value={formData.paymentStatus} onChange={handleChange}>
                                <option value="Full Payment">Full Payment</option>
                                <option value="Downpayment">Downpayment</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="step-actions">
                    <button type="button" onClick={prevStep} className="back-btn">
                        <svg className="mr-2" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (!formData.courseType) {
                                showNotification('Please select a course type (Online, F2F, etc.) to continue', 'warning');
                                return;
                            }
                            if (['GCash', 'Bank Transfer'].includes(formData.paymentMethod) && (!formData.transactionNo || !formData.transactionNo.trim())) {
                                showNotification('Please enter the Transaction No.', 'warning');
                                return;
                            }
                            nextStep();
                        }}
                        className="next-btn"
                        disabled={!formData.courseType}
                        style={{
                            opacity: !formData.courseType ? 0.5 : 1,
                            cursor: !formData.courseType ? 'not-allowed' : 'pointer'
                        }}
                    >
                        Review Enrollment
                        <svg className="ml-2" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            </div>
        );
    };

    const renderStep5 = () => (
        <div className="step-content animate-fadeIn">
            <div className="section-title">
                <span className="step-badge">5</span>
                <h3>Review Details</h3>
            </div>

            <div className="review-container">
                <div className="review-section">
                    <h4>Student Info</h4>
                    <p><strong>Name:</strong> {formData.firstName} {formData.middleName} {formData.lastName}</p>
                    <p><strong>Contact:</strong> {formData.contactNumbers} | {formData.email}</p>
                    <p><strong>Address:</strong> {formData.address}</p>
                </div>
                <div className="review-section">
                    <h4>Course & Branch</h4>
                    <p><strong>Course:</strong> {formData.course?.name}</p>
                    <p><strong>Type:</strong> {formData.courseType}</p>
                    <p><strong>Branch:</strong> {formatBranchName(formData.branchName)}</p>
                </div>
                <div className="review-section">
                    <h4>Schedule</h4>
                    {formData.scheduleDate2 ? (
                        <>
                            <p style={{ fontWeight: '600', color: 'var(--primary-color)', marginBottom: '4px', fontSize: '0.85rem' }}>Day 1:</p>
                            <p><strong>Date:</strong> {formData.scheduleDate ? new Date(formData.scheduleDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not selected'}</p>
                            <p><strong>Session:</strong> {formData.scheduleSession || 'Not selected'}</p>
                            <p><strong>Time:</strong> {formData.scheduleTime || 'Not selected'}</p>
                            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '10px 0' }} />
                            <p style={{ fontWeight: '600', color: 'var(--primary-color)', marginBottom: '4px', fontSize: '0.85rem' }}>Day 2:</p>
                            <p><strong>Date:</strong> {new Date(formData.scheduleDate2 + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                            <p><strong>Session:</strong> {formData.scheduleSession2 || 'Not selected'}</p>
                            <p><strong>Time:</strong> {formData.scheduleTime2 || 'Not selected'}</p>
                        </>
                    ) : (
                        <>
                            <p><strong>Date:</strong> {formData.scheduleDate ? new Date(formData.scheduleDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not selected'}</p>
                            <p><strong>Session:</strong> {formData.scheduleSession || 'Not selected'}</p>
                            <p><strong>Time:</strong> {formData.scheduleTime || 'Not selected'}</p>
                        </>
                    )}
                </div>
                <div className="review-section">
                    <h4>Payment</h4>
                    <p><strong>Method:</strong> {formData.paymentMethod}</p>
                    {['GCash', 'Bank Transfer'].includes(formData.paymentMethod) && (
                        <p><strong>Transaction No:</strong> {formData.transactionNo}</p>
                    )}
                    <p><strong>Amount:</strong> ₱{Number(formData.amountPaid).toLocaleString()}</p>
                    <p><strong>Status:</strong> {formData.paymentStatus}</p>
                </div>
            </div>

            <div className="step-actions">
                <button type="button" onClick={prevStep} className="back-btn" disabled={loading}>
                    <svg className="mr-2" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                </button>
                <button type="button" onClick={handleSubmit} className="submit-enroll-btn" disabled={loading} style={{ opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                    {loading ? (
                        <>
                            <svg className="mr-2 spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ animation: 'spin 1s linear infinite' }}>
                                <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing...
                        </>
                    ) : (
                        <>
                            <svg className="mr-2" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Confirm & Enroll
                        </>
                    )}
                </button>
            </div>
        </div>
    );

    return (
        <div className="walk-in-container slide-up">
            <div className="walk-in-header">
                <div className="header-info">
                    <h2>Walk-in Enrollment</h2>
                    <p>Physical registration for students at the branch</p>
                </div>
                <div className="step-indicator">
                    <div className={`step-dot ${step >= 1 ? 'active' : ''}`}>1</div>
                    <div className={`step-line ${step >= 2 ? 'active' : ''}`}></div>
                    <div className={`step-dot ${step >= 2 ? 'active' : ''}`}>2</div>
                    <div className={`step-line ${step >= 3 ? 'active' : ''}`}></div>
                    <div className={`step-dot ${step >= 3 ? 'active' : ''}`}>3</div>
                    <div className={`step-line ${step >= 4 ? 'active' : ''}`}></div>
                    <div className={`step-dot ${step >= 4 ? 'active' : ''}`}>4</div>
                    <div className={`step-line ${step >= 5 ? 'active' : ''}`}></div>
                    <div className={`step-dot ${step >= 5 ? 'active' : ''}`}>5</div>
                </div>
            </div>

            <div className="enrollment-wizard">
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
                {step === 4 && renderStep4()}
                {step === 5 && renderStep5()}
            </div>
        </div>
    );
};

export default WalkInEnrollment;