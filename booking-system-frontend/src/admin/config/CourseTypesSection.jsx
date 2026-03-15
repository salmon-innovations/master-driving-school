import React, { useState, useEffect } from 'react';
import { coursesAPI } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';

/* â”€â”€â”€ Default config (mirrors backend defaults) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const DEFAULT_CONFIG = {
    categories: ['Basic', 'TDC', 'PDC', 'Promo'],
    tdcTypes: [
        { value: 'F2F', label: 'F2F (Face-to-Face)' },
        { value: 'Online', label: 'Online' },
    ],
    pdcTypes: [
        { value: 'Automatic', label: 'Automatic' },
        { value: 'Manual', label: 'Manual' },
        { value: 'V1-Tricycle', label: 'V1-Tricycle' },
        { value: 'B1-Van/B2 - L300', label: 'B1 - Van/B2 - L300' },
    ],
    bundleTypes: [
        { value: 'F2F+Motorcycle', label: 'F2F TDC + MOTOR (Motorcycle PDC)' },
        { value: 'F2F+CarAT', label: 'F2F TDC + CAR AT (Car Automatic PDC)' },
        { value: 'F2F+CarMT', label: 'F2F TDC + CAR MT (Car Manual PDC)' },
        { value: 'Online+Motorcycle', label: 'OTDC + MOTOR (Motorcycle PDC)' },
        { value: 'Online+CarAT', label: 'OTDC + CAR AT (Car Automatic PDC)' },
        { value: 'Online+CarMT', label: 'OTDC + CAR MT (Car Manual PDC)' },
    ],
};

const CORE_CATEGORIES = ['Basic', 'TDC', 'PDC', 'Promo'];

const PALETTE = {
    categories: { iconClass: 'icon-purple', accent: '#7c3aed', light: '#ede9fe', text: '#6d28d9' },
    tdcTypes:   { iconClass: 'blue',        accent: '#2563eb', light: '#dbeafe', text: '#1d4ed8' },
    pdcTypes:   { iconClass: 'emerald',     accent: '#059669', light: '#d1fae5', text: '#065f46' },
    bundleTypes:{ iconClass: 'amber',       accent: '#d97706', light: '#fef3c7', text: '#b45309' },
};

/* â”€â”€â”€ Shared field using cfg-form-field for dark mode â”€â”€â”€ */
const Field = ({ children, style }) => (
    <div className="cfg-form-field" style={style}>{children}</div>
);

