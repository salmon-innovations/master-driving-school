import React, { useState, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';
import { branchesAPI } from '../services/api';

const logo = '/images/logo.png';

const WalkInEnrollment = ({ onEnroll, adminProfile }) => {
    const { showNotification } = useNotification();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [branches, setBranches] = useState([]);
    
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
        
        // Payment Details
        paymentMethod: 'Cash',
        amountPaid: '',
        paymentStatus: 'Full Payment'
    });

    const packages = [
        {
            id: 1,
            name: 'THEORETICAL DRIVING COURSE (TDC)',
            shortName: 'TDC',
            duration: '15 Hours',
            price: 1176,
            image: '/images/tdc-course.jpg',
            features: [
                'Classroom instruction',
                'Traffic rules & regulations',
                'Road signs and markings',
                'Defensive driving theory',
                'LTO requirements review'
            ],
            hasTypeOption: true,
            typeOptions: [
                { value: 'online', label: 'ONLINE' },
                { value: 'face-to-face', label: 'FACE TO FACE' }
            ]
        },
        {
            id: 2,
            name: 'PRACTICAL DRIVING COURSE (MOTORCYCLE)',
            shortName: 'PDC Motor',
            duration: '8 Hours',
            price: 3510,
            image: '/images/pdc-motor.jpg',
            features: [
                'Motorcycle handling basics',
                'Balance and control',
                'Road safety for motorcycles',
                'LTO exam preparation'
            ],
            hasTypeOption: true,
            typeOptions: [
                { value: 'manual', label: 'MANUAL' },
                { value: 'automatic', label: 'AUTOMATIC' }
            ]
        },
        {
            id: 3,
            name: 'PRACTICAL DRIVING COURSE (4 WHEELS)',
            shortName: 'PDC Car',
            duration: '8 Hours',
            price: 5000, // Sample price since it was 0/Note in Courses.jsx
            image: '/images/pdc-car.jpg',
            features: [
                'Car driving fundamentals',
                'Parking techniques',
                'Highway driving',
                'LTO exam preparation'
            ],
            hasTypeOption: true,
            typeOptions: [
                { value: 'manual', label: 'MANUAL' },
                { value: 'automatic', label: 'AUTOMATIC' }
            ]
        }
    ];

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const response = await branchesAPI.getAll();
                if (response.success) {
                    setBranches(response.branches);
                    
                    // Set default branch if not admin or if admin has a preferred branch
                    if (adminProfile?.branch && adminProfile.role !== 'Super Admin') {
                        const userBranch = response.branches.find(b => b.name === adminProfile.branch);
                        if (userBranch) {
                            setFormData(prev => ({
                                ...prev,
                                branchId: userBranch.id,
                                branchName: userBranch.name
                            }));
                        }
                    } else if (response.branches.length > 0) {
                        setFormData(prev => ({
                            ...prev,
                            branchId: response.branches[0].id,
                            branchName: response.branches[0].name
                        }));
                    }
                }
            } catch (err) {
                console.error('Error fetching branches:', err);
            }
        };
        fetchBranches();
    }, [adminProfile]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCourseSelect = (pkg) => {
        setFormData(prev => ({ 
            ...prev, 
            course: pkg,
            courseType: pkg.hasTypeOption ? pkg.typeOptions[0].value : ''
        }));
        setStep(3); // Move to branch/payment step after selection
    };

    const nextStep = () => setStep(prev => Math.min(prev + 1, 4));
    const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

    const handleSubmit = (e) => {
        e.preventDefault();
        
        const newEnrollee = {
            name: `${formData.firstName} ${formData.lastName}`,
            course: `${formData.course?.shortName || formData.course?.name} (${formData.courseType})`,
            branch: formData.branchName,
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            status: formData.paymentStatus,
            method: formData.paymentMethod
        };

        if (onEnroll) {
            onEnroll(newEnrollee);
        }

        showNotification('Walk-in enrollment successful!', 'success');
        
        // Reset to first step
        setStep(1);
        setFormData({
            firstName: '', middleName: '', lastName: '', age: '', gender: '', birthday: '', nationality: '', maritalStatus: '',
            address: '', zipCode: '', birthPlace: '', contactNumbers: '', email: '', emergencyContactPerson: '', emergencyContactNumber: '',
            course: null, courseType: '', branchId: formData.branchId, branchName: formData.branchName,
            paymentMethod: 'Cash', amountPaid: '', paymentStatus: 'Full Payment'
        });
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
                        <label>First Name</label>
                        <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label>Middle Name</label>
                        <input type="text" name="middleName" value={formData.middleName} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label>Last Name</label>
                        <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label>Age</label>
                        <input type="number" name="age" value={formData.age} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label>Gender</label>
                        <select name="gender" value={formData.gender} onChange={handleChange} required>
                            <option value="">Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Birthday</label>
                        <input type="date" name="birthday" value={formData.birthday} onChange={handleChange} required />
                    </div>
                </div>
                <div className="form-grid mt-4">
                    <div className="form-group">
                        <label>Nationality</label>
                        <input type="text" name="nationality" value={formData.nationality} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label>Marital Status</label>
                        <select name="maritalStatus" value={formData.maritalStatus} onChange={handleChange} required>
                            <option value="">Select Status</option>
                            <option value="Single">Single</option>
                            <option value="Married">Married</option>
                            <option value="Widowed">Widowed</option>
                            <option value="Separated">Separated</option>
                        </select>
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
                        <label>Complete Address</label>
                        <input type="text" name="address" value={formData.address} onChange={handleChange} placeholder="Street, Barangay, City, Province" required />
                    </div>
                    <div className="form-group">
                        <label>Zip Code</label>
                        <input type="text" name="zipCode" value={formData.zipCode} onChange={handleChange} placeholder="e.g., 1600" required />
                    </div>
                    <div className="form-group">
                        <label>Birth Place</label>
                        <input type="text" name="birthPlace" value={formData.birthPlace} onChange={handleChange} placeholder="City/Municipality" required />
                    </div>
                    <div className="form-group">
                        <label>Contact Number</label>
                        <input type="tel" name="contactNumbers" value={formData.contactNumbers} onChange={handleChange} placeholder="+63 912 345 6789" required />
                    </div>
                    <div className="form-group">
                        <label>Email Address</label>
                        <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="juan@example.com" required />
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
                        <label>Contact Person Name</label>
                        <input type="text" name="emergencyContactPerson" value={formData.emergencyContactPerson} onChange={handleChange} placeholder="Full name of emergency contact" required />
                    </div>
                    <div className="form-group">
                        <label>Emergency Contact Number</label>
                        <input type="tel" name="emergencyContactNumber" value={formData.emergencyContactNumber} onChange={handleChange} placeholder="+63 912 345 6789" required />
                    </div>
                </div>
            </div>

            <div className="step-actions">
                <button type="button" onClick={nextStep} className="next-btn">
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
            
            <div className="courses-grid">
                {packages.map((pkg) => (
                    <div key={pkg.id} className={`course-card ${formData.course?.id === pkg.id ? 'selected' : ''}`}>
                        <div className="course-img">
                            <img src={pkg.image} alt={pkg.name} onError={(e) => e.target.style.display = 'none'} />
                            <div className="course-overlay">
                                <span>₱{pkg.price.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="course-info">
                            <h4>{pkg.shortName}</h4>
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
                ))}
            </div>

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

    const renderStep3 = () => (
        <div className="step-content animate-fadeIn">
            <div className="section-title">
                <span className="step-badge">3</span>
                <h3>Enrollment & Payment</h3>
            </div>

            <div className="form-card-inner">
                {formData.course && (
                    <div className="selected-course-summary mb-6">
                        <div className="summary-label">Selected Course:</div>
                        <div className="summary-value">{formData.course.name}</div>
                        {formData.course.hasTypeOption && (
                            <div className="mt-4">
                                <label className="block text-xs font-bold mb-2">TYPE</label>
                                <div className="flex gap-2">
                                    {formData.course.typeOptions.map(opt => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setFormData(p => ({ ...p, courseType: opt.value }))}
                                            className={`px-4 py-1.5 text-xs rounded-full border transition-all ${
                                                formData.courseType === opt.value 
                                                ? 'bg-primary text-white border-primary' 
                                                : 'border-gray-300'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
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
                            disabled={adminProfile?.role !== 'Super Admin' && adminProfile?.role !== 'Admin'}
                        >
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Payment Method</label>
                        <select name="paymentMethod" value={formData.paymentMethod} onChange={handleChange}>
                            <option value="Cash">Cash</option>
                            <option value="GCash">GCash</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Amount Paid (₱)</label>
                        <input type="number" name="amountPaid" value={formData.amountPaid} onChange={handleChange} required />
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
                <button type="button" onClick={nextStep} className="next-btn">
                    Review Enrollment
                    <svg className="ml-2" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>
        </div>
    );

    const renderStep4 = () => (
        <div className="step-content animate-fadeIn">
            <div className="section-title">
                <span className="step-badge">4</span>
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
                    <p><strong>Branch:</strong> {formData.branchName}</p>
                </div>
                <div className="review-section">
                    <h4>Payment</h4>
                    <p><strong>Method:</strong> {formData.paymentMethod}</p>
                    <p><strong>Amount:</strong> ₱{Number(formData.amountPaid).toLocaleString()}</p>
                    <p><strong>Status:</strong> {formData.paymentStatus}</p>
                </div>
            </div>

            <div className="step-actions">
                <button type="button" onClick={prevStep} className="back-btn">
                    <svg className="mr-2" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                </button>
                <button type="button" onClick={handleSubmit} className="submit-enroll-btn">
                    <svg className="mr-2" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Confirm & Enroll
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
                </div>
            </div>

            <div className="enrollment-wizard">
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
                {step === 4 && renderStep4()}
            </div>

            <style jsx>{`
                .walk-in-container {
                    padding: 20px 0;
                    --accent: #3b82f6;
                    --success: #10b981;
                    --shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
                    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                    --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                }

                /* Header Section */
                .walk-in-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 32px;
                    flex-wrap: wrap;
                    gap: 24px;
                }
                .header-info h2 {
                    font-size: clamp(1.5rem, 4vw, 1.75rem);
                    color: var(--primary-color);
                    font-weight: 800;
                    margin-bottom: 6px;
                    letter-spacing: -0.025em;
                }
                .header-info p {
                    color: var(--secondary-text);
                    font-size: clamp(0.875rem, 2vw, 0.95rem);
                    line-height: 1.5;
                }

                /* Step Indicator */
                .step-indicator {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: var(--card-bg);
                    padding: 12px 20px;
                    border-radius: 100px;
                    box-shadow: var(--shadow-sm);
                    border: 1px solid var(--border-color);
                }
                .step-dot {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: var(--border-color);
                    color: var(--secondary-text);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 0.875rem;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                }
                .step-dot.active {
                    background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent) 100%);
                    color: white;
                    box-shadow: 0 0 0 4px var(--primary-light);
                    transform: scale(1.1);
                }
                .step-line {
                    width: 32px;
                    height: 3px;
                    background: var(--border-color);
                    transition: all 0.3s ease;
                    border-radius: 2px;
                }
                .step-line.active {
                    background: linear-gradient(90deg, var(--primary-color) 0%, var(--accent) 100%);
                }

                /* Main Wizard Card */
                .enrollment-wizard {
                    background: var(--card-bg);
                    border-radius: 24px;
                    padding: 48px;
                    box-shadow: var(--shadow-xl);
                    border: 1px solid var(--border-color);
                    position: relative;
                    overflow: hidden;
                }
                .enrollment-wizard::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 4px;
                    background: linear-gradient(90deg, var(--primary-color) 0%, var(--accent) 100%);
                }

                /* Form Sections */
                .form-section {
                    margin-bottom: 40px;
                }
                .form-section:last-of-type {
                    margin-bottom: 0;
                }
                .section-title {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 24px;
                }
                .step-badge {
                    background: var(--primary-light);
                    color: var(--primary-color);
                    width: 28px;
                    height: 28px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.8rem;
                    font-weight: 800;
                    flex-shrink: 0;
                }
                .section-title h3 {
                    font-size: clamp(1rem, 3vw, 1.15rem);
                    font-weight: 700;
                    color: var(--text-color);
                    letter-spacing: -0.01em;
                }

                /* Form Grid */
                .form-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 20px;
                }
                .form-grid.mt-4 {
                    margin-top: 20px;
                }
                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .form-group label {
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: var(--text-color);
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .form-group input, 
                .form-group select {
                    padding: 14px 16px;
                    border-radius: 12px;
                    border: 2px solid var(--border-color);
                    font-size: 0.95rem;
                    transition: all 0.2s ease;
                    background: var(--bg-color);
                    color: var(--text-color);
                    font-family: inherit;
                }
                .form-group input::placeholder {
                    color: var(--secondary-text);
                    opacity: 0.7;
                }
                .form-group input:hover, 
                .form-group select:hover {
                    border-color: var(--secondary-text);
                }
                .form-group input:focus, 
                .form-group select:focus {
                    outline: none;
                    border-color: var(--primary-color);
                    background: var(--card-bg);
                    box-shadow: 0 0 0 4px var(--primary-light);
                }
                .form-group input:disabled,
                .form-group select:disabled {
                    background: var(--border-color);
                    cursor: not-allowed;
                    opacity: 0.6;
                }
                .form-group.full-width {
                    grid-column: 1 / -1;
                }

                /* Course Selection Grid */
                .section-header {
                    margin-bottom: 32px;
                }
                .section-header.center {
                    text-align: center;
                }
                .section-header.mb-8 {
                    margin-bottom: 32px;
                }
                .section-header h2 {
                    font-size: clamp(1.5rem, 4vw, 2rem);
                    color: var(--primary-color);
                    font-weight: 800;
                    margin-bottom: 8px;
                    letter-spacing: -0.025em;
                }
                .section-header p {
                    color: var(--secondary-text);
                    font-size: clamp(0.875rem, 2vw, 1rem);
                    line-height: 1.6;
                }
                .courses-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 24px;
                    margin-top: 32px;
                }
                .course-card {
                    border: 2px solid var(--border-color);
                    border-radius: 20px;
                    overflow: hidden;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    background: var(--card-bg);
                    position: relative;
                }
                .course-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 4px;
                    background: linear-gradient(90deg, var(--primary-color) 0%, var(--accent) 100%);
                    transform: scaleX(0);
                    transition: transform 0.3s ease;
                }
                .course-card:hover::before {
                    transform: scaleX(1);
                }
                .course-card:hover {
                    transform: translateY(-8px);
                    border-color: var(--primary-color);
                    box-shadow: var(--shadow-xl);
                }
                .course-card.selected {
                    border-color: var(--primary-color);
                    background: var(--primary-light);
                    box-shadow: 0 0 0 4px var(--primary-light);
                }
                .course-card.selected::before {
                    transform: scaleX(1);
                }
                .course-img {
                    height: 180px;
                    position: relative;
                    background: var(--border-color);
                    overflow: hidden;
                }
                .course-img img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transition: transform 0.3s ease;
                }
                .course-card:hover .course-img img {
                    transform: scale(1.05);
                }
                .course-overlay {
                    position: absolute;
                    bottom: 12px;
                    right: 12px;
                    background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent) 100%);
                    color: white;
                    padding: 6px 14px;
                    border-radius: 10px;
                    font-weight: 800;
                    font-size: 0.9rem;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                }
                .course-info {
                    padding: 24px;
                    flex-grow: 1;
                    display: flex;
                    flex-direction: column;
                }
                .course-info h4 {
                    font-size: 0.7rem;
                    color: var(--primary-color);
                    text-transform: uppercase;
                    letter-spacing: 1.5px;
                    margin-bottom: 8px;
                    font-weight: 800;
                }
                .course-info h3 {
                    font-size: clamp(0.95rem, 2vw, 1.05rem);
                    font-weight: 700;
                    margin-bottom: 12px;
                    line-height: 1.4;
                    color: var(--text-color);
                    min-height: 2.8em;
                }
                .duration {
                    font-size: 0.875rem;
                    color: var(--secondary-text);
                    margin-bottom: 16px;
                    font-weight: 500;
                }
                .features {
                    list-style: none;
                    margin: 0 0 24px 0;
                    padding: 0;
                    flex-grow: 1;
                }
                .features li {
                    font-size: 0.85rem;
                    color: var(--secondary-text);
                    margin-bottom: 8px;
                    line-height: 1.5;
                }
                .select-pkg-btn {
                    width: 100%;
                    padding: 14px 20px;
                    border-radius: 12px;
                    border: none;
                    background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent) 100%);
                    color: white;
                    font-weight: 700;
                    font-size: 0.95rem;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 12px rgba(26, 79, 186, 0.2);
                }
                .select-pkg-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 16px rgba(26, 79, 186, 0.3);
                }
                .select-pkg-btn:active {
                    transform: translateY(0);
                }

                /* Course Summary in Step 3 */
                .form-card-inner {
                    margin-top: 24px;
                }
                .selected-course-summary {
                    background: var(--primary-light);
                    border: 2px solid var(--primary-color);
                    border-radius: 16px;
                    padding: 24px;
                    margin-bottom: 32px;
                }
                .summary-label {
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    color: var(--primary-color);
                    font-weight: 800;
                    letter-spacing: 1px;
                    margin-bottom: 8px;
                }
                .summary-value {
                    font-size: 1.125rem;
                    font-weight: 700;
                    color: var(--text-color);
                    margin-bottom: 16px;
                }
                .mt-4 {
                    margin-top: 16px;
                }
                .mb-2 {
                    margin-bottom: 8px;
                }
                .mb-6 {
                    margin-bottom: 24px;
                }
                .block {
                    display: block;
                }
                .text-xs {
                    font-size: 0.75rem;
                }
                .font-bold {
                    font-weight: 700;
                }
                .flex {
                    display: flex;
                }
                .gap-2 {
                    gap: 8px;
                }
                .px-4 {
                    padding-left: 16px;
                    padding-right: 16px;
                }
                .py-1\.5 {
                    padding-top: 6px;
                    padding-bottom: 6px;
                }
                .rounded-full {
                    border-radius: 9999px;
                }
                .border {
                    border-width: 2px;
                    border-style: solid;
                }
                .border-gray-300 {
                    border-color: var(--border-color);
                }
                .transition-all {
                    transition: all 0.2s ease;
                }
                .bg-primary {
                    background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent) 100%);
                }
                .text-white {
                    color: white;
                }
                .border-primary {
                    border-color: var(--primary-color);
                }
                .ml-2 {
                    margin-left: 8px;
                    display: inline-block;
                    vertical-align: middle;
                }
                .mr-2 {
                    margin-right: 8px;
                    display: inline-block;
                    vertical-align: middle;
                }

                /* Action Buttons */
                .step-actions {
                    margin-top: 48px;
                    padding-top: 24px;
                    border-top: 2px solid var(--border-color);
                    display: flex;
                    justify-content: flex-end;
                    gap: 16px;
                    flex-wrap: wrap;
                }
                .next-btn, 
                .submit-enroll-btn {
                    padding: 16px 32px;
                    background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent) 100%);
                    color: white;
                    border: none;
                    border-radius: 12px;
                    font-weight: 700;
                    font-size: 1rem;
                    cursor: pointer;
                    box-shadow: 0 4px 12px rgba(26, 79, 186, 0.2);
                    transition: all 0.3s ease;
                    min-width: 140px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }
                .next-btn:hover, 
                .submit-enroll-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 16px rgba(26, 79, 186, 0.3);
                }
                .next-btn:active,
                .submit-enroll-btn:active {
                    transform: translateY(0);
                }
                .back-btn {
                    padding: 16px 32px;
                    background: var(--card-bg);
                    color: var(--text-color);
                    border: 2px solid var(--border-color);
                    border-radius: 12px;
                    font-weight: 700;
                    font-size: 1rem;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    min-width: 140px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }
                .back-btn:hover {
                    border-color: var(--primary-color);
                    color: var(--primary-color);
                    background: var(--primary-light);
                }

                /* Review Section */
                .review-container {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 32px;
                }
                .review-section {
                    background: var(--bg-color);
                    padding: 24px;
                    border-radius: 16px;
                    border: 2px solid var(--border-color);
                }
                .review-section h4 {
                    color: var(--primary-color);
                    font-size: 0.85rem;
                    text-transform: uppercase;
                    letter-spacing: 1.2px;
                    margin-bottom: 16px;
                    font-weight: 800;
                    border-bottom: 2px solid var(--primary-color);
                    padding-bottom: 8px;
                }
                .review-section p {
                    font-size: 0.95rem;
                    margin-bottom: 12px;
                    color: var(--text-color);
                    line-height: 1.6;
                }
                .review-section p strong {
                    color: var(--secondary-text);
                    font-weight: 600;
                    font-size: 0.85rem;
                    display: block;
                    margin-bottom: 4px;
                }

                /* Animations */
                .animate-fadeIn {
                    animation: fadeIn 0.5s cubic-bezier(0.4, 0, 0.2, 1);
                }
                @keyframes fadeIn {
                    from { 
                        opacity: 0; 
                        transform: translateY(20px);
                    }
                    to { 
                        opacity: 1; 
                        transform: translateY(0);
                    }
                }

                /* Responsive Design */
                @media (max-width: 1200px) {
                    .form-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                    .courses-grid {
                        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    }
                }

                @media (max-width: 1024px) {
                    .enrollment-wizard {
                        padding: 36px;
                    }
                    .form-section {
                        margin-bottom: 32px;
                    }
                }

                @media (max-width: 768px) {
                    .walk-in-container {
                        padding: 16px 0;
                    }
                    .walk-in-header {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 20px;
                        margin-bottom: 24px;
                    }
                    .step-indicator {
                        width: 100%;
                        justify-content: center;
                        padding: 10px 16px;
                        order: -1;
                    }
                    .step-dot {
                        width: 32px;
                        height: 32px;
                        font-size: 0.8rem;
                    }
                    .step-line {
                        width: 24px;
                    }
                    .enrollment-wizard {
                        padding: 24px;
                        border-radius: 16px;
                    }
                    .form-grid {
                        grid-template-columns: 1fr;
                        gap: 16px;
                    }
                    .form-group.full-width {
                        grid-column: 1;
                    }
                    .courses-grid {
                        grid-template-columns: 1fr;
                        gap: 20px;
                    }
                    .course-card {
                        max-width: 100%;
                    }
                    .step-actions {
                        flex-direction: column-reverse;
                        gap: 12px;
                        margin-top: 32px;
                    }
                    .next-btn,
                    .submit-enroll-btn,
                    .back-btn {
                        width: 100%;
                        padding: 14px 24px;
                    }
                    .review-container {
                        grid-template-columns: 1fr;
                        gap: 20px;
                    }
                }

                @media (max-width: 480px) {
                    .header-info h2 {
                        font-size: 1.35rem;
                    }
                    .enrollment-wizard {
                        padding: 20px;
                    }
                    .form-group input,
                    .form-group select {
                        padding: 12px 14px;
                        font-size: 0.9rem;
                    }
                    .course-img {
                        height: 160px;
                    }
                    .course-info {
                        padding: 20px;
                    }
                    .step-actions {
                        margin-top: 24px;
                    }
                }

                /* Print styles */
                @media print {
                    .walk-in-header,
                    .step-indicator,
                    .step-actions {
                        display: none;
                    }
                    .enrollment-wizard {
                        box-shadow: none;
                        border: 1px solid #000;
                    }
                }
            `}</style>
        </div>
    );
};

export default WalkInEnrollment;
