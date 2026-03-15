import React, { useState, useEffect, useCallback } from 'react';
import { emailContentAPI } from '../../services/api';

/* ─────────────────────────────────────────────────────────────
   Tiny field helpers
───────────────────────────────────────────────────────────── */
const TextField = ({ label, hint, value, onChange }) => (
    <div className="cfg-form-field">
        <label>{label}</label>
        <input
            type="text"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            className="cfg-input"
        />
        {hint && <span className="cfg-field-hint">{hint}</span>}
    </div>
);

const TextAreaField = ({ label, hint, value, onChange, rows = 3 }) => (
    <div className="cfg-form-field">
        <label>{label}</label>
        <textarea
            rows={rows}
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            className="cfg-input cfg-textarea"
        />
        {hint && <span className="cfg-field-hint">{hint}</span>}
    </div>
);

/* Editable list of strings */
const ListEditor = ({ label, hint, items = [], onChange }) => {
    const update = (i, val) => { const next = [...items]; next[i] = val; onChange(next); };
    const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
    const add    = () => onChange([...items, '']);

    return (
        <div className="cfg-form-field">
            <label>{label}</label>
            {items.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <input
                        type="text"
                        value={item}
                        onChange={e => update(i, e.target.value)}
                        className="cfg-input"
                        style={{ flex: 1 }}
                    />
                    <button
                        type="button"
                        onClick={() => remove(i)}
                        className="cfg-btn-icon cfg-btn-danger"
                        title="Remove item"
                    >✕</button>
                </div>
            ))}
            <button type="button" onClick={add} className="cfg-btn-add">+ Add item</button>
            {hint && <span className="cfg-field-hint">{hint}</span>}
        </div>
    );
};