/* â”€â”€â”€ Card wrapper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const TypeCard = ({ title, iconClass, icon, badge, fullWidth, children }) => (
    <div className={`cfg-settings-card${fullWidth ? ' ct-full-width' : ''}`}>
        <div className="cfg-settings-card-header">
            <div className={`cfg-settings-header-icon ${iconClass}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{icon}</svg>
            </div>
            <h3>{title}</h3>
            {badge !== undefined && <span className="cfg-settings-badge">{badge}</span>}
        </div>
        <div className="cfg-settings-card-body" style={{ gap: 0, padding: 0 }}>
            {children}
        </div>
    </div>
);

/* â”€â”€â”€ Category row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const CategoryRow = ({ cat, isCore, onDelete }) => (
    <div className="ct-row">
        <div className="ct-row-left">
            <div className="ct-avatar" style={{ background: PALETTE.categories.light, color: PALETTE.categories.text }}>
                {cat[0].toUpperCase()}
            </div>
            <span className="ct-row-name">{cat}</span>
        </div>
        {isCore
            ? <span className="ct-core-badge">core</span>
            : (
                <div className="ct-actions">
                    <button onClick={onDelete} className="ct-btn delete" title="Remove">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                </div>
            )
        }
    </div>
);

/* â”€â”€â”€ Generic type row (TDC / PDC) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const TypeRow = ({ item, palette, onEdit, onDelete, isEditing, onSave, onCancel }) => {
    const [val, setVal] = useState(item.value);
    const [lbl, setLbl] = useState(item.label);
    useEffect(() => { if (isEditing) { setVal(item.value); setLbl(item.label); } }, [isEditing, item.value, item.label]);

    if (isEditing) return (
        <div className="ct-edit-row">
            <Field style={{ flex: '0 0 110px' }}>
                <input value={val} onChange={e => setVal(e.target.value)} placeholder="Value" />
            </Field>
            <Field style={{ flex: '1 1 150px' }}>
                <input value={lbl} onChange={e => setLbl(e.target.value)} placeholder="Display label" />
            </Field>
            <button onClick={() => onSave(val.trim(), lbl.trim() || val.trim())} className="ct-save-btn"
                style={{ background: palette.accent }}>Save</button>
            <button onClick={onCancel} className="ct-cancel-btn">Cancel</button>
        </div>
    );

    return (
        <div className="ct-row">
            <div className="ct-row-left">
                <div className="ct-avatar" style={{ background: palette.light, color: palette.text }}>
                    {item.value[0].toUpperCase()}
                </div>
                <div>
                    <div className="ct-row-name">{item.label}</div>
                    {item.label !== item.value && (
                        <div className="ct-row-sub">value: {item.value}</div>
                    )}
                </div>
            </div>
            <div className="ct-actions">
                <button onClick={onEdit} className="ct-btn edit" title="Edit">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button onClick={onDelete} className="ct-btn delete" title="Remove">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
            </div>
        </div>
    );
};

/* â”€â”€â”€ Bundle row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const BundleRow = ({ item, onEdit, onDelete, isEditing, onSave, onCancel }) => {
    const p = PALETTE.bundleTypes;
    const [tdc, pdc] = item.value.includes('+') ? item.value.split('+') : [item.value, ''];
    const [val, setVal] = useState(item.value);
    const [lbl, setLbl] = useState(item.label);
    useEffect(() => { if (isEditing) { setVal(item.value); setLbl(item.label); } }, [isEditing, item.value, item.label]);

    if (isEditing) return (
        <div className="ct-edit-row">
            <Field style={{ flex: '0 0 150px' }}>
                <input value={val} onChange={e => setVal(e.target.value)} placeholder="e.g. F2F+Motorcycle" />
            </Field>
            <Field style={{ flex: '1 1 180px' }}>
                <input value={lbl} onChange={e => setLbl(e.target.value)} placeholder="Display label" />
            </Field>
            <button onClick={() => onSave(val.trim(), lbl.trim() || val.trim())} className="ct-save-btn"
                style={{ background: p.accent }}>Save</button>
            <button onClick={onCancel} className="ct-cancel-btn">Cancel</button>
        </div>
    );

    return (
        <div className="ct-row">
            <div className="ct-row-left">
                <div className="ct-bundle-badges">
                    <span className="ct-tdc-badge">{tdc}</span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#94a3b8', flexShrink: 0 }}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    <span className="ct-pdc-badge">{pdc}</span>
                </div>
                <div>
                    <div className="ct-row-name">{item.label}</div>
                    <div className="ct-row-sub">{item.value}</div>
                </div>
            </div>
            <div className="ct-actions">
                <button onClick={onEdit} className="ct-btn edit" title="Edit">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button onClick={onDelete} className="ct-btn delete" title="Remove">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
            </div>
        </div>
    );
};

/* â”€â”€â”€ Simple add row (value + optional label) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const AddRow = ({ palette, placeholder1, placeholder2, btnLabel, onAdd }) => {
    const [v1, setV1] = useState('');
    const [v2, setV2] = useState('');
    const submit = (e) => {
        e.preventDefault();
        const t = v1.trim();
        if (!t) return;
        onAdd(t, v2.trim() || t);
        setV1(''); setV2('');
    };
    return (
        <form onSubmit={submit} className="ct-add-form" style={{ borderTopColor: palette.light }}>
            <Field style={{ flex: '1 1 120px' }}>
                <input value={v1} onChange={e => setV1(e.target.value)} placeholder={placeholder1} />
            </Field>
            {placeholder2 && (
                <Field style={{ flex: '2 1 170px' }}>
                    <input value={v2} onChange={e => setV2(e.target.value)} placeholder={placeholder2} />
                </Field>
            )}
            <button type="submit" className="ct-add-btn" style={{ background: palette.accent }}>
                {btnLabel}
            </button>
        </form>
    );
};

/* â”€â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const CourseTypesSection = () => {
    const { showNotification } = useNotification();
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await coursesAPI.getConfig();
                if (res.success) setConfig(res.config);
            } catch {
                showNotification('Could not load course config â€” using defaults', 'warning');
            } finally {
                setLoading(false);
            }
        })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const save = async (updated) => {
        setSaving(true);
        try {
            const res = await coursesAPI.updateConfig(updated);
            if (res.success) {
                setConfig(res.config);
                showNotification('Course configuration saved!', 'success');
            }
        } catch (e) {
            showNotification(e.message || 'Failed to save configuration', 'error');
        } finally {
            setSaving(false);
        }
    };

    const addCategory = (val) => {
        if (config.categories.includes(val)) { showNotification('Category already exists', 'warning'); return; }
        save({ ...config, categories: [...config.categories, val] });
    };
    const removeCategory = (cat) => {
        if (CORE_CATEGORIES.includes(cat)) { showNotification(`"${cat}" is a core category and cannot be removed`, 'warning'); return; }
        save({ ...config, categories: config.categories.filter(c => c !== cat) });
    };
    const addType = (section, value, label) => {
        if (config[section].some(t => t.value === value)) { showNotification('That type already exists', 'warning'); return; }
        save({ ...config, [section]: [...config[section], { value, label }] });
    };
    const removeType = (section, value) => save({ ...config, [section]: config[section].filter(t => t.value !== value) });
    const saveEdit = (section, index, value, label) => {
        if (!value) return;
        const arr = [...config[section]];
        arr[index] = { value, label };
        save({ ...config, [section]: arr });
        setEditingItem(null);
    };

    const [bundleForm, setBundleForm] = useState({ tdcPart: '', pdcPart: '', label: '' });
    const tdcOptions = config.tdcTypes.map(t => t.value);
    const pdcOptions = config.pdcTypes.map(t => t.value);
    const effectiveTdc = bundleForm.tdcPart || tdcOptions[0] || 'F2F';
    const effectivePdc = bundleForm.pdcPart || pdcOptions[0] || 'Motorcycle';

    const addBundle = (e) => {
        e.preventDefault();
        const value = `${effectiveTdc}+${effectivePdc}`;
        const label = bundleForm.label.trim() || `${effectiveTdc} TDC + ${effectivePdc} PDC`;
        if (config.bundleTypes.some(b => b.value === value)) { showNotification('That bundle combination already exists', 'warning'); return; }
        save({ ...config, bundleTypes: [...config.bundleTypes, { value, label }] });
        setBundleForm({ tdcPart: '', pdcPart: '', label: '' });
    };

    if (loading) return (
        <div className="cfg-section-enter" style={{ padding: '60px 0', textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #7c3aed', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px' }} />
            Loading course configurationâ€¦
        </div>
    );

    return (
        <div className="cfg-section-enter">
            {saving && <div className="ct-toast">Savingâ€¦</div>}

            <div className="cfg-settings-grid">

                {/* â”€â”€ 1. Categories â”€â”€ */}
                <TypeCard title="Course Categories" iconClass="icon-purple" badge={`${config.categories.length} total`}
                    icon={<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>}
                >
                    <p className="ct-desc">Top-level course categories. Core ones (TDC, PDC, Basic, Promo) are protected.</p>
                    {config.categories.map(cat => (
                        <CategoryRow key={cat} cat={cat}
                            isCore={CORE_CATEGORIES.includes(cat)}
                            onDelete={() => removeCategory(cat)} />
                    ))}
                    <AddRow palette={PALETTE.categories} placeholder1="New category name"
                        btnLabel="+ Add" onAdd={v => addCategory(v)} />
                </TypeCard>

                {/* â”€â”€ 2. TDC Types â”€â”€ */}
                <TypeCard title="TDC Sub-Types" iconClass="blue" badge={`${config.tdcTypes.length} types`}
                    icon={<><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></>}
                >
                    <p className="ct-desc">Modalities for TDC courses â€” e.g. Face-to-Face, Online.</p>
                    {config.tdcTypes.map((t, i) => (
                        <TypeRow key={t.value} item={t} palette={PALETTE.tdcTypes}
                            isEditing={editingItem?.section === 'tdcTypes' && editingItem.index === i}
                            onEdit={() => setEditingItem({ section: 'tdcTypes', index: i })}
                            onDelete={() => removeType('tdcTypes', t.value)}
                            onSave={(v, l) => saveEdit('tdcTypes', i, v, l)}
                            onCancel={() => setEditingItem(null)} />
                    ))}
                    <AddRow palette={PALETTE.tdcTypes} placeholder1="Value (e.g. Hybrid)" placeholder2="Label (e.g. Hybrid/Blended)"
                        btnLabel="+ Add" onAdd={(v, l) => addType('tdcTypes', v, l)} />
                </TypeCard>

                {/* â”€â”€ 3. PDC Types â”€â”€ */}
                <TypeCard title="PDC Sub-Types" iconClass="emerald" badge={`${config.pdcTypes.length} types`}
                    icon={<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>}
                >
                    <p className="ct-desc">Vehicle types for PDC courses â€” e.g. Automatic, Manual, Tricycle.</p>
                    {config.pdcTypes.map((t, i) => (
                        <TypeRow key={t.value} item={t} palette={PALETTE.pdcTypes}
                            isEditing={editingItem?.section === 'pdcTypes' && editingItem.index === i}
                            onEdit={() => setEditingItem({ section: 'pdcTypes', index: i })}
                            onDelete={() => removeType('pdcTypes', t.value)}
                            onSave={(v, l) => saveEdit('pdcTypes', i, v, l)}
                            onCancel={() => setEditingItem(null)} />
                    ))}
                    <AddRow palette={PALETTE.pdcTypes} placeholder1="Value (e.g. Sidecar)" placeholder2="Label (e.g. Sidecar Motorcycle)"
                        btnLabel="+ Add" onAdd={(v, l) => addType('pdcTypes', v, l)} />
                </TypeCard>

                {/* â”€â”€ 4. Bundle Types â€” full width â”€â”€ */}
                <TypeCard title="Promo Bundle Types" iconClass="amber" badge={`${config.bundleTypes.length} bundles`} fullWidth
                    icon={<><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>}
                >
                    <p className="ct-desc">Each bundle combines one TDC type + one PDC type for promo courses.</p>

                    {/* Bundle list â€” 2-column on wide screens */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                        {config.bundleTypes.map((t, i) => (
                            <BundleRow key={t.value} item={t}
                                isEditing={editingItem?.section === 'bundleTypes' && editingItem.index === i}
                                onEdit={() => setEditingItem({ section: 'bundleTypes', index: i })}
                                onDelete={() => removeType('bundleTypes', t.value)}
                                onSave={(v, l) => saveEdit('bundleTypes', i, v, l)}
                                onCancel={() => setEditingItem(null)} />
                        ))}
                    </div>

                    {/* Bundle add form */}
                    <form onSubmit={addBundle} className="ct-add-form"
                        style={{ borderTopColor: PALETTE.bundleTypes.light }}>
                        <div className="ct-add-field">
                            <label>TDC Type</label>
                            <div className="cfg-form-field">
                                <select value={bundleForm.tdcPart || tdcOptions[0] || ''}
                                    onChange={e => setBundleForm(p => ({ ...p, tdcPart: e.target.value }))}>
                                    {tdcOptions.map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </div>
                        </div>
                        <span className="ct-add-sep">+</span>
                        <div className="ct-add-field">
                            <label>PDC Type</label>
                            <div className="cfg-form-field">
                                <select value={bundleForm.pdcPart || pdcOptions[0] || ''}
                                    onChange={e => setBundleForm(p => ({ ...p, pdcPart: e.target.value }))}>
                                    {pdcOptions.map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="ct-add-field" style={{ flex: '1 1 180px' }}>
                            <label>Label <span style={{ fontWeight: 400, opacity: 0.55 }}>(optional)</span></label>
                            <div className="cfg-form-field">
                                <input value={bundleForm.label}
                                    onChange={e => setBundleForm(p => ({ ...p, label: e.target.value }))}
                                    placeholder={`${effectiveTdc} TDC + ${effectivePdc} PDC`} />
                            </div>
                        </div>
                        <button type="submit" className="ct-add-btn"
                            style={{ background: PALETTE.bundleTypes.accent }}>
                            + Add Bundle
                        </button>
                    </form>
                </TypeCard>

            </div>
        </div>
    );
};

export default CourseTypesSection;

