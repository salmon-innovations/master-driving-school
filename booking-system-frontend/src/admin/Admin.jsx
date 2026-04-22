import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import './css/Dashboard.css';
import './css/responsive_tables.css';
import './css/admin-scrollbar.css';
import Sidebar from './components/Sidebar';

// Lazy-load heavy admin pages for code-splitting — each loads only when first visited.
const Schedule         = lazy(() => import('./Schedule'));
const Booking          = lazy(() => import('./Booking'));
const SalePayment      = lazy(() => import('./SalePayment'));
const UserManagement   = lazy(() => import('./User'));
const WalkInEnrollment = lazy(() => import('./WalkInEnrollment'));
const CourseManagement = lazy(() => import('./CourseManagement'));
const Configuration    = lazy(() => import('./Configuration'));
const NewsEvents       = lazy(() => import('./NewsEvents'));
const AnalyticsReports = lazy(() => import('./AnalyticsReports'));
const CRMManagement    = lazy(() => import('./CRM'));

// Minimal inline fallback — shown while the lazy chunk is downloading.
const TabLoadingFallback = () => (
    <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '60vh', flexDirection: 'column', gap: '16px',
        color: 'var(--secondary-text)',
    }}>
        <div style={{
            width: '40px', height: '40px', border: '3px solid var(--border-color)',
            borderTopColor: 'var(--primary-color)', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
        }} />
        <span style={{ fontSize: '0.9rem' }}>Loading...</span>
    </div>
);
import { useTheme } from '../context/ThemeContext';
import { useNotification } from '../context/NotificationContext';
import { authAPI, adminAPI, notificationsAPI, MEDIA_BASE_URL, branchesAPI } from '../services/api';
import { resolveAvatar } from '../utils/avatarUtils';
import { normalizeNotificationText } from '../utils/notificationText';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

const logo = '/images/logo.png';
const cover = '/images/cover.png';

const ADMIN_TAB_TO_PATH = {
    dashboard: '/admin/dashboard',
    schedules: '/admin/schedules',
    bookings: '/admin/bookings',
    'walk-in': '/admin/walk-in',
    sales: '/admin/sales',
    crm: '/admin/crm',
    analytics: '/admin/analytics',
    'best-selling-courses': '/admin/best-selling-courses',
    users: '/admin/users',
    courses: '/admin/courses',
    branches: '/admin/branches',
    news: '/admin/news',
    profile: '/admin/profile',
    settings: '/admin/settings',
    notifications: '/admin/notifications',
};

const ADMIN_PATH_TO_TAB = Object.entries(ADMIN_TAB_TO_PATH).reduce((acc, [tab, path]) => {
    acc[path] = tab;
    return acc;
}, {});

const normalizeAdminPath = (pathname = '/admin') => {
    const clean = pathname.trim();
    if (!clean || clean === '/') return '/admin';
    return clean.replace(/\/+$/, '') || '/admin';
};

const getAdminTabFromPath = (pathname = '/admin') => {
    const path = normalizeAdminPath(pathname);
    if (path === '/admin') return 'dashboard';
    return ADMIN_PATH_TO_TAB[path] || null;
};

const getAdminPathForTab = (tab) => ADMIN_TAB_TO_PATH[tab] || '/admin/dashboard';
const ADMIN_SETTINGS_KEY = 'mds_admin_settings';
const DASH_CACHE_KEY = 'admin_dash_snapshot_v1';
const DASH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const readDashCache = () => {
    try {
        const raw = sessionStorage.getItem(DASH_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed?.ts && Date.now() - parsed.ts < DASH_CACHE_TTL_MS) return parsed;
    } catch {}
    return null;
};

const readAdminSettings = () => {
    try {
        const saved = localStorage.getItem(ADMIN_SETTINGS_KEY);
        return saved ? JSON.parse(saved) : {};
    } catch {
        return {};
    }
};

const ADMIN_DEFAULT_PERMISSIONS_BY_ROLE = {
    admin: [
        'operations.schedules.manage',
        'operations.schedules.tab.schedule',
        'operations.schedules.tab.summary',
        'operations.schedules.tab.noshow',
        'operations.schedules.tab.tdc_online',
        'operations.bookings.manage',
        'operations.walk_in.manage',
        'operations.sales.manage',
        'operations.crm.manage',
        'operations.news.manage',
        'operations.analytics.view',
        'operations.best_selling_courses.view',
        'accounts.users.view',
        'accounts.users.create',
        'accounts.users.edit',
        'accounts.users.reset_password',
        'accounts.courses.view',
        'accounts.courses.tab.courses',
        'accounts.courses.tab.discounts',
        'accounts.courses.tab.config',
        'accounts.config.view',
        'accounts.config.tab.branches',
        'accounts.config.tab.coursetypes',
        'accounts.config.tab.emailcontent',
        'accounts.config.tab.settings',
    ],
};

const ADMIN_TAB_PERMISSION_MAP = {
    schedules: 'operations.schedules.manage',
    bookings: 'operations.bookings.manage',
    'walk-in': 'operations.walk_in.manage',
    sales: 'operations.sales.manage',
    crm: 'operations.crm.manage',
    analytics: 'operations.analytics.view',
    'best-selling-courses': 'operations.best_selling_courses.view',
    news: 'operations.news.manage',
    users: [
        'accounts.users.view',
        'accounts.users.create',
        'accounts.users.edit',
        'accounts.users.status',
        'accounts.users.reset_password',
    ],
    courses: 'accounts.courses.view',
    branches: 'accounts.config.view',
};

const ALWAYS_ALLOWED_ADMIN_TABS = new Set(['dashboard', 'profile', 'settings', 'notifications']);

const normalizePermissions = (permissions) => {
    if (!Array.isArray(permissions)) return [];
    return permissions.filter((permission) => typeof permission === 'string');
};

const hasRequiredPermission = (permissionSet, requiredPermission) => {
    if (Array.isArray(requiredPermission)) {
        return requiredPermission.some((permission) => permissionSet.has(permission));
    }
    return permissionSet.has(requiredPermission);
};

const getDefaultAdminTab = (allowedTabs) => {
    const priority = ['dashboard', 'schedules', 'bookings', 'walk-in', 'sales', 'crm', 'news', 'analytics', 'best-selling-courses', 'users', 'courses', 'branches', 'profile', 'settings', 'notifications'];
    return priority.find((tab) => allowedTabs.has(tab)) || 'profile';
};

