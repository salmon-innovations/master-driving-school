import React, { useState, useEffect } from 'react';
import './css/user.css';
import { coursesAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import Pagination from './components/Pagination';

const COURSE_PAGE_SIZE = 10;

const CourseManagement = () => {
    const { showNotification } = useNotification();
    const [searchTerm, setSearchTerm] = useState('');
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingCourse, setEditingCourse] = useState(null);
    const [coursePage, setCoursePage] = useState(1);
    const [courseData, setCourseData] = useState({
        name: '',
        description: '',
        price: '',
        duration: '',
        images: [],
        status: 'active',
        category: 'Basic',
        course_type: ''
    });
    const [pricingVariations, setPricingVariations] = useState([]);
    const [viewingImage, setViewingImage] = useState(null);
    const [courseConfig, setCourseConfig] = useState(null);

    // Fetch courses from database
    useEffect(() => {
        fetchCourses();
        coursesAPI.getConfig().then(r => { if (r.success) setCourseConfig(r.config); }).catch(() => {});
    }, []);

    const fetchCourses = async () => {
        setLoading(true);
        try {
            const response = await coursesAPI.getAll();
            // Process courses - parse image_url if it's JSON
            const processedCourses = response.courses.map(course => {
                let parsedImages = [];
                if (course.image_url) {
                    if (typeof course.image_url === 'string') {
                        try {
                            const parsed = JSON.parse(course.image_url);
                            parsedImages = Array.isArray(parsed) ? parsed : [parsed];
                        } catch (e) {
                            parsedImages = [course.image_url];
                        }
                    } else if (Array.isArray(course.image_url)) {
                        parsedImages = course.image_url;
                    } else {
                        parsedImages = [course.image_url];
                    }
                }

                // Filter out blob URLs as they won't work
                parsedImages = parsedImages.filter(img => img && !img.startsWith('blob:'));

                // Parse pricing_data
                let parsedPricingData = [];
                if (course.pricing_data) {
                    if (typeof course.pricing_data === 'string') {
                        try {
                            parsedPricingData = JSON.parse(course.pricing_data);
                        } catch (e) {
                            console.error('Error parsing pricing_data:', e);
                        }
                    } else if (Array.isArray(course.pricing_data)) {
                        parsedPricingData = course.pricing_data;
                    }
                }

                return {
                    ...course,
                    images: parsedImages,
                    status: course.status || 'active',
                    price: parseFloat(course.price) || 0,
                    category: course.category || 'Basic',
                    course_type: course.course_type || '',
                    pricing_data: parsedPricingData
                };
            });
            setCourses(processedCourses);
        } catch (error) {
            console.error('Error fetching courses:', error);
            showNotification('Failed to load courses. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;

        // Validate price field
        if (name === 'price') {
            // Only allow positive numbers (no letters, no negative, no zero)
            if (value === '' || (parseFloat(value) > 0 && /^\d*\.?\d*$/.test(value))) {
                setCourseData({ ...courseData, [name]: value });
            }
            return;
        }

        // Validate duration field
        if (name === 'duration') {
            // Only allow positive numbers (no letters, no negative, no zero)
            if (value === '' || (parseFloat(value) > 0 && /^\d*\.?\d*$/.test(value))) {
                setCourseData({ ...courseData, [name]: value });
            }
            return;
        }

        setCourseData({ ...courseData, [name]: value });
    };

    const handleAddPricingVariation = () => {
        setPricingVariations([...pricingVariations, { type: '', price: '' }]);
    };

    const handleRemovePricingVariation = (index) => {
        setPricingVariations(pricingVariations.filter((_, i) => i !== index));
    };

    const handlePricingVariationChange = (index, field, value) => {
        const updated = [...pricingVariations];

        // Validate price field in variations
        if (field === 'price') {
            // Only allow positive numbers (no letters, no negative, no zero)
            if (value === '' || (parseFloat(value) > 0 && /^\d*\.?\d*$/.test(value))) {
                updated[index][field] = value;
                setPricingVariations(updated);
            }
            return;
        }

        updated[index][field] = value;
        setPricingVariations(updated);
    };

    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        const currentImageCount = courseData.images.length;
        const remainingSlots = 4 - currentImageCount;

        // Check if max images reached
        if (remainingSlots <= 0) {
            showNotification('Maximum 4 images allowed', 'warning');
            return;
        }

        // Validate file types
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const invalidFiles = files.filter(file => !validTypes.includes(file.type));
        if (invalidFiles.length > 0) {
            showNotification('Only JPG, PNG, and WEBP images are allowed', 'error');
            return;
        }

        // Validate file sizes (max 5MB each)
        const maxSize = 5 * 1024 * 1024; // 5MB
        const oversizedFiles = files.filter(file => file.size > maxSize);
        if (oversizedFiles.length > 0) {
            showNotification('Each image must be less than 5MB', 'error');
            return;
        }

        // Take only the number of files we can add
        const filesToAdd = files.slice(0, remainingSlots);

        // Convert files to base64
        const base64Images = await Promise.all(
            filesToAdd.map(file => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            })
        );

        setCourseData({
            ...courseData,
            images: [...courseData.images, ...base64Images]
        });

        // Notify if some files weren't added due to limit
        if (files.length > remainingSlots) {
            showNotification(`Only ${remainingSlots} image(s) added. Maximum is 4 images total.`, 'warning');
        }
    };

    const handleRemoveImage = (index) => {
        const newImages = courseData.images.filter((_, i) => i !== index);
        setCourseData({ ...courseData, images: newImages });
    };

    const handleAddCourse = async (e) => {
        e.preventDefault();

        // Validate main price
        if (!courseData.price || parseFloat(courseData.price) <= 0) {
            showNotification('Please enter a valid price (must be greater than 0)', 'error');
            return;
        }

        // Validate duration
        if (!courseData.duration || parseFloat(courseData.duration) <= 0) {
            showNotification('Please enter a valid duration (must be greater than 0)', 'error');
            return;
        }

        // Validate pricing variations prices
        if (pricingVariations.length > 0) {
            const invalidPrices = pricingVariations.some(v => !v.price || parseFloat(v.price) <= 0);
            if (invalidPrices) {
                showNotification('All pricing variation prices must be greater than 0', 'error');
                return;
            }
        }

        try {
            // Process pricing variations to ensure prices are numbers
            const processedPricingData = pricingVariations.length > 0
                ? pricingVariations.map(v => ({
                    type: v.type,
                    price: parseFloat(v.price)
                }))
                : null;

            const coursePayload = {
                name: courseData.name,
                description: courseData.description,
                price: parseFloat(courseData.price),
                duration: courseData.duration,
                status: courseData.status,
                images: courseData.images,
                category: courseData.category,
                course_type: courseData.course_type || null,
                pricing_data: processedPricingData
            };

            console.log('Sending course payload:', coursePayload);

            if (editingCourse) {
                // Update existing course
                await coursesAPI.update(editingCourse.id, coursePayload);
                showNotification('Course updated successfully!', 'success');
            } else {
                // Add new course
                await coursesAPI.create(coursePayload);
                showNotification('Course added successfully!', 'success');
            }

            // Refresh courses list
            await fetchCourses();
            handleCloseModal();
        } catch (error) {
            console.error('Error saving course:', error);
            showNotification(error.message || 'Failed to save course. Please try again.', 'error');
        }
    };

    const handleEdit = (course) => {
        setEditingCourse(course);
        setCourseData({
            name: course.name,
            description: course.description,
            price: course.price.toString(),
            duration: course.duration,
            images: course.images || [],
            status: course.status.toLowerCase(),
            category: course.category || 'Basic',
            course_type: course.course_type || ''
        });
        setPricingVariations(course.pricing_data || []);
        setShowModal(true);
    };

    const handleDelete = async (courseId) => {
        if (window.confirm('Are you sure you want to delete this course?')) {
            try {
                await coursesAPI.delete(courseId);
                showNotification('Course deleted successfully!', 'success');
                // Refresh courses list
                await fetchCourses();
            } catch (error) {
                console.error('Error deleting course:', error);
                showNotification('Failed to delete course. Please try again.', 'error');
            }
        }
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingCourse(null);
        setCourseData({
            name: '',
            description: '',
            price: '',
            duration: '',
            images: [],
            status: 'active',
            category: 'Basic',
            course_type: ''
        });
        setPricingVariations([]);
    };

    const filteredCourses = courses.filter(course =>
        course.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Reset to page 1 when search changes
    useEffect(() => { setCoursePage(1); }, [searchTerm]);

    const courseTotalPages = Math.ceil(filteredCourses.length / COURSE_PAGE_SIZE);
    const pagedCourses = filteredCourses.slice((coursePage - 1) * COURSE_PAGE_SIZE, coursePage * COURSE_PAGE_SIZE);

    return (
        <div className="user-management-container">
            <div className="course-management-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div className="search-box" style={{ flex: '1', minWidth: '250px', maxWidth: '500px' }}>
                    <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
                    <input
                        type="text"
                        placeholder="Search courses..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px 12px 12px 40px',
                            border: '1.5px solid var(--border-color)',
                            borderRadius: '12px',
                            fontSize: '0.95rem',
                            transition: 'all 0.2s',
                            background: 'var(--card-bg)',
                            color: 'var(--text-color)'
                        }}
                    />
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 24px',
                        background: 'var(--primary-color)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '0.95rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        whiteSpace: 'nowrap'
                    }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Add Course
                </button>
            </div>

            {/* Courses Grid */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--secondary-text)' }}>
                    <div style={{ fontSize: '1.1rem' }}>Loading courses...</div>
                </div>
            ) : filteredCourses.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--secondary-text)' }}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 20px', opacity: 0.5 }}>
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                    </svg>
                    <div style={{ fontSize: '1.1rem', marginBottom: '8px' }}>No courses found</div>
                    <p style={{ fontSize: '0.9rem' }}>Try adjusting your search or add a new course</p>
                </div>
            ) : (
                <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                    {pagedCourses.map((course) => (
                        <div
                            key={course.id}
                            style={{
                                background: 'var(--card-bg)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '16px',
                                overflow: 'hidden',
                                transition: 'all 0.3s',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            {/* Course Image */}
                            <div style={{
                                width: '100%',
                                height: '180px',
                                overflow: 'hidden',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative'
                            }}>
                                {course.images && course.images.length > 0 && course.images[0] ? (
                                    <img
                                        src={course.images[0]}
                                        alt={course.name}
                                        onClick={() => setViewingImage({ current: course.images[0], all: course.images })}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            cursor: 'pointer',
                                            transition: 'transform 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                                        onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                        }}
                                    />
                                ) : null}
                                {(!course.images || course.images.length === 0 || !course.images[0]) && (
                                    <span style={{ color: 'white', fontSize: '3rem', fontWeight: 'bold', zIndex: 1 }}>
                                        {course.name.charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>

                            {/* Course Content */}
                            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                                {course.category === 'Promo' && (
                                    <div style={{ marginBottom: '8px' }}>
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                            padding: '3px 8px',
                                            background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                                            color: '#92400e', borderRadius: '6px',
                                            fontSize: '0.72rem', fontWeight: '800',
                                            border: '1px solid #f59e0b', letterSpacing: '0.03em'
                                        }}>
                                            🏷️ PROMO BUNDLE
                                        </span>
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-color)', margin: 0, flex: 1 }}>
                                        {course.name}
                                    </h3>
                                    <span style={{
                                        padding: '4px 10px',
                                        borderRadius: '8px',
                                        fontSize: '0.75rem',
                                        fontWeight: '600',
                                        background: course.status.toLowerCase() === 'active' ? '#d1fae5' : '#fee2e2',
                                        color: course.status.toLowerCase() === 'active' ? '#065f46' : '#991b1b'
                                    }}>
                                        {course.status.charAt(0).toUpperCase() + course.status.slice(1).toLowerCase()}
                                    </span>
                                </div>

                                <p style={{
                                    fontSize: '0.85rem',
                                    color: 'var(--secondary-text)',
                                    marginBottom: '16px',
                                    lineHeight: '1.5',
                                    minHeight: '60px',
                                    overflow: 'hidden',
                                    display: '-webkit-box',
                                    WebkitLineClamp: '3',
                                    WebkitBoxOrient: 'vertical'
                                }}>
                                    {course.description}
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', fontSize: '0.85rem', marginTop: 'auto' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                            <line x1="16" y1="2" x2="16" y2="6"></line>
                                            <line x1="8" y1="2" x2="8" y2="6"></line>
                                            <line x1="3" y1="10" x2="21" y2="10"></line>
                                        </svg>
                                        <span style={{ color: 'var(--secondary-text)' }}>{course.duration} Hours</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                            <circle cx="9" cy="7" r="4"></circle>
                                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                        </svg>
                                        <span style={{ color: 'var(--secondary-text)' }}>{course.enrolled || 0} enrolled</span>
                                    </div>
                                </div>

                                {/* Price Section */}
                                <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border-color)', marginTop: 'auto' }}>
                                    {/* Pricing Options - Show both main and variations */}
                                    {(course.course_type || (course.pricing_data && course.pricing_data.length > 0)) ? (
                                        <div style={{ marginBottom: '12px' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--secondary-text)', marginBottom: '8px', textTransform: 'uppercase' }}>
                                                Pricing Options:
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                {/* Main course type and price */}
                                                {course.course_type && (
                                                    <div style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        padding: '8px 12px',
                                                        background: 'var(--bg-color)',
                                                        borderRadius: '8px',
                                                        border: '1px solid var(--border-color)'
                                                    }}>
                                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-color)', fontWeight: '500' }}>
                                                            {course.category === 'Promo' ? (() => {
                                                                const labels = {
                                                                    'F2F+Motorcycle': 'F2F TDC + MOTOR', 'F2F+CarAT': 'F2F TDC + CAR AT', 'F2F+CarMT': 'F2F TDC + CAR MT',
                                                                    'Online+Motorcycle': 'OTDC + MOTOR', 'Online+CarAT': 'OTDC + CAR AT', 'Online+CarMT': 'OTDC + CAR MT'
                                                                }
                                                                return labels[course.course_type] || course.course_type
                                                            })() : course.course_type}
                                                        </span>
                                                        <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary-color)' }}>
                                                            ₱{parseFloat(course.price).toLocaleString()}
                                                        </span>
                                                    </div>
                                                )}
                                                {/* Additional pricing variations */}
                                                {course.pricing_data && course.pricing_data.map((variation, idx) => (
                                                    <div key={idx} style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        padding: '8px 12px',
                                                        background: 'var(--bg-color)',
                                                        borderRadius: '8px',
                                                        border: '1px solid var(--border-color)'
                                                    }}>
                                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-color)', fontWeight: '500' }}>
                                                            {variation.type}
                                                        </span>
                                                        <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary-color)' }}>
                                                            ₱{parseFloat(variation.price).toLocaleString()}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ marginBottom: '12px' }}>
                                            <span style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary-color)' }}>
                                                ₱{course.price.toLocaleString()}
                                            </span>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                        <button
                                            onClick={() => handleEdit(course)}
                                            style={{
                                                padding: '8px 12px',
                                                background: 'var(--primary-light)',
                                                color: 'var(--primary-color)',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontSize: '0.85rem',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(course.id)}
                                            style={{
                                                padding: '8px 12px',
                                                background: '#fee2e2',
                                                color: '#991b1b',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontSize: '0.85rem',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <Pagination
                    currentPage={coursePage}
                    totalPages={courseTotalPages}
                    onPageChange={setCoursePage}
                    totalItems={filteredCourses.length}
                    pageSize={COURSE_PAGE_SIZE}
                />
                </>
            )}

            {/* Image Viewer Modal */}
            {viewingImage && (
                <div
                    onClick={() => setViewingImage(null)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.9)',
                        zIndex: 9999,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px',
                        cursor: 'pointer'
                    }}
                >
                    <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '80vh', display: 'flex', justifyContent: 'center' }}>
                        <button
                            onClick={() => setViewingImage(null)}
                            style={{
                                position: 'absolute',
                                top: '-40px',
                                right: '0',
                                background: 'white',
                                border: 'none',
                                borderRadius: '50%',
                                width: '36px',
                                height: '36px',
                                fontSize: '24px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold',
                                color: '#333'
                            }}
                        >
                            ×
                        </button>
                        <img
                            src={typeof viewingImage === 'string' ? viewingImage : viewingImage.current}
                            alt="Full size"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                maxWidth: '100%',
                                maxHeight: '75vh',
                                objectFit: 'contain',
                                borderRadius: '8px',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                            }}
                        />
                    </div>
                    {typeof viewingImage === 'object' && viewingImage.all && viewingImage.all.length > 1 && (
                        <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                display: 'flex',
                                gap: '15px',
                                marginTop: '20px',
                                maxWidth: '90%',
                                overflowX: 'auto',
                                padding: '10px'
                            }}
                        >
                            {viewingImage.all.map((img, idx) => (
                                <img
                                    key={idx}
                                    src={img}
                                    onClick={() => setViewingImage({ ...viewingImage, current: img })}
                                    style={{
                                        width: '80px',
                                        height: '80px',
                                        objectFit: 'cover',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        border: (viewingImage.current || viewingImage) === img ? '3px solid #3b82f6' : '3px solid transparent',
                                        transition: 'all 0.2s',
                                        opacity: (viewingImage.current || viewingImage) === img ? 1 : 0.6
                                    }}
                                    onMouseEnter={(e) => e.target.style.opacity = 1}
                                    onMouseLeave={(e) => e.target.style.opacity = (viewingImage.current || viewingImage) === img ? 1 : 0.6}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Add/Edit Course Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-container user-modal" style={{ maxWidth: '650px', width: '95%' }}>
                        <div className="modal-header">
                            <div className="modal-header-left">
                                <div className="modal-header-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
                                </div>
                                <div>
                                    <h2>{editingCourse ? 'Edit Course' : 'Add New Course'}</h2>
                                    <p>{editingCourse ? 'Update course information' : 'Fill in the details to add a new course'}</p>
                                </div>
                            </div>
                            <div className="modal-header-right">
                                <button className="close-modal" onClick={handleCloseModal}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>
                        </div>
                        <form onSubmit={handleAddCourse}>
                            <div className="modal-body" style={{
                                maxHeight: '500px',
                                overflowY: 'auto',
                                padding: '30px',
                                background: 'var(--bg-color)'
                            }}>
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-color)' }}>
                                        Course Name <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={courseData.name}
                                        onChange={handleInputChange}
                                        placeholder="e.g., Theoretical Driving Course"
                                        required
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            border: '1.5px solid var(--border-color)',
                                            borderRadius: '10px',
                                            fontSize: '0.95rem',
                                            background: 'var(--card-bg)',
                                            color: 'var(--text-color)'
                                        }}
                                    />
                                </div>

                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-color)' }}>
                                        Description <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <textarea
                                        name="description"
                                        value={courseData.description}
                                        onChange={handleInputChange}
                                        placeholder="Brief description of the course"
                                        required
                                        rows="3"
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            border: '1.5px solid var(--border-color)',
                                            borderRadius: '10px',
                                            fontSize: '0.95rem',
                                            background: 'var(--card-bg)',
                                            color: 'var(--text-color)',
                                            resize: 'vertical'
                                        }}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-color)' }}>
                                            Price (₱) <span style={{ color: '#ef4444' }}>*</span>
                                        </label>
                                        <input
                                            type="number"
                                            name="price"
                                            value={courseData.price}
                                            onChange={handleInputChange}
                                            placeholder="5000"
                                            required
                                            min="0"
                                            step="0.01"
                                            style={{
                                                width: '100%',
                                                padding: '12px',
                                                border: '1.5px solid var(--border-color)',
                                                borderRadius: '10px',
                                                fontSize: '0.95rem',
                                                background: 'var(--card-bg)',
                                                color: 'var(--text-color)'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-color)' }}>
                                            Duration <span style={{ color: '#ef4444' }}>*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="duration"
                                            value={courseData.duration}
                                            onChange={handleInputChange}
                                            placeholder="e.g., 2 weeks"
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '12px',
                                                border: '1.5px solid var(--border-color)',
                                                borderRadius: '10px',
                                                fontSize: '0.95rem',
                                                background: 'var(--card-bg)',
                                                color: 'var(--text-color)'
                                            }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-color)' }}>
                                            Category <span style={{ color: '#ef4444' }}>*</span>
                                        </label>
                                        <select
                                            name="category"
                                            value={courseData.category}
                                            onChange={(e) => {
                                                handleInputChange(e);
                                                // Reset course_type when category changes
                                                setCourseData(prev => ({ ...prev, course_type: '' }));
                                            }}
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '12px',
                                                border: '1.5px solid var(--border-color)',
                                                borderRadius: '10px',
                                                fontSize: '0.95rem',
                                                background: 'var(--card-bg)',
                                                color: 'var(--text-color)'
                                            }}
                                        >
                                            {(courseConfig?.categories || ['Basic', 'TDC', 'PDC', 'Promo']).map(cat => (
                                                <option key={cat} value={cat}>
                                                    {cat === 'TDC' ? 'TDC (Theoretical Driving Course)'
                                                        : cat === 'PDC' ? 'PDC (Practical Driving Course)'
                                                        : cat === 'Promo' ? '🏷️ Promo Bundle (TDC + PDC)'
                                                        : cat}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-color)' }}>
                                            Status <span style={{ color: '#ef4444' }}>*</span>
                                        </label>
                                        <select
                                            name="status"
                                            value={courseData.status}
                                            onChange={handleInputChange}
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '12px',
                                                border: '1.5px solid var(--border-color)',
                                                borderRadius: '10px',
                                                fontSize: '0.95rem',
                                                background: 'var(--card-bg)',
                                                color: 'var(--text-color)'
                                            }}
                                        >
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Conditional Course Type based on Category */}
                                {(courseData.category === 'TDC' || courseData.category === 'PDC') && (
                                    <div style={{ marginBottom: '20px' }}>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-color)' }}>
                                            Type <span style={{ color: '#ef4444' }}>*</span>
                                        </label>
                                        <select
                                            name="course_type"
                                            value={courseData.course_type}
                                            onChange={handleInputChange}
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '12px',
                                                border: '1.5px solid var(--border-color)',
                                                borderRadius: '10px',
                                                fontSize: '0.95rem',
                                                background: 'var(--card-bg)',
                                                color: 'var(--text-color)'
                                            }}
                                        >
                                            <option value="">Select Type</option>
                                            {courseData.category === 'TDC' && (
                                                (courseConfig?.tdcTypes || [{ value: 'Online', label: 'Online' }, { value: 'F2F', label: 'F2F (Face-to-Face)' }])
                                                    .map(t => <option key={t.value} value={t.value}>{t.label}</option>)
                                            )}
                                            {courseData.category === 'PDC' && (
                                                (courseConfig?.pdcTypes || [{ value: 'Automatic', label: 'Automatic' }, { value: 'Manual', label: 'Manual' }, { value: 'V1-Tricycle', label: 'V1-Tricycle' }, { value: 'B1-Van/B2 - L300', label: 'B1 - Van/B2 - L300' }])
                                                    .map(t => <option key={t.value} value={t.value}>{t.label}</option>)
                                            )}
                                        </select>
                                    </div>
                                )}

                                {/* Promo Bundle Selector */}
                                {courseData.category === 'Promo' && (
                                    <div style={{ marginBottom: '20px' }}>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-color)' }}>
                                            Bundle Type <span style={{ color: '#ef4444' }}>*</span>
                                        </label>
                                        <select
                                            name="course_type"
                                            value={courseData.course_type}
                                            onChange={handleInputChange}
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '12px',
                                                border: '1.5px solid #f59e0b',
                                                borderRadius: '10px',
                                                fontSize: '0.95rem',
                                                background: 'var(--card-bg)',
                                                color: 'var(--text-color)'
                                            }}
                                        >
                                            <option value="">Select Promo Bundle</option>
                                            {(courseConfig?.bundleTypes || [
                                                { value: 'F2F+Motorcycle', label: 'F2F TDC + MOTOR (Motorcycle PDC)' },
                                                { value: 'F2F+CarAT', label: 'F2F TDC + CAR AT (Car Automatic PDC)' },
                                                { value: 'F2F+CarMT', label: 'F2F TDC + CAR MT (Car Manual PDC)' },
                                                { value: 'Online+Motorcycle', label: 'OTDC + MOTOR (Motorcycle PDC)' },
                                                { value: 'Online+CarAT', label: 'OTDC + CAR AT (Car Automatic PDC)' },
                                                { value: 'Online+CarMT', label: 'OTDC + CAR MT (Car Manual PDC)' },
                                            ]).map(b => (
                                                <option key={b.value} value={b.value}>{b.label}</option>
                                            ))}
                                        </select>
                                        <p style={{ marginTop: '6px', fontSize: '0.8rem', color: '#92400e', background: '#fef3c7', padding: '8px 10px', borderRadius: '8px' }}>
                                            🏷️ Students select a TDC slot first, then a PDC slot when booking this promo.
                                        </p>
                                    </div>
                                )}

                                {/* Additional Type & Price Variations */}
                                {(courseData.category === 'TDC' || courseData.category === 'PDC') && (
                                    <div style={{ marginBottom: '20px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                            <label style={{ fontWeight: '600', color: 'var(--text-color)' }}>
                                                Additional Type & Price Variations
                                            </label>
                                            <button
                                                type="button"
                                                onClick={handleAddPricingVariation}
                                                style={{
                                                    padding: '8px 16px',
                                                    background: 'var(--primary-color)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                + Add Variation
                                            </button>
                                        </div>

                                        {pricingVariations.map((variation, index) => (
                                            <div key={index} style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1fr 1fr auto',
                                                gap: '12px',
                                                marginBottom: '12px',
                                                padding: '16px',
                                                background: 'var(--card-bg)',
                                                border: '1.5px solid var(--border-color)',
                                                borderRadius: '10px'
                                            }}>
                                                <div>
                                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-color)' }}>
                                                        Type
                                                    </label>
                                                    <select
                                                        value={variation.type}
                                                        onChange={(e) => handlePricingVariationChange(index, 'type', e.target.value)}
                                                        required
                                                        style={{
                                                            width: '100%',
                                                            padding: '10px',
                                                            border: '1.5px solid var(--border-color)',
                                                            borderRadius: '8px',
                                                            fontSize: '0.9rem',
                                                            background: 'var(--bg-color)',
                                                            color: 'var(--text-color)'
                                                        }}
                                                    >
                                                        <option value="">Select Type</option>
                                                        {courseData.category === 'TDC' && (
                                                            <>
                                                                <option value="Online">Online</option>
                                                                <option value="F2F">F2F (Face-to-Face)</option>
                                                            </>
                                                        )}
                                                        {courseData.category === 'PDC' && (
                                                            <>
                                                                <option value="Automatic">Automatic</option>
                                                                <option value="Manual">Manual</option>
                                                                <option value="B1-Van">B1 - Van</option>
                                                                <option value="B2-L300">B2 - L300</option>
                                                            </>
                                                        )}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-color)' }}>
                                                        Price (₱)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={variation.price}
                                                        onChange={(e) => handlePricingVariationChange(index, 'price', e.target.value)}
                                                        placeholder="5000"
                                                        required
                                                        min="0"
                                                        step="0.01"
                                                        style={{
                                                            width: '100%',
                                                            padding: '10px',
                                                            border: '1.5px solid var(--border-color)',
                                                            borderRadius: '8px',
                                                            fontSize: '0.9rem',
                                                            background: 'var(--bg-color)',
                                                            color: 'var(--text-color)'
                                                        }}
                                                    />
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemovePricingVariation(index)}
                                                        style={{
                                                            padding: '10px 14px',
                                                            background: '#ef4444',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '8px',
                                                            fontSize: '0.85rem',
                                                            fontWeight: '600',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        {pricingVariations.length === 0 && (
                                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: '8px 0 0 0' }}>
                                                Click "+ Add Variation" to add multiple types with different prices
                                            </p>
                                        )}
                                    </div>
                                )}

                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-color)' }}>
                                        Course Images <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>({courseData.images.length}/4 images)</span>
                                    </label>

                                    {/* Image Upload Button */}
                                    {courseData.images.length < 4 && (
                                        <div style={{ marginBottom: '12px' }}>
                                            <label style={{
                                                display: 'inline-block',
                                                padding: '12px 24px',
                                                background: 'var(--primary-color)',
                                                color: 'white',
                                                borderRadius: '10px',
                                                fontSize: '0.9rem',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}>
                                                <input
                                                    type="file"
                                                    accept="image/jpeg,image/jpg,image/png,image/webp"
                                                    multiple
                                                    onChange={handleImageUpload}
                                                    style={{ display: 'none' }}
                                                />
                                                📷 Upload Images
                                            </label>
                                            <span style={{ marginLeft: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                Max 4 images, 5MB each (JPG, PNG, WEBP)
                                            </span>
                                        </div>
                                    )}

                                    {/* Image Preview Grid */}
                                    {courseData.images.length > 0 && (
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(2, 1fr)',
                                            gap: '12px',
                                            marginTop: '12px'
                                        }}>
                                            {courseData.images.map((image, index) => (
                                                <div key={index} style={{
                                                    position: 'relative',
                                                    borderRadius: '10px',
                                                    overflow: 'hidden',
                                                    border: '2px solid var(--border-color)',
                                                    aspectRatio: '16/9'
                                                }}>
                                                    <img
                                                        src={image}
                                                        alt={`Course ${index + 1}`}
                                                        style={{
                                                            width: '100%',
                                                            height: '100%',
                                                            objectFit: 'cover'
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveImage(index)}
                                                        style={{
                                                            position: 'absolute',
                                                            top: '8px',
                                                            right: '8px',
                                                            background: 'rgba(239, 68, 68, 0.9)',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '50%',
                                                            width: '28px',
                                                            height: '28px',
                                                            fontSize: '16px',
                                                            fontWeight: 'bold',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(220, 38, 38, 1)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.9)'}
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="modal-footer" style={{
                                padding: '20px 30px',
                                borderTop: '1px solid var(--border-color)',
                                background: 'var(--card-bg)',
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: '12px'
                            }}>
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    style={{
                                        padding: '12px 24px',
                                        background: 'var(--card-bg)',
                                        color: 'var(--text-color)',
                                        border: '1.5px solid var(--border-color)',
                                        borderRadius: '10px',
                                        fontSize: '0.95rem',
                                        fontWeight: '600',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        padding: '12px 24px',
                                        background: 'var(--primary-color)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '10px',
                                        fontSize: '0.95rem',
                                        fontWeight: '600',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {editingCourse ? 'Update Course' : 'Create Course'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CourseManagement;
