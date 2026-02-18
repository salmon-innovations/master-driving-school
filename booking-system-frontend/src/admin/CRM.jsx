import React, { useState, useEffect } from 'react';
import './css/crm.css';
import { crmAPI, coursesAPI, branchesAPI, adminAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';

const CRMManagement = () => {
    const { showNotification } = useNotification();

    // State management
    const [leads, setLeads] = useState([]);
    const [sources, setSources] = useState([]);
    const [statuses, setStatuses] = useState([]);
    const [courses, setCourses] = useState([]);
    const [branches, setBranches] = useState([]);
    const [staffUsers, setStaffUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [interactions, setInteractions] = useState([]);

    // Navigation state
    const [activeTab, setActiveTab] = useState('leads');

    // Filter state
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [sourceFilter, setSourceFilter] = useState('All');
    const [assignedFilter, setAssignedFilter] = useState('All');

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalLeads, setTotalLeads] = useState(0);
    const [pageSize, setPageSize] = useState(10);

    // Modal state
    const [showAddModal, setShowAddModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [showInteractionModal, setShowInteractionModal] = useState(false);
    const [showQuickCaptureModal, setShowQuickCaptureModal] = useState(false);
    const [selectedLead, setSelectedLead] = useState(null);
    const [editingLead, setEditingLead] = useState(null);
    const [showSourceModal, setShowSourceModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [editingSource, setEditingSource] = useState(null);
    const [editingStatus, setEditingStatus] = useState(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState({
        title: '',
        message: '',
        onConfirm: () => { },
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        type: 'danger'
    });

    // Quick capture form data
    const [quickCaptureData, setQuickCaptureData] = useState({
        name: '',
        email: '',
        phone: '',
        source: 'Phone Call',
        notes: ''
    });

    // Stats state
    const [stats, setStats] = useState({
        totalLeads: 0,
        newLeads: 0,
        convertedLeads: 0,
        todayInteractions: 0,
        conversionRate: 0
    });

    // Form data
    const [leadFormData, setLeadFormData] = useState({
        first_name: '',
        middle_name: '',
        last_name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        province: '',
        postal_code: '',
        lead_source_id: '',
        lead_status_id: '',
        assigned_to: '',
        interest_course_id: '',
        interest_branch_id: '',
        priority: 'medium',
        notes: ''
    });

    const [interactionFormData, setInteractionFormData] = useState({
        interaction_type: 'call',
        subject: '',
        notes: '',
        outcome: '',
        requires_followup: false,
        followup_date: ''
    });

    const [sourceFormData, setSourceFormData] = useState({
        name: '',
        is_active: true
    });

    const [statusFormData, setStatusFormData] = useState({
        name: '',
        color: '#2563eb',
        sort_order: 0,
        is_active: true
    });

    // Fetch initial data
    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            // Fetch core data needed for the table first
            const [leadsRes, sourcesRes, statusesRes, usersRes] = await Promise.all([
                crmAPI.getAllLeads({ limit: pageSize, offset: (currentPage - 1) * pageSize }),
                crmAPI.getLeadSources(),
                crmAPI.getLeadStatuses(),
                adminAPI.getAllUsers('staff', 100)
            ]);

            if (leadsRes.success) {
                setLeads(leadsRes.leads);
                setTotalLeads(leadsRes.total || 0);
            }
            if (sourcesRes.success) setSources(sourcesRes.sources);
            if (statusesRes.success) setStatuses(statusesRes.statuses);
            if (usersRes.users) {
                // Filter for staff, admin, and hrm roles
                const staffList = usersRes.users.filter(u =>
                    ['admin', 'hrm', 'staff'].includes(u.role)
                );
                setStaffUsers(staffList);
            }

            setLoading(false); // Show the table as soon as core data is ready

            // Fetch secondary data in the background
            Promise.all([
                coursesAPI.getAll(),
                branchesAPI.getAll(),
                crmAPI.getStats(),
                crmAPI.getAllInteractions({ limit: 20 })
            ]).then(([coursesRes, branchesRes, statsRes, interactionsRes]) => {
                if (coursesRes.success) setCourses(coursesRes.courses);
                if (branchesRes.success) setBranches(branchesRes.branches);
                if (statsRes.success) setStats(statsRes.stats);
                if (interactionsRes.success) setInteractions(interactionsRes.interactions);
            }).catch(err => console.error('Error fetching secondary CRM data:', err));

        } catch (error) {
            console.error('Error fetching CRM data:', error);
            showNotification('Failed to load CRM data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchLeads = async () => {
        try {
            const filters = {
                limit: pageSize,
                offset: (currentPage - 1) * pageSize,
                search: searchTerm || undefined,
                status: statusFilter !== 'All' ? statusFilter : undefined,
                source: sourceFilter !== 'All' ? sourceFilter : undefined,
                assigned_to: assignedFilter !== 'All' ? assignedFilter : undefined
            };

            const response = await crmAPI.getAllLeads(filters);
            if (response.success) {
                setLeads(response.leads);
                setTotalLeads(response.total || 0);
            }
        } catch (error) {
            console.error('Error fetching leads:', error);
            showNotification('Failed to refresh leads', 'error');
        }
    };


    // Apply filters when they change
    useEffect(() => {
        if (!loading) {
            setCurrentPage(1); // Reset to first page on filter change
            fetchLeads();
        }
    }, [statusFilter, sourceFilter, assignedFilter, searchTerm, pageSize]);

    // Apply pagination when page changes
    useEffect(() => {
        if (!loading) {
            fetchLeads();
        }
    }, [currentPage]);

    const totalPages = Math.ceil(totalLeads / pageSize);


    const handleAddLead = () => {
        setEditingLead(null);
        setLeadFormData({
            first_name: '',
            middle_name: '',
            last_name: '',
            email: '',
            phone: '',
            address: '',
            city: '',
            province: '',
            postal_code: '',
            lead_source_id: '',
            lead_status_id: statuses.find(s => s.name === 'New')?.id || '',
            assigned_to: '',
            interest_course_id: '',
            interest_branch_id: '',
            priority: 'medium',
            notes: ''
        });
        setShowAddModal(true);
    };

    const handleEditLead = (lead) => {
        setEditingLead(lead);
        setLeadFormData({
            first_name: lead.first_name,
            middle_name: lead.middle_name || '',
            last_name: lead.last_name,
            email: lead.email || '',
            phone: lead.phone || '',
            address: lead.address || '',
            city: lead.city || '',
            province: lead.province || '',
            postal_code: lead.postal_code || '',
            lead_source_id: lead.lead_source_id || '',
            lead_status_id: lead.lead_status_id || '',
            assigned_to: lead.assigned_to || '',
            interest_course_id: lead.interest_course_id || '',
            interest_branch_id: lead.interest_branch_id || '',
            priority: lead.priority || 'medium',
            notes: lead.notes || ''
        });
        setShowAddModal(true);
    };

    const handleViewLead = async (lead) => {
        try {
            const response = await crmAPI.getLeadById(lead.id);
            if (response.success) {
                setSelectedLead(response.lead);
                setShowViewModal(true);
            }
        } catch (error) {
            console.error('Error fetching lead details:', error);
            showNotification('Failed to load lead details', 'error');
        }
    };

    const handleDeleteLead = (leadId) => {
        setConfirmConfig({
            title: 'Delete Lead',
            message: 'Are you sure you want to delete this lead? This action cannot be undone.',
            confirmText: 'Delete Lead',
            cancelText: 'Cancel',
            type: 'danger',
            onConfirm: async () => {
                setConfirmLoading(true);
                try {
                    const response = await crmAPI.deleteLead(leadId);
                    if (response.success) {
                        showNotification('Lead deleted successfully', 'success');
                        fetchLeads();
                        fetchStats();
                        setShowConfirmModal(false);
                    }
                } catch (error) {
                    console.error('Error deleting lead:', error);
                    showNotification('Failed to delete lead', 'error');
                } finally {
                    setConfirmLoading(false);
                }
            }
        });
        setShowConfirmModal(true);
    };

    const handleSubmitLead = async (e) => {
        e.preventDefault();

        try {
            if (editingLead) {
                const response = await crmAPI.updateLead(editingLead.id, leadFormData);
                if (response.success) {
                    showNotification('Lead updated successfully', 'success');
                    setShowAddModal(false);
                    fetchLeads();
                }
            } else {
                const response = await crmAPI.createLead(leadFormData);
                if (response.success) {
                    showNotification('Lead created successfully', 'success');
                    setShowAddModal(false);
                    fetchLeads();
                    fetchStats();
                }
            }
        } catch (error) {
            console.error('Error saving lead:', error);
            showNotification(error.response?.data?.error || 'Failed to save lead', 'error');
        }
    };

    const handleAddInteraction = (lead) => {
        setSelectedLead(lead);
        setInteractionFormData({
            interaction_type: 'call',
            subject: '',
            notes: '',
            outcome: '',
            requires_followup: false,
            followup_date: ''
        });
        setShowInteractionModal(true);
    };

    const handleSubmitInteraction = async (e) => {
        e.preventDefault();

        try {
            const response = await crmAPI.addInteraction(selectedLead.id, interactionFormData);
            if (response.success) {
                showNotification('Interaction logged successfully', 'success');
                setShowInteractionModal(false);
                fetchLeads();
                fetchStats();

                // Refresh global interactions feed
                crmAPI.getAllInteractions({ limit: 20 }).then(res => {
                    if (res.success) setInteractions(res.interactions);
                });

                // If viewing lead details, refresh it
                if (showViewModal) {
                    handleViewLead(selectedLead);
                }
            }
        } catch (error) {
            console.error('Error adding interaction:', error);
            showNotification('Failed to log interaction', 'error');
        }
    };

    const fetchStats = async () => {
        try {
            const response = await crmAPI.getStats();
            if (response.success) {
                setStats(response.stats);
            }
        } catch (error) {
            console.error('Error fetching CRM stats:', error);
        }
    };

    // Configuration Handlers
    const handleAddSource = () => {
        setEditingSource(null);
        setSourceFormData({ name: '', is_active: true });
        setShowSourceModal(true);
    };

    const handleEditSource = (source) => {
        setEditingSource(source);
        setSourceFormData({ name: source.name, is_active: source.is_active });
        setShowSourceModal(true);
    };

    const handleSubmitSource = async (e) => {
        e.preventDefault();
        try {
            let response;
            if (editingSource) {
                response = await crmAPI.updateLeadSource(editingSource.id, sourceFormData);
            } else {
                response = await crmAPI.createLeadSource(sourceFormData);
            }

            if (response.success) {
                showNotification(`Source ${editingSource ? 'updated' : 'added'} successfully`, 'success');
                setShowSourceModal(false);
                const sourcesRes = await crmAPI.getLeadSources();
                if (sourcesRes.success) setSources(sourcesRes.sources);
            }
        } catch (error) {
            showNotification('Failed to save source', 'error');
        }
    };

    const handleAddStatus = () => {
        setEditingStatus(null);
        setStatusFormData({ name: '', color: '#2563eb', sort_order: statuses.length, is_active: true });
        setShowStatusModal(true);
    };

    const handleEditStatus = (status) => {
        setEditingStatus(status);
        setStatusFormData({
            name: status.name,
            color: status.color,
            sort_order: status.sort_order,
            is_active: status.is_active
        });
        setShowStatusModal(true);
    };

    const handleSubmitStatus = async (e) => {
        e.preventDefault();
        try {
            let response;
            if (editingStatus) {
                response = await crmAPI.updateLeadStatus(editingStatus.id, statusFormData);
            } else {
                response = await crmAPI.createLeadStatus(statusFormData);
            }

            if (response.success) {
                showNotification(`Status ${editingStatus ? 'updated' : 'added'} successfully`, 'success');
                setShowStatusModal(false);
                const statusesRes = await crmAPI.getLeadStatuses();
                if (statusesRes.success) setStatuses(statusesRes.statuses);
            }
        } catch (error) {
            showNotification('Failed to save status', 'error');
        }
    };

    const handleDeleteSource = (id) => {
        setConfirmConfig({
            title: 'Delete Source',
            message: 'Are you sure you want to delete this lead source? This action cannot be undone if the source is not in use.',
            confirmText: 'Delete Source',
            cancelText: 'Cancel',
            type: 'danger',
            onConfirm: async () => {
                setConfirmLoading(true);
                try {
                    const response = await crmAPI.deleteLeadSource(id);
                    if (response.success) {
                        showNotification('Source deleted successfully', 'success');
                        const sourcesRes = await crmAPI.getLeadSources();
                        if (sourcesRes.success) setSources(sourcesRes.sources);
                        setShowConfirmModal(false);
                    }
                } catch (error) {
                    showNotification(error.message || 'Failed to delete source', 'error');
                } finally {
                    setConfirmLoading(false);
                }
            }
        });
        setShowConfirmModal(true);
    };

    const handleDeleteStatus = (id) => {
        setConfirmConfig({
            title: 'Delete Status',
            message: 'Are you sure you want to delete this lead status? This action cannot be undone if the status is not in use.',
            confirmText: 'Delete Status',
            cancelText: 'Cancel',
            type: 'danger',
            onConfirm: async () => {
                setConfirmLoading(true);
                try {
                    const response = await crmAPI.deleteLeadStatus(id);
                    if (response.success) {
                        showNotification('Status deleted successfully', 'success');
                        const statusesRes = await crmAPI.getLeadStatuses();
                        if (statusesRes.success) setStatuses(statusesRes.statuses);
                        setShowConfirmModal(false);
                    }
                } catch (error) {
                    showNotification(error.message || 'Failed to delete status', 'error');
                } finally {
                    setConfirmLoading(false);
                }
            }
        });
        setShowConfirmModal(true);
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'urgent': return '#EF4444';
            case 'high': return '#F59E0B';
            case 'medium': return '#3B82F6';
            case 'low': return '#6B7280';
            default: return '#6B7280';
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="crm-container">
                <div className="loading-spinner">Loading CRM data...</div>
            </div>
        );
    }

    return (
        <div className="crm-container">
            {/* Header */}
            <div className="crm-header">
                <div className="header-left">
                    <h1>CRM Management</h1>
                    <p>Manage leads and customer relationships</p>
                </div>
                <div className="header-actions">
                    <button className="btn-quick-capture" onClick={() => setShowQuickCaptureModal(true)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Quick Capture
                    </button>
                    <button className="btn-add-lead" onClick={handleAddLead}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Add New Lead
                    </button>
                </div>
            </div>

            {/* Sub Navigation Tabs */}
            <div className="crm-tabs">
                <button
                    className={`crm-tab ${activeTab === 'leads' ? 'active' : ''}`}
                    onClick={() => setActiveTab('leads')}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    Leads Table
                </button>
                <button
                    className={`crm-tab ${activeTab === 'interactions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('interactions')}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    Recent Interactions
                </button>
                <button
                    className={`crm-tab ${activeTab === 'reports' ? 'active' : ''}`}
                    onClick={() => setActiveTab('reports')}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="20" x2="18" y2="10"></line>
                        <line x1="12" y1="20" x2="12" y2="4"></line>
                        <line x1="6" y1="20" x2="6" y2="14"></line>
                    </svg>
                    Performance
                </button>
                <button
                    className={`crm-tab ${activeTab === 'settings' ? 'active' : ''}`}
                    onClick={() => setActiveTab('settings')}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                    CRM Config
                </button>
            </div>



            {activeTab === 'leads' && (
                <>
                    {/* Stats Cards */}
                    <div className="crm-stats-grid">
                        {/* ... stats ... */}
                        <div className="stat-card">
                            <div className="stat-icon" style={{ backgroundColor: '#EEF2FF' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="9" cy="7" r="4"></circle>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                </svg>
                            </div>
                            <div className="stat-info">
                                <h3>{stats.totalLeads}</h3>
                                <p>Total Leads</p>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon" style={{ backgroundColor: '#F0FDF4' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="8.5" cy="7" r="4"></circle>
                                    <line x1="20" y1="8" x2="20" y2="14"></line>
                                    <line x1="17" y1="11" x2="23" y2="11"></line>
                                </svg>
                            </div>
                            <div className="stat-info">
                                <h3>{stats.newLeads}</h3>
                                <p>New This Month</p>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon" style={{ backgroundColor: '#FEF3C7' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                                </svg>
                            </div>
                            <div className="stat-info">
                                <h3>{stats.convertedLeads}</h3>
                                <p>Converted</p>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon" style={{ backgroundColor: '#FEE2E2' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                            </div>
                            <div className="stat-info">
                                <h3>{stats.conversionRate}%</h3>
                                <p>Conversion Rate</p>
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="crm-filters">
                        <div className="search-box">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8"></circle>
                                <path d="m21 21-4.35-4.35"></path>
                            </svg>
                            <input
                                type="text"
                                placeholder="Search leads..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="All">All Status</option>
                            {statuses.map(status => (
                                <option key={status.id} value={status.id}>{status.name}</option>
                            ))}
                        </select>

                        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                            <option value="All">All Sources</option>
                            {sources.map(source => (
                                <option key={source.id} value={source.id}>{source.name}</option>
                            ))}
                        </select>

                        <select value={assignedFilter} onChange={(e) => setAssignedFilter(e.target.value)}>
                            <option value="All">All Assigned</option>
                            {staffUsers.map(user => (
                                <option key={user.id} value={user.id}>
                                    {user.first_name} {user.last_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Leads Table */}
                    <div className="crm-table-container">
                        <table className="crm-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Contact</th>
                                    <th>Source</th>
                                    <th>Status</th>
                                    <th>Assigned To</th>
                                    <th>Priority</th>
                                    <th>Interest</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leads.length === 0 ? (
                                    <tr>
                                        <td colSpan="9" className="no-data">
                                            No leads found. Add your first lead to get started!
                                        </td>
                                    </tr>
                                ) : (
                                    leads.map(lead => (
                                        <tr key={lead.id}>
                                            <td>
                                                <div className="lead-name">
                                                    {lead.first_name} {lead.last_name}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="contact-info">
                                                    <div>{lead.email || 'No email'}</div>
                                                    <div className="phone">{lead.phone || 'No phone'}</div>
                                                </div>
                                            </td>
                                            <td>{lead.source_name || 'N/A'}</td>
                                            <td>
                                                <span
                                                    className="status-badge"
                                                    style={{
                                                        backgroundColor: lead.status_color + '20',
                                                        color: lead.status_color
                                                    }}
                                                >
                                                    {lead.status_name || 'N/A'}
                                                </span>
                                            </td>
                                            <td>{lead.assigned_to_name || 'Unassigned'}</td>
                                            <td>
                                                <span
                                                    className="priority-badge"
                                                    style={{
                                                        backgroundColor: getPriorityColor(lead.priority) + '20',
                                                        color: getPriorityColor(lead.priority)
                                                    }}
                                                >
                                                    {lead.priority?.charAt(0).toUpperCase() + lead.priority?.slice(1) || 'Medium'}
                                                </span>
                                            </td>
                                            <td>{lead.interest_course_name || 'Not specified'}</td>
                                            <td>{formatDate(lead.created_at)}</td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button
                                                        className="btn-icon btn-view"
                                                        onClick={() => handleViewLead(lead)}
                                                        title="View Details"
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                                            <circle cx="12" cy="12" r="3"></circle>
                                                        </svg>
                                                    </button>
                                                    <button
                                                        className="btn-icon btn-edit"
                                                        onClick={() => handleEditLead(lead)}
                                                        title="Edit Lead"
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                        </svg>
                                                    </button>
                                                    <button
                                                        className="btn-icon btn-interact"
                                                        onClick={() => handleAddInteraction(lead)}
                                                        title="Log Interaction"
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                                        </svg>
                                                    </button>
                                                    <button
                                                        className="btn-icon btn-delete"
                                                        onClick={() => handleDeleteLead(lead.id)}
                                                        title="Delete Lead"
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <polyline points="3 6 5 6 21 6"></polyline>
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="crm-pagination">
                                <div className="pagination-info">
                                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalLeads)} of {totalLeads} leads
                                </div>
                                <div className="pagination-actions">
                                    <button
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(currentPage - 1)}
                                        className="btn-pagination"
                                    >
                                        Previous
                                    </button>
                                    {[...Array(totalPages)].map((_, i) => (
                                        <button
                                            key={i + 1}
                                            onClick={() => setCurrentPage(i + 1)}
                                            className={`btn-pagination ${currentPage === i + 1 ? 'active' : ''}`}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                    <button
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(currentPage + 1)}
                                        className="btn-pagination"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {
                activeTab === 'interactions' && (
                    <div className="crm-interactions-tab">
                        <div className="tab-header">
                            <h2>Recent Interactions</h2>
                            <p>Latest activities across all leads</p>
                        </div>
                        <div className="interactions-list">
                            {interactions.length === 0 ? (
                                <div className="no-interactions">No recent interactions found.</div>
                            ) : (
                                interactions.map(interaction => (
                                    <div key={interaction.id} className="interaction-feed-item">
                                        <div className="interaction-icon" style={{ backgroundColor: getPriorityColor(interaction.interaction_type) + '20' }}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={getPriorityColor(interaction.interaction_type)} strokeWidth="2">
                                                {interaction.interaction_type === 'call' && <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>}
                                                {interaction.interaction_type === 'email' && <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>}
                                                {interaction.interaction_type === 'meeting' && <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>}
                                            </svg>
                                        </div>
                                        <div className="interaction-content">
                                            <div className="interaction-header">
                                                <strong>{interaction.lead_name}</strong>
                                                <span className="interaction-date">{formatDateTime(interaction.created_at)}</span>
                                            </div>
                                            <div className="interaction-subject">{interaction.subject}</div>
                                            <p className="interaction-notes">{interaction.notes}</p>
                                            <div className="interaction-meta">
                                                <span>Logged by: {interaction.user_name}</span>
                                                {interaction.outcome && <span className="outcome-tag">{interaction.outcome}</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )
            }

            {
                activeTab === 'reports' && (
                    <div className="crm-reports-tab">
                        <div className="tab-header">
                            <h2>Performance Reports</h2>
                            <p>Track your lead conversion and team performance</p>
                        </div>
                        <div className="reports-grid">
                            <div className="report-card">
                                <h3>Conversion Rate</h3>
                                <div className="conversion-gauge">
                                    <div className="gauge-value">{stats.conversionRate}%</div>
                                    <div className="gauge-label">Monthly Conversion</div>
                                </div>
                            </div>
                            <div className="report-card">
                                <h3>Leads by Source</h3>
                                <div className="source-list">
                                    {sources.slice(0, 5).map(source => (
                                        <div key={source.id} className="source-item">
                                            <span>{source.name}</span>
                                            <div className="source-bar-bg">
                                                <div className="source-bar-fill" style={{ width: '45%' }}></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                activeTab === 'settings' && (
                    <div className="crm-settings-tab">
                        <div className="tab-header">
                            <h2>CRM Configuration</h2>
                            <p>Manage lead sources, statuses, and system settings</p>
                        </div>
                        <div className="settings-grid">
                            <div className="settings-card">
                                <h3>Lead Sources</h3>
                                <div className="config-list">
                                    {sources.map(source => (
                                        <div key={source.id} className="config-item">
                                            <span className={source.is_active ? '' : 'inactive'}>{source.name}</span>
                                            <div className="config-actions">
                                                <button className="btn-icon" onClick={() => handleEditSource(source)} title="Edit">
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                    </svg>
                                                </button>
                                                <button className="btn-icon btn-delete" onClick={() => handleDeleteSource(source.id)} title="Delete">
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <polyline points="3 6 5 6 21 6"></polyline>
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                        <line x1="10" y1="11" x2="10" y2="17"></line>
                                                        <line x1="14" y1="11" x2="14" y2="17"></line>
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <button className="btn-add-config" onClick={handleAddSource}>+ Add New Source</button>
                                </div>
                            </div>
                            <div className="settings-card">
                                <h3>Lead Statuses</h3>
                                <div className="config-list">
                                    {statuses.map(status => (
                                        <div key={status.id} className="config-item">
                                            <div className="status-preview">
                                                <span className="color-dot" style={{ backgroundColor: status.color }}></span>
                                                <span className={status.is_active ? '' : 'inactive'}>{status.name}</span>
                                            </div>
                                            <div className="config-actions">
                                                <button className="btn-icon" onClick={() => handleEditStatus(status)} title="Edit">
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                    </svg>
                                                </button>
                                                <button className="btn-icon btn-delete" onClick={() => handleDeleteStatus(status.id)} title="Delete">
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <polyline points="3 6 5 6 21 6"></polyline>
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                        <line x1="10" y1="11" x2="10" y2="17"></line>
                                                        <line x1="14" y1="11" x2="14" y2="17"></line>
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <button className="btn-add-config" onClick={handleAddStatus}>+ Add New Status</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }


            {/* Lead Source Modal */}
            {showSourceModal && (
                <div className="modal-overlay" onClick={() => setShowSourceModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingSource ? 'Edit Lead Source' : 'Add Lead Source'}</h2>
                            <button className="close-btn" onClick={() => setShowSourceModal(false)}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleSubmitSource}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Source Name</label>
                                    <input
                                        type="text"
                                        value={sourceFormData.name}
                                        onChange={(e) => setSourceFormData({ ...sourceFormData, name: e.target.value })}
                                        required
                                        placeholder="e.g., Google Ads, Radio, Walk-in"
                                    />
                                </div>
                                <div className="form-group" style={{ marginTop: '1rem' }}>
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={sourceFormData.is_active}
                                            onChange={(e) => setSourceFormData({ ...sourceFormData, is_active: e.target.checked })}
                                        />
                                        Is Active
                                    </label>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-cancel" onClick={() => setShowSourceModal(false)}>Cancel</button>
                                <button type="submit" className="btn-submit">{editingSource ? 'Update' : 'Add'} Source</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Lead Status Modal */}
            {showStatusModal && (
                <div className="modal-overlay" onClick={() => setShowStatusModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingStatus ? 'Edit Lead Status' : 'Add Lead Status'}</h2>
                            <button className="close-btn" onClick={() => setShowStatusModal(false)}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleSubmitStatus}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Status Name</label>
                                    <input
                                        type="text"
                                        value={statusFormData.name}
                                        onChange={(e) => setStatusFormData({ ...statusFormData, name: e.target.value })}
                                        required
                                        placeholder="e.g., New, Contacted, Qualified"
                                    />
                                </div>
                                <div className="form-grid" style={{ marginTop: '1rem' }}>
                                    <div className="form-group">
                                        <label>Color</label>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <input
                                                type="color"
                                                value={statusFormData.color}
                                                onChange={(e) => setStatusFormData({ ...statusFormData, color: e.target.value })}
                                                style={{ width: '50px', padding: '2px', height: '38px' }}
                                            />
                                            <input
                                                type="text"
                                                value={statusFormData.color}
                                                onChange={(e) => setStatusFormData({ ...statusFormData, color: e.target.value })}
                                                placeholder="#HEXCODE"
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Sort Order</label>
                                        <input
                                            type="number"
                                            value={statusFormData.sort_order}
                                            onChange={(e) => setStatusFormData({ ...statusFormData, sort_order: parseInt(e.target.value) })}
                                        />
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginTop: '1rem' }}>
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={statusFormData.is_active}
                                            onChange={(e) => setStatusFormData({ ...statusFormData, is_active: e.target.checked })}
                                        />
                                        Is Active
                                    </label>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-cancel" onClick={() => setShowStatusModal(false)}>Cancel</button>
                                <button type="submit" className="btn-submit">{editingStatus ? 'Update' : 'Add'} Status</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add/Edit Lead Modal */}
            {
                showAddModal && (
                    <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>{editingLead ? 'Edit Lead' : 'Add New Lead'}</h2>
                                <button className="close-btn" onClick={() => setShowAddModal(false)}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>

                            <form onSubmit={handleSubmitLead}>
                                <div className="modal-body">
                                    <div className="form-section">
                                        <h3>Personal Information</h3>
                                        <div className="form-grid">
                                            <div className="form-group">
                                                <label>First Name *</label>
                                                <input
                                                    type="text"
                                                    value={leadFormData.first_name}
                                                    onChange={(e) => setLeadFormData({ ...leadFormData, first_name: e.target.value })}
                                                    required
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Middle Name</label>
                                                <input
                                                    type="text"
                                                    value={leadFormData.middle_name}
                                                    onChange={(e) => setLeadFormData({ ...leadFormData, middle_name: e.target.value })}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Last Name *</label>
                                                <input
                                                    type="text"
                                                    value={leadFormData.last_name}
                                                    onChange={(e) => setLeadFormData({ ...leadFormData, last_name: e.target.value })}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="form-grid">
                                            <div className="form-group">
                                                <label>Email</label>
                                                <input
                                                    type="email"
                                                    value={leadFormData.email}
                                                    onChange={(e) => setLeadFormData({ ...leadFormData, email: e.target.value })}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Phone</label>
                                                <input
                                                    type="tel"
                                                    value={leadFormData.phone}
                                                    onChange={(e) => setLeadFormData({ ...leadFormData, phone: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        <div className="form-group">
                                            <label>Address</label>
                                            <input
                                                type="text"
                                                value={leadFormData.address}
                                                onChange={(e) => setLeadFormData({ ...leadFormData, address: e.target.value })}
                                            />
                                        </div>

                                        <div className="form-grid">
                                            <div className="form-group">
                                                <label>City</label>
                                                <input
                                                    type="text"
                                                    value={leadFormData.city}
                                                    onChange={(e) => setLeadFormData({ ...leadFormData, city: e.target.value })}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Province</label>
                                                <input
                                                    type="text"
                                                    value={leadFormData.province}
                                                    onChange={(e) => setLeadFormData({ ...leadFormData, province: e.target.value })}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Postal Code</label>
                                                <input
                                                    type="text"
                                                    value={leadFormData.postal_code}
                                                    onChange={(e) => setLeadFormData({ ...leadFormData, postal_code: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="form-section">
                                        <h3>Lead Information</h3>
                                        <div className="form-grid">
                                            <div className="form-group">
                                                <label>Lead Source</label>
                                                <select
                                                    value={leadFormData.lead_source_id}
                                                    onChange={(e) => setLeadFormData({ ...leadFormData, lead_source_id: e.target.value })}
                                                >
                                                    <option value="">Select Source</option>
                                                    {sources.map(source => (
                                                        <option key={source.id} value={source.id}>{source.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label>Status</label>
                                                <select
                                                    value={leadFormData.lead_status_id}
                                                    onChange={(e) => setLeadFormData({ ...leadFormData, lead_status_id: e.target.value })}
                                                >
                                                    <option value="">Select Status</option>
                                                    {statuses.map(status => (
                                                        <option key={status.id} value={status.id}>{status.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label>Priority</label>
                                                <select
                                                    value={leadFormData.priority}
                                                    onChange={(e) => setLeadFormData({ ...leadFormData, priority: e.target.value })}
                                                >
                                                    <option value="low">Low</option>
                                                    <option value="medium">Medium</option>
                                                    <option value="high">High</option>
                                                    <option value="urgent">Urgent</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="form-grid">
                                            <div className="form-group">
                                                <label>Assigned To</label>
                                                <select
                                                    value={leadFormData.assigned_to}
                                                    onChange={(e) => setLeadFormData({ ...leadFormData, assigned_to: e.target.value })}
                                                >
                                                    <option value="">Not Assigned</option>
                                                    {staffUsers.map(user => (
                                                        <option key={user.id} value={user.id}>
                                                            {user.first_name} {user.last_name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label>Interest Course</label>
                                                <select
                                                    value={leadFormData.interest_course_id}
                                                    onChange={(e) => setLeadFormData({ ...leadFormData, interest_course_id: e.target.value })}
                                                >
                                                    <option value="">Select Course</option>
                                                    {courses.map(course => (
                                                        <option key={course.id} value={course.id}>{course.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label>Preferred Branch</label>
                                                <select
                                                    value={leadFormData.interest_branch_id}
                                                    onChange={(e) => setLeadFormData({ ...leadFormData, interest_branch_id: e.target.value })}
                                                >
                                                    <option value="">Select Branch</option>
                                                    {branches.map(branch => (
                                                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="form-group">
                                            <label>Notes</label>
                                            <textarea
                                                value={leadFormData.notes}
                                                onChange={(e) => setLeadFormData({ ...leadFormData, notes: e.target.value })}
                                                rows="4"
                                                placeholder="Add any additional notes about this lead..."
                                            ></textarea>
                                        </div>
                                    </div>
                                </div>

                                <div className="modal-footer">
                                    <button type="button" className="btn-cancel" onClick={() => setShowAddModal(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn-submit">
                                        {editingLead ? 'Update Lead' : 'Create Lead'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* View Lead Modal */}
            {
                showViewModal && selectedLead && (
                    <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
                        <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>Lead Details</h2>
                                <button className="close-btn" onClick={() => setShowViewModal(false)}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>

                            <div className="modal-body">
                                <div className="lead-details-grid">
                                    <div className="details-section">
                                        <h3>Contact Information</h3>
                                        <div className="detail-item">
                                            <label>Name:</label>
                                            <span>{selectedLead.first_name} {selectedLead.middle_name} {selectedLead.last_name}</span>
                                        </div>
                                        <div className="detail-item">
                                            <label>Email:</label>
                                            <span>{selectedLead.email || 'N/A'}</span>
                                        </div>
                                        <div className="detail-item">
                                            <label>Phone:</label>
                                            <span>{selectedLead.phone || 'N/A'}</span>
                                        </div>
                                        <div className="detail-item">
                                            <label>Address:</label>
                                            <span>{selectedLead.address || 'N/A'}</span>
                                        </div>
                                        <div className="detail-item">
                                            <label>City/Province:</label>
                                            <span>{[selectedLead.city, selectedLead.province].filter(Boolean).join(', ') || 'N/A'}</span>
                                        </div>
                                    </div>

                                    <div className="details-section">
                                        <h3>Lead Information</h3>
                                        <div className="detail-item">
                                            <label>Source:</label>
                                            <span>{selectedLead.source_name || 'N/A'}</span>
                                        </div>
                                        <div className="detail-item">
                                            <label>Status:</label>
                                            <span
                                                className="status-badge"
                                                style={{
                                                    backgroundColor: selectedLead.status_color + '20',
                                                    color: selectedLead.status_color
                                                }}
                                            >
                                                {selectedLead.status_name}
                                            </span>
                                        </div>
                                        <div className="detail-item">
                                            <label>Priority:</label>
                                            <span
                                                className="priority-badge"
                                                style={{
                                                    backgroundColor: getPriorityColor(selectedLead.priority) + '20',
                                                    color: getPriorityColor(selectedLead.priority)
                                                }}
                                            >
                                                {selectedLead.priority?.charAt(0).toUpperCase() + selectedLead.priority?.slice(1)}
                                            </span>
                                        </div>
                                        <div className="detail-item">
                                            <label>Assigned To:</label>
                                            <span>{selectedLead.assigned_to_name || 'Unassigned'}</span>
                                        </div>
                                        <div className="detail-item">
                                            <label>Interest Course:</label>
                                            <span>{selectedLead.interest_course_name || 'Not specified'}</span>
                                        </div>
                                        <div className="detail-item">
                                            <label>Preferred Branch:</label>
                                            <span>{selectedLead.interest_branch_name || 'Not specified'}</span>
                                        </div>
                                        <div className="detail-item">
                                            <label>Created:</label>
                                            <span>{formatDateTime(selectedLead.created_at)}</span>
                                        </div>
                                        <div className="detail-item">
                                            <label>Last Contacted:</label>
                                            <span>{formatDateTime(selectedLead.last_contacted_at)}</span>
                                        </div>
                                    </div>
                                </div>

                                {selectedLead.notes && (
                                    <div className="details-section">
                                        <h3>Notes</h3>
                                        <p className="lead-notes">{selectedLead.notes}</p>
                                    </div>
                                )}

                                <div className="details-section">
                                    <h3>Interaction History</h3>
                                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                                        <button
                                            className="btn-add-interaction"
                                            onClick={() => {
                                                setShowViewModal(false);
                                                handleAddInteraction(selectedLead);
                                            }}
                                            style={{ flex: 1 }}
                                        >
                                            + Log Interaction
                                        </button>
                                        {!selectedLead.is_converted && (
                                            <button
                                                className="btn-convert-lead"
                                                onClick={() => {
                                                    setConfirmConfig({
                                                        title: 'Convert Lead',
                                                        message: `Are you sure you want to convert "${selectedLead.first_name} ${selectedLead.last_name}" to a student?`,
                                                        confirmText: 'Convert Now',
                                                        cancelText: 'Not Now',
                                                        type: 'success',
                                                        onConfirm: async () => {
                                                            setConfirmLoading(true);
                                                            try {
                                                                const response = await crmAPI.convertLead(selectedLead.id, 1);
                                                                if (response.success) {
                                                                    showNotification('Lead converted successfully!', 'success');
                                                                    handleViewLead(selectedLead); // Refresh details
                                                                    fetchLeads();
                                                                    fetchStats();
                                                                    setShowConfirmModal(false);
                                                                }
                                                            } catch (error) {
                                                                showNotification('Conversion failed', 'error');
                                                            } finally {
                                                                setConfirmLoading(false);
                                                            }
                                                        }
                                                    });
                                                    setShowConfirmModal(true);
                                                }}
                                                style={{
                                                    flex: 1,
                                                    backgroundColor: '#10B981',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '0.375rem',
                                                    padding: '0.75rem',
                                                    fontWeight: '600',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Convert to Student
                                            </button>
                                        )}
                                    </div>

                                    {selectedLead.interactions && selectedLead.interactions.length > 0 ? (
                                        <div className="interactions-list">
                                            {selectedLead.interactions.map(interaction => (
                                                <div key={interaction.id} className="interaction-card">
                                                    <div className="interaction-header">
                                                        <span className="interaction-type">{interaction.interaction_type}</span>
                                                        <span className="interaction-date">{formatDateTime(interaction.created_at)}</span>
                                                    </div>
                                                    <div className="interaction-body">
                                                        {interaction.subject && <h4>{interaction.subject}</h4>}
                                                        {interaction.notes && <p>{interaction.notes}</p>}
                                                        {interaction.outcome && (
                                                            <div className="interaction-outcome">
                                                                Outcome: <strong>{interaction.outcome}</strong>
                                                            </div>
                                                        )}
                                                        <div className="interaction-footer">
                                                            <span>By: {interaction.user_name}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="no-interactions">No interactions logged yet.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Add Interaction Modal */}
            {
                showInteractionModal && selectedLead && (
                    <div className="modal-overlay" onClick={() => setShowInteractionModal(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>Log Interaction</h2>
                                <button className="close-btn" onClick={() => setShowInteractionModal(false)}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>

                            <form onSubmit={handleSubmitInteraction}>
                                <div className="modal-body">
                                    <p className="interaction-lead-name">
                                        Lead: <strong>{selectedLead.first_name} {selectedLead.last_name}</strong>
                                    </p>

                                    <div className="form-group">
                                        <label>Interaction Type *</label>
                                        <select
                                            value={interactionFormData.interaction_type}
                                            onChange={(e) => setInteractionFormData({ ...interactionFormData, interaction_type: e.target.value })}
                                            required
                                        >
                                            <option value="call">Phone Call</option>
                                            <option value="email">Email</option>
                                            <option value="meeting">Meeting</option>
                                            <option value="whatsapp">WhatsApp</option>
                                            <option value="sms">SMS</option>
                                            <option value="visit">Branch Visit</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label>Subject</label>
                                        <input
                                            type="text"
                                            value={interactionFormData.subject}
                                            onChange={(e) => setInteractionFormData({ ...interactionFormData, subject: e.target.value })}
                                            placeholder="Brief subject of interaction"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Notes *</label>
                                        <textarea
                                            value={interactionFormData.notes}
                                            onChange={(e) => setInteractionFormData({ ...interactionFormData, notes: e.target.value })}
                                            rows="5"
                                            placeholder="Describe what was discussed, next steps, etc..."
                                            required
                                        ></textarea>
                                    </div>

                                    <div className="form-group">
                                        <label>Outcome</label>
                                        <input
                                            type="text"
                                            value={interactionFormData.outcome}
                                            onChange={(e) => setInteractionFormData({ ...interactionFormData, outcome: e.target.value })}
                                            placeholder="e.g., Interested, Not interested, Callback later"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={interactionFormData.requires_followup}
                                                onChange={(e) => setInteractionFormData({ ...interactionFormData, requires_followup: e.target.checked })}
                                            />
                                            Requires Follow-up
                                        </label>
                                    </div>

                                    {interactionFormData.requires_followup && (
                                        <div className="form-group">
                                            <label>Follow-up Date</label>
                                            <input
                                                type="datetime-local"
                                                value={interactionFormData.followup_date}
                                                onChange={(e) => setInteractionFormData({ ...interactionFormData, followup_date: e.target.value })}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="modal-footer">
                                    <button type="button" className="btn-cancel" onClick={() => setShowInteractionModal(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn-submit">
                                        Log Interaction
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Quick Capture Modal */}
            {
                showQuickCaptureModal && (
                    <div className="modal-overlay" onClick={() => setShowQuickCaptureModal(false)}>
                        <div className="modal-content modal-quick-capture" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>Quick Lead Capture</h2>
                                <button className="close-btn" onClick={() => setShowQuickCaptureModal(false)}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>

                            <form onSubmit={async (e) => {
                                e.preventDefault();

                                try {
                                    // Validate required fields
                                    if (!quickCaptureData.name.trim() || !quickCaptureData.phone.trim()) {
                                        showNotification('Name and phone are required', 'error');
                                        return;
                                    }

                                    // Split name
                                    const nameParts = quickCaptureData.name.trim().split(' ');
                                    const firstName = nameParts[0];
                                    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'N/A';

                                    // Find source ID
                                    const sourceId = sources.find(s => s.name === quickCaptureData.source)?.id;
                                    const statusId = statuses.find(s => s.name === 'New')?.id;

                                    if (!sourceId || !statusId) {
                                        showNotification('Invalid source or status. Please refresh the page.', 'error');
                                        console.error('Source ID:', sourceId, 'Status ID:', statusId);
                                        console.error('Sources:', sources, 'Statuses:', statuses);
                                        return;
                                    }

                                    const leadData = {
                                        first_name: firstName,
                                        last_name: lastName,
                                        email: quickCaptureData.email || null,
                                        phone: quickCaptureData.phone,
                                        lead_source_id: sourceId,
                                        lead_status_id: statusId,
                                        priority: 'medium',
                                        notes: quickCaptureData.notes || null
                                    };

                                    console.log('Submitting lead data:', leadData);
                                    const response = await crmAPI.createLead(leadData);
                                    console.log('Create lead response:', response);

                                    if (response.success) {
                                        showNotification('Lead captured successfully!', 'success');
                                        setShowQuickCaptureModal(false);
                                        setQuickCaptureData({ name: '', email: '', phone: '', source: 'Phone Call', notes: '' });
                                        fetchLeads();
                                        fetchStats();
                                    } else {
                                        showNotification('Failed to create lead', 'error');
                                    }
                                } catch (error) {
                                    console.error('Quick capture error:', error);
                                    showNotification(error.message || 'Failed to capture lead', 'error');
                                }
                            }}>
                                <div className="modal-body">
                                    <p className="quick-capture-desc">
                                        Quickly log a lead from a phone call, walk-in, or other immediate interaction.
                                    </p>

                                    <div className="form-group">
                                        <label>Full Name *</label>
                                        <input
                                            type="text"
                                            value={quickCaptureData.name}
                                            onChange={(e) => setQuickCaptureData({ ...quickCaptureData, name: e.target.value })}
                                            placeholder="John Doe"
                                            required
                                            autoFocus
                                        />
                                    </div>

                                    <div className="form-grid">
                                        <div className="form-group">
                                            <label>Email</label>
                                            <input
                                                type="email"
                                                value={quickCaptureData.email}
                                                onChange={(e) => setQuickCaptureData({ ...quickCaptureData, email: e.target.value })}
                                                placeholder="john@example.com"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Phone *</label>
                                            <input
                                                type="tel"
                                                value={quickCaptureData.phone}
                                                onChange={(e) => setQuickCaptureData({ ...quickCaptureData, phone: e.target.value })}
                                                placeholder="0927-399-3219"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label>Source *</label>
                                        <select
                                            value={quickCaptureData.source}
                                            onChange={(e) => setQuickCaptureData({ ...quickCaptureData, source: e.target.value })}
                                            required
                                        >
                                            {sources.map(source => (
                                                <option key={source.id} value={source.name}>{source.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label>Quick Notes</label>
                                        <textarea
                                            value={quickCaptureData.notes}
                                            onChange={(e) => setQuickCaptureData({ ...quickCaptureData, notes: e.target.value })}
                                            rows="3"
                                            placeholder="Interested in motorcycle course, wants to enroll next week..."
                                        ></textarea>
                                    </div>
                                </div>

                                <div className="modal-footer">
                                    <button type="button" className="btn-cancel" onClick={() => setShowQuickCaptureModal(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn-submit btn-submit-quick">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                            <polyline points="7 10 12 15 17 10"></polyline>
                                            <line x1="12" y1="15" x2="12" y2="3"></line>
                                        </svg>
                                        Capture Lead
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

            {/* Premium Confirm Dialog */}
            {showConfirmModal && (
                <div className="confirm-overlay" onClick={() => setShowConfirmModal(false)}>
                    <div className={`confirm-dialog ${confirmConfig.type}`} onClick={e => e.stopPropagation()}>
                        <div className="confirm-icon">
                            {confirmConfig.type === 'danger' ? (
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    <line x1="10" y1="11" x2="10" y2="17"></line>
                                    <line x1="14" y1="11" x2="14" y2="17"></line>
                                </svg>
                            ) : (
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            )}
                        </div>
                        <h2>{confirmConfig.title}</h2>
                        <p>{confirmConfig.message}</p>
                        <div className="confirm-actions">
                            <button className="btn-confirm-cancel" onClick={() => setShowConfirmModal(false)} disabled={confirmLoading}>
                                {confirmConfig.cancelText}
                            </button>
                            <button
                                className={`btn-confirm-action ${confirmConfig.type}`}
                                onClick={confirmConfig.onConfirm}
                                disabled={confirmLoading}
                            >
                                {confirmLoading ? 'Processing...' : confirmConfig.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CRMManagement;
