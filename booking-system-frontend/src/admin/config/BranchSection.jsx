import React from 'react';
import { LoadingPlaceholder, EmptyState } from './SharedComponents';

const BranchSection = ({ branches, loading, searchTerm, setSearchTerm, onAdd, onEdit, onDelete, onGenerateQr }) => (
    <div className="cfg-section-enter">
        <div className="cfg-toolbar">
            <div className="cfg-search">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                    type="text"
                    placeholder="Search by branch name or address…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <button className="cfg-add-btn" onClick={onAdd}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Branch
            </button>
        </div>

        <div className="cfg-grid branch-grid">
            {loading ? (
                <LoadingPlaceholder count={3} />
            ) : branches.length > 0 ? (
                branches.map(branch => (
                    <div key={branch.id} className="cfg-card branch-card">
                        <div className="cfg-card-header">
                            <div className="cfg-card-avatar">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                            </div>
                            <div className="cfg-card-title-group">
                                <h3 className="branch-card-title">{branch.name}</h3>
                                <span className="cfg-badge">Active</span>
                            </div>
                            <div className="cfg-card-actions">
                                <button className="cfg-icon-btn qr" onClick={() => onGenerateQr(branch)} title="Generate QR Entry">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
                                        <rect x="7" y="7" width="3" height="3" />
                                        <rect x="14" y="7" width="3" height="3" />
                                        <rect x="7" y="14" width="3" height="3" />
                                    </svg>
                                </button>
                                <button className="cfg-icon-btn" onClick={() => onEdit(branch)} title="Edit">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                </button>
                                <button className="cfg-icon-btn danger" onClick={() => onDelete(branch.id)} title="Delete">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div className="cfg-card-info">
                            <div className="cfg-info-row">
                                <div className="cfg-info-icon">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                    </svg>
                                </div>
                                <div className="cfg-info-text">
                                    <span className="lbl">Address</span>
                                    <span className="val">{branch.address || 'Not specified'}</span>
                                </div>
                            </div>
                            <div className="cfg-info-row">
                                <div className="cfg-info-icon">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                                    </svg>
                                </div>
                                <div className="cfg-info-text">
                                    <span className="lbl">Contact</span>
                                    <span className="val">{branch.contact_number || 'No contact'}</span>
                                </div>
                            </div>
                            {branch.email && (
                                <div className="cfg-info-row">
                                    <div className="cfg-info-icon">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                            <polyline points="22,6 12,13 2,6" />
                                        </svg>
                                    </div>
                                    <div className="cfg-info-text">
                                        <span className="lbl">Email</span>
                                        <span className="val">{branch.email}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="cfg-card-footer">
                            <span className="cfg-verified-badge">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                Verified
                            </span>
                            <span className="cfg-active-dot">
                                <span className="cfg-dot-pulse" />
                                Online
                            </span>
                        </div>
                    </div>
                ))
            ) : (
                <EmptyState
                    title="No Branches Yet"
                    message={searchTerm ? `No branches match "${searchTerm}"` : "Add your first branch to get started."}
                    icon={<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>}
                />
            )}
        </div>
    </div>
);

export default BranchSection;
