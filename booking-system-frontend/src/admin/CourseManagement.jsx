import React, { useState, useEffect, useMemo } from 'react';
import './css/user.css';
import './css/branch.css';
import { coursesAPI, branchesAPI, adminAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import Pagination from './components/Pagination';

const COURSE_PAGE_SIZE = 10;

const COURSE_TAB_PERMISSION_MAP = {
    courses: ['accounts.courses.view', 'accounts.courses.tab.courses'],
    packages: ['accounts.courses.view', 'accounts.courses.tab.courses'],
    discounts: ['accounts.courses.view', 'accounts.courses.tab.discounts'],
    config: ['accounts.courses.view', 'accounts.courses.tab.config'],
};

const normalizePermissionList = (permissions) => {
    if (!Array.isArray(permissions)) return [];
    return permissions.filter((permission) => typeof permission === 'string' && permission.trim().length > 0);
};

const buildBundleKey = (tdcPart, pdcParts) => {
    const normalizedPdcParts = [...new Set((pdcParts || []).map(v => normalizePromoPdcName(v)).filter(Boolean))].sort();
    if (!tdcPart || normalizedPdcParts.length === 0) return '';
    return `${String(tdcPart).trim()}+${normalizedPdcParts.join('|')}`;
};

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

const normalizeBundleType = (entry) => {
    if (!entry) return null;

    if (typeof entry === 'string') {
        const [tdcPart, pdcRaw = ''] = entry.split('+');
        const pdcParts = pdcRaw.split('|').map(v => normalizePromoPdcName(v)).filter(Boolean);
        const key = buildBundleKey(tdcPart, pdcParts);
        if (!key) return null;
        return {
            value: key,
            label: `${tdcPart} TDC + ${[...new Set(pdcParts)].sort().join(', ')} PDC`,
            tdcPart,
            pdcParts: [...new Set(pdcParts)].sort(),
            legacyValues: [String(entry).trim()].filter(Boolean),
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
        return {
            value: key,
            label: String(entry.label || '').trim() || `${tdcPart} TDC + ${pdcParts.join(', ')} PDC`,
            tdcPart,
            pdcParts,
            legacyValues: [rawValue].filter(Boolean),
        };
    }

    return null;
};

const CourseManagement = ({ currentUserPermissions = [], currentUserRole = '', currentUserBranchId = null }) => {
    const COURSES_CACHE_KEY = 'admin_courses_cache_v1';
    const COURSES_CACHE_TTL_MS = 3 * 60 * 1000;
    const { showNotification } = useNotification();
    const [searchTerm, setSearchTerm] = useState('');
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingCourse, setEditingCourse] = useState(null);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [coursePage, setCoursePage] = useState(1);
    const [courseData, setCourseData] = useState({
        name: '',
        description: '',
        price: '',
        discount: 0,
        duration: '',
        duration_tdc: '',
        duration_pdc: '',
        images: [],
        status: 'active',
        category: 'Basic',
        course_type: ''
    });
    const [pricingVariations, setPricingVariations] = useState([]);
    const [viewingImage, setViewingImage] = useState(null);
    const [courseConfig, setCourseConfig] = useState(null);
    const [branches, setBranches] = useState([]);
    const [viewingBranchId, setViewingBranchId] = useState(null); // null = All Branches
    const [branchPrices, setBranchPrices] = useState({}); // { branchId: priceString }
    const [editingBranchId, setEditingBranchId] = useState('');
    const [activeTab, setActiveTab] = useState('courses');
    const [discountForm, setDiscountForm] = useState({});
    const [addonsConfig, setAddonsConfig] = useState({ reviewer: 30, vehicleTips: 20, convenienceFee: 25, promoBundleDiscountPercent: 0, customAddons: [] });
    const [addonsLoading, setAddonsLoading] = useState(false);

    const normalizedRole = String(currentUserRole || '').toLowerCase();
    const isSuperAdmin = normalizedRole === 'super_admin';
    const isBranchScopedUser = normalizedRole === 'admin' && !!currentUserBranchId;
    const permissionSet = new Set(normalizePermissionList(currentUserPermissions));
    const canAccessCourseTab = (tabKey) => {
        if (isSuperAdmin) return true;
        const requiredPermissions = COURSE_TAB_PERMISSION_MAP[tabKey] || [];
        // If no explicit permission payload is provided, keep legacy behavior by allowing tabs.
        if (permissionSet.size === 0) return true;
        return requiredPermissions.some((permission) => permissionSet.has(permission));
    };
    const allowedCourseTabs = ['courses', 'packages', 'discounts', 'config'].filter((tabKey) => canAccessCourseTab(tabKey));

    const normalizedPromoBundles = useMemo(() => {
        const source = Array.isArray(courseConfig?.bundleTypes) ? courseConfig.bundleTypes : [];
        return source
            .map(normalizeBundleType)
            .filter(Boolean);
    }, [courseConfig]);

    const promoBundleLabelMap = useMemo(() => {
        const map = new Map();
        normalizedPromoBundles.forEach((bundle) => {
            map.set(bundle.value, bundle.label);
            (bundle.legacyValues || []).forEach((legacy) => {
                map.set(legacy, bundle.label);
            });
        });
        return map;
    }, [normalizedPromoBundles]);

    const resolvePromoBundleLabel = (bundleValue) => {
        if (!bundleValue) return '';
        return promoBundleLabelMap.get(bundleValue) || bundleValue;
    };

    // Fetch courses from database
    useEffect(() => {
        fetchCourses();
        coursesAPI.getConfig().then(r => { if (r.success) setCourseConfig(r.config); }).catch(() => {});
        branchesAPI.getAll().then(r => {
            if (!r.success) return;
            let loadedBranches = r.branches || [];
            if (isBranchScopedUser) {
                loadedBranches = loadedBranches.filter((branch) => String(branch.id) === String(currentUserBranchId));
                setViewingBranchId(String(currentUserBranchId));
            }
            setBranches(loadedBranches);
        }).catch(() => {});
        adminAPI.getAddonsConfig().then(r => { 
            if (r.success) {
                setAddonsConfig({ reviewer: 30, vehicleTips: 20, convenienceFee: 25, promoBundleDiscountPercent: 0, ...r.config, customAddons: r.config.customAddons || [] });
            }
        }).catch(() => {});
    }, [isBranchScopedUser, currentUserBranchId]);

    const fetchCourses = async () => {
        let usedCache = false;
        try {
            const cachedRaw = sessionStorage.getItem(COURSES_CACHE_KEY);
            if (cachedRaw) {
                const cached = JSON.parse(cachedRaw);
                if (cached?.ts && Array.isArray(cached?.data) && (Date.now() - cached.ts) < COURSES_CACHE_TTL_MS) {
                    setCourses(cached.data);
                    setLoading(false);
                    usedCache = true;
                }
            }
        } catch (_) {}

        if (!usedCache) setLoading(true);
        try {
            const response = await coursesAPI.getAll();
            // Process courses - parse image_url if it's JSON
            const processedCourses = response.courses.map(course => {
                let parsedImages = [];
                if (course.image_url) {
                    if (typeof course.image_url === 'string') {
                        try {
                            const parsed = JSON.parse(course.image_url);
                            parsedImages = Array.isArray(parsed) ? parsed : [parsed];
                        } catch (e) {
                            parsedImages = [course.image_url];
                        }
                    } else if (Array.isArray(course.image_url)) {
                        parsedImages = course.image_url;
                    } else {
                        parsedImages = [course.image_url];
                    }
                }

                // Filter out blob URLs as they won't work
                parsedImages = parsedImages.filter(img => img && !img.startsWith('blob:'));

                // Parse pricing_data
                let parsedPricingData = [];
                if (course.pricing_data) {
                    if (typeof course.pricing_data === 'string') {
                        try {
                            parsedPricingData = JSON.parse(course.pricing_data);
                        } catch (e) {
                            console.error('Error parsing pricing_data:', e);
                        }
                    } else if (Array.isArray(course.pricing_data)) {
                        parsedPricingData = course.pricing_data;
                    }
                }

                return {
                    ...course,
                    images: parsedImages,
                    status: course.status || 'active',
                    price: parseFloat(course.price) || 0,
                    discount: parseFloat(course.discount) || 0,
                    category: course.category || 'Basic',
                    course_type: course.course_type || '',
                    pricing_data: parsedPricingData
                };
            });
            setCourses(processedCourses);
            try {
                sessionStorage.setItem(COURSES_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: processedCourses }));
            } catch (_) {}
        } catch (error) {
            console.error('Error fetching courses:', error);
            if (!usedCache) {
                showNotification('Failed to load courses. Please try again.', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;

        // Validate price field
        if (name === 'price') {
            // Only allow positive numbers (no letters, no negative, no zero)
            if (value === '' || (parseFloat(value) > 0 && /^\d*\.?\d*$/.test(value))) {
                setCourseData({ ...courseData, [name]: value });
            }
            return;
        }

        // Validate duration field
        if (name === 'duration' || name === 'duration_tdc' || name === 'duration_pdc') {
            // Only allow positive numbers (no letters, no negative, no zero)
            if (value === '' || (parseFloat(value) > 0 && /^\d*\.?\d*$/.test(value))) {
                setCourseData({ ...courseData, [name]: value });
            }
            return;
        }

        setCourseData({ ...courseData, [name]: value });
    };

    const handleAddPricingVariation = () => {
        setPricingVariations([...pricingVariations, { type: '', price: '' }]);
    };

    const handleRemovePricingVariation = (index) => {
        setPricingVariations(pricingVariations.filter((_, i) => i !== index));
    };

    const handlePricingVariationChange = (index, field, value) => {
        const updated = [...pricingVariations];

        // Validate price field in variations
        if (field === 'price') {
            // Only allow positive numbers (no letters, no negative, no zero)
            if (value === '' || (parseFloat(value) > 0 && /^\d*\.?\d*$/.test(value))) {
                updated[index][field] = value;
                setPricingVariations(updated);
            }
            return;
        }

        updated[index][field] = value;
        setPricingVariations(updated);
    };

    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        const currentImageCount = courseData.images.length;
        const remainingSlots = 4 - currentImageCount;

        // Check if max images reached
        if (remainingSlots <= 0) {
            showNotification('Maximum 4 images allowed', 'warning');
            return;
        }

        // Validate file types
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const invalidFiles = files.filter(file => !validTypes.includes(file.type));
        if (invalidFiles.length > 0) {
            showNotification('Only JPG, PNG, and WEBP images are allowed', 'error');
            return;
        }

        // Validate file sizes (max 5MB each)
        const maxSize = 5 * 1024 * 1024; // 5MB
        const oversizedFiles = files.filter(file => file.size > maxSize);
        if (oversizedFiles.length > 0) {
            showNotification('Each image must be less than 5MB', 'error');
            return;
        }

        // Take only the number of files we can add
        const filesToAdd = files.slice(0, remainingSlots);

        // Convert files to base64
        const base64Images = await Promise.all(
            filesToAdd.map(file => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            })
        );

        setCourseData({
            ...courseData,
            images: [...courseData.images, ...base64Images]
        });

        // Notify if some files weren't added due to limit
        if (files.length > remainingSlots) {
            showNotification(`Only ${remainingSlots} image(s) added. Maximum is 4 images total.`, 'warning');
        }
    };

    const handleRemoveImage = (index) => {
        const newImages = courseData.images.filter((_, i) => i !== index);
        setCourseData({ ...courseData, images: newImages });
    };


    // Clears the session-storage course cache so the next fetchCourses() always returns fresh data.
    const clearCoursesCache = () => {
        try { sessionStorage.removeItem(COURSES_CACHE_KEY); } catch (_) {}
    };

    // Helper: push a new courses array into both React state and session cache atomically.
    const applyCoursesUpdate = (updater) => {
        setCourses(prev => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            try {
                sessionStorage.setItem(COURSES_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: next }));
            } catch (_) {}
            return next;
        });
    };

    const handleAddCourse = async (e) => {
        e.preventDefault();
        if (submitLoading) return;

        // Validate main price
        if (!courseData.price || parseFloat(courseData.price) <= 0) {
            showNotification('Please enter a valid price (must be greater than 0)', 'error');
            return;
        }

        // Validate duration
        if (courseData.category === 'Promo') {
            if (!courseData.duration_tdc || !courseData.duration_pdc || parseFloat(courseData.duration_tdc) <= 0 || parseFloat(courseData.duration_pdc) <= 0) {
                showNotification('Please enter valid durations for both TDC and PDC (must be greater than 0)', 'error');
                return;
            }
        } else {
            if (!courseData.duration || parseFloat(courseData.duration) <= 0) {
                showNotification('Please enter a valid duration (must be greater than 0)', 'error');
                return;
            }
        }

        // Validate pricing variations prices
        if (pricingVariations.length > 0) {
            const invalidPrices = pricingVariations.some(v => !v.price || parseFloat(v.price) <= 0);
            if (invalidPrices) {
                showNotification('All pricing variation prices must be greater than 0', 'error');
                return;
            }
        }

        try {
            setSubmitLoading(true);
            // Process pricing variations to ensure prices are numbers
            const processedPricingData = pricingVariations.length > 0
                ? pricingVariations.map(v => ({
                    type: v.type,
                    price: parseFloat(v.price)
                }))
                : null;

            const branchPricesPayload = editingCourse
                ? branches
                    .map(b => ({ branch_id: b.id, price: parseFloat(branchPrices[String(b.id)]) || 0 }))
                    .filter(bp => bp.price > 0 && bp.price !== parseFloat(courseData.price))
                : undefined;

            const coursePayload = {
                name: courseData.name,
                description: courseData.description,
                price: parseFloat(courseData.price),
                discount: parseFloat(courseData.discount) || 0,
                duration: courseData.category === 'Promo' 
                    ? `TDC: ${courseData.duration_tdc} hrs, PDC: ${courseData.duration_pdc} hrs` 
                    : courseData.duration,
                status: courseData.status,
                images: courseData.images,
                category: courseData.category,
                course_type: courseData.course_type || null,
                pricing_data: processedPricingData,
                ...(branchPricesPayload !== undefined && { branch_prices: branchPricesPayload })
            };

            if (editingCourse) {
                // Update existing course — apply change immediately without waiting for a re-fetch
                await coursesAPI.update(editingCourse.id, coursePayload);
                const optimistic = {
                    ...editingCourse,
                    ...coursePayload,
                    price: coursePayload.price,
                    discount: coursePayload.discount,
                    images: coursePayload.images || [],
                    pricing_data: processedPricingData || editingCourse.pricing_data || [],
                    branch_prices: branchPricesPayload ?? editingCourse.branch_prices,
                };
                applyCoursesUpdate(prev => prev.map(c => c.id === editingCourse.id ? optimistic : c));
                showNotification('Course updated successfully!', 'success');
            } else {
                // Add new course — we need the DB-assigned ID so fetch fresh, but skip the stale cache first
                await coursesAPI.create(coursePayload);
                clearCoursesCache();
                await fetchCourses();
                showNotification('Course added successfully!', 'success');
            }

            handleCloseModal();
        } catch (error) {
            console.error('Error saving course:', error);
            showNotification(error.message || 'Failed to save course. Please try again.', 'error');
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleEdit = (course) => {
        setEditingCourse(course);
        setCourseData({
            name: course.name,
            description: course.description,
            price: course.price.toString(),
            discount: course.discount || 0,
            duration: course.category === 'Promo' ? '' : course.duration,
            duration_tdc: course.category === 'Promo' && course.duration ? (course.duration.match(/TDC:\s*([\d.]+)/)?.[1] || '') : '',
            duration_pdc: course.category === 'Promo' && course.duration ? (course.duration.match(/PDC:\s*([\d.]+)/)?.[1] || '') : '',
            images: course.images || [],
            status: course.status.toLowerCase(),
            category: course.category || 'Basic',
            course_type: course.course_type || ''
        });
        setPricingVariations(course.pricing_data || []);
        // Only load branches that genuinely have a custom price.
        // Do NOT pre-fill all branches with the default — that would create stale
        // overrides if the user later changes the main course price.
        const existingBp = {};
        if (Array.isArray(course.branch_prices)) {
            course.branch_prices.forEach(bp => { existingBp[String(bp.branch_id)] = String(bp.price); });
        }
        setBranchPrices(existingBp);
        // If currently viewing a specific branch, pre-select it so the user edits
        // that branch's price directly instead of accidentally changing the global default.
        setEditingBranchId(viewingBranchId ? String(viewingBranchId) : '');
        setShowModal(true);
    };

    const handleDelete = async (courseId) => {
        if (window.confirm('Are you sure you want to delete this course?')) {
            try {
                await coursesAPI.delete(courseId);
                // Remove instantly from local state — no re-fetch needed
                applyCoursesUpdate(prev => prev.filter(c => c.id !== courseId));
                showNotification('Course deleted successfully!', 'success');
            } catch (error) {
                console.error('Error deleting course:', error);
                showNotification('Failed to delete course. Please try again.', 'error');
            }
        }
    };

    const handleCloseModal = () => {
        if (submitLoading) return;
        setShowModal(false);
        setEditingCourse(null);
        setCourseData({
            name: '',
            description: '',
            price: '',
            discount: 0,
            duration: '',
            duration_tdc: '',
            duration_pdc: '',
            images: [],
            status: 'active',
            category: 'Basic',
            course_type: ''
        });
        setPricingVariations([]);
        setBranchPrices({});
        setEditingBranchId('');
    };


    const getEffectivePrice = (course, basePrice) => {
        if (!viewingBranchId) return parseFloat(basePrice);
        const base = parseFloat(basePrice);
        const bp = Array.isArray(course.branch_prices)
            ? course.branch_prices.find(b => String(b.branch_id) === String(viewingBranchId))
            : null;
        // Only use custom price if it genuinely DIFFERS from the current default.
        // Entries equal to the default are stale (saved by old code) — ignore them.
        if (bp && bp.price > 0 && parseFloat(bp.price) !== base) return parseFloat(bp.price);
        return base;
    };

    const getCourseOrder = (pkg) => {
        const name = (pkg.name || '').toLowerCase();
        const category = (pkg.category || '').toLowerCase();
        if (category === 'tdc' || name.includes('theoretical')) return 1;
        if (name.includes('motorcycle')) return 2;
        if (name.includes('pdc') && name.includes('car')) return 3;
        if (name.includes('tricycle') || name.includes('a1')) return 4;
        if (name.includes('van') || name.includes('b1') || name.includes('b2') || name.includes('l300')) return 5;
        return 6;
    };

    // Separate regular courses from promo bundle packages
    const filteredCourses = courses
        .filter(course =>
            course.category !== 'Promo' &&
            course.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => getCourseOrder(a) - getCourseOrder(b));

    const filteredPackages = courses
        .filter(course =>
            course.category === 'Promo' &&
            course.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => getCourseOrder(a) - getCourseOrder(b));

    // Active-tab-aware list used by pagination and the discount table
    const allFilteredCourses = courses
        .filter(course =>
            course.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => getCourseOrder(a) - getCourseOrder(b));

    const activeFilteredList = activeTab === 'packages' ? filteredPackages
        : activeTab === 'discounts' ? allFilteredCourses
        : filteredCourses;

    // Shorten long branch names for display: strip school prefix, remove "Main", capitalise after hyphens
    const shortBranchName = (name) => {
        return (name || '')
            .replace(/^Masters?\s+Prime\s+Holdings\s+Corp\.\s*/i, '')
            .replace(/^Masters?\s+Prime\s+Driving\s+School\s*/i, '')
            .replace(/^Masters?\s+Driving\s+School\s*/i, '')
            .replace(/\bMain\b\s*/i, '')
            .replace(/-([a-z])/g, (_, c) => '-' + c.toUpperCase())
            .replace(/\s{2,}/g, ' ')
            .trim();
    };

    // Reset to page 1 when search changes
    useEffect(() => { setCoursePage(1); }, [searchTerm]);

    useEffect(() => {
        if (allowedCourseTabs.length === 0) return;
        if (!allowedCourseTabs.includes(activeTab)) {
            setActiveTab(allowedCourseTabs[0]);
        }
    }, [activeTab, allowedCourseTabs]);

    useEffect(() => {
        if (isBranchScopedUser && currentUserBranchId) {
            setViewingBranchId(String(currentUserBranchId));
            return;
        }

        if (viewingBranchId && !branches.some((branch) => String(branch.id) === String(viewingBranchId))) {
            setViewingBranchId(null);
        }
    }, [isBranchScopedUser, currentUserBranchId, branches, viewingBranchId]);

    const courseTotalPages = Math.ceil(activeFilteredList.length / COURSE_PAGE_SIZE);
    const pagedCourses = activeFilteredList.slice((coursePage - 1) * COURSE_PAGE_SIZE, coursePage * COURSE_PAGE_SIZE);
    const viewingBranch = branches.find(b => String(b.id) === String(viewingBranchId)) || null;

    const handleAddCustomAddon = () => {
        setAddonsConfig({
            ...addonsConfig,
            customAddons: [...(addonsConfig.customAddons || []), { id: Date.now().toString(), name: '', price: '', file: null, fileName: '' }]
        });
    };

    const handleRemoveCustomAddon = (index) => {
        const newAddons = [...(addonsConfig.customAddons || [])];
        newAddons.splice(index, 1);
        setAddonsConfig({ ...addonsConfig, customAddons: newAddons });
    };

    const handleCustomAddonChange = (index, field, value) => {
        const newAddons = [...(addonsConfig.customAddons || [])];
        newAddons[index][field] = value;
        setAddonsConfig({ ...addonsConfig, customAddons: newAddons });
    };

    const handleCustomAddonFileUpload = (index, e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            showNotification('File must be less than 5MB', 'error');
            return;
        }

        const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!validTypes.includes(file.type)) {
            showNotification('Only PDF and Word documents are allowed', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const newAddons = [...(addonsConfig.customAddons || [])];
            newAddons[index].file = reader.result;
            newAddons[index].fileName = file.name;
            setAddonsConfig({ ...addonsConfig, customAddons: newAddons });
        };
        reader.readAsDataURL(file);
    };

    const handleSaveAddonsConfig = async () => {
        setAddonsLoading(true);
        try {
            const res = await adminAPI.updateAddonsConfig(addonsConfig);
            if (res.success) {
                showNotification('Add-ons configuration saved successfully!', 'success');
            } else {
                throw new Error(res.error || 'Failed to save config');
            }
        } catch (error) {
            console.error('Error saving addons config:', error);
            showNotification(error.message || 'Error saving addons configuration.', 'error');
        } finally {
            setAddonsLoading(false);
        }
    };

    const handleDiscountUpdate = async (courseId) => {
        const discountValue = discountForm[courseId] ?? 0;
        const courseToUpdate = courses.find(c => c.id === courseId);
        if (!courseToUpdate) return;

        let updatedPricingData = courseToUpdate.pricing_data;
        if (updatedPricingData && updatedPricingData.length > 0) {
            updatedPricingData = updatedPricingData.map(v => ({
                ...v,
                discount: parseFloat(discountForm[`${courseId}_${v.type}`] || 0)
            }));
        }

        try {
            const coursePayload = {
                name: courseToUpdate.name,
                description: courseToUpdate.description,
                price: parseFloat(courseToUpdate.price),
                discount: parseFloat(discountValue) || 0,
                duration: courseToUpdate.duration,
                status: courseToUpdate.status,
                images: courseToUpdate.images,
                category: courseToUpdate.category,
                course_type: courseToUpdate.course_type || null,
                pricing_data: updatedPricingData,
                branch_prices: courseToUpdate.branch_prices
            };
            await coursesAPI.update(courseId, coursePayload);
            // Update discount immediately in local state — no re-fetch needed
            applyCoursesUpdate(prev => prev.map(c => {
                if (c.id !== courseId) return c;
                return { ...c, discount: parseFloat(discountValue) || 0, pricing_data: updatedPricingData || c.pricing_data };
            }));
            showNotification('Discount updated successfully!', 'success');
        } catch (error) {
            console.error('Error updating discount:', error);
            showNotification(error.message || 'Failed to update discount.', 'error');
        }
    };

    return (
        <div className="user-management-container">
            {/* Tabs */}
            <div className="cfg-tabs-header" style={{ display: 'flex', gap: '8px', borderBottom: '2px solid var(--border-color)', marginBottom: '24px', overflow: 'hidden', background: 'var(--card-bg)', padding: '0 20px', borderRadius: '12px' }}>
                {canAccessCourseTab('courses') && (
                    <button
                        className={`cfg-tab-btn${activeTab === 'courses' ? ' active' : ''}`}
                        onClick={() => { setActiveTab('courses'); setCoursePage(1); }}
                        style={{ marginBottom: '-2px' }}
                    >
                        <span className="cfg-tab-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
                        </span>
                        <span className="tab-label">Courses</span>
                    </button>
                )}
                {canAccessCourseTab('packages') && (
                    <button
                        className={`cfg-tab-btn${activeTab === 'packages' ? ' active' : ''}`}
                        onClick={() => { setActiveTab('packages'); setCoursePage(1); }}
                        style={{ marginBottom: '-2px' }}
                    >
                        <span className="cfg-tab-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                        </span>
                        <span className="tab-label">Packages</span>
                    </button>
                )}
                {canAccessCourseTab('discounts') && (
                    <button
                        className={`cfg-tab-btn${activeTab === 'discounts' ? ' active' : ''}`}
                        onClick={() => {
                            setActiveTab('discounts');
                            setCoursePage(1);
                            const initForm = {};
                            courses.forEach(c => {
                                initForm[c.id] = c.discount || 0;
                                if (c.pricing_data) {
                                    c.pricing_data.forEach(v => {
                                        initForm[`${c.id}_${v.type}`] = v.discount || 0;
                                    });
                                }
                            });
                            setDiscountForm(initForm);
                        }}
                        style={{ marginBottom: '-2px' }}
                    >
                        <span className="cfg-tab-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 0 2.83 2.83L23.41 16.24v-2.83l-2.82-2.82z"></path><line x1="7" y1="7" x2="7" y2="7"></line></svg>
                        </span>
                        <span className="tab-label">Discounts</span>
                    </button>
                )}
                {canAccessCourseTab('config') && (
                    <button
                        className={`cfg-tab-btn${activeTab === 'config' ? ' active' : ''}`}
                        onClick={() => setActiveTab('config')}
                        style={{ marginBottom: '-2px' }}
                    >
                        <span className="cfg-tab-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        </span>
                        <span className="tab-label">Config</span>
                    </button>
                )}
            </div>

            {allowedCourseTabs.length === 0 && (
                <div style={{
                    marginBottom: '20px',
                    border: '1px solid #fecaca',
                    background: '#fef2f2',
                    color: '#991b1b',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    fontSize: '0.85rem',
                    fontWeight: 600
                }}>
                    No Course Management tabs are enabled for this account.
                </div>
            )}

            {/* Viewing Branch Bar */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--card-bg)', border: '1px solid var(--border-color)',
                borderLeft: '4px solid var(--primary-color)',
                borderRadius: '12px', padding: '14px 20px', marginBottom: '20px', gap: '16px', flexWrap: 'wrap'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '38px', height: '38px', borderRadius: '10px',
                        background: 'var(--primary-color)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Viewing Branch</div>
                        <div style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-color)' }}>
                            {viewingBranch ? shortBranchName(viewingBranch.name) : 'All Branches'}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                        padding: '4px 12px', borderRadius: '20px',
                        background: 'var(--primary-light)', color: 'var(--primary-color)',
                        fontSize: '0.82rem', fontWeight: '700'
                    }}>
                        {isBranchScopedUser ? 'Assigned Branch' : `${branches.length} Branch${branches.length !== 1 ? 'es' : ''}`}
                    </span>
                    <select
                        value={viewingBranchId ?? ''}
                        onChange={e => setViewingBranchId(e.target.value || null)}
                        disabled={isBranchScopedUser}
                        style={{
                            padding: '8px 36px 8px 14px',
                            border: '1.5px solid var(--border-color)',
                            borderRadius: '10px',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            background: 'var(--card-bg)',
                            color: 'var(--text-color)',
                            appearance: 'none',
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 10px center',
                            minWidth: '220px',
                            opacity: isBranchScopedUser ? 0.85 : 1,
                            cursor: isBranchScopedUser ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {!isBranchScopedUser && <option value="">All Branches / Default View</option>}
                        {branches.map(b => (
                            <option key={b.id} value={b.id}>{shortBranchName(b.name)}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="course-management-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div className="search-box" style={{ flex: '1', minWidth: '250px', maxWidth: '500px' }}>
                    <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
                    <input
                        type="text"
                        placeholder="Search courses..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px 12px 12px 40px',
                            border: '1.5px solid var(--border-color)',
                            borderRadius: '12px',
                            fontSize: '0.95rem',
                            transition: 'all 0.2s',
                            background: 'var(--card-bg)',
                            color: 'var(--text-color)'
                        }}
                    />
                </div>
                {(activeTab === 'courses' || activeTab === 'packages') && (
                    <button
                        onClick={() => {
                            // Pre-set category based on active tab
                            setCourseData(prev => ({ ...prev, category: activeTab === 'packages' ? 'Promo' : 'Basic' }));
                            setShowModal(true);
                        }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 24px',
                            background: activeTab === 'packages' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'var(--primary-color)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '0.95rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        {activeTab === 'packages' ? '+ Add Package' : '+ Add Course'}
                    </button>
                )}
            </div>

            {/* ── Helper: course-card renderer shared by Courses & Packages tabs ── */}
            {(activeTab === 'courses' || activeTab === 'packages') && (
                <>
                {/* Courses / Packages Grid */}
                {loading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--secondary-text)' }}>
                    <div style={{ fontSize: '1.1rem' }}>Loading {activeTab === 'packages' ? 'packages' : 'courses'}...</div>
                </div>
            ) : pagedCourses.length === 0 && !loading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--secondary-text)' }}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 20px', opacity: 0.5 }}>
                        {activeTab === 'packages'
                            ? <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                            : <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></>}
                    </svg>
                    <div style={{ fontSize: '1.1rem', marginBottom: '8px' }}>No {activeTab === 'packages' ? 'promo packages' : 'courses'} found</div>
                    <p style={{ fontSize: '0.9rem' }}>Try adjusting your search or add a {activeTab === 'packages' ? 'new package' : 'new course'}</p>
                </div>
            ) : (
                <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                    {pagedCourses.map((course) => (
                        <div
                            key={course.id}
                            style={{
                                background: 'var(--card-bg)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '16px',
                                overflow: 'hidden',
                                transition: 'all 0.3s',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            {/* Course Image */}
                            <div style={{
                                width: '100%',
                                height: '180px',
                                overflow: 'hidden',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative'
                            }}>
                                {course.images && course.images.length > 0 && course.images[0] ? (
                                    <img
                                        src={course.images[0]}
                                        alt={course.name}
                                        onClick={() => setViewingImage({ current: course.images[0], all: course.images })}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            cursor: 'pointer',
                                            transition: 'transform 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                                        onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                        }}
                                    />
                                ) : null}
                                {(!course.images || course.images.length === 0 || !course.images[0]) && (
                                    <span style={{ color: 'white', fontSize: '3rem', fontWeight: 'bold', zIndex: 1 }}>
                                        {course.name.charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>

                            {/* Course Content */}
                            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                                {course.category === 'Promo' && (
                                    <div style={{ marginBottom: '8px' }}>
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                            padding: '3px 8px',
                                            background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                                            color: '#92400e', borderRadius: '6px',
                                            fontSize: '0.72rem', fontWeight: '800',
                                            border: '1px solid #f59e0b', letterSpacing: '0.03em'
                                        }}>
                                            🏷️ PROMO BUNDLE
                                        </span>
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-color)', margin: 0, flex: 1 }}>
                                        {course.name}
                                    </h3>
                                    <span style={{
                                        padding: '4px 10px',
                                        borderRadius: '8px',
                                        fontSize: '0.75rem',
                                        fontWeight: '600',
                                        background: course.status.toLowerCase() === 'active' ? '#d1fae5' : '#fee2e2',
                                        color: course.status.toLowerCase() === 'active' ? '#065f46' : '#991b1b'
                                    }}>
                                        {course.status.charAt(0).toUpperCase() + course.status.slice(1).toLowerCase()}
                                    </span>
                                </div>

                                <p style={{
                                    fontSize: '0.85rem',
                                    color: 'var(--secondary-text)',
                                    marginBottom: '16px',
                                    lineHeight: '1.5',
                                    minHeight: '60px',
                                    overflow: 'hidden',
                                    display: '-webkit-box',
                                    WebkitLineClamp: '3',
                                    WebkitBoxOrient: 'vertical'
                                }}>
                                    {course.description}
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', fontSize: '0.85rem', marginTop: 'auto' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                            <line x1="16" y1="2" x2="16" y2="6"></line>
                                            <line x1="8" y1="2" x2="8" y2="6"></line>
                                            <line x1="3" y1="10" x2="21" y2="10"></line>
                                        </svg>
                                        <span style={{ color: 'var(--secondary-text)' }}>{course.duration} Hours</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                            <circle cx="9" cy="7" r="4"></circle>
                                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                        </svg>
                                        <span style={{ color: 'var(--secondary-text)' }}>{course.enrolled || 0} enrolled</span>
                                    </div>
                                </div>

                                {/* Price Section */}
                                <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border-color)', marginTop: 'auto' }}>
                                    {course.discount > 0 && (
                                        <div style={{ marginBottom: '8px' }}>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '2px 8px',
                                                background: '#ef4444',
                                                color: 'white',
                                                borderRadius: '4px',
                                                fontSize: '0.75rem',
                                                fontWeight: 'bold'
                                            }}>
                                                {course.discount}% OFF
                                            </span>
                                        </div>
                                    )}
                                    {/* Pricing Options - Show both main and variations */}
                                    {(course.course_type || (course.pricing_data && course.pricing_data.length > 0)) ? (
                                        <div style={{ marginBottom: '12px' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--secondary-text)', marginBottom: '8px', textTransform: 'uppercase' }}>
                                                Pricing Options:
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                {/* Main course type and price */}
                                                {course.course_type && (
                                                    <div style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        padding: '8px 12px',
                                                        background: 'var(--bg-color)',
                                                        borderRadius: '8px',
                                                        border: '1px solid var(--border-color)'
                                                    }}>
                                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-color)', fontWeight: '500' }}>
                                                            {course.category === 'Promo' ? resolvePromoBundleLabel(course.course_type) : course.course_type}
                                                        </span>
                                                        <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary-color)' }}>
                                                            ₱{getEffectivePrice(course, course.price).toLocaleString()}
                                                        </span>
                                                    </div>
                                                )}
                                                {/* Additional pricing variations */}
                                                {course.pricing_data && course.pricing_data.map((variation, idx) => (
                                                    <div key={idx} style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        padding: '8px 12px',
                                                        background: 'var(--bg-color)',
                                                        borderRadius: '8px',
                                                        border: '1px solid var(--border-color)'
                                                    }}>
                                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-color)', fontWeight: '500' }}>
                                                            {variation.type}
                                                        </span>
                                                        <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary-color)' }}>
                                                            ₱{parseFloat(variation.price).toLocaleString()}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary-color)' }}>
                                                ₱{getEffectivePrice(course, course.price).toLocaleString()}
                                            </span>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                        <button
                                            onClick={() => handleEdit(course)}
                                            style={{
                                                padding: '8px 12px',
                                                background: 'var(--primary-light)',
                                                color: 'var(--primary-color)',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontSize: '0.85rem',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(course.id)}
                                            style={{
                                                padding: '8px 12px',
                                                background: '#fee2e2',
                                                color: '#991b1b',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontSize: '0.85rem',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <Pagination
                    currentPage={coursePage}
                    totalPages={courseTotalPages}
                    onPageChange={setCoursePage}
                    totalItems={activeFilteredList.length}
                    pageSize={COURSE_PAGE_SIZE}
                />
                </>
            )}
            </>
            )}


            {activeTab === 'discounts' && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="bg-white border-b border-gray-100 p-6 text-center">
                        <h2 className="text-xl font-semibold text-[#1a2332]">Course Discounts</h2>
                    </div>
                    {loading ? (
                        <div className="text-center p-10 text-gray-500">Loading courses...</div>
                    ) : allFilteredCourses.length === 0 ? (
                        <div className="text-center p-10 text-gray-500">No courses match your search.</div>
                    ) : (
                        <>
                        <div className="admin-table-responsive">
                            <table className="w-full min-w-[800px]">
                                <thead className="bg-[#f8fafc]">
                                    <tr>
                                        <th className="py-4 px-6 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Course Name</th>
                                        <th className="py-4 px-6 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Price {viewingBranchId ? `(${shortBranchName(branches.find(b => String(b.id) === String(viewingBranchId))?.name)})` : ''}</th>
                                        <th className="py-4 px-6 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Discount (%)</th>
                                        <th className="py-4 px-6 text-center text-xs font-bold text-gray-600 uppercase tracking-wider w-32">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y border-t border-gray-100 divide-gray-100">
                                    {pagedCourses.map(course => {
                                        const effectivePrice = getEffectivePrice(course, course.price);
                                        return (
                                            <tr key={course.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="py-5 px-6">
                                                    <div className="flex flex-col items-center sm:items-start text-center sm:text-left gap-1">
                                                        <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                                                            <span className="font-semibold text-[#1a2332] text-[0.95rem]">{course.name}</span>
                                                            {course.category === 'Promo' && (
                                                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md border border-amber-200">
                                                                    PROMO
                                                                </span>
                                                            )}
                                                        </div>
                                                        {(course.course_type || course.category) && course.category !== 'Basic' && (
                                                            <span className="text-xs text-gray-500 font-medium">
                                                                {course.category === 'Promo' ? resolvePromoBundleLabel(course.course_type) : (
                                                                    `${course.category} ${course.course_type ? '- ' + course.course_type : ''}`
                                                                )}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-5 px-6 text-center">
                                                    <div className="flex flex-col items-center gap-1.5">
                                                        <div className="font-bold text-[#2157da]">
                                                            {course.pricing_data && course.pricing_data.length > 0 && <span className="text-xs text-gray-500 font-medium mr-1.5">Base:</span>}
                                                            ₱{effectivePrice.toLocaleString()}
                                                        </div>
                                                        {course.pricing_data && course.pricing_data.map((v, i) => (
                                                            <div key={i} className="text-sm font-semibold text-[#2157da]">
                                                                <span className="text-xs text-gray-500 font-medium mr-1.5">{v.type}:</span>
                                                                ₱{parseFloat(v.price).toLocaleString()}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="py-5 px-6">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm focus-within:border-[#2157da] focus-within:ring-1 focus-within:ring-[#2157da] transition-all">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="100"
                                                                value={discountForm[course.id] ?? course.discount ?? 0}
                                                                onChange={(e) => setDiscountForm({...discountForm, [course.id]: e.target.value})}
                                                                className="w-12 text-center text-sm font-semibold text-gray-700 outline-none p-0 border-none bg-transparent"
                                                            />
                                                            <span className="text-gray-400 text-sm font-medium">%</span>
                                                        </div>

                                                        {course.pricing_data && course.pricing_data.map((v, i) => (
                                                            <div key={i} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm focus-within:border-[#2157da] focus-within:ring-1 focus-within:ring-[#2157da] transition-all">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max="100"
                                                                    value={discountForm[`${course.id}_${v.type}`] ?? v.discount ?? 0}
                                                                    onChange={(e) => setDiscountForm({...discountForm, [`${course.id}_${v.type}`]: e.target.value})}
                                                                    className="w-12 text-center text-sm font-semibold text-gray-700 outline-none p-0 border-none bg-transparent"
                                                                />
                                                                <span className="text-gray-400 text-sm font-medium">%</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="py-5 px-6">
                                                    <div className="flex justify-center">
                                                        <button 
                                                            onClick={() => handleDiscountUpdate(course.id)}
                                                            className="flex items-center gap-1.5 bg-[#2157da] hover:bg-[#1a46b8] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors active:scale-95 shadow-sm"
                                                        >
                                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                                                                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                                                                <polyline points="7 3 7 8 15 8"></polyline>
                                                            </svg>
                                                            Save
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-gray-100">
                            <Pagination
                                currentPage={coursePage}
                                totalPages={courseTotalPages}
                                onPageChange={setCoursePage}
                                totalItems={allFilteredCourses.length}
                                pageSize={COURSE_PAGE_SIZE}
                            />
                        </div>
                        </>
                    )}
                </div>
            )}

            {/* Config Tab */}
            {activeTab === 'config' && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm max-w-4xl mx-auto">
                    <div className="p-8 text-center border-b border-gray-100">
                        <h2 className="text-xl font-bold text-[#1a2332] mb-2">Global Add-Ons Price Settings</h2>
                        <p className="text-sm text-gray-500 max-w-2xl mx-auto">Set the global prices for course checkout add-ons. These will be automatically checked by default for students to easily add during checkout.</p>
                    </div>
                    
                    <div className="p-8">
                        <div className="flex flex-col gap-6 max-w-md mx-auto">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Reviewer Price (₱)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={addonsConfig.reviewer}
                                    onChange={(e) => setAddonsConfig({...addonsConfig, reviewer: e.target.value})}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-[#2157da] focus:ring-2 focus:ring-blue-100 outline-none transition-all text-gray-800 font-semibold"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Vehicle Tips Price (₱)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={addonsConfig.vehicleTips}
                                    onChange={(e) => setAddonsConfig({...addonsConfig, vehicleTips: e.target.value})}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-[#2157da] focus:ring-2 focus:ring-blue-100 outline-none transition-all text-gray-800 font-semibold"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Convenience Fee (₱)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={addonsConfig.convenienceFee}
                                    onChange={(e) => setAddonsConfig({...addonsConfig, convenienceFee: e.target.value})}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-[#2157da] focus:ring-2 focus:ring-blue-100 outline-none transition-all text-gray-800 font-semibold"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Promo Bundle Discount (%)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={addonsConfig.promoBundleDiscountPercent}
                                    onChange={(e) => setAddonsConfig({...addonsConfig, promoBundleDiscountPercent: e.target.value})}
                                    placeholder="3"
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-[#2157da] focus:ring-2 focus:ring-blue-100 outline-none transition-all text-gray-800 font-semibold"
                                />
                                <p className="text-[10px] text-gray-400 mt-1 font-medium">Applied automatically to custom bundles (TDC + PDC combinations). Set to 0 to disable.</p>
                            </div>

                            {/* Custom Add-ons Section */}
                            <div className="mt-8 pt-8 border-t border-gray-200">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-[#1a2332]">Custom Add-ons</h3>
                                    <button
                                        onClick={handleAddCustomAddon}
                                        className="text-sm font-bold text-[#2157da] bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors border border-blue-200"
                                    >
                                        + Add New Add-on
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {(addonsConfig.customAddons || []).map((addon, index) => (
                                        <div key={addon.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl relative">
                                            <button
                                                onClick={() => handleRemoveCustomAddon(index)}
                                                className="absolute top-3 right-3 text-red-400 hover:text-red-600 font-blacktext-lg w-8 h-8 flex items-center justify-center hover:bg-red-50 rounded-full transition-colors"
                                            >
                                                &times;
                                            </button>
                                            
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-2">Add-on Name</label>
                                                    <input
                                                        type="text"
                                                        value={addon.name}
                                                        onChange={(e) => handleCustomAddonChange(index, 'name', e.target.value)}
                                                        placeholder="e.g. Student Manual"
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-[#2157da] focus:ring-1 focus:ring-[#2157da] outline-none text-sm font-semibold"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-2">Price (₱)</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={addon.price}
                                                        onChange={(e) => handleCustomAddonChange(index, 'price', e.target.value)}
                                                        placeholder="0"
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-[#2157da] focus:ring-1 focus:ring-[#2157da] outline-none text-sm font-semibold"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-gray-700 mb-2">Upload File (PDF/Word)</label>
                                                <div className="flex flex-col sm:flex-row items-center gap-3">
                                                    <label className="cursor-pointer bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                                        Choose File
                                                        <input 
                                                            type="file" 
                                                            accept=".pdf,.doc,.docx" 
                                                            className="hidden" 
                                                            onChange={(e) => handleCustomAddonFileUpload(index, e)}
                                                        />
                                                    </label>
                                                    {addon.fileName && (
                                                        <span className="text-xs text-[#2157da] font-medium bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100 flex items-center gap-1.5 truncate max-w-full">
                                                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                            <span className="truncate">{addon.fileName}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {(addonsConfig.customAddons || []).length === 0 && (
                                        <div className="text-center py-6 text-sm text-gray-400 font-medium italic border-2 border-dashed border-gray-200 rounded-xl">
                                            No custom add-ons configured yet.
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <button
                                onClick={handleSaveAddonsConfig}
                                disabled={addonsLoading}
                                className={`mt-4 w-full py-3.5 rounded-xl font-bold text-white transition-all shadow-sm flex items-center justify-center gap-2 ${
                                    addonsLoading 
                                        ? 'bg-[#1a46b8] opacity-70 cursor-not-allowed' 
                                        : 'bg-[#2157da] hover:bg-[#1a46b8] hover:shadow-md active:scale-[0.98]'
                                }`}
                            >
                                {addonsLoading ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Saving...
                                    </>
                                ) : (
                                    'Save Configuration'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Viewer Modal */}
            {viewingImage && (
                <div
                    onClick={() => setViewingImage(null)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.9)',
                        zIndex: 9999,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px',
                        cursor: 'pointer'
                    }}
                >
                    <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '80vh', display: 'flex', justifyContent: 'center' }}>
                        <button
                            onClick={() => setViewingImage(null)}
                            style={{
                                position: 'absolute',
                                top: '-40px',
                                right: '0',
                                background: 'white',
                                border: 'none',
                                borderRadius: '50%',
                                width: '36px',
                                height: '36px',
                                fontSize: '24px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold',
                                color: '#333'
                            }}
                        >
                            ×
                        </button>
                        <img
                            src={typeof viewingImage === 'string' ? viewingImage : viewingImage.current}
                            alt="Full size"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                maxWidth: '100%',
                                maxHeight: '75vh',
                                objectFit: 'contain',
                                borderRadius: '8px',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                            }}
                        />
                    </div>
                    {typeof viewingImage === 'object' && viewingImage.all && viewingImage.all.length > 1 && (
                        <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                display: 'flex',
                                gap: '15px',
                                marginTop: '20px',
                                maxWidth: '90%',
                                overflowX: 'auto',
                                padding: '10px'
                            }}
                        >
                            {viewingImage.all.map((img, idx) => (
                                <img
                                    key={idx}
                                    src={img}
                                    onClick={() => setViewingImage({ ...viewingImage, current: img })}
                                    style={{
                                        width: '80px',
                                        height: '80px',
                                        objectFit: 'cover',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        border: (viewingImage.current || viewingImage) === img ? '3px solid #3b82f6' : '3px solid transparent',
                                        transition: 'all 0.2s',
                                        opacity: (viewingImage.current || viewingImage) === img ? 1 : 0.6
                                    }}
                                    onMouseEnter={(e) => e.target.style.opacity = 1}
                                    onMouseLeave={(e) => e.target.style.opacity = (viewingImage.current || viewingImage) === img ? 1 : 0.6}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Add/Edit Course Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-container user-modal" style={{ maxWidth: '650px', width: '95%' }}>
                        <div className="modal-header">
                            <div className="modal-header-left">
                                <div className="modal-header-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
                                </div>
                                <div>
                                    <h2>{editingCourse ? 'Edit Course' : 'Add New Course'}</h2>
                                    <p>{editingCourse ? 'Update course information' : 'Fill in the details to add a new course'}</p>
                                </div>
                            </div>
                            <div className="modal-header-right">
                                <button className="close-modal" onClick={handleCloseModal} disabled={submitLoading}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>
                        </div>
                        <form onSubmit={handleAddCourse}>
                            <div className="modal-body" style={{
                                maxHeight: '500px',
                                overflowY: 'auto',
                                padding: '30px',
                                background: 'var(--bg-color)'
                            }}>
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-color)' }}>
                                        Course Name <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={courseData.name}
                                        onChange={handleInputChange}
                                        placeholder="e.g., Theoretical Driving Course"
                                        required
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            border: '1.5px solid var(--border-color)',
                                            borderRadius: '10px',
                                            fontSize: '0.95rem',
                                            background: 'var(--card-bg)',
                                            color: 'var(--text-color)'
                                        }}
                                    />
                                </div>

                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-color)' }}>
                                        Description <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <textarea
                                        name="description"
                                        value={courseData.description}
                                        onChange={handleInputChange}
                                        placeholder="Brief description of the course"
                                        required
                                        rows="3"
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            border: '1.5px solid var(--border-color)',
                                            borderRadius: '10px',
                                            fontSize: '0.95rem',
                                            background: 'var(--card-bg)',
                                            color: 'var(--text-color)',
                                            resize: 'vertical'
                                        }}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                                    <div>
                                        {editingCourse && viewingBranchId ? (
                                            <>
                                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-color)' }}>
                                                    Price for {shortBranchName(branches.find(b => String(b.id) === String(viewingBranchId))?.name || '')} (₱)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={branchPrices[String(viewingBranchId)] ?? courseData.price}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        if (val === '' || (/^\d*\.?\d*$/.test(val) && parseFloat(val) >= 0)) {
                                                            setBranchPrices(prev => ({ ...prev, [String(viewingBranchId)]: val }));
                                                        }
                                                    }}
                                                    placeholder="5000"
                                                    min="0"
                                                    step="0.01"
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px',
                                                        border: '1.5px solid var(--primary-color)',
                                                        borderRadius: '10px',
                                                        fontSize: '0.95rem',
                                                        background: 'var(--card-bg)',
                                                        color: 'var(--text-color)'
                                                    }}
                                                />
                                                <div style={{ fontSize: '0.78rem', color: 'var(--secondary-text)', marginTop: '5px' }}>
                                                    Default (all branches): ₱{parseFloat(courseData.price || 0).toLocaleString()}
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-color)' }}>
                                                    Price (₱) <span style={{ color: '#ef4444' }}>*</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    name="price"
                                                    value={courseData.price}
                                                    onChange={handleInputChange}
                                                    placeholder="5000"
                                                    required
                                                    min="0"
                                                    step="0.01"
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px',
                                                        border: '1.5px solid var(--border-color)',
                                                        borderRadius: '10px',
                                                        fontSize: '0.95rem',
                                                        background: 'var(--card-bg)',
                                                        color: 'var(--text-color)'
                                                    }}
                                                />
                                            </>
                                        )}
                                    </div>
                                    {courseData.category === 'Promo' ? (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-color)' }}>
                                                    TDC Duration <span style={{ color: '#ef4444' }}>*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    name="duration_tdc"
                                                    value={courseData.duration_tdc || ''}
                                                    onChange={handleInputChange}
                                                    placeholder="e.g., 15"
                                                    required
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px',
                                                        border: '1.5px solid var(--border-color)',
                                                        borderRadius: '10px',
                                                        fontSize: '0.95rem',
                                                        background: 'var(--card-bg)',
                                                        color: 'var(--text-color)'
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-color)' }}>
                                                    PDC Duration <span style={{ color: '#ef4444' }}>*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    name="duration_pdc"
                                                    value={courseData.duration_pdc || ''}
                                                    onChange={handleInputChange}
                                                    placeholder="e.g., 8"
                                                    required
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px',
                                                        border: '1.5px solid var(--border-color)',
                                                        borderRadius: '10px',
                                                        fontSize: '0.95rem',
                                                        background: 'var(--card-bg)',
                                                        color: 'var(--text-color)'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-color)' }}>
                                                Duration <span style={{ color: '#ef4444' }}>*</span>
                                            </label>
                                            <input
                                                type="text"
                                                name="duration"
                                                value={courseData.duration}
                                                onChange={handleInputChange}
                                                placeholder="e.g., 2 weeks"
                                                required
                                                style={{
                                                    width: '100%',
                                                    padding: '12px',
                                                    border: '1.5px solid var(--border-color)',
                                                    borderRadius: '10px',
                                                    fontSize: '0.95rem',
                                                    background: 'var(--card-bg)',
                                                    color: 'var(--text-color)'
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-color)' }}>
                                            Category <span style={{ color: '#ef4444' }}>*</span>
                                        </label>
                                        <select
                                            name="category"
                                            value={courseData.category}
                                            onChange={(e) => {
                                                handleInputChange(e);
                                                // Reset course_type when category changes
                                                setCourseData(prev => ({ ...prev, course_type: '' }));
                                            }}
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '12px',
                                                border: '1.5px solid var(--border-color)',
                                                borderRadius: '10px',
                                                fontSize: '0.95rem',
                                                background: 'var(--card-bg)',
                                                color: 'var(--text-color)'
                                            }}
                                        >
                                            {(courseConfig?.categories || ['Basic', 'TDC', 'PDC', 'Promo'])
                                                .filter(cat => {
                                                    if (activeTab === 'packages') return cat === 'Promo';
                                                    if (activeTab === 'courses') return cat !== 'Promo';
                                                    return true; // Discounts/Config can see all if needed
                                                })
                                                .map(cat => (
                                                <option key={cat} value={cat}>
                                                    {cat === 'TDC' ? 'TDC (Theoretical Driving Course)'
                                                        : cat === 'PDC' ? 'PDC (Practical Driving Course)'
                                                        : cat === 'Promo' ? '🏷️ Promo Bundle (TDC + PDC)'
                                                        : cat}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-color)' }}>
                                            Status <span style={{ color: '#ef4444' }}>*</span>
                                        </label>
                                        <select
                                            name="status"
                                            value={courseData.status}
                                            onChange={handleInputChange}
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '12px',
                                                border: '1.5px solid var(--border-color)',
                                                borderRadius: '10px',
                                                fontSize: '0.95rem',
                                                background: 'var(--card-bg)',
                                                color: 'var(--text-color)'
                                            }}
                                        >
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Conditional Course Type based on Category */}
                                {(courseData.category === 'TDC' || courseData.category === 'PDC') && (
                                    <div style={{ marginBottom: '20px' }}>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-color)' }}>
                                            Type <span style={{ color: '#ef4444' }}>*</span>
                                        </label>
                                        <select
                                            name="course_type"
                                            value={courseData.course_type}
                                            onChange={handleInputChange}
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '12px',
                                                border: '1.5px solid var(--border-color)',
                                                borderRadius: '10px',
                                                fontSize: '0.95rem',
                                                background: 'var(--card-bg)',
                                                color: 'var(--text-color)'
                                            }}
                                        >
                                            <option value="">Select Type</option>
                                            {courseData.category === 'TDC' && (
                                                (courseConfig?.tdcTypes || [{ value: 'Online', label: 'Online' }, { value: 'F2F', label: 'F2F (Face-to-Face)' }])
                                                    .map(t => <option key={t.value} value={t.value}>{t.label}</option>)
                                            )}
                                            {courseData.category === 'PDC' && (
                                                (courseConfig?.pdcTypes || [{ value: 'Automatic', label: 'Automatic' }, { value: 'Manual', label: 'Manual' }, { value: 'V1-Tricycle', label: 'V1-Tricycle' }, { value: 'B1-Van/B2 - L300', label: 'B1 - Van/B2 - L300' }])
                                                    .map(t => <option key={t.value} value={t.value}>{t.label}</option>)
                                            )}
                                        </select>
                                    </div>
                                )}

                                {/* Promo Bundle Selector */}
                                {courseData.category === 'Promo' && (
                                    <div style={{ marginBottom: '20px' }}>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-color)' }}>
                                            Bundle Type <span style={{ color: '#ef4444' }}>*</span>
                                        </label>
                                        <select
                                            name="course_type"
                                            value={courseData.course_type}
                                            onChange={handleInputChange}
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '12px',
                                                border: '1.5px solid #f59e0b',
                                                borderRadius: '10px',
                                                fontSize: '0.95rem',
                                                background: 'var(--card-bg)',
                                                color: 'var(--text-color)'
                                            }}
                                        >
                                            <option value="">Select Promo Bundle</option>
                                            {normalizedPromoBundles.map(b => (
                                                <option key={b.value} value={b.value}>{b.label}</option>
                                            ))}
                                            {courseData.course_type && !normalizedPromoBundles.some((b) => b.value === courseData.course_type || (b.legacyValues || []).includes(courseData.course_type)) && (
                                                <option value={courseData.course_type}>{resolvePromoBundleLabel(courseData.course_type)}</option>
                                            )}
                                        </select>
                                        <p style={{ marginTop: '6px', fontSize: '0.8rem', color: '#92400e', background: '#fef3c7', padding: '8px 10px', borderRadius: '8px' }}>
                                            🏷️ Students select a TDC slot first, then a PDC slot when booking this promo.
                                        </p>
                                    </div>
                                )}

                                {/* Additional Type & Price Variations */}
                                {(courseData.category === 'TDC' || courseData.category === 'PDC') && (
                                    <div style={{ marginBottom: '20px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                            <label style={{ fontWeight: '600', color: 'var(--text-color)' }}>
                                                Additional Type & Price Variations
                                            </label>
                                            <button
                                                type="button"
                                                onClick={handleAddPricingVariation}
                                                style={{
                                                    padding: '8px 16px',
                                                    background: 'var(--primary-color)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                + Add Variation
                                            </button>
                                        </div>

                                        {pricingVariations.map((variation, index) => (
                                            <div key={index} style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1fr 1fr auto',
                                                gap: '12px',
                                                marginBottom: '12px',
                                                padding: '16px',
                                                background: 'var(--card-bg)',
                                                border: '1.5px solid var(--border-color)',
                                                borderRadius: '10px'
                                            }}>
                                                <div>
                                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-color)' }}>
                                                        Type
                                                    </label>
                                                    <select
                                                        value={variation.type}
                                                        onChange={(e) => handlePricingVariationChange(index, 'type', e.target.value)}
                                                        required
                                                        style={{
                                                            width: '100%',
                                                            padding: '10px',
                                                            border: '1.5px solid var(--border-color)',
                                                            borderRadius: '8px',
                                                            fontSize: '0.9rem',
                                                            background: 'var(--bg-color)',
                                                            color: 'var(--text-color)'
                                                        }}
                                                    >
                                                        <option value="">Select Type</option>
                                                        {courseData.category === 'TDC' && (
                                                            <>
                                                                <option value="Online">Online</option>
                                                                <option value="F2F">F2F (Face-to-Face)</option>
                                                            </>
                                                        )}
                                                        {courseData.category === 'PDC' && (
                                                            <>
                                                                <option value="Automatic">Automatic</option>
                                                                <option value="Manual">Manual</option>
                                                                <option value="B1-Van">B1 - Van</option>
                                                                <option value="B2-L300">B2 - L300</option>
                                                            </>
                                                        )}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-color)' }}>
                                                        Price (₱)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={variation.price}
                                                        onChange={(e) => handlePricingVariationChange(index, 'price', e.target.value)}
                                                        placeholder="5000"
                                                        required
                                                        min="0"
                                                        step="0.01"
                                                        style={{
                                                            width: '100%',
                                                            padding: '10px',
                                                            border: '1.5px solid var(--border-color)',
                                                            borderRadius: '8px',
                                                            fontSize: '0.9rem',
                                                            background: 'var(--bg-color)',
                                                            color: 'var(--text-color)'
                                                        }}
                                                    />
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemovePricingVariation(index)}
                                                        style={{
                                                            padding: '10px 14px',
                                                            background: '#ef4444',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '8px',
                                                            fontSize: '0.85rem',
                                                            fontWeight: '600',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        {pricingVariations.length === 0 && (
                                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: '8px 0 0 0' }}>
                                                Click "+ Add Variation" to add multiple types with different prices
                                            </p>
                                        )}
                                    </div>
                                )}

                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-color)' }}>
                                        Course Images <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>({courseData.images.length}/4 images)</span>
                                    </label>

                                    {/* Image Upload Button */}
                                    {courseData.images.length < 4 && (
                                        <div style={{ marginBottom: '12px' }}>
                                            <label style={{
                                                display: 'inline-block',
                                                padding: '12px 24px',
                                                background: 'var(--primary-color)',
                                                color: 'white',
                                                borderRadius: '10px',
                                                fontSize: '0.9rem',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}>
                                                <input
                                                    type="file"
                                                    accept="image/jpeg,image/jpg,image/png,image/webp"
                                                    multiple
                                                    onChange={handleImageUpload}
                                                    style={{ display: 'none' }}
                                                />
                                                📷 Upload Images
                                            </label>
                                            <span style={{ marginLeft: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                Max 4 images, 5MB each (JPG, PNG, WEBP)
                                            </span>
                                        </div>
                                    )}

                                    {/* Image Preview Grid */}
                                    {courseData.images.length > 0 && (
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(2, 1fr)',
                                            gap: '12px',
                                            marginTop: '12px'
                                        }}>
                                            {courseData.images.map((image, index) => (
                                                <div key={index} style={{
                                                    position: 'relative',
                                                    borderRadius: '10px',
                                                    overflow: 'hidden',
                                                    border: '2px solid var(--border-color)',
                                                    aspectRatio: '16/9'
                                                }}>
                                                    <img
                                                        src={image}
                                                        alt={`Course ${index + 1}`}
                                                        style={{
                                                            width: '100%',
                                                            height: '100%',
                                                            objectFit: 'cover'
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveImage(index)}
                                                        style={{
                                                            position: 'absolute',
                                                            top: '8px',
                                                            right: '8px',
                                                            background: 'rgba(239, 68, 68, 0.9)',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '50%',
                                                            width: '28px',
                                                            height: '28px',
                                                            fontSize: '16px',
                                                            fontWeight: 'bold',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(220, 38, 38, 1)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.9)'}
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="modal-footer" style={{
                                padding: '20px 30px',
                                borderTop: '1px solid var(--border-color)',
                                background: 'var(--card-bg)',
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: '12px'
                            }}>
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    disabled={submitLoading}
                                    style={{
                                        padding: '12px 24px',
                                        background: 'var(--card-bg)',
                                        color: 'var(--text-color)',
                                        border: '1.5px solid var(--border-color)',
                                        borderRadius: '10px',
                                        fontSize: '0.95rem',
                                        fontWeight: '600',
                                        cursor: submitLoading ? 'not-allowed' : 'pointer',
                                        opacity: submitLoading ? 0.7 : 1
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitLoading}
                                    style={{
                                        padding: '12px 24px',
                                        background: 'var(--primary-color)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '10px',
                                        fontSize: '0.95rem',
                                        fontWeight: '600',
                                        cursor: submitLoading ? 'not-allowed' : 'pointer',
                                        opacity: submitLoading ? 0.85 : 1
                                    }}
                                >
                                    {submitLoading ? (editingCourse ? 'Updating Course...' : 'Creating Course...') : (editingCourse ? 'Update Course' : 'Create Course')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CourseManagement;
