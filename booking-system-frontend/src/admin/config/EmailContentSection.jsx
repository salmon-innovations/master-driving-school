import React, { useState, useEffect } from 'react';
import { emailContentAPI } from '../../services/api';
const IconClose = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18M6 6l12 12"/></svg>;
const IconMail = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>;
const IconLink = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>;

const TextField = ({ label, value, onChange, hint, icon }) => (
    <div className="mb-5">
        <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            {icon} {label}
        </label>
        <input 
            type="text" 
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            value={value || ''} 
            onChange={e => onChange(e.target.value)} 
        />
        {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
);

const TextAreaField = ({ label, value, onChange, hint }) => (
    <div className="mb-5">
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{label}</label>
        <textarea 
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm leading-relaxed bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            rows={4}
            value={value || ''} 
            onChange={e => onChange(e.target.value)} 
        />
        {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
);

const interp = (str, vars) => String(str||'').replace(/\{(\w+)\}/g, (_,v) => vars[v] ? vars[v] : `{${v}}`);

const EmailPreviewWrapper = ({ schoolName, title, copyrightYear, footerTagline, children, brandColor = '#2157da' }) => (
    <div style={{ fontFamily: 'Arial, sans-serif', lineHeight: 1.6, color: '#333', maxWidth: 600, margin: '0 auto', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', backgroundColor:'#fff', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
        <div style={{ backgroundColor: brandColor, color: 'white', padding: '25px 20px', textAlign: 'center', background: `linear-gradient(135deg, ${brandColor} 0%, #3b82f6 100%)` }}>
            <h1 style={{ color: 'white', margin: 0, fontSize: '24px' }}>{schoolName}</h1>
            <h2 style={{ color: 'white', margin: '10px 0 0', fontSize: '16px', fontWeight: 'normal', opacity: 0.9 }}>{title}</h2>
        </div>
        <div style={{ padding: '30px', backgroundColor: '#f9f9f9', fontSize: '15px' }}>
            {children}
        </div>
        <div style={{ textAlign: 'center', padding: '20px', fontSize: '12px', color: '#9ca3af', borderTop: '1px solid #e2e8f0', backgroundColor:'#f1f5f9' }}>
            {footerTagline && <p style={{ margin: '0 0 5px 0' }}>{footerTagline}</p>}
            <p style={{ margin: 0 }}>&copy; {copyrightYear} {schoolName}. All rights reserved.</p>
        </div>
    </div>
);


const Icons = {
    walkIn: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>,
    guest: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    noShow: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>,
    news: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>,
    receipt: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17V7"/></svg>,
    newAccount: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>,
    verification: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    online: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
};

const EmailContentSection = () => {
    const [content, setContent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [selectedEmail, setSelectedEmail] = useState(null);
    const [testEmail, setTestEmail] = useState('');
    const [sendingTest, setSendingTest] = useState(false);
    const [previewCourse, setPreviewCourse] = useState('TDC');
    const [previewType, setPreviewType] = useState('Face-to-Face');

    useEffect(() => {
        emailContentAPI.get().then(data => {
            if (data?.content) setContent(data.content);
            setLoading(false);
        }).catch(err => {
            console.error(err);
            setLoading(false);
        });
    }, []);

    const handleChange = (section, field, value) => {
        setContent(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value
            }
        }));
        setIsDirty(true);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await emailContentAPI.update(content);
            setIsDirty(false);
            alert('Saved successfully!');
        } catch (err) {
            console.error(err);
            alert('Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const handleSendTest = async () => {
        if (!testEmail) return alert('Enter a test email address.');
        try {
            setSendingTest(true);
            const p = document.getElementById('preview-container');
            const html = p ? p.innerHTML : '';
            await emailContentAPI.testEmail({ email: testEmail, subject: `Test Preview: ${selectedEmail}`, html });
            alert('Test email sent successfully!');
        } catch (err) {
            console.error(err);
            alert('Failed to send test email.');
        } finally {
            setSendingTest(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500 flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div> Loading configurations...</div>;
    if (!content) return <div className="p-8 text-center text-red-500">Error loading content</div>;

    const emailTypes = [
        { id: 'walkIn', title: 'Walk-In Enrollment', desc: 'Sent to walk-in students with credentials.', color: 'emerald', icon: Icons?.walkIn },
        { id: 'guest', title: 'Guest Enrollment', desc: 'Sent to guests enrolling themselves.', color: 'blue', icon: Icons?.guest },
        { id: 'noShow', title: 'No-Show / Missed', desc: 'Sent when a student misses a session.', color: 'rose', icon: Icons?.noShow },
        { id: 'news', title: 'News & Promos', desc: 'Promotional broadcast emails.', color: 'purple', icon: Icons?.news },
        { id: 'receipt', title: 'Payment Receipt', desc: 'Sent after successful transactions.', color: 'amber', icon: Icons?.receipt },
        { id: 'newAccount', title: 'New Admin Account', desc: 'Sent to new admin members.', color: 'indigo', icon: Icons?.newAccount },
        { id: 'verification', title: 'Verification & OTP', desc: 'Sent when users register or reset passwords.', color: 'slate', icon: Icons?.verification }
    ];

    const renderEditorInputs = () => {
        if (!selectedEmail) return null;
        const c = content[selectedEmail];
        
        return (
            <div className="space-y-4">
                {(c.subject !== undefined || c.subjectVerify !== undefined) && (
                    <TextField label="Email Subject" value={c.subject || c.subjectVerify} onChange={v => { handleChange(selectedEmail, 'subject', v); if(c.subjectVerify !== undefined) handleChange(selectedEmail, 'subjectVerify', v); }} />
                )}
                
                {(c.headerTitle || c.headerSubtitle || c.titleVerify) && (
                    <TextField label="Header Title / Subtitle" value={c.headerTitle || c.headerSubtitle || c.titleVerify} onChange={v => { 
                        if(c.headerTitle !== undefined) handleChange(selectedEmail, 'headerTitle', v); 
                        if(c.headerSubtitle !== undefined) handleChange(selectedEmail, 'headerSubtitle', v); 
                        if(c.titleVerify !== undefined) handleChange(selectedEmail, 'titleVerify', v); 
                    }} />
                )}

                {c.greeting !== undefined && <TextField label="Greeting" value={c.greeting} onChange={v => handleChange(selectedEmail, 'greeting', v)} hint="Variables: {first}, {last}" />}
                
                {c.intro !== undefined && <TextAreaField label="Intro Section" value={c.intro} onChange={v => handleChange(selectedEmail, 'intro', v)} hint={selectedEmail === 'noShow' ? "Variables: {courseName}, {session}, {date}" : "Main introductory text"} />}
                
                {c.messageVerify !== undefined && <TextAreaField label="Verification Message" value={c.messageVerify} onChange={v => handleChange(selectedEmail, 'messageVerify', v)} />}

                {(c.visitButton !== undefined || c.verifyButtonText !== undefined || c.loginButtonText !== undefined || c.viewAccountButton !== undefined) && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900 p-4 rounded-lg mt-6 shadow-sm">
                        <h4 className="font-bold text-blue-900 dark:text-blue-300 text-sm mb-3">Call to Action Button</h4>
                        <TextField label="Button Text" value={c.visitButton || c.verifyButtonText || c.loginButtonText || c.viewAccountButton} onChange={v => {
                            if(c.visitButton !== undefined) handleChange(selectedEmail, 'visitButton', v);
                            if(c.verifyButtonText !== undefined) handleChange(selectedEmail, 'verifyButtonText', v);
                            if(c.loginButtonText !== undefined) handleChange(selectedEmail, 'loginButtonText', v);
                            if(c.viewAccountButton !== undefined) handleChange(selectedEmail, 'viewAccountButton', v);
                        }} />
                        <TextField icon={<IconLink />} label="Button Link (URL)" value={c.buttonUrl || ''} onChange={v => handleChange(selectedEmail, 'buttonUrl', v)} hint="Enter full HTTPS URL. Leave blank for default." />
                    </div>
                )}
            </div>
        );
    };

    const renderPreviewHTML = () => {
        const c = content[selectedEmail];
        const btnUrl = c.buttonUrl || '#';
        
        switch (selectedEmail) {
            case 'news': return (
                <div>
                    <h2 style={{ marginTop: 0 }}>{interp(c.greeting, {first:'John'})}</h2>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{c.intro}</p>
                    <div style={{ background: 'white', borderRadius: '8px', padding: '20px', margin: '15px 0', border: '1px solid #e5e7eb' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', background: '#e0f2fe', color: '#0284c7', marginBottom: '10px' }}>PROMO</span>
                            <span style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' }}>NEWS/PROMO</span>
                        </div>
                        <h3 style={{ color: '#1a4fba', margin: '10px 0' }}>Super Summer Sale 2026</h3>
                        <p style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>Get 20% off on all driving courses this summer! Limited slots available.</p>
                    </div>
                    <div style={{ textAlign: 'center', marginTop: '25px' }}>
                        <a href={btnUrl} style={{ display: 'inline-block', padding: '12px 24px', backgroundColor: '#1a4fba', color: 'white', textDecoration: 'none', borderRadius: '6px', fontWeight: 'bold' }}>{c.visitButton || 'Enroll Now'}</a>
                    </div>
                </div>
            );
            case 'walkIn':
            case 'guest':
            case 'online': return (
                <div>
                    <h2 style={{ marginTop: 0 }}>{interp(c.greeting, {first:'John', last:'Doe'})}</h2>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{c.intro}</p>
                    
                    <h3 style={{ borderBottom: '2px solid #e5e7eb', paddingBottom: '10px', color: '#1f2937', marginTop: '30px' }}>{c.scheduleHeading || 'Your Training Schedule'}</h3>
                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '15px', borderRadius: '6px', marginBottom: '20px' }}>
                        <p style={{ margin: '5px 0' }}><strong>Course:</strong> TDC (Theoretical Driving Course)</p>
                        <p style={{ margin: '5px 0' }}><strong>Schedule:</strong> Aug 12, 13, 14</p>
                        <p style={{ margin: '5px 0' }}><strong>Time:</strong> 08:00 AM - 10:00 AM</p>
                    </div>

                    <h3 style={{ borderBottom: '2px solid #e5e7eb', paddingBottom: '10px', color: '#1f2937' }}>{c.credentialsHeading || 'Login Credentials'}</h3>
                    {c.credentialsIntro && <p>{c.credentialsIntro}</p>}
                    <div style={{ background: '#f3f4f6', padding: '15px', borderRadius: '6px', fontFamily: 'monospace', marginBottom: '10px', fontSize: '15px', border: '1px solid #e5e7eb' }}>
                        <strong>Email:</strong> john.doe@example.com<br/>
                        <strong>Password:</strong> samplepass123
                    </div>
                    <p style={{ color: '#dc2626', fontSize: '13px', fontWeight: 'bold', margin: '15px 0' }}>{c.passwordWarning}</p>

                    <div style={{ textAlign: 'center', marginTop: '30px' }}>
                        <a href={btnUrl} style={{ display: 'inline-block', padding: '14px 28px', backgroundColor: '#2157da', color: '#ffffff', textDecoration: 'none', borderRadius: '6px', fontWeight: 'bold' }}>{c.verifyButtonText || c.loginButtonText || 'Button'}</a>
                    </div>
                </div>
            );
            case 'noShow': return (
                <div>
                    <h2 style={{ marginTop: 0, color: '#dc2626' }}>{interp(c.greeting, {first:'John', last:'Doe'})}</h2>
                    <p>{interp(c.intro, {courseName: 'PDC - Manual', date: 'August 12, 2026', session: 'Session 2'})}</p>
                    
                    <h3 style={{ color: '#111827', marginTop: '25px' }}>{c.howToHeading}</h3>
                    <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                        <ol style={{ margin: 0, paddingLeft: '20px', color: '#4b5563' }}>
                            {c.howToSteps?.map((s,i) => <li key={i} style={{marginBottom: '10px'}}>{s}</li>)}
                        </ol>
                    </div>

                    <div style={{ textAlign: 'center', marginTop: '30px' }}>
                        <a href={btnUrl} style={{ display: 'inline-block', padding: '12px 24px', backgroundColor: '#dc2626', color: '#ffffff', textDecoration: 'none', borderRadius: '5px', fontWeight: 'bold' }}>{c.loginButtonText}</a>
                    </div>
                </div>
            );
            case 'receipt': return (
                <div>
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                        <span style={{ display: 'inline-block', background: '#dcfce7', color: '#166534', padding: '6px 12px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold' }}>
                            ✓ {c.headerSubtitle || 'Payment Receipt'}
                        </span>
                    </div>
                    <h2 style={{ marginTop: 0 }}>{interp(c.greeting, {first:'John', last:'Doe'})}</h2>
                    <p>{c.intro}</p>
                    <div style={{ background: '#eff6ff', padding: '20px', borderRadius: '8px', margin: '25px 0', border: '1px solid #bfdbfe' }}>
                        <h1 style={{ color: '#1e3a8a', textAlign: 'center', margin: '0 0 10px 0', fontSize: '32px' }}>₱ 2,500.00</h1>
                        <p style={{ textAlign: 'center', margin: 0, color: '#1d4ed8', fontSize: '15px' }}>{c.successNote || 'Payment Processed Successfully'}</p>
                    </div>

                    {c.pdfNote && <p style={{ fontSize: '13px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '5px' }}>📎 {interp(c.pdfNote, {filename: 'receipt_123.pdf'})}</p>}

                    <div style={{ textAlign: 'center', marginTop: '30px' }}>
                        <a href={btnUrl} style={{ display: 'inline-block', padding: '14px 32px', background: 'linear-gradient(135deg, #1a4fba, #3b82f6)', color: '#fff', textDecoration: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.4)' }}>
                            {c.viewAccountButton || 'View Account'}
                        </a>
                    </div>
                </div>
            );
            case 'newAccount': return (
                <div>
                    <h2 style={{marginTop:0}}>{c.headerTitle}</h2>
                    <h3 style={{ borderBottom: '2px solid #e5e7eb', paddingBottom: '10px', marginTop: '25px' }}>{c.credentialsHeading}</h3>
                    <div style={{ background: '#f3f4f6', padding: '20px', borderRadius: '8px', fontFamily: 'monospace', marginBottom: '15px', border: '1px solid #e5e7eb', fontSize: '15px' }}>
                        <strong>Role:</strong> Admin<br/>
                        <strong>Email:</strong> admin@school.com<br/>
                        <strong>Password:</strong> adminpass123
                    </div>
                    <p style={{ marginTop: '25px', padding: '15px', backgroundColor: '#fef2f2', color: '#b91c1c', borderLeft: '4px solid #ef4444', borderRadius: '4px' }}>
                        <strong>{c.securityHeading}</strong><br/>
                        <ul style={{ margin: '10px 0 0 0', paddingLeft: '20px' }}>
                            {c.securityPoints?.map((p,i) => <li key={i}>{p}</li>)}
                        </ul>
                    </p>
                    <p style={{marginTop:'25px'}}>{c.loginPrompt}</p>
                    <div style={{ textAlign: 'center', marginTop: '30px' }}>
                        <a href={btnUrl} style={{ display: 'inline-block', padding: '12px 28px', backgroundColor: '#2157da', color: '#ffffff', textDecoration: 'none', borderRadius: '6px', fontWeight: 'bold' }}>{c.loginButtonText}</a>
                    </div>
                </div>
            );
            case 'verification': return (
                <div>
                    <h2 style={{ marginTop: 0 }}>Hello John Doe!</h2>
                    <p>{c.messageVerify}</p>
                    <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#2157da', textAlign: 'center', padding: '25px', backgroundColor: '#fff', border: '2px dashed #2157da', margin: '25px 0', letterSpacing: '8px', borderRadius: '8px' }}>
                        804912
                    </div>
                    <p style={{ color: '#4b5563' }}>{c.expiry}</p>
                    <p style={{ color: '#4b5563', fontSize: '13px' }}>{c.notRequested}</p>
                </div>
            );
            default: return (
                <div>
                    <h2 style={{ fontSize: '18px', color: '#1f2937' }}>{interp(c.greeting || 'Hello {first}!', {first:'John', last:'Doe'})}</h2>
                    <p style={{ color: '#4b5563' }}>{c.intro || c.messageVerify || 'Here is your sample notification email.'}</p>
                </div>
            );
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 font-sans">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Email Content Configuration</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">Design your emails with rich text and dynamic placeholders. Click a card below to edit.</p>
                </div>
                {isDirty && (
                    <button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-semibold transition shadow-md flex items-center gap-2">
                         {saving ? 'Saving Changes...' : 'Save All Changes'}
                    </button>
                )}
            </div>

            {/* Global Settings */}
            <div className="mb-10 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
                <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-5 border-b border-gray-100 dark:border-slate-700 pb-3 flex items-center gap-2">
                    Branding & Global Settings
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <TextField label="School Name" value={content.schoolName} onChange={v => { setContent(p => ({...p, schoolName: v})); setIsDirty(true); }} />
                    <TextField label="Footer Tagline" value={content.footerTagline} onChange={v => { setContent(p => ({...p, footerTagline: v})); setIsDirty(true); }} />
                    <TextField label="Copyright Year" value={content.copyrightYear} onChange={v => { setContent(p => ({...p, copyrightYear: v})); setIsDirty(true); }} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {emailTypes.map(type => {
                const Icon = type.icon || (() => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>);
                const themeDef = {
                    emerald: { base: 'hover:border-emerald-300 dark:hover:border-emerald-600', icon: 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white', textH: 'group-hover:text-emerald-700 dark:group-hover:text-emerald-400' },
                    blue: { base: 'hover:border-blue-300 dark:hover:border-blue-600', icon: 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white', textH: 'group-hover:text-blue-700 dark:group-hover:text-blue-400' },
                    rose: { base: 'hover:border-rose-300 dark:hover:border-rose-600', icon: 'bg-rose-50 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 group-hover:bg-rose-600 group-hover:text-white', textH: 'group-hover:text-rose-700 dark:group-hover:text-rose-400' },
                    purple: { base: 'hover:border-purple-300 dark:hover:border-purple-600', icon: 'bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 group-hover:bg-purple-600 group-hover:text-white', textH: 'group-hover:text-purple-700 dark:group-hover:text-purple-400' },
                    amber: { base: 'hover:border-amber-300 dark:hover:border-amber-600', icon: 'bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 group-hover:bg-amber-600 group-hover:text-white', textH: 'group-hover:text-amber-700 dark:group-hover:text-amber-400' },
                    indigo: { base: 'hover:border-indigo-300 dark:hover:border-indigo-600', icon: 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white', textH: 'group-hover:text-indigo-700 dark:group-hover:text-indigo-400' },
                    slate: { base: 'hover:border-slate-300 dark:hover:border-slate-600', icon: 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-400 group-hover:bg-slate-600 group-hover:text-white', textH: 'group-hover:text-slate-700 dark:group-hover:text-slate-400' },
                    cyan: { base: 'hover:border-cyan-300 dark:hover:border-cyan-600', icon: 'bg-cyan-50 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400 group-hover:bg-cyan-600 group-hover:text-white', textH: 'group-hover:text-cyan-700 dark:group-hover:text-cyan-400' },
                }[type.color] || { base: '', icon: '', textH: '' };

                return (
                    <div key={type.id} onClick={() => setSelectedEmail(type.id)} className={`bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 flex flex-col cursor-pointer hover:shadow-xl dark:hover:shadow-indigo-900/20 transition-all duration-300 group hover:-translate-y-1 block ${themeDef.base}`}>
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-all duration-300 shadow-sm ${themeDef.icon}`}>
                            <Icon />
                        </div>
                        <h3 className={`font-bold text-gray-800 dark:text-white text-lg mb-2 transition-colors ${themeDef.textH}`}>{type.title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed flex-1 mb-4">{type.desc}</p>
                        
                        <div className={`flex items-center justify-between font-semibold text-sm opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 duration-300 pt-3 border-t border-gray-100/0 dark:border-slate-700/0 group-hover:border-gray-100/50 dark:group-hover:border-slate-700/50 ${themeDef.textH}`}>
                            <span>Configure Template</span>
                            <span>&rarr;</span>
                        </div>
                    </div>
                );
            })}
        </div>

            {/* Email Edit Modal */}
            {selectedEmail && (
                <div className="fixed inset-0 z-[1050] flex items-center justify-center p-3 sm:p-6 bg-gray-900/70 backdrop-blur-md transition-opacity">
                    <div className="bg-gray-50 dark:bg-slate-900 w-full max-w-[1300px] h-[95vh] sm:h-[88vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 border border-gray-200 dark:border-slate-700">
                        {/* Header */}
                        <div className="bg-white dark:bg-slate-800 px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center shrink-0">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                                <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 p-2 rounded-lg"><IconMail /></span>
                                Editing: {emailTypes.find(t=>t.id === selectedEmail)?.title}
                            </h2>
                            <button onClick={() => setSelectedEmail(null)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/40 hover:text-red-600 dark:hover:text-red-400 rounded-full text-gray-400 dark:text-gray-500 transition-colors">
                                <IconClose />
                            </button>
                        </div>
                        
                        {/* Split Body */}
                        <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
                            {/* Editor Column */}
                            <div className="w-full md:w-[400px] lg:w-[480px] bg-white dark:bg-slate-800 border-b md:border-b-0 md:border-r border-gray-200 dark:border-slate-700 overflow-y-auto p-6 lg:p-8 flex flex-col shrink-0 relative">
                                <div className="flex-1">
                                    <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6">Template Fields</h3>
                                    {renderEditorInputs()}
                                </div>
                                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-slate-700 shrink-0 sticky bottom-0 bg-white dark:bg-slate-800 pb-2">
                                    <button onClick={handleSave} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition shadow-md mb-3 flex justify-center items-center gap-2">
                                        {saving ? 'Saving...' : 'Save All Changes'}
                                    </button>
                                    <button onClick={() => setSelectedEmail(null)} className="w-full bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 py-3 rounded-lg font-medium transition">Close Editor</button>
                                </div>
                            </div>

                            {/* Preview Column */}
                            <div className="flex-1 bg-gray-100 dark:bg-slate-900 overflow-y-auto p-6 sm:p-8 flex flex-col items-center">
                                <div className="w-full max-w-[650px] mb-4 flex justify-between items-center bg-white dark:bg-slate-800 px-4 py-3 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
                                    <h3 className="text-sm font-bold text-gray-600 dark:text-gray-300 uppercase tracking-widest flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse ring-4 ring-green-500/20"></div> 
                                        Live Mail Preview
                                    </h3>
                                    <div className="text-xs text-gray-400 dark:text-gray-500">Updates instantly</div>
                                </div>
                                
                                <div className="w-full max-w-[650px] flex-1">
                                    <div id="preview-container" className="shadow-xl rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600 transition-all">
                                        <EmailPreviewWrapper 
                                            schoolName={content.schoolName}
                                            copyrightYear={content.copyrightYear}
                                            footerTagline={content.footerTagline}
                                            title={content[selectedEmail]?.headerTitle || content[selectedEmail]?.headerSubtitle || content[selectedEmail]?.titleVerify || 'Notification'}
                                        >
                                            {renderPreviewHTML()}
                                        </EmailPreviewWrapper>
                                    </div>
                                </div>

                                {/* Send Test Box */}
                                <div className="mt-8 bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-md w-full max-w-[650px]">
                                    <label className="block text-sm font-semibold text-gray-800 dark:text-white mb-3">Test this Email Layout</label>
                                    <div className="flex gap-3">
                                        <input type="email" value={testEmail} onChange={e=>setTestEmail(e.target.value)} placeholder="Enter email address (e.g. you@example.com)" className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                        <button onClick={handleSendTest} disabled={sendingTest} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-semibold transition shadow-sm whitespace-nowrap min-w-[130px] flex justify-center items-center">
                                            {sendingTest ? 'Sending...' : 'Send Test'}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-3">This will send an actual email to verify the design in your email client.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmailContentSection;
