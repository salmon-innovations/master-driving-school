import React, { useState, useEffect, useRef } from 'react';
import './css/Dashboard.css';
import Sidebar from './components/Sidebar';
import Schedule from './Schedule';
import Booking from './Booking';
import SalePayment from './SalePayment';
import UserManagement from './User';
import WalkInEnrollment from './WalkInEnrollment';
import CourseManagement from './CourseManagement';
import Configuration from './Configuration';
import NewsEvents from './NewsEvents';
import AnalyticsReports from './AnalyticsReports';
import CRMManagement from './CRM';
import { useTheme } from '../context/ThemeContext';
import { useNotification } from '../context/NotificationContext';
import { authAPI, adminAPI, notificationsAPI } from '../services/api';
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,

} from 'recharts';

const logo = '/images/logo.png';
const cover = '/images/cover.png';



const Admin = ({ onNavigate, setIsLoggedIn }) => {
    const { theme, toggleTheme } = useTheme();
    const { showNotification } = useNotification();
    const [activeTab, setActiveTab] = useState(localStorage.getItem('adminActiveTab') || 'dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
    const [loading, setLoading] = useState(true);

    // Dashboard stats state
    const [stats, setStats] = useState({
        totalStudents: 0,
        monthlyRevenue: 0,
        pendingBookings: 0,
        todayEnrollments: 0,
    });

    // Chart data state
    const [revenueData, setRevenueData] = useState([]);
    const [enrollmentData, setEnrollmentData] = useState([]);
    const [bestSellingCourses, setBestSellingCourses] = useState([]);
    const [enrollees, setEnrollees] = useState([]);

    useEffect(() => {
        // Set initial state based on window size
        setIsSidebarOpen(window.innerWidth > 1024);

        const handleResize = () => {
            if (window.innerWidth <= 1024) {
                setIsSidebarOpen(false);
            } else {
                setIsSidebarOpen(true);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Prevent body scroll when mobile sidebar is open
    useEffect(() => {
        if (window.innerWidth <= 1024 && isSidebarOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isSidebarOpen]);

    useEffect(() => {
        localStorage.setItem('adminActiveTab', activeTab);
    }, [activeTab]);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Admin Profile State
    const [adminProfile, setAdminProfile] = useState({
        name: 'Admin User',
        email: 'admin@masterschool.edu',
        phone: '+63 912 345 6789',
        branch: 'Main Office',
        role: 'Admin',
        avatar: null
    });

    // Notifications State
    const NOTIF_READ_KEY  = 'admin_notif_read';
    const NOTIF_HIDE_KEY  = 'admin_notif_hidden';

    const getReadIds    = () => JSON.parse(localStorage.getItem(NOTIF_READ_KEY)  || '[]');
    const getHiddenIds  = () => JSON.parse(localStorage.getItem(NOTIF_HIDE_KEY) || '[]');

    const [rawNotifications, setRawNotifications] = useState([]);
    const [readIds,   setReadIds]   = useState(getReadIds);
    const [hiddenIds, setHiddenIds] = useState(getHiddenIds);
    const [notifLoading, setNotifLoading] = useState(false);

    // Merge server data with local read/hidden state
    const notifications = rawNotifications
        .filter(n => !hiddenIds.includes(n.id))
        .map(n => ({ ...n, read: readIds.includes(n.id) }));

    const fetchNotifications = async () => {
        try {
            setNotifLoading(true);
            const res = await notificationsAPI.getAll();
            if (res.success) {
                setRawNotifications(
                    res.notifications.map(n => ({
                        ...n,
                        // Format relative time
                        time: formatRelativeTime(new Date(n.time)),
                    }))
                );
            }
        } catch (err) {
            console.error('Failed to load notifications:', err);
        } finally {
            setNotifLoading(false);
        }
    };

    const formatRelativeTime = (date) => {
        if (!date || isNaN(date)) return 'just now';
        const diff = Math.floor((Date.now() - date.getTime()) / 1000);
        if (diff < 60)       return `${diff}s ago`;
        if (diff < 3600)     return `${Math.floor(diff / 60)} min ago`;
        if (diff < 86400)    return `${Math.floor(diff / 3600)} hour${Math.floor(diff / 3600) > 1 ? 's' : ''} ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    };

    const markAsRead = (id) => {
        const updated = [...new Set([...readIds, id])];
        setReadIds(updated);
        localStorage.setItem(NOTIF_READ_KEY, JSON.stringify(updated));
    };

    const deleteNotification = (id) => {
        const updated = [...new Set([...hiddenIds, id])];
        setHiddenIds(updated);
        localStorage.setItem(NOTIF_HIDE_KEY, JSON.stringify(updated));
    };

    const clearAllNotifications = () => {
        const allIds = rawNotifications.map(n => n.id);
        const updatedHidden = [...new Set([...hiddenIds, ...allIds])];
        setHiddenIds(updatedHidden);
        localStorage.setItem(NOTIF_HIDE_KEY, JSON.stringify(updatedHidden));
    };

    const unreadCount = notifications.filter(n => !n.read).length;
    const [showNotifications, setShowNotifications] = useState(false);

    // Fetch notifications on mount and auto-refresh every 60s
    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, []);

    // Fetch admin profile on mount
    useEffect(() => {
        const fetchAdminProfile = async () => {
            try {
                const response = await authAPI.getProfile();
                if (response.success) {
                    const user = response.user;
                    setAdminProfile({
                        name: `${user.firstName} ${user.middleName || ''} ${user.lastName}`.trim(),
                        email: user.email,
                        phone: user.contactNumbers || '+63 912 345 6789',
                        branch: user.branchName || 'Main Office',
                        branchId: user.branchId || null,
                        role: user.role === 'super_admin' ? 'Super Admin' :
                            user.role === 'admin' ? 'Admin' : 'User',
                        rawRole: user.role || 'admin',
                        avatar: null
                    });
                }
            } catch (error) {
                console.error('Error fetching profile:', error);
            }
        };

        fetchAdminProfile();
    }, []);

    // Fetch dashboard data
    useEffect(() => {
        const fetchDashboardData = async () => {
            if (activeTab === 'dashboard') {
                setLoading(true);
                try {
                    // Fetch core data needed for immediate display
                    const [statsRes, bookingsRes] = await Promise.all([
                        adminAPI.getStats(),
                        adminAPI.getAllBookings(null, 10)
                    ]);

                    if (statsRes.success) setStats(statsRes.stats);

                    if (bookingsRes.success) {
                        const formattedEnrollees = bookingsRes.bookings.map(booking => ({
                            name: booking.student_name || 'Unknown',
                            course: booking.course_name || 'N/A',
                            branch: booking.branch_name || 'N/A',
                            date: new Date(booking.booking_date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                            }),
                            status: booking.payment_type === 'Full Payment' ? 'Full Payment' :
                                booking.status === 'pending' ? 'Pending' :
                                    booking.status === 'partial_payment' ? 'Downpayment' :
                                        booking.status === 'paid' ? 'Full Payment' : 'Pending',
                            method: booking.payment_method || 'N/A',
                            type: booking.enrollment_type || 'online'
                        }));
                        setEnrollees(formattedEnrollees);
                    }

                    setLoading(false); // Show the dashboard cards and table

                    // Fetch chart data and other details in the background
                    Promise.all([
                        adminAPI.getRevenueData(),
                        adminAPI.getEnrollmentData(),
                        adminAPI.getBestSellingCourses(),
                    ]).then(([revenueRes, enrollmentRes, bestSellingRes]) => {
                        if (revenueRes.success) setRevenueData(revenueRes.data);
                        if (enrollmentRes.success) setEnrollmentData(enrollmentRes.data);
                        if (bestSellingRes.success) setBestSellingCourses(bestSellingRes.courses);
                    }).catch(err => console.error('Error fetching secondary dashboard data:', err));

                } catch (error) {
                    console.error('Error fetching dashboard data:', error);
                    showNotification('Failed to load dashboard statistics', 'error');
                    setLoading(false);
                }
            }
        };

        fetchDashboardData();
    }, [activeTab]);


    const fileInputRef = useRef(null);

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAdminProfile(prev => ({ ...prev, avatar: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current.click();
    };

    const [showEditProfileModal, setShowEditProfileModal] = useState(false);
    const [editProfileTab, setEditProfileTab] = useState('personal');
    const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

    const [profileFormData, setProfileFormData] = useState({ ...adminProfile });
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });


    // Clock update effect
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userToken');
        localStorage.removeItem('user');
        if (setIsLoggedIn) setIsLoggedIn(false);
        onNavigate('signin');
    };

    const handleProfileClick = () => {
        setActiveTab('profile');
        setShowProfileModal(false);
    };

    const handleSettingsClick = () => {
        setActiveTab('settings');
        setShowProfileModal(false);
    };

    const handleUpdateProfile = (e) => {
        e.preventDefault();
        setAdminProfile(prev => ({
            ...profileFormData,
            avatar: prev.avatar // Preserve the avatar
        }));
        setShowEditProfileModal(false);
        showNotification('Profile updated successfully!', 'success');
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            showNotification('Passwords do not match!', 'error');
            return;
        }
        if (passwordData.newPassword.length < 8) {
            showNotification('New password must be at least 8 characters.', 'error');
            return;
        }

        try {
            await authAPI.changePassword({
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword,
            });
            setShowChangePasswordModal(false);
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            showNotification('Password changed successfully!', 'success');
        } catch (error) {
            const msg = error?.message || 'Failed to change password. Please try again.';
            showNotification(msg, 'error');
        }
    };



    const formatTime = (date) => {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    };

    const formatDate = (date) => {
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // Enrollees Data for Table & Export



    const handleExport = () => {
        const timestamp = new Date().toLocaleString();

        // Styled HTML Template for Excel
        const tableHtml = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="utf-8">
                <style>
                    table { border-collapse: collapse; width: 100%; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
                    .title { font-size: 22px; font-weight: bold; color: #1a4fba; padding: 10px 0; }
                    .subtitle { font-size: 16px; color: #64748b; padding-bottom: 20px; }
                    .header-row th { background-color: #1a4fba; color: #ffffff; padding: 12px; font-weight: bold; border: 1px solid #e2e8f0; text-align: center; }
                    .data-row td { padding: 10px; border: 1px solid #e2e8f0; color: #334155; text-align: center; }
                    .status-full { color: #16a34a; font-weight: bold; }
                    .status-down { color: #b45309; font-weight: bold; }
                    .status-pending { color: #ea580c; font-weight: bold; }
                    .footer { font-size: 12px; color: #94a3b8; padding-top: 20px; border-top: 2px solid #f1f5f9; text-align: center; }
                </style>
            </head>
            <body>
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="${logo}" style="width: 80px; height: 80px; border-radius: 12px; margin-bottom: 15px;">
                </div>
                <table>
                    <tr><td colspan="5" class="title">MASTER DRIVING SCHOOL</td></tr>
                    <tr><td colspan="5" class="title">RECENT ENROLLEES MANAGEMENT REPORT</td></tr>
                    <tr><td colspan="5" class="subtitle">Generated on: ${timestamp}</td></tr>
                    <tr><td colspan="5"></td></tr>
                    <tr class="header-row">
                        <th>STUDENT NAME</th>
                        <th>COURSE</th>
                        <th>BRANCH</th>
                        <th>SCHEDULE</th>
                        <th>STATUS</th>
                    </tr>
                    ${enrollees.map(s => `
                        <tr class="data-row">
                            <td>${s.name}</td>
                            <td>${s.course}</td>
                            <td>${s.branch}</td>
                            <td>${s.date}</td>
                            <td class="${s.status === 'Full Payment' ? 'status-full' : s.status === 'Downpayment' ? 'status-down' : 'status-pending'}">${s.status.toUpperCase()}</td>
                        </tr>
                    `).join('')}
                    <tr><td colspan="5"></td></tr>
                    <tr><td colspan="5"></td></tr>
                    <tr><td colspan="5"></td></tr>
                    <tr><td colspan="5" class="footer">Total Enrollees: ${enrollees.length} | --- Confidential Business Report ---</td></tr>
                </table>
            </body>
            </html>
        `;

        const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `MasterSchool_Enrollees_${new Date().toISOString().slice(0, 10)}.xls`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div className={`dashboard-container ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            <Sidebar
                isSidebarOpen={isSidebarOpen}
                setIsSidebarOpen={setIsSidebarOpen}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onNavigate={onNavigate}
                handleLogout={handleLogout}
            />

            {/* Main Content */}
            <main className="main-content">
                <header className="main-header">
                    <div className="header-left">
                        <button
                            className="menu-toggle-btn"
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            title={isSidebarOpen ? "Collapse Menu" : "Expand Menu"}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="3" y1="12" x2="21" y2="12"></line>
                                <line x1="3" y1="6" x2="21" y2="6"></line>
                                <line x1="3" y1="18" x2="21" y2="18"></line>
                            </svg>
                        </button>
                        <div className="header-title">
                            <h1>
                                {activeTab === 'dashboard' ? 'Overview' :
                                    activeTab === 'schedules' ? 'Schedules' :
                                        activeTab === 'bookings' ? 'Bookings' :
                                            activeTab === 'sales' ? 'Financials' :
                                                activeTab === 'profile' ? 'Profile' :
                                                    activeTab === 'settings' ? 'Settings' :
                                                        activeTab === 'walk-in' ? 'Walk-in Enrollment' :
                                                            activeTab === 'news' ? 'News & Events' :
                                                                activeTab === 'users' ? 'Account Management' :
                                                                    activeTab === 'courses' ? 'Course Management' :
                                                                        activeTab === 'branches' ? 'Configuration' :
                                                                            activeTab === 'crm' ? 'CRM Management' :
                                                                                'Dashboard'}
                            </h1>
                            <p>
                                {(activeTab === 'users' || activeTab === 'courses' || activeTab === 'branches' || activeTab === 'crm')
                                    ? 'Manage your system configurations and settings'
                                    : 'Welcome back, Admin'}
                            </p>
                        </div>
                    </div>

                    <div className="header-right">
                        <div className="notification-wrapper">
                            <button
                                className={`notification-btn ${showNotifications ? 'active' : ''}`}
                                title="View Notifications"
                                onClick={() => setShowNotifications(!showNotifications)}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                                </svg>
                                {unreadCount > 0 && <span className="notification-badge"></span>}
                            </button>

                            {showNotifications && (
                                <>
                                    <div className="dropdown-overlay" onClick={() => setShowNotifications(false)}></div>
                                    <div className="notification-dropdown animate-dropdown">
                                        <div className="dropdown-header">
                                            <h3>
                                                Notifications
                                                {unreadCount > 0 && (
                                                    <span style={{ marginLeft: 8, background: '#6366f1', color: '#fff', borderRadius: 99, fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px' }}>
                                                        {unreadCount}
                                                    </span>
                                                )}
                                            </h3>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                <button
                                                    className="clear-all-btn"
                                                    title="Refresh"
                                                    onClick={fetchNotifications}
                                                    style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                                                >
                                                    {notifLoading ? '…' : '↻'}
                                                </button>
                                                {notifications.length > 0 && (
                                                    <button className="clear-all-btn" onClick={clearAllNotifications}>Clear All</button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="notifications-list">
                                            {notifLoading && notifications.length === 0 ? (
                                                <div className="no-notifications">
                                                    <div className="empty-icon" style={{ fontSize: '1.5rem', animation: 'spin 1s linear infinite' }}>⟳</div>
                                                    <p>Loading notifications…</p>
                                                </div>
                                            ) : notifications.length > 0 ? (
                                                notifications.map(n => (
                                                    <div key={n.id} className={`notification-item ${n.read ? 'read' : 'unread'}`} onClick={() => markAsRead(n.id)}>
                                                        <div className={`status-dot ${n.type}`}></div>
                                                        <div className="notify-content">
                                                            <div className="notify-title-row">
                                                                <h4>{n.title}</h4>
                                                                <span className="notify-time">{n.time}</span>
                                                            </div>
                                                            <p>{n.message}</p>
                                                        </div>
                                                        <button
                                                            className="delete-notify"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                deleteNotification(n.id);
                                                            }}
                                                        >
                                                            &times;
                                                        </button>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="no-notifications">
                                                    <div className="empty-icon">🔔</div>
                                                    <p>No recent activity</p>
                                                </div>
                                            )}
                                        </div>
                                        {notifications.length > 0 && (
                                            <div className="dropdown-footer">
                                                <button
                                                    className="view-all-notify-btn"
                                                    onClick={() => {
                                                        setActiveTab('notifications');
                                                        setShowNotifications(false);
                                                    }}
                                                >
                                                    View All Notifications
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                        <button className="theme-toggle-btn" onClick={toggleTheme} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
                            {theme === 'light' ? (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                            ) : (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                            )}
                        </button>
                        <div className="header-clock">
                            <div className="clock-time">{formatTime(currentTime)}</div>
                            <div className="clock-date">{formatDate(currentTime)}</div>
                        </div>
                        <div className="profile-section">
                            <div
                                className="profile-circle"
                                title="Admin Account"
                                onClick={() => setShowProfileModal(!showProfileModal)}
                            >
                                {adminProfile.avatar ? (
                                    <img src={adminProfile.avatar} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                ) : (
                                    <span>AD</span>
                                )}
                            </div>

                            {showProfileModal && (
                                <>
                                    <div className="profile-modal-overlay" onClick={() => setShowProfileModal(false)}></div>
                                    <div className="profile-dropdown-modal">
                                        <div className="profile-dropdown-header">
                                            <div className="profile-info-display">
                                                <div className="large-profile-circle">
                                                    {adminProfile.avatar ? (
                                                        <img src={adminProfile.avatar} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                                    ) : (
                                                        "AD"
                                                    )}
                                                </div>
                                                <div className="profile-text">
                                                    <h3>{adminProfile.name}</h3>
                                                    <p>{adminProfile.email}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="profile-dropdown-body">
                                            <button className="dropdown-item" onClick={handleProfileClick}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                                My Profile
                                            </button>
                                            <button className="dropdown-item" onClick={handleSettingsClick}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                                                Account Settings
                                            </button>
                                            <div className="dropdown-divider"></div>
                                            <button className="dropdown-item logout" onClick={handleLogout}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                                                Logout
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                {activeTab === 'dashboard' ? (
                    <>
                        {/* Stats Cards */}
                        <section className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-info">
                                    <span>Total Enrolled Students</span>
                                    <h2>{loading ? <span className="skeleton-text">---</span> : stats.totalStudents.toLocaleString()}</h2>
                                    <p className="stat-subtitle">All time enrollments</p>
                                </div>
                                <div className="stat-icon blue">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                                </div>
                            </div>

                            <div className="stat-card">
                                <div className="stat-info">
                                    <span>Total Sales (This Month)</span>
                                    <h2>{loading ? <span className="skeleton-text">---</span> : `₱ ${stats.monthlyRevenue > 0 ? (stats.monthlyRevenue / 1000).toFixed(1) + 'k' : '0.00'}`}</h2>
                                    <p className="stat-subtitle">Monthly revenue</p>
                                </div>
                                <div className="stat-icon green">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                                </div>
                            </div>

                            <div className="stat-card">
                                <div className="stat-info">
                                    <span>Today's Enrollments</span>
                                    <h2>{loading ? <span className="skeleton-text">---</span> : stats.todayEnrollments}</h2>
                                    <p className="stat-subtitle">New students today</p>
                                </div>
                                <div className="stat-icon purple">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                </div>
                            </div>
                        </section>

                        {/* Charts Section */}
                        <section className="charts-grid section">
                            <div className="chart-card">
                                <div className="chart-header">
                                    <div>
                                        <h3>Monthly Revenue</h3>
                                        <span>Financial Trends</span>
                                    </div>
                                </div>
                                <div className="chart-container">
                                    {loading ? (
                                        <div className="chart-loading-skeleton">
                                            <div className="skeleton-bar" style={{ height: '40%' }}></div>
                                            <div className="skeleton-bar" style={{ height: '70%' }}></div>
                                            <div className="skeleton-bar" style={{ height: '55%' }}></div>
                                            <div className="skeleton-bar" style={{ height: '85%' }}></div>
                                            <div className="skeleton-bar" style={{ height: '60%' }}></div>
                                            <div className="skeleton-bar" style={{ height: '45%' }}></div>
                                        </div>
                                    ) : revenueData.length === 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '12px', opacity: 0.5 }}>
                                                <line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                                            </svg>
                                            <span style={{ fontSize: '14px' }}>No revenue data available yet</span>
                                        </div>
                                    ) : (
                                        <ResponsiveContainer>
                                            <AreaChart
                                                data={revenueData}
                                                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                                            >
                                                <defs>
                                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#1a4fba" stopOpacity={0.1} />
                                                        <stop offset="95%" stopColor="#1a4fba" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1b254b' : '#f1f5f9'} />
                                                <XAxis
                                                    dataKey="name"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: theme === 'dark' ? '#a3b1cc' : '#94a3b8', fontSize: 12 }}
                                                    dy={10}
                                                />
                                                <YAxis
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: theme === 'dark' ? '#a3b1cc' : '#94a3b8', fontSize: 12 }}
                                                />
                                                <Tooltip
                                                    contentStyle={{
                                                        borderRadius: '12px',
                                                        border: 'none',
                                                        backgroundColor: theme === 'dark' ? '#111c44' : '#ffffff',
                                                        color: theme === 'dark' ? '#ffffff' : '#1e293b',
                                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                                    }}
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey="revenue"
                                                    stroke="#1a4fba"
                                                    fillOpacity={1}
                                                    fill="url(#colorRevenue)"
                                                    strokeWidth={3}
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>

                            <div className="chart-card">
                                <div className="chart-header">
                                    <div>
                                        <h3>Monthly Enrollments</h3>
                                        <span>Student Acquisition</span>
                                    </div>
                                </div>
                                <div className="chart-container">
                                    {loading ? (
                                        <div className="chart-loading-skeleton">
                                            <div className="skeleton-bar" style={{ height: '60%' }}></div>
                                            <div className="skeleton-bar" style={{ height: '45%' }}></div>
                                            <div className="skeleton-bar" style={{ height: '80%' }}></div>
                                            <div className="skeleton-bar" style={{ height: '35%' }}></div>
                                            <div className="skeleton-bar" style={{ height: '65%' }}></div>
                                            <div className="skeleton-bar" style={{ height: '50%' }}></div>
                                        </div>
                                    ) : enrollmentData.length === 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '12px', opacity: 0.5 }}>
                                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle>
                                            </svg>
                                            <span style={{ fontSize: '14px' }}>No enrollment data available yet</span>
                                        </div>
                                    ) : (
                                        <ResponsiveContainer>
                                            <BarChart
                                                data={enrollmentData}
                                                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1b254b' : '#f1f5f9'} />
                                                <XAxis
                                                    dataKey="name"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: theme === 'dark' ? '#a3b1cc' : '#94a3b8', fontSize: 12 }}
                                                    dy={10}
                                                />
                                                <YAxis
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: theme === 'dark' ? '#a3b1cc' : '#94a3b8', fontSize: 12 }}
                                                />
                                                <Tooltip
                                                    contentStyle={{
                                                        borderRadius: '12px',
                                                        border: 'none',
                                                        backgroundColor: theme === 'dark' ? '#111c44' : '#ffffff',
                                                        color: theme === 'dark' ? '#ffffff' : '#1e293b',
                                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                                    }}
                                                />
                                                <Legend verticalAlign="top" height={36} />
                                                <Bar dataKey="students" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* Best Selling Courses Section */}
                        <section className="data-section best-courses-section">
                            <div className="section-header">
                                <div>
                                    <h2>Best Selling Courses</h2>
                                    <p className="section-subtitle">Top performing courses by enrollment count</p>
                                </div>
                            </div>

                            {loading ? (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    height: '200px',
                                    color: 'var(--secondary-text)',
                                    background: 'var(--card-bg)',
                                    borderRadius: '16px',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    Loading courses data...
                                </div>
                            ) : bestSellingCourses.length === 0 ? (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    height: '200px',
                                    color: 'var(--secondary-text)',
                                    background: 'var(--card-bg)',
                                    borderRadius: '16px',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '12px', opacity: 0.5 }}>
                                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                                    </svg>
                                    <span style={{ fontSize: '14px' }}>No course data available yet</span>
                                    <span style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>Courses will appear here once enrollments are recorded</span>
                                </div>
                            ) : (
                                <div className="courses-grid">
                                    {bestSellingCourses.slice(0, 6).map((course, index) => (
                                        <div
                                            key={course.id}
                                            className="course-card"
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-4px)';
                                                e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.1)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.boxShadow = 'none';
                                            }}
                                        >
                                            {/* Ranking Badge */}
                                            {index < 3 && (
                                                <div className={`ranking-badge rank-${index + 1}`}>
                                                    {index + 1}
                                                </div>
                                            )}

                                            <div className="course-card-body">
                                                <h3 className="course-title">
                                                    {course.course_name}
                                                </h3>
                                                <p className="course-description">
                                                    {course.description || 'Professional driving course with comprehensive training'}
                                                </p>
                                            </div>

                                            <div className="course-stats-grid">
                                                <div className="course-stat-item">
                                                    <div className="course-stat-label">Enrollments</div>
                                                    <div className="course-stat-value primary">
                                                        {course.total_bookings}
                                                    </div>
                                                </div>

                                                <div className="course-stat-item">
                                                    <div className="course-stat-label">Revenue</div>
                                                    <div className="course-stat-value success">
                                                        ₱{(parseFloat(course.total_revenue) / 1000).toFixed(1)}k
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="course-card-footer">
                                                <div className="course-price">
                                                    <span className="label">Price:</span> ₱{parseFloat(course.price).toLocaleString()}
                                                </div>
                                                <div className="course-completion">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                        <polyline points="20 6 9 17 4 12"></polyline>
                                                    </svg>
                                                    {course.completed_bookings} Completed
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* Recent Enrollees Table */}
                        <section className="data-section recent-enrollees-section">
                            <div className="section-header">
                                <div>
                                    <h2>Recent Enrollees</h2>
                                    <p className="section-subtitle">Latest student enrollment records</p>
                                </div>
                                <div className="section-actions">
                                    <button
                                        className="export-btn-secondary"
                                        onClick={handleExport}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                        Export
                                    </button>
                                </div>
                            </div>

                            <div className="table-wrapper">
                                <table className="custom-table">
                                    <thead>
                                        <tr>
                                            <th>Student Name</th>
                                            <th>Course</th>
                                            <th>Branch</th>
                                            <th>Schedule</th>
                                            <th>Payment Method</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {enrollees.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" style={{
                                                    textAlign: 'center',
                                                    padding: '40px 20px',
                                                    color: 'var(--secondary-text)',
                                                    fontSize: '14px'
                                                }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.4 }}>
                                                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                                        </svg>
                                                        <span>No recent enrollees found</span>
                                                        <span style={{ fontSize: '12px', opacity: 0.7 }}>New enrollments will appear here</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : enrollees.map((student, index) => (
                                            <tr key={index} className="table-row-hover">
                                                <td>
                                                    <div className="student-cell">
                                                        <div className="student-avatar">
                                                            {student.name?.charAt(0)?.toUpperCase() || '?'}
                                                        </div>
                                                        <div className="student-name-info">
                                                            <span className="student-name">{student.name}</span>
                                                            {student.type === 'walk-in' && (
                                                                <span className="enrollment-type-badge walkin">Walk-in</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>{student.course}</td>
                                                <td>{student.branch}</td>
                                                <td>{student.date}</td>
                                                <td>{student.method || 'GCash'}</td>
                                                <td>
                                                    <span className={`status-badge ${student.status === 'Full Payment' ? 'full' :
                                                        student.status === 'Downpayment' ? 'down' : 'pending'
                                                        }`}>
                                                        {student.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                    </>
                ) : activeTab === 'schedules' ? (
                    <Schedule onNavigate={setActiveTab} />
                ) : activeTab === 'bookings' ? (
                    <Booking />
                ) : activeTab === 'sales' ? (
                    <SalePayment />

                ) : activeTab === 'news' ? (
                    <NewsEvents />
                ) : activeTab === 'walk-in' ? (
                    <WalkInEnrollment
                        adminProfile={adminProfile}
                        onEnroll={(newEnrollee) => {
                            setEnrollees(prev => [newEnrollee, ...prev]);
                        }}
                    />
                ) : activeTab === 'profile' ? (
                    <div className="profile-view-container">
                        <div className="profile-header-card">
                            <div className="profile-banner" style={{
                                background: `linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.7)), url(${cover}) center/cover no-repeat`
                            }}></div>
                            <div className="profile-info-main">
                                <div className="profile-avatar-large" onClick={triggerFileInput} title="Change Profile Picture">
                                    {adminProfile.avatar ? (
                                        <img src={adminProfile.avatar} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                    ) : (
                                        "AD"
                                    )}
                                    <div className="avatar-overlay">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                                    </div>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleImageUpload}
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                    />
                                </div>
                                <div className="profile-meta">
                                    <h2>{adminProfile.name}</h2>
                                    <p>{adminProfile.email}</p>
                                    <span className="role-badge">{adminProfile.role}</span>
                                </div>
                                <button className="edit-profile-btn" onClick={() => {
                                    setProfileFormData({ ...adminProfile });
                                    setEditProfileTab('personal');
                                    setShowEditProfileModal(true);
                                }}>Edit Profile</button>
                            </div>
                        </div>

                        <div className="profile-content-grid">
                            <div className="profile-details-card">
                                <h3>Personal Information</h3>
                                <div className="info-list">
                                    <div className="info-item">
                                        <label>Full Name</label>
                                        <p>{adminProfile.name}</p>
                                    </div>
                                    <div className="info-item">
                                        <label>Email Address</label>
                                        <p>{adminProfile.email}</p>
                                    </div>
                                    <div className="info-item">
                                        <label>Phone Number</label>
                                        <p>{adminProfile.phone}</p>
                                    </div>
                                    <div className="info-item">
                                        <label>Branch</label>
                                        <p>{adminProfile.branch}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="profile-details-card">
                                <h3>Account Security</h3>
                                <div className="info-list">
                                    <div className="info-item">
                                        <label>Password</label>
                                        <p>••••••••••••</p>
                                        <button className="change-btn" onClick={() => {
                                            setEditProfileTab('security');
                                            setShowEditProfileModal(true);
                                        }}>Change</button>
                                    </div>
                                    <div className="info-item">
                                        <label>2FA Status</label>
                                        <p>Enabled</p>
                                    </div>
                                    <div className="info-item">
                                        <label>Last Login</label>
                                        <p>Today at 10:45 AM</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : activeTab === 'settings' ? (
                    <Configuration initialTab="settings" />
                ) : activeTab === 'users' ? (
                    <UserManagement />
                ) : activeTab === 'courses' ? (
                    <CourseManagement />
                ) : activeTab === 'branches' ? (
                    <Configuration />
                ) : activeTab === 'analytics' ? (
                    <AnalyticsReports onNavigate={setActiveTab} />
                ) : activeTab === 'crm' ? (
                    <CRMManagement />
                ) : activeTab === 'news' ? (
                    <NewsEvents />
                ) : activeTab === 'notifications' ? (
                    <NotificationPage
                        notifications={notifications}
                        markAsRead={markAsRead}
                        deleteNotification={deleteNotification}
                        clearAll={clearAllNotifications}
                    />
                ) : null}
                {/* Unified Edit Profile & Settings Modal */}
                {showEditProfileModal && (
                    <div className="modal-overlay">
                        <div className="modal-container">
                            <div className="modal-header">
                                <div className="modal-header-left">
                                    <div className="modal-header-icon">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                    </div>
                                    <div>
                                        <h2>{editProfileTab === "personal" ? "Edit Profile" : "Change Password"}</h2>
                                    </div>
                                </div>
                                <div className="modal-header-right">
                                    <button className="close-modal" onClick={() => setShowEditProfileModal(false)}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                </div>
                            </div>
                            
                            <div className="modal-tabs" style={{ display: "flex", borderBottom: "1px solid var(--border-color)", margin: "0 25px" }}>
                                <button 
                                    style={{ padding: "15px 20px", background: "none", border: "none", borderBottom: editProfileTab === "personal" ? "2px solid var(--primary-color)" : "2px solid transparent", color: editProfileTab === "personal" ? "var(--primary-color)" : "var(--secondary-text)", fontWeight: editProfileTab === "personal" ? "600" : "500", cursor: "pointer", outline: "none" }}
                                    onClick={() => setEditProfileTab("personal")}
                                >
                                    Personal Details
                                </button>
                                <button 
                                    style={{ padding: "15px 20px", background: "none", border: "none", borderBottom: editProfileTab === "security" ? "2px solid var(--primary-color)" : "2px solid transparent", color: editProfileTab === "security" ? "var(--primary-color)" : "var(--secondary-text)", fontWeight: editProfileTab === "security" ? "600" : "500", cursor: "pointer", outline: "none" }}
                                    onClick={() => setEditProfileTab("security")}
                                >
                                    Account Security
                                </button>
                            </div>

                            {editProfileTab === "personal" ? (
                                <form onSubmit={handleUpdateProfile}>
                                    <div className="modal-body">
                                        <div className="form-group">
                                            <label>Full Name</label>
                                            <input
                                                type="text"
                                                value={profileFormData.name}
                                                onChange={(e) => setProfileFormData({ ...profileFormData, name: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Email Address</label>
                                            <input
                                                type="email"
                                                value={profileFormData.email}
                                                onChange={(e) => setProfileFormData({ ...profileFormData, email: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="form-row">
                                            <div className="form-group" style={{ flex: 1 }}>
                                                <label>Phone Number</label>
                                                <input
                                                    type="text"
                                                    value={profileFormData.phone}
                                                    onChange={(e) => setProfileFormData({ ...profileFormData, phone: e.target.value })}
                                                    required
                                                />
                                            </div>
                                            <div className="form-group" style={{ flex: 1 }}>
                                                <label>Branch</label>
                                                <input
                                                    type="text"
                                                    value={profileFormData.branch}
                                                    onChange={(e) => setProfileFormData({ ...profileFormData, branch: e.target.value })}
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="modal-footer">
                                        <button type="button" className="cancel-btn" onClick={() => setShowEditProfileModal(false)}>Cancel</button>
                                        <button type="submit" className="confirm-btn">Save Changes</button>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={handleChangePassword}>
                                    <div className="modal-body">
                                        <div className="form-group">
                                            <label>Current Password</label>
                                            <input
                                                type="password"
                                                value={passwordData.currentPassword}
                                                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                                placeholder="Enter current password"
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>New Password</label>
                                            <input
                                                type="password"
                                                value={passwordData.newPassword}
                                                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                                placeholder="Enter new password"
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Confirm New Password</label>
                                            <input
                                                type="password"
                                                value={passwordData.confirmPassword}
                                                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                                placeholder="Repeat new password"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="modal-footer">
                                        <button type="button" className="cancel-btn" onClick={() => setShowEditProfileModal(false)}>Cancel</button>
                                        <button type="submit" className="confirm-btn red">Update Password</button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

const NotificationPage = ({ notifications, markAsRead, deleteNotification, clearAll }) => {
    const unreadOnly = notifications.filter(n => !n.read);
    const [filter, setFilter] = React.useState('all');

    const filtered = filter === 'unread' ? unreadOnly : notifications;

    const notifIcon = (notifType) => {
        if (notifType === 'payment_full') return (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
        );
        if (notifType === 'payment_down') return (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                <line x1="2" y1="10" x2="22" y2="10"></line>
            </svg>
        );
        if (notifType === 'reschedule') return (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
                <polyline points="9 16 11 18 15 14"></polyline>
            </svg>
        );
        // enrollment / default
        return (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
            </svg>
        );
    };

    const notifIconClass = (notifType) => {
        if (notifType === 'payment_full') return 'success';
        if (notifType === 'payment_down') return 'warning';
        if (notifType === 'reschedule')   return 'reschedule';
        return 'info';
    };

    return (
        <div className="notifications-page animate-fade-in">
            <div className="page-header-prime">
                <div className="header-text">
                    <h2>Notification Center</h2>
                    <p>Manage your system alerts and activity updates</p>
                </div>
                <div className="header-actions">
                    <button className="secondary-btn" onClick={clearAll}>Clear All History</button>
                </div>
            </div>

            <div className="filter-bar-lux">
                <button
                    className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => setFilter('all')}
                >
                    All Notifications ({notifications.length})
                </button>
                <button
                    className={`filter-tab ${filter === 'unread' ? 'active' : ''}`}
                    onClick={() => setFilter('unread')}
                >
                    Unread ({unreadOnly.length})
                </button>
            </div>

            <div className="notifications-container-lux">
                {filtered.length > 0 ? (
                    filtered.map(n => (
                            <div key={n.id} className={`notify-card-lux ${n.read ? 'read' : 'unread'}`}>
                                <div className="card-indicator"></div>
                                <div className={`card-icon-box ${notifIconClass(n.notifType)}`}>
                                    {notifIcon(n.notifType)}
                                </div>
                            <div className="card-main">
                                <div className="card-top-row">
                                    <h3>{n.title}</h3>
                                    <span className="card-time">{n.time}</span>
                                </div>
                                <p>{n.message}</p>
                                {!n.read && (
                                    <button className="mark-read-link" onClick={() => markAsRead(n.id)}>
                                        Mark as read
                                    </button>
                                )}
                            </div>
                            <button className="card-delete-btn" onClick={() => deleteNotification(n.id)}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                        </div>
                    ))
                ) : (
                    <div className="empty-notification-state">
                        <div className="empty-visual">📭</div>
                        <h3>All caught up!</h3>
                        <p>No new notifications to show right now.</p>
                    </div>
                )}
            </div>
        </div>
    );
};


export default Admin;