const getEffectiveBalanceDue = (booking = {}) => {
    // Priority 1: Backend-calculated balance_due (from getUnpaidBookings)
    if (booking.balance_due !== undefined && booking.balance_due !== null) {
        return Math.max(0, Number(parseFloat(booking.balance_due).toFixed(2)));
    }
    if (booking.balanceDue !== undefined && booking.balanceDue !== null) {
        return Math.max(0, Number(parseFloat(booking.balanceDue).toFixed(2)));
    }

    // Inferred from payment fields (Fallback for legacy or cached data)
    const paid = Number(parseFloat(booking?.total_amount || 0).toFixed(2));
    const listedCoursePrice = Number(parseFloat(booking?.course_price || 0).toFixed(2));
    const paymentType = String(booking?.payment_type || '').toLowerCase();
    
    let assessed = listedCoursePrice;
    if (paymentType.includes('down')) {
        assessed = Math.max(listedCoursePrice, paid * 2);
    }
    
    return Math.max(0, Number((assessed - paid).toFixed(2)));
};

const Admin = ({ onNavigate, setIsLoggedIn }) => {
    const { theme, toggleTheme } = useTheme();
    const { showNotification } = useNotification();
    const [activeTab, setActiveTab] = useState(() => getAdminTabFromPath(window.location.pathname) || localStorage.getItem('adminActiveTab') || 'dashboard');
    const [showTdcOnlineModal, setShowTdcOnlineModal] = useState(false);
    const [tdcOnlineQueue, setTdcOnlineQueue] = useState({ data: [], loading: false });
    const hasInitializedAdminPath = useRef(false);
    const autoOpenedOnlineTdcIdsRef = useRef(new Set());
    const lastOnlineTdcReminderAtRef = useRef(0);
    const [tdcOnlineAlertsEnabled, setTdcOnlineAlertsEnabled] = useState(() => readAdminSettings().tdcOnlineAlerts !== false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);

    // Hydrate dashboard cache before any state — used by loading + data states below
    const _dashCache = readDashCache();
    const [loading, setLoading] = useState(!_dashCache);
    const [userPermissions, setUserPermissions] = useState([]);

    // Admin Profile State
    const [adminProfile, setAdminProfile] = useState({
        name: 'Admin User',
        email: 'admin@masterschool.edu',
        phone: '+63 912 345 6789',
        branch: 'Main Office',
        role: 'Admin',
        rawRole: 'admin',
        avatar: null
    });

    // Dashboard stats state — hydrate from cache for instant display on reload
    const [stats, setStats] = useState(_dashCache?.stats ?? {
        totalStudents: 0,
        monthlyRevenue: 0,
        pendingBookings: 0,
        todayEnrollments: 0,
    });

    const [pendingCollectibles, setPendingCollectibles] = useState(_dashCache?.collectibles ?? []);
    const [pendingCollectiblesTotal, setPendingCollectiblesTotal] = useState(_dashCache?.collectiblesTotal ?? 0);
    const [todayScheduleGroups, setTodayScheduleGroups] = useState(_dashCache?.todaySchedule ?? []);
    const [bestSellingCourses, setBestSellingCourses] = useState([]);
    const [bestSellingLoading, setBestSellingLoading] = useState(false);
    const [bestSellingBranchId, setBestSellingBranchId] = useState('');
    const [bestSellingFilter, setBestSellingFilter] = useState('all_time');
    const [adminBranches, setAdminBranches] = useState([]);
    const [enrollees, setEnrollees] = useState(_dashCache?.enrollees ?? []);

    const formatCurrency = (amount) => `₱ ${Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const allowedAdminTabs = useMemo(() => {
        const role = String(adminProfile.rawRole || '').toLowerCase();
        // super_admin gets everything
        if (role === 'super_admin') {
            return new Set([...ALWAYS_ALLOWED_ADMIN_TABS, ...Object.keys(ADMIN_TAB_PERMISSION_MAP)]);
        }
        const fallbackPermissions = ADMIN_DEFAULT_PERMISSIONS_BY_ROLE[role] || [];
        const effectivePermissions = normalizePermissions(userPermissions).length > 0
            ? normalizePermissions(userPermissions)
            : fallbackPermissions;

        const permissionSet = new Set(effectivePermissions);
        const allowed = new Set(ALWAYS_ALLOWED_ADMIN_TABS);

        Object.entries(ADMIN_TAB_PERMISSION_MAP).forEach(([tab, requiredPermission]) => {
            if (hasRequiredPermission(permissionSet, requiredPermission)) {
                allowed.add(tab);
            }
        });

        return allowed;
    }, [adminProfile.rawRole, userPermissions]);

    const effectiveAdminPermissions = useMemo(() => {
        const role = String(adminProfile.rawRole || '').toLowerCase();
        const fallbackPermissions = ADMIN_DEFAULT_PERMISSIONS_BY_ROLE[role] || [];
        return normalizePermissions(userPermissions).length > 0
            ? normalizePermissions(userPermissions)
            : fallbackPermissions;
    }, [adminProfile.rawRole, userPermissions]);

    const defaultAllowedAdminTab = useMemo(() => getDefaultAdminTab(allowedAdminTabs), [allowedAdminTabs]);

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
        if (!allowedAdminTabs.has(activeTab)) {
            setActiveTab(defaultAllowedAdminTab);
        }
    }, [activeTab, allowedAdminTabs, defaultAllowedAdminTab]);

    useEffect(() => {
        localStorage.setItem('adminActiveTab', activeTab);

        const currentPath = normalizeAdminPath(window.location.pathname);
        const targetPath = getAdminPathForTab(activeTab);

        if (currentPath !== targetPath) {
            if (!hasInitializedAdminPath.current) {
                window.history.replaceState({}, '', targetPath);
            } else {
                window.history.pushState({}, '', targetPath);
            }
        }

        if (!hasInitializedAdminPath.current) {
            hasInitializedAdminPath.current = true;
        }
    }, [activeTab]);

    useEffect(() => {
        const handlePopState = () => {
            const tabFromPath = getAdminTabFromPath(window.location.pathname);
            if (tabFromPath) {
                setActiveTab(allowedAdminTabs.has(tabFromPath) ? tabFromPath : defaultAllowedAdminTab);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [allowedAdminTabs, defaultAllowedAdminTab]);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [scheduleNavigationTarget, setScheduleNavigationTarget] = useState({ view: null, token: 0 });

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
                        title: normalizeNotificationText(n.title),
                        message: normalizeNotificationText(n.message),
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

    const openScheduleFromNotification = (notification, event) => {
        if (event) event.stopPropagation();
        if (!notification?.id) return;
        markAsRead(notification.id);
        setShowNotifications(false);
        if (notification.notifType === 'online_tdc_account_setup') {
            fetchTdcOnlineQueue();
            setShowTdcOnlineModal(true);
        }
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
    const onlineTdcUnreadCount = notifications.filter(
        n => !n.read && n.notifType === 'online_tdc_account_setup'
    ).length;
    const [showNotifications, setShowNotifications] = useState(false);

    const fetchTdcOnlineQueue = async () => {
        try {
            setTdcOnlineQueue(prev => ({ ...prev, loading: true }));
            const res = await adminAPI.getTdcOnlineStudents({ branchId: adminProfile.branchId || undefined });
            if (res.success) {
                const rawData = Array.isArray(res.data) ? res.data : [];
                const filtered = rawData.filter(row => {
                    const isTdcOnlineOrBundle = /online|otdc|bundle|\+/i.test(row.course_name || '') || 
                                              /online|otdc/i.test(row.course_type || '');
                    return isTdcOnlineOrBundle;
                });
                setTdcOnlineQueue({ data: filtered, loading: false });
            }
        } catch (err) {
            console.error('Failed to load TDC Online queue:', err);
            setTdcOnlineQueue({ data: [], loading: false });
        }
    };

    const handleTdcOnlineDone = async (bookingId) => {
        try {
            await adminAPI.updateBookingStatus(bookingId, null, { isTdcOnlineOnboarded: true });
            // Decrease the alert count by marking the notification as read locally
            markAsRead(String(bookingId));
            showNotification('TDC Online account setup marked as done.', 'success');
            // Refresh local queue
            setTdcOnlineQueue(prev => ({
                ...prev,
                data: prev.data.filter(item => String(item.booking_id) !== String(bookingId))
            }));
            // Refresh dashboard and notifications
            fetchNotifications();
        } catch (err) {
            showNotification(err.message || 'Failed to mark as done', 'error');
        }
    };

    // Refresh notifications on mount and auto-refresh every 30s.
    useEffect(() => {
    fetchNotifications();
    // Poll every 45 s — reduced from 30 s to lower Render Starter request count
    const interval = setInterval(fetchNotifications, 45000);
    return () => clearInterval(interval);
    }, []);

    // When notifications dropdown is open, poll faster so urgent items appear quickly.
    useEffect(() => {
    if (!showNotifications) return undefined;
    // Poll every 20 s when panel open (was 10 s) — still fast enough to show new items
    const interval = setInterval(fetchNotifications, 20000);
    return () => clearInterval(interval);
    }, [showNotifications]);

    // Zero-click path: if a new Online TDC alert arrives while on dashboard,
    // auto-route once to the TDC Online queue so branch/admin can act immediately.
    useEffect(() => {
        if (!tdcOnlineAlertsEnabled) return;
        if (activeTab !== 'dashboard') return;
        if (!allowedAdminTabs.has('schedules')) return;

        const nextOnlineTdc = notifications.find(
            (n) => !n.read
                && n.notifType === 'online_tdc_account_setup'
                && !autoOpenedOnlineTdcIdsRef.current.has(n.id)
        );

        if (!nextOnlineTdc) return;

        autoOpenedOnlineTdcIdsRef.current.add(nextOnlineTdc.id);
        setScheduleNavigationTarget({ view: 'tdc_online', token: Date.now() });
        setActiveTab('schedules');
        showNotification('Opened TDC Online queue for new enrollment.', 'info');
    }, [activeTab, notifications, allowedAdminTabs, tdcOnlineAlertsEnabled]);

    useEffect(() => {
        const syncAdminSettings = () => {
            const settings = readAdminSettings();
            setTdcOnlineAlertsEnabled(settings.tdcOnlineAlerts !== false);
        };

        window.addEventListener('storage', syncAdminSettings);
        window.addEventListener('mds-admin-settings-updated', syncAdminSettings);

        return () => {
            window.removeEventListener('storage', syncAdminSettings);
            window.removeEventListener('mds-admin-settings-updated', syncAdminSettings);
        };
    }, []);

    // Toast alert path: recurring reminder every ~30s while Online TDC onboarding is pending.
    // Disabled when TDC Online Alerts is turned off in System Settings.
    useEffect(() => {
        if (!tdcOnlineAlertsEnabled) {
            lastOnlineTdcReminderAtRef.current = 0;
            return;
        }

        const pendingOnlineTdc = notifications.filter(
            (n) => !n.read && n.notifType === 'online_tdc_account_setup'
        );

        if (pendingOnlineTdc.length === 0) {
            lastOnlineTdcReminderAtRef.current = 0;
            return;
        }

        const now = Date.now();
        const shouldRemind =
            lastOnlineTdcReminderAtRef.current === 0
            || now - lastOnlineTdcReminderAtRef.current >= 30000;

        if (shouldRemind) {
            lastOnlineTdcReminderAtRef.current = now;
            showNotification(
                `Online TDC reminder: ${pendingOnlineTdc.length} enrollment${pendingOnlineTdc.length > 1 ? 's' : ''} pending provider account setup.`,
                'info',
                15000,
                {
                    label: 'View Pending Queue',
                    onClick: () => {
                        fetchTdcOnlineQueue();
                        setShowTdcOnlineModal(true);
                    }
                }
            );
        }
    }, [notifications, showNotification, tdcOnlineAlertsEnabled]);

    // Listen for cross-component notification updates (e.g. from Schedule.jsx)
    useEffect(() => {
        const handleMarkReadEvent = (e) => {
            const { id } = e.detail || {};
            if (id) {
                markAsRead(String(id));
                // Refresh core data to ensure sync across views
                fetchNotifications();
                fetchTdcOnlineQueue();
            }
        };

        window.addEventListener('mds-mark-notification-read', handleMarkReadEvent);
        return () => window.removeEventListener('mds-mark-notification-read', handleMarkReadEvent);
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
                        gender: user.gender || null,
                        role: user.role === 'super_admin' ? 'Super Admin' :
                              user.role === 'admin' ? 'Admin' :
                            'User',
                        rawRole: user.role || 'admin',
                        avatar: user.avatar || null,
                    });
                    setUserPermissions(normalizePermissions(user.permissions));
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
                    const [statsRes, bookingsRes, unpaidRes, todayScheduleRes] = await Promise.all([
                        adminAPI.getStats(),
                        adminAPI.getAllBookings(null, 10, adminProfile.branchId || undefined),
                        adminAPI.getUnpaidBookings(10, adminProfile.branchId || undefined),
                        adminAPI.getTodayStudents({
                            date: new Date().toISOString().split('T')[0],
                            branchId: adminProfile.branchId || undefined,
                        }),
                    ]);

                    if (statsRes.success) setStats(statsRes.stats);

                    let formattedEnrollees = [];
                    if (bookingsRes.success) {
                        formattedEnrollees = bookingsRes.bookings.map(booking => ({
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

                    let collectibles = [];
                    let collectiblesTotal = 0;
                    if (unpaidRes.success) {
                        collectibles = unpaidRes.bookings || [];
                        collectiblesTotal = collectibles.reduce((sum, booking) => sum + getEffectiveBalanceDue(booking), 0);
                        setPendingCollectibles(collectibles);
                        setPendingCollectiblesTotal(collectiblesTotal);
                    } else {
                        setPendingCollectibles([]);
                        setPendingCollectiblesTotal(0);
                    }

                    let todaySchedule = [];
                    if (todayScheduleRes.success) {
                        todaySchedule = todayScheduleRes.data || [];
                        setTodayScheduleGroups(todaySchedule);
                    } else {
                        setTodayScheduleGroups([]);
                    }

                    // Save snapshot to sessionStorage for instant reload
                    try {
                        sessionStorage.setItem(DASH_CACHE_KEY, JSON.stringify({
                            ts: Date.now(),
                            stats: statsRes.success ? statsRes.stats : stats,
                            enrollees: formattedEnrollees,
                            collectibles,
                            collectiblesTotal,
                            todaySchedule,
                        }));
                    } catch (_) {}

                    setLoading(false); // Show the dashboard cards and table

                } catch (error) {
                    console.error('Error fetching dashboard data:', error);
                    showNotification('Failed to load dashboard statistics', 'error');
                    setLoading(false);
                }
            }
        };

        fetchDashboardData();
    }, [activeTab, adminProfile.branchId, showNotification]);

    useEffect(() => {
        const fetchBestSellingCourses = async () => {
            if (activeTab !== 'best-selling-courses') return;
            setBestSellingLoading(true);
            try {
                let currentBranches = adminBranches;
                if (currentBranches.length === 0) {
                    const branchRes = await branchesAPI.getAll();
                    if (branchRes.success) {
                        currentBranches = branchRes.branches || [];
                        setAdminBranches(currentBranches);
                    }
                }
                
                // Determine effective branch ID based on role
                let effectiveBranchId = bestSellingBranchId;
                if (adminProfile.rawRole === 'admin') {
                    effectiveBranchId = adminProfile.branchId;
                } else if (!effectiveBranchId) {
                    effectiveBranchId = undefined; // All branches for super_admin
                }

                const bestSellingRes = await adminAPI.getBestSellingCourses(effectiveBranchId, bestSellingFilter);
                if (bestSellingRes.success) {
                    setBestSellingCourses(bestSellingRes.courses || []);
                } else {
                    setBestSellingCourses([]);
                }
            } catch (error) {
                console.error('Error fetching best selling courses:', error);
                setBestSellingCourses([]);
            } finally {
                setBestSellingLoading(false);
            }
        };

        fetchBestSellingCourses();
    }, [activeTab, bestSellingBranchId, bestSellingFilter, adminProfile.branchId, adminProfile.rawRole]);


    const fileInputRef = useRef(null);

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            showNotification('Image must be smaller than 5MB', 'error');
            return;
        }
        // Show a preview immediately
        const reader = new FileReader();
        reader.onloadend = () => {
            setAdminProfile(prev => ({ ...prev, avatar: reader.result }));
        };
        reader.readAsDataURL(file);
        // Upload to server
        try {
            const response = await authAPI.uploadAvatar(file);
            if (response.success) {
                setAdminProfile(prev => ({ ...prev, avatar: response.avatarUrl }));
                showNotification('Profile picture updated!', 'success');
            }
        } catch (err) {
            showNotification(err.message || 'Failed to upload profile picture', 'error');
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current.click();
    };

    const [showEditProfileModal, setShowEditProfileModal] = useState(false);
    const [editProfileTab, setEditProfileTab] = useState('personal');
    
    const [profileFormData, setProfileFormData] = useState({ ...adminProfile });
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    // Opens the edit modal and syncs form data at click time (avoids infinite useEffect loop)
    const openEditProfileModal = (tab = 'personal') => {
        setProfileFormData({ ...adminProfile });
        setEditProfileTab(tab);
        setShowEditProfileModal(true);
    };

    const [sessionTimedOut, setSessionTimedOut] = useState(false);


    // Clock update effect
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const handleLogout = (timedOut) => {
        localStorage.removeItem('token');
        localStorage.removeItem('userToken');
        localStorage.removeItem('user');
        if (timedOut === true) {
            setSessionTimedOut(true);
            return; // show the overlay; user clicks "Sign In Again" to navigate
        }
        if (setIsLoggedIn) setIsLoggedIn(false);
        onNavigate('signin');
    };

    // ── Session Timeout ────────────────────────────────────────
    useEffect(() => {
        const getTimeoutMs = () => {
            try {
                const saved = localStorage.getItem(ADMIN_SETTINGS_KEY);
                const parsed = saved ? JSON.parse(saved) : {};
                const minutes = Number(parsed.sessionTimeout) || 60;
                return Math.max(5, minutes) * 60 * 1000;
            } catch { return 60 * 60 * 1000; }
        };

        let timeoutId;

        const resetTimer = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => handleLogout(true), getTimeoutMs());
        };

        const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
        ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, resetTimer, { passive: true }));

        resetTimer(); // start the timer on mount

        return () => {
            clearTimeout(timeoutId);
            ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, resetTimer));
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleProfileClick = () => {
        setActiveTab('profile');
        setShowProfileModal(false);
    };

    const handleSettingsClick = () => {
        setActiveTab('settings');
        setShowProfileModal(false);
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        try {
            // Split name into first, middle, last
            const nameParts = (profileFormData.name || '').trim().split(/\s+/);
            let firstName = '', middleName = '', lastName = '';

            if (nameParts.length === 1) {
                firstName = nameParts[0];
            } else if (nameParts.length === 2) {
                firstName = nameParts[0];
                lastName = nameParts[1];
            } else {
                firstName = nameParts[0];
                lastName = nameParts[nameParts.length - 1];
                middleName = nameParts.slice(1, -1).join(' ');
            }

            const updateData = {
                firstName,
                middleName,
                lastName,
                email: profileFormData.email,
                contactNumbers: profileFormData.phone,
                // Add any other fields mapped in backend if needed
            };

            const response = await authAPI.updateProfile(updateData);
            
            if (response.user) {
                const user = response.user;
                setAdminProfile(prev => ({
                    ...prev,
                    name: `${user.first_name} ${user.middle_name || ''} ${user.last_name}`.trim().replace(/\s+/g, ' '),
                    email: user.email,
                    phone: user.contact_numbers,
                    // If branch is updated by backend, sync it too
                    branch: user.branchName || prev.branch
                }));
                showNotification('Profile updated successfully!', 'success');
                setShowEditProfileModal(false);
            }
        } catch (error) {
            showNotification(error.message || 'Failed to update profile', 'error');
        }
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
            setShowEditProfileModal(false);
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

    const formatBranchNameShort = (name) => {
        if (!name) return '';
        return name
            .replace(/^Master(s)?\s+(Prime\s+)?Driving\s+School\s+/i, '')
            .replace(/^Master(s)?\s+(Prime\s+)?Holdings\s+Corp\.\s+/i, '')
            .replace(/^PRIME\s+MASTER\s+DRIVING\s+SCHOOL\s+/i, '')
            .trim();
    };

    const formatCourseNameShort = (name) => {
        if (!name) return '';
        const source = String(name);
        const upper = source.toUpperCase();
        const parenMatches = [...source.matchAll(/\(([^)]+)\)/g)].map((m) => String(m[1] || '').trim());

        if (upper.includes('TDC')) return 'TDC';

        if (upper.includes('PDC')) {
            const variant = parenMatches.find((v) => {
                const vu = v.toUpperCase();
                return vu !== 'PDC' && /CAR|MOTOR|TRICYCLE|A1|B1|B2|VAN|L300|MANUAL|AUTOMATIC/.test(vu);
            }) || parenMatches[parenMatches.length - 1] || 'PDC';

            const compactVariant = variant
                .replace(/\s+/g, ' ')
                .replace(/^B1\s*-\s*VAN\s*\/\s*B2\s*-\s*L300$/i, 'B1/B2')
                .replace(/^MOTORCYCLE$/i, 'MOTO')
                .replace(/^TRICYCLE$/i, 'TRI')
                .replace(/^AUTOMATIC$/i, 'AT')
                .replace(/^MANUAL$/i, 'MT');

            return compactVariant.toUpperCase() === 'PDC' ? 'PDC' : `PDC-${compactVariant}`;
        }

        // Fallback: take first 15 chars
        return name.length > 15 ? name.substring(0, 15) + '...' : name;
    };

    const renderBestSellingCoursesSection = () => {
        // Find current branch name for display
        let activeBranchName = 'All Branches';
        if (adminProfile.rawRole === 'admin') {
            activeBranchName = adminProfile.branch || 'Assigned Branch';
        } else if (bestSellingBranchId) {
            const rawName = adminBranches.find(b => String(b.id) === String(bestSellingBranchId))?.name || 'Selected';
            activeBranchName = formatBranchNameShort(rawName);
        }

        const isSuperAdmin = adminProfile.rawRole === 'super_admin';

        return (
        <section className="data-section best-courses-section">
            <div className="section-header">
                <div>
                    <h2>Best Selling Courses</h2>
                    <p className="section-subtitle">Analyze top performing courses and revenue</p>
                </div>
            </div>

            {/* Filter Banner */}
            <div style={{
                background: 'var(--card-bg)',
                borderRadius: '16px',
                padding: '16px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '24px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                flexWrap: 'wrap',
                gap: '16px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                        background: 'var(--primary-color)',
                        color: 'white',
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Viewing Branch
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-color)' }}>
                            {activeBranchName}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    {isSuperAdmin && (
                        <>
                            <span style={{ 
                                background: 'rgba(var(--primary-rgb), 0.1)', 
                                color: 'var(--primary-color)', 
                                padding: '6px 12px', 
                                borderRadius: '8px', 
                                fontSize: '0.85rem', 
                                fontWeight: 600 
                            }}>
                                {adminBranches.length} Branches
                            </span>
                            <select 
                                className="custom-select" 
                                value={bestSellingBranchId} 
                                onChange={(e) => setBestSellingBranchId(e.target.value)}
                                style={{ padding: '8px 36px 8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--card-bg)' }}
                            >
                                <option value="">All Branches</option>
                                {adminBranches.map(b => (
                                    <option key={b.id} value={b.id}>{formatBranchNameShort(b.name)}</option>
                                ))}
                            </select>
                        </>
                    )}
                    
                    <select 
                        className="custom-select" 
                        value={bestSellingFilter} 
                        onChange={(e) => setBestSellingFilter(e.target.value)}
                        style={{ padding: '8px 36px 8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--card-bg)' }}
                    >
                        <option value="all_time">All Time</option>
                        <option value="today">Today</option>
                        <option value="this_week">This Week</option>
                        <option value="this_month">This Month</option>
                        <option value="this_year">This Year</option>
                    </select>
                </div>
            </div>

            {/* Graph Visualization */}
            {!bestSellingLoading && bestSellingCourses.length > 0 && (
                <div style={{
                    background: 'var(--card-bg)',
                    borderRadius: '16px',
                    padding: '24px',
                    marginBottom: '24px',
                    border: '1px solid var(--border-color)',
                    height: '400px'
                }}>
                    <h3 style={{ textAlign: 'center', marginBottom: '24px', fontSize: '1.05rem', color: 'var(--secondary-text)', fontWeight: 500 }}>Enrollments Overview</h3>
                    <ResponsiveContainer width="100%" height="90%">
                        <BarChart 
                            data={bestSellingCourses.map(c => ({ 
                                fullname: c.course_name, 
                                name: formatCourseNameShort(c.course_name), 
                                enrollments: Number(c.total_bookings),
                                revenue: Number(c.total_revenue)
                            }))} 
                            margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                            <XAxis 
                                dataKey="name" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: 'var(--secondary-text)', fontSize: 11 }} 
                                dy={10} 
                            />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: 'var(--secondary-text)', fontSize: 11 }} 
                                dx={-10}
                            />
                            <RechartsTooltip 
                                contentStyle={{ borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '12px' }}
                                cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                                formatter={(value, name) => [name === 'enrollments' ? value : formatCurrency(value), name === 'enrollments' ? 'Enrollments' : 'Revenue']}
                                labelFormatter={(label, payload) => payload?.[0]?.payload?.fullname || label}
                            />
                            <Bar dataKey="enrollments" fill="#1e40af" radius={[4, 4, 0, 0]} maxBarSize={45} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {bestSellingLoading ? (
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
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '24px',
                    padding: '16px 0',
                    position: 'relative'
                }}>
                    {bestSellingCourses.map((course, index) => (
                        <div
                            key={course.id}
                            style={{
                                background: '#fff',
                                borderRadius: '16px',
                                padding: '24px',
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                                display: 'flex',
                                flexDirection: 'column',
                                position: 'relative',
                                transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-4px)';
                                e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.1)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            {index < 3 ? (
                                <div style={{
                                    position: 'absolute', top: '-12px', right: '-12px',
                                    background: index === 0 ? '#f59e0b' : index === 1 ? '#64748b' : '#d97706',
                                    color: 'white', width: '36px', height: '36px',
                                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 800, fontSize: '1.1rem', boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                                    zIndex: 2, border: '3px solid var(--card-bg)'
                                }}>
                                    {index + 1}
                                </div>
                            ) : null}

                            <div style={{ padding: '0 8px', marginBottom: '24px', textAlign: 'center', flexGrow: 1 }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '12px', color: 'var(--text-color)', lineHeight: 1.4 }}>
                                    {course.course_name}
                                </h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--secondary-text)', lineHeight: 1.5 }}>
                                    {course.description || 'LTO Accredited Licensing Program Flexible Lesson Times Experienced Instructors'}
                                </p>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
                                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 12px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.05em', marginBottom: '8px' }}>ENROLLMENTS</div>
                                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e40af' }}>{course.total_bookings}</div>
                                </div>
                                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 12px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.05em', marginBottom: '8px' }}>REVENUE</div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>{formatCurrency(course.total_revenue)}</div>
                                </div>
                            </div>

                            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
                                <div style={{ color: '#64748b', fontWeight: 600 }}>
                                    Price: {formatCurrency(course.price)}
                                </div>
                                <div style={{ color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    ✓ {course.completed_bookings} Completed
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
        );
    };

    return (
        <>
        {/* Session Expired Overlay */}
        {sessionTimedOut && (
            <div style={{
                position: 'fixed', inset: 0, zIndex: 99999,
                background: 'rgba(10,15,30,0.82)',
                backdropFilter: 'blur(6px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <div style={{
                    background: 'var(--card-bg, #fff)',
                    borderRadius: '20px',
                    padding: '48px 40px 40px',
                    maxWidth: '420px', width: '90%',
                    textAlign: 'center',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
                }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: '50%',
                        background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 20px',
                    }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                    </div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary-text,#0f172a)', marginBottom: 10 }}>
                        Session Expired
                    </h2>
                    <p style={{ fontSize: '0.9rem', color: 'var(--secondary-text,#64748b)', marginBottom: 28, lineHeight: 1.6 }}>
                        Your session has timed out due to inactivity.<br/>Please sign in again to continue.
                    </p>
                    <button
                        onClick={() => { if (setIsLoggedIn) setIsLoggedIn(false); onNavigate('signin'); }}
                        style={{
                            width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
                            background: 'linear-gradient(135deg,#1a4fba,#2563eb)',
                            color: '#fff', fontSize: '0.95rem', fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        Sign In Again
                    </button>
                </div>
            </div>
        )}
        <div className={`dashboard-container ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            <Sidebar
                isSidebarOpen={isSidebarOpen}
                setIsSidebarOpen={setIsSidebarOpen}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onNavigate={onNavigate}
                handleLogout={handleLogout}
                allowedTabs={allowedAdminTabs}
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
                                                activeTab === 'best-selling-courses' ? 'Best Selling Courses' :
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
                        {(adminProfile.rawRole === 'admin') && (
                            <div
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 14px',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(59, 130, 246, 0.25)',
                                    background: 'rgba(59, 130, 246, 0.08)',
                                    color: '#1d4ed8',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                }}
                                title="Assigned branch"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                    <circle cx="12" cy="10" r="3"></circle>
                                </svg>
                                <span>{formatBranchNameShort(adminProfile.branch || 'Assigned Branch')}</span>
                            </div>
                        )}
                        <div className="notification-wrapper">
                            <button
                                className={`notification-btn ${showNotifications ? 'active' : ''} ${onlineTdcUnreadCount > 0 ? 'has-online-tdc-alert' : ''}`}
                                title="View Notifications"
                                onClick={() => setShowNotifications(!showNotifications)}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                                </svg>
                                {unreadCount > 0 && (
                                    <span className={`notification-badge ${onlineTdcUnreadCount > 0 ? 'online-tdc-badge' : ''}`}></span>
                                )}
                            </button>

                            {showNotifications && (
                                <>
                                    <div className="dropdown-overlay" onClick={() => setShowNotifications(false)}></div>
                                    <div className="notification-dropdown animate-dropdown">
                                        <div className="dropdown-header" style={{ display: 'flex', flexWrap: 'nowrap', gap: '8px', overflow: 'hidden' }}>
                                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', margin: 0, flex: 1 }}>
                                                Notifications
                                                {unreadCount > 0 && (
                                                    <span style={{ background: '#6366f1', color: '#fff', borderRadius: 99, fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px' }}>
                                                        {unreadCount}
                                                    </span>
                                                )}
                                                {onlineTdcUnreadCount > 0 && (
                                                    <span className="online-tdc-pill" title="Online TDC enrollments waiting for provider account setup" style={{ whiteSpace: 'nowrap' }}>
                                                        Online TDC: {onlineTdcUnreadCount}
                                                    </span>
                                                )}
                                            </h3>
                                            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                                                <button
                                                    className="clear-all-btn"
                                                    title="Refresh"
                                                    onClick={fetchNotifications}
                                                    style={{ padding: '4px 8px', fontSize: '1rem', lineHeight: 1 }}
                                                >
                                                    {notifLoading ? '…' : '↻'}
                                                </button>
                                                {notifications.length > 0 && (
                                                    <button className="clear-all-btn" onClick={clearAllNotifications} style={{ whiteSpace: 'nowrap' }}>Clear All</button>
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
                                                    <div
                                                        key={n.id}
                                                        className={`notification-item ${n.read ? 'read' : 'unread'} ${n.notifType === 'online_tdc_account_setup' ? 'online-tdc-notif' : ''}`}
                                                        onClick={() => {
                                                            if (n.notifType === 'online_tdc_account_setup') {
                                                                openScheduleFromNotification(n);
                                                            } else {
                                                                markAsRead(n.id);
                                                            }
                                                        }}
                                                    >
                                                        <div className={`status-dot ${n.type} ${n.notifType === 'online_tdc_account_setup' ? 'online-tdc' : ''}`}></div>
                                                        <div className="notify-content">
                                                            <div className="notify-title-row">
                                                                <h4>{n.title}</h4>
                                                                <span className="notify-time">{n.time}</span>
                                                            </div>
                                                            <p>{n.message}</p>
                                                            {n.notifType === 'online_tdc_account_setup' && (
                                                                <button
                                                                    className="quick-open-link"
                                                                    onClick={(e) => openScheduleFromNotification(n, e)}
                                                                >
                                                                    Open TDC Online Queue
                                                                </button>
                                                            )}
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
                                <img
                                    src={resolveAvatar(adminProfile.avatar, adminProfile.gender, MEDIA_BASE_URL)}
                                    alt="Profile"
                                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                                    onError={e => { e.target.src = '/images/Defualt_profile_male.png'; }}
                                />
                            </div>

                            {showProfileModal && (
                                <>
                                    <div className="profile-modal-overlay" onClick={() => setShowProfileModal(false)}></div>
                                    <div className="profile-dropdown-modal">
                                        <div className="profile-dropdown-header">
                                            <div className="profile-info-display">
                                                <div className="large-profile-circle">
                                                    <img
                                                    src={resolveAvatar(adminProfile.avatar, adminProfile.gender, MEDIA_BASE_URL)}
                                                    alt="Profile"
                                                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                                                    onError={e => { e.target.src = '/images/Defualt_profile_male.png'; }}
                                                />
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
                                            <button className="dropdown-item logout" onClick={() => handleLogout(false)}>
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
                                    <h2>{loading ? <span className="skeleton-text">---</span> : formatCurrency(stats.monthlyRevenue)}</h2>
                                    <p className="stat-subtitle">Monthly revenue</p>
                                </div>
                                <div className="stat-icon green">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="1" x2="10" y2="23"></line><line x1="6" y1="6" x2="16" y2="6"></line><line x1="6" y1="9" x2="16" y2="9"></line><path d="M10 4h4a4 4 0 0 1 0 8h-4"></path></svg>
                                </div>
                            </div>
                            
                            {String(adminProfile?.rawRole || '').toLowerCase() === 'super_admin' && (
                                <>
                                    <div className="stat-card">
                                        <div className="stat-info">
                                            <span>Add-ons (This Month)</span>
                                            <h2>{loading ? <span className="skeleton-text">---</span> : formatCurrency(stats.addon_sales_total || 0)}</h2>
                                            <p className="stat-subtitle">Add-on revenue</p>
                                        </div>
                                        <div className="stat-icon purple" style={{ background: 'rgba(156, 39, 176, 0.1)', color: '#9c27b0' }}>
                                             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
                                        </div>
                                    </div>
                                    <div className="stat-card">
                                        <div className="stat-info">
                                            <span>Convenience Fees (This Month)</span>
                                            <h2>{loading ? <span className="skeleton-text">---</span> : formatCurrency(stats.convenience_fee_total || 0)}</h2>
                                            <p className="stat-subtitle">Convenience fee revenue</p>
                                        </div>
                                        <div className="stat-icon orange" style={{ background: 'rgba(255, 152, 0, 0.1)', color: '#ff9800' }}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="M7 15h0M12 15h0M17 15h0M7 11h.01M12 11h.01M17 11h.01M7 7h.01M12 7h.01M17 7h.01"></path></svg>
                                        </div>
                                    </div>
                                </>
                            )}

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

                        <section className="data-section">
                            <div className="section-header">
                                <div>
                                    <h2>Pending Collectibles</h2>
                                    <p className="section-subtitle">Outstanding balances waiting for collection</p>
                                </div>
                                <div className="section-actions" style={{ fontWeight: 700, color: 'var(--text-color)' }}>
                                    Total Balance: {formatCurrency(pendingCollectiblesTotal)}
                                </div>
                            </div>

                            <div className="table-wrapper">
                                <table className="custom-table">
                                    <thead>
                                        <tr>
                                            <th>Student</th>
                                            <th>Course</th>
                                            <th>Amount Paid</th>
                                            <th>Balance Due</th>
                                            <th>Payment Type</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingCollectibles.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" style={{ textAlign: 'center', padding: '28px', color: 'var(--secondary-text)' }}>
                                                    No pending collectibles today.
                                                </td>
                                            </tr>
                                        ) : pendingCollectibles.slice(0, 10).map((item) => (
                                            <tr key={item.id} className="table-row-hover">
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <div className="student-avatar" style={{ background: 'var(--primary-color)', color: '#fff', fontSize: '12px' }}>
                                                            {item.student_name?.charAt(0)?.toUpperCase() || '?'}
                                                        </div>
                                                        <span style={{ fontWeight: 500 }}>{item.student_name || 'Unknown'}</span>
                                                    </div>
                                                </td>
                                                <td>{item.course_name || 'N/A'}</td>
                                                <td>{formatCurrency(item.total_amount)}</td>
                                                <td>
                                                    <span style={{
                                                        background: '#fee2e2',
                                                        color: '#b45309',
                                                        padding: '4px 10px',
                                                        borderRadius: '20px',
                                                        fontWeight: 700,
                                                        fontSize: '0.85rem'
                                                    }}>
                                                        {formatCurrency(getEffectiveBalanceDue(item))}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="status-badge down">{item.payment_type || 'N/A'}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        <section className="data-section">
                            <div className="section-header">
                                <div>
                                    <h2>Today&apos;s Schedule</h2>
                                    <p className="section-subtitle">Students with active sessions today</p>
                                </div>
                            </div>

                            {todayScheduleGroups.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '28px', color: 'var(--secondary-text)' }}>
                                    No schedules found for today.
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                                    {todayScheduleGroups.map((group) => (
                                        <div key={group.course_type} style={{ border: '1px solid var(--border-color)', borderRadius: '14px', padding: '14px', background: 'var(--card-bg)' }}>
                                            <h3 style={{ marginBottom: '8px', fontSize: '1rem' }}>{group.course_type}</h3>
                                            <p style={{ marginBottom: '10px', color: 'var(--secondary-text)', fontSize: '0.86rem' }}>
                                                {group.students.length} student{group.students.length > 1 ? 's' : ''}
                                            </p>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {group.students.slice(0, 10).map((student) => (
                                                    <div key={student.enrollment_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', fontSize: '0.88rem', padding: '6px 10px', background: 'rgba(0,0,0,0.03)', borderRadius: '8px' }}>
                                                        <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary-color)' }}></span>
                                                            {student.name}
                                                        </span>
                                                        <span style={{ color: 'var(--primary-color)', fontWeight: 500, background: 'rgba(var(--primary-rgb), 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                                                            {student.time_range || student.session || 'TBA'}
                                                        </span>
                                                    </div>
                                                ))}
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
                                        ) : enrollees.slice(0, 10).map((student, index) => (
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
                    <Suspense fallback={<TabLoadingFallback />}>
                    <Schedule
                        onNavigate={setActiveTab}
                        currentUserPermissions={effectiveAdminPermissions}
                        currentUserRole={adminProfile.rawRole}
                        currentUserBranchId={adminProfile.branchId}
                        navigationTarget={scheduleNavigationTarget}
                    />
                    </Suspense>
                ) : activeTab === 'bookings' ? (
                    <Suspense fallback={<TabLoadingFallback />}><Booking /></Suspense>
                ) : activeTab === 'sales' ? (
                    <Suspense fallback={<TabLoadingFallback />}><SalePayment /></Suspense>

                ) : activeTab === 'news' ? (
                    <Suspense fallback={<TabLoadingFallback />}><NewsEvents /></Suspense>
                ) : activeTab === 'walk-in' ? (
                    <Suspense fallback={<TabLoadingFallback />}>
                    <WalkInEnrollment
                        adminProfile={adminProfile}
                        onEnroll={(newEnrollee) => {
                            setEnrollees(prev => [newEnrollee, ...prev]);
                        }}
                    />
                    </Suspense>
                ) : activeTab === 'profile' ? (
                    <div className="profile-view-container">
                        <div className="profile-header-card">
                            <div className="profile-banner" style={{
                                background: `linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.7)), url(${cover}) center/cover no-repeat`
                            }}></div>
                            <div className="profile-info-main">
                                <div className="profile-avatar-large" onClick={triggerFileInput} title="Change Profile Picture">
                                    <img
                                        src={resolveAvatar(adminProfile.avatar, adminProfile.gender, MEDIA_BASE_URL)}
                                        alt="Profile"
                                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                                        onError={e => { e.target.src = '/images/male.jpg'; }}
                                    />
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
                                <button className="edit-profile-btn" onClick={() => openEditProfileModal('personal')}>Edit Profile</button>
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
                                        <button className="change-btn" onClick={() => openEditProfileModal('security')}>Change</button>
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
                    <Suspense fallback={<TabLoadingFallback />}>
                    <Configuration
                        initialTab="settings"
                        currentUserPermissions={effectiveAdminPermissions}
                        currentUserRole={adminProfile.rawRole}
                    />
                    </Suspense>
                ) : activeTab === 'users' ? (
                    <Suspense fallback={<TabLoadingFallback />}>
                    <UserManagement currentUserPermissions={effectiveAdminPermissions} currentUserRole={adminProfile.rawRole} />
                    </Suspense>
                ) : activeTab === 'courses' ? (
                    <Suspense fallback={<TabLoadingFallback />}>
                    <CourseManagement
                        currentUserPermissions={effectiveAdminPermissions}
                        currentUserRole={adminProfile.rawRole}
                        currentUserBranchId={adminProfile.branchId}
                    />
                    </Suspense>
                ) : activeTab === 'branches' ? (
                    <Suspense fallback={<TabLoadingFallback />}>
                    <Configuration
                        currentUserPermissions={effectiveAdminPermissions}
                        currentUserRole={adminProfile.rawRole}
                    />
                    </Suspense>
                ) : activeTab === 'analytics' ? (
                    <Suspense fallback={<TabLoadingFallback />}>
                    <AnalyticsReports onNavigate={setActiveTab} />
                    </Suspense>
                ) : activeTab === 'best-selling-courses' ? (
                    renderBestSellingCoursesSection()
                ) : activeTab === 'crm' ? (
                    <Suspense fallback={<TabLoadingFallback />}><CRMManagement /></Suspense>
                ) : activeTab === 'notifications' ? (
                    <NotificationPage
                        notifications={notifications}
                        markAsRead={markAsRead}
                        deleteNotification={deleteNotification}
                        clearAll={clearAllNotifications}
                        openScheduleFromNotification={openScheduleFromNotification}
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
        </>
    );
};

const NotificationPage = ({ notifications, markAsRead, deleteNotification, clearAll, openScheduleFromNotification }) => {
    const unreadOnly = notifications.filter(n => !n.read);
    const [filter, setFilter] = React.useState('all');

    const filtered = filter === 'unread' ? unreadOnly : notifications;

    const notifIcon = (notifType) => {
        if (notifType === 'online_tdc_account_setup') return (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
        );
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
        if (notifType === 'online_tdc_account_setup') return 'online-tdc';
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
                            <div key={n.id} className={`notify-card-lux ${n.read ? 'read' : 'unread'} ${n.notifType === 'online_tdc_account_setup' ? 'online-tdc' : ''}`}>
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
                                {n.notifType === 'online_tdc_account_setup' && (
                                    <button
                                        className="mark-read-link"
                                        onClick={(e) => openScheduleFromNotification(n, e)}
                                    >
                                        Open TDC Online Queue
                                    </button>
                                )}
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
            {/* TDC Online Queue Modal */}
            {showTdcOnlineModal && (
                <div className="modal-overlay" style={{ zIndex: 1100 }}>
                    <div className="modal-content" style={{ maxWidth: '1000px', width: '95%', padding: '0', borderRadius: '16px', overflow: 'hidden' }}>
                        <div style={{
                            padding: '20px 24px', background: 'var(--primary-color)', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>TDC Online Account Setup Queue</h3>
                                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.9 }}>
                                    Manage students waiting for online provider account registration
                                </p>
                            </div>
                            <button 
                                onClick={() => setShowTdcOnlineModal(false)}
                                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <div style={{ padding: '24px', maxHeight: '70vh', overflowY: 'auto' }}>
                            {tdcOnlineQueue.loading ? (
                                <div style={{ textAlign: 'center', padding: '40px' }}>
                                    <div className="noshow-loading-spinner" style={{ margin: '0 auto 16px' }}></div>
                                    <div style={{ color: 'var(--secondary-text)' }}>Fetching enrollees...</div>
                                </div>
                            ) : tdcOnlineQueue.data.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--secondary-text)' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.3 }}>✅</div>
                                    <h4 style={{ margin: '0 0 8px', color: 'var(--text-color)' }}>All Caught Up!</h4>
                                    <p style={{ margin: 0 }}>No pending TDC Online account setups found.</p>
                                </div>
                            ) : (
                                <div className="table-wrapper">
                                    <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Student</th>
                                                <th>Contact</th>
                                                <th>Course</th>
                                                <th>Enrolled</th>
                                                <th>Branch</th>
                                                <th style={{ textAlign: 'right' }}>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tdcOnlineQueue.data.map((row, idx) => (
                                                <tr key={row.booking_id}>
                                                    <td>{idx + 1}</td>
                                                    <td>
                                                        <div style={{ fontWeight: 700 }}>{row.student_name}</div>
                                                        <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{row.email}</div>
                                                    </td>
                                                    <td>{row.contact_numbers || '—'}</td>
                                                    <td>{row.course_name}</td>
                                                    <td>{new Date(row.created_at).toLocaleDateString()}</td>
                                                    <td>{row.branch_name}</td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <button
                                                            onClick={() => handleTdcOnlineDone(row.booking_id)}
                                                            style={{
                                                                background: '#16a34a', color: '#fff', border: 'none',
                                                                borderRadius: '6px', padding: '6px 12px', fontSize: '0.8rem',
                                                                fontWeight: 600, cursor: 'pointer', display: 'inline-flex',
                                                                alignItems: 'center', gap: '6px'
                                                            }}
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                            Mark Done
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        
                        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', background: 'var(--hover-bg)' }}>
                            <button 
                                className="noshow-refresh-btn"
                                onClick={fetchTdcOnlineQueue}
                                style={{ marginRight: 'auto' }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                                Refresh
                            </button>
                            <button 
                                onClick={() => setShowTdcOnlineModal(false)}
                                style={{ padding: '8px 24px', borderRadius: '8px', border: '1.5px solid var(--border-color)', background: '#fff', fontWeight: 600, cursor: 'pointer' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Admin;

