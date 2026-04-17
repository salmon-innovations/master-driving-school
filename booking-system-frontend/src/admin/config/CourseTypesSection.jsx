import React, { useState, useEffect, useMemo } from 'react';
import { coursesAPI } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';

/* Default config (mirrors backend defaults) */
const DEFAULT_CONFIG = {
    categories: ['Basic', 'TDC', 'PDC', 'Promo'],
    tdcTypes: [
        { value: 'F2F', label: 'F2F (Face-to-Face)' },
        { value: 'Online', label: 'Online' },
    ],
    pdcTypes: [
        { value: 'Motorcycle', label: 'Motorcycle' },
        { value: 'Automatic', label: 'Automatic' },
        { value: 'Manual', label: 'Manual' },
        { value: 'V1-Tricycle', label: 'V1-Tricycle' },
        { value: 'B1-Van/B2 - L300', label: 'B1 - Van/B2 - L300' },
    ],
    bundleTypes: [],
};

const CORE_CATEGORIES = ['Basic', 'TDC', 'PDC', 'Promo'];

const PALETTE = {
    categories: { iconClass: 'icon-purple', accent: '#7c3aed', light: '#ede9fe', text: '#6d28d9' },
    tdcTypes:   { iconClass: 'blue',        accent: '#2563eb', light: '#dbeafe', text: '#1d4ed8' },
    pdcTypes:   { iconClass: 'emerald',     accent: '#059669', light: '#d1fae5', text: '#065f46' },
    bundleTypes:{ iconClass: 'amber',       accent: '#d97706', light: '#fef3c7', text: '#b45309' },
};

const PROMO_BUNDLE_PDC_OPTIONS = [
    'PDC Motor Manual',
    'PDC Motor Automatic',
    'PDC Car Manual',
    'PDC Car Automatic',
    'PDC A1-Tricycle',
    'PDC B1-Van/B2-L300',
];

const normalizePromoPdcName = (value) => {
    const cleaned = String(value || '').trim();
    const lower = cleaned.toLowerCase();
    if (!cleaned) return '';
    if (lower === 'motorcycle') return 'PDC Motor Manual';
    if (lower === 'manual' || lower === 'carmt' || lower === 'car mt' || lower === 'pdc car manual') return 'PDC Car Manual';
    if (lower === 'automatic' || lower === 'carat' || lower === 'car at' || lower === 'pdc car automatic') return 'PDC Car Automatic';
    if (lower === 'v1-tricycle' || lower === 'a1-tricycle' || lower === 'pdc a1-tricycle') return 'PDC A1-Tricycle';
    if (lower === 'b1-van/b2 - l300' || lower === 'b1-van/b2-l300' || lower === 'pdc b1-van/b2-l300') return 'PDC B1-Van/B2-L300';
    return cleaned;
};

const buildBundleKey = (tdcPart, pdcParts) => {
    const normalizedPdcParts = [...new Set((pdcParts || []).map(v => normalizePromoPdcName(v)).filter(Boolean))].sort();
    if (normalizedPdcParts.length === 0) return '';
    const tdc = String(tdcPart || 'None').trim();
    return `${tdc}+${normalizedPdcParts.join('|')}`;
};

const normalizeBundleEntry = (entry) => {
    if (!entry) return null;

    if (typeof entry === 'string') {
        const [tdcPart, pdcRaw = ''] = entry.split('+');
        const pdcParts = pdcRaw.split('|').map(v => normalizePromoPdcName(v)).filter(Boolean);
        const key = buildBundleKey(tdcPart, pdcParts);
        if (!key) return null;
        const tdc = String(tdcPart || '').trim();
        const label = (!tdc || tdc.toLowerCase() === 'none')
            ? pdcParts.join(' + ')
            : `${tdc} TDC + ${pdcParts.join(' + ')}`;
        return {
            key,
            value: key,
            tdcPart: tdc || 'None',
            pdcParts: [...new Set(pdcParts)].sort(),
            label,
        };
    }

    if (typeof entry === 'object') {
        const rawValue = String(entry.value || '').trim();
        const tdcPart = String(entry.tdcPart || '').trim() || (rawValue.includes('+') ? rawValue.split('+')[0].trim() : '');
        const rawPdcParts = Array.isArray(entry.pdcParts)
            ? entry.pdcParts
            : (rawValue.includes('+') ? rawValue.split('+')[1].split('|') : []);
        const pdcParts = [...new Set(rawPdcParts.map(v => normalizePromoPdcName(v)).filter(Boolean))].sort();
        const key = buildBundleKey(tdcPart, pdcParts);
        if (!key) return null;
        const tdc = String(tdcPart || '').trim();
        const label = String(entry.label || '').trim() || ((!tdc || tdc.toLowerCase() === 'none')
            ? pdcParts.join(' + ')
            : `${tdc} TDC + ${pdcParts.join(' + ')}`);
        return {
            key,
            value: key,
            tdcPart: tdc || 'None',
            pdcParts,
            label,
        };
    }

    return null;
};

