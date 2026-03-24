import React, { useState, useMemo } from 'react';
import { LoadingPlaceholder, EmptyState } from './SharedComponents';

// Role colour palette — keyed by role.name
const ROLE_COLORS = {
    administrator: {
        avatar: 'linear-gradient(135deg,#ef4444,#dc2626)',
        shadow:  'rgba(239,68,68,0.30)',
        accent:  '#ef4444',
        bg:      '#fff5f5',
        text:    '#991b1b',
        border:  '#fecaca',
        icon:    (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
        ),
    },
    staff: {
        avatar: 'linear-gradient(135deg,#2563eb,#3b82f6)',
        shadow:  'rgba(37,99,235,0.28)',
        accent:  '#2563eb',
        bg:      '#eff6ff',
        text:    '#1e40af',
        border:  '#bfdbfe',
        icon:    (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
        ),
    },
    student: {
        avatar: 'linear-gradient(135deg,#059669,#10b981)',
        shadow:  'rgba(5,150,105,0.28)',
        accent:  '#059669',
        bg:      '#f0fdf4',
        text:    '#065f46',
        border:  '#a7f3d0',
        icon:    (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                <path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
        ),
    },
    walkin_student: {
        avatar: 'linear-gradient(135deg,#d97706,#f59e0b)',
        shadow:  'rgba(217,119,6,0.28)',
        accent:  '#d97706',
        bg:      '#fffbeb',
        text:    '#92400e',
        border:  '#fde68a',
        icon:    (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
        ),
    },
    default: {
        avatar: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
        shadow:  'rgba(79,70,229,0.28)',
        accent:  '#4f46e5',
        bg:      '#f5f3ff',
        text:    '#3730a3',
        border:  '#ddd6fe',
        icon:    (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
        ),
    },
};

const getRoleColor = (name = '') => ROLE_COLORS[name.toLowerCase()] || ROLE_COLORS.default;

const RoleSection = ({ roles, loading, onAdd, onEdit, onDelete }) => {
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => roles
        .filter((r) => {
            const roleName = String(r.name || '').toLowerCase();
            return roleName !== 'student' && roleName !== 'walk_in_student' && roleName !== 'walkin_student';
        })
        .filter(r =>
            r.display_name.toLowerCase().includes(search.toLowerCase()) ||
            r.name.toLowerCase().includes(search.toLowerCase()) ||
            (r.description && r.description.toLowerCase().includes(search.toLowerCase()))
        ), [roles, search]);

    return (
        <div className="cfg-section-enter">
            <div className="cfg-toolbar">
                <div className="cfg-search">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search roles by name or code…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <button className="cfg-add-btn" onClick={onAdd}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add Role
                </button>
            </div>

            <div className="cfg-grid">
                {loading ? (
                    <LoadingPlaceholder count={4} />
                ) : filtered.length > 0 ? (
                    filtered.map(role => {
                        const c = getRoleColor(role.name);
                        return (
                            <div key={role.id} className={`cfg-card role-card${role.is_system ? ' system-role' : ''}`}
                                style={{ '--role-accent': c.accent }}>

                                {/* Coloured top banner */}
                                <div className="role-card-banner" style={{ background: c.avatar }}>
                                    <div className="role-card-banner-avatar"
                                        style={{ boxShadow: `0 4px 16px ${c.shadow}` }}>
                                        {c.icon}
                                    </div>
                                    <div className="role-card-banner-actions">
                                        <button className="role-icon-btn" onClick={() => onEdit(role)} title="Edit">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                            </svg>
                                        </button>
                                        <button className="role-icon-btn danger" onClick={() => onDelete(role.id)} title="Delete">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polyline points="3 6 5 6 21 6" />
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Card body */}
                                <div className="role-card-body">
                                    <div className="role-card-title-row">
                                        <h3 className="role-card-name">{role.display_name}</h3>
                                        {role.is_system
                                            ? <span className="cfg-system-badge" style={{ background: `${c.bg}`, color: c.text, borderColor: c.border }}>⚡ System</span>
                                            : <span className="cfg-custom-badge">Custom</span>
                                        }
                                    </div>

                                    <code className="cfg-role-code" style={{ color: c.text, background: c.bg, borderColor: c.border }}>
                                        {role.name}
                                    </code>

                                    <p className="cfg-role-desc">
                                        {role.description || 'No description provided for this role.'}
                                    </p>
                                </div>

                                {/* Footer */}
                                <div className="role-card-footer">
                                    <span className="role-perm-badge" style={{ background: c.bg, color: c.text, borderColor: c.border }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                        </svg>
                                        {role.permissions?.length || 0} permissions
                                    </span>
                                    <span className="cfg-active-dot">
                                        <span className="cfg-dot-pulse" />
                                        Active
                                    </span>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <EmptyState
                        title="No Roles Found"
                        message={search ? `No roles match "${search}"` : "You haven't created any custom roles yet."}
                        icon={<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />}
                    />
                )}
            </div>
        </div>
    );
};

export default RoleSection;
