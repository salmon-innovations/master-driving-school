import React, { useState, useEffect, useMemo } from 'react';
import './css/branch.css';
import { branchesAPI, rolesAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import BranchSection from './config/BranchSection';
import RoleSection from './config/RoleSection';
import SettingsSection from './config/SettingsSection';
import CourseTypesSection from './config/CourseTypesSection';
import EmailContentSection from './config/EmailContentSection';
import { BranchModal, RoleModal, ConfirmModal } from './config/Modals';

const Configuration = ({ initialTab = 'branches' }) => {
    const { showNotification } = useNotification();
    const [activeTab, setActiveTab] = useState(initialTab);

    // Branch States
    const [branches, setBranches] = useState([]);
    const [branchLoading, setBranchLoading] = useState(true);
    const [branchSearchTerm, setBranchSearchTerm] = useState('');
    const [showBranchModal, setShowBranchModal] = useState(false);
    const [editingBranch, setEditingBranch] = useState(null);
    const [branchFormData, setBranchFormData] = useState({ name: '', address: '', contact_number: '', email: '' });

    // Role States
    const [roles, setRoles] = useState([]);
    const [roleLoading, setRoleLoading] = useState(true);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [roleFormData, setRoleFormData] = useState({ name: '', display_name: '', description: '', permissions: [] });

    // Confirm Modal State
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, confirmText: 'Delete', isDestructive: true });

    // Settings State
    const SETTINGS_KEY = 'mds_admin_settings';
    const defaultSettings = {
        siteName: 'Master Driving School',
        tagline: 'Building Champions on the Road',
        supportEmail: 'support@masterdriving.com',
        contactNumber: '',
        maintenanceMode: false,
        autoVerifyUsers: true,
        sessionTimeout: 60,
        enableNotifications: true,
        compactView: false,
        // Booking rules
        maxStudentsPerSlot: 10,
        minBookingAdvanceDays: 1,
        autoCancelDays: 7,
        allowWalkIn: true,
        // Payment settings
        enableCash: true,
        requirePaymentBeforeConfirm: false,
    };
    const loadSettings = () => {
        try {
            const saved = localStorage.getItem(SETTINGS_KEY);
            return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
        } catch { return defaultSettings; }
    };
    const [generalSettings, setGeneralSettings] = useState(loadSettings);

    useEffect(() => { Promise.all([fetchBranches(), fetchRoles()]); }, []);
    useEffect(() => {
        if (activeTab === 'branches') fetchBranches();
        if (activeTab === 'roles') fetchRoles();
    }, [activeTab]);

    // ---------- Branch Logic ----------
    const fetchBranches = async () => {
        try {
            setBranchLoading(true);
            const res = await branchesAPI.getAll();
            if (res.success) setBranches(res.branches);
        } catch { showNotification('Failed to load branches', 'error'); }
        finally { setBranchLoading(false); }
    };

    const filteredBranches = useMemo(() =>
        branches.filter(b =>
            b.name.toLowerCase().includes(branchSearchTerm.toLowerCase()) ||
            (b.address && b.address.toLowerCase().includes(branchSearchTerm.toLowerCase()))
        ), [branches, branchSearchTerm]);

    const handleBranchAdd = () => {
        setEditingBranch(null);
        setBranchFormData({ name: '', address: '', contact_number: '', email: '' });
        setShowBranchModal(true);
    };

    const handleBranchEdit = (branch) => {
        setEditingBranch(branch);
        setBranchFormData({ name: branch.name, address: branch.address || '', contact_number: branch.contact_number || '', email: branch.email || '' });
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
        } catch (err) { showNotification(err.message || 'Failed to save branch', 'error'); }
    };

    const handleBranchDelete = async (id) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Branch',
            message: 'Are you sure you want to delete this branch? This action cannot be undone.',
            confirmText: 'Delete Branch',
            isDestructive: true,
            onConfirm: async () => {
                try {
                    await branchesAPI.delete(id);
                    showNotification('Branch deleted successfully', 'success');
                    fetchBranches();
                } catch (err) {
                    showNotification(err.message || 'Failed to delete branch', 'error');
                }
            }
        });
    };

    // ---------- Role Logic ----------
    const fetchRoles = async () => {
        try {
            setRoleLoading(true);
            const res = await rolesAPI.getAll();
            if (res.success) setRoles(res.roles);
        } catch { showNotification('Failed to load roles', 'error'); }
        finally { setRoleLoading(false); }
    };

    const handleRoleAdd = () => {
        setEditingRole(null);
        setRoleFormData({ name: '', display_name: '', description: '', permissions: [] });
        setShowRoleModal(true);
    };

    const handleRoleEdit = (role) => {
        setEditingRole(role);
        setRoleFormData({ name: role.name, display_name: role.display_name, description: role.description || '', permissions: role.permissions || [] });
        setShowRoleModal(true);
    };

    const handleRoleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingRole) {
                await rolesAPI.update(editingRole.id, roleFormData);
                showNotification('Role updated', 'success');
            } else {
                await rolesAPI.create(roleFormData);
                showNotification('Role created', 'success');
            }
            setShowRoleModal(false);
            fetchRoles();
        } catch (err) { showNotification(err.message || 'Failed to save role', 'error'); }
    };

    const handleRoleDelete = async (id) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Role',
            message: 'Are you sure you want to delete this role? System roles cannot be deleted.',
            confirmText: 'Delete Role',
            isDestructive: true,
            onConfirm: async () => {
                try {
                    await rolesAPI.delete(id);
                    showNotification('Role deleted successfully', 'success');
                    fetchRoles();
                } catch (err) {
                    showNotification(err.message || 'Failed to delete role', 'error');
                }
            }
        });
    };

    // ---------- Settings Logic ----------
    const handleSettingChange = (key, value) => {
        setGeneralSettings(prev => {
            const updated = { ...prev, [key]: value };
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
            return updated;
        });
        showNotification('Setting updated', 'success');
    };

    const handleSaveGeneral = (e) => {
        e.preventDefault();
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(generalSettings));
        showNotification('Settings saved successfully!', 'success');
    };

    const tabs = [
        {
            key: 'branches',
            label: 'Branches',
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                </svg>
            )
        },
        {
            key: 'roles',
            label: 'User Roles',
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
            )
        },
        {
            key: 'coursetypes',
            label: 'Course Types',
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
            )
        },
        {
            key: 'settings',
            label: 'System Settings',
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
            )
        },        {
            key: 'emailcontent',
            label: 'Email Content',
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                </svg>
            )
        },    ];

    return (
        <div className="cfg-root">
            {/* Hero Header */}
            <div className="cfg-hero">
                <div className="cfg-hero-inner">
                    <div className="cfg-hero-left">
                        <div className="cfg-hero-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                            </svg>
                        </div>
                        <div className="cfg-hero-text">
                            <h1>Configuration</h1>
                            <p>Manage branches, roles, and system-wide settings</p>
                        </div>
                    </div>

                    <div className="cfg-hero-stats">
                        <div className="cfg-stat">
                            <span className="cfg-stat-val">{branches.length}</span>
                            <span className="cfg-stat-lbl">Branches</span>
                        </div>
                        <div className="cfg-stat">
                            <span className="cfg-stat-val">{roles.length}</span>
                            <span className="cfg-stat-lbl">Roles</span>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="cfg-tabs-bar">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            className={`cfg-tab-btn${activeTab === tab.key ? ' active' : ''}`}
                            onClick={() => setActiveTab(tab.key)}
                        >
                            <span className="cfg-tab-icon">{tab.icon}</span>
                            <span className="tab-label">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="cfg-content">
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
                {activeTab === 'coursetypes' && (
                    <CourseTypesSection />
                )}
                {activeTab === 'emailcontent' && (
                    <EmailContentSection />
                )}
            </div>

            {/* Modals */}
            <BranchModal
                isOpen={showBranchModal}
                onClose={() => setShowBranchModal(false)}
                onSubmit={handleBranchSubmit}
                formData={branchFormData}
                setFormData={setBranchFormData}
                isEditing={!!editingBranch}
            />
            <RoleModal
                isOpen={showRoleModal}
                onClose={() => setShowRoleModal(false)}
                onSubmit={handleRoleSubmit}
                formData={roleFormData}
                setFormData={setRoleFormData}
                isEditing={!!editingRole}
            />

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                isDestructive={confirmModal.isDestructive}
            />
        </div>
    );
};

export default Configuration;
