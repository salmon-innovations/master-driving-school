import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';

/* ─── reusable sub-components ─────────────────────────────── */
const ToggleRow = ({ title, desc, checked, onChange, accent = 'green' }) => (
    <div className="cfg-toggle-row">
        <div className="cfg-toggle-info">
            <h4>{title}</h4>
            {desc && <p>{desc}</p>}
        </div>
        <label className={`cfg-toggle cfg-toggle--${accent}`}>
            <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
            <span className="cfg-slider" />
        </label>
    </div>
);

const FieldRow = ({ label, hint, children }) => (
    <div className="cfg-form-field">
        <label>{label}</label>
        {children}
        {hint && <span className="cfg-field-hint">{hint}</span>}
    </div>
);

const SettingsCard = ({ icon, iconClass, title, badge, children }) => (
    <div className="cfg-settings-card">
        <div className="cfg-settings-card-header">
            <div className={`cfg-settings-header-icon ${iconClass}`}>{icon}</div>
            <h3>{title}</h3>
            {badge && <span className="cfg-settings-badge">{badge}</span>}
        </div>
        <div className="cfg-settings-card-body">{children}</div>
    </div>
);

/* ─── main component ──────────────────────────────────────── */
const SettingsSection = ({ settings, setSettings, onSave, onSettingChange }) => {
    const { theme, toggleTheme } = useTheme();
    const [saved, setSaved] = useState(false);

    const handleSave = (e) => {
        onSave(e);
        setSaved(true);
        setTimeout(() => setSaved(false), 2200);
    };

    const set = (key, val) => {
        setSettings(prev => ({ ...prev, [key]: val }));
    };

    return (
        <div className="cfg-section-enter">
            {/* Maintenance Mode Banner */}
            {settings.maintenanceMode && (
                <div className="cfg-maintenance-banner">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    <strong>Maintenance Mode is ON</strong> — Only admin users can access the booking system right now.
                </div>
            )}

            <form onSubmit={handleSave}>
                <div className="cfg-settings-grid">

                    {/* ── 1. Appearance ─────────────────────────────── */}
                    <SettingsCard
                        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}
                        title="Appearance"
                        iconClass="icon-purple"
                    >
                        <ToggleRow
                            title="Dark Mode"
                            desc="Toggle the admin panel's dark theme."
                            checked={theme === 'dark'}
                            onChange={toggleTheme}
                            accent="purple"
                        />
                        <ToggleRow
                            title="Compact View"
                            desc="Reduce row padding for denser data tables."
                            checked={settings.compactView || false}
                            onChange={v => onSettingChange('compactView', v)}
                            accent="blue"
                        />
                    </SettingsCard>

                    {/* ── 2. Branding ───────────────────────────────── */}
                    <SettingsCard
                        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>}
                        title="School Branding"
                        iconClass="blue"
                    >
                        <FieldRow label="School Name">
                            <input
                                type="text"
                                value={settings.siteName}
                                onChange={e => set('siteName', e.target.value)}
                                placeholder="e.g. Master Driving School"
                            />
                        </FieldRow>
                        <FieldRow label="Tagline / Slogan">
                            <input
                                type="text"
                                value={settings.tagline || ''}
                                onChange={e => set('tagline', e.target.value)}
                                placeholder="e.g. Building Champions on the Road"
                            />
                        </FieldRow>
                        <div className="cfg-settings-2col">
                            <FieldRow label="Support Email">
                                <input
                                    type="email"
                                    value={settings.supportEmail}
                                    onChange={e => set('supportEmail', e.target.value)}
                                    placeholder="support@example.com"
                                />
                            </FieldRow>
                            <FieldRow label="Contact Number">
                                <input
                                    type="tel"
                                    value={settings.contactNumber || ''}
                                    onChange={e => set('contactNumber', e.target.value)}
                                    placeholder="+63 900 000 0000"
                                />
                            </FieldRow>
                        </div>
                    </SettingsCard>

                    {/* ── 3. Booking Rules ──────────────────────────── */}
                    <SettingsCard
                        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
                        title="Booking Rules"
                        iconClass="amber"
                        badge="Applied to new bookings"
                    >
                        <div className="cfg-settings-2col">
                            <FieldRow label="Max Students per Slot" hint="Applies to new schedule slots">
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={settings.maxStudentsPerSlot}
                                    onChange={e => set('maxStudentsPerSlot', Number(e.target.value))}
                                />
                            </FieldRow>
                            <FieldRow label="Min Advance Booking (days)" hint="0 = book on the same day">
                                <input
                                    type="number"
                                    min="0"
                                    max="30"
                                    value={settings.minBookingAdvanceDays}
                                    onChange={e => set('minBookingAdvanceDays', Number(e.target.value))}
                                />
                            </FieldRow>
                        </div>
                        <FieldRow label="Auto-Cancel Unpaid Bookings After (days)" hint="Set to 0 to disable auto-cancellation">
                            <input
                                type="number"
                                min="0"
                                max="60"
                                value={settings.autoCancelDays}
                                onChange={e => set('autoCancelDays', Number(e.target.value))}
                            />
                        </FieldRow>
                        <ToggleRow
                            title="Allow Walk-in Enrollment"
                            desc="Admins can manually enroll students without prior booking."
                            checked={settings.allowWalkIn}
                            onChange={v => onSettingChange('allowWalkIn', v)}
                            accent="green"
                        />
                    </SettingsCard>

                    {/* ── 4. Payment Settings ───────────────────────── */}
                    <SettingsCard
                        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>}
                        title="Payment Methods"
                        iconClass="emerald"
                    >
                        <ToggleRow
                            title="Enable Cash Payment"
                            desc="Allow students to pay in cash at any branch."
                            checked={settings.enableCash !== false}
                            onChange={v => onSettingChange('enableCash', v)}
                            accent="green"
                        />
                        <ToggleRow
                            title="Require Payment Before Confirmation"
                            desc="Keep bookings pending until payment is verified by admin."
                            checked={settings.requirePaymentBeforeConfirm || false}
                            onChange={v => onSettingChange('requirePaymentBeforeConfirm', v)}
                            accent="amber"
                        />
                    </SettingsCard>

                    {/* ── 5. Security & Access ──────────────────────── */}
                    <SettingsCard
                        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
                        title="Security & Access"
                        iconClass="amber"
                    >
                        <ToggleRow
                            title="Maintenance Mode"
                            desc="Put the booking portal in maintenance — only admins can log in."
                            checked={settings.maintenanceMode}
                            onChange={v => onSettingChange('maintenanceMode', v)}
                            accent="red"
                        />
                        <ToggleRow
                            title="Auto-Verify New Registrations"
                            desc="Automatically approve student accounts on sign-up."
                            checked={settings.autoVerifyUsers}
                            onChange={v => onSettingChange('autoVerifyUsers', v)}
                            accent="green"
                        />
                        <FieldRow label="Session Timeout (minutes)" hint="Admin sessions expire after inactivity">
                            <input
                                type="number"
                                min="5"
                                max="480"
                                value={settings.sessionTimeout}
                                onChange={e => set('sessionTimeout', Number(e.target.value))}
                            />
                        </FieldRow>
                    </SettingsCard>

                    {/* ── 6. Notifications ──────────────────────────── */}
                    <SettingsCard
                        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>}
                        title="Notifications"
                        iconClass="emerald"
                    >
                        <ToggleRow
                            title="In-App Notifications"
                            desc="Send real-time alerts inside the admin dashboard."
                            checked={settings.enableNotifications}
                            onChange={v => onSettingChange('enableNotifications', v)}
                            accent="green"
                        />
                        <ToggleRow
                            title="Booking Confirmation Emails"
                            desc="Auto-send email when a booking is confirmed."
                            checked={settings.emailOnConfirm || false}
                            onChange={v => onSettingChange('emailOnConfirm', v)}
                            accent="blue"
                        />
                        <ToggleRow
                            title="Low Slot Alerts"
                            desc="Notify admin when a schedule slot has ≤ 2 seats remaining."
                            checked={settings.lowSlotAlert || false}
                            onChange={v => onSettingChange('lowSlotAlert', v)}
                            accent="amber"
                        />
                    </SettingsCard>

                </div>

                {/* ── Save Bar ──────────────────────────────────────── */}
                <div className="cfg-save-row">
                    <div className="cfg-save-hint">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        Toggles save instantly. Click <strong>Save Changes</strong> to persist all text field edits.
                    </div>
                    <button type="submit" className={`cfg-save-btn${saved ? ' cfg-save-btn--done' : ''}`}>
                        {saved ? (
                            <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                Saved!
                            </>
                        ) : (
                            <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default SettingsSection;
