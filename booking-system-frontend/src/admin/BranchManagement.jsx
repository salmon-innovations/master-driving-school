import React, { useState, useEffect, useMemo } from 'react';
import './css/branch.css';
import { branchesAPI, rolesAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';

const BranchManagement = () => {
    const { showNotification } = useNotification();
    const [activeTab, setActiveTab] = useState('branches');

    // Branch States
    const [branches, setBranches] = useState([]);
    const [branchLoading, setBranchLoading] = useState(true);
    const [branchSearchTerm, setBranchSearchTerm] = useState('');
    const [showBranchModal, setShowBranchModal] = useState(false);
    const [editingBranch, setEditingBranch] = useState(null);
    const [branchFormData, setBranchFormData] = useState({
        name: '',
        address: '',
        contact_number: '',
        email: ''
    });

    // Role States
    const [roles, setRoles] = useState([]);
    const [roleLoading, setRoleLoading] = useState(true);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [roleFormData, setRoleFormData] = useState({
        name: '',
        display_name: '',
        description: '',
        permissions: []
    });

    // General Settings State
    const [generalSettings, setGeneralSettings] = useState({
        siteName: 'Master Driving School',
        supportEmail: 'support@masterdriving.com',
        maintenanceMode: false,
        autoVerifyUsers: true,
        sessionTimeout: 60,
        enableNotifications: true
    });



    useEffect(() => {
        // Fetch everything on mount for header stats and consistent state
        const loadInitialData = async () => {
            await Promise.all([fetchBranches(), fetchRoles()]);
        };
        loadInitialData();
    }, []);

    useEffect(() => {
        // Refresh active tab specifically when user switches
        if (activeTab === 'branches') fetchBranches();
        if (activeTab === 'roles') fetchRoles();
    }, [activeTab]);

    // --- Branch Logic ---
    const fetchBranches = async () => {
        try {
            setBranchLoading(true);
            const response = await branchesAPI.getAll();
            if (response.success) setBranches(response.branches);
        } catch (error) {
            showNotification('Failed to load branches', 'error');
        } finally {
            setBranchLoading(false);
        }
    };

    const filteredBranches = useMemo(() => {
        return branches.filter(branch =>
            branch.name.toLowerCase().includes(branchSearchTerm.toLowerCase()) ||
            (branch.address && branch.address.toLowerCase().includes(branchSearchTerm.toLowerCase()))
        );
    }, [branches, branchSearchTerm]);

    const handleBranchAdd = () => {
        setEditingBranch(null);
        setBranchFormData({ name: '', address: '', contact_number: '', email: '' });
        setShowBranchModal(true);
    };

    const handleBranchEdit = (branch) => {
        setEditingBranch(branch);
        setBranchFormData({
            name: branch.name,
            address: branch.address || '',
            contact_number: branch.contact_number || '',
            email: branch.email || ''
        });
        setShowBranchModal(true);
    };

    const handleBranchSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingBranch) {
                await branchesAPI.update(editingBranch.id, branchFormData);
                showNotification('Branch updated successfully', 'success');
            } else {
                await branchesAPI.create(branchFormData);
                showNotification('Branch created successfully', 'success');
            }
            setShowBranchModal(false);
            fetchBranches();
        } catch (error) {
            showNotification(error.message || 'Failed to save branch', 'error');
        }
    };

    const handleBranchDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this branch?')) {
            try {
                await branchesAPI.delete(id);
                showNotification('Branch deleted successfully', 'success');
                fetchBranches();
            } catch (error) {
                showNotification(error.message || 'Failed to delete branch', 'error');
            }
        }
    };

    // --- Role Logic ---
    const fetchRoles = async () => {
        try {
            setRoleLoading(true);
            const response = await rolesAPI.getAll();
            if (response.success) setRoles(response.roles);
        } catch (error) {
            showNotification('Failed to load roles', 'error');
        } finally {
            setRoleLoading(false);
        }
    };

    const handleRoleAdd = () => {
        setEditingRole(null);
        setRoleFormData({ name: '', display_name: '', description: '', permissions: [] });
        setShowRoleModal(true);
    };

    const handleRoleEdit = (role) => {
        setEditingRole(role);
        setRoleFormData({
            name: role.name,
            display_name: role.display_name,
            description: role.description || '',
            permissions: role.permissions || []
        });
        setShowRoleModal(true);
    };

    const handleRoleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingRole) {
                await rolesAPI.update(editingRole.id, roleFormData);
                showNotification('Role updated successfully', 'success');
            } else {
                await rolesAPI.create(roleFormData);
                showNotification('Role created successfully', 'success');
            }
            setShowRoleModal(false);
            fetchRoles();
        } catch (error) {
            showNotification(error.message || 'Failed to save role', 'error');
        }
    };

    const handleRoleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this role? System roles cannot be deleted.')) {
            try {
                await rolesAPI.delete(id);
                showNotification('Role deleted successfully', 'success');
                fetchRoles();
            } catch (error) {
                showNotification(error.message || 'Failed to delete role', 'error');
            }
        }
    };

    // --- General Settings Logic ---
    const handleSettingChange = (key, value) => {
        setGeneralSettings(prev => ({ ...prev, [key]: value }));
        showNotification(`${key.replace(/([A-Z])/g, ' $1')} updated (locally)`, 'success');
    };

    const handleSaveGeneral = (e) => {
        e.preventDefault();
        showNotification('General settings saved successfully!', 'success');
    };



    return (
        <div className="branch-management-container">
            {/* Premium Header */}
            <header className="management-header">

                <div className="config-tabs-nav">
                    <div className="tabs-pill">
                        <button
                            className={`tab-btn ${activeTab === 'branches' ? 'active' : ''}`}
                            onClick={() => setActiveTab('branches')}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                            Branches
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'roles' ? 'active' : ''}`}
                            onClick={() => setActiveTab('roles')}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                            </svg>
                            User Roles
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
                            onClick={() => setActiveTab('settings')}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            </svg>
                            System Settings
                        </button>

                    </div>
                </div>
            </header>

            <main className="management-content">
                {activeTab === 'branches' && (
                    <BranchSection
                        branches={filteredBranches}
                        loading={branchLoading}
                        searchTerm={branchSearchTerm}
                        setSearchTerm={setBranchSearchTerm}
                        onAdd={handleBranchAdd}
                        onEdit={handleBranchEdit}
                        onDelete={handleBranchDelete}
                    />
                )}

                {activeTab === 'roles' && (
                    <RoleSection
                        roles={roles}
                        loading={roleLoading}
                        onAdd={handleRoleAdd}
                        onEdit={handleRoleEdit}
                        onDelete={handleRoleDelete}
                    />
                )}

                {activeTab === 'settings' && (
                    <SettingsSection
                        settings={generalSettings}
                        setSettings={setGeneralSettings}
                        onSave={handleSaveGeneral}
                        onSettingChange={handleSettingChange}
                    />
                )}


            </main>

            {/* Modals */}
            {showBranchModal && (
                <BranchModal
                    isOpen={showBranchModal}
                    onClose={() => setShowBranchModal(false)}
                    onSubmit={handleBranchSubmit}
                    formData={branchFormData}
                    setFormData={setBranchFormData}
                    isEditing={!!editingBranch}
                />
            )}

            {showRoleModal && (
                <RoleModal
                    isOpen={showRoleModal}
                    onClose={() => setShowRoleModal(false)}
                    onSubmit={handleRoleSubmit}
                    formData={roleFormData}
                    setFormData={setRoleFormData}
                    isEditing={!!editingRole}
                />
            )}


        </div>
    );
};

// --- Sub-components ---

const BranchSection = ({ branches, loading, searchTerm, setSearchTerm, onAdd, onEdit, onDelete }) => (
    <div className="section-container animate-fade-in">
        <div className="section-toolbar">
            <div className="search-wrapper">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                    type="text"
                    placeholder="Search by branch name or address..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <button className="primary-action-btn" onClick={onAdd}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Add New Branch
            </button>
        </div>

        <div className="grid-layout">
            {loading ? (
                <LoadingPlaceholder count={3} />
            ) : branches.length > 0 ? (
                branches.map(branch => (
                    <div key={branch.id} className="premium-card branch-card">
                        <div className="card-top">
                            <div className="branch-header">
                                <div className="branch-avatar">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                        <circle cx="12" cy="10" r="3"></circle>
                                    </svg>
                                </div>
                                <div className="branch-title-group">
                                    <h3>{branch.name}</h3>
                                    <span className="branch-tag">Registration Active</span>
                                </div>
                            </div>
                            <div className="card-actions-menu">
                                <button className="icon-btn edit-btn" onClick={() => onEdit(branch)} title="Edit Properties">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                </button>
                                <button className="icon-btn delete-btn" onClick={() => onDelete(branch.id)} title="Remove Branch">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div className="card-main">
                            <div className="branch-details-grid">
                                <div className="detail-item">
                                    <div className="detail-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                        </svg>
                                    </div>
                                    <div className="detail-text">
                                        <span className="detail-label">Location Address</span>
                                        <span className="detail-value">{branch.address || 'Not Specified'}</span>
                                    </div>
                                </div>
                                <div className="detail-item">
                                    <div className="detail-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                        </svg>
                                    </div>
                                    <div className="detail-text">
                                        <span className="detail-label">Contact Reference</span>
                                        <span className="detail-value">{branch.contact_number || 'No contact found'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="card-footer-stats">
                            <div className="footer-stat">
                                <span className="managed-badge">Verified System Node</span>
                                <div className="status-active-badge">
                                    <div className="pulse-dot"></div>
                                    Active Branch
                                </div>
                            </div>
                        </div>
                    </div>
                ))
            ) : (
                <EmptyState
                    title="No Branches Found"
                    message={searchTerm ? `No branches match your search "${searchTerm}"` : "You haven't added any branches yet."}
                    icon={<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>}
                />
            )}
        </div>
    </div>
);

const RoleSection = ({ roles, loading, onAdd, onEdit, onDelete }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredRoles = useMemo(() => {
        return roles.filter(role =>
            role.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (role.description && role.description.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [roles, searchTerm]);

    return (
        <div className="section-container animate-fade-in">
            <div className="section-toolbar space-between">
                <div className="search-wrapper">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input
                        type="text"
                        placeholder="Search roles by name or code..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button className="primary-action-btn" onClick={onAdd}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Add New Role
                </button>
            </div>

            <div className="grid-layout">
                {loading ? (
                    <LoadingPlaceholder count={4} />
                ) : filteredRoles.length > 0 ? (
                    filteredRoles.map(role => (
                        <div key={role.id} className={`premium-card role-card ${role.is_system ? 'system-role' : ''}`}>
                            <div className="card-top">
                                {role.is_system ? (
                                    <span className="system-badge">System Core</span>
                                ) : (
                                    <span className="custom-badge">User Defined</span>
                                )}
                                {!role.is_system && (
                                    <div className="card-actions-menu">
                                        <button className="icon-btn edit-btn" onClick={() => onEdit(role)} title="Modify Role">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                            </svg>
                                        </button>
                                        <button className="icon-btn delete-btn" onClick={() => onDelete(role.id)} title="Purge Role">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                            </svg>
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="card-main">
                                <div className="role-info-prime">
                                    <div className="role-icon-header">
                                        <div className="role-avatar">
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                            </svg>
                                        </div>
                                        <div className="role-title">
                                            <h3>{role.display_name}</h3>
                                            <code>{role.name}</code>
                                        </div>
                                    </div>
                                    <p className="role-description">{role.description || 'No descriptive data mapped to this node.'}</p>
                                </div>
                            </div>

                            <div className="card-footer-stats">
                                <div className="permission-count">
                                    <span>{role.permissions?.length || 0} Registered Permissions</span>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <EmptyState
                        title="No Roles Found"
                        message={searchTerm ? `No roles match your search "${searchTerm}"` : "You haven't defined any custom roles yet."}
                        icon={<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>}
                    />
                )}
            </div>
        </div>
    );
};

const SettingsSection = ({ settings, setSettings, onSave, onSettingChange }) => (
    <div className="section-container animate-fade-in">
        <div className="settings-layout">
            <form className="settings-form-premium" onSubmit={onSave}>
                <div className="settings-grid">
                    <div className="settings-group-card">
                        <div className="card-header">
                            <div className="icon-bg">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <path d="M12 8v4l3 3"></path>
                                </svg>
                            </div>
                            <h3>General Branding</h3>
                        </div>
                        <div className="card-body">
                            <div className="form-item">
                                <label>Business Name</label>
                                <input
                                    type="text"
                                    value={settings.siteName}
                                    onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                                />
                            </div>
                            <div className="form-item">
                                <label>Support & Admin Email</label>
                                <input
                                    type="email"
                                    value={settings.supportEmail}
                                    onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="settings-group-card">
                        <div className="card-header">
                            <div className="icon-bg warning">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                            </div>
                            <h3>System Security</h3>
                        </div>
                        <div className="card-body">
                            <div className="toggle-item-premium">
                                <div className="info">
                                    <h4>Maintenance Mode</h4>
                                    <p>Temporarily disable access for non-admin users.</p>
                                </div>
                                <label className="premium-toggle">
                                    <input
                                        type="checkbox"
                                        checked={settings.maintenanceMode}
                                        onChange={(e) => onSettingChange('maintenanceMode', e.target.checked)}
                                    />
                                    <span className="slider"></span>
                                </label>
                            </div>
                            <div className="toggle-item-premium">
                                <div className="info">
                                    <h4>Trust Verification</h4>
                                    <p>Automatically approve new user registrations.</p>
                                </div>
                                <label className="premium-toggle">
                                    <input
                                        type="checkbox"
                                        checked={settings.autoVerifyUsers}
                                        onChange={(e) => onSettingChange('autoVerifyUsers', e.target.checked)}
                                    />
                                    <span className="slider"></span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="settings-actions">
                    <button type="submit" className="save-btn">
                        Save Configuration
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                            <polyline points="17 21 17 13 7 13 7 21"></polyline>
                            <polyline points="7 3 7 8 15 8"></polyline>
                        </svg>
                    </button>
                </div>
            </form>
        </div>
    </div>
);

// --- Simple Utility Components ---

const LoadingPlaceholder = ({ count }) => (
    <>
        {[...Array(count)].map((_, i) => (
            <div key={i} className="premium-card skeleton">
                <div className="skeleton-header"></div>
                <div className="skeleton-body">
                    <div className="skeleton-line"></div>
                    <div className="skeleton-line short"></div>
                </div>
            </div>
        ))}
    </>
);

const EmptyState = ({ title, message, icon }) => (
    <div className="empty-state-luxury">
        <div className="empty-icon-container">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                {icon}
                <circle cx="12" cy="10" r="3"></circle>
            </svg>
        </div>
        <h2>{title}</h2>
        <p>{message}</p>
    </div>
);

const BranchModal = ({ isOpen, onClose, onSubmit, formData, setFormData, isEditing }) => (
    <div className="premium-modal-overlay">
        <div className="premium-modal-container">
            <div className="modal-header">
                <div>
                    <h2>{isEditing ? 'Update Branch' : 'Register Branch'}</h2>
                    <p>Enter the details for your business location.</p>
                </div>
                <button className="close-x" onClick={onClose}>&times;</button>
            </div>
            <form onSubmit={onSubmit}>
                <div className="modal-scroll-body">
                    <div className="form-field">
                        <label>Official Name</label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Master Driving School - Quezon City"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>
                    <div className="form-field">
                        <label>Business Address</label>
                        <textarea
                            placeholder="Complete street address, building, city"
                            rows="2"
                            value={formData.address}
                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                        ></textarea>
                    </div>
                    <div className="form-grid-2">
                        <div className="form-field">
                            <label>Primary Contact</label>
                            <input
                                type="text"
                                placeholder="Phone or Mobile number"
                                value={formData.contact_number}
                                onChange={e => setFormData({ ...formData, contact_number: e.target.value })}
                            />
                        </div>
                        <div className="form-field">
                            <label>Support Email</label>
                            <input
                                type="email"
                                placeholder="branch@example.com"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                    </div>
                </div>
                <div className="modal-footer-lux">
                    <button type="button" className="secondary-btn" onClick={onClose}>Discard</button>
                    <button type="submit" className="primary-btn">{isEditing ? 'Update Details' : 'Confirm Registration'}</button>
                </div>
            </form>
        </div>
    </div>
);

const RoleModal = ({ isOpen, onClose, onSubmit, formData, setFormData, isEditing }) => (
    <div className="premium-modal-overlay">
        <div className="premium-modal-container">
            <div className="modal-header">
                <div>
                    <h2>{isEditing ? 'Edit Access Role' : 'Create Access Role'}</h2>
                    <p>Define permissions and access levels for your team.</p>
                </div>
                <button className="close-x" onClick={onClose}>&times;</button>
            </div>
            <form onSubmit={onSubmit}>
                <div className="modal-scroll-body">
                    <div className="form-grid-2">
                        <div className="form-field">
                            <label>Internal Code</label>
                            <input
                                type="text"
                                required
                                disabled={isEditing}
                                placeholder="e.g. branch_manager"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="form-field">
                            <label>Display Label</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. Branch Manager"
                                value={formData.display_name}
                                onChange={e => setFormData({ ...formData, display_name: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="form-field">
                        <label>Description & Purpose</label>
                        <textarea
                            placeholder="Describe what users with this role can do..."
                            rows="3"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        ></textarea>
                    </div>
                </div>
                <div className="modal-footer-lux">
                    <button type="button" className="secondary-btn" onClick={onClose}>Cancel</button>
                    <button type="submit" className="primary-btn">{isEditing ? 'Update Role' : 'Create Role'}</button>
                </div>
            </form>
        </div>
    </div>
);



export default BranchManagement;