const normalizeConfig = (raw) => {
    const merged = { ...DEFAULT_CONFIG, ...(raw || {}) };
    const normalizedBundles = (Array.isArray(merged.bundleTypes) ? merged.bundleTypes : [])
        .map(normalizeBundleEntry)
        .filter(Boolean);
    return { ...merged, bundleTypes: normalizedBundles };
};

const serializeBundle = (bundle) => ({
    value: bundle.key,
    key: bundle.key,
    label: bundle.label,
    tdcPart: bundle.tdcPart,
    pdcParts: [...bundle.pdcParts],
});

/* Shared field using cfg-form-field for dark mode */
const Field = ({ children, style }) => (
    <div className="cfg-form-field" style={style}>{children}</div>
);

/* Card wrapper */
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

/* Category row */
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

/* Generic type row (TDC / PDC) */
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

const BundleRow = ({ item, onEdit, onDelete }) => (
    <div className="ct-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px', padding: '16px', position: 'relative' }}>
        
        {/* Actions positioned top-right relative to row padding */}
        <div className="ct-actions" style={{ position: 'absolute', top: '12px', right: '12px' }}>
            <button onClick={onEdit} className="ct-btn edit" title="Edit">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button onClick={onDelete} className="ct-btn delete" title="Remove">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
        </div>

        {/* Top: Badges - padded on right to avoid buttons */}
        <div className="ct-bundle-badges" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', paddingRight: '56px' }}>
            {item.tdcPart && item.tdcPart.toLowerCase() !== 'none' && (
                <>
                    <span className="ct-tdc-badge">{item.tdcPart}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#94a3b8', flexShrink: 0 }}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </>
            )}
            {item.pdcParts.map((pdc) => (
                <span key={`${item.key}_${pdc}`} className="ct-pdc-badge">{pdc}</span>
            ))}
        </div>

        {/* Bottom: Text Info */}
        <div style={{ marginTop: '2px' }}>
            <div className="ct-row-name" style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>{item.label}</div>
            <div className="ct-row-sub" style={{ fontSize: '0.8rem', color: '#64748b', wordBreak: 'break-word', overflowWrap: 'anywhere', lineHeight: '1.5' }}>{item.key}</div>
        </div>
    </div>
);

/* Simple add row (value + optional label) */
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

