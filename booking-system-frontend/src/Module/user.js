import React, { useState } from 'react';
import './css/user.css';

const UserManagement = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');

    // Mock data for users
    const [users, setUsers] = useState([
        { id: 1, name: 'Admin One', email: 'admin@masterschool.com', role: 'Admin', branch: 'Main Branch', status: 'Active', lastLogin: '2 mins ago', avatar: 'https://i.pravatar.cc/150?u=admin1' },
        { id: 2, name: 'Instructor John', email: 'john@masterschool.com', role: 'Instructor', branch: 'Lipa Branch', status: 'Active', lastLogin: '1 hour ago', avatar: 'https://i.pravatar.cc/150?u=instructor1' },
        { id: 3, name: 'Juan Dela Cruz', email: 'juan@gmail.com', role: 'Student', branch: 'Main Branch', status: 'Active', lastLogin: 'Yesterday', avatar: 'https://i.pravatar.cc/150?u=student1' },
        { id: 4, name: 'Maria Santos', email: 'maria@gmail.com', role: 'Student', branch: 'Batangas Branch', status: 'Inactive', lastLogin: '3 days ago', avatar: 'https://i.pravatar.cc/150?u=student2' },
        { id: 5, name: 'Instructor Sarah', email: 'sarah@masterschool.com', role: 'Instructor', branch: 'Tanauan Branch', status: 'Active', lastLogin: '4 hours ago', avatar: 'https://i.pravatar.cc/150?u=instructor2' },
        { id: 6, name: 'Pedro Penduko', email: 'pedro@gmail.com', role: 'Student', branch: 'V. Luna Branch', status: 'Active', lastLogin: 'Just now', avatar: 'https://i.pravatar.cc/150?u=student3' },
    ]);

    const [showModal, setShowModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [editingUser, setEditingUser] = useState(null);
    const [userData, setUserData] = useState({
        name: '',
        email: '',
        role: 'Student',
        branch: 'Main Branch',
        status: 'Active'
    });

    const handleSearch = (e) => setSearchTerm(e.target.value);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setUserData({ ...userData, [name]: value });
    };

    const handleAddUser = (e) => {
        e.preventDefault();

        if (editingUser) {
            // Update existing user
            setUsers(users.map(u =>
                u.id === editingUser.id ? { ...u, ...userData } : u
            ));
        } else {
            // Create new user
            const newUser = {
                id: users.length + 1,
                ...userData,
                lastLogin: 'Just now',
                avatar: `https://i.pravatar.cc/150?u=${users.length + 1}`
            };
            setUsers([newUser, ...users]);
        }

        setShowModal(false);
        setEditingUser(null);
        setUserData({
            name: '',
            email: '',
            role: 'Student',
            branch: 'Main Branch',
            status: 'Active'
        });
    };

    const handleEditClick = (user) => {
        setEditingUser(user);
        setUserData({
            name: user.name,
            email: user.email,
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
            name: '',
            email: '',
            role: 'Student',
            branch: 'Main Branch',
            status: 'Active'
        });
    };

    const filteredUsers = users.filter(user => {
        const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === 'All' || user.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    const toggleStatus = (id) => {
        setUsers(users.map(u =>
            u.id === id ? { ...u, status: u.status === 'Active' ? 'Inactive' : 'Active' } : u
        ));
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
                    <p>Manage system access for admins, instructors, and students</p>
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
                    {['All', 'Admin', 'Instructor', 'Student'].map(role => (
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
                {filteredUsers.length === 0 && (
                    <div className="no-users">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        <p>No users found matching your search.</p>
                    </div>
                )}
                {/* Add/Edit User Modal */}
                {showModal && (
                    <div className="modal-overlay">
                        <div className="modal-container user-modal">
                            <div className="modal-header">
                                <h2>{editingUser ? 'Edit User Record' : 'Add New User'}</h2>
                                <button className="close-modal" onClick={handleCloseModal}>&times;</button>
                            </div>
                            <form onSubmit={handleAddUser}>
                                <div className="modal-body">
                                    <div className="form-group">
                                        <label>Full Name</label>
                                        <input
                                            type="text"
                                            name="name"
                                            placeholder="e.g. John Doe"
                                            value={userData.name}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Email Address</label>
                                        <input
                                            type="email"
                                            name="email"
                                            placeholder="john@example.com"
                                            value={userData.email}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Role</label>
                                            <select name="role" value={userData.role} onChange={handleInputChange}>
                                                <option value="Admin">Admin</option>
                                                <option value="Instructor">Instructor</option>
                                                <option value="Student">Student</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Branch</label>
                                            <select name="branch" value={userData.branch} onChange={handleInputChange}>
                                                <option value="Main Branch">Main Branch</option>
                                                <option value="Lipa Branch">Lipa Branch</option>
                                                <option value="Tanauan Branch">Tanauan Branch</option>
                                                <option value="Batangas Branch">Batangas Branch</option>
                                                <option value="V. Luna Branch">V. Luna Branch</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="cancel-btn" onClick={handleCloseModal}>Cancel</button>
                                    <button type="submit" className="confirm-btn">
                                        {editingUser ? 'Update Details' : 'Create User'}
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