/* Collapsible section card */
const AccordionCard = ({ icon, title, isOpen, onToggle, children }) => (
    <div className="cfg-settings-card" style={{ marginBottom: 12 }}>
        <div
            className="cfg-settings-card-header"
            onClick={onToggle}
            style={{ cursor: 'pointer', userSelect: 'none' }}
        >
            <div className="cfg-settings-header-icon cfg-icon-blue" style={{ fontSize: 18 }}>{icon}</div>
            <h3 style={{ flex: 1 }}>{title}</h3>
            <span style={{ fontSize: 18, color: '#6b7280', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
        </div>
        {isOpen && <div className="cfg-settings-card-body">{children}</div>}
    </div>
);

/* ─────────────────────────────────────────────────────────────
   Main component
───────────────────────────────────────────────────────────── */
const EmailContentSection = () => {
    const [content, setContent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');
    const [openSection, setOpenSection] = useState('branding');

    useEffect(() => {
        emailContentAPI.get()
            .then(data => {
                if (data?.content) setContent(data.content);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    /* Field change helpers */
    const set = useCallback((section, key, value) => {
        setContent(prev => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
        setIsDirty(true);
    }, []);

    const setTop = useCallback((key, value) => {
        setContent(prev => ({ ...prev, [key]: value }));
        setIsDirty(true);
    }, []);

    const toggle = (key) => setOpenSection(prev => prev === key ? null : key);

    const handleSave = async () => {
        setSaving(true);
        try {
            await emailContentAPI.update(content);
            setSaveMsg('Saved!');
            setIsDirty(false);
            setTimeout(() => setSaveMsg(''), 2500);
        } catch {
            setSaveMsg('Save failed — please try again.');
            setTimeout(() => setSaveMsg(''), 4000);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="cfg-section-enter" style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>Loading email content…</div>;
    if (!content) return <div className="cfg-section-enter" style={{ padding: 32, color: '#ef4444' }}>Failed to load email content.</div>;

    const C = content;

    return (
        <div className="cfg-section-enter">
            {/* Page header + save bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Email Content Configuration</h2>
                    <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '4px 0 0' }}>
                        Edit the text sent in student emails. Use <code style={{ background: '#f1f5f9', padding: '1px 4px', borderRadius: 3 }}>{'{placeholder}'}</code> values where shown.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {saveMsg && <span style={{ fontSize: '0.82rem', color: saveMsg.startsWith('Saved') ? '#16a34a' : '#dc2626' }}>{saveMsg}</span>}
                    <button
                        onClick={handleSave}
                        disabled={saving || !isDirty}
                        className="cfg-save-btn"
                        style={{ opacity: (saving || !isDirty) ? 0.5 : 1 }}
                    >
                        {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {isDirty && (
                <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: 8, padding: '8px 14px', marginBottom: 14, fontSize: '0.82rem', color: '#854d0e' }}>
                    ⚠ You have unsaved changes
                </div>
            )}

            {/* ── Branding ─────────────────────────────────── */}
            <AccordionCard icon="🏫" title="Branding" isOpen={openSection === 'branding'} onToggle={() => toggle('branding')}>
                <TextField label="School Name" value={C.schoolName} onChange={v => setTop('schoolName', v)} />
                <TextField label="Copyright Year" value={C.copyrightYear} onChange={v => setTop('copyrightYear', v)} />
                <TextField label="Default Footer Tagline" value={C.footerTagline} onChange={v => setTop('footerTagline', v)} />
            </AccordionCard>

            {/* ── Verification / OTP ───────────────────────── */}
            <AccordionCard icon="🔐" title="Verification & OTP Email" isOpen={openSection === 'verification'} onToggle={() => toggle('verification')}>
                <TextField label="Subject — Email Verification" value={C.verification?.subjectVerify} onChange={v => set('verification', 'subjectVerify', v)} />
                <TextField label="Subject — Password Reset" value={C.verification?.subjectReset} onChange={v => set('verification', 'subjectReset', v)} />
                <TextField label="Email Title — Verification" value={C.verification?.titleVerify} onChange={v => set('verification', 'titleVerify', v)} />
                <TextField label="Email Title — Reset" value={C.verification?.titleReset} onChange={v => set('verification', 'titleReset', v)} />
                <TextAreaField label="Message — Verification" value={C.verification?.messageVerify} onChange={v => set('verification', 'messageVerify', v)} />
                <TextAreaField label="Message — Password Reset" value={C.verification?.messageReset} onChange={v => set('verification', 'messageReset', v)} />
                <TextField label="Code Expiry Note" value={C.verification?.expiry} onChange={v => set('verification', 'expiry', v)} />
                <TextField label="Not Requested Notice" value={C.verification?.notRequested} onChange={v => set('verification', 'notRequested', v)} />
            </AccordionCard>

            {/* ── New Account ──────────────────────────────── */}
            <AccordionCard icon="👤" title="New Account Email (Staff / Admin)" isOpen={openSection === 'newAccount'} onToggle={() => toggle('newAccount')}>
                <TextField label="Subject" value={C.newAccount?.subject} onChange={v => set('newAccount', 'subject', v)} />
                <TextField label="Header Title" value={C.newAccount?.headerTitle} onChange={v => set('newAccount', 'headerTitle', v)} />
                <TextField label="Credentials Heading" value={C.newAccount?.credentialsHeading} onChange={v => set('newAccount', 'credentialsHeading', v)} />
                <TextField label="Password Reveal Hint" value={C.newAccount?.passwordRevealHint} onChange={v => set('newAccount', 'passwordRevealHint', v)} />
                <TextField label="Security Heading" value={C.newAccount?.securityHeading} onChange={v => set('newAccount', 'securityHeading', v)} />
                <ListEditor label="Security Points" items={C.newAccount?.securityPoints} onChange={v => set('newAccount', 'securityPoints', v)} />
                <TextAreaField label="Login Prompt" value={C.newAccount?.loginPrompt} onChange={v => set('newAccount', 'loginPrompt', v)} />
                <TextField label="Login Button Text" value={C.newAccount?.loginButtonText} onChange={v => set('newAccount', 'loginButtonText', v)} />
                <TextField label="Unexpected Email Footer" value={C.newAccount?.unexpectedFooter} onChange={v => set('newAccount', 'unexpectedFooter', v)} />
            </AccordionCard>

            {/* ── Walk-In Enrollment ───────────────────────── */}
            <AccordionCard icon="🚶" title="Walk-In Enrollment Email" isOpen={openSection === 'walkIn'} onToggle={() => toggle('walkIn')}>
                <TextField label="Subject" value={C.walkIn?.subject} onChange={v => set('walkIn', 'subject', v)} />
                <TextField label="Header Subtitle" value={C.walkIn?.headerSubtitle} onChange={v => set('walkIn', 'headerSubtitle', v)} />
                <TextField label="Greeting" value={C.walkIn?.greeting} onChange={v => set('walkIn', 'greeting', v)}
                    hint="Placeholders: {first}, {last}" />
                <TextAreaField label="Intro Paragraph" value={C.walkIn?.intro} onChange={v => set('walkIn', 'intro', v)} />
                <TextField label="Schedule Heading" value={C.walkIn?.scheduleHeading} onChange={v => set('walkIn', 'scheduleHeading', v)} />
                <TextField label="Details Heading" value={C.walkIn?.detailsHeading} onChange={v => set('walkIn', 'detailsHeading', v)} />
                <TextField label="Credentials Heading" value={C.walkIn?.credentialsHeading} onChange={v => set('walkIn', 'credentialsHeading', v)} />
                <TextAreaField label="Credentials Intro" value={C.walkIn?.credentialsIntro} onChange={v => set('walkIn', 'credentialsIntro', v)} />
                <TextField label="Password Warning" value={C.walkIn?.passwordWarning} onChange={v => set('walkIn', 'passwordWarning', v)} />
                <TextField label="Verify Email Heading" value={C.walkIn?.verifyHeading} onChange={v => set('walkIn', 'verifyHeading', v)} />
                <TextAreaField label="Verify Email Intro" value={C.walkIn?.verifyIntro} onChange={v => set('walkIn', 'verifyIntro', v)} />
                <TextField label="Verify Expiry Note" value={C.walkIn?.verifyExpiry} onChange={v => set('walkIn', 'verifyExpiry', v)} />
                <TextField label="Verify Button Text" value={C.walkIn?.verifyButtonText} onChange={v => set('walkIn', 'verifyButtonText', v)} />
                <TextField label="Footer Tagline" value={C.walkIn?.footerTagline} onChange={v => set('walkIn', 'footerTagline', v)} />
            </AccordionCard>

            {/* ── Guest Enrollment ─────────────────────────── */}
            <AccordionCard icon="👥" title="Guest Enrollment Email" isOpen={openSection === 'guest'} onToggle={() => toggle('guest')}>
                <TextField label="Subject" value={C.guest?.subject} onChange={v => set('guest', 'subject', v)} />
                <TextField label="Header Subtitle" value={C.guest?.headerSubtitle} onChange={v => set('guest', 'headerSubtitle', v)} />
                <TextField label="Greeting" value={C.guest?.greeting} onChange={v => set('guest', 'greeting', v)}
                    hint="Placeholders: {first}, {last}" />
                <TextAreaField label="Intro Paragraph" value={C.guest?.intro} onChange={v => set('guest', 'intro', v)} />
                <TextField label="Schedule Heading" value={C.guest?.scheduleHeading} onChange={v => set('guest', 'scheduleHeading', v)} />
                <TextField label="Details Heading" value={C.guest?.detailsHeading} onChange={v => set('guest', 'detailsHeading', v)} />
                <TextField label="Thank You Message" value={C.guest?.thankYou} onChange={v => set('guest', 'thankYou', v)} />
                <TextField label="Footer Tagline" value={C.guest?.footerTagline} onChange={v => set('guest', 'footerTagline', v)} />
            </AccordionCard>

            {/* ── No-Show ──────────────────────────────────── */}
            <AccordionCard icon="⚠️" title="No-Show / Missed Session Email" isOpen={openSection === 'noShow'} onToggle={() => toggle('noShow')}>
                <TextField label="Subject" value={C.noShow?.subject} onChange={v => set('noShow', 'subject', v)} />
                <TextField label="Header Subtitle" value={C.noShow?.headerSubtitle} onChange={v => set('noShow', 'headerSubtitle', v)} />
                <TextField label="Greeting" value={C.noShow?.greeting} onChange={v => set('noShow', 'greeting', v)}
                    hint="Placeholders: {first}, {last}" />
                <TextAreaField label="Intro Paragraph" value={C.noShow?.intro} onChange={v => set('noShow', 'intro', v)}
                    hint="Placeholders: {courseName}, {date}, {session}. HTML allowed (e.g. <strong>)." rows={4} />
                <TextField label="Fee Heading" value={C.noShow?.feeHeading} onChange={v => set('noShow', 'feeHeading', v)} />
                <TextAreaField label="Fee Note" value={C.noShow?.feeNote} onChange={v => set('noShow', 'feeNote', v)}
                    hint="HTML allowed." />
                <TextField label="How To Reschedule Heading" value={C.noShow?.howToHeading} onChange={v => set('noShow', 'howToHeading', v)} />
                <ListEditor label="Reschedule Steps" items={C.noShow?.howToSteps} onChange={v => set('noShow', 'howToSteps', v)} />
                <TextField label="Login Button Text" value={C.noShow?.loginButtonText} onChange={v => set('noShow', 'loginButtonText', v)} />
            </AccordionCard>

            {/* ── Payment Receipt ──────────────────────────── */}
            <AccordionCard icon="💳" title="Payment Receipt Email" isOpen={openSection === 'receipt'} onToggle={() => toggle('receipt')}>
                <TextField label="Subject — Full Payment" value={C.receipt?.subjectFull} onChange={v => set('receipt', 'subjectFull', v)} />
                <TextField label="Subject — Downpayment" value={C.receipt?.subjectDown} onChange={v => set('receipt', 'subjectDown', v)} />
                <TextField label="Header — Full Payment" value={C.receipt?.headerFull} onChange={v => set('receipt', 'headerFull', v)} />
                <TextField label="Header — Downpayment" value={C.receipt?.headerDown} onChange={v => set('receipt', 'headerDown', v)} />
                <TextField label="Greeting" value={C.receipt?.greeting} onChange={v => set('receipt', 'greeting', v)}
                    hint="Placeholders: {first}, {last}" />
                <TextAreaField label="Intro — Full Payment" value={C.receipt?.introFull} onChange={v => set('receipt', 'introFull', v)} />
                <TextAreaField label="Intro — Downpayment" value={C.receipt?.introDown} onChange={v => set('receipt', 'introDown', v)} />
                <TextAreaField label="PDF Attachment Note" value={C.receipt?.pdfNote} onChange={v => set('receipt', 'pdfNote', v)}
                    hint="Placeholder: {filename}. HTML allowed." />
                <TextField label="Details Heading" value={C.receipt?.detailsHeading} onChange={v => set('receipt', 'detailsHeading', v)} />
                <TextField label="Paid In Full Label" value={C.receipt?.paidInFull} onChange={v => set('receipt', 'paidInFull', v)} />
                <TextField label="Amount Paid Label" value={C.receipt?.amountPaid} onChange={v => set('receipt', 'amountPaid', v)} />
                <TextField label="Balance Heading" value={C.receipt?.balanceHeading} onChange={v => set('receipt', 'balanceHeading', v)} />
                <TextAreaField label="Balance Note" value={C.receipt?.balanceNote} onChange={v => set('receipt', 'balanceNote', v)}
                    hint="Placeholder: {amount} (auto-formatted with ₱). HTML allowed." />
                <TextField label="Balance Steps Heading" value={C.receipt?.balanceStepsHeading} onChange={v => set('receipt', 'balanceStepsHeading', v)} />
                <ListEditor label="Balance Payment Steps" items={C.receipt?.balanceSteps} onChange={v => set('receipt', 'balanceSteps', v)}
                    hint="HTML allowed in items (e.g. <strong>)." />
                <TextField label="Success Badge" value={C.receipt?.successBadge} onChange={v => set('receipt', 'successBadge', v)} />
                <TextField label="Success Heading" value={C.receipt?.successHeading} onChange={v => set('receipt', 'successHeading', v)} />
                <TextField label="Success Note" value={C.receipt?.successNote} onChange={v => set('receipt', 'successNote', v)} />
                <TextField label="View Account Button Text" value={C.receipt?.viewAccountButton} onChange={v => set('receipt', 'viewAccountButton', v)} />
                <TextField label="Footer Tagline" value={C.receipt?.footerTagline} onChange={v => set('receipt', 'footerTagline', v)} />
            </AccordionCard>

            {/* ── Downpayment Reminder ─────────────────────── */}
            <AccordionCard icon="💰" title="Downpayment Reminder Block" isOpen={openSection === 'downpaymentReminder'} onToggle={() => toggle('downpaymentReminder')}>
                <TextField label="Heading" value={C.downpaymentReminder?.heading} onChange={v => set('downpaymentReminder', 'heading', v)} />
                <TextAreaField label="Note" value={C.downpaymentReminder?.note} onChange={v => set('downpaymentReminder', 'note', v)}
                    hint="HTML allowed (e.g. <strong>)." />
            </AccordionCard>

            {/* ── Vehicle Rental ───────────────────────────── */}
            <AccordionCard icon="🚗" title="Vehicle Rental Notices" isOpen={openSection === 'vehicleRental'} onToggle={() => toggle('vehicleRental')}>
                <TextField label="Heading" value={C.vehicleRental?.heading} onChange={v => set('vehicleRental', 'heading', v)} />
                <TextAreaField label="B1/B2 (Van/L300) Note" value={C.vehicleRental?.b1b2Note} onChange={v => set('vehicleRental', 'b1b2Note', v)} rows={4} />
                <TextAreaField label="A1 Tricycle Note" value={C.vehicleRental?.tricycleNote} onChange={v => set('vehicleRental', 'tricycleNote', v)} rows={4} />
            </AccordionCard>

            {/* ── Requirements ─────────────────────────────── */}
            <AccordionCard icon="📋" title="Requirements Checklist" isOpen={openSection === 'requirements'} onToggle={() => toggle('requirements')}>
                <TextField label="Section Heading" value={C.requirements?.heading} onChange={v => set('requirements', 'heading', v)} />
                <ListEditor label="TDC Requirements" items={C.requirements?.tdc} onChange={v => set('requirements', 'tdc', v)} />
                <ListEditor label="PDC Requirements" items={C.requirements?.pdc} onChange={v => set('requirements', 'pdc', v)} />
            </AccordionCard>

            {/* ── Terms & Conditions ───────────────────────── */}
            <AccordionCard icon="📜" title="Terms & Conditions" isOpen={openSection === 'terms'} onToggle={() => toggle('terms')}>
                <TextField label="Section Heading" value={C.terms?.heading} onChange={v => set('terms', 'heading', v)} />
                <ListEditor label="Terms Items" items={C.terms?.items} onChange={v => set('terms', 'items', v)} />
            </AccordionCard>

            {/* ── News / Promo ─────────────────────────────── */}
            <AccordionCard icon="📣" title="News & Promo Blast Email" isOpen={openSection === 'news'} onToggle={() => toggle('news')}>
                <TextField label="Header Subtitle" value={C.news?.headerSubtitle} onChange={v => set('news', 'headerSubtitle', v)} />
                <TextField label="Greeting" value={C.news?.greeting} onChange={v => set('news', 'greeting', v)}
                    hint="Placeholder: {first} (falls back to 'Student')." />
                <TextAreaField label="Intro Paragraph" value={C.news?.intro} onChange={v => set('news', 'intro', v)} />
                <TextField label="Visit Button Text" value={C.news?.visitButton} onChange={v => set('news', 'visitButton', v)} />
                <TextAreaField label="Unsubscribe/Footer Note" value={C.news?.unsubNote} onChange={v => set('news', 'unsubNote', v)} />
            </AccordionCard>

            {/* ── PDF Receipt ──────────────────────────────── */}
            <AccordionCard icon="📄" title="PDF Receipt Text" isOpen={openSection === 'pdf'} onToggle={() => toggle('pdf')}>
                <TextField label="School Name (PDF)" value={C.pdf?.schoolName} onChange={v => set('pdf', 'schoolName', v)} />
                <TextField label="Title — Full Payment" value={C.pdf?.titleFull} onChange={v => set('pdf', 'titleFull', v)} />
                <TextField label="Title — Downpayment" value={C.pdf?.titleDown} onChange={v => set('pdf', 'titleDown', v)} />
                <TextField label="Receipt Title Label" value={C.pdf?.receiptTitle} onChange={v => set('pdf', 'receiptTitle', v)} />
                <TextField label="Footer Line 1" value={C.pdf?.footerLine1} onChange={v => set('pdf', 'footerLine1', v)} />
                <TextAreaField label="Footer Line 2" value={C.pdf?.footerLine2} onChange={v => set('pdf', 'footerLine2', v)} />
                <TextField label="Balance Note" value={C.pdf?.balanceNote} onChange={v => set('pdf', 'balanceNote', v)} />
            </AccordionCard>

            {/* Bottom save button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, gap: 10, alignItems: 'center' }}>
                {saveMsg && <span style={{ fontSize: '0.82rem', color: saveMsg.startsWith('Saved') ? '#16a34a' : '#dc2626' }}>{saveMsg}</span>}
                <button
                    onClick={handleSave}
                    disabled={saving || !isDirty}
                    className="cfg-save-btn"
                    style={{ opacity: (saving || !isDirty) ? 0.5 : 1 }}
                >
                    {saving ? 'Saving…' : 'Save Changes'}
                </button>
            </div>
        </div>
    );
};

export default EmailContentSection;
