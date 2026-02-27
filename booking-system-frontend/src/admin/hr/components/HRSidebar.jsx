import React, { useState, useEffect } from 'react';

const logo = '/images/logo.png';

const HRSidebar = ({ isSidebarOpen, setIsSidebarOpen, activeTab, setActiveTab, onNavigate, handleLogout }) => {
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
            id: 'analytics',
            label: 'Analytics',
            icon: (
                <svg className="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                </svg>
            )
        },
        {
            id: 'users',
            label: 'Employee Management',
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
            id: 'news',
            label: 'Announcements',
            icon: (
                <svg className="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 11a9 9 0 0 1 9 9"></path>
                    <path d="M4 4a16 16 0 0 1 16 16"></path>
                    <circle cx="5" cy="19" r="1"></circle>
                </svg>
            )
        }
    ];

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
                        {menuItems.map((item) => (
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

export default HRSidebar;
