import React, { useMemo, useState, useEffect } from 'react';

const logo = '/images/logo.png';

const Sidebar = ({ isSidebarOpen, setIsSidebarOpen, activeTab, setActiveTab, onNavigate, handleLogout, allowedTabs }) => {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
    const [openDropdowns, setOpenDropdowns] = useState({});

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 1024);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Auto-open Management dropdown if users or courses tab is active
    useEffect(() => {
        if (activeTab === 'users' || activeTab === 'courses' || activeTab === 'branches') {
            setOpenDropdowns(prev => ({ ...prev, management: true }));
        }
    }, [activeTab]);

    const toggleDropdown = (id) => {
        setOpenDropdowns(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const menuItems = [
        {
            id: 'dashboard',
            label: 'Overview',
            icon: (
                <svg className="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
            )
        },
        {
            id: 'schedules',
            label: 'Schedules',
            icon: (
                <svg className="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
            )
        },
        {
            id: 'bookings',
            label: 'Bookings',
            icon: (
                <svg className="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
            )
        },
        {
            id: 'walk-in',
            label: 'Walk-in Enrollment',
            icon: (
                <svg className="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="8.5" cy="7" r="4"></circle>
                    <line x1="20" y1="8" x2="20" y2="14"></line>
                    <line x1="17" y1="11" x2="23" y2="11"></line>
                </svg>
            )
        },
        {
            id: 'sales',
            label: 'Sales & Payments',
            icon: (
                <svg className="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                    <line x1="1" y1="10" x2="23" y2="10"></line>
                </svg>
            )
        },
        {
            id: 'crm',
            label: 'CRM',
            icon: (
                <svg className="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" opacity="0.3"></polyline>
                </svg>
            )
        },
        {
            id: 'analytics',
            label: 'Analytics',
            icon: (
                <svg className="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                </svg>
            )
        },
        {
            id: 'management',
            label: 'Management',
            isDropdown: true,
            icon: (
                <svg className="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                    <path d="M2 17l10 5 10-5M2 12l10 5 10-5"></path>
                </svg>
            ),
            children: [
                {
                    id: 'users',
                    label: 'Account Management',
                    icon: (
                        <svg className="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                    )
                },
                {
                    id: 'courses',
                    label: 'Course Management',
                    icon: (
                        <svg className="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                        </svg>
                    )
                },
                {
                    id: 'branches',
                    label: 'Config Management',
                    icon: (
                        <svg className="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                    )
                }
            ]
        },
        {
            id: 'news',
            label: 'News & Events',
            icon: (
                <svg className="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 11a9 9 0 0 1 9 9"></path>
                    <path d="M4 4a16 16 0 0 1 16 16"></path>
                    <circle cx="5" cy="19" r="1"></circle>
                </svg>
            )
        }
    ];

    const visibleMenuItems = useMemo(() => {
        const canShowTab = (tabId) => !allowedTabs || allowedTabs.has(tabId);

        return menuItems
            .map((item) => {
                if (!item.isDropdown) {
                    return canShowTab(item.id) ? item : null;
                }

                const visibleChildren = (item.children || []).filter((child) => canShowTab(child.id));
                if (visibleChildren.length === 0) {
                    return null;
                }

                return {
                    ...item,
                    children: visibleChildren,
                };
            })
            .filter(Boolean);
    }, [allowedTabs]);

    return (
        <>
            {/* Mobile Overlay */}
            <div
                className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`}
                onClick={() => setIsSidebarOpen(false)}
            />

            <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
                <div className="sidebar-header">
                    <div
                        className="sidebar-logo cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => {
                            onNavigate('home');
                            if (isMobile) setIsSidebarOpen(false);
                        }}
                    >
                        <div className="logo-box">
                            <img src={logo} alt="Master School" />
                        </div>
                        <h2>Master School</h2>
                    </div>

                    {isMobile && (
                        <button className="close-sidebar-btn" onClick={() => setIsSidebarOpen(false)}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    )}
                </div>

                <nav className="sidebar-menu">
                    <div className="menu-group">
                        {visibleMenuItems.map((item) => (
                            <div key={item.id}>
                                {item.isDropdown ? (
                                    <>
                                        <button
                                            onClick={() => toggleDropdown(item.id)}
                                            className={`menu-item dropdown-toggle ${openDropdowns[item.id] ? 'active' : ''}`}
                                            title={!isSidebarOpen ? item.label : ""}
                                        >
                                            {item.icon}
                                            <span className="menu-text">{item.label}</span>
                                            <svg
                                                className={`dropdown-arrow ${openDropdowns[item.id] ? 'open' : ''}`}
                                                width="16"
                                                height="16"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                            >
                                                <polyline points="6 9 12 15 18 9"></polyline>
                                            </svg>
                                        </button>
                                        <div className={`dropdown-content ${openDropdowns[item.id] ? 'open' : ''}`}>
                                            {item.children?.map((child) => (
                                                <button
                                                    key={child.id}
                                                    onClick={() => {
                                                        setActiveTab(child.id);
                                                        if (isMobile) setIsSidebarOpen(false);
                                                    }}
                                                    className={`menu-item submenu-item ${activeTab === child.id ? 'active' : ''}`}
                                                    title={!isSidebarOpen ? child.label : ""}
                                                >
                                                    {child.icon}
                                                    <span className="menu-text">{child.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => {
                                            setActiveTab(item.id);
                                            if (isMobile) setIsSidebarOpen(false);
                                        }}
                                        className={`menu-item ${activeTab === item.id ? 'active' : ''}`}
                                        title={!isSidebarOpen ? item.label : ""}
                                    >
                                        {item.icon}
                                        <span className="menu-text">{item.label}</span>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="sidebar-bottom">
                        <button
                            className="menu-item logout-item"
                            onClick={handleLogout}
                            title={!isSidebarOpen ? "Logout" : ""}
                        >
                            <svg className="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                            <span className="menu-text">Logout</span>
                        </button>
                    </div>
                </nav>
            </aside>
        </>
    );
};

export default Sidebar;
