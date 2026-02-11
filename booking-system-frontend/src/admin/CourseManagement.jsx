    import React, { useState, useEffect } from 'react';
import './css/user.css';

const CourseManagement = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingCourse, setEditingCourse] = useState(null);
    const [courseData, setCourseData] = useState({
        name: '',
        description: '',
        price: '',
        duration: '',
        images: [],
        category: 'Basic',
        status: 'active'
    });
    const [imageFiles, setImageFiles] = useState([]);

    // Mock courses data - Replace with API call later
    useEffect(() => {
        fetchCourses();
    }, []);

    const fetchCourses = async () => {
        setLoading(true);
        // Simulate API call
        setTimeout(() => {
            setCourses([
                {
                    id: 1,
                    name: 'TDC (Theoretical Driving Course)',
                    description: 'Complete theoretical driving course covering traffic rules and regulations',
                    price: 3500,
                    duration: '15 hours',
                    images: ['/images/tdc.jpg'],
                    category: 'Theory',
                    status: 'Active',
                    enrolled: 245
                },
                {
                    id: 2,
                    name: 'PDC (Practical Driving Course)',
                    description: 'Hands-on practical driving training with professional instructors',
                    price: 8500,
                    duration: '8 sessions',
                    images: ['/images/pdc.jpg'],
                    category: 'Practical',
                    status: 'Active',
                    enrolled: 189
                },
                {
                    id: 3,
                    name: 'Student Permit Course',
                    description: 'Complete course for obtaining student permit',
                    price: 5000,
                    duration: '2 weeks',
                    images: ['/images/student-permit.jpg'],
                    category: 'Basic',
                    status: 'Active',
                    enrolled: 312
                }
            ]);
            setLoading(false);
        }, 500);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setCourseData({ ...courseData, [name]: value });
    };

    const handleImageUpload = (e) => {
        const files = Array.from(e.target.files);
        const currentImageCount = courseData.images.length;
        const remainingSlots = 4 - currentImageCount;

        // Check if max images reached
        if (remainingSlots <= 0) {
            alert('Maximum 4 images allowed');
            return;
        }

        // Validate file types
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const invalidFiles = files.filter(file => !validTypes.includes(file.type));
        if (invalidFiles.length > 0) {
            alert('Only JPG, PNG, and WEBP images are allowed');
            return;
        }

        // Validate file sizes (max 5MB each)
        const maxSize = 5 * 1024 * 1024; // 5MB
        const oversizedFiles = files.filter(file => file.size > maxSize);
        if (oversizedFiles.length > 0) {
            alert('Each image must be less than 5MB');
            return;
        }

        // Take only the number of files we can add
        const filesToAdd = files.slice(0, remainingSlots);
        const newImagePreviews = filesToAdd.map(file => URL.createObjectURL(file));
        
        setImageFiles([...imageFiles, ...filesToAdd]);
        setCourseData({
            ...courseData,
            images: [...courseData.images, ...newImagePreviews]
        });

        // Notify if some files weren't added due to limit
        if (files.length > remainingSlots) {
            alert(`Only ${remainingSlots} image(s) added. Maximum is 4 images total.`);
        }
    };

    const handleRemoveImage = (index) => {
        const newImages = courseData.images.filter((_, i) => i !== index);
        const newImageFiles = imageFiles.filter((_, i) => i !== index);
        
        // Revoke object URL if it's a blob
        if (courseData.images[index]?.startsWith('blob:')) {
            URL.revokeObjectURL(courseData.images[index]);
        }
        
        setCourseData({ ...courseData, images: newImages });
        setImageFiles(newImageFiles);
    };

    const handleAddCourse = (e) => {
        e.preventDefault();

        if (editingCourse) {
            // Update existing course
            setCourses(courses.map(course => 
                course.id === editingCourse.id 
                    ? { 
                        ...course, 
                        ...courseData,
                        price: parseFloat(courseData.price),
                        status: courseData.status.charAt(0).toUpperCase() + courseData.status.slice(1)
                    } 
                    : course
            ));
            alert('Course updated successfully!');
        } else {
            // Add new course
            const newCourse = {
                id: courses.length + 1,
                ...courseData,
                price: parseFloat(courseData.price),
                status: courseData.status.charAt(0).toUpperCase() + courseData.status.slice(1),
                enrolled: 0
            };
            setCourses([...courses, newCourse]);
            alert('Course added successfully!');
        }

        handleCloseModal();
    };

    const handleEdit = (course) => {
        setEditingCourse(course);
        setCourseData({
            name: course.name,
            description: course.description,
            price: course.price.toString(),
            duration: course.duration,
            images: course.images || [],
            category: course.category,
            status: course.status.toLowerCase()
        });
        setImageFiles([]);
        setShowModal(true);
    };

    const handleDelete = (courseId) => {
        if (window.confirm('Are you sure you want to delete this course?')) {
            setCourses(courses.filter(course => course.id !== courseId));
            alert('Course deleted successfully!');
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
            category: 'Basic',
            status: 'active'
        });
        setImageFiles([]);
        // Clean up object URLs
        courseData.images.forEach(url => {
            if (url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
            }
        });
    };

    const filteredCourses = courses.filter(course =>
        course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="user-management-container">
            <div className="management-header" style={{ marginBottom: '24px' }}>
                <div className="search-filter-section" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <div className="search-box" style={{ flex: '1', minWidth: '250px' }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                    {filteredCourses.map((course) => (
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
                                background: course.images && course.images.length > 0 
                                    ? 'none' 
                                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                {course.images && course.images.length > 0 ? (
                                    <img 
                                        src={course.images[0]} 
                                        alt={course.name}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover'
                                        }}
                                    />
                                ) : (
                                    <span style={{ color: 'white', fontSize: '3rem', fontWeight: 'bold' }}>
                                        {course.name.charAt(0)}
                                    </span>
                                )}
                            </div>

                            {/* Course Content */}
                            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-color)', margin: 0, flex: 1 }}>
                                        {course.name}
                                    </h3>
                                    <span style={{
                                        padding: '4px 10px',
                                        borderRadius: '8px',
                                        fontSize: '0.75rem',
                                        fontWeight: '600',
                                        background: course.status === 'Active' ? '#d1fae5' : '#fee2e2',
                                        color: course.status === 'Active' ? '#065f46' : '#991b1b'
                                    }}>
                                        {course.status}
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
                                        <span style={{ color: 'var(--secondary-text)' }}>{course.duration}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                            <circle cx="9" cy="7" r="4"></circle>
                                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                        </svg>
                                        <span style={{ color: 'var(--secondary-text)' }}>{course.enrolled} enrolled</span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid var(--border-color)', marginTop: 'auto' }}>
                                    <span style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary-color)' }}>
                                        ₱{course.price.toLocaleString()}
                                    </span>
                                    <div style={{ display: 'flex', gap: '8px' }}>
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
            )}

            {/* Add/Edit Course Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-container user-modal" style={{ maxWidth: '650px', width: '95%' }}>
                        <div className="modal-header" style={{ 
                            background: 'var(--card-bg)',
                            color: 'var(--text-color)',
                            padding: '24px 30px',
                            borderBottom: '1px solid var(--border-color)'
                        }}>
                            <div>
                                <h2 style={{ color: 'var(--text-color)', marginBottom: '4px', fontWeight: '700' }}>
                                    {editingCourse ? 'Edit Course' : 'Add New Course'}
                                </h2>
                                <p style={{ fontSize: '0.85rem', color: 'var(--secondary-text)', margin: 0 }}>
                                    {editingCourse ? 'Update course information' : 'Fill in the details to add a new course'}
                                </p>
                            </div>
                            <button 
                                className="close-modal" 
                                onClick={handleCloseModal}
                                style={{
                                    background: 'var(--card-bg)',
                                    border: '1.5px solid var(--border-color)',
                                    color: 'var(--text-color)'
                                }}
                            >&times;</button>
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
                                            <option value="Basic">Basic</option>
                                            <option value="Theory">Theory</option>
                                            <option value="Practical">Practical</option>
                                            <option value="Advanced">Advanced</option>
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
