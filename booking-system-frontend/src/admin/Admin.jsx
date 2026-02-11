import React, { useState, useEffect, useRef } from 'react';
import './css/Dashboard.css';
import Sidebar from './components/Sidebar';
import Schedule from './Schedule';
import Booking from './Booking';
import SalePayment from './SalePayment';
import UserManagement from './User';
import WalkInEnrollment from './WalkInEnrollment';
import CourseManagement from './CourseManagement';
import { useTheme } from '../context/ThemeContext';
import { useNotification } from '../context/NotificationContext';
import { authAPI, adminAPI } from '../services/api';
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
    FunnelChart,
    Funnel,
    LabelList
} from 'recharts';

const logo = '/images/logo.png';
const cover = '/images/cover.png';

const funnelData = [
    { value: 1000, name: 'Visitors', fill: '#1a4fba' },
    { value: 750, name: 'Inquiries', fill: '#3b82f6' },
    { value: 500, name: 'Enrolled', fill: '#60a5fa' },
    { value: 380, name: 'Active', fill: '#93c5fd' },
    { value: 200, name: 'Graduates', fill: '#bfdbfe' },
];

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
    const [showStudentModal, setShowStudentModal] = useState(false);
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
                        branch: 'Main Office', // Update this based on your branch logic
                        role: user.role === 'admin' ? 'Super Admin' : user.role === 'staff' ? 'Staff' : 'User',
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
                try {
                    setLoading(true);
                    
                    // Fetch stats
                    const statsResponse = await adminAPI.getStats();
                    if (statsResponse.success) {
                        setStats(statsResponse.stats);
                    }

                    // Fetch revenue data
                    const revenueResponse = await adminAPI.getRevenueData();
                    if (revenueResponse.success) {
                        setRevenueData(revenueResponse.data);
                    }

                    // Fetch enrollment data
                    const enrollmentResponse = await adminAPI.getEnrollmentData();
                    if (enrollmentResponse.success) {
                        setEnrollmentData(enrollmentResponse.data);
                    }

                    // Fetch best selling courses
                    const coursesResponse = await adminAPI.getBestSellingCourses();
                    if (coursesResponse.success) {
                        setBestSellingCourses(coursesResponse.courses);
                    }

                    // Fetch recent bookings
                    const bookingsResponse = await adminAPI.getAllBookings(null, 10);
                    if (bookingsResponse.success) {
                        const formattedEnrollees = bookingsResponse.bookings.map(booking => ({
                            name: booking.student_name,
                            course: booking.course_name,
                            branch: booking.branch_name,
                            date: new Date(booking.booking_date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                            }),
                            status: booking.status === 'confirmed' ? 'Full Payment' : 
                                    booking.status === 'pending' ? 'Pending' : 'Downpayment',
                            method: 'GCash'
                        }));
                        setEnrollees(formattedEnrollees);
                    }

                } catch (error) {
                    console.error('Error fetching dashboard data:', error);
                    showNotification('Error loading dashboard data', 'error');
                } finally {
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

    const handleChangePassword = (e) => {
        e.preventDefault();
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            showNotification('Passwords do not match!', 'error');
            return;
        }
        setShowChangePasswordModal(false);
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        showNotification('Password changed successfully!', 'success');
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
    const [enrollees, setEnrollees] = useState([
        { name: 'Juan Dela Cruz', course: 'TDC - Online', branch: 'Main Branch', date: 'Jan 15, 2024', status: 'Full Payment', method: 'GCash' },
        { name: 'Maria Clara', course: 'PDC - Manual Sedan', branch: 'V. Luna', date: 'Jan 18, 2024 (AM)', status: 'Downpayment', method: 'StarPay' },
        { name: 'Pedro Penduko', course: 'PDC - Motorcycle', branch: 'Marikina', date: 'Jan 20, 2024 (PM)', status: 'Pending', method: 'GCash' }
    ]);

    const [studentData, setStudentData] = useState({
        name: '',
        course: 'TDC - Online',
        branch: 'Main Branch',
        date: '',
        status: 'Pending'
    });

    const handleStudentInputChange = (e) => {
        const { name, value } = e.target;
        setStudentData({ ...studentData, [name]: value });
    };

    const handleAddStudent = (e) => {
        e.preventDefault();
        const newStudent = {
            name: studentData.name,
            course: studentData.course,
            branch: studentData.branch,
            date: studentData.date,
            status: studentData.status
        };
        setEnrollees([newStudent, ...enrollees]);
        setShowStudentModal(false);
        // Reset form
        setStudentData({
            name: '',
            course: 'TDC - Online',
            branch: 'Main Branch',
            date: '',
            status: 'Pending'
        });
    };

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
                                                                        'Dashboard'}
                            </h1>
                            <p>Welcome back, Admin</p>
                        </div>
                    </div>

                    <div className="header-right">
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
                                    <h2>{loading ? '...' : stats.totalStudents.toLocaleString()}</h2>
                                </div>
                                <div className="stat-icon blue">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                                </div>
                            </div>

                            <div className="stat-card">
                                <div className="stat-info">
                                    <span>Total Sales (This Month)</span>
                                    <h2>{loading ? '...' : `₱ ${(stats.monthlyRevenue / 1000).toFixed(1)}k`}</h2>
                                </div>
                                <div className="stat-icon green">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                                </div>
                            </div>

                            <div className="stat-card">
                                <div className="stat-info">
                                    <span>Pending Bookings</span>
                                    <h2>{loading ? '...' : stats.pendingBookings}</h2>
                                </div>
                                <div className="stat-icon orange">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                </div>
                            </div>
                        </section>

                        {/* Charts Section */}
                        <section className="charts-grid section">
                            <div className="chart-card">
                                <div className="chart-header">
                                    <h3>Monthly Revenue</h3>
                                    <span>Financial Trends</span>
                                </div>
                                <div style={{ width: '100%', height: 300 }}>
                                    {loading ? (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                                            Loading chart data...
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
                                    <h3>Monthly Enrollments</h3>
                                    <span>Student Acquisition</span>
                                </div>
                                <div style={{ width: '100%', height: 300 }}>
                                    {loading ? (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                                            Loading chart data...
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
                        <section className="data-section">
                            <div className="section-header">
                                <h2>Best Selling Courses</h2>
                                <p style={{ color: 'var(--secondary-text)', fontSize: '0.9rem', marginTop: '5px' }}>
                                    Top performing courses by enrollment count
                                </p>
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
                        <section className="data-section">
                            <div className="section-header">
                                <h2>Recent Enrollees</h2>
                                <div className="section-actions">
                                    <button
                                        className="export-btn-secondary"
                                        style={{ marginRight: '10px' }}
                                        onClick={handleExport}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                        Export
                                    </button>
                                    <button className="add-btn" onClick={() => setShowStudentModal(true)}>Add Student</button>
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
                                        {enrollees.map((student, index) => (
                                            <tr key={index}>
                                                <td className="student-name">{student.name}</td>
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
                    <Schedule />
                ) : activeTab === 'bookings' ? (
                    <Booking />
                ) : activeTab === 'sales' ? (
                    <SalePayment />
                ) : activeTab === 'analytics' ? (
                    <div className="analytics-view">
                        <section className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-info">
                                    <h3>Growth Rate</h3>
                                    <div className="stat-value">+12.5%</div>
                                    <div className="stat-label">vs last month</div>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-info">
                                    <h3>Retention</h3>
                                    <div className="stat-value">94.2%</div>
                                    <div className="stat-label">Student satisfaction</div>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-info">
                                    <h3>Traffic</h3>
                                    <div className="stat-value">12.8k</div>
                                    <div className="stat-label">Page views</div>
                                </div>
                            </div>
                        </section>
                        <section className="charts-grid">
                            <div className="chart-card">
                                <div className="chart-header">
                                    <h3>Conversion Funnel</h3>
                                </div>
                                <div className="chart-wrapper" style={{ height: '350px', padding: '20px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <FunnelChart>
                                            <Tooltip
                                                contentStyle={{
                                                    borderRadius: '12px',
                                                    border: 'none',
                                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                                }}
                                            />
                                            <Funnel
                                                dataKey="value"
                                                data={funnelData}
                                                isAnimationActive
                                            >
                                                <LabelList
                                                    position="right"
                                                    fill="#64748b"
                                                    stroke="none"
                                                    dataKey="name"
                                                    fontSize={12}
                                                />
                                            </Funnel>
                                        </FunnelChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </section>
                    </div>
                ) : activeTab === 'news' ? (
                    <div className="news-view">
                        <div className="section-header">
                            <h2>News & Announcements</h2>
                            <button className="add-btn">Post New</button>
                        </div>
                        <div className="news-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', marginTop: '20px' }}>
                            <div className="news-card" style={{ background: 'white', padding: '20px', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
                                <div className="news-tag" style={{ background: '#dcfce7', color: '#16a34a', display: 'inline-block', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', marginBottom: '12px' }}>EVENT</div>
                                <h3 style={{ fontSize: '1.1rem', marginBottom: '10px' }}>Summer Driving Bootcamp 2024</h3>
                                <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.6' }}>Join our intensive 2-week course this summer. Limited slots available for all branches.</p>
                                <div className="news-footer" style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>June 12, 2024</span>
                                    <button style={{ color: '#3b82f6', border: 'none', background: 'none', fontWeight: '600', cursor: 'pointer' }}>Edit</button>
                                </div>
                            </div>
                            <div className="news-card" style={{ background: 'white', padding: '20px', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
                                <div className="news-tag" style={{ background: '#fee2e2', color: '#dc2626', display: 'inline-block', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', marginBottom: '12px' }}>URGENT</div>
                                <h3 style={{ fontSize: '1.1rem', marginBottom: '10px' }}>System Maintenance Notice</h3>
                                <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.6' }}>Online TDC platform will be undergoing scheduled maintenance this Sunday from 2AM to 5AM.</p>
                                <div className="news-footer" style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>June 10, 2024</span>
                                    <button style={{ color: '#3b82f6', border: 'none', background: 'none', fontWeight: '600', cursor: 'pointer' }}>Edit</button>
                                </div>
                            </div>
                        </div>

                        <div className="section-header" style={{ marginTop: '40px' }}>
                            <h2>Featured Videos & Tutorials</h2>
                        </div>
                        <div className="video-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '25px', marginTop: '20px' }}>
                            <div className="video-card" style={{ background: 'white', borderRadius: '20px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                <div className="video-thumb" style={{ height: '180px', background: '#1e293b', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div className="play-btn-circle" style={{ width: '50px', height: '50px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)', cursor: 'pointer' }}>
                                        <div style={{ width: 0, height: 0, borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderLeft: '15px solid white', marginLeft: '5px' }}></div>
                                    </div>
                                    <span style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem' }}>12:45</span>
                                </div>
                                <div className="video-info" style={{ padding: '20px' }}>
                                    <div style={{ color: '#3b82f6', fontSize: '0.75rem', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase' }}>Tutorial</div>
                                    <h3 style={{ fontSize: '1rem', marginBottom: '8px', color: '#1e293b' }}>Parallel Parking Mastery</h3>
                                    <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: '1.5' }}>Step-by-step guide to mastering the hardest parking maneuver.</p>
                                </div>
                            </div>
                            <div className="video-card" style={{ background: 'white', borderRadius: '20px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                <div className="video-thumb" style={{ height: '180px', background: '#334155', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div className="play-btn-circle" style={{ width: '50px', height: '50px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)', cursor: 'pointer' }}>
                                        <div style={{ width: 0, height: 0, borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderLeft: '15px solid white', marginLeft: '5px' }}></div>
                                    </div>
                                    <span style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem' }}>08:20</span>
                                </div>
                                <div className="video-info" style={{ padding: '20px' }}>
                                    <div style={{ color: '#8b5cf6', fontSize: '0.75rem', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase' }}>Highlights</div>
                                    <h3 style={{ fontSize: '1rem', marginBottom: '8px', color: '#1e293b' }}>Student Success Story: Maria Clara</h3>
                                    <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: '1.5' }}>Hear from our top graduate about her journey at Master School.</p>
                                </div>
                            </div>
                            <div className="video-card" style={{ background: 'white', borderRadius: '20px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                <div className="video-thumb" style={{ height: '180px', background: '#0f172a', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div className="play-btn-circle" style={{ width: '50px', height: '50px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)', cursor: 'pointer' }}>
                                        <div style={{ width: 0, height: 0, borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderLeft: '15px solid white', marginLeft: '5px' }}></div>
                                    </div>
                                    <span style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem' }}>15:10</span>
                                </div>
                                <div className="video-info" style={{ padding: '20px' }}>
                                    <div style={{ color: '#f59e0b', fontSize: '0.75rem', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase' }}>TDC Online</div>
                                    <h3 style={{ fontSize: '1rem', marginBottom: '8px', color: '#1e293b' }}>Traffic Signs & Regulations</h3>
                                    <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: '1.5' }}>Essential knowledge for your student permit application.</p>
                                </div>
                            </div>
                        </div>
                    </div>
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
                                        <button className="change-btn" onClick={() => setShowChangePasswordModal(true)}>Change</button>
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
                    <div className="settings-view-container">
                        <div className="settings-list-card">
                            <div className="settings-section">
                                <h3>General Settings</h3>
                                <div className="setting-row">
                                    <div className="setting-info">
                                        <h4>Email Notifications</h4>
                                        <p>Receive daily reports and enrollment alerts</p>
                                    </div>
                                    <label className="toggle-switch">
                                        <input type="checkbox" defaultChecked />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                                <div className="setting-row">
                                    <div className="setting-info">
                                        <h4>Dark Mode Preference</h4>
                                        <p>Sync with system settings</p>
                                    </div>
                                    <label className="toggle-switch">
                                        <input type="checkbox" checked={theme === 'dark'} onChange={toggleTheme} />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                            </div>

                            <div className="settings-section">
                                <h3>System Configuration</h3>
                                <div className="setting-row">
                                    <div className="setting-info">
                                        <h4>Maintenance Mode</h4>
                                        <p>Temporarily disable student bookings</p>
                                    </div>
                                    <label className="toggle-switch">
                                        <input type="checkbox" />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : activeTab === 'users' ? (
                    <UserManagement />
                ) : activeTab === 'courses' ? (
                    <CourseManagement />
                ) : null}
                {/* Add Student Modal */}
                {showStudentModal && (
                    <div className="modal-overlay">
                        <div className="modal-container user-modal">
                            <div className="modal-header">
                                <h2>Enroll New Student</h2>
                                <button className="close-modal" onClick={() => setShowStudentModal(false)}>&times;</button>
                            </div>
                            <form onSubmit={handleAddStudent}>
                                <div className="modal-body">
                                    <div className="input-group">
                                        <label>Student Full Name</label>
                                        <input
                                            type="text"
                                            name="name"
                                            placeholder="e.g. Juan Dela Cruz"
                                            value={studentData.name}
                                            onChange={handleStudentInputChange}
                                            required
                                        />
                                    </div>
                                    <div className="form-row" style={{ display: 'flex', gap: '15px' }}>
                                        <div className="input-group" style={{ flex: 1 }}>
                                            <label>Course Type</label>
                                            <select name="course" value={studentData.course} onChange={handleStudentInputChange}>
                                                <option>TDC - Online</option>
                                                <option>TDC - Face to Face</option>
                                                <option>PDC - Manual Sedan</option>
                                                <option>PDC - Automatic Sedan</option>
                                                <option>PDC - Motorcycle</option>
                                            </select>
                                        </div>
                                        <div className="input-group" style={{ flex: 1 }}>
                                            <label>Branch</label>
                                            <select name="branch" value={studentData.branch} onChange={handleStudentInputChange}>
                                                <option>Main Branch</option>
                                                <option>V. Luna Branch</option>
                                                <option>Marikina Branch</option>
                                                <option>Fairview Branch</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="form-row" style={{ display: 'flex', gap: '15px' }}>
                                        <div className="input-group" style={{ flex: 1 }}>
                                            <label>Schedule Date</label>
                                            <input
                                                type="date"
                                                name="date"
                                                value={studentData.date}
                                                onChange={handleStudentInputChange}
                                                required
                                            />
                                        </div>
                                        <div className="input-group" style={{ flex: 1 }}>
                                            <label>Initial Status</label>
                                            <select name="status" value={studentData.status} onChange={handleStudentInputChange}>
                                                <option>Pending</option>
                                                <option>Downpayment</option>
                                                <option>Full Payment</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="prev-btn" onClick={() => setShowStudentModal(false)}>Cancel</button>
                                    <button type="submit" className="add-btn">Enroll Student</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                {/* Edit Profile Modal */}
                {showEditProfileModal && (
                    <div className="modal-overlay">
                        <div className="modal-container">
                            <div className="modal-header">
                                <h2>Edit Profile</h2>
                                <button className="close-modal" onClick={() => setShowEditProfileModal(false)}>&times;</button>
                            </div>
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
                        </div>
                    </div>
                )}

                {/* Change Password Modal */}
                {showChangePasswordModal && (
                    <div className="modal-overlay">
                        <div className="modal-container">
                            <div className="modal-header">
                                <h2>Change Password</h2>
                                <button className="close-modal" onClick={() => setShowChangePasswordModal(false)}>&times;</button>
                            </div>
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
                                    <button type="button" className="cancel-btn" onClick={() => setShowChangePasswordModal(false)}>Cancel</button>
                                    <button type="submit" className="confirm-btn red">Update Password</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};


export default Admin;
