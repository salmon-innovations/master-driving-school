import React from 'react';

export const BranchModal = ({ isOpen, onClose, onSubmit, formData, setFormData, isEditing }) => {
    if (!isOpen) return null;
    return (
        <div className="cfg-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="cfg-modal">
                <div className="cfg-modal-header">
                    <div className="modal-header-left">
                        <div className="modal-header-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        </div>
                        <div>
                            <h2>{isEditing ? 'Update Branch' : 'Add New Branch'}</h2>
                            <p>Fill in the details for this business location.</p>
                        </div>
                    </div>
                    <div className="modal-header-right">
                        <button className="cfg-modal-close" onClick={onClose}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                </div>
                <form onSubmit={onSubmit}>
                    <div className="cfg-modal-body">
                        <div className="cfg-modal-field">
                            <label>Official Name *</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. Main Branch — Quezon City"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="cfg-modal-field">
                            <label>Business Address</label>
                            <textarea
                                rows="2"
                                placeholder="Complete street address…"
                                value={formData.address}
                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                            />
                        </div>
                        <div className="cfg-modal-2col">
                            <div className="cfg-modal-field">
                                <label>Phone / Mobile</label>
                                <input
                                    type="text"
                                    placeholder="+63 900 000 0000"
                                    value={formData.contact_number}
                                    onChange={e => setFormData({ ...formData, contact_number: e.target.value })}
                                />
                            </div>
                            <div className="cfg-modal-field">
                                <label>Email Address</label>
                                <input
                                    type="email"
                                    placeholder="branch@example.com"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="cfg-modal-footer">
                        <button type="button" className="cfg-btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="cfg-btn-primary">
                            {isEditing ? 'Save Changes' : 'Add Branch'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export const RoleModal = ({ isOpen, onClose, onSubmit, formData, setFormData, isEditing }) => {
    if (!isOpen) return null;
    return (
        <div className="cfg-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="cfg-modal">
                <div className="cfg-modal-header">
                    <div className="modal-header-left">
                        <div className="modal-header-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                        </div>
                        <div>
                            <h2>{isEditing ? 'Edit Role' : 'Create Role'}</h2>
                            <p>Define access permissions for this user role.</p>
                        </div>
                    </div>
                    <div className="modal-header-right">
                        <button className="cfg-modal-close" onClick={onClose}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                </div>
                <form onSubmit={onSubmit}>
                    <div className="cfg-modal-body">
                        <div className="cfg-modal-2col">
                            <div className="cfg-modal-field">
                                <label>Internal Code *</label>
                                <input
                                    type="text"
                                    required
                                    disabled={isEditing}
                                    placeholder="e.g. branch_manager"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="cfg-modal-field">
                                <label>Display Name *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Branch Manager"
                                    value={formData.display_name}
                                    onChange={e => setFormData({ ...formData, display_name: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="cfg-modal-field">
                            <label>Description</label>
                            <textarea
                                rows="3"
                                placeholder="Describe what this role can access and manage…"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="cfg-modal-footer">
                        <button type="button" className="cfg-btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="cfg-btn-primary">
                            {isEditing ? 'Save Changes' : 'Create Role'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Delete", isDestructive = true, variant }) => {
    if (!isOpen) return null;

    // Determine color scheme: variant overrides isDestructive
    const scheme = variant || (isDestructive ? 'danger' : 'primary');
    const schemes = {
        danger:  { bg: '#fff1f2', iconBg: '#ffe4e6', iconColor: '#e11d48', btnBg: 'linear-gradient(135deg,#f43f5e,#e11d48)', btnShadow: 'rgba(225,29,72,.35)', svgPath: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></> },
        warning: { bg: '#fffbeb', iconBg: '#fef3c7', iconColor: '#d97706', btnBg: 'linear-gradient(135deg,#f59e0b,#d97706)', btnShadow: 'rgba(217,119,6,.35)',  svgPath: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></> },
        primary: { bg: '#eff6ff', iconBg: '#dbeafe', iconColor: '#1d4ed8', btnBg: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', btnShadow: 'rgba(29,78,216,.35)',  svgPath: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></> },
        success: { bg: '#f0fdf4', iconBg: '#dcfce7', iconColor: '#15803d', btnBg: 'linear-gradient(135deg,#22c55e,#15803d)', btnShadow: 'rgba(21,128,61,.35)',   svgPath: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></> },
    };
    const s = schemes[scheme] || schemes.danger;

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem', animation: 'ovIn .2s ease' }}
            onClick={e => e.target === e.currentTarget && onClose()}
        >
            <div style={{ background: '#fff', width: '100%', maxWidth: '400px', borderRadius: '20px', boxShadow: '0 24px 64px rgba(15,23,42,.22), 0 8px 24px rgba(15,23,42,.12)', overflow: 'hidden', animation: 'mdIn .28s cubic-bezier(.16,1,.3,1)', display: 'flex', flexDirection: 'column' }}>

                {/* Colored top strip */}
                <div style={{ height: '4px', background: s.btnBg }} />

                {/* Body */}
                <div style={{ padding: '28px 28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '14px' }}>
                    {/* Icon circle */}
                    <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: s.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={s.iconColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            {s.svgPath}
                        </svg>
                    </div>
                    {/* Title */}
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.25 }}>{title}</div>
                    {/* Message */}
                    <div style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.6, maxWidth: '320px' }}>{message}</div>
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 28px 24px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{ flex: 1, padding: '10px 0', border: '1.5px solid #e2e8f0', borderRadius: '12px', background: '#fff', color: '#475569', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', transition: 'background .15s', fontFamily: 'inherit' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => { onConfirm(); onClose(); }}
                        style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: '12px', background: s.btnBg, color: '#fff', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', boxShadow: `0 4px 14px ${s.btnShadow}`, transition: 'opacity .15s, transform .15s', fontFamily: 'inherit' }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};
