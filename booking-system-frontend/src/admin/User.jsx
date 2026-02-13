import React, { useState, useEffect } from 'react';
import './css/user.css';
import { adminAPI, branchesAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';

const UserManagement = () => {
    const { showNotification } = useNotification();
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');
    const [users, setUsers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [passwordResetUser, setPasswordResetUser] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [editingUser, setEditingUser] = useState(null);
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
        role: 'staff',
        branch: '',
        status: 'active'
    });
    const [originalEmail, setOriginalEmail] = useState('');

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
            showNotification('Failed to load users. Please try again.', 'error');
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

    // Format branch name - remove company prefixes
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

    // Format phone number as "09XX XXX XXXX"
    const formatPhoneNumber = (value) => {
        // Remove all non-numeric characters
        const cleaned = value.replace(/\D/g, '');
        
        // Limit to 11 digits
        const limited = cleaned.slice(0, 11);
        
        // Format as "09XX XXX XXXX"
        if (limited.length === 0) return '';
        if (limited.length <= 4) return limited;
        if (limited.length <= 7) return `${limited.slice(0, 4)} ${limited.slice(4)}`;
        return `${limited.slice(0, 4)} ${limited.slice(4, 7)} ${limited.slice(7, 11)}`;
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        
        // Format phone numbers
        let formattedValue = value;
        if (name === 'contactNumber') {
            formattedValue = formatPhoneNumber(value);
        }
        
        setUserData({ ...userData, [name]: formattedValue });
        
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
        } else {
            const cleanedNumber = userData.contactNumber.replace(/\s/g, '');
            if (!/^09\d{9}$/.test(cleanedNumber)) {
                newErrors.contactNumber = 'Phone number must start with 09 and be exactly 11 digits';
            }
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

        // Only allow Admin, HRM, or Staff creation
        if (userData.role.toLowerCase() !== 'admin' && userData.role.toLowerCase() !== 'hrm' && userData.role.toLowerCase() !== 'staff') {
            setSubmitError('Only Admin, HRM, or Staff members can be added.');
            return;
        }

        try {
            if (editingUser) {
                // Check if email has changed
                const emailChanged = userData.email !== originalEmail;
                
                // Update existing user
                const response = await adminAPI.updateUser(editingUser.id, {
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
                    emailChanged: emailChanged,
                });
                
                if (emailChanged && response.passwordSent) {
                    showNotification('User updated successfully! A new password has been sent to the updated email address.', 'success');
                } else {
                    showNotification('User updated successfully!', 'success');
                }
            } else {
                // Create new user (Admin or Staff only) - password auto-generated
                const response = await adminAPI.createUser({
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
                });
                showNotification('User created successfully! Login credentials have been sent to their email.', 'success');
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
                role: 'staff',
                branch: '',
                status: 'active'
            });
            setOriginalEmail('');
        } catch (error) {
            console.error('Error saving user:', error);
            
            // Handle specific error types with detailed messages
            if (error.message) {
                const errorMsg = error.message.toLowerCase();
                
                if (errorMsg.includes('email')) {
                    if (errorMsg.includes('already') || errorMsg.includes('exists')) {
                        setErrors({ ...errors, email: 'This email is already registered' });
                        setSubmitError('A user with this email already exists. Please use a different email.');
                    } else if (errorMsg.includes('invalid')) {
                        setErrors({ ...errors, email: 'Invalid email format' });
                        setSubmitError('Please enter a valid email address.');
                    } else {
                        setErrors({ ...errors, email: error.message });
                        setSubmitError('Email validation failed. Please check the email address.');
                    }
                } else if (errorMsg.includes('phone') || errorMsg.includes('contact')) {
                    setErrors({ ...errors, contactNumber: 'Invalid phone number format' });
                    setSubmitError('Phone number must start with 09 and be exactly 11 digits.');
                } else if (errorMsg.includes('network') || errorMsg.includes('connection')) {
                    setSubmitError('Network error. Please check your internet connection and try again.');
                } else if (errorMsg.includes('password')) {
                    setSubmitError('Password email could not be sent. User created but may need password reset.');
                } else {
                    setSubmitError(error.message || 'Failed to save user. Please check all fields and try again.');
                }
            } else {
                setSubmitError('An unexpected error occurred. Please try again later.');
            }
        }
    };

    const handleEditClick = (user) => {
        // Only allow editing Admin, HRM, or Staff
        if (user.role !== 'Admin' && user.role !== 'HRM' && user.role !== 'Staff') {
            showNotification('Only Admin, HRM, or Staff accounts can be edited.', 'error');
            return;
        }
        
        setEditingUser(user);
        setOriginalEmail(user.email);
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
            role: user.role,
            branch: user.branchId || '',
            status: user.status
        });
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingUser(null);
        setErrors({});
        setSubmitError('');
        setOriginalEmail('');
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
            showNotification('Failed to update user status. Please try again.', 'error');
        }
    };

    const handleViewUser = (user) => {
        setSelectedUser(user);
        setShowViewModal(true);
    };

    const handlePasswordReset = (user) => {
        setPasswordResetUser(user);
        setNewPassword('');
        setPasswordError('');
        setShowPasswordModal(true);
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setPasswordError('');

        // Validate password
        if (!newPassword || newPassword.length < 6) {
            setPasswordError('Password must be at least 6 characters long');
            return;
        }

        try {
            await adminAPI.resetUserPassword(passwordResetUser.id, { newPassword });
            showNotification(`Password updated successfully for ${passwordResetUser.firstName} ${passwordResetUser.lastName}`, 'success');
            setShowPasswordModal(false);
            setPasswordResetUser(null);
            setNewPassword('');
        } catch (error) {
            console.error('Error resetting password:', error);
            setPasswordError(error.message || 'Failed to reset password. Please try again.');
        }
    };

    const handleClosePasswordModal = () => {
        setShowPasswordModal(false);
        setPasswordResetUser(null);
        setNewPassword('');
        setPasswordError('');
    };

    return (
        <div className="user-module">
            <div className="user-header">
                <div className="header-left">
                    <h2>User Management</h2>
                    <p>Manage system access for admins, HR managers, staff members, and students</p>
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
                    {['All', 'Admin', 'HRM', 'Staff', 'Student'].map(role => (
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
                                        <span className="branch-text">{formatBranchName(user.branch)}</span>
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
                                            <button className="action-btn password" title="Reset Password" onClick={() => handlePasswordReset(user)}>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>
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
                                        {editingUser ? 'Edit Account' : 'Add New User Account'}
                                    </h2>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--secondary-text)', margin: 0 }}>
                                        {editingUser ? 'Update account information and permissions' : 'Fill in the details to add a new admin, HRM, or staff member'}
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
                                                    placeholder="09XX XXX XXXX"
                                                    value={userData.contactNumber}
                                                    onChange={handleInputChange}
                                                    maxLength="13"
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
                                                {errors.contactNumber ? (
                                                    <span style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                                                        {errors.contactNumber}
                                                    </span>
                                                ) : (
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--secondary-text)', marginTop: '4px', display: 'block' }}>
                                                        Must start with 09 (11 digits)
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
                                                    <option value="HRM">HRM (HR Manager)</option>
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
                                                        <option key={branch.id} value={branch.id}>
                                                            {formatBranchName(branch.name)}
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
                                                    }}>
                                                        {selectedUser.contactNumber ? (() => {
                                                            const cleaned = String(selectedUser.contactNumber).replace(/\D/g, '');
                                                            if (cleaned.length === 11 && cleaned.startsWith('09')) {
                                                                return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 11)}`;
                                                            }
                                                            return selectedUser.contactNumber;
                                                        })() : 'Not provided'}
                                                    </div>
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
                                                }}>{formatBranchName(selectedUser.branch)}</div>
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

                {/* Password Reset Modal */}
                {showPasswordModal && passwordResetUser && (
                    <div className="modal-overlay">
                        <div className="modal-container" style={{ maxWidth: '500px', width: '90%' }}>
                            <div className="modal-header" style={{ 
                                background: 'var(--card-bg)',
                                color: 'var(--text-color)',
                                padding: '24px 30px',
                                borderBottom: '1px solid var(--border-color)'
                            }}>
                                <div>
                                    <h2 style={{ color: 'var(--text-color)', marginBottom: '4px', fontWeight: '700' }}>
                                        Reset Password
                                    </h2>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--secondary-text)', margin: 0 }}>
                                        Reset password for {passwordResetUser.firstName} {passwordResetUser.lastName}
                                    </p>
                                </div>
                                <button 
                                    className="close-modal" 
                                    onClick={handleClosePasswordModal}
                                    style={{
                                        background: 'var(--card-bg)',
                                        border: '1.5px solid var(--border-color)',
                                        color: 'var(--text-color)',
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                            
                            <form onSubmit={handlePasswordSubmit}>
                                <div className="modal-content" style={{ padding: '30px' }}>
                                    {passwordError && (
                                        <div style={{
                                            padding: '12px 16px',
                                            background: '#fee',
                                            border: '1px solid #fcc',
                                            borderRadius: '8px',
                                            marginBottom: '20px',
                                            fontSize: '0.9rem',
                                            color: '#c33'
                                        }}>
                                            {passwordError}
                                        </div>
                                    )}

                                    <div className="form-group">
                                        <label style={{ 
                                            fontSize: '0.85rem', 
                                            fontWeight: '600', 
                                            color: 'var(--text-color)',
                                            marginBottom: '8px',
                                            display: 'block'
                                        }}>
                                            New Password <span style={{ color: '#ef4444' }}>*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="Enter new password"
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '12px 16px',
                                                borderRadius: '10px',
                                                border: passwordError ? '1.5px solid #ef4444' : '1.5px solid var(--border-color)',
                                                background: 'var(--card-bg)',
                                                fontSize: '0.95rem',
                                                color: 'var(--text-color)',
                                                transition: 'all 0.2s'
                                            }}
                                        />
                                        <p style={{ 
                                            fontSize: '0.75rem', 
                                            color: 'var(--secondary-text)', 
                                            marginTop: '6px',
                                            marginBottom: 0
                                        }}>
                                            Password must be at least 6 characters long
                                        </p>
                                    </div>
                                </div>

                                <div className="modal-footer" style={{ 
                                    borderTop: '1px solid var(--border-color)', 
                                    padding: '20px 30px', 
                                    display: 'flex', 
                                    gap: '12px',
                                    background: 'var(--card-bg)'
                                }}>
                                    <button 
                                        type="button"
                                        className="prev-btn" 
                                        style={{ 
                                            flex: 1,
                                            padding: '12px 24px',
                                            borderRadius: '10px',
                                            border: '1.5px solid var(--border-color)',
                                            background: 'var(--card-bg)',
                                            color: 'var(--text-color)',
                                            fontSize: '0.9rem',
                                            fontWeight: '600',
                                            cursor: 'pointer'
                                        }} 
                                        onClick={handleClosePasswordModal}
                                    >Cancel</button>
                                    <button 
                                        type="submit"
                                        className="confirm-btn" 
                                        style={{ 
                                            flex: 1,
                                            padding: '12px 24px',
                                            borderRadius: '10px',
                                            border: 'none',
                                            background: 'var(--primary-color)',
                                            color: 'white',
                                            fontSize: '0.9rem',
                                            fontWeight: '600',
                                            cursor: 'pointer'
                                        }}
                                    >Reset Password</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserManagement;