/* Main component */
const CourseTypesSection = () => {
    const { showNotification } = useNotification();
    const [config, setConfig] = useState(normalizeConfig(DEFAULT_CONFIG));
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    // Add Bundle Form State
    const [bundleForm, setBundleForm] = useState({ tdcPart: '', pdcParts: [], label: '' });

    // Edit Bundle Modal State
    const [editBundleIndex, setEditBundleIndex] = useState(null);
    const [editBundleForm, setEditBundleForm] = useState({ tdcPart: '', pdcParts: [], label: '' });

    useEffect(() => {
        (async () => {
            try {
                const res = await coursesAPI.getConfig();
                if (res.success) setConfig(normalizeConfig(res.config));
            } catch {
                showNotification('Could not load course config - using defaults', 'warning');
            } finally {
                setLoading(false);
            }
        })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const save = async (updated) => {
        const normalizedUpdated = normalizeConfig(updated);
        const payload = {
            ...normalizedUpdated,
            bundleTypes: normalizedUpdated.bundleTypes.map(serializeBundle),
        };
        setSaving(true);
        try {
            const res = await coursesAPI.updateConfig(payload);
            if (res.success) {
                setConfig(normalizeConfig(res.config));
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
    const removeType = (section, value) => {
        const next = { ...config, [section]: config[section].filter(t => t.value !== value) };
        if (section === 'tdcTypes') {
            next.bundleTypes = next.bundleTypes.filter(b => b.tdcPart !== value);
        }
        if (section === 'pdcTypes') {
            next.bundleTypes = next.bundleTypes
                .map(b => ({ ...b, pdcParts: b.pdcParts.filter(p => p !== value) }))
                .filter(b => b.pdcParts.length > 0)
                .map(b => ({
                    ...b,
                    key: buildBundleKey(b.tdcPart, b.pdcParts),
                    value: buildBundleKey(b.tdcPart, b.pdcParts),
                }));
        }
        save(next);
    };
    const saveEdit = (section, index, value, label) => {
        if (!value) return;
        const arr = [...config[section]];
        arr[index] = { value, label };
        const next = { ...config, [section]: arr };
        if (section === 'tdcTypes') {
            const oldValue = config[section][index].value;
            next.bundleTypes = next.bundleTypes.map((bundle) => {
                if (bundle.tdcPart !== oldValue) return bundle;
                const key = buildBundleKey(value, bundle.pdcParts);
                return { ...bundle, tdcPart: value, key, value: key };
            });
        }
        if (section === 'pdcTypes') {
            const oldValue = config[section][index].value;
            next.bundleTypes = next.bundleTypes.map((bundle) => {
                if (!bundle.pdcParts.includes(oldValue)) return bundle;
                const pdcParts = bundle.pdcParts.map((pdc) => pdc === oldValue ? value : pdc);
                const key = buildBundleKey(bundle.tdcPart, pdcParts);
                return { ...bundle, pdcParts: [...new Set(pdcParts)].sort(), key, value: key };
            });
        }
        save(next);
        setEditingItem(null);
    };

    const tdcOptions = ['None', ...config.tdcTypes.map(t => t.value)];
    const promoPdcOptions = useMemo(() => {
        const fromFormAdd = Array.isArray(bundleForm.pdcParts) ? bundleForm.pdcParts : [];
        const fromFormEdit = Array.isArray(editBundleForm.pdcParts) ? editBundleForm.pdcParts : [];
        return [...new Set([...PROMO_BUNDLE_PDC_OPTIONS, ...fromFormAdd, ...fromFormEdit])];
    }, [bundleForm.pdcParts, editBundleForm.pdcParts]);
    const defaultTdc = tdcOptions[0] || 'F2F';

    useEffect(() => {
        if (!bundleForm.tdcPart && defaultTdc) setBundleForm(prev => ({ ...prev, tdcPart: defaultTdc }));
        if (!editBundleForm.tdcPart && defaultTdc) setEditBundleForm(prev => ({ ...prev, tdcPart: defaultTdc }));
    }, [bundleForm.tdcPart, editBundleForm.tdcPart, defaultTdc]);

    const effectiveTdc = bundleForm.tdcPart || defaultTdc;
    const effectivePdcParts = [...new Set((bundleForm.pdcParts || []).map(v => String(v || '').trim()).filter(Boolean))].sort();
    const effectiveBundleKey = buildBundleKey(effectiveTdc, effectivePdcParts);

    const effectiveEditTdc = editBundleForm.tdcPart || defaultTdc;
    const effectiveEditPdcParts = [...new Set((editBundleForm.pdcParts || []).map(v => String(v || '').trim()).filter(Boolean))].sort();
    const effectiveEditBundleKey = buildBundleKey(effectiveEditTdc, effectiveEditPdcParts);

    const bundleDuplicateMap = useMemo(() => {
        const map = new Map();
        config.bundleTypes.forEach((bundle, index) => {
            map.set(bundle.key, index);
        });
        return map;
    }, [config.bundleTypes]);

    const togglePdcSelection = (value, isEdit = false) => {
        const updater = prev => {
            const exists = prev.pdcParts.includes(value);
            const nextParts = exists
                ? prev.pdcParts.filter(v => v !== value)
                : [...prev.pdcParts, value];
            return { ...prev, pdcParts: nextParts };
        };
        if (isEdit) setEditBundleForm(updater);
        else setBundleForm(updater);
    };

    const resetBundleForm = () => {
        setBundleForm({ tdcPart: defaultTdc || '', pdcParts: [], label: '' });
    };

    const beginBundleEdit = (index) => {
        const bundle = config.bundleTypes[index];
        if (!bundle) return;
        setEditBundleIndex(index);
        setEditBundleForm({
            tdcPart: bundle.tdcPart,
            pdcParts: [...bundle.pdcParts],
            label: bundle.label || '',
        });
    };

    const cancelBundleEdit = () => {
        setEditBundleIndex(null);
        setEditBundleForm({ tdcPart: defaultTdc || '', pdcParts: [], label: '' });
    };

    const addBundle = (e) => {
        e.preventDefault();
        if (!effectiveTdc) { showNotification('Please select a TDC type', 'warning'); return; }
        if (effectivePdcParts.length === 0) { showNotification('Please select at least one PDC type', 'warning'); return; }
        
        if (bundleDuplicateMap.has(effectiveBundleKey)) {
            showNotification('That bundle combination already exists', 'warning');
            return;
        }

        const finalLabel = bundleForm.label.trim() || ((!effectiveTdc || effectiveTdc.toLowerCase() === 'none')
            ? effectivePdcParts.join(' + ')
            : `${effectiveTdc} TDC + ${effectivePdcParts.join(' + ')}`);

        const nextBundle = {
            key: effectiveBundleKey,
            value: effectiveBundleKey,
            tdcPart: effectiveTdc || 'None',
            pdcParts: effectivePdcParts,
            label: finalLabel,
        };

        save({ ...config, bundleTypes: [...config.bundleTypes, nextBundle] });
        resetBundleForm();
    };

    const saveEditedBundle = (e) => {
        e.preventDefault();
        if (editBundleIndex === null) return;
        
        if (!effectiveEditTdc) { showNotification('Please select a TDC type', 'warning'); return; }
        if (effectiveEditPdcParts.length === 0) { showNotification('Please select at least one PDC type', 'warning'); return; }
        
        const existingIndex = bundleDuplicateMap.get(effectiveEditBundleKey);
        if (existingIndex !== undefined && existingIndex !== editBundleIndex) {
            showNotification('That bundle combination already exists', 'warning');
            return;
        }

        const finalLabel = editBundleForm.label.trim() || ((!effectiveEditTdc || effectiveEditTdc.toLowerCase() === 'none')
            ? effectiveEditPdcParts.join(' + ')
            : `${effectiveEditTdc} TDC + ${effectiveEditPdcParts.join(' + ')}`);

        const nextBundle = {
            key: effectiveEditBundleKey,
            value: effectiveEditBundleKey,
            tdcPart: effectiveEditTdc || 'None',
            pdcParts: effectiveEditPdcParts,
            label: finalLabel,
        };

        const bundleTypes = [...config.bundleTypes];
        bundleTypes[editBundleIndex] = nextBundle;

        save({ ...config, bundleTypes });
        cancelBundleEdit();
    };

    const removeBundle = (index) => {
        save({ ...config, bundleTypes: config.bundleTypes.filter((_, i) => i !== index) });
        if (editBundleIndex === index) cancelBundleEdit();
    };

    if (loading) return (
        <div className="cfg-section-enter" style={{ padding: '60px 0', textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #7c3aed', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px' }} />
            Loading course configuration...
        </div>
    );

    return (
        <div className="cfg-section-enter">
            {saving && <div className="ct-toast">Saving...</div>}

            <div className="cfg-settings-grid">

                {/* 1. Categories */}
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

                {/* 2. TDC Types */}
                <TypeCard title="TDC Sub-Types" iconClass="blue" badge={`${config.tdcTypes.length} types`}
                    icon={<><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></>}
                >
                    <p className="ct-desc">Modalities for TDC courses - e.g. Face-to-Face, Online.</p>
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

                {/* 4. Bundle Types - full width */}
                <TypeCard title="Promo Bundle Types" iconClass="amber" badge={`${config.bundleTypes.length} bundles`} fullWidth
                    icon={<><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>}
                >
                    <p className="ct-desc">Combine one TDC type + one or more PDC types, or multiple PDC types alone, to create promo packages.</p>

                    {/* Bundle list */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                        {config.bundleTypes.map((t, i) => (
                            <BundleRow key={t.key} item={t}
                                onEdit={() => beginBundleEdit(i)}
                                onDelete={() => removeBundle(i)} />
                        ))}
                    </div>

                    {/* Bundle add form */}
                    <form onSubmit={addBundle} className="ct-add-form"
                        style={{ borderTopColor: PALETTE.bundleTypes.light, flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' }}>

                        <div className="ct-add-field" style={{ flex: '1 1 180px' }}>
                            <label>TDC Type</label>
                            <div className="cfg-form-field">
                                <select value={bundleForm.tdcPart || ''}
                                    onChange={e => setBundleForm(p => ({ ...p, tdcPart: e.target.value }))}>
                                    {tdcOptions.map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="ct-add-field" style={{ flex: '2 1 300px' }}>
                            <label>Label <span style={{ fontWeight: 400, opacity: 0.55 }}>(optional)</span></label>
                            <div className="cfg-form-field">
                                <input value={bundleForm.label}
                                    onChange={e => setBundleForm(p => ({ ...p, label: e.target.value }))}
                                    placeholder={effectiveBundleKey ? `${effectiveTdc} TDC + ...` : 'Bundle display label'} />
                            </div>
                        </div>

                        <div className="ct-add-field" style={{ flex: '1 1 100%' }}>
                            <label>PDC Types (select one or more)</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                                {promoPdcOptions.map(v => {
                                    const isChecked = bundleForm.pdcParts.includes(v);
                                    return (
                                        <label key={v} style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '6px 12px',
                                            borderRadius: '6px',
                                            border: `1px solid ${isChecked ? PALETTE.bundleTypes.accent : '#cbd5e1'}`,
                                            background: isChecked ? `${PALETTE.bundleTypes.accent}15` : '#fff',
                                            color: isChecked ? PALETTE.bundleTypes.accent : '#475569',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem',
                                            fontWeight: 500,
                                        }}>
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => togglePdcSelection(v, false)}
                                                style={{ margin: 0, accentColor: PALETTE.bundleTypes.accent }}
                                            />
                                            {v}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                            <button type="submit" className="ct-add-btn"
                                style={{ background: PALETTE.bundleTypes.accent, margin: 0 }}>
                                + Add Promo Bundle
                            </button>
                        </div>
                    </form>
                </TypeCard>

                {/* Edit Bundle Modal */}
                {editBundleIndex !== null && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(15, 23, 42, 0.4)', zIndex: 10000,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '24px', backdropFilter: 'blur(2px)'
                    }}>
                        <div style={{
                            background: '#ffffff', borderRadius: '16px', padding: '28px', 
                            width: '100%', maxWidth: '640px',
                            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                            maxHeight: '90vh', overflowY: 'auto'
                        }}>
                            <h3 style={{ margin: '0 0 20px 0', color: '#1e293b', fontSize: '1.25rem', fontWeight: 600 }}>
                                Edit Promo Bundle
                            </h3>
                            <form onSubmit={saveEditedBundle} className="ct-add-form"
                                style={{ border: 'none', padding: 0, margin: 0, flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' }}>

                                <div className="ct-add-field" style={{ flex: '1 1 180px' }}>
                                    <label>TDC Type</label>
                                    <div className="cfg-form-field">
                                        <select value={editBundleForm.tdcPart || ''}
                                            onChange={e => setEditBundleForm(p => ({ ...p, tdcPart: e.target.value }))}>
                                            {tdcOptions.map(v => <option key={v} value={v}>{v}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="ct-add-field" style={{ flex: '2 1 300px' }}>
                                    <label>Label <span style={{ fontWeight: 400, opacity: 0.55 }}>(optional)</span></label>
                                    <div className="cfg-form-field">
                                        <input value={editBundleForm.label}
                                            onChange={e => setEditBundleForm(p => ({ ...p, label: e.target.value }))}
                                            placeholder={effectiveEditBundleKey ? `${effectiveEditTdc} TDC + ...` : 'Bundle display label'} />
                                    </div>
                                </div>

                                <div className="ct-add-field" style={{ flex: '1 1 100%' }}>
                                    <label>PDC Types (select one or more)</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                                        {promoPdcOptions.map(v => {
                                            const isChecked = editBundleForm.pdcParts.includes(v);
                                            return (
                                                <label key={v} style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    border: `1px solid ${isChecked ? PALETTE.bundleTypes.accent : '#cbd5e1'}`,
                                                    background: isChecked ? `${PALETTE.bundleTypes.accent}15` : '#fff',
                                                    color: isChecked ? PALETTE.bundleTypes.accent : '#475569',
                                                    cursor: 'pointer',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 500,
                                                }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => togglePdcSelection(v, true)}
                                                        style={{ margin: 0, accentColor: PALETTE.bundleTypes.accent }}
                                                    />
                                                    {v}
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                                    <button
                                        type="button"
                                        className="ct-cancel-btn"
                                        onClick={cancelBundleEdit}
                                        style={{ margin: 0 }}
                                    >
                                        Cancel Edit
                                    </button>
                                    <button type="submit" className="ct-add-btn"
                                        style={{ background: PALETTE.bundleTypes.accent, margin: 0 }}>
                                        Save Bundle Updates
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default CourseTypesSection;

