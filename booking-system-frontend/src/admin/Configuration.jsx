import React, { useState, useEffect, useMemo, useRef } from 'react';
import './css/branch.css';
import { branchesAPI, rolesAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import BranchSection from './config/BranchSection';
import RoleSection from './config/RoleSection';
import SettingsSection from './config/SettingsSection';
import CourseTypesSection from './config/CourseTypesSection';
import EmailContentSection from './config/EmailContentSection';
import { BranchModal, RoleModal, ConfirmModal } from './config/Modals';
import { adminAPI } from '../services/api';

const BackupSection = ({ branches = [] }) => {
    const { showNotification } = useNotification();
    const [loading, setLoading] = useState({ db: false, students: false, transactions: false, clear: false, restore: false });
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [exportFilters, setExportFilters] = useState({ startDate: '', endDate: '', branchId: '' });
    const sqlInputRef = useRef(null);
    const studentsInputRef = useRef(null);
    const transInputRef = useRef(null);

    const downloadCSV = (data, filename) => {
        if (!data || data.length === 0) return;
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(obj => 
            Object.values(obj).map(val => {
                if (val === null || val === undefined) return '""';
                const str = String(val);
                return `"${str.replace(/"/g, '""')}"`;
            }).join(',')
        ).join('\n');
        
        // Add BOM for Excel UTF-8 compatibility
        const csvContent = `\ufeff${headers}\n${rows}`;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDBBackup = async () => {
        try {
            setLoading(prev => ({ ...prev, db: true }));
            const blob = await adminAPI.getDatabaseBackup();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mds_full_backup_${new Date().toISOString().split('T')[0]}.sql`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            showNotification('Database backup generated and download started!', 'success');
        } catch (err) {
            showNotification(err.message || 'Failed to generate database backup', 'error');
        } finally {
            setLoading(prev => ({ ...prev, db: false }));
        }
    };

    const handleExportStudents = async () => {
        try {
            setLoading(prev => ({ ...prev, students: true }));
            const res = await adminAPI.exportStudents(exportFilters);
            if (res.success) {
                if (!res.data || res.data.length === 0) {
                    showNotification('No student records found to export', 'warning');
                } else {
                    downloadCSV(res.data, 'mds_students_backup');
                    showNotification(`${res.data.length} records exported successfully`, 'success');
                }
            }
        } catch (err) {
            console.error('Students export err:', err);
            showNotification('Export failed', 'error');
        } finally {
            setLoading(prev => ({ ...prev, students: false }));
        }
    };

    const handleExportTransactions = async () => {
        try {
            setLoading(prev => ({ ...prev, transactions: true }));
            const res = await adminAPI.exportTransactions(exportFilters);
            if (res.success) {
                if (!res.data || res.data.length === 0) {
                    showNotification('No transaction records found to export', 'warning');
                } else {
                    downloadCSV(res.data, 'mds_transactions_backup');
                    showNotification(`${res.data.length} records exported successfully`, 'success');
                }
            }
        } catch (err) {
            console.error('Transactions export err:', err);
            showNotification('Export failed', 'error');
        } finally {
            setLoading(prev => ({ ...prev, transactions: false }));
        }
    };

    const handleClearDB = async () => {
        try {
            setLoading(prev => ({ ...prev, clear: true }));
            const res = await adminAPI.clearDatabase();
            if (res.success) {
                showNotification(res.message, 'success');
            }
        } catch (err) {
            showNotification(err.message || 'Failed to clear database', 'error');
        } finally {
            setLoading(prev => ({ ...prev, clear: false }));
            setShowClearConfirm(false);
        }
    };

    const handleImportFile = async (type, file) => {
        if (!file) return;
        try {
            setLoading(prev => ({ ...prev, restore: true }));
            let res;
            if (type === 'sql') res = await adminAPI.importSQL(file);
            else if (type === 'students') res = await adminAPI.importStudentsCSV(file);
            else if (type === 'transactions') res = await adminAPI.importTransactionsCSV(file);

            if (res.success) {
                showNotification(res.message || 'Import successful!', 'success');
                if (type === 'sql') window.location.reload();
            } else {
                showNotification(res.message, 'warning');
            }
        } catch (err) {
            showNotification(err.message || 'Import failed', 'error');
        } finally {
            setLoading(prev => ({ ...prev, restore: false }));
            if (sqlInputRef.current) sqlInputRef.current.value = '';
            if (studentsInputRef.current) studentsInputRef.current.value = '';
            if (transInputRef.current) transInputRef.current.value = '';
        }
    };

    return (
        <div className="backup-container bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-5">
            <div className="mb-6 flex justify-between items-start">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Database Maintenance & Recovery</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Manage your data through backups, exports, and restoration tools.</p>
                </div>
                <button 
                    onClick={() => setShowClearConfirm(true)}
                    style={{ padding: '10px 16px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', border: '1px solid #fecaca', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    Clear Student Data
                </button>
            </div>

            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4 mb-6 border-l-4 border-blue-600">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                    <strong>Notice:</strong> "Clear Student Data" only removes student profiles, bookings, and schedules. It <strong>won't delete</strong> your course list or branch configurations.
                </p>
            </div>

            <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                Backup & Export (Server to Local)
            </h3>

            {/* Added filters for exports */}
            <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 mb-6 border border-gray-200 dark:border-slate-600 flex gap-4 flex-wrap items-end">
                <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Start Date</label>
                    <input 
                        type="date" 
                        value={exportFilters.startDate} 
                        onChange={e => setExportFilters(prev => ({ ...prev, startDate: e.target.value }))}
                        className="p-2 rounded-md border border-gray-300 dark:border-slate-500 outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">End Date</label>
                    <input 
                        type="date" 
                        value={exportFilters.endDate} 
                        onChange={e => setExportFilters(prev => ({ ...prev, endDate: e.target.value }))}
                        className="p-2 rounded-md border border-gray-300 dark:border-slate-500 outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Branch (Optional)</label>
                    <select 
                        value={exportFilters.branchId} 
                        onChange={e => setExportFilters(prev => ({ ...prev, branchId: e.target.value }))}
                        className="p-2 rounded-md border border-gray-300 dark:border-slate-500 outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    >
                        <option value="">All Branches</option>
                        {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
                <button 
                    onClick={() => setExportFilters({ startDate: '', endDate: '', branchId: '' })}
                    className="px-4 py-2 bg-transparent border border-gray-300 dark:border-slate-500 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-md h-[42px] font-medium transition-colors"
                >
                    Clear Filters
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
                {/* DB Backup Card */}
                <div className="p-6 border border-gray-200 dark:border-slate-600 rounded-xl flex flex-col gap-4 bg-white dark:bg-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="stroke-sky-700 dark:stroke-sky-400" strokeWidth="2">
                                <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z" />
                            </svg>
                        </div>
                        <div>
                            <h3 style={{ fontWeight: '600', color: '#111827' }}>Full Database Snapshot</h3>
                            <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>Download complete .sql file</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleDBBackup} 
                        disabled={loading.db}
                        className="p-2.5 bg-sky-700 hover:bg-sky-800 text-white rounded-lg font-medium transition-colors disabled:opacity-70 cursor-pointer"
                    >
                        {loading.db ? 'Generating...' : 'Download Full SQL Backup'}
                    </button>
                </div>

                {/* Students Export Card */}
                <div className="p-6 border border-gray-200 dark:border-slate-600 rounded-xl flex flex-col gap-4 bg-white dark:bg-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/40 flex items-center justify-center">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="stroke-green-700 dark:stroke-green-400" strokeWidth="2">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="8.5" cy="7" r="4" />
                                <polyline points="17 11 19 13 23 9" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">Student Registry</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Export all student profiles (CSV)</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleExportStudents} 
                        disabled={loading.students}
                        className="p-2.5 bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors disabled:opacity-70 cursor-pointer"
                    >
                        {loading.students ? 'Processing...' : 'Export Students (CSV)'}
                    </button>
                </div>

                {/* Transactions Export Card */}
                <div className="p-6 border border-gray-200 dark:border-slate-600 rounded-xl flex flex-col gap-4 bg-white dark:bg-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/40 flex items-center justify-center">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="stroke-red-700 dark:stroke-red-400" strokeWidth="2">
                                <rect x="2" y="5" width="20" height="14" rx="2" />
                                <line x1="2" y1="10" x2="22" y2="10" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">Financial History</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Export all transactions (CSV)</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleExportTransactions} 
                        disabled={loading.transactions}
                        className="p-2.5 bg-red-700 hover:bg-red-800 text-white rounded-lg font-medium transition-colors disabled:opacity-70 cursor-pointer"
                    >
                        {loading.transactions ? 'Processing...' : 'Export Transactions (CSV)'}
                    </button>
                </div>
            </div>

            <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                Restore & Import (Local to Server)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* SQL Restore */}
                <div className="p-6 border border-gray-200 dark:border-slate-600 rounded-xl flex flex-col gap-4 bg-white dark:bg-slate-800">
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">Restore SQL Backup</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Upload a .sql file to overwrite current database</p>
                    </div>
                    <input 
                        type="file" 
                        ref={sqlInputRef}
                        accept=".sql" 
                        style={{ display: 'none' }} 
                        onChange={(e) => handleImportFile('sql', e.target.files[0])} 
                    />
                    <button 
                        onClick={() => sqlInputRef.current.click()}
                        disabled={loading.restore}
                        className="p-2.5 border border-sky-600 text-sky-600 dark:border-sky-400 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/40 rounded-lg font-medium transition-colors cursor-pointer"
                    >
                        {loading.restore ? 'Uploading...' : 'Upload & Restore SQL'}
                    </button>
                </div>

                {/* Students Import */}
                <div className="p-6 border border-gray-200 dark:border-slate-600 rounded-xl flex flex-col gap-4 bg-white dark:bg-slate-800">
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">Import Students</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Legacy student data import (CSV)</p>
                    </div>
                    <input 
                        type="file" 
                        ref={studentsInputRef}
                        accept=".csv" 
                        style={{ display: 'none' }} 
                        onChange={(e) => handleImportFile('students', e.target.files[0])} 
                    />
                    <button 
                        onClick={() => studentsInputRef.current.click()}
                        disabled={loading.restore}
                        className="p-2.5 border border-green-600 text-green-600 dark:border-green-400 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/40 rounded-lg font-medium transition-colors cursor-pointer"
                    >
                        {loading.restore ? 'Uploading...' : 'Import Students CSV'}
                    </button>
                </div>

                {/* Transactions Import */}
                <div className="p-6 border border-gray-200 dark:border-slate-600 rounded-xl flex flex-col gap-4 bg-white dark:bg-slate-800">
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">Import Transactions</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Import external payment logs (CSV)</p>
                    </div>
                    <input 
                        type="file" 
                        ref={transInputRef}
                        accept=".csv" 
                        style={{ display: 'none' }} 
                        onChange={(e) => handleImportFile('transactions', e.target.files[0])} 
                    />
                    <button 
                        onClick={() => transInputRef.current.click()}
                        disabled={loading.restore}
                        className="p-2.5 border border-red-600 text-red-600 dark:border-red-400 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40 rounded-lg font-medium transition-colors cursor-pointer"
                    >
                        {loading.restore ? 'Uploading...' : 'Import Transactions CSV'}
                    </button>
                </div>
            </div>

            {/* Clear Confirm Modal */}
            <ConfirmModal 
                show={showClearConfirm}
                onClose={() => setShowClearConfirm(false)}
                onConfirm={handleClearDB}
                title="Wipe Student & Booking Data?"
                message="This will permanently delete all student accounts, bookings, and payments. Courses and branch configurations will be kept. This is irreversible!"
                confirmText="Yes, Wipe Data"
                loading={loading.clear}
                danger={true}
            />
        </div>
    );
};

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
            key: 'emailcontent',
            label: 'Email Content',
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
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
        },
        {
            key: 'backup',
            label: 'Backup & Data',
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
            )
        },
    ];

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
                {activeTab === 'backup' && (
                    <BackupSection branches={branches} />
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
                isSystemRole={!!editingRole?.is_system}
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
