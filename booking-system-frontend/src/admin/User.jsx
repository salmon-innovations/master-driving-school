import React, { useState, useEffect } from 'react';
import './css/user.css';
import { adminAPI } from '../services/api';

const UserManagement = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [editingUser, setEditingUser] = useState(null);
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
        branch: 'Main Branch',
        status: 'active'
    });

    // Fetch users from database
    useEffect(() => {
        fetchUsers();
    }, []);

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
                branch: user.branch || 'N/A',
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
                contactNumber: user.contact_numbers || ''
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
    };

    const handleAddUser = async (e) => {
        e.preventDefault();

        // Validate passwords match
        if (userData.password !== userData.confirmPassword) {
            alert('Passwords do not match!');
            return;
        }

        // Only allow Admin or Staff creation
        if (userData.role.toLowerCase() !== 'admin' && userData.role.toLowerCase() !== 'staff') {
            alert('Only Admin or Staff members can be added.');
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
                branch: 'Main Branch',
                status: 'active'
            });
        } catch (error) {
            console.error('Error saving user:', error);
            alert(error.message || 'Failed to save user. Please try again.');
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
            branch: 'Main Branch',
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
                                            <button className="action-btn edit" title="Edit User" onClick={() => handleEditClick(user)}>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z"></path></svg>
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
                                                        border: '1.5px solid var(--border-color)',
                                                        background: 'var(--card-bg)',
                                                        fontSize: '0.9rem',
                                                        color: 'var(--text-color)',
                                                        transition: 'all 0.2s'
                                                    }}
                                                />
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
                                                        border: '1.5px solid var(--border-color)',
                                                        background: 'var(--card-bg)',
                                                        fontSize: '0.9rem',
                                                        color: 'var(--text-color)'
                                                    }}
                                                />
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
                                                        border: '1.5px solid var(--border-color)',
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
                                                        border: '1.5px solid var(--border-color)',
                                                        background: 'var(--card-bg)',
                                                        fontSize: '0.9rem',
                                                        color: 'var(--text-color)'
                                                    }}
                                                />
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
                                                        border: '1.5px solid var(--border-color)',
                                                        background: 'var(--card-bg)',
                                                        fontSize: '0.9rem',
                                                        color: 'var(--text-color)'
                                                    }}
                                                />
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
                                                        border: '1.5px solid var(--border-color)',
                                                        background: 'var(--card-bg)',
                                                        fontSize: '0.9rem',
                                                        color: 'var(--text-color)'
                                                    }}
                                                />
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
                                                <input
                                                    type="password"
                                                    name="password"
                                                    placeholder="Min. 8 characters"
                                                    minLength="8"
                                                    value={userData.password}
                                                    onChange={handleInputChange}
                                                    required={!editingUser}
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
                                                <input
                                                    type="password"
                                                    name="confirmPassword"
                                                    placeholder="Re-enter password"
                                                    minLength="8"
                                                    value={userData.confirmPassword}
                                                    onChange={handleInputChange}
                                                    required={!editingUser}
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
                                                        border: '1.5px solid var(--border-color)',
                                                        background: 'var(--card-bg)',
                                                        fontSize: '0.9rem',
                                                        color: 'var(--text-color)',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <option value="Main Branch">Main Branch</option>
                                                    <option value="Lipa Branch">Lipa Branch</option>
                                                    <option value="Tanauan Branch">Tanauan Branch</option>
                                                    <option value="Batangas Branch">Batangas Branch</option>
                                                    <option value="V. Luna Branch">V. Luna Branch</option>
                                                </select>
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
                        <div className="modal-container profile-modal" style={{ maxWidth: '450px' }}>
                            <div className="modal-header">
                                <h2>User Profile</h2>
                                <button className="close-modal" onClick={() => setShowViewModal(false)}>&times;</button>
                            </div>
                            <div className="modal-body profile-body" style={{ textAlign: 'center', padding: '30px' }}>
                                <div className="profile-photo-container" style={{ position: 'relative', display: 'inline-block', marginBottom: '20px' }}>
                                    <img
                                        src={selectedUser.avatar}
                                        alt={selectedUser.name}
                                        style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '4px solid #f8fafc', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                    />
                                    <span className={`status-badge-overlay ${selectedUser.status.toLowerCase()}`} style={{ position: 'absolute', bottom: '5px', right: '5px' }}></span>
                                </div>
                                <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b', marginBottom: '5px' }}>{selectedUser.name}</h1>
                                <p style={{ color: '#64748b', marginBottom: '20px' }}>{selectedUser.email}</p>

                                <div className="profile-details-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', textAlign: 'left', marginTop: '20px' }}>
                                    <div className="detail-item">
                                        <label style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Access Level</label>
                                        <div style={{ fontWeight: '600', color: '#334155' }}>{selectedUser.role}</div>
                                    </div>
                                    <div className="detail-item">
                                        <label style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Branch Office</label>
                                        <div style={{ fontWeight: '600', color: '#334155' }}>{selectedUser.branch}</div>
                                    </div>
                                    <div className="detail-item">
                                        <label style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account Status</label>
                                        <div style={{ fontWeight: '600', color: selectedUser.status === 'Active' ? '#16a34a' : '#dc2626' }}>{selectedUser.status}</div>
                                    </div>
                                    <div className="detail-item">
                                        <label style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Activity</label>
                                        <div style={{ fontWeight: '600', color: '#334155' }}>{selectedUser.lastLogin}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer" style={{ borderTop: '1px solid #f1f5f9', padding: '20px', display: 'flex', gap: '10px' }}>
                                <button className="prev-btn" style={{ flex: 1 }} onClick={() => setShowViewModal(false)}>Close View</button>
                                <button className="confirm-btn" style={{ flex: 1 }}>Edit Account</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserManagement;
