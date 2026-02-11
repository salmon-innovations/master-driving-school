import React, { useState, useEffect } from 'react';
import './css/user.css';
import { adminAPI, branchesAPI } from '../services/api';

const UserManagement = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');
    const [users, setUsers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [editingUser, setEditingUser] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [errors, setErrors] = useState({});
    const [submitError, setSubmitError] = useState('');
    const [userData, setUserData] = useState({
        firstName: '',
        middleInitial: '',
        lastName: '',
        gender: '',
        age: '',
        birthday: '',
        address: '',
        contactNumber: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'staff',
        branch: '',
        status: 'active'
    });

    // Fetch users and branches from database
    useEffect(() => {
        fetchUsers();
        fetchBranches();
    }, []);

    const fetchBranches = async () => {
        try {
            const response = await branchesAPI.getAll();
            setBranches(response.branches || []);
        } catch (error) {
            console.error('Error fetching branches:', error);
        }
    };

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await adminAPI.getAllUsers();
            
            // Transform database data to match component format
            const transformedUsers = response.users.map(user => ({
                id: user.id,
                name: `${user.first_name} ${user.middle_name ? user.middle_name + ' ' : ''}${user.last_name}`.trim(),
                email: user.email,
                role: user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Student',
                branch: user.branch_name || 'Not enrolled',
                branchId: user.branch_id,
                status: user.status ? user.status.charAt(0).toUpperCase() + user.status.slice(1) : 'Active',
                lastLogin: user.last_login ? formatLastLogin(user.last_login) : 'Never',
                avatar: `https://i.pravatar.cc/150?u=${user.email}`,
                firstName: user.first_name,
                middleInitial: user.middle_name || '',
                lastName: user.last_name,
                gender: user.gender || '',
                age: user.age || '',
                birthday: user.birthday || '',
                address: user.address || '',
                contactNumber: user.contact_numbers || '',
                birthPlace: user.birth_place || '',
                nationality: user.nationality || '',
                maritalStatus: user.marital_status || '',
                zipCode: user.zip_code || '',
                emergencyContactPerson: user.emergency_contact_person || '',
                emergencyContactNumber: user.emergency_contact_number || ''
            }));

            setUsers(transformedUsers);
        } catch (error) {
            console.error('Error fetching users:', error);
            alert('Failed to load users. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const formatLastLogin = (timestamp) => {
        if (!timestamp) return 'Never';
        const now = new Date();
        const loginDate = new Date(timestamp);
        const diffMs = now - loginDate;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return loginDate.toLocaleDateString();
    };

    const handleSearch = (e) => setSearchTerm(e.target.value);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setUserData({ ...userData, [name]: value });
        
        // Clear error for this field when user starts typing
        if (errors[name]) {
            setErrors({ ...errors, [name]: '' });
        }
        if (submitError) {
            setSubmitError('');
        }
    };

    const validateForm = () => {
        const newErrors = {};

        // Name validation
        if (!userData.firstName.trim()) {
            newErrors.firstName = 'First name is required';
        }
        if (!userData.lastName.trim()) {
            newErrors.lastName = 'Last name is required';
        }

        // Email validation
        if (!userData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
            newErrors.email = 'Please enter a valid email address';
        }

        // Contact number validation
        if (!userData.contactNumber.trim()) {
            newErrors.contactNumber = 'Contact number is required';
        } else if (!/^[0-9]{10,11}$/.test(userData.contactNumber.replace(/[\s-]/g, ''))) {
            newErrors.contactNumber = 'Please enter a valid 10-11 digit phone number';
        }

        // Age validation
        if (!userData.age) {
            newErrors.age = 'Age is required';
        } else if (userData.age < 18 || userData.age > 100) {
            newErrors.age = 'Age must be between 18 and 100';
        }

        // Gender validation
        if (!userData.gender) {
            newErrors.gender = 'Gender is required';
        }

        // Branch validation
        if (!userData.branch) {
            newErrors.branch = 'Branch selection is required';
        }

        // Password validation (only for new users or if password is being changed)
        if (!editingUser || userData.password) {
            if (!userData.password) {
                newErrors.password = 'Password is required';
            } else if (userData.password.length < 8) {
                newErrors.password = 'Password must be at least 8 characters';
            }

            if (!userData.confirmPassword) {
                newErrors.confirmPassword = 'Please confirm your password';
            } else if (userData.password !== userData.confirmPassword) {
                newErrors.confirmPassword = 'Passwords do not match';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        setSubmitError('');

        // Validate form
        if (!validateForm()) {
            setSubmitError('Please fix the errors above before submitting.');
            return;
        }

        // Only allow Admin or Staff creation
        if (userData.role.toLowerCase() !== 'admin' && userData.role.toLowerCase() !== 'staff') {
            setSubmitError('Only Admin or Staff members can be added.');
            return;
        }

        try {
            if (editingUser) {
                // Update existing user
                await adminAPI.updateUser(editingUser.id, {
                    firstName: userData.firstName,
                    middleInitial: userData.middleInitial,
                    lastName: userData.lastName,
                    gender: userData.gender,
                    age: userData.age,
                    birthday: userData.birthday,
                    address: userData.address,
                    contactNumber: userData.contactNumber,
                    email: userData.email,
                    role: userData.role.toLowerCase(),
                    branch: userData.branch,
                    status: userData.status.toLowerCase(),
                });
                alert('User updated successfully!');
            } else {
                // Create new user (Admin or Staff only)
                await adminAPI.createUser({
                    firstName: userData.firstName,
                    middleInitial: userData.middleInitial,
                    lastName: userData.lastName,
                    gender: userData.gender,
                    age: userData.age,
                    birthday: userData.birthday,
                    address: userData.address,
                    contactNumber: userData.contactNumber,
                    email: userData.email,
                    password: userData.password,
                    role: userData.role.toLowerCase(),
                    branch: userData.branch,
                });
                alert('User created successfully!');
            }

            // Refresh users list
            await fetchUsers();
            
            // Close modal and reset form
            setShowModal(false);
            setEditingUser(null);
            setUserData({
                firstName: '',
                middleInitial: '',
                lastName: '',
                gender: '',
                age: '',
                birthday: '',
                address: '',
                contactNumber: '',
                email: '',
                password: '',
                confirmPassword: '',
                role: 'staff',
                branch: '',
                status: 'active'
            });
        } catch (error) {
            console.error('Error saving user:', error);
            
            // Handle specific error types
            if (error.message.includes('email')) {
                setErrors({ ...errors, email: error.message });
                setSubmitError('Email validation failed. Please check the email address.');
            } else if (error.message.includes('already exists')) {
                setErrors({ ...errors, email: 'This email is already registered' });
                setSubmitError('A user with this email already exists.');
            } else {
                setSubmitError(error.message || 'Failed to save user. Please try again.');
            }
        }
    };

    const handleEditClick = (user) => {
        // Only allow editing Admin or Staff
        if (user.role !== 'Admin' && user.role !== 'Staff') {
            alert('Only Admin or Staff accounts can be edited.');
            return;
        }
        
        setEditingUser(user);
        setUserData({
            firstName: user.firstName || '',
            middleInitial: user.middleInitial || '',
            lastName: user.lastName || '',
            gender: user.gender || '',
            age: user.age || '',
            birthday: user.birthday || '',
            address: user.address || '',
            contactNumber: user.contactNumber || '',
            email: user.email,
            password: '',
            confirmPassword: '',
            role: user.role,
            branch: user.branch,
            status: user.status
        });
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingUser(null);
        setShowPassword(false);
        setShowConfirmPassword(false);
        setErrors({});
        setSubmitError('');
        setUserData({
            firstName: '',
            middleInitial: '',
            lastName: '',
            gender: '',
            age: '',
            birthday: '',
            address: '',
            contactNumber: '',
            email: '',
            password: '',
            confirmPassword: '',
            role: 'staff',
            branch: '',
            status: 'active'
        });
    };

    const filteredUsers = users.filter(user => {
        const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === 'All' || user.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    const toggleStatus = async (id) => {
        try {
            await adminAPI.toggleUserStatus(id);
            // Refresh users list
            await fetchUsers();
        } catch (error) {
            console.error('Error toggling user status:', error);
            alert('Failed to update user status. Please try again.');
        }
    };

    const handleViewUser = (user) => {
        setSelectedUser(user);
        setShowViewModal(true);
    };

    return (
        <div className="user-module">
            <div className="user-header">
                <div className="header-left">
                    <h2>User Management</h2>
                    <p>Manage system access for admins, staff members, and students</p>
                </div>
                <div className="header-actions">
                    <button className="add-user-btn" onClick={() => setShowModal(true)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                        Add New User
                    </button>
                </div>
            </div>

            <div className="user-controls">
                <div className="search-box">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchTerm}
                        onChange={handleSearch}
                    />
                </div>
                <div className="role-filters">
                    {['All', 'Admin', 'Staff', 'Student'].map(role => (
                        <button
                            key={role}
                            className={`filter-chip ${roleFilter === role ? 'active' : ''}`}
                            onClick={() => setRoleFilter(role)}
                        >
                            {role}
                        </button>
                    ))}
                </div>
            </div>

            <div className="user-table-container">
                {loading ? (
                    <div className="loading-state" style={{ textAlign: 'center', padding: '60px 20px' }}>
                        <div style={{ 
                            width: '50px', 
                            height: '50px', 
                            border: '4px solid #f3f4f6', 
                            borderTop: '4px solid #3b82f6', 
                            borderRadius: '50%', 
                            animation: 'spin 1s linear infinite',
                            margin: '0 auto 20px'
                        }}></div>
                        <p style={{ color: 'var(--secondary-text)' }}>Loading users...</p>
                    </div>
                ) : (
                <div className="table-card">
                    <table className="user-management-table">
                        <thead>
                            <tr>
                                <th>Name & Profile</th>
                                <th>Access Level</th>
                                <th>Branch</th>
                                <th>Last Active</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(user => (
                                <tr key={user.id}>
                                    <td>
                                        <div className="user-profile-cell">
                                            <div className="user-avatar-mini" onClick={() => handleViewUser(user)}>
                                                {user.avatar ? (
                                                    <img src={user.avatar} alt={user.name} />
                                                ) : (
                                                    user.name.split(' ').map(n => n[0]).join('')
                                                )}
                                            </div>
                                            <div className="user-info-mini">
                                                <span className="user-name-bold">{user.name}</span>
                                                <span className="user-email-small">{user.email}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`role-pill ${user.role.toLowerCase()}`}>{user.role}</span>
                                    </td>
                                    <td>
                                        <span className="branch-text">{user.branch}</span>
                                    </td>
                                    <td>
                                        <span className="last-login-text">{user.lastLogin}</span>
                                    </td>
                                    <td>
                                        <span className={`status-pill ${user.status.toLowerCase()}`}>
                                            <span className="dot"></span>
                                            {user.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="table-actions">
                                            <button className="action-btn view" title="View Details" onClick={() => handleViewUser(user)}>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                            </button>
                                            <button
                                                className={`action-btn toggle ${user.status === 'Active' ? 'deactivate' : 'activate'}`}
                                                title={user.status === 'Active' ? 'Deactivate' : 'Activate'}
                                                onClick={() => toggleStatus(user.id)}
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                )}
                {!loading && filteredUsers.length === 0 && (
                    <div className="no-users">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        <p>No users found matching your search.</p>
                    </div>
                )}
                {/* Add/Edit User Modal */}
                {showModal && (
                    <div className="modal-overlay">
                        <div className="modal-container user-modal" style={{ maxWidth: '750px', width: '95%' }}>
                            <div className="modal-header" style={{ 
                                background: 'var(--card-bg)',
                                color: 'var(--text-color)',
                                padding: '24px 30px',
                                borderBottom: '1px solid var(--border-color)'
                            }}>
                                <div>
                                    <h2 style={{ color: 'var(--text-color)', marginBottom: '4px', fontWeight: '700' }}>
                                        {editingUser ? 'Edit Staff Account' : 'Add New User Account'}
                                    </h2>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--secondary-text)', margin: 0 }}>
                                        {editingUser ? 'Update account information and permissions' : 'Fill in the details to add a new admin or staff member'}
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
                            <form onSubmit={handleAddUser}>
                                <div className="modal-body" style={{ 
                                    maxHeight: '550px', 
                                    overflowY: 'auto',
                                    padding: '30px',
                                    background: 'var(--bg-color)'
                                }}>
                                    {/* Error Banner */}
                                    {submitError && (
                                        <div style={{
                                            padding: '12px 16px',
                                            marginBottom: '20px',
                                            background: '#fee2e2',
                                            border: '1px solid #fecaca',
                                            borderRadius: '10px',
                                            color: '#991b1b',
                                            fontSize: '0.875rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="12" cy="12" r="10"></circle>
                                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                            </svg>
                                            <span>{submitError}</span>
                                        </div>
                                    )}
                                    
                                    {/* Personal Information Section */}
                                    <div style={{ marginBottom: '28px' }}>
                                        <div style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '10px', 
                                            marginBottom: '20px',
                                            paddingBottom: '12px',
                                            borderBottom: '2px solid var(--border-color)'
                                        }}>
                                            <div style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '10px',
                                                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white',
                                                fontSize: '1.1rem'
                                            }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                                    <circle cx="12" cy="7" r="4"></circle>
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 style={{ 
                                                    fontSize: '1.05rem', 
                                                    fontWeight: '700', 
                                                    color: 'var(--text-color)',
                                                    margin: 0 
                                                }}>Personal Information</h3>
                                                <p style={{ 
                                                    fontSize: '0.75rem', 
                                                    color: 'var(--secondary-text)', 
                                                    margin: 0 
                                                }}>Basic identity and demographic details</p>
                                            </div>
                                        </div>

                                        <div className="form-row" style={{ gap: '15px', marginBottom: '15px' }}>
                                            <div className="form-group" style={{ flex: 2 }}>
                                                <label style={{ 
                                                    fontSize: '0.8rem', 
                                                    fontWeight: '600', 
                                                    color: 'var(--text-color)',
                                                    marginBottom: '6px',
                                                    display: 'block'
                                                }}>
                                                    First Name <span style={{ color: '#ef4444' }}>*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    name="firstName"
                                                    placeholder="e.g. John"
                                                    value={userData.firstName}
                                                    onChange={handleInputChange}
                                                    required
                                                    style={{
                                                        width: '100%',
                                                        padding: '11px 14px',
                                                        borderRadius: '10px',
                                                        border: errors.firstName ? '1.5px solid #ef4444' : '1.5px solid var(--border-color)',
                                                        background: 'var(--card-bg)',
                                                        fontSize: '0.9rem',
                                                        color: 'var(--text-color)',
                                                        transition: 'all 0.2s'
                                                    }}
                                                />
                                                {errors.firstName && (
                                                    <span style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                                                        {errors.firstName}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="form-group" style={{ flex: 0.6 }}>
                                                <label style={{ 
                                                    fontSize: '0.8rem', 
                                                    fontWeight: '600', 
                                                    color: 'var(--text-color)',
                                                    marginBottom: '6px',
                                                    display: 'block'
                                                }}>M.I.</label>
                                                <input
                                                    type="text"
                                                    name="middleInitial"
                                                    placeholder="A"
                                                    maxLength="1"
                                                    value={userData.middleInitial}
                                                    onChange={handleInputChange}
                                                    style={{
                                                        width: '100%',
                                                        padding: '11px 14px',
                                                        borderRadius: '10px',
                                                        border: '1.5px solid var(--border-color)',
                                                        background: 'var(--card-bg)',
                                                        fontSize: '0.9rem',
                                                        color: 'var(--text-color)',
                                                        textAlign: 'center',
                                                        textTransform: 'uppercase'
                                                    }}
                                                />
                                            </div>
                                            <div className="form-group" style={{ flex: 2 }}>
                                                <label style={{ 
                                                    fontSize: '0.8rem', 
                                                    fontWeight: '600', 
                                                    color: 'var(--text-color)',
                                                    marginBottom: '6px',
                                                    display: 'block'
                                                }}>
                                                    Last Name <span style={{ color: '#ef4444' }}>*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    name="lastName"
                                                    placeholder="e.g. Doe"
                                                    value={userData.lastName}
                                                    onChange={handleInputChange}
                                                    required
                                                    style={{
                                                        width: '100%',
                                                        padding: '11px 14px',
                                                        borderRadius: '10px',
                                                        border: errors.lastName ? '1.5px solid #ef4444' : '1.5px solid var(--border-color)',
                                                        background: 'var(--card-bg)',
                                                        fontSize: '0.9rem',
                                                        color: 'var(--text-color)'
                                                    }}
                                                />
                                                {errors.lastName && (
                                                    <span style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                                                        {errors.lastName}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="form-row" style={{ gap: '15px' }}>
                                            <div className="form-group" style={{ flex: 1 }}>
                                                <label style={{ 
                                                    fontSize: '0.8rem', 
                                                    fontWeight: '600', 
                                                    color: 'var(--text-color)',
                                                    marginBottom: '6px',
                                                    display: 'block'
                                                }}>
                                                    Gender <span style={{ color: '#ef4444' }}>*</span>
                                                </label>
                                                <select 
                                                    name="gender" 
                                                    value={userData.gender} 
                                                    onChange={handleInputChange} 
                                                    required
                                                    style={{
                                                        width: '100%',
                                                        padding: '11px 14px',
                                                        borderRadius: '10px',
                                                        border: errors.gender ? '1.5px solid #ef4444' : '1.5px solid var(--border-color)',
                                                        background: 'var(--card-bg)',
                                                        fontSize: '0.9rem',
                                                        color: 'var(--text-color)',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <option value="">Select Gender</option>
                                                    <option value="Male">Male</option>
                                                    <option value="Female">Female</option>
                                                </select>
                                                {errors.gender && (
                                                    <span style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                                                        {errors.gender}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="form-group" style={{ flex: 1 }}>
                                                <label style={{ 
                                                    fontSize: '0.8rem', 
                                                    fontWeight: '600', 
                                                    color: 'var(--text-color)',
                                                    marginBottom: '6px',
                                                    display: 'block'
                                                }}>
                                                    Age <span style={{ color: '#ef4444' }}>*</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    name="age"
                                                    placeholder="25"
                                                    min="18"
                                                    max="65"
                                                    value={userData.age}
                                                    onChange={handleInputChange}
                                                    required
                                                    style={{
                                                        width: '100%',
                                                        padding: '11px 14px',
                                                        borderRadius: '10px',
                                                        border: errors.age ? '1.5px solid #ef4444' : '1.5px solid var(--border-color)',
                                                        background: 'var(--card-bg)',
                                                        fontSize: '0.9rem',
                                                        color: 'var(--text-color)'
                                                    }}
                                                />
                                                {errors.age && (
                                                    <span style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                                                        {errors.age}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="form-group" style={{ flex: 1 }}>
                                                <label style={{ 
                                                    fontSize: '0.8rem', 
                                                    fontWeight: '600', 
                                                    color: 'var(--text-color)',
                                                    marginBottom: '6px',
                                                    display: 'block'
                                                }}>
                                                    Birthday <span style={{ color: '#ef4444' }}>*</span>
                                                </label>
                                                <input
                                                    type="date"
                                                    name="birthday"
                                                    value={userData.birthday}
                                                    onChange={handleInputChange}
                                                    required
                                                    style={{
                                                        width: '100%',
                                                        padding: '11px 14px',
                                                        borderRadius: '10px',
                                                        border: '1.5px solid var(--border-color)',
                                                        background: 'var(--card-bg)',
                                                        fontSize: '0.9rem',
                                                        color: 'var(--text-color)'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Contact Information Section */}
                                    <div style={{ marginBottom: '28px' }}>
                                        <div style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '10px', 
                                            marginBottom: '20px',
                                            paddingBottom: '12px',
                                            borderBottom: '2px solid var(--border-color)'
                                        }}>
                                            <div style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '10px',
                                                background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white'
                                            }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                                    <circle cx="12" cy="10" r="3"></circle>
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 style={{ 
                                                    fontSize: '1.05rem', 
                                                    fontWeight: '700', 
                                                    color: 'var(--text-color)',
                                                    margin: 0 
                                                }}>Contact Information</h3>
                                                <p style={{ 
                                                    fontSize: '0.75rem', 
                                                    color: 'var(--secondary-text)', 
                                                    margin: 0 
                                                }}>Address, phone, and email details</p>
                                            </div>
                                        </div>

                                        <div className="form-group" style={{ marginBottom: '15px' }}>
                                            <label style={{ 
                                                fontSize: '0.8rem', 
                                                fontWeight: '600', 
                                                color: 'var(--text-color)',
                                                marginBottom: '6px',
                                                display: 'block'
                                            }}>
                                                Complete Address <span style={{ color: '#ef4444' }}>*</span>
                                            </label>
                                            <textarea
                                                name="address"
                                                placeholder="e.g. 123 Street Name, Barangay, City, Province"
                                                value={userData.address}
                                                onChange={handleInputChange}
                                                rows="2"
                                                required
                                                style={{ 
                                                    width: '100%',
                                                    padding: '11px 14px',
                                                    borderRadius: '10px',
                                                    border: '1.5px solid var(--border-color)',
                                                    background: 'var(--card-bg)',
                                                    fontSize: '0.9rem',
                                                    color: 'var(--text-color)',
                                                    resize: 'vertical', 
                                                    fontFamily: 'inherit',
                                                    minHeight: '60px'
                                                }}
                                            />
                                        </div>

                                        <div className="form-row" style={{ gap: '15px' }}>
                                            <div className="form-group" style={{ flex: 1 }}>
                                                <label style={{ 
                                                    fontSize: '0.8rem', 
                                                    fontWeight: '600', 
                                                    color: 'var(--text-color)',
                                                    marginBottom: '6px',
                                                    display: 'block'
                                                }}>
                                                    Contact Number <span style={{ color: '#ef4444' }}>*</span>
                                                </label>
                                                <input
                                                    type="tel"
                                                    name="contactNumber"
                                                    placeholder="+63 912 345 6789"
                                                    value={userData.contactNumber}
                                                    onChange={handleInputChange}
                                                    required
                                                    style={{
                                                        width: '100%',
                                                        padding: '11px 14px',
                                                        borderRadius: '10px',
                                                        border: errors.contactNumber ? '1.5px solid #ef4444' : '1.5px solid var(--border-color)',
                                                        background: 'var(--card-bg)',
                                                        fontSize: '0.9rem',
                                                        color: 'var(--text-color)'
                                                    }}
                                                />
                                                {errors.contactNumber && (
                                                    <span style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                                                        {errors.contactNumber}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="form-group" style={{ flex: 1 }}>
                                                <label style={{ 
                                                    fontSize: '0.8rem', 
                                                    fontWeight: '600', 
                                                    color: 'var(--text-color)',
                                                    marginBottom: '6px',
                                                    display: 'block'
                                                }}>
                                                    Email Address <span style={{ color: '#ef4444' }}>*</span>
                                                </label>
                                                <input
                                                    type="email"
                                                    name="email"
                                                    placeholder="john@example.com"
                                                    value={userData.email}
                                                    onChange={handleInputChange}
                                                    required
                                                    style={{
                                                        width: '100%',
                                                        padding: '11px 14px',
                                                        borderRadius: '10px',
                                                        border: errors.email ? '1.5px solid #ef4444' : '1.5px solid var(--border-color)',
                                                        background: 'var(--card-bg)',
                                                        fontSize: '0.9rem',
                                                        color: 'var(--text-color)'
                                                    }}
                                                />
                                                {errors.email && (
                                                    <span style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                                                        {errors.email}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Account Security Section */}
                                    <div style={{ marginBottom: '28px' }}>
                                        <div style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '10px', 
                                            marginBottom: '20px',
                                            paddingBottom: '12px',
                                            borderBottom: '2px solid var(--border-color)'
                                        }}>
                                            <div style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '10px',
                                                background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white'
                                            }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 style={{ 
                                                    fontSize: '1.05rem', 
                                                    fontWeight: '700', 
                                                    color: 'var(--text-color)',
                                                    margin: 0 
                                                }}>Account Security</h3>
                                                <p style={{ 
                                                    fontSize: '0.75rem', 
                                                    color: 'var(--secondary-text)', 
                                                    margin: 0 
                                                }}>Login credentials and password</p>
                                            </div>
                                        </div>

                                        <div className="form-row" style={{ gap: '15px' }}>
                                            <div className="form-group" style={{ flex: 1 }}>
                                                <label style={{ 
                                                    fontSize: '0.8rem', 
                                                    fontWeight: '600', 
                                                    color: 'var(--text-color)',
                                                    marginBottom: '6px',
                                                    display: 'block'
                                                }}>
                                                    Password <span style={{ color: '#ef4444' }}>*</span>
                                                </label>
                                                <div style={{ position: 'relative' }}>
                                                    <input
                                                        type={showPassword ? "text" : "password"}
                                                        name="password"
                                                        placeholder="Min. 8 characters"
                                                        minLength="8"
                                                        value={userData.password}
                                                        onChange={handleInputChange}
                                                        required={!editingUser}
                                                        style={{
                                                            width: '100%',
                                                            padding: '11px 40px 11px 14px',
                                                            borderRadius: '10px',
                                                            border: errors.password ? '1.5px solid #ef4444' : '1.5px solid var(--border-color)',
                                                            background: 'var(--card-bg)',
                                                            fontSize: '0.9rem',
                                                            color: 'var(--text-color)'
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        style={{
                                                            position: 'absolute',
                                                            right: '12px',
                                                            top: '50%',
                                                            transform: 'translateY(-50%)',
                                                            background: 'none',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            padding: '4px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            color: 'var(--secondary-text)'
                                                        }}
                                                    >
                                                        {showPassword ? (
                                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                                                <line x1="1" y1="1" x2="23" y2="23"></line>
                                                            </svg>
                                                        ) : (
                                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                                                <circle cx="12" cy="12" r="3"></circle>
                                                            </svg>
                                                        )}
                                                    </button>
                                                </div>
                                                {errors.password && (
                                                    <span style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                                                        {errors.password}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="form-group" style={{ flex: 1 }}>
                                                <label style={{ 
                                                    fontSize: '0.8rem', 
                                                    fontWeight: '600', 
                                                    color: 'var(--text-color)',
                                                    marginBottom: '6px',
                                                    display: 'block'
                                                }}>
                                                    Confirm Password <span style={{ color: '#ef4444' }}>*</span>
                                                </label>
                                                <div style={{ position: 'relative' }}>
                                                    <input
                                                        type={showConfirmPassword ? "text" : "password"}
                                                        name="confirmPassword"
                                                        placeholder="Re-enter password"
                                                        minLength="8"
                                                        value={userData.confirmPassword}
                                                        onChange={handleInputChange}
                                                        required={!editingUser}
                                                        style={{
                                                            width: '100%',
                                                            padding: '11px 40px 11px 14px',
                                                            borderRadius: '10px',
                                                            border: errors.confirmPassword ? '1.5px solid #ef4444' : '1.5px solid var(--border-color)',
                                                            background: 'var(--card-bg)',
                                                            fontSize: '0.9rem',
                                                            color: 'var(--text-color)'
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                        style={{
                                                            position: 'absolute',
                                                            right: '12px',
                                                            top: '50%',
                                                            transform: 'translateY(-50%)',
                                                            background: 'none',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            padding: '4px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            color: 'var(--secondary-text)'
                                                        }}
                                                    >
                                                        {showConfirmPassword ? (
                                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                                                <line x1="1" y1="1" x2="23" y2="23"></line>
                                                            </svg>
                                                        ) : (
                                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                                                <circle cx="12" cy="12" r="3"></circle>
                                                            </svg>
                                                        )}
                                                    </button>
                                                </div>
                                                {errors.confirmPassword && (
                                                    <span style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                                                        {errors.confirmPassword}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Role & Branch Assignment Section */}
                                    <div>
                                        <div style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '10px', 
                                            marginBottom: '20px',
                                            paddingBottom: '12px',
                                            borderBottom: '2px solid var(--border-color)'
                                        }}>
                                            <div style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '10px',
                                                background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white'
                                            }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                                    <circle cx="9" cy="7" r="4"></circle>
                                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 style={{ 
                                                    fontSize: '1.05rem', 
                                                    fontWeight: '700', 
                                                    color: 'var(--text-color)',
                                                    margin: 0 
                                                }}>Role & Assignment</h3>
                                                <p style={{ 
                                                    fontSize: '0.75rem', 
                                                    color: 'var(--secondary-text)', 
                                                    margin: 0 
                                                }}>Access level and branch location</p>
                                            </div>
                                        </div>

                                        <div className="form-row" style={{ gap: '15px' }}>
                                            <div className="form-group" style={{ flex: 1 }}>
                                                <label style={{ 
                                                    fontSize: '0.8rem', 
                                                    fontWeight: '600', 
                                                    color: 'var(--text-color)',
                                                    marginBottom: '6px',
                                                    display: 'block'
                                                }}>
                                                    Role <span style={{ color: '#ef4444' }}>*</span>
                                                </label>
                                                <select 
                                                    name="role" 
                                                    value={userData.role} 
                                                    onChange={handleInputChange} 
                                                    required
                                                    style={{
                                                        width: '100%',
                                                        padding: '11px 14px',
                                                        borderRadius: '10px',
                                                        border: '1.5px solid var(--border-color)',
                                                        background: 'var(--card-bg)',
                                                        fontSize: '0.9rem',
                                                        color: 'var(--text-color)',
                                                        cursor: 'pointer',
                                                        fontWeight: '600'
                                                    }}
                                                >
                                                    <option value="Admin">Admin</option>
                                                    <option value="Staff">Staff</option>
                                                </select>
                                            </div>
                                            <div className="form-group" style={{ flex: 1 }}>
                                                <label style={{ 
                                                    fontSize: '0.8rem', 
                                                    fontWeight: '600', 
                                                    color: 'var(--text-color)',
                                                    marginBottom: '6px',
                                                    display: 'block'
                                                }}>
                                                    Branch <span style={{ color: '#ef4444' }}>*</span>
                                                </label>
                                                <select 
                                                    name="branch" 
                                                    value={userData.branch} 
                                                    onChange={handleInputChange} 
                                                    required
                                                    style={{
                                                        width: '100%',
                                                        padding: '11px 14px',
                                                        borderRadius: '10px',
                                                        border: errors.branch ? '1.5px solid #ef4444' : '1.5px solid var(--border-color)',
                                                        background: 'var(--card-bg)',
                                                        fontSize: '0.9rem',
                                                        color: 'var(--text-color)',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <option value="">Select a branch</option>
                                                    {branches.map((branch) => (
                                                        <option key={branch.id} value={branch.name}>
                                                            {branch.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                {errors.branch && (
                                                    <span style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                                                        {errors.branch}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer" style={{
                                    padding: '20px 30px',
                                    background: 'var(--card-bg)',
                                    borderTop: '1px solid var(--border-color)',
                                    display: 'flex',
                                    gap: '12px',
                                    justifyContent: 'flex-end'
                                }}>
                                    <button 
                                        type="button" 
                                        className="cancel-btn" 
                                        onClick={handleCloseModal}
                                        style={{
                                            padding: '12px 28px',
                                            borderRadius: '10px',
                                            border: '1.5px solid var(--border-color)',
                                            background: 'var(--card-bg)',
                                            color: 'var(--text-color)',
                                            fontSize: '0.9rem',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >Cancel</button>
                                    <button 
                                        type="submit" 
                                        className="confirm-btn"
                                        style={{
                                            padding: '12px 28px',
                                            borderRadius: '10px',
                                            border: 'none',
                                            background: 'linear-gradient(135deg, #1a4fba 0%, #3b82f6 100%)',
                                            color: 'white',
                                            fontSize: '0.9rem',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            boxShadow: '0 4px 12px rgba(26, 79, 186, 0.3)'
                                        }}
                                    >
                                        {editingUser ? 'Update Account' : 'Create Account'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* View User Modal */}
                {showViewModal && selectedUser && (
                    <div className="modal-overlay">
                        <div className="modal-container profile-modal" style={{ 
                            maxWidth: '700px',
                            width: '95%',
                            background: 'var(--card-bg)'
                        }}>
                            <div className="modal-header" style={{
                                background: 'var(--card-bg)',
                                borderBottom: '1px solid var(--border-color)',
                                padding: '24px 30px'
                            }}>
                                <div>
                                    <h2 style={{ 
                                        color: 'var(--text-color)', 
                                        marginBottom: '4px', 
                                        fontWeight: '700',
                                        fontSize: '1.35rem'
                                    }}>User Profile</h2>
                                    <p style={{ 
                                        fontSize: '0.85rem', 
                                        color: 'var(--secondary-text)', 
                                        margin: 0 
                                    }}>Complete account information and details</p>
                                </div>
                                <button 
                                    className="close-modal" 
                                    onClick={() => setShowViewModal(false)}
                                    style={{
                                        background: 'var(--card-bg)',
                                        border: '1.5px solid var(--border-color)',
                                        color: 'var(--text-color)'
                                    }}
                                >&times;</button>
                            </div>
                            
                            <div className="modal-body profile-body" style={{ 
                                padding: '0',
                                maxHeight: '600px',
                                overflowY: 'auto',
                                background: 'var(--bg-color)'
                            }}>
                                {/* Profile Header Section */}
                                <div style={{
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    padding: '40px 30px 80px',
                                    position: 'relative',
                                    textAlign: 'center'
                                }}>
                                    <div style={{
                                        width: '120px',
                                        height: '120px',
                                        borderRadius: '50%',
                                        margin: '0 auto',
                                        border: '5px solid rgba(255,255,255,0.3)',
                                        overflow: 'hidden',
                                        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                                        position: 'relative'
                                    }}>
                                        <img
                                            src={selectedUser.avatar}
                                            alt={selectedUser.name}
                                            style={{ 
                                                width: '100%', 
                                                height: '100%', 
                                                objectFit: 'cover'
                                            }}
                                        />
                                        <span 
                                            className={`status-badge-overlay ${selectedUser.status.toLowerCase()}`}
                                            style={{
                                                position: 'absolute',
                                                bottom: '5px',
                                                right: '5px',
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '50%',
                                                border: '3px solid white',
                                                background: selectedUser.status === 'Active' ? '#10b981' : '#ef4444'
                                            }}
                                        ></span>
                                    </div>
                                </div>

                                {/* Info Card Overlay */}
                                <div style={{
                                    margin: '-50px 30px 0',
                                    background: 'var(--card-bg)',
                                    borderRadius: '16px',
                                    padding: '25px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                    border: '1px solid var(--border-color)',
                                    textAlign: 'center',
                                    marginBottom: '25px'
                                }}>
                                    <h1 style={{ 
                                        fontSize: '1.5rem', 
                                        fontWeight: '700', 
                                        color: 'var(--text-color)', 
                                        marginBottom: '5px',
                                        margin: 0
                                    }}>{selectedUser.name}</h1>
                                    <p style={{ 
                                        color: 'var(--secondary-text)', 
                                        margin: '5px 0 15px',
                                        fontSize: '0.95rem'
                                    }}>{selectedUser.email}</p>
                                    
                                    <div style={{
                                        display: 'flex',
                                        gap: '10px',
                                        justifyContent: 'center',
                                        flexWrap: 'wrap'
                                    }}>
                                        <span style={{
                                            padding: '6px 14px',
                                            borderRadius: '20px',
                                            fontSize: '0.8rem',
                                            fontWeight: '600',
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            color: 'white',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '5px'
                                        }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                                <circle cx="12" cy="7" r="4"></circle>
                                            </svg>
                                            {selectedUser.role}
                                        </span>
                                        <span style={{
                                            padding: '6px 14px',
                                            borderRadius: '20px',
                                            fontSize: '0.8rem',
                                            fontWeight: '600',
                                            background: selectedUser.status === 'Active' ? '#d1fae5' : '#fee2e2',
                                            color: selectedUser.status === 'Active' ? '#065f46' : '#991b1b'
                                        }}>
                                            {selectedUser.status}
                                        </span>
                                    </div>
                                </div>

                                {/* Details Sections */}
                                <div style={{ padding: '0 30px 30px' }}>
                                    {/* Personal Information */}
                                    <div style={{ marginBottom: '25px' }}>
                                        <h3 style={{
                                            fontSize: '0.85rem',
                                            fontWeight: '700',
                                            color: 'var(--text-color)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            marginBottom: '15px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                                <circle cx="12" cy="7" r="4"></circle>
                                            </svg>
                                            Personal Information
                                        </h3>
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                            gap: '15px'
                                        }}>
                                            <div style={{
                                                background: 'var(--card-bg)',
                                                padding: '14px',
                                                borderRadius: '12px',
                                                border: '1px solid var(--border-color)'
                                            }}>
                                                <label style={{ 
                                                    fontSize: '0.7rem', 
                                                    color: 'var(--secondary-text)', 
                                                    textTransform: 'uppercase', 
                                                    letterSpacing: '0.05em',
                                                    display: 'block',
                                                    marginBottom: '5px'
                                                }}>First Name</label>
                                                <div style={{ 
                                                    fontWeight: '600', 
                                                    color: 'var(--text-color)',
                                                    fontSize: '0.95rem'
                                                }}>{selectedUser.firstName}</div>
                                            </div>
                                            
                                            <div style={{
                                                background: 'var(--card-bg)',
                                                padding: '14px',
                                                borderRadius: '12px',
                                                border: '1px solid var(--border-color)'
                                            }}>
                                                <label style={{ 
                                                    fontSize: '0.7rem', 
                                                    color: 'var(--secondary-text)', 
                                                    textTransform: 'uppercase', 
                                                    letterSpacing: '0.05em',
                                                    display: 'block',
                                                    marginBottom: '5px'
                                                }}>Middle Name</label>
                                                <div style={{ 
                                                    fontWeight: '600', 
                                                    color: selectedUser.middleInitial ? 'var(--text-color)' : 'var(--secondary-text)',
                                                    fontSize: '0.95rem'
                                                }}>{selectedUser.middleInitial || 'Not provided'}</div>
                                            </div>
                                            
                                            <div style={{
                                                background: 'var(--card-bg)',
                                                padding: '14px',
                                                borderRadius: '12px',
                                                border: '1px solid var(--border-color)'
                                            }}>
                                                <label style={{ 
                                                    fontSize: '0.7rem', 
                                                    color: 'var(--secondary-text)', 
                                                    textTransform: 'uppercase', 
                                                    letterSpacing: '0.05em',
                                                    display: 'block',
                                                    marginBottom: '5px'
                                                }}>Last Name</label>
                                                <div style={{ 
                                                    fontWeight: '600', 
                                                    color: 'var(--text-color)',
                                                    fontSize: '0.95rem'
                                                }}>{selectedUser.lastName}</div>
                                            </div>
                                            
                                            <div style={{
                                                background: 'var(--card-bg)',
                                                padding: '14px',
                                                borderRadius: '12px',
                                                border: '1px solid var(--border-color)'
                                            }}>
                                                <label style={{ 
                                                    fontSize: '0.7rem', 
                                                    color: 'var(--secondary-text)', 
                                                    textTransform: 'uppercase', 
                                                    letterSpacing: '0.05em',
                                                    display: 'block',
                                                    marginBottom: '5px'
                                                }}>Age</label>
                                                <div style={{ 
                                                    fontWeight: '600', 
                                                    color: selectedUser.age ? 'var(--text-color)' : 'var(--secondary-text)',
                                                    fontSize: '0.95rem'
                                                }}>{selectedUser.age ? `${selectedUser.age} years old` : 'Not provided'}</div>
                                            </div>
                                            
                                            <div style={{
                                                background: 'var(--card-bg)',
                                                padding: '14px',
                                                borderRadius: '12px',
                                                border: '1px solid var(--border-color)'
                                            }}>
                                                <label style={{ 
                                                    fontSize: '0.7rem', 
                                                    color: 'var(--secondary-text)', 
                                                    textTransform: 'uppercase', 
                                                    letterSpacing: '0.05em',
                                                    display: 'block',
                                                    marginBottom: '5px'
                                                }}>Gender</label>
                                                <div style={{ 
                                                    fontWeight: '600', 
                                                    color: selectedUser.gender ? 'var(--text-color)' : 'var(--secondary-text)',
                                                    fontSize: '0.95rem'
                                                }}>{selectedUser.gender || 'Not provided'}</div>
                                            </div>
                                            
                                            <div style={{
                                                background: 'var(--card-bg)',
                                                padding: '14px',
                                                borderRadius: '12px',
                                                border: '1px solid var(--border-color)'
                                            }}>
                                                <label style={{ 
                                                    fontSize: '0.7rem', 
                                                    color: 'var(--secondary-text)', 
                                                    textTransform: 'uppercase', 
                                                    letterSpacing: '0.05em',
                                                    display: 'block',
                                                    marginBottom: '5px'
                                                }}>Birthday</label>
                                                <div style={{ 
                                                    fontWeight: '600', 
                                                    color: selectedUser.birthday ? 'var(--text-color)' : 'var(--secondary-text)',
                                                    fontSize: '0.95rem'
                                                }}>{selectedUser.birthday ? new Date(selectedUser.birthday).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not provided'}</div>
                                            </div>
                                            
                                            <div style={{
                                                background: 'var(--card-bg)',
                                                padding: '14px',
                                                borderRadius: '12px',
                                                border: '1px solid var(--border-color)'
                                            }}>
                                                <label style={{ 
                                                    fontSize: '0.7rem', 
                                                    color: 'var(--secondary-text)', 
                                                    textTransform: 'uppercase', 
                                                    letterSpacing: '0.05em',
                                                    display: 'block',
                                                    marginBottom: '5px'
                                                }}>Birth Place</label>
                                                <div style={{ 
                                                    fontWeight: '600', 
                                                    color: selectedUser.birthPlace ? 'var(--text-color)' : 'var(--secondary-text)',
                                                    fontSize: '0.95rem'
                                                }}>{selectedUser.birthPlace || 'Not provided'}</div>
                                            </div>
                                            
                                            <div style={{
                                                background: 'var(--card-bg)',
                                                padding: '14px',
                                                borderRadius: '12px',
                                                border: '1px solid var(--border-color)'
                                            }}>
                                                <label style={{ 
                                                    fontSize: '0.7rem', 
                                                    color: 'var(--secondary-text)', 
                                                    textTransform: 'uppercase', 
                                                    letterSpacing: '0.05em',
                                                    display: 'block',
                                                    marginBottom: '5px'
                                                }}>Nationality</label>
                                                <div style={{ 
                                                    fontWeight: '600', 
                                                    color: selectedUser.nationality ? 'var(--text-color)' : 'var(--secondary-text)',
                                                    fontSize: '0.95rem'
                                                }}>{selectedUser.nationality || 'Not provided'}</div>
                                            </div>
                                            
                                            <div style={{
                                                background: 'var(--card-bg)',
                                                padding: '14px',
                                                borderRadius: '12px',
                                                border: '1px solid var(--border-color)'
                                            }}>
                                                <label style={{ 
                                                    fontSize: '0.7rem', 
                                                    color: 'var(--secondary-text)', 
                                                    textTransform: 'uppercase', 
                                                    letterSpacing: '0.05em',
                                                    display: 'block',
                                                    marginBottom: '5px'
                                                }}>Marital Status</label>
                                                <div style={{ 
                                                    fontWeight: '600', 
                                                    color: selectedUser.maritalStatus ? 'var(--text-color)' : 'var(--secondary-text)',
                                                    fontSize: '0.95rem'
                                                }}>{selectedUser.maritalStatus || 'Not provided'}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Contact Information */}
                                    <div style={{ marginBottom: '25px' }}>
                                        <h3 style={{
                                            fontSize: '0.85rem',
                                            fontWeight: '700',
                                            color: 'var(--text-color)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            marginBottom: '15px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                            </svg>
                                            Address & Contact
                                        </h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div style={{
                                                background: 'var(--card-bg)',
                                                padding: '14px',
                                                borderRadius: '12px',
                                                border: '1px solid var(--border-color)'
                                            }}>
                                                <label style={{ 
                                                    fontSize: '0.7rem', 
                                                    color: 'var(--secondary-text)', 
                                                    textTransform: 'uppercase', 
                                                    letterSpacing: '0.05em',
                                                    display: 'block',
                                                    marginBottom: '5px'
                                                }}>Full Address</label>
                                                <div style={{ 
                                                    fontWeight: '600', 
                                                    color: selectedUser.address ? 'var(--text-color)' : 'var(--secondary-text)',
                                                    fontSize: '0.95rem',
                                                    lineHeight: '1.5'
                                                }}>{selectedUser.address || 'Not provided'}</div>
                                            </div>
                                            
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                                                <div style={{
                                                    background: 'var(--card-bg)',
                                                    padding: '14px',
                                                    borderRadius: '12px',
                                                    border: '1px solid var(--border-color)'
                                                }}>
                                                    <label style={{ 
                                                        fontSize: '0.7rem', 
                                                        color: 'var(--secondary-text)', 
                                                        textTransform: 'uppercase', 
                                                        letterSpacing: '0.05em',
                                                        display: 'block',
                                                        marginBottom: '5px'
                                                    }}>Zip Code</label>
                                                    <div style={{ 
                                                        fontWeight: '600', 
                                                        color: selectedUser.zipCode ? 'var(--text-color)' : 'var(--secondary-text)',
                                                        fontSize: '0.95rem'
                                                    }}>{selectedUser.zipCode || 'Not provided'}</div>
                                                </div>
                                                
                                                <div style={{
                                                    background: 'var(--card-bg)',
                                                    padding: '14px',
                                                    borderRadius: '12px',
                                                    border: '1px solid var(--border-color)'
                                                }}>
                                                    <label style={{ 
                                                        fontSize: '0.7rem', 
                                                        color: 'var(--secondary-text)', 
                                                        textTransform: 'uppercase', 
                                                        letterSpacing: '0.05em',
                                                        display: 'block',
                                                        marginBottom: '5px'
                                                    }}>Contact Number</label>
                                                    <div style={{ 
                                                        fontWeight: '600', 
                                                        color: selectedUser.contactNumber ? 'var(--text-color)' : 'var(--secondary-text)',
                                                        fontSize: '0.95rem'
                                                    }}>{selectedUser.contactNumber || 'Not provided'}</div>
                                                </div>
                                            </div>
                                            
                                            <div style={{
                                                background: 'var(--card-bg)',
                                                padding: '14px',
                                                borderRadius: '12px',
                                                border: '1px solid var(--border-color)'
                                            }}>
                                                <label style={{ 
                                                    fontSize: '0.7rem', 
                                                    color: 'var(--secondary-text)', 
                                                    textTransform: 'uppercase', 
                                                    letterSpacing: '0.05em',
                                                    display: 'block',
                                                    marginBottom: '5px'
                                                }}>Email Address</label>
                                                <div style={{ 
                                                    fontWeight: '600', 
                                                    color: 'var(--text-color)',
                                                    fontSize: '0.95rem'
                                                }}>{selectedUser.email}</div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Emergency Contact */}
                                    <div style={{ marginBottom: '25px' }}>
                                        <h3 style={{
                                            fontSize: '0.85rem',
                                            fontWeight: '700',
                                            color: 'var(--text-color)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            marginBottom: '15px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                                <line x1="12" y1="9" x2="12" y2="13"></line>
                                                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                            </svg>
                                            Emergency Contact
                                        </h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                                            <div style={{
                                                background: 'var(--card-bg)',
                                                padding: '14px',
                                                borderRadius: '12px',
                                                border: '1px solid var(--border-color)'
                                            }}>
                                                <label style={{ 
                                                    fontSize: '0.7rem', 
                                                    color: 'var(--secondary-text)', 
                                                    textTransform: 'uppercase', 
                                                    letterSpacing: '0.05em',
                                                    display: 'block',
                                                    marginBottom: '5px'
                                                }}>Contact Person</label>
                                                <div style={{ 
                                                    fontWeight: '600', 
                                                    color: selectedUser.emergencyContactPerson ? 'var(--text-color)' : 'var(--secondary-text)',
                                                    fontSize: '0.95rem'
                                                }}>{selectedUser.emergencyContactPerson || 'Not provided'}</div>
                                            </div>
                                            
                                            <div style={{
                                                background: 'var(--card-bg)',
                                                padding: '14px',
                                                borderRadius: '12px',
                                                border: '1px solid var(--border-color)'
                                            }}>
                                                <label style={{ 
                                                    fontSize: '0.7rem', 
                                                    color: 'var(--secondary-text)', 
                                                    textTransform: 'uppercase', 
                                                    letterSpacing: '0.05em',
                                                    display: 'block',
                                                    marginBottom: '5px'
                                                }}>Emergency Number</label>
                                                <div style={{ 
                                                    fontWeight: '600', 
                                                    color: selectedUser.emergencyContactNumber ? 'var(--text-color)' : 'var(--secondary-text)',
                                                    fontSize: '0.95rem'
                                                }}>{selectedUser.emergencyContactNumber || 'Not provided'}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Work Information */}
                                    <div>
                                        <h3 style={{
                                            fontSize: '0.85rem',
                                            fontWeight: '700',
                                            color: 'var(--text-color)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            marginBottom: '15px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                                                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                                            </svg>
                                            Work Details
                                        </h3>
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                            gap: '15px'
                                        }}>
                                            <div style={{
                                                background: 'var(--card-bg)',
                                                padding: '14px',
                                                borderRadius: '12px',
                                                border: '1px solid var(--border-color)'
                                            }}>
                                                <label style={{ 
                                                    fontSize: '0.7rem', 
                                                    color: 'var(--secondary-text)', 
                                                    textTransform: 'uppercase', 
                                                    letterSpacing: '0.05em',
                                                    display: 'block',
                                                    marginBottom: '5px'
                                                }}>Branch Office</label>
                                                <div style={{ 
                                                    fontWeight: '600', 
                                                    color: 'var(--text-color)',
                                                    fontSize: '0.95rem'
                                                }}>{selectedUser.branch}</div>
                                            </div>
                                            <div style={{
                                                background: 'var(--card-bg)',
                                                padding: '14px',
                                                borderRadius: '12px',
                                                border: '1px solid var(--border-color)'
                                            }}>
                                                <label style={{ 
                                                    fontSize: '0.7rem', 
                                                    color: 'var(--secondary-text)', 
                                                    textTransform: 'uppercase', 
                                                    letterSpacing: '0.05em',
                                                    display: 'block',
                                                    marginBottom: '5px'
                                                }}>Last Activity</label>
                                                <div style={{ 
                                                    fontWeight: '600', 
                                                    color: 'var(--text-color)',
                                                    fontSize: '0.95rem'
                                                }}>{selectedUser.lastLogin}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="modal-footer" style={{ 
                                borderTop: '1px solid var(--border-color)', 
                                padding: '20px 30px', 
                                display: 'flex', 
                                gap: '12px',
                                background: 'var(--card-bg)',
                                flexWrap: 'wrap'
                            }}>
                                <button 
                                    className="prev-btn" 
                                    style={{ 
                                        flex: '1 1 150px',
                                        padding: '12px 24px',
                                        borderRadius: '10px',
                                        border: '1.5px solid var(--border-color)',
                                        background: 'var(--card-bg)',
                                        color: 'var(--text-color)',
                                        fontSize: '0.9rem',
                                        fontWeight: '600',
                                        cursor: 'pointer'
                                    }} 
                                    onClick={() => setShowViewModal(false)}
                                >Close View</button>
                                <button 
                                    className="confirm-btn" 
                                    style={{ 
                                        flex: '1 1 150px',
                                        padding: '12px 24px',
                                        borderRadius: '10px',
                                        border: 'none',
                                        background: 'var(--primary-color)',
                                        color: 'white',
                                        fontSize: '0.9rem',
                                        fontWeight: '600',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => {
                                        setShowViewModal(false);
                                        handleEditClick(selectedUser);
                                    }}
                                >Edit Profile</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserManagement;
