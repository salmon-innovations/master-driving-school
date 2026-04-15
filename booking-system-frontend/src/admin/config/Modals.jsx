import React, { useEffect, useRef, useState } from 'react';
import QRCodeStyling from 'qr-code-styling';

export const BranchQrModal = ({ isOpen, onClose, branch }) => {
    const [activeTheme, setActiveTheme] = useState('classic');
    const qrRef = useRef(null);
    const qrCodeInstance = useRef(null);

    const themes = {
        classic: { 
            name: 'Classic', 
            colors: ['#1e40af', '#3b82f6'], 
            text: '#1e40af', 
            bg: '#eff6ff', 
            qrType: 'rounded',
            cornerType: 'extra-rounded'
        },
        sunset: { 
            name: 'Sunset', 
            colors: ['#6d28d9', '#db2777'], 
            text: '#6d28d9', 
            bg: '#fdf2f8', 
            qrType: 'dots',
            cornerType: 'extra-rounded'
        },
        emerald: { 
            name: 'Emerald', 
            colors: ['#065f46', '#10b981'], 
            text: '#065f46', 
            bg: '#ecfdf5', 
            qrType: 'classy-rounded',
            cornerType: 'rounded'
        },
        midnight: { 
            name: 'Midnight', 
            colors: ['#0f172a', '#475569'], 
            text: '#0f172a', 
            bg: '#f8fafc', 
            qrType: 'square',
            cornerType: 'square'
        },
        amber: { 
            name: 'Amber', 
            colors: ['#92400e', '#f59e0b'], 
            text: '#92400e', 
            bg: '#fffbeb', 
            qrType: 'extra-rounded',
            cornerType: 'extra-rounded'
        },
        playful: { 
            name: 'Playful', 
            colors: ['#f43f5e', '#fb923c'], 
            text: '#e11d48', 
            bg: '#fff1f2', 
            qrType: 'dots',
            cornerType: 'rounded'
        }
    };

    const currentTheme = themes[activeTheme];
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isLocal ? `${window.location.protocol}//${window.location.host}` : 'https://masterdriving.ph';
    const qrUrl = branch ? `${baseUrl}/courses?branchId=${branch.id}` : '';

    useEffect(() => {
        if (!isOpen || !branch || !qrRef.current) return;

        qrCodeInstance.current = new QRCodeStyling({
            width: 240,
            height: 240,
            data: qrUrl,
            image: "/images/Master-logo.png",
            dotsOptions: {
                color: currentTheme.colors[0],
                type: currentTheme.qrType
            },
            cornersSquareOptions: {
                color: currentTheme.colors[0],
                type: currentTheme.cornerType
            },
            cornersDotOptions: {
                color: currentTheme.colors[0],
                type: 'dot'
            },
            backgroundOptions: {
                color: "#ffffff",
            },
            imageSettings: {
                crossOrigin: 'anonymous',
                margin: 5
            }
        });

        qrRef.current.innerHTML = "";
        qrCodeInstance.current.append(qrRef.current);
    }, [isOpen, activeTheme, branch, qrUrl]);

    if (!isOpen || !branch) return null;

    const generateBrandedCanvas = async () => {
        const qrSize = 1000;
        const canvasW = 1200;
        const canvasH = 1800;
        
        const qrGenerator = new QRCodeStyling({
            width: qrSize,
            height: qrSize,
            data: qrUrl,
            image: "/images/Master-logo.png",
            dotsOptions: { color: currentTheme.colors[0], type: currentTheme.qrType },
            cornersSquareOptions: { color: currentTheme.colors[0], type: currentTheme.cornerType },
            backgroundOptions: { color: "#ffffff" },
            imageSettings: { crossOrigin: 'anonymous', margin: 10 }
        });

        const qrBlob = await qrGenerator.getRawData('png');
        const qrUrlObj = URL.createObjectURL(qrBlob);

        const canvas = document.createElement('canvas');
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasW, canvasH);

        const gradient = ctx.createLinearGradient(0, 0, canvasW, 0);
        gradient.addColorStop(0, currentTheme.colors[0]);
        gradient.addColorStop(1, currentTheme.colors[1]);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvasW, 24);

        const loadImage = (src) => new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });

        const [logoImg, qrImg] = await Promise.all([
            loadImage('/images/logo.png'),
            loadImage(qrUrlObj)
        ]);

        const logoW = 550;
        const logoH = (logoImg.height / logoImg.width) * logoW;
        ctx.drawImage(logoImg, (canvasW - logoW) / 2, 120, logoW, logoH);

        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(canvasW * 0.2, 120 + logoH + 60);
        ctx.lineTo(canvasW * 0.8, 120 + logoH + 60);
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 64px System-ui, -apple-system, sans-serif';
        ctx.fillText('Official Registration QR', canvasW / 2, 120 + logoH + 180);

        ctx.fillStyle = currentTheme.colors[0];
        ctx.font = '800 42px System-ui, -apple-system, sans-serif';
        ctx.fillText(branch.name.toUpperCase(), canvasW / 2, 120 + logoH + 260);

        const qrPadding = 40;
        const qrDisplaySize = 850;
        const qrX = (canvasW - qrDisplaySize) / 2;
        const qrY = 120 + logoH + 360;

        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(qrX - qrPadding, qrY - qrPadding, qrDisplaySize + qrPadding * 2, qrDisplaySize + qrPadding * 2, 60);
        } else {
            ctx.rect(qrX - qrPadding, qrY - qrPadding, qrDisplaySize + qrPadding * 2, qrDisplaySize + qrPadding * 2);
        }
        ctx.fill();
        
        ctx.drawImage(qrImg, qrX, qrY, qrDisplaySize, qrDisplaySize);

        const footerY = canvasH - 180;
        let footerBg = '#fdf2f8';
        if (activeTheme === 'classic') footerBg = '#eff6ff';
        if (activeTheme === 'emerald') footerBg = '#ecfdf5';
        ctx.fillStyle = footerBg;
        ctx.fillRect(0, canvasH - 240, canvasW, 240);
        
        ctx.textAlign = 'center';
        ctx.fillStyle = currentTheme.text;
        ctx.font = '800 36px System-ui, -apple-system, sans-serif';
        ctx.fillText('Master Driving School', canvasW / 2, footerY);
        
        ctx.fillStyle = '#64748b';
        ctx.font = '600 28px System-ui, -apple-system, sans-serif';
        ctx.fillText('Building Champions on the Road • Since 1999', canvasW / 2, footerY + 50);

        URL.revokeObjectURL(qrUrlObj);
        return canvas;
    };

    const handleDownload = async () => {
        try {
            const canvas = await generateBrandedCanvas();
            const finalImage = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `MasterDriving_${branch.name.replace(/\s+/g, '_')}_QR.png`;
            link.href = finalImage;
            link.click();
        } catch (err) {
            console.error("Error generating branded QR for download:", err);
        }
    };

    const handlePrint = async () => {
        try {
            const canvas = await generateBrandedCanvas();
            const dataUrl = canvas.toDataURL('image/png');
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Print QR — ${branch.name}</title>
                        <style>
                            @page { 
                                size: auto; 
                                margin: 0mm; 
                            }
                            html, body { 
                                margin: 0; 
                                padding: 0; 
                                width: 100%; 
                                height: 100%;
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                background: #ffffff;
                                overflow: hidden;
                            }
                            img { 
                                max-width: 95%; 
                                max-height: 95vh;
                                object-fit: contain;
                                page-break-inside: avoid;
                            }
                            @media print {
                                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                                html, body { height: 100vh; }
                            }
                        </style>
                    </head>
                    <body>
                        <img src="${dataUrl}" onload="setTimeout(() => { window.print(); window.onafterprint = () => window.close(); }, 500);" />
                    </body>
                </html>
            `);
            printWindow.document.close();
        } catch (err) {
            console.error("Error generating branded QR for print:", err);
        }
    };

    return (
        <div className="cfg-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()} style={{ zIndex: 3000 }}>
            <div className="cfg-modal" style={{ maxWidth: '520px', borderRadius: '32px', overflow: 'hidden', border: 'none', boxShadow: '0 30px 80px -15px rgba(15, 23, 42, 0.4)' }}>
                <div className="cfg-modal-header" style={{ background: `linear-gradient(135deg, ${currentTheme.colors[0]} 0%, ${currentTheme.colors[1]} 100%)`, padding: '24px 32px', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.4s ease' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '14px', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.2)' }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                                <path d="M12 4v4m0 8v4M4 12h4m8 0h4" strokeLinecap="round"/>
                                <rect x="9" y="9" width="6" height="6" rx="1.5" />
                            </svg>
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', letterSpacing: '-0.02em', margin: 0 }}>Branded Portal QR</h2>
                            <p style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.8)', margin: 0 }}>Secure branch entry point</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        style={{ 
                            background: 'rgba(255,255,255,0.15)', 
                            border: 'none', 
                            borderRadius: '12px', 
                            width: '36px', 
                            height: '36px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            cursor: 'pointer',
                            color: 'white',
                            transition: 'all 0.2s ease',
                            backdropFilter: 'blur(4px)'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <div className="cfg-modal-body" style={{ padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', background: '#ffffff' }}>
                    <img src="/images/logo.png" alt="Logo" style={{ height: '52px' }} />

                    <div style={{ display: 'flex', gap: '12px', background: '#f8fafc', padding: '8px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                        {Object.entries(themes).map(([id, theme]) => (
                            <button
                                key={id}
                                onClick={() => setActiveTheme(id)}
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    background: `linear-gradient(135deg, ${theme.colors[0]}, ${theme.colors[1]})`,
                                    border: activeTheme === id ? '3px solid #ffffff' : 'none',
                                    boxShadow: activeTheme === id ? `0 0 0 2px ${theme.colors[0]}` : 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    transform: activeTheme === id ? 'scale(1.1)' : 'scale(1)'
                                }}
                                title={theme.name}
                            />
                        ))}
                    </div>

                    <div style={{ background: currentTheme.bg, padding: '10px 24px', borderRadius: '16px', border: `1px solid ${currentTheme.colors[0]}20`, display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.3s ease' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: '900', color: currentTheme.text, letterSpacing: '0.01em' }}>📍 {branch.name}</span>
                    </div>

                    <div className="qr-container" style={{ padding: '12px', borderRadius: '28px', background: 'white', boxShadow: `0 20px 40px -10px ${currentTheme.colors[0]}25`, border: '1.5px solid #f1f5f9', position: 'relative' }}>
                        <div ref={qrRef} />
                    </div>
                    
                    <div style={{ width: '100%' }}>
                        <p style={{ fontSize: '0.7rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center', marginBottom: '8px' }}>Portal URL</p>
                        <div style={{ fontSize: '0.75rem', color: '#475569', background: '#f8fafc', padding: '12px', borderRadius: '14px', border: '1px solid #e2e8f0', textAlign: 'center', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                            {qrUrl}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                        <button 
                             onClick={handleDownload}
                             style={{ 
                                flex: 1,
                                height: '56px',
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                gap: '10px', 
                                fontSize: '0.95rem',
                                fontWeight: '800',
                                borderRadius: '18px',
                                background: `linear-gradient(135deg, ${currentTheme.colors[0]}, ${currentTheme.colors[1]})`,
                                boxShadow: `0 10px 20px -5px ${currentTheme.colors[0]}40`,
                                border: 'none',
                                color: 'white',
                                cursor: 'pointer',
                                transition: 'transform 0.2s ease'
                             }}
                             onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                             onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                            Download
                        </button>
                        <button 
                             onClick={handlePrint}
                             style={{ 
                                flex: 1,
                                height: '56px',
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                gap: '10px', 
                                fontSize: '0.95rem',
                                fontWeight: '800',
                                borderRadius: '18px',
                                background: '#f8fafc',
                                border: '2px solid #e2e8f0',
                                color: '#475569',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                             }}
                             onMouseEnter={e => {
                                 e.currentTarget.style.background = '#f1f5f9';
                                 e.currentTarget.style.transform = 'translateY(-2px)';
                             }}
                             onMouseLeave={e => {
                                 e.currentTarget.style.background = '#f8fafc';
                                 e.currentTarget.style.transform = 'translateY(0)';
                             }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                                <rect x="6" y="14" width="12" height="8"></rect>
                            </svg>
                            Print QR
                        </button>
                    </div>
                    
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' }}>Close Portal window</button>
                </div>
            </div>
        </div>
    );
};

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

export const RoleModal = ({ isOpen, onClose, onSubmit, formData, setFormData, isEditing, isSystemRole = false }) => {
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
                                    disabled={isEditing && isSystemRole}
                                    placeholder="e.g. branch_manager"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                                />
                                {isEditing && isSystemRole && (
                                    <small style={{ color: 'var(--secondary-text)', marginTop: '6px', display: 'block' }}>
                                        Internal code is locked for system roles.
                                    </small>
                                )}
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
