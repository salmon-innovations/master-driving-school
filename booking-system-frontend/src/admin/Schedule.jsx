import React, { useState, useEffect } from 'react';
import './css/schedule.css';
import './css/walkInEnrollment.css';
import './css/branch.css';
import { schedulesAPI, branchesAPI, authAPI, coursesAPI, adminAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { ConfirmModal } from './config/Modals';

const SCHEDULE_TAB_PERMISSION_MAP = {
    schedule: ['operations.schedules.manage', 'operations.schedules.tab.schedule'],
    tdc_online: ['operations.schedules.manage', 'operations.schedules.tab.tdc_online'],
    pdc_scheduling: ['operations.schedules.manage', 'operations.schedules.tab.pdc_scheduling'],
    summary: ['operations.schedules.manage', 'operations.schedules.tab.summary'],
    noshow: ['operations.schedules.manage', 'operations.schedules.tab.noshow'],
};

const normalizePermissionList = (permissions) => {
    if (!Array.isArray(permissions)) return [];
    return permissions.filter((permission) => typeof permission === 'string' && permission.trim().length > 0);
};

const parseNotesJson = (rawNotes) => {
    if (!rawNotes || typeof rawNotes !== 'string' || !rawNotes.startsWith('{')) return null;
    try {
        return JSON.parse(rawNotes);
    } catch {
        return null;
    }
};

const toInputDate = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const addDaysToDate = (dateStr, days = 0) => {
    if (!dateStr) return '';
    const d = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + Number(days || 0));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const isTwoDayPdcVariant = (course = {}) => {
    const src = `${course?.courseName || ''} ${course?.courseType || ''}`.toUpperCase();
    // If it's a PDC course, it's almost always an 8-hour course split into 2 days
    if (src.includes('PDC') || src.includes('PRACTICAL')) return true;
    if (src.includes('AUTOMATIC') || src.includes('MANUAL')) return true;
    if (src.includes('MOTOR') || src.includes('MOTORCYCLE')) return true;
    if (src.includes('CAR') || src.includes('B1') || src.includes('B2') || src.includes('VAN') || src.includes('L300')) return true;
    if (src.includes('TRICYCLE') || src.includes('V1') || src.includes('A1')) return true;
    return false;
};

const buildPdcCourseOptions = (booking, notesJson) => {
    const fromSelections = Object.entries(notesJson?.pdcSelections || {}).map(([key, value], idx) => ({
        key: String(key || `pdc_${idx + 1}`),
        courseId: value?.courseId || null,
        courseName: value?.courseName || `PDC Course ${idx + 1}`,
        courseType: value?.courseType || '',
        requiresDay2: Boolean(value?.pdcDate2 || value?.pdcSlot2 || value?.pdcSlotDetails2) || isTwoDayPdcVariant({
            courseName: value?.courseName,
            courseType: value?.courseType,
        }),
    }));

    // If pdcCourseIds is stored in notes, use it to filter courseList to only enrolled PDC courses.
    // This prevents a promo bundle's full courseList (e.g. 4 PDC types) from all appearing
    // when the student only enrolled in one specific PDC.
    const pdcCourseIdSet = (() => {
        const ids = Array.isArray(notesJson?.pdcCourseIds) ? notesJson.pdcCourseIds : [];
        const nums = ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
        return nums.length > 0 ? new Set(nums) : null;
    })();

    const fromCourseList = (Array.isArray(notesJson?.courseList) ? notesJson.courseList : [])
        .filter((item) => String(item?.category || '').toUpperCase() === 'PDC')
        // When we know exactly which PDC courses were enrolled, filter to only those.
        .filter((item) => !pdcCourseIdSet || pdcCourseIdSet.has(Number(item?.id)))
        .map((item, idx) => ({
            key: String(item?.id || `${item?.name || 'pdc'}_${idx + 1}`).toLowerCase().replace(/\s+/g, '_'),
            courseId: item?.id || null,
            courseName: item?.name || `PDC Course ${idx + 1}`,
            courseType: item?.type || '',
            requiresDay2: isTwoDayPdcVariant({ courseName: item?.name, courseType: item?.type }),
        }));

    const fromCombinedNames = String(notesJson?.combinedCourseNames || booking?.course_name || '')
        .split('+')
        .map((name) => String(name || '').trim())
        .filter(Boolean)
        .filter((name) => {
            const src = name.toUpperCase();
            if (src.includes('TDC') || src.includes('OTDC') || src.includes('THEORETICAL')) return false;
            if (src.includes('PROMO') || src.includes('BUNDLE')) return false;
            return (
                src.includes('PDC')
                || src.includes('A1')
                || src.includes('TRICYCLE')
                || src.includes('B1')
                || src.includes('B2')
                || src.includes('VAN')
                || src.includes('L300')
                || src.includes('CAR')
                || src.includes('MOTOR')
            );
        })
        .map((name, idx) => ({
            key: `combined_pdc_${idx + 1}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
            courseId: null,
            courseName: name,
            courseType: '',
            requiresDay2: isTwoDayPdcVariant({ courseName: name, courseType: '' }),
        }));

    // Strict waterfall priority: use the first source that produces results.
    // This prevents the full courseList (which may contain all 4 PDC variants for a promo bundle)
    // from appearing when a student only enrolled in one course (already in pdcSelections).
    let merged;
    if (fromSelections.length > 0) {
        merged = fromSelections;
    } else if (fromCourseList.length > 0) {
        merged = fromCourseList;
    } else {
        merged = fromCombinedNames;
    }

    const seenKeys = new Set();
    const seenNames = new Set();
    const unique = [];
    merged.forEach((item) => {
        const dedupeKey = `${String(item.key)}::${String(item.courseName).toLowerCase()}`;
        const nameKey = String(item.courseName).toLowerCase().trim()
            .replace(/\s+/g, ' ')
            .replace(/^practical driving course\s*\(pdc\)\s*-?\s*/i, '')
            .replace(/\s*-\s*(automatic|manual|mt|at|v1-tricycle|b1-van\/b2-l300)\s*$/i, '');
        if (seenKeys.has(dedupeKey) || seenNames.has(nameKey)) return;
        seenKeys.add(dedupeKey);
        seenNames.add(nameKey);
        unique.push(item);
    });

    return unique.length > 0
        ? unique
        : [{ key: 'pdc_1', courseId: null, courseName: 'PDC Course', courseType: '', requiresDay2: false }];
};

const sortSlotsFn = (slotsArr) => {
    return [...slotsArr].sort((a, b) => {
        // 1. TDC always on top
        const typeA = (a.type || '').toLowerCase();
        const typeB = (b.type || '').toLowerCase();
        if (typeA === 'tdc' && typeB !== 'tdc') return -1;
        if (typeA !== 'tdc' && typeB === 'tdc') return 1;

        // 2. Put together same Course (course_type)
        const ctA = (a.course_type || '').toLowerCase();
        const ctB = (b.course_type || '').toLowerCase();
        if (ctA < ctB) return -1;
        if (ctA > ctB) return 1;

        // 3. Put together transmission
        const transA = (a.transmission || '').toLowerCase();
        const transB = (b.transmission || '').toLowerCase();
        if (transA < transB) return -1;
        if (transA > transB) return 1;

        // 4. Sort by session
        const sessionOrder = { 'morning': 1, 'afternoon': 2, 'whole day': 3 };
        const sA = sessionOrder[(a.session || '').toLowerCase()] || 4;
        const sB = sessionOrder[(b.session || '').toLowerCase()] || 4;
        return sA - sB;
    });
};

const Schedule = ({ onNavigate, currentUserPermissions = [], currentUserRole = '', currentUserBranchId = null, navigationTarget = null }) => {
    const [todayStudents, setTodayStudents] = React.useState({ data: [], total: 0, date: '' });
    const [scheduleView, setScheduleView] = React.useState('schedule'); // 'schedule' | 'tdc_online' | 'pdc_scheduling' | 'summary' | 'noshow'
    const [noShowStudents, setNoShowStudents] = React.useState({ data: [], loading: false });
    const [tdcOnlineStudents, setTdcOnlineStudents] = React.useState({ data: [], loading: false });
    const [pdcSchedulingQueue, setPdcSchedulingQueue] = React.useState({ data: [], loading: false });
    const [summaryDate, setSummaryDate] = React.useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [summaryCourseFilter, setSummaryCourseFilter] = React.useState('');

    const [summaryStudentModal, setSummaryStudentModal] = React.useState(null); // { student: {}, scheduleInfo: {}, bookings: [], loading: true }
    const [showPdcAssignModal, setShowPdcAssignModal] = React.useState(false);
    const [pdcAssignTarget, setPdcAssignTarget] = React.useState(null);
    const [pdcAssignRows, setPdcAssignRows] = React.useState([]);
    const [pdcAssignLoading, setPdcAssignLoading] = React.useState(false);
    const [pdcAssignActiveCourseKey, setPdcAssignActiveCourseKey] = React.useState(null);
    const [pdcAssignDayMode, setPdcAssignDayMode] = React.useState('day1');
    const [pdcAssignCalendarMonth, setPdcAssignCalendarMonth] = React.useState(new Date());
    const [pdcAssignMonthSlotsMap, setPdcAssignMonthSlotsMap] = React.useState({});
    const [pdcAssignMonthLoading, setPdcAssignMonthLoading] = React.useState(false);

    const { showNotification } = useNotification();

    // Use local date for initialization to avoid UTC mismatch (e.g. previous day)
    const getLocalDateString = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const today = getLocalDateString();
    const [selectedDate, setSelectedDate] = useState(getLocalDateString()); // Auto-select today on load
    const [viewDate, setViewDate] = useState(new Date()); // For month navigation
    const [showModal, setShowModal] = useState(false);
    const [showStudentModal, setShowStudentModal] = useState(false);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, confirmText: 'Delete', isDestructive: true });
    const [feePayModal, setFeePayModal] = useState({ isOpen: false, enrollmentId: null, amount: '1000', paymentMethod: 'Cash', transactionNumber: '', context: 'noshow' });
    const [studentModalTab, setStudentModalTab] = useState('enrolled'); // 'enrolled' | 'unassigned'
    const [unassignedStudents, setUnassignedStudents] = useState([]);
    const [loadingUnassigned, setLoadingUnassigned] = useState(false);

    const [showAutoModal, setShowAutoModal] = useState(false);
    const [confirmNoShowId, setConfirmNoShowId] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [rescheduleInfo, setRescheduleInfo] = React.useState(null); // { enrollmentId, studentName, loadingSlots, slots }
    const [summaryRescheduleInfo, setSummaryRescheduleInfo] = React.useState(null); // { enrollmentId, studentName, slotId, slotType, loadingSlots, slots }
    const [rescheduleMonthFilter, setRescheduleMonthFilter] = React.useState('');
    const [summaryRescheduleMonthFilter, setSummaryRescheduleMonthFilter] = React.useState('');
    const summaryDateInputRef = React.useRef(null);
    const [editingId, setEditingId] = useState(null);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState(String(currentUserBranchId || ''));
    const [userRole, setUserRole] = useState(currentUserRole || null);

    // Keep state in sync with props from Admin.jsx
    useEffect(() => {
        if (currentUserBranchId) {
            setSelectedBranch(String(currentUserBranchId));
        }
        if (currentUserRole) {
            setUserRole(currentUserRole);
        }
    }, [currentUserBranchId, currentUserRole]);
    const [courses, setCourses] = useState([]);
    const normalizedRole = String(currentUserRole || '').toLowerCase();
    const isSuperAdmin = normalizedRole === 'super_admin';
    const permissionSet = new Set(normalizePermissionList(currentUserPermissions));
    const canAccessScheduleTab = (tabKey) => {
        if (isSuperAdmin) return true;
        const requiredPermissions = SCHEDULE_TAB_PERMISSION_MAP[tabKey] || [];
        // If no explicit permission payload is provided, keep legacy behavior by allowing tabs.
        if (permissionSet.size === 0) return true;
        return requiredPermissions.some((permission) => permissionSet.has(permission));
    };
    const allowedScheduleTabs = ['schedule', 'tdc_online', 'pdc_scheduling', 'summary', 'noshow'].filter((tabKey) => canAccessScheduleTab(tabKey));

    const fetchTdcOnlineStudents = React.useCallback(async ({ branchId } = {}) => {
        const candidate = adminAPI?.getTdcOnlineStudents;
        if (typeof candidate === 'function') {
            return await candidate({ branchId });
        }

        // Fallback path prevents UI crash if stale bundle/mismatch lacks this method.
        const fallback = schedulesAPI?.getTdcOnlineStudents;
        if (typeof fallback === 'function') {
            return await fallback({ branchId });
        }

        return { success: false, data: [] };
    }, []);

    const fetchPdcSchedulingQueue = React.useCallback(async ({ branchId } = {}) => {
        setPdcSchedulingQueue((prev) => ({ ...prev, loading: true }));
        try {
            if (typeof adminAPI?.getPdcSchedulingQueue === 'function') {
                const direct = await adminAPI.getPdcSchedulingQueue({ branchId: branchId || undefined });
                const directQueue = Array.isArray(direct?.data) ? direct.data : [];
                setPdcSchedulingQueue({ data: directQueue, loading: false });
                return;
            }

            const res = await adminAPI.getAllBookings('completed', 200, branchId || undefined);
            const rows = Array.isArray(res?.bookings) ? res.bookings : [];

            const queue = rows.map((booking) => {
                const notesJson = parseNotesJson(booking.notes || '');
                const locked = !!notesJson?.pdcScheduleLockedUntilCompletion;
                const courseList = Array.isArray(notesJson?.courseList) ? notesJson.courseList : [];
                const hasOnlineTdc = courseList.some((item) => {
                    const category = String(item?.category || '').toUpperCase();
                    const type = String(item?.type || '').toLowerCase();
                    return category === 'TDC' && (type.includes('online') || type.includes('otdc'));
                })
                    || String(booking?.course_type || '').toLowerCase().includes('online')
                    || String(booking?.course_type || '').toLowerCase().includes('otdc')
                    || String(booking?.course_name || '').toLowerCase().includes('otdc')
                    || Boolean(notesJson?.isOnlineTdcNoSchedule);
                const hasPdc = courseList.some((item) => String(item?.category || '').toUpperCase() === 'PDC') || locked;

                const completedDate = toInputDate(booking?.updated_at || booking?.created_at || null);
                const minScheduleDate = addDaysToDate(completedDate, 2);

                return {
                    id: booking.id,
                    student_name: booking.student_name,
                    student_email: booking.student_email,
                    student_contact: booking.student_contact,
                    branch_name: booking.branch_name,
                    branch_id: booking.branch_id,
                    course_name: booking.course_name,
                    course_type: booking.course_type,
                    completedDate,
                    minScheduleDate,
                    notesJson,
                    pdcCourses: buildPdcCourseOptions(booking, notesJson || {}),
                    locked,
                    hasOnlineTdc,
                    hasPdc,
                };
            }).filter((entry) => entry.hasPdc);

            setPdcSchedulingQueue({ data: queue, loading: false });
        } catch (error) {
            console.error('Failed to load PDC scheduling queue:', error);
            setPdcSchedulingQueue({ data: [], loading: false });
            showNotification('Failed to load PDC scheduling queue.', 'error');
        }
    }, [showNotification]);

    const normalizeText = React.useCallback((value) => String(value || '').toLowerCase().trim(), []);

    const resolveDesiredTransmission = React.useCallback((rowCourse) => {
        const src = `${rowCourse?.courseType || ''} ${rowCourse?.courseName || ''}`.toLowerCase();
        if (src.includes('automatic') || src.includes(' at') || src.endsWith('at')) return 'AT';
        if (src.includes('manual') || src.includes(' mt') || src.endsWith('mt')) return 'MT';

        // Bundle-level fallback: for promo bundle OTDC/F2F + 4 PDC, infer fixed tx for Car/Motor tabs.
        const rowSrc = normalizeText(`${rowCourse?.courseName || ''} ${rowCourse?.courseType || ''}`);
        const isCarOrMotor = rowSrc.includes('car') || rowSrc.includes('motor') || rowSrc.includes('motorcycle');
        if (!isCarOrMotor) return null;

        const bundleSrc = normalizeText(`${pdcAssignTarget?.course_name || ''} ${pdcAssignTarget?.course_type || ''} ${pdcAssignTarget?.notesJson?.combinedCourseNames || ''}`);
        if (bundleSrc.includes('otdc') || bundleSrc.includes('online')) return 'AT';
        if (bundleSrc.includes('f2f')) return 'MT';

        return null;
    }, [normalizeText, pdcAssignTarget]);

    const matchesPdcSlotForCourse = React.useCallback((slot, rowCourse) => {
        if (!rowCourse) return true;

        const slotCourseType = normalizeText(slot?.course_type || slot?.courseType || '');
        const slotTransmission = normalizeText(slot?.transmission || '');
        const rowSrc = normalizeText(`${rowCourse?.courseName || ''} ${rowCourse?.courseType || ''}`);

        const desiredTx = resolveDesiredTransmission(rowCourse);
        if (desiredTx === 'AT') {
            const isAuto = slotTransmission.includes('automatic') || slotTransmission === 'at' || slotCourseType.includes('automatic') || slotCourseType.includes('at');
            if (!isAuto) return false;
        }
        if (desiredTx === 'MT') {
            const isManual = slotTransmission.includes('manual') || slotTransmission === 'mt' || slotCourseType.includes('manual') || slotCourseType.includes('mt');
            if (!isManual) return false;
        }

        // If slot course type is generic/empty, transmission match above is sufficient.
        if (!slotCourseType) return true;

        const wantsTricycle = rowSrc.includes('a1') || rowSrc.includes('tricycle');
        const wantsB1B2 = rowSrc.includes('b1') || rowSrc.includes('b2') || rowSrc.includes('van') || rowSrc.includes('l300');
        const wantsCar = rowSrc.includes('car') && !wantsTricycle;
        const wantsMotor = rowSrc.includes('motor') || rowSrc.includes('motorcycle');

        if (wantsTricycle) {
            return slotCourseType.includes('a1') || slotCourseType.includes('tricycle');
        }
        if (wantsB1B2) {
            return slotCourseType.includes('b1') || slotCourseType.includes('b2') || slotCourseType.includes('van') || slotCourseType.includes('l300');
        }
        if (wantsCar) {
            return slotCourseType.includes('car');
        }
        if (wantsMotor) {
            return slotCourseType.includes('motor') || slotCourseType.includes('motorcycle');
        }

        return true;
    }, [normalizeText, resolveDesiredTransmission]);

    const fetchPdcSlotsForDate = React.useCallback(async (dateValue, branchId, rowCourse = null) => {
        if (!dateValue) return [];
        const res = await schedulesAPI.getSlotsByDate(dateValue, branchId || undefined, 'PDC');
        const rows = Array.isArray(res) ? res : (Array.isArray(res?.slots) ? res.slots : []);
        return rows
            .filter((slot) => String(slot?.type || '').toLowerCase() === 'pdc')
            .filter((slot) => Number(slot?.available_slots || 0) > 0)
            .filter((slot) => matchesPdcSlotForCourse(slot, rowCourse))
            .map((slot) => ({
                id: Number(slot.id),
                session: String(slot.session || 'Session'),
                timeRange: String(slot.time_range || ''),
                availableSlots: Number(slot.available_slots || 0),
                courseType: String(slot.course_type || ''),
                transmission: String(slot.transmission || ''),
                label: `${slot.session || 'Session'}${slot.time_range ? ` · ${slot.time_range}` : ''}${slot.available_slots != null ? ` · ${slot.available_slots} slots` : ''}`,
            }));
    }, [matchesPdcSlotForCourse]);

    const loadPdcAssignRowSlots = React.useCallback(async (rowIndex, dayKey, dateValue, branchIdOverride = null, rowModel = null) => {
        const branchId = branchIdOverride || pdcAssignTarget?.branch_id || selectedBranch || null;
        const loadingKey = dayKey === 'day2' ? 'loadingDay2' : 'loadingDay1';
        const slotsKey = dayKey === 'day2' ? 'slotsDay2' : 'slotsDay1';
        const targetRow = rowModel || pdcAssignRows[rowIndex] || null;

        setPdcAssignRows((prev) => prev.map((row, idx) => (
            idx === rowIndex ? { ...row, [loadingKey]: true } : row
        )));

        try {
            const options = await fetchPdcSlotsForDate(dateValue, branchId, targetRow);
            setPdcAssignRows((prev) => prev.map((row, idx) => (
                idx === rowIndex ? { ...row, [slotsKey]: options, [loadingKey]: false } : row
            )));
        } catch {
            setPdcAssignRows((prev) => prev.map((row, idx) => (
                idx === rowIndex ? { ...row, [slotsKey]: [], [loadingKey]: false } : row
            )));
        }
    }, [fetchPdcSlotsForDate, pdcAssignRows, pdcAssignTarget?.branch_id, selectedBranch]);

    const fetchPdcSlotsForMonth = React.useCallback(async (monthDate, branchIdOverride = null, rowModel = null) => {
        const monthBase = monthDate instanceof Date ? monthDate : new Date();
        const y = monthBase.getFullYear();
        const m = monthBase.getMonth();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const branchId = branchIdOverride || pdcAssignTarget?.branch_id || selectedBranch || null;

        const startDate = `${y}-${String(m + 1).padStart(2, '0')}-01`;
        const endDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

        setPdcAssignMonthLoading(true);
        try {
            const res = await schedulesAPI.getSlotsByDate(null, branchId, 'PDC', startDate, endDate);
            const rawSlots = Array.isArray(res) ? res : (Array.isArray(res?.slots) ? res.slots : []);
            
            const map = {};
            for (let day = 1; day <= daysInMonth; day += 1) {
                const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                
                // Keep the exact same filtering applied in fetchPdcSlotsForDate per day
                const daySlots = rawSlots
                    .filter((slot) => {
                        if (String(slot?.type || '').toLowerCase() !== 'pdc') return false;
                        if (Number(slot?.available_slots || 0) <= 0) return false;
                        
                        const sStart = slot.date?.split('T')[0];
                        const sEnd = slot.end_date ? slot.end_date.split('T')[0] : sStart;
                        return dateStr >= sStart && dateStr <= sEnd;
                    })
                    .filter((slot) => matchesPdcSlotForCourse(slot, rowModel))
                    .map((slot) => ({
                        id: Number(slot.id),
                        session: String(slot.session || 'Session'),
                        timeRange: String(slot.time_range || ''),
                        availableSlots: Number(slot.available_slots || 0),
                        courseType: String(slot.course_type || ''),
                        transmission: String(slot.transmission || ''),
                        label: `${slot.session || 'Session'}${slot.time_range ? ` · ${slot.time_range}` : ''}${slot.available_slots != null ? ` · ${slot.available_slots} slots` : ''}`,
                    }));
                
                if (daySlots.length > 0) {
                    map[dateStr] = daySlots;
                }
            }
            setPdcAssignMonthSlotsMap(map);
        } catch {
            setPdcAssignMonthSlotsMap({});
        } finally {
            setPdcAssignMonthLoading(false);
        }
    }, [pdcAssignTarget?.branch_id, selectedBranch, matchesPdcSlotForCourse]);

    const openPdcAssignModal = React.useCallback(async (queueItem) => {
        if (!queueItem) return;
        const minDate = queueItem.minScheduleDate || toInputDate(new Date());
        const initialRows = (Array.isArray(queueItem.pdcCourses) ? queueItem.pdcCourses : []).map((course) => ({
            courseKey: course.key,
            courseId: course.courseId,
            courseName: course.courseName,
            courseType: course.courseType,
            requiresDay2: !!course.requiresDay2,
            date1: minDate,
            slot1: '',
            slotsDay1: [],
            loadingDay1: false,
            date2: '',
            session1: '',
            slot2: '',
            slotsDay2: [],
            loadingDay2: false,
            session2: '',
        }));

        setPdcAssignTarget(queueItem);
        setPdcAssignRows(initialRows);
        setPdcAssignActiveCourseKey(initialRows[0]?.courseKey || null);
        setPdcAssignDayMode('day1');
        setPdcAssignCalendarMonth(minDate ? new Date(`${minDate}T00:00:00`) : new Date());
        setShowPdcAssignModal(true);

        for (let idx = 0; idx < initialRows.length; idx += 1) {
            await loadPdcAssignRowSlots(idx, 'day1', minDate, queueItem.branch_id, initialRows[idx]);
        }
    }, [loadPdcAssignRowSlots]);

    const activeRowModelContext = React.useMemo(() => {
        if (!showPdcAssignModal || !pdcAssignTarget) return null;
        const activeRow = pdcAssignRows.find((row) => row.courseKey === pdcAssignActiveCourseKey) || pdcAssignRows[0] || null;
        // Only include fields that actually affect the slot filtering process
        return activeRow ? { courseName: activeRow.courseName, courseType: activeRow.courseType } : null;
    }, [pdcAssignRows, pdcAssignActiveCourseKey, showPdcAssignModal, pdcAssignTarget]);

    const activeRowModelContextStr = JSON.stringify(activeRowModelContext);

    React.useEffect(() => {
        if (!showPdcAssignModal || !pdcAssignTarget) return;
        const activeRowMock = activeRowModelContextStr ? JSON.parse(activeRowModelContextStr) : null;
        fetchPdcSlotsForMonth(pdcAssignCalendarMonth, pdcAssignTarget.branch_id, activeRowMock);
    }, [fetchPdcSlotsForMonth, pdcAssignCalendarMonth, pdcAssignTarget, activeRowModelContextStr, showPdcAssignModal]);

    const handleConfirmPdcAssignments = React.useCallback(async () => {
        if (!pdcAssignTarget) return;
        if (!Array.isArray(pdcAssignRows) || pdcAssignRows.length === 0) {
            showNotification('No PDC courses found for assignment.', 'error');
            return;
        }

        const isHalf = (session) => {
            const s = String(session || '').toLowerCase();
            return s.includes('morning') || s.includes('afternoon') || s.includes('4 hours');
        };

        for (const row of pdcAssignRows) {
            // Skip courses with no assignment yet (partial submit allowed)
            if (!row.slot1) continue;
            const hasPartialDay2 = (row.date2 && !row.slot2) || (!row.date2 && row.slot2);
            if (hasPartialDay2) {
                showNotification(`Please complete both Day 2 date and slot for ${row.courseName}.`, 'error');
                return;
            }
            if ((row.needsDay2 || (row.requiresDay2 && isHalf(row.session1))) && (!row.date2 || !row.slot2)) {
                showNotification(`${row.courseName} requires Day 2 assignment.`, 'error');
                return;
            }
        }

        const rowsWithSlot = pdcAssignRows.filter((row) => !!row.slot1);
        if (rowsWithSlot.length === 0) {
            showNotification('Please assign at least one PDC course schedule.', 'error');
            return;
        }

        try {
            setPdcAssignLoading(true);
            const payload = rowsWithSlot.map((row) => ({
                courseKey: row.courseKey,
                courseId: row.courseId,
                courseName: row.courseName,
                courseType: row.courseType,
                pdcDate: row.date1,
                scheduleSlotId: Number(row.slot1),
                ...(row.date2 && row.slot2 ? {
                    pdcDate2: row.date2,
                    promoPdcSlotId2: Number(row.slot2),
                } : {}),
            }));

            await adminAPI.assignPdcSchedule(pdcAssignTarget.id, payload);
            setShowPdcAssignModal(false);
            setPdcAssignTarget(null);
            setPdcAssignRows([]);
            await fetchPdcSchedulingQueue({ branchId: selectedBranch || undefined });
            showNotification('PDC schedule assigned successfully. Confirmation email sent to student.', 'success');
        } catch (err) {
            showNotification(err?.message || 'Failed to assign PDC schedules.', 'error');
        } finally {
            setPdcAssignLoading(false);
        }
    }, [fetchPdcSchedulingQueue, pdcAssignRows, pdcAssignTarget, selectedBranch, showNotification]);

    // Always fetch both tab counts so badges show on initial load
    React.useEffect(() => {
        adminAPI.getTodayStudents({
            date: summaryDate,
            branchId: selectedBranch || undefined,
        }).then(res => {
            if (res && res.success) setTodayStudents(res);
        }).catch(() => {});

        setNoShowStudents(prev => ({ ...prev, loading: true }));
        schedulesAPI.getNoShowStudents({ branchId: selectedBranch || undefined })
            .then(res => { setNoShowStudents({ data: res?.data || [], loading: false }); })
            .catch(() => setNoShowStudents({ data: [], loading: false }));

        setTdcOnlineStudents(prev => ({ ...prev, loading: true }));
        fetchTdcOnlineStudents({ branchId: selectedBranch || undefined })
            .then(res => {
                const rawData = Array.isArray(res?.data) ? res.data : [];
                // Include all students who need onboarding, regardless of payment method.
                // We only filter for TDC Online or Promo Bundle course types.
                const filtered = rawData.filter(row => {
                    const isTdcOnlineOrBundle = /online|otdc|bundle|\+/i.test(row.course_name || '') || 
                                              /online|otdc/i.test(row.course_type || '');
                    return isTdcOnlineOrBundle;
                });
                setTdcOnlineStudents({ data: filtered, loading: false });
            })
            .catch(() => {
                setTdcOnlineStudents({ data: [], loading: false });
                showNotification('Failed to load TDC Online queue.', 'error');
            });
        fetchPdcSchedulingQueue({ branchId: selectedBranch || undefined });
    }, [summaryDate, selectedBranch, fetchTdcOnlineStudents, fetchPdcSchedulingQueue]);

    // Re-fetch when switching to a tab to get fresh data
    React.useEffect(() => {
        if (scheduleView === 'summary') {
            adminAPI.getTodayStudents({
                date: summaryDate,
                branchId: selectedBranch || undefined,
            }).then(res => {
                if (res && res.success) setTodayStudents(res);
            }).catch(() => {});
        }
        if (scheduleView === 'noshow') {
            setNoShowStudents(prev => ({ ...prev, loading: true }));
            schedulesAPI.getNoShowStudents({ branchId: selectedBranch || undefined })
                .then(res => { setNoShowStudents({ data: res?.data || [], loading: false }); })
                .catch(() => setNoShowStudents({ data: [], loading: false }));
        }
        if (scheduleView === 'tdc_online') {
            setTdcOnlineStudents(prev => ({ ...prev, loading: true }));
            fetchTdcOnlineStudents({ branchId: selectedBranch || undefined })
                .then(res => {
                    const rawData = Array.isArray(res?.data) ? res.data : [];
                    const filtered = rawData.filter(row => {
                        const isTdcOnlineOrBundle = /online|otdc|bundle|\+/i.test(row.course_name || '') || 
                                                  /online|otdc/i.test(row.course_type || '');
                        return isTdcOnlineOrBundle;
                    });
                    setTdcOnlineStudents({ data: filtered, loading: false });
                })
                .catch(() => {
                    setTdcOnlineStudents({ data: [], loading: false });
                    showNotification('Failed to load TDC Online queue.', 'error');
                });
        }
        if (scheduleView === 'pdc_scheduling') {
            fetchPdcSchedulingQueue({ branchId: selectedBranch || undefined });
        }
    }, [scheduleView, fetchTdcOnlineStudents, fetchPdcSchedulingQueue, selectedBranch, showNotification]);

    React.useEffect(() => {
        if (allowedScheduleTabs.length === 0) return;
        if (!allowedScheduleTabs.includes(scheduleView)) {
            setScheduleView(allowedScheduleTabs[0]);
        }
    }, [allowedScheduleTabs, scheduleView]);

    React.useEffect(() => {
        const targetView = navigationTarget?.view;
        if (!targetView) return;
        if (allowedScheduleTabs.includes(targetView) && scheduleView !== targetView) {
            setScheduleView(targetView);
        }
    }, [navigationTarget, allowedScheduleTabs, scheduleView]);

    const [formData, setFormData] = useState({
        type: 'tdc',
        time: '08:00 AM - 05:00 PM', // Default for Whole Day
        session: 'Whole Day',
        slots: 15,
        course_type: '',
        transmission: ''
    });

    const [autoData, setAutoData] = useState({
        startDate: getLocalDateString(),
        endDate: '',
        daysOfWeek: [1, 2, 3, 4, 5, 6], // Default Mon-Sat
        type: 'tdc',
        course_type: '',
        transmission: '',
        session: 'Whole Day',
        time: '08:00 AM - 05:00 PM',
        slots: 15
    });

    // Database state
    const [slots, setSlots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // API returns slots comprising the selected date (including multi-day overlaps)
    // So we can use slots directly, or filter ensuring overlap just to be safe
    // Also ensuring Sundays are ALWAYS empty (closed)
    const isSelectedSunday = () => {
        if (!selectedDate) return false;
        const [y, m, d] = selectedDate.split('-').map(Number);
        // Month is 0-indexed in JS Date
        return new Date(y, m - 1, d).getDay() === 0;
    };

    const [slotSearch, setSlotSearch] = useState('');

    const filteredSlots = (() => {
        if (isSelectedSunday()) return [];
        const base = slots.length > 0 ? slots.filter(s => {
            const sStart = s.date;
            const sEnd = s.end_date || s.date;
            const dateMatch = selectedDate >= sStart && selectedDate <= sEnd;
            if (!dateMatch) return false;
            
            // Frontend safety filter: if a specific branch is selected (required for local admins),
            // hide any slots that don't match that branch.
            if (selectedBranch && String(s.branch_id) !== String(selectedBranch)) return false;
            
            return true;
        }) : [];
        if (!slotSearch.trim()) return sortSlotsFn(base);
        const q = slotSearch.trim().toLowerCase();
        return sortSlotsFn(base.filter(s =>
            (s.type || '').toLowerCase().includes(q) ||
            (s.course_type || '').toLowerCase().includes(q) ||
            (s.transmission || '').toLowerCase().includes(q) ||
            (s.session || '').toLowerCase().includes(q) ||
            (s.sessionLabel || '').toLowerCase().includes(q) ||
            (s.time_range || s.time || '').toLowerCase().includes(q)
        ));
    })();

    // Load slots from database
    useEffect(() => {
        loadSlots();
    }, [viewDate, selectedBranch]);


    useEffect(() => {
        const fetchBranchesAndProfile = async () => {
            try {
                const response = await branchesAPI.getAll();
                let loadedBranches = response.branches || [];

                // Restrict viewing for branch-assigned admins.
                let profileBranchId = currentUserBranchId;
                let role = currentUserRole;

                if (!role || !profileBranchId) {
                    const profileRes = await authAPI.getProfile();
                    if (profileRes.success) {
                        role = profileRes.user.role;
                        profileBranchId = profileRes.user.branchId;
                        setUserRole(role);
                    }
                }

                if (role === 'admin' && profileBranchId) {
                    loadedBranches = loadedBranches.filter(b => String(b.id) === String(profileBranchId));
                    setSelectedBranch(String(profileBranchId));
                }

                // Fetch courses
                try {
                    const coursesRes = await coursesAPI.getAll();
                    if (coursesRes && coursesRes.courses) {
                        setCourses(coursesRes.courses);
                    }
                } catch (courseErr) {
                    console.error('Error fetching courses:', courseErr);
                }

                setBranches(loadedBranches);
            } catch (error) {
                console.error('Error fetching branches or profile:', error);
            }
        };
        fetchBranchesAndProfile();
    }, []);

    // Debug modal state changes
    useEffect(() => {
        console.log('showModal changed to:', showModal);
    }, [showModal]);

    const loadSlots = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const startOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
            const endOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
            
            const startDate = `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}-01`;
            const endDate = `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth() + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;

            console.log('Loading slots for month:', startDate, 'to', endDate, 'branch:', selectedBranch);
            const response = await schedulesAPI.getSlotsByDate(null, selectedBranch || null, null, startDate, endDate);
            console.log('API Response:', response);

            // Transform database data to match component structure
            const transformedSlots = response.map(slot => {
                // Formatting helper that strictly treats ISO strings as YYYY-MM-DD literals
                const formatDateSafe = (d) => {
                    if (!d) return d;
                    if (typeof d === 'string') return d.split('T')[0];
                    const date = new Date(d);
                    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                };

                const startDate = formatDateSafe(slot.date);
                const endDate = slot.end_date ? formatDateSafe(slot.end_date) : startDate;
                return {
                    ...slot,
                    date: startDate,
                    end_date: endDate,
                    // Keep raw session value intact — use sessionLabel for display only
                    sessionLabel: `${slot.session} ${slot.type?.toLowerCase() === 'tdc' ? 'TDC' : 'PDC'}${slot.course_type ? ' ' + slot.course_type.toUpperCase() : ''}`,
                    students: slot.enrollments || []
                };
            });
            console.log('Transformed slots:', transformedSlots);
            setSlots(transformedSlots);
        } catch (err) {
            console.error('Error loading slots:', err);
            setError('Failed to load slots. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const getAvailableTransmissions = (courseName) => {
        if (!courseName) return [];
        const course = courses.find(c => c.name === courseName);
        if (!course) return [];

        let available = [];
        const mainType = course.course_type || '';
        if (['manual', 'automatic'].includes(mainType.toLowerCase())) {
            available.push(mainType.charAt(0).toUpperCase() + mainType.slice(1).toLowerCase());
        }

        let pricingData = course.pricing_data;
        if (typeof pricingData === 'string') {
            try { pricingData = JSON.parse(pricingData); } catch (e) { pricingData = null; }
        }

        if (Array.isArray(pricingData)) {
            pricingData.forEach(p => {
                if (p && p.type && ['manual', 'automatic'].includes(p.type.toLowerCase())) {
                    const formattedType = p.type.charAt(0).toUpperCase() + p.type.slice(1).toLowerCase();
                    if (!available.includes(formattedType)) {
                        available.push(formattedType);
                    }
                }
            });
        }
        return available;
    };

    const isGlobalB1B2Course = (courseName) => {
        const normalized = String(courseName || '').toLowerCase();
        return ['b1', 'b2', 'van', 'l300'].some(token => normalized.includes(token));
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (name === 'slots' && value < 1 && value !== '') return;

        // Auto-set time based on session
        if (name === 'session') {
            let autoTime = '';
            if (value === 'Morning') autoTime = '08:00 AM - 12:00 PM';
            else if (value === 'Afternoon') autoTime = '01:00 PM - 05:00 PM';
            else if (value === 'Whole Day') autoTime = '08:00 AM - 05:00 PM';

            setFormData({ ...formData, [name]: value, time: autoTime });
        } else if (name === 'type') {
            if (value === 'tdc') {
                // TDC is always Whole Day — force it
                setFormData({ ...formData, [name]: value, session: 'Whole Day', time: '08:00 AM - 05:00 PM', course_type: '', transmission: '', slots: 15 });
            } else {
                // PDC: clear session so user MUST explicitly pick Morning/Afternoon/Whole Day
                setFormData({ ...formData, [name]: value, session: '', time: '', course_type: '', transmission: '' });
            }
        } else if (name === 'course_type') {
            const transmissions = getAvailableTransmissions(value);
            const isB1B2Global = formData.type === 'pdc' && isGlobalB1B2Course(value);
            setFormData({
                ...formData,
                [name]: value,
                slots: isB1B2Global ? 2 : 15,
                transmission: transmissions.length > 0 ? (transmissions.includes(formData.transmission) ? formData.transmission : transmissions[0]) : ''
            });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleAutoInputChange = (e) => {
        const { name, value, type, checked } = e.target;

        if (type === 'checkbox') {
            const dayValue = parseInt(value);
            if (checked) {
                setAutoData({ ...autoData, daysOfWeek: [...autoData.daysOfWeek, dayValue] });
            } else {
                setAutoData({ ...autoData, daysOfWeek: autoData.daysOfWeek.filter(d => d !== dayValue) });
            }
            return;
        }

        if (name === 'slots' && value < 1 && value !== '') return;

        if (name === 'session') {
            let autoTime = '';
            if (value === 'Morning') autoTime = '08:00 AM - 12:00 PM';
            else if (value === 'Afternoon') autoTime = '01:00 PM - 05:00 PM';
            else if (value === 'Whole Day') autoTime = '08:00 AM - 05:00 PM';
            setAutoData({ ...autoData, [name]: value, time: autoTime });
        } else if (name === 'type') {
            if (value === 'tdc') {
                setAutoData({ ...autoData, [name]: value, session: 'Whole Day', time: '08:00 AM - 05:00 PM', course_type: '', transmission: '', slots: 15 });
            } else {
                setAutoData({ ...autoData, [name]: value, session: '', time: '', course_type: '', transmission: '' });
            }
        } else if (name === 'course_type') {
            const transmissions = getAvailableTransmissions(value);
            const isB1B2Global = autoData.type === 'pdc' && isGlobalB1B2Course(value);
            setAutoData({
                ...autoData,
                [name]: value,
                slots: isB1B2Global ? 2 : 15,
                transmission: transmissions.length > 0 ? (transmissions.includes(autoData.transmission) ? autoData.transmission : transmissions[0]) : ''
            });
        } else {
            setAutoData({ ...autoData, [name]: value });
        }
    };

    const handleAutoGenerate = async (e) => {
        e.preventDefault();
        setIsGenerating(true);
        try {


            if (!autoData.startDate || !autoData.endDate) {
                showNotification("Please select both start and end dates.", "error");
                setIsGenerating(false);
                return;
            }

            if (autoData.startDate < today) {
                showNotification("Start date cannot be in the past.", "error");
                setIsGenerating(false);
                return;
            }

            if (autoData.daysOfWeek.length === 0) {
                showNotification("Please select at least one day of the week.", "error");
                setIsGenerating(false);
                return;
            }

            let currentDate = new Date(autoData.startDate + 'T00:00:00');
            const end = new Date(autoData.endDate + 'T23:59:59'); // Make sure end represents end of day

            let slotCount = 0;
            const todayDate = new Date(today + 'T00:00:00');

            // Collect all api calls
            const creationPromises = [];

            while (currentDate <= end) {
                const dayOfWk = currentDate.getDay();

                // Only if day is selected, it's not Sunday, and date is not in the past
                if (autoData.daysOfWeek.includes(dayOfWk) && dayOfWk !== 0 && currentDate >= todayDate) {
                    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

                    const slotPayload = {
                        date: dateStr,
                        type: autoData.type,
                        session: autoData.session,
                        time_range: autoData.time,
                        total_capacity: autoData.type === 'pdc' && isGlobalB1B2Course(autoData.course_type)
                            ? 2
                            : parseInt(autoData.slots),
                        branch_id: selectedBranch || null,
                        course_type: autoData.course_type,
                        transmission: autoData.transmission
                    };

                    creationPromises.push(schedulesAPI.createSlot(slotPayload));
                    slotCount++;

                    // TDC takes 2 dates, so skip the next valid day?
                    // Usually TDC covers 2 days per single slot entry. So if we insert one TDC on Mon, it covers Mon-Tue.
                    // Depending on preference, users might want to skip the next day for TDC, but to keep it simple, 
                    // we'll just insert exactly on the days selected. If you meant to skip, uncomment below:
                    if (autoData.type === 'tdc') {
                        currentDate.setDate(currentDate.getDate() + 1);
                        if (currentDate.getDay() === 0) currentDate.setDate(currentDate.getDate() + 1);
                    }
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }

            if (creationPromises.length === 0) {
                showNotification("No valid dates found in the selected range.", "warning");
                setIsGenerating(false);
                return;
            }

            // Await all created slots (batch)
            await Promise.allSettled(creationPromises);

            showNotification(`Successfully generated ${slotCount} slots!`, 'success');
            await loadSlots();
            setShowAutoModal(false);
        } catch (err) {
            console.error('Error generating slots:', err);
            showNotification('An error occurred while generating slots.', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDeleteSlot = async (id) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Schedule Slot',
            message: 'Are you sure you want to delete this schedule slot? This action cannot be undone.',
            confirmText: 'Delete Slot',
            isDestructive: true,
            onConfirm: async () => {
                try {
                    await schedulesAPI.deleteSlot(id);
                    showNotification('Slot deleted successfully!', 'success');
                    await loadSlots();
                } catch (err) {
                    console.error('Error deleting slot:', err);
                    showNotification(err.message || 'Failed to delete slot', 'error');
                }
            }
        });
    };

    const handleSaveSlot = async (e) => {
        e.preventDefault();
        try {


            const baseCapacity = formData.type === 'pdc' && isGlobalB1B2Course(formData.course_type)
                ? 2
                : parseInt(formData.slots);

            const slotData = {
                date: selectedDate,
                type: formData.type,
                session: formData.session,
                time_range: formData.time,
                total_capacity: baseCapacity,
                branch_id: selectedBranch || null,
                course_type: formData.course_type,
                transmission: formData.transmission
            };

            if (!editingId) {
                // Duplicate check: same date, branch, type, course_type, session, and (for PDC) transmission
                const duplicate = slots.find(s => {
                    const sStart = s.date;
                    const sEnd = s.end_date || s.date;
                    const isSameDate = selectedDate >= sStart && selectedDate <= sEnd;
                    if (!isSameDate) return false;
                    if (s.type !== formData.type) return false;
                    if ((s.course_type || '') !== (formData.course_type || '')) return false;
                    if (s.session !== formData.session) return false;
                    // For PDC, also check transmission
                    if (formData.type === 'pdc' && (s.transmission || '') !== (formData.transmission || '')) return false;
                    return true;
                });
                if (duplicate) {
                    const typeLabel = formData.type.toUpperCase();
                    const ctLabel = formData.course_type ? ` (${formData.course_type})` : '';
                    const txLabel = formData.type === 'pdc' && formData.transmission ? ` · ${formData.transmission}` : '';
                    showNotification(
                        `A ${typeLabel}${ctLabel}${txLabel} slot for the "${formData.session}" session already exists on this date. Please edit the existing slot instead.`,
                        'error'
                    );
                    return;
                }
            }

            if (editingId) {
                // Update existing slot
                const currentSlot = slots.find(s => s.id === editingId);
                const currentAvailableSlots = currentSlot?.available_slots || baseCapacity;
                const oldTotalCapacity = currentSlot?.total_capacity || baseCapacity;

                let newAvailableSlots = currentAvailableSlots;
                if (baseCapacity > oldTotalCapacity) {
                    newAvailableSlots = currentAvailableSlots + (baseCapacity - oldTotalCapacity);
                } else if (baseCapacity < oldTotalCapacity) {
                    newAvailableSlots = Math.max(0, currentAvailableSlots - (oldTotalCapacity - baseCapacity));
                }
                slotData.available_slots = newAvailableSlots;

                await schedulesAPI.updateSlot(editingId, slotData);
                showNotification('Slot updated successfully!', 'success');
            } else {
                // Create new slot — always a single entry for the selected date
                slotData.available_slots = baseCapacity;
                await schedulesAPI.createSlot(slotData);
                showNotification('Slot added successfully!', 'success');
            }

            await loadSlots();
            closeModal();
        } catch (err) {
            console.error('Error saving slot:', err);
            setError('Failed to save slot. Please try again.');
            showNotification('Error saving slot. Please try again.', 'error');
        }
    };

    const openModal = (slot = null) => {
        console.log('openModal called with:', slot);
        if (slot) {
            setEditingId(slot.id);
            // slot.session is now the RAW value ('Morning', 'Afternoon', 'Whole Day')
            // since we stopped corrupting it in loadSlots
            setFormData({
                type: slot.type,
                time: slot.time_range || slot.time,
                session: slot.session,
                slots: slot.total_capacity || slot.slots,
                course_type: slot.course_type || '', // Wait for user if empty
                transmission: slot.transmission || (slot.type === 'tdc' ? '' : 'Manual')
            });
        } else {
            setEditingId(null);
            setFormData({
                type: 'tdc',
                time: '08:00 AM - 05:00 PM',
                session: 'Whole Day',
                slots: 15,
                course_type: '',
                transmission: ''
            });
        }
        console.log('Setting showModal to true');
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingId(null);
    };

    const openStudentModal = async (slot) => {
        try {
            setSelectedSlot(slot);
            setStudentModalTab('enrolled'); // Reset to enrolled tab on open
            // Load enrollments for this slot
            const enrollments = await schedulesAPI.getSlotEnrollments(slot.id);
            if (!enrollments.error) {
                setSelectedSlot({
                    ...slot,
                    students: enrollments.map(enrollment => ({
                        id: enrollment.id,
                        name: `${enrollment.student.first_name} ${enrollment.student.last_name}`,
                        phone: enrollment.student.contact_numbers || 'N/A',
                        status: enrollment.enrollment_status,
                        reschedule_fee_paid: enrollment.reschedule_fee_paid,
                    }))
                });
            } else {
                setError('Failed to load student enrollments. Please try again.');
            }
            setShowStudentModal(true);
        } catch (err) {
            console.error('Error opening student modal:', err);
            setError('Failed to open student modal. Please try again.');
        }
    };

    const fetchUnassignedStudents = async () => {
        try {
            setLoadingUnassigned(true);
            // Pass slot_type (tdc/pdc) and course_type so backend returns the right students
            const params = new URLSearchParams();
            if (selectedSlot?.type) params.append('slot_type', selectedSlot.type.toLowerCase());
            if (selectedSlot?.course_type) params.append('course_type', selectedSlot.course_type);
            // Use the slot's own branch_id; fall back to the currently selected branch filter
            const effectiveBranchId = selectedSlot?.branch_id || selectedBranch;
            if (effectiveBranchId) params.append('branch_id', effectiveBranchId);
            const queryStr = params.toString() ? `?${params.toString()}` : '';
            const res = await schedulesAPI.getUnassignedPdcStudents(queryStr);
            if (res.success) {
                // Secondary transmission filter (manual/automatic)
                // Uses course_type_label (c.course_type from DB) for Promo students whose booking course_type is empty
                const filtered = res.students.filter(s => {
                    if (selectedSlot?.transmission && selectedSlot.transmission.toLowerCase() !== 'both' && selectedSlot.transmission.toLowerCase() !== 'any') {
                        const combinedStr = `${s.course_name || ''} ${s.course_type || ''} ${s.course_type_label || ''}`.toLowerCase();
                        return combinedStr.includes(selectedSlot.transmission.toLowerCase());
                    }
                    return true;
                });
                setUnassignedStudents(filtered);
            }
        } catch (err) {
            console.error('Error fetching unassigned:', err);
        } finally {
            setLoadingUnassigned(false);
        }
    };

    useEffect(() => {
        if (showStudentModal && studentModalTab === 'unassigned') {
            fetchUnassignedStudents();
        }
    }, [studentModalTab, showStudentModal, selectedSlot]); // Added selectedSlot to dependencies

    const handleAssignStudent = async (studentId) => {
        try {
            const res = await schedulesAPI.enrollStudent(selectedSlot.id, { student_id: studentId, enrollment_status: 'enrolled' });
            if (res.error) throw new Error(res.error);
            showNotification('Student successfully assigned to schedule!', 'success');

            // Refresh enrolled list
            const enrollments = await schedulesAPI.getSlotEnrollments(selectedSlot.id);
            if (!enrollments.error) {
                setSelectedSlot(prev => ({
                    ...prev,
                    students: enrollments.map(enrollment => ({
                        id: enrollment.id,
                        name: `${enrollment.student.first_name} ${enrollment.student.last_name}`,
                        phone: enrollment.student.contact_numbers || 'N/A',
                        status: enrollment.enrollment_status,
                        reschedule_fee_paid: enrollment.reschedule_fee_paid,
                    }))
                }));
            }

            // Refresh unassigned list
            fetchUnassignedStudents();
            loadSlots(); // Update slot capacity counters globally
        } catch (err) {
            console.error('Error assigning student:', err);
            showNotification(err.message || 'Failed to assign student', 'error');
        }
    };

    const handleAttendanceUpdate = async (enrollmentId, currentStatus) => {
        try {
            const newStatus = currentStatus === 'completed' ? 'enrolled' : 'completed';
            await schedulesAPI.updateEnrollmentStatus(enrollmentId, newStatus);
            showNotification(`Student marked as ${newStatus === 'completed' ? 'Attended' : 'Enrolled'}!`, 'success');
            // Refresh modal list immediately
            const enrollments = await schedulesAPI.getSlotEnrollments(selectedSlot.id);
            setSelectedSlot({
                ...selectedSlot,
                students: enrollments.map(enrollment => ({
                    id: enrollment.id,
                    name: `${enrollment.student.first_name} ${enrollment.student.last_name}`,
                    phone: enrollment.student.contact_numbers || 'N/A',
                    status: enrollment.enrollment_status,
                    reschedule_fee_paid: enrollment.reschedule_fee_paid,
                }))
            });
            await loadSlots(); // bg table slot counts update
        } catch (err) {
            console.error('Error updating status:', err);
            showNotification('Failed to update attendance.', 'error');
        }
    };

    const handleNoShowUpdate = (enrollmentId) => {
        setConfirmNoShowId(enrollmentId);
    };

    const executeNoShowUpdate = async () => {
        if (!confirmNoShowId) return;

        try {
            await schedulesAPI.markNoShow(confirmNoShowId);
            showNotification('Student marked as No-Show. Rescheduling Email Sent!', 'success');
            // Refresh modal list immediately
            const enrollments = await schedulesAPI.getSlotEnrollments(selectedSlot.id);
            setSelectedSlot({
                ...selectedSlot,
                students: enrollments.map(enrollment => ({
                    id: enrollment.id,
                    name: `${enrollment.student.first_name} ${enrollment.student.last_name}`,
                    phone: enrollment.student.contact_numbers || 'N/A',
                    status: enrollment.enrollment_status,
                    reschedule_fee_paid: enrollment.reschedule_fee_paid,
                }))
            });
            await loadSlots(); // bg table slot counts update
        } catch (err) {
            console.error('Error marking no show:', err);
            showNotification('Failed to process No-Show action.', 'error');
        } finally {
            setConfirmNoShowId(null);
        }
    };

    const openReschedulePanel = async (enrollmentId, studentName) => {
        setRescheduleMonthFilter('');
        setRescheduleInfo({ enrollmentId, studentName, loadingSlots: true, slots: [] });
        try {
            const res = await schedulesAPI.getSlotsByDate(null, selectedSlot.branch_id || null);
            const allSlots = Array.isArray(res) ? res : [];
            const currentType = (selectedSlot.type || '').toLowerCase();
            const currentCourseType = (selectedSlot.course_type || '').toLowerCase();
            const currentTransmission = (selectedSlot.transmission || '').toLowerCase();
            const filtered = allSlots.filter(s =>
                s.id !== selectedSlot.id &&
                s.available_slots > 0 &&
                (!currentType || (s.type || '').toLowerCase() === currentType) &&
                (!currentCourseType || (s.course_type || '').toLowerCase() === currentCourseType) &&
                (!currentTransmission || (s.transmission || '').toLowerCase() === currentTransmission)
            );
            setRescheduleInfo({ enrollmentId, studentName, loadingSlots: false, slots: filtered,
                courseLabel: [currentType.toUpperCase(), selectedSlot.course_type, selectedSlot.transmission].filter(Boolean).join(' · ') });
        } catch {
            setRescheduleInfo(prev => prev ? { ...prev, loadingSlots: false, slots: [] } : null);
        }
    };

    const confirmReschedule = async (newSlotId) => {
        try {
            const res = await schedulesAPI.rescheduleEnrollment(rescheduleInfo.enrollmentId, newSlotId);
            if (res?.error) throw new Error(res.error);
            showNotification('Student rescheduled successfully!', 'success');
            setRescheduleInfo(null);
            const enrollments = await schedulesAPI.getSlotEnrollments(selectedSlot.id);
            if (!enrollments.error) {
                setSelectedSlot(prev => ({
                    ...prev,
                    students: enrollments.map(e => ({
                        id: e.id,
                        name: `${e.student.first_name} ${e.student.last_name}`,
                        phone: e.student.contact_numbers || 'N/A',
                        status: e.enrollment_status,
                        reschedule_fee_paid: e.reschedule_fee_paid,
                    }))
                }));
            }
            await loadSlots();
        } catch (err) {
            showNotification(err.message || 'Failed to reschedule student', 'error');
        }
    };

    const openFeePayModal = (enrollmentId, context, slotType) => {
        const amount = (slotType || '').toLowerCase() === 'tdc' ? '300' : '1000';
        setFeePayModal({ isOpen: true, enrollmentId, amount, paymentMethod: 'Cash', transactionNumber: '', context });
    };

    const confirmFeePayment = async () => {
        const { enrollmentId, context, amount, paymentMethod, transactionNumber } = feePayModal;
        setFeePayModal(prev => ({ ...prev, isOpen: false }));
        try {
            const res = await schedulesAPI.markFeePaid(enrollmentId, amount, paymentMethod, transactionNumber);
            if (res?.error) throw new Error(res.error);
            showNotification('Rescheduling fee marked as paid!', 'success');
            if (context === 'manage') {
                const enrollments = await schedulesAPI.getSlotEnrollments(selectedSlot.id);
                if (!enrollments.error) {
                    setSelectedSlot(prev => ({
                        ...prev,
                        students: enrollments.map(e => ({
                            id: e.id,
                            name: `${e.student.first_name} ${e.student.last_name}`,
                            phone: e.student.contact_numbers || 'N/A',
                            status: e.enrollment_status,
                            reschedule_fee_paid: e.reschedule_fee_paid,
                        }))
                    }));
                }
            } else if (context === 'summary') {
                setSummaryStudentModal(prev => prev ? {
                    ...prev,
                    scheduleInfo: { ...prev.scheduleInfo, reschedule_fee_paid: true },
                } : null);
                adminAPI.getTodayStudents({ date: summaryDate, branchId: selectedBranch || undefined })
                    .then(res => { if (res?.success) setTodayStudents(res); }).catch(() => {});
            } else {
                // noshow tab
                setNoShowStudents(prev => ({
                    ...prev,
                    data: prev.data.map(r => r.enrollment_id === enrollmentId ? { ...r, reschedule_fee_paid: true } : r),
                }));
            }
        } catch (err) {
            showNotification(err.message || 'Failed to mark fee as paid', 'error');
        }
    };

    const handleMarkFeePaid = (enrollmentId) => openFeePayModal(enrollmentId, 'manage', selectedSlot?.type);

    // ── Summary modal action handlers ──
    const handleSummaryAttendance = async (enrollmentId, currentStatus) => {
        try {
            const newStatus = currentStatus === 'completed' ? 'enrolled' : 'completed';
            await schedulesAPI.updateEnrollmentStatus(enrollmentId, newStatus);
            showNotification(`Student marked as ${newStatus === 'completed' ? 'Completed' : 'Enrolled'}!`, 'success');
            setSummaryStudentModal(prev => prev ? {
                ...prev,
                scheduleInfo: { ...prev.scheduleInfo, status: newStatus },
            } : null);
            adminAPI.getTodayStudents({ date: summaryDate, branchId: selectedBranch || undefined })
                .then(res => { if (res?.success) setTodayStudents(res); }).catch(() => {});
        } catch (err) {
            showNotification('Failed to update attendance.', 'error');
        }
    };

    const handleSummaryNoShow = (enrollmentId, studentName) => {
        setConfirmModal({
            isOpen: true,
            title: 'Mark as No-Show',
            message: `Mark ${studentName} as No-Show? This will free their slot and send a rescheduling fee notification.`,
            confirmText: 'Mark No-Show',
            isDestructive: true,
            onConfirm: async () => {
                try {
                    await schedulesAPI.markNoShow(enrollmentId);
                    showNotification('Student marked as No-Show. Notification sent!', 'success');
                    setSummaryStudentModal(null);
                    adminAPI.getTodayStudents({ date: summaryDate, branchId: selectedBranch || undefined })
                        .then(res => { if (res?.success) setTodayStudents(res); }).catch(() => {});
                } catch (err) {
                    showNotification('Failed to process No-Show action.', 'error');
                }
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
            },
        });
    };

    const openSummaryReschedulePanel = async (enrollmentId, studentName, slotId, slotType, branchId, courseType, transmission) => {
        setSummaryRescheduleMonthFilter('');
        setSummaryRescheduleInfo({ enrollmentId, studentName, slotId, slotType, branchId, loadingSlots: true, slots: [] });
        try {
            const res = await schedulesAPI.getSlotsByDate(null, branchId || null);
            const allSlots = Array.isArray(res) ? res : [];
            const currentType = (slotType || '').toLowerCase();
            const currentCourseType = (courseType || '').toLowerCase();
            const currentTransmission = (transmission || '').toLowerCase();
            const filtered = allSlots.filter(s =>
                s.id !== slotId &&
                s.available_slots > 0 &&
                (!currentType || (s.type || '').toLowerCase() === currentType) &&
                (!currentCourseType || (s.course_type || '').toLowerCase() === currentCourseType) &&
                (!currentTransmission || (s.transmission || '').toLowerCase() === currentTransmission)
            );
            setSummaryRescheduleInfo(prev => prev ? { ...prev, loadingSlots: false, slots: filtered,
                courseLabel: [currentType.toUpperCase(), courseType, transmission].filter(Boolean).join(' · ') } : null);
        } catch {
            setSummaryRescheduleInfo(prev => prev ? { ...prev, loadingSlots: false, slots: [] } : null);
        }
    };

    const confirmSummaryReschedule = async (newSlotId) => {
        try {
            const res = await schedulesAPI.rescheduleEnrollment(summaryRescheduleInfo.enrollmentId, newSlotId);
            if (res?.error) throw new Error(res.error);
            showNotification('Student rescheduled successfully!', 'success');
            setSummaryRescheduleInfo(null);
            setSummaryStudentModal(null);
            adminAPI.getTodayStudents({ date: summaryDate, branchId: selectedBranch || undefined })
                .then(res => { if (res?.success) setTodayStudents(res); }).catch(() => {});
            // Also refresh no-show list in case we rescheduled from that tab
            schedulesAPI.getNoShowStudents({ branchId: selectedBranch || undefined })
                .then(res => setNoShowStudents({ data: res?.data || [], loading: false })).catch(() => {});
            await loadSlots();
        } catch (err) {
            showNotification(err.message || 'Failed to reschedule student', 'error');
        }
    };

    const handleSummaryMarkFeePaid = (enrollmentId) => openFeePayModal(enrollmentId, 'summary', summaryStudentModal.scheduleInfo?.type);

    const openStudentSummaryModal = (scheduleInfo) => {
        setSummaryStudentModal({ loading: true, scheduleInfo });
        setSummaryRescheduleInfo(null);
        adminAPI.getStudentDetail(scheduleInfo.student_id)
            .then(res => {
                if (res?.success) {
                    setSummaryStudentModal({ loading: false, scheduleInfo, student: res.student, bookings: res.bookings });
                } else {
                    setSummaryStudentModal(null);
                }
            })
            .catch(() => setSummaryStudentModal(null));
    };

    const handleTdcOnlineMarkDone = async (bookingId) => {
        try {
            if (!bookingId) return;

            // Updated to pass isTdcOnlineOnboarded: true. We don't change the status here, 
            // unless it's already completed. But usually it's 'paid' or 'in-progress'.
            // We'll keep the current status as is.
            await adminAPI.updateBookingStatus(bookingId, null, { isTdcOnlineOnboarded: true });
            showNotification('TDC Online account setup marked as done.', 'success');

            // Dispatch event to Admin.jsx so it marks the notification as read and stops alerts/reminders
            window.dispatchEvent(new CustomEvent('mds-mark-notification-read', { detail: { id: String(bookingId) } }));

            // Update the local state to reflect the onboarded flag without removing the row
            setTdcOnlineStudents(prev => ({
                ...prev,
                data: prev.data.map((row) => {
                    if (row.booking_id === bookingId) {
                        try {
                            const currentNotes = row.notes ? JSON.parse(row.notes) : {};
                            return { ...row, notes: JSON.stringify({ ...currentNotes, tdcOnlineOnboarded: true }) };
                        } catch (e) {
                            return { ...row, notes: JSON.stringify({ tdcOnlineOnboarded: true }) };
                        }
                    }
                    return row;
                }),
            }));

            await Promise.all([
                fetchTdcOnlineStudents({ branchId: selectedBranch || undefined })
                    .then(res => {
                        const rawData = Array.isArray(res?.data) ? res.data : [];
                        const filtered = rawData.filter(row => {
                            const isTdcOnlineOrBundle = /online|otdc|bundle|\+/i.test(row.course_name || '') || 
                                                      /online|otdc/i.test(row.course_type || '');
                            return isTdcOnlineOrBundle;
                        });
                        setTdcOnlineStudents({ data: filtered, loading: false });
                    })
                    .catch(() => setTdcOnlineStudents({ data: [], loading: false })),
                fetchPdcSchedulingQueue({ branchId: selectedBranch || undefined }),
            ]);

            // Update modal state so the "Mark Done" button disappears
            setSummaryStudentModal(prev => prev ? {
                ...prev,
                scheduleInfo: {
                    ...prev.scheduleInfo,
                    notes: JSON.stringify({
                        ...parseNotesJson(prev.scheduleInfo?.notes),
                        tdcOnlineOnboarded: true,
                    })
                }
            } : null);
        } catch (err) {
            showNotification(err?.message || 'Failed to mark TDC Online as done.', 'error');
        }
    };

    const handleTdcOnlineMarkComplete = async (bookingId, currentStatus) => {
        try {
            if (!bookingId) return;
            const nextStatus = currentStatus === 'completed' ? 'in-progress' : 'completed';
            
            await adminAPI.updateBookingStatus(bookingId, nextStatus);
            showNotification(`TDC Online student marked as ${nextStatus}!`, 'success');

            // Optionally also mark notification as read if not already
            window.dispatchEvent(new CustomEvent('mds-mark-notification-read', { detail: { id: String(bookingId) } }));

            setSummaryStudentModal(prev => prev ? {
                ...prev,
                scheduleInfo: {
                    ...prev.scheduleInfo,
                    booking_status: nextStatus,
                    status: nextStatus,
                }
            } : null);
            
            fetchTdcOnlineStudents({ branchId: selectedBranch || undefined });
        } catch (err) {
            showNotification(err?.message || 'Failed to update course completion status.', 'error');
        }
    };

    // Calculate day offset for display (e.g. Day 2 of 2)
    // Calculate day offset for display (e.g. Day 2 of 2)
    // Calculate day offset for display (e.g. Day 2 of 2), skipping Sundays
    const getDayInfo = (slot, viewDateStr) => {
        if (!slot.end_date || slot.date === slot.end_date) return null;

        // Use strict string date parsing
        const parseDate = (d) => {
            const [y, m, dstr] = d.split('-').map(Number);
            return new Date(y, m - 1, dstr); // Local midnight
        };

        const start = parseDate(slot.date);
        const current = parseDate(viewDateStr);
        const end = parseDate(slot.end_date);

        // Helper to count valid days (excluding Sundays)
        const countValidDays = (startDate, targetDate) => {
            let count = 0;
            let d = new Date(startDate);
            while (d <= targetDate) {
                if (d.getDay() !== 0) count++; // Count if not Sunday
                d.setDate(d.getDate() + 1);
            }
            return count;
        };

        const currentDayNum = countValidDays(start, current);
        const totalDaysNum = countValidDays(start, end);

        // If current day is 0 (e.g. looking at a date before start?), return null
        if (currentDayNum < 1) return null;

        return `Day ${currentDayNum} of ${totalDaysNum}`;
    };

    return (
        <div className="schedule-module">

            {/* Top Branch Filter Bar */}
            <div className="branch-filter-bar">
                <div className="branch-filter-left">
                    <div className="branch-filter-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                        </svg>
                    </div>
                    <div className="branch-filter-text">
                        <span className="branch-filter-label">Viewing Branch</span>
                        <span className="branch-filter-value">
                            {selectedBranch
                                ? (() => {
                                    const b = branches.find(br => String(br.id) === String(selectedBranch));
                                    if (!b) return 'Selected Branch';
                                    let name = b.name;
                                    const prefixes = ['Master Driving School ', 'Master Prime Driving School ', 'Masters Prime Holdings Corp. ', 'Master Prime Holdings Corp. '];
                                    for (const prefix of prefixes) {
                                        if (name.startsWith(prefix)) { name = name.substring(prefix.length); break; }
                                    }
                                    return name;
                                })()
                                : 'All Branches'}
                        </span>
                    </div>
                </div>
                <div className="branch-filter-right">
                    <span className="branch-filter-count">{branches.length} Branches</span>
                    <select
                        className="branch-filter-select"
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        disabled={userRole === 'admin' && !!selectedBranch && branches.length === 1}
                    >
                        {!(userRole === 'admin' && branches.length === 1) && <option value="">All Branches / Default View</option>}
                        {branches.map(branch => {
                            let formattedName = branch.name;
                            const prefixes = ['Master Driving School ', 'Master Prime Driving School ', 'Masters Prime Holdings Corp. ', 'Master Prime Holdings Corp. '];
                            for (const prefix of prefixes) {
                                if (formattedName.startsWith(prefix)) {
                                    formattedName = formattedName.substring(prefix.length);
                                    break;
                                }
                            }
                            return <option key={branch.id} value={branch.id}>{formattedName}</option>
                        })}
                    </select>
                </div>
            </div>

            {/* Tab bar */}
            <div className="schedule-tabs-bar" style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                borderBottom: '2px solid var(--border-color, #e2e8f0)',
                background: 'var(--card-bg, #fff)',
                borderRadius: '16px 16px 0 0',
                padding: '0 24px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}>
                {canAccessScheduleTab('schedule') && (
                    <button
                        className={`cfg-tab-btn${scheduleView === 'schedule' ? ' active' : ''}`}
                        onClick={() => setScheduleView('schedule')}
                        style={{ marginBottom: '-2px' }}
                    >
                        <span className="cfg-tab-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        </span>
                        <span className="tab-label">Schedule</span>
                    </button>
                )}
                {canAccessScheduleTab('tdc_online') && (
                    <button
                        className={`cfg-tab-btn${scheduleView === 'tdc_online' ? ' active' : ''}`}
                        onClick={() => setScheduleView('tdc_online')}
                        style={{ marginBottom: '-2px' }}
                    >
                        <span className="cfg-tab-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                        </span>
                        <span className="tab-label">TDC Online</span>
                        {(() => {
                            const badgeCount = tdcOnlineStudents.data.filter(s => {
                                try { return !(s.notes ? JSON.parse(s.notes) : {}).tdcOnlineOnboarded; } catch(e) { return true }
                            }).length;
                            return !tdcOnlineStudents.loading && badgeCount > 0 ? (
                                <span style={{
                                    marginLeft: '6px',
                                    background: scheduleView === 'tdc_online' ? 'var(--primary-color, #1a56db)' : '#e0e7ff',
                                    color: scheduleView === 'tdc_online' ? '#fff' : 'var(--primary-color, #1a56db)',
                                    borderRadius: '20px', padding: '1px 8px',
                                    fontSize: '0.72rem', fontWeight: 700, lineHeight: '1.5',
                                }}>{badgeCount}</span>
                            ) : null;
                        })()}
                    </button>
                )}
                {canAccessScheduleTab('pdc_scheduling') && (
                    <button
                        className={`cfg-tab-btn${scheduleView === 'pdc_scheduling' ? ' active' : ''}`}
                        onClick={() => setScheduleView('pdc_scheduling')}
                        style={{ marginBottom: '-2px' }}
                    >
                        <span className="cfg-tab-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg>
                        </span>
                        <span className="tab-label">PDC Scheduling</span>
                        {!pdcSchedulingQueue.loading && pdcSchedulingQueue.data.length > 0 && (
                            <span style={{
                                marginLeft: '6px',
                                background: scheduleView === 'pdc_scheduling' ? 'var(--primary-color, #1a56db)' : '#e0e7ff',
                                color: scheduleView === 'pdc_scheduling' ? '#fff' : 'var(--primary-color, #1a56db)',
                                borderRadius: '20px', padding: '1px 8px',
                                fontSize: '0.72rem', fontWeight: 700, lineHeight: '1.5',
                            }}>{pdcSchedulingQueue.data.length}</span>
                        )}
                    </button>
                )}
                {canAccessScheduleTab('summary') && (
                    <button
                        className={`cfg-tab-btn${scheduleView === 'summary' ? ' active' : ''}`}
                        onClick={() => setScheduleView('summary')}
                        style={{ marginBottom: '-2px' }}
                    >
                        <span className="cfg-tab-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        </span>
                        <span className="tab-label">Student Summary</span>
                        {todayStudents.total > 0 && (
                            <span style={{
                                marginLeft: '6px',
                                background: scheduleView === 'summary' ? 'var(--primary-color, #1a56db)' : '#e0e7ff',
                                color: scheduleView === 'summary' ? '#fff' : 'var(--primary-color, #1a56db)',
                                borderRadius: '20px', padding: '1px 8px',
                                fontSize: '0.72rem', fontWeight: 700, lineHeight: '1.5',
                            }}>{todayStudents.total}</span>
                        )}
                    </button>
                )}
                {canAccessScheduleTab('noshow') && (
                    <button
                        className={`cfg-tab-btn${scheduleView === 'noshow' ? ' active' : ''}`}
                        onClick={() => setScheduleView('noshow')}
                        style={{ marginBottom: '-2px' }}
                    >
                        <span className="cfg-tab-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                        </span>
                        <span className="tab-label">No-Show Students</span>
                        {!noShowStudents.loading && noShowStudents.data.length > 0 && (
                            <span style={{
                                marginLeft: '6px',
                                background: scheduleView === 'noshow' ? '#ef4444' : '#fee2e2',
                                color: scheduleView === 'noshow' ? '#fff' : '#b91c1c',
                                borderRadius: '20px', padding: '1px 8px',
                                fontSize: '0.72rem', fontWeight: 700, lineHeight: '1.5',
                            }}>{noShowStudents.data.length}</span>
                        )}
                    </button>
                )}
            </div>

            {allowedScheduleTabs.length === 0 && (
                <div style={{
                    marginTop: '12px',
                    marginBottom: '14px',
                    border: '1px solid #fecaca',
                    background: '#fef2f2',
                    color: '#991b1b',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    fontSize: '0.85rem',
                    fontWeight: 600
                }}>
                    No Schedule tabs are enabled for this account.
                </div>
            )}

            {scheduleView === 'noshow' ? (
                /* No-Show Students view */
                <div className="noshow-view">
                    {/* Header row */}
                    <div className="noshow-header">
                        <div className="noshow-title-area">
                            <div className="noshow-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                            </div>
                            <div>
                                <div className="noshow-title">No-Show Students</div>
                                <div className="noshow-subtitle">Students who missed their scheduled session</div>
                            </div>
                        </div>
                        <button
                            className="noshow-refresh-btn"
                            onClick={() => {
                                setNoShowStudents(prev => ({ ...prev, loading: true }));
                                schedulesAPI.getNoShowStudents({ branchId: selectedBranch || undefined })
                                    .then(res => setNoShowStudents({ data: res?.data || [], loading: false }))
                                    .catch(() => setNoShowStudents({ data: [], loading: false }));
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                            Refresh
                        </button>
                    </div>

                    {noShowStudents.loading ? (
                        <div className="noshow-loading">
                            <div className="noshow-loading-spinner" />
                            <div className="noshow-loading-text">Loading no-show students…</div>
                        </div>
                    ) : noShowStudents.data.length === 0 ? (
                        <div className="noshow-empty">
                            <div className="noshow-empty-icon">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2.2"><path d="M20 6L9 17l-5-5"/></svg>
                            </div>
                            <div className="noshow-empty-title">No no-show students found</div>
                            <div className="noshow-empty-text">All students attended their sessions — great news!</div>
                        </div>
                    ) : (
                        <div className="admin-table-responsive noshow-table-wrap">
                            <table className="noshow-data-table">
                                <thead>
                                    <tr>
                                        {['Student', 'Email', 'Slot Date', 'Type', 'Branch', 'No-Show Date', 'Fee Status', 'Actions'].map(h => (
                                            <th key={h}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {noShowStudents.data.map((s, i) => (
                                        <tr key={s.enrollment_id} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--hover-bg, #fafafa)' }}>
                                            <td data-label="Student">
                                                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-color)' }}>{s.first_name} {s.last_name}</div>
                                            </td>
                                            <td data-label="Email" style={{ color: 'var(--secondary-text)' }}>{s.email}</td>
                                            <td data-label="Slot Date" style={{ whiteSpace: 'nowrap', color: 'var(--text-color)' }}>
                                                {(!s.slot_end_date || s.slot_date === s.slot_end_date)
                                                    ? new Date(s.slot_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                    : `${new Date(s.slot_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(s.slot_end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                                            </td>
                                            <td data-label="Type">
                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: (s.type || '').toLowerCase() === 'tdc' ? '#dbeafe' : '#f3e8ff', color: (s.type || '').toLowerCase() === 'tdc' ? '#1d4ed8' : '#7c3aed' }}>
                                                    {s.course_type || s.type}
                                                </span>
                                            </td>
                                            <td data-label="Branch" style={{ color: 'var(--secondary-text)' }}>{s.branch_name || '—'}</td>
                                            <td data-label="No-Show Date" style={{ color: 'var(--secondary-text)', whiteSpace: 'nowrap' }}>
                                                {new Date(s.no_show_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </td>
                                            <td data-label="Fee Status">
                                                {s.reschedule_fee_paid
                                                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>
                                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                                        Fee Paid
                                                      </span>
                                                    : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }}>
                                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                                        Unpaid
                                                      </span>
                                                }
                                            </td>
                                            <td data-label="Actions">
                                                <div className="noshow-action-group">
                                                    {!s.reschedule_fee_paid && (
                                                        <button
                                                            className="noshow-btn noshow-btn-fee"
                                                            onClick={() => openFeePayModal(s.enrollment_id, 'noshow', s.type)}
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                                                            Mark Fee Paid
                                                        </button>
                                                    )}
                                                    <button
                                                        className="noshow-btn noshow-btn-reschedule"
                                                        onClick={() => s.reschedule_fee_paid
                                                            ? openSummaryReschedulePanel(s.enrollment_id, `${s.first_name} ${s.last_name}`, s.slot_id, s.type, s.branch_id, s.course_type, s.transmission)
                                                            : null
                                                        }
                                                        disabled={!s.reschedule_fee_paid}
                                                        title={!s.reschedule_fee_paid ? 'Mark fee paid first' : 'Reschedule student'}
                                                    >
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                                                        Reschedule
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : scheduleView === 'tdc_online' ? (
                <div style={{
                    background: 'var(--card-bg, #fff)',
                    borderRadius: '0 0 16px 16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    padding: '24px 28px 30px',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderTop: 'none',
                }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        marginBottom: '16px', gap: '10px', flexWrap: 'wrap',
                    }}>
                        <div>
                            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-color)' }}>TDC Online Enrollees</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--secondary-text)', marginTop: '2px' }}>
                                Students waiting for online provider account setup
                            </div>
                        </div>
                        <button
                            className="noshow-refresh-btn"
                            onClick={() => {
                                setTdcOnlineStudents(prev => ({ ...prev, loading: true }));
                                fetchTdcOnlineStudents({ branchId: selectedBranch || undefined })
                                    .then(res => {
                                        const rawData = Array.isArray(res?.data) ? res.data : [];
                                        const filtered = rawData.filter(row => {
                                            const isTdcOnlineOrBundle = /online|otdc|bundle|\+/i.test(row.course_name || '') || 
                                                                      /online|otdc/i.test(row.course_type || '');
                                            return isTdcOnlineOrBundle;
                                        });
                                        setTdcOnlineStudents({ data: filtered, loading: false });
                                    })
                                    .catch(() => {
                                        setTdcOnlineStudents({ data: [], loading: false });
                                        showNotification('Failed to load TDC Online queue.', 'error');
                                    });
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                            Refresh
                        </button>
                    </div>

                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        marginBottom: '18px', padding: '12px 14px',
                        border: '1px solid var(--border-color, #e2e8f0)',
                        borderRadius: '10px', background: 'var(--hover-bg, #f8fafc)'
                    }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--secondary-text)' }}>
                            {selectedBranch ? (branches.find(b => String(b.id) === String(selectedBranch))?.name || 'Selected Branch') : 'All Branches'}
                        </div>
                        <div style={{
                            padding: '3px 11px', borderRadius: '20px',
                            background: '#e0e7ff', color: '#1d4ed8',
                            fontSize: '0.78rem', fontWeight: 700,
                        }}>
                            {tdcOnlineStudents.data.length} record{tdcOnlineStudents.data.length !== 1 ? 's' : ''}
                        </div>
                    </div>

                    {tdcOnlineStudents.loading ? (
                        <div className="noshow-loading">
                            <div className="noshow-loading-spinner" />
                            <div className="noshow-loading-text">Loading TDC Online students…</div>
                        </div>
                    ) : tdcOnlineStudents.data.length === 0 ? (
                        <div className="noshow-empty">
                            <div className="noshow-empty-icon">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2.2"><path d="M20 6L9 17l-5-5"/></svg>
                            </div>
                            <div className="noshow-empty-title">No active TDC Online enrollments</div>
                            <div className="noshow-empty-text">New online enrollments will appear here for provider onboarding.</div>
                        </div>
                    ) : (
                        <div className="admin-table-responsive table-wrapper">
                            <table className="custom-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Student Name</th>
                                        <th>Contact</th>
                                        <th>Course</th>
                                        <th>Enrolled On</th>
                                        <th>Branch</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tdcOnlineStudents.data.map((row, index) => (
                                        <tr key={row.booking_id} className="table-row-hover">
                                            <td style={{ width: '40px', color: 'var(--secondary-text)', fontWeight: 600 }}>{index + 1}</td>
                                            <td>
                                                <div className="student-cell">
                                                    <div className="student-avatar">{row.student_name?.charAt(0)?.toUpperCase() || '?'}</div>
                                                    <div>
                                                        <span className="student-name">{row.student_name || '—'}</span>
                                                        {row.email && <div style={{ fontSize: '0.75rem', color: 'var(--secondary-text)', marginTop: '1px' }}>{row.email}</div>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ fontSize: '0.82rem' }}>{row.contact_numbers || '—'}</td>
                                            <td style={{ fontSize: '0.82rem' }}>
                                                {row.course_name || 'TDC'} 
                                                {row.course_type && !String(row.course_name || '').toLowerCase().includes('bundle') ? ` (${row.course_type})` : ''}
                                            </td>
                                            <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                                                {row.created_at ? new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                            </td>
                                            <td style={{ fontSize: '0.82rem' }}>{row.branch_name || '—'}</td>
                                            <td>
                                                <span className={`status-badge ${String(row.booking_status || '').toLowerCase() === 'completed' ? 'full' : 'down'}`}>
                                                    {String(row.booking_status || '').toLowerCase() === 'completed' ? 'Completed' : 'In Progress'}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                    <button
                                                        onClick={() => openStudentSummaryModal({
                                                            source: 'tdc_online',
                                                            student_id: row.student_id,
                                                            booking_id: row.booking_id,
                                                            status: row.booking_status,
                                                            booking_status: row.booking_status,
                                                            course_type: row.course_type || 'TDC Online',
                                                            type: 'tdc',
                                                            branch_id: row.branch_id,
                                                            branch_name: row.branch_name,
                                                            created_at: row.created_at,
                                                            payment_type: row.payment_type,
                                                            payment_method: row.payment_method,
                                                            total_amount: row.total_amount,
                                                            name: row.student_name,
                                                            email: row.email,
                                                            contact: row.contact_numbers,
                                                        })}
                                                        style={{
                                                            background: 'var(--primary-color, #1a56db)', color: '#fff',
                                                            border: 'none', borderRadius: '7px', padding: '5px 14px',
                                                            fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                        }}
                                                    >
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                                        View Details
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : scheduleView === 'pdc_scheduling' ? (
                <div style={{
                    background: 'var(--card-bg, #fff)',
                    borderRadius: '0 0 16px 16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    padding: '24px 28px 30px',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderTop: 'none',
                }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        marginBottom: '16px', gap: '10px', flexWrap: 'wrap',
                    }}>
                        <div>
                            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-color)' }}>PDC Scheduling Queue</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--secondary-text)', marginTop: '2px' }}>
                                OTDC-completed students waiting for Admin/Superadmin PDC schedule assignment
                            </div>
                        </div>
                        <button
                            className="noshow-refresh-btn"
                            onClick={() => fetchPdcSchedulingQueue({ branchId: selectedBranch || undefined })}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                            Refresh
                        </button>
                    </div>

                    {pdcSchedulingQueue.loading ? (
                        <div className="noshow-loading">
                            <div className="noshow-loading-spinner" />
                            <div className="noshow-loading-text">Loading PDC scheduling queue…</div>
                        </div>
                    ) : pdcSchedulingQueue.data.length === 0 ? (
                        <div className="noshow-empty">
                            <div className="noshow-empty-icon">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2.2"><path d="M20 6L9 17l-5-5"/></svg>
                            </div>
                            <div className="noshow-empty-title">No students in PDC scheduling queue</div>
                            <div className="noshow-empty-text">Students will appear here after OTDC is marked complete.</div>
                        </div>
                    ) : (
                        <div className="admin-table-responsive table-wrapper">
                            <table className="custom-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Student</th>
                                        <th>Bundle</th>
                                        <th>PDC Courses</th>
                                        <th>OTDC Completed</th>
                                        <th>Earliest PDC Date</th>
                                        <th>Branch</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pdcSchedulingQueue.data.map((row, index) => (
                                        <tr key={row.id} className="table-row-hover">
                                            <td style={{ width: '40px', color: 'var(--secondary-text)', fontWeight: 600 }}>{index + 1}</td>
                                            <td>
                                                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-color)' }}>{row.student_name || '—'}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--secondary-text)' }}>{row.student_email || '—'}</div>
                                            </td>
                                            <td style={{ fontSize: '0.82rem' }}>
                                                {row.course_name || 'Promo Bundle'} 
                                                {(row.course_type && row.course_type.toLowerCase() !== 'bundle' && !String(row.course_name || '').includes('(Bundle)')) ? ` (${row.course_type})` : ''}
                                            </td>
                                            <td style={{ fontSize: '0.82rem' }}>{row.pdcCourses.map((c) => c.courseName).join(', ')}</td>
                                            <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{row.completedDate || '—'}</td>
                                            <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                    fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px',
                                                    borderRadius: '20px', background: '#eef2ff', color: '#3730a3', border: '1px solid #c7d2fe',
                                                }}>{row.minScheduleDate || '—'}</span>
                                            </td>
                                            <td style={{ fontSize: '0.82rem' }}>{row.branch_name || '—'}</td>
                                            <td>
                                                <button
                                                    onClick={() => openPdcAssignModal(row)}
                                                    style={{
                                                        background: 'var(--primary-color, #1a56db)', color: '#fff', border: 'none',
                                                        borderRadius: '7px', padding: '5px 14px', fontSize: '0.8rem', fontWeight: 600,
                                                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                    }}
                                                >
                                                    Set Schedule
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : scheduleView === 'summary' ? (
                /* Student Summary view */
                <div style={{
                    background: 'var(--card-bg, #fff)',
                    borderRadius: '0 0 16px 16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    padding: '28px 28px 32px',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderTop: 'none',
                }}>
                    {/* Date navigation */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '20px' }}>
                        {/* Prev button */}
                        <button
                            onClick={() => {
                                const [y, m, d] = summaryDate.split('-').map(Number);
                                const dt = new Date(y, m - 1, d);
                                dt.setDate(dt.getDate() - 1);
                                setSummaryDate(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`);
                                setSummaryCourseFilter('');
                            }}
                            style={{ height: '40px', background: '#fff', border: '1.5px solid var(--border-color, #e2e8f0)', borderRadius: '10px', padding: '0 16px', cursor: 'pointer', fontWeight: 600, color: 'var(--text-color)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px', transition: 'border-color 0.15s, background 0.15s', flexShrink: 0 }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary-color, #1a56db)'; e.currentTarget.style.background = '#eff6ff'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color, #e2e8f0)'; e.currentTarget.style.background = '#fff'; }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                            Prev
                        </button>

                        {/* Date picker pill — clicking opens the native date picker */}
                        <div
                            onClick={() => summaryDateInputRef.current?.showPicker?.()}
                            style={{ position: 'relative', height: '40px', display: 'flex', alignItems: 'center', gap: '8px', background: '#eff6ff', border: '1.5px solid var(--primary-color, #1a56db)', borderRadius: '10px', padding: '0 20px', cursor: 'pointer', userSelect: 'none', flexShrink: 0 }}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color, #1a56db)" strokeWidth="2" style={{ flexShrink: 0 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary-color, #1a56db)', whiteSpace: 'nowrap' }}>
                                {new Date(summaryDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                            </span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color, #1a56db)" strokeWidth="2.5" style={{ flexShrink: 0, opacity: 0.7 }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                            <input
                                ref={summaryDateInputRef}
                                type="date"
                                value={summaryDate}
                                onChange={e => { if (e.target.value) { setSummaryDate(e.target.value); setSummaryCourseFilter(''); } }}
                                style={{ position: 'absolute', opacity: 0, width: '1px', height: '1px', pointerEvents: 'none', top: '100%', left: '-2.5%', transform: 'translateX(-50%)' }}
                                tabIndex={-1}
                            />
                        </div>

                        {/* Next button */}
                        <button
                            onClick={() => {
                                const [y, m, d] = summaryDate.split('-').map(Number);
                                const dt = new Date(y, m - 1, d);
                                dt.setDate(dt.getDate() + 1);
                                setSummaryDate(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`);
                                setSummaryCourseFilter('');
                            }}
                            style={{ height: '40px', background: '#fff', border: '1.5px solid var(--border-color, #e2e8f0)', borderRadius: '10px', padding: '0 16px', cursor: 'pointer', fontWeight: 600, color: 'var(--text-color)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px', transition: 'border-color 0.15s, background 0.15s', flexShrink: 0 }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary-color, #1a56db)'; e.currentTarget.style.background = '#eff6ff'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color, #e2e8f0)'; e.currentTarget.style.background = '#fff'; }}
                        >
                            Next
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </button>
                    </div>

                    {/* Info bar */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        marginBottom: todayStudents.data.length > 0 ? '16px' : '24px', padding: '14px 18px',
                        background: 'var(--hover-bg, #f8fafc)',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color, #e2e8f0)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color, #1a56db)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--secondary-text)' }}>
                                {selectedBranch ? (branches.find(b => String(b.id) === String(selectedBranch))?.name || 'Selected Branch') : 'All Branches'}
                            </span>
                        </div>
                        <span style={{
                            background: todayStudents.total > 0 ? '#dbeafe' : 'var(--border-color, #e2e8f0)',
                            color: todayStudents.total > 0 ? '#1d4ed8' : 'var(--secondary-text)',
                            borderRadius: '20px', padding: '3px 12px',
                            fontSize: '0.78rem', fontWeight: 700,
                        }}>
                            {todayStudents.total} student{todayStudents.total !== 1 ? 's' : ''} enrolled
                        </span>
                    </div>

                    {/* Course filter pills */}
                    {todayStudents.data.length > 0 && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                            <button
                                onClick={() => setSummaryCourseFilter('')}
                                style={{
                                    padding: '4px 14px', borderRadius: '20px', border: '1.5px solid',
                                    borderColor: summaryCourseFilter === '' ? 'var(--primary-color, #1a56db)' : 'var(--border-color, #e2e8f0)',
                                    background: summaryCourseFilter === '' ? 'var(--primary-color, #1a56db)' : 'transparent',
                                    color: summaryCourseFilter === '' ? '#fff' : 'var(--text-color)',
                                    fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                                }}
                            >All</button>
                            {todayStudents.data.map(g => (
                                <button
                                    key={g.course_type}
                                    onClick={() => setSummaryCourseFilter(g.course_type)}
                                    style={{
                                        padding: '4px 14px', borderRadius: '20px', border: '1.5px solid',
                                        borderColor: summaryCourseFilter === g.course_type ? 'var(--primary-color, #1a56db)' : 'var(--border-color, #e2e8f0)',
                                        background: summaryCourseFilter === g.course_type ? 'var(--primary-color, #1a56db)' : 'transparent',
                                        color: summaryCourseFilter === g.course_type ? '#fff' : 'var(--text-color)',
                                        fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                                    }}
                                >{g.course_type} ({g.students.length})</button>
                            ))}
                        </div>
                    )}
                    {todayStudents.data.length === 0 ? (
                        <div style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            gap: '10px', padding: '60px 20px',
                            color: 'var(--secondary-text)', fontSize: '14px'
                        }}>
                            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ opacity: 0.4 }}>
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                            <span>No scheduled classes for this date</span>
                            <span style={{ fontSize: '12px', opacity: 0.7 }}>Students with active schedules will appear here</span>
                        </div>
                    ) : (
                        (summaryCourseFilter
                            ? todayStudents.data.filter(g => g.course_type === summaryCourseFilter)
                            : todayStudents.data
                        ).map((group, idx) => (
                            <div key={idx} style={{ marginBottom: '28px' }}>
                                <div style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                                    background: 'var(--primary-color, #1a56db)', color: '#fff',
                                    borderRadius: '8px', padding: '5px 14px',
                                    fontSize: '0.82rem', fontWeight: 700,
                                    marginBottom: '10px', letterSpacing: '0.03em',
                                }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                                    {group.course_type} &mdash; {group.students.length} student{group.students.length !== 1 ? 's' : ''}
                                </div>
                                <div className="admin-table-responsive table-wrapper">
                                    <table className="custom-table">
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Student Name</th>
                                                <th>Contact</th>
                                                <th>Schedule</th>
                                                <th>Session</th>
                                                <th>Time</th>
                                                <th>Branch</th>
                                                <th>Status</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {group.students.map((s, i) => (
                                                <tr key={i} className="table-row-hover">
                                                    <td style={{ width: '40px', color: 'var(--secondary-text)', fontWeight: 600 }}>{i + 1}</td>
                                                    <td>
                                                        <div className="student-cell">
                                                            <div className="student-avatar">
                                                                {s.name?.charAt(0)?.toUpperCase() || '?'}
                                                            </div>
                                                            <div>
                                                                <span className="student-name">{s.name}</span>
                                                                {s.email && <div style={{ fontSize: '0.75rem', color: 'var(--secondary-text)', marginTop: '1px' }}>{s.email}</div>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ fontSize: '0.82rem' }}>{s.contact || '—'}</td>
                                                    <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                                                        {s.slot_date
                                                            ? (s.slot_date === s.slot_end_date
                                                                ? new Date(s.slot_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                                : `${new Date(s.slot_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(s.slot_end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`)
                                                            : '—'}
                                                    </td>
                                                    <td style={{ fontSize: '0.82rem' }}>{s.session || '—'}</td>
                                                    <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{s.time_range || '—'}</td>
                                                    <td style={{ fontSize: '0.82rem' }}>{s.branch_name || '—'}</td>
                                                    <td>
                                                        <span className={`status-badge ${s.status === 'completed' ? 'full' : 'down'}`}>
                                                            {s.status === 'completed' ? 'Completed' : 'Enrolled'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <button
                                                            onClick={() => openStudentSummaryModal({ ...group, ...s })}
                                                            style={{
                                                                background: 'var(--primary-color, #1a56db)', color: '#fff',
                                                                border: 'none', borderRadius: '7px', padding: '5px 14px',
                                                                fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                                                display: 'flex', alignItems: 'center', gap: '5px',
                                                            }}
                                                        >
                                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                                            View
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                <>
                <div className="calendar-view">
                    <div className="calendar-header-nav">
                        <button className="month-nav-btn" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="15 18 9 12 15 6"></polyline>
                            </svg>
                        </button>
                        <h3 style={{ margin: 0 }}>{viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
                        <button className="month-nav-btn" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </button>
                    </div>

                    <div className="calendar-grid">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="calendar-day-header">{day}</div>
                        ))}
                        {(() => {
                            const year = viewDate.getFullYear();
                            const month = viewDate.getMonth();
                            const firstDay = new Date(year, month, 1).getDay();
                            const daysInMonth = new Date(year, month + 1, 0).getDate();
                            const days = [];

                            // Padding for start of month
                            for (let i = 0; i < firstDay; i++) {
                                days.push(<div key={`pad-${i}`} className="calendar-day empty"></div>);
                            }

                            // Actual days
                            for (let d = 1; d <= daysInMonth; d++) {
                                // Format date string directly to avoid timezone conversion issues
                                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                // Day check for Sunday
                                const dayOfWeek = new Date(year, month, d).getDay();
                                const isSelected = selectedDate === dateStr;
                                const isToday = today === dateStr;
                                const isSunday = dayOfWeek === 0; // Sunday = 0
                                const isPast = dateStr < today; // Disable past dates
                                const isDisabled = isPast || isSunday; // Disable past dates and Sundays
                                let daySlots = slots.filter(s => {
                                    // Skip Sundays entirely
                                    if (dayOfWeek === 0) return false;
                                    const sStart = s.date;
                                    const sEnd = s.end_date || s.date;
                                    return dateStr >= sStart && dateStr <= sEnd;
                                });
                                daySlots = sortSlotsFn(daySlots);
                                const isAllFull = daySlots.length > 0 && daySlots.every(slot => slot.available_slots === 0);
                                const slotStatus = daySlots.length === 0 ? 'no-slots' : (isAllFull ? 'full-slots' : 'has-slots');

                                days.push(
                                    <div
                                        key={d}
                                        className={`calendar-day day-${dayOfWeek} ${slotStatus} ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${isDisabled ? 'is-past disabled' : ''}`}
                                        onClick={() => {
                                            if (!isDisabled) {
                                                setSelectedDate(dateStr);
                                                // Admin must select a specific branch before adding a slot
                                                if (!selectedBranch) {
                                                    showNotification('Please select a specific branch from the filter above before adding a schedule slot.', 'warning');
                                                    return;
                                                }
                                                // Auto-open modal for creating new slot
                                                setTimeout(() => openModal(), 100);
                                            }
                                        }}
                                    >
                                        <div className="day-header">
                                            <span className="day-num">{d}</span>
                                        </div>
                                        <div className="day-slots-container">
                                            {daySlots.slice(0, 4).map(slot => (
                                                <div
                                                    key={slot.id}
                                                    className={`mini-slot-item ${slot.type} ${slot.available_slots === 0 ? 'full' : ''}`}
                                                    title={`${slot.sessionLabel} (${slot.available_slots}/${slot.total_capacity} available)`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // Edit only — do NOT change the selected date
                                                        openModal(slot);
                                                    }}
                                                >
                                                    <div className="mini-slot-header">{slot.type?.toLowerCase() === 'tdc' ? 'TDC' : 'PDC'}</div>
                                                    <div className="mini-slot-info">
                                                        <span className="mini-time">{(slot.time_range || slot.time).split(' - ')[0]}</span>
                                                        <span className="mini-status">{slot.available_slots === 0 ? 'FULL' : `${slot.available_slots} S`}</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {daySlots.length > 4 && (
                                                <div
                                                    className="mini-slot-more"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedDate(dateStr);
                                                    }}
                                                >
                                                    +{daySlots.length - 4} More...
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            }
                            return days;
                        })()}
                    </div>
                </div>

                <div className="slots-grid">
                    <div className="section-title">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <button className="month-nav-btn" onClick={() => {
                                const [year, month, day] = selectedDate.split('-').map(Number);
                                const newDate = new Date(year, month - 1, day - 1);
                                const newDateStr = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`;
                                setSelectedDate(newDateStr);
                            }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="15 18 9 12 15 6"></polyline>
                                </svg>
                            </button>
                            <h3>Available Slots for {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</h3>
                            <button className="month-nav-btn" onClick={() => {
                                const [year, month, day] = selectedDate.split('-').map(Number);
                                const newDate = new Date(year, month - 1, day + 1);
                                const newDateStr = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`;
                                setSelectedDate(newDateStr);
                            }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                            </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <svg style={{ position: 'absolute', left: '10px', color: 'var(--secondary-text)', pointerEvents: 'none' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                <input
                                    type="text"
                                    placeholder="Search slots…"
                                    value={slotSearch}
                                    onChange={e => setSlotSearch(e.target.value)}
                                    style={{
                                        paddingLeft: '32px',
                                        paddingRight: slotSearch ? '28px' : '12px',
                                        paddingTop: '7px',
                                        paddingBottom: '7px',
                                        border: '1.5px solid var(--border-color)',
                                        borderRadius: '20px',
                                        fontSize: '0.85rem',
                                        background: 'var(--card-bg)',
                                        color: 'var(--text-color)',
                                        outline: 'none',
                                        width: '200px',
                                        transition: 'border-color 0.2s',
                                    }}
                                    onFocus={e => e.target.style.borderColor = 'var(--primary-color)'}
                                    onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                                />
                                {slotSearch && (
                                    <button onClick={() => setSlotSearch('')} style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--secondary-text)', display: 'flex', alignItems: 'center', padding: 0 }}>
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    </button>
                                )}
                            </div>
                            <span className="badge">{filteredSlots.length} Slots Found</span>
                            <button
                                className="add-btn"
                                onClick={() => {
                                    if (!selectedBranch) {
                                        showNotification('Please select a specific branch from the filter above before auto-generating slots.', 'warning');
                                        return;
                                    }
                                    setShowAutoModal(true);
                                }}
                                style={{
                                    padding: '6px 12px',
                                    background: 'var(--primary-light)',
                                    color: 'var(--primary-color)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '0.85rem',
                                    fontWeight: '600',
                                    cursor: !selectedBranch ? 'not-allowed' : 'pointer',
                                    opacity: !selectedBranch ? 0.55 : 1
                                }}
                            >
                                ⚡ Auto-Generate
                            </button>
                        </div>
                    </div>

                    <div className="slots-list">
                        {loading ? (
                            <div className="loading-state">
                                <p>Loading slots...</p>
                            </div>
                        ) : error ? (
                            <div className="error-state">
                                <p>{error}</p>
                                <button onClick={loadSlots} className="retry-btn">Retry</button>
                            </div>
                        ) : filteredSlots.length > 0 ? filteredSlots.map(slot => (
                            <div key={slot.id} className="slot-card">
                                {/* Time Column */}
                                <div className="slot-time">
                                    <div className="clock-icon">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                    </div>
                                    <span className="slot-time-label">{slot.time_range || slot.time}</span>
                                </div>

                                {/* Details Column */}
                                <div className="slot-details">
                                    <h4>
                                        {slot.sessionLabel}
                                        <span className={`slot-type-badge ${slot.type}`}>
                                            {slot.type?.toLowerCase() === 'tdc' ? 'TDC' : 'PDC'}
                                        </span>
                                        {slot.course_type && (
                                            <span style={{ fontSize: '0.7em', padding: '2px 6px', background: '#e2e8f0', color: '#475569', borderRadius: '4px', marginLeft: '6px', whiteSpace: 'nowrap' }}>
                                                {slot.course_type}
                                                {slot.transmission ? ` · ${slot.transmission}` : ''}
                                            </span>
                                        )}
                                    </h4>
                                    {slot.branch_id ? (
                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>
                                            📍 {(() => {
                                                const b = branches.find(br => String(br.id) === String(slot.branch_id));
                                                return b ? b.name : (slot.branch_name || 'Unknown Branch');
                                            })()}
                                        </p>
                                    ) : (
                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>
                                            📍 Unassigned / Default Branch
                                        </p>
                                    )}
                                    {getDayInfo(slot, selectedDate) && (
                                        <p style={{ margin: (slot.branch_id ? '2px 0 0 0' : '4px 0 0 0') }}>📅 {getDayInfo(slot, selectedDate)} &nbsp;({slot.date} → {slot.end_date})</p>
                                    )}
                                </div>

                                {/* Capacity Column */}
                                <div className={`slot-capacity ${Number(slot.available_slots || 0) <= 0 ? 'full' : ''}`}>
                                    <div className="progress-bar">
                                        <div
                                            className="progress-fill"
                                            style={{
                                                width: `${Math.max(0, Math.min(100, ((Math.max(0, Number(slot.total_capacity || 0)) - Math.min(Math.max(0, Number(slot.total_capacity || 0)), Math.max(0, Number(slot.available_slots || 0)))) / Math.max(1, Math.max(0, Number(slot.total_capacity || 0)))) * 100))}%`,
                                                background: Number(slot.available_slots || 0) <= 0 ? '#ef4444' : ''
                                            }}
                                        ></div>
                                    </div>
                                    <span className="capacity-text">
                                        {Number(slot.available_slots || 0) <= 0 ? (
                                            <span className="status-full">FULLY BOOKED</span>
                                        ) : (
                                            <>
                                                {Math.max(0, Number(slot.total_capacity || 0)) - Math.min(Math.max(0, Number(slot.total_capacity || 0)), Math.max(0, Number(slot.available_slots || 0)))} / {Math.max(0, Number(slot.total_capacity || 0))} Booked ({Math.min(Math.max(0, Number(slot.total_capacity || 0)), Math.max(0, Number(slot.available_slots || 0)))} left)
                                            </>
                                        )}
                                    </span>
                                </div>

                                {/* Actions Column */}
                                <div className="slot-actions">
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                        <button className="edit-btn" onClick={() => openModal(slot)} style={{ flex: 1 }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z"></path></svg>
                                            Edit
                                        </button>
                                        <button
                                            className="slot-delete-btn"
                                            onClick={() => handleDeleteSlot(slot.id)}
                                            title="Delete Slot"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                                <line x1="14" y1="11" x2="14" y2="17"></line>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="no-slots">
                                <p>No slots scheduled for this date.</p>
                            </div>
                        )}
                    </div>

                    {/* Missing Slot Indicators */}
                    {!loading && !error && !isSelectedSunday() && (() => {
                        const SESSION_TIMES = {
                            'Morning': '08:00 AM - 12:00 PM',
                            'Afternoon': '01:00 PM - 05:00 PM',
                            'Whole Day': '08:00 AM - 05:00 PM',
                        };
                        const expected = [];
                        // TDC: F2F only, always Whole Day
                        ['F2F'].forEach(ct => {
                            expected.push({ type: 'tdc', course_type: ct, session: 'Whole Day', transmission: '' });
                        });
                        // PDC: each active course × its transmissions × all 3 sessions
                        courses.filter(c => c.category?.toLowerCase() === 'pdc').forEach(course => {
                            const transmissions = getAvailableTransmissions(course.name);
                            ['Morning', 'Afternoon', 'Whole Day'].forEach(session => {
                                if (transmissions.length > 0) {
                                    transmissions.forEach(tx => expected.push({ type: 'pdc', course_type: course.name, session, transmission: tx }));
                                } else {
                                    expected.push({ type: 'pdc', course_type: course.name, session, transmission: '' });
                                }
                            });
                        });
                        const dateSlots = slots.length > 0 ? slots.filter(s => {
                            const sStart = s.date;
                            const sEnd = s.end_date || s.date;
                            return selectedDate >= sStart && selectedDate <= sEnd;
                        }) : [];
                        const missing = expected.filter(exp =>
                            !dateSlots.some(s =>
                                s.type === exp.type &&
                                (s.course_type || '') === (exp.course_type || '') &&
                                s.session === exp.session &&
                                (exp.type !== 'pdc' || (s.transmission || '') === (exp.transmission || ''))
                            )
                        );
                        if (expected.length === 0) return null;
                        if (missing.length === 0) return (
                            <div style={{ marginTop: '14px', padding: '10px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>✅</span>
                                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#15803d' }}>All expected slot combinations are covered for this date.</span>
                            </div>
                        );
                        return (
                            <div style={{ marginTop: '14px', background: '#fff', border: '1px solid #fde68a', borderRadius: '10px', padding: '14px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                    <span>⚠️</span>
                                    <strong style={{ color: '#92400e', fontSize: '0.85rem' }}>Missing Slots ({missing.length}) — click any to add:</strong>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                                    {missing.map((m, i) => {
                                        const label = m.type === 'tdc'
                                            ? `TDC · ${m.course_type} · Whole Day`
                                            : `PDC · ${m.course_type}${m.transmission ? ' · ' + m.transmission : ''} · ${m.session}`;
                                        return (
                                            <button
                                                key={i}
                                                onClick={() => {
                                                    if (!selectedBranch) {
                                                        showNotification('Please select a branch before adding a slot.', 'warning');
                                                        return;
                                                    }
                                                    openModal({
                                                        type: m.type,
                                                        course_type: m.course_type,
                                                        session: m.session,
                                                        transmission: m.transmission,
                                                        time_range: SESSION_TIMES[m.session] || '08:00 AM - 05:00 PM',
                                                        total_capacity: 15,
                                                    });
                                                }}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '5px',
                                                    padding: '5px 11px', background: '#fef3c7', color: '#78350f',
                                                    border: '1px solid #fcd34d', borderRadius: '6px',
                                                    fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer',
                                                    transition: 'background 0.15s, border-color 0.15s',
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.background = '#fde68a'; e.currentTarget.style.borderColor = '#f59e0b'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = '#fef3c7'; e.currentTarget.style.borderColor = '#fcd34d'; }}
                                                title={`Click to add: ${label}`}
                                            >
                                                <span style={{ color: '#dc2626', fontWeight: '800', fontSize: '1rem', lineHeight: 1 }}>+</span>
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}
                </div>
                </>
            )}

            {/* Edit/Add Slot Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-container">
                        <div className="modal-header">
                            <div className="modal-header-left">
                                <div className="modal-header-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                </div>
                                <div>
                                    <h2>{editingId ? 'Edit Slot' : 'Set New Slot'}</h2>
                                </div>
                            </div>
                            <div className="modal-header-right">
                                <button className="close-modal" onClick={closeModal}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>
                        </div>
                        <form onSubmit={handleSaveSlot}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Type</label>
                                    <select name="type" value={formData.type} onChange={handleInputChange}>
                                        <option value="tdc">TDC (Theoretical)</option>
                                        <option value="pdc">PDC (Practical)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Session</label>
                                    <select name="session" value={formData.session} onChange={handleInputChange} required>
                                        <option value="" disabled>-- Select Session --</option>
                                        <option value="Morning">🌅 Morning (08:00 AM – 12:00 PM)</option>
                                        <option value="Afternoon">☀️ Afternoon (01:00 PM – 05:00 PM)</option>
                                        <option value="Whole Day">🕐 Whole Day (08:00 AM – 05:00 PM)</option>
                                    </select>
                                </div>

                                <div className="form-row">
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>{formData.type === 'tdc' ? 'Modality' : 'Course Type'}</label>
                                        <select name="course_type" value={formData.course_type} onChange={handleInputChange} required>
                                            <option value="" disabled>-- Select {formData.type === 'tdc' ? 'Modality' : 'Course'} --</option>
                                            {formData.type === 'tdc' ? (
                                                <>
                                                    <option value="F2F">Face-to-Face (F2F)</option>
                                                    <option value="Online">Online (OTDC)</option>
                                                </>
                                            ) : (
                                                courses.filter(c => c.category?.toLowerCase() === formData.type).map(c => (
                                                    <option key={c.id} value={c.name}>{c.name}</option>
                                                ))
                                            )}
                                        </select>
                                    </div>
                                    {formData.type === 'pdc' && (() => {
                                        const transmissions = getAvailableTransmissions(formData.course_type);
                                        if (transmissions.length === 0) return null;
                                        return (
                                            <div className="form-group" style={{ flex: 1 }}>
                                                <label>Transmission</label>
                                                <select name="transmission" value={formData.transmission} onChange={handleInputChange} required>
                                                    {transmissions.map(t => (
                                                        <option key={t} value={t}>{t}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Info Banner — only shown for TDC since it auto-spans 2 consecutive school days */}
                                {formData.type === 'tdc' && (() => {
                                    const getNextSchoolDayLabel = (dateStr) => {
                                        const [y, m, d] = dateStr.split('-').map(Number);
                                        const next = new Date(y, m - 1, d);
                                        next.setHours(12, 0, 0, 0);
                                        next.setDate(next.getDate() + 1);
                                        if (next.getDay() === 0) next.setDate(next.getDate() + 1);
                                        return next.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                    };
                                    const startLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                    const endLabel = getNextSchoolDayLabel(selectedDate);
                                    return (
                                        <div style={{
                                            background: 'linear-gradient(135deg, #2157da 0%, #1a3a8a 100%)',
                                            borderRadius: '12px',
                                            padding: '14px 18px',
                                            marginBottom: '4px',
                                            color: '#fff',
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: '12px'
                                        }}>
                                            <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>📅</span>
                                            <div>
                                                <p style={{ margin: '0 0 4px 0', fontWeight: '700', fontSize: '0.92rem' }}>
                                                    TDC — 1 booking covers both days (Day 1 &amp; Day 2)
                                                </p>
                                                <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.85 }}>
                                                    One TDC slot entry will cover <strong>{startLabel}</strong> → <strong>{endLabel}</strong> (Sundays skipped automatically).
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })()}

                                <div className="form-row">
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>Total Capacity</label>
                                        <input
                                            type="number"
                                            name="slots"
                                            min="1"
                                            value={formData.slots}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                    <div className="form-group" style={{ flex: 2 }}>
                                        <label>Time Range</label>
                                        <select
                                            name="time"
                                            value={formData.time}
                                            onChange={handleInputChange}
                                            required
                                        >
                                            <option value="">Select Time</option>
                                            <option value="08:00 AM - 12:00 PM">08:00 AM - 12:00 PM</option>
                                            <option value="01:00 PM - 05:00 PM">01:00 PM - 05:00 PM</option>
                                            <option value="08:00 AM - 05:00 PM">08:00 AM - 05:00 PM</option>
                                            <option value="07:00 AM - 09:00 AM">07:00 AM - 09:00 AM</option>
                                            <option value="08:00 AM - 10:00 AM">08:00 AM - 10:00 AM</option>
                                            <option value="09:00 AM - 11:00 AM">09:00 AM - 11:00 AM</option>
                                            <option value="10:00 AM - 12:00 PM">10:00 AM - 12:00 PM</option>
                                            <option value="01:00 PM - 03:00 PM">01:00 PM - 03:00 PM</option>
                                            <option value="03:00 PM - 05:00 PM">03:00 PM - 05:00 PM</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="cancel-btn" onClick={closeModal}>Cancel</button>
                                <button type="submit" className="confirm-btn">{editingId ? 'Update Slot' : 'Create Slot'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* View Students Modal */}
            {showStudentModal && selectedSlot && (
                <div className="modal-overlay">
                    <div className="modal-container student-list-modal">
                        <div className="modal-header">
                            <div className="modal-header-left">
                                <div className="modal-header-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                                </div>
                                <div>
                                    <h2>Manage Students</h2>
                                    <p>{selectedSlot.sessionLabel} | {selectedSlot.time_range || selectedSlot.time}</p>
                                </div>
                            </div>

                            <div className="modal-header-right">
                                <button className="close-modal" onClick={() => setShowStudentModal(false)}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>
                        </div>
                        <div className="modal-body" style={{ padding: 0, gap: 0, maxHeight: '65vh', position: 'relative', overflow: 'hidden' }}>
                            {/* Tab bar */}
                            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', padding: '0 20px', background: '#fff' }}>
                                <button
                                    onClick={() => setStudentModalTab('enrolled')}
                                    style={{
                                        padding: '12px 16px',
                                        border: 'none',
                                        borderBottom: studentModalTab === 'enrolled' ? '2px solid var(--primary-color)' : '2px solid transparent',
                                        background: 'none',
                                        cursor: 'pointer',
                                        fontSize: '0.875rem',
                                        fontWeight: studentModalTab === 'enrolled' ? '700' : '500',
                                        color: studentModalTab === 'enrolled' ? 'var(--primary-color)' : '#64748b',
                                        transition: 'color 0.15s',
                                    }}
                                >
                                    Enrolled ({selectedSlot.students?.length || 0})
                                </button>
                                <button
                                    onClick={() => setStudentModalTab('unassigned')}
                                    style={{
                                        padding: '12px 16px',
                                        border: 'none',
                                        borderBottom: studentModalTab === 'unassigned' ? '2px solid var(--primary-color)' : '2px solid transparent',
                                        background: 'none',
                                        cursor: 'pointer',
                                        fontSize: '0.875rem',
                                        fontWeight: studentModalTab === 'unassigned' ? '700' : '500',
                                        color: studentModalTab === 'unassigned' ? 'var(--primary-color)' : '#64748b',
                                        transition: 'color 0.15s',
                                    }}
                                >
                                    Assign Student
                                </button>
                            </div>

                            {/* Enrolled Students Tab */}
                            {studentModalTab === 'enrolled' && (
                            <div className="admin-table-responsive student-table-wrapper" style={{ borderRadius: 0, border: 'none', borderBottom: '1px solid var(--border-color)' }}>
                                    <table className="student-table">
                                        <thead>
                                            <tr>
                                                <th>Student Name</th>
                                                <th>Contact Details</th>
                                                <th>Status</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedSlot.students && selectedSlot.students.length > 0 ? selectedSlot.students.map(student => (
                                                <tr key={student.id}>
                                                    <td>
                                                        <div className="student-info">
                                                            <div className="student-avatar">{student.name.charAt(0)}</div>
                                                            <span className="student-name" style={{ fontWeight: '600' }}>{student.name}</span>
                                                        </div>
                                                    </td>
                                                    <td><span className="student-phone" style={{ color: '#64748b' }}>{student.phone}</span></td>
                                                    <td>
                                                        <span className={`status-badge status-${student.status}`} style={{
                                                            padding: '6px 12px',
                                                            borderRadius: '20px',
                                                            background: student.status === 'completed' ? '#dcfce7' : student.status === 'no-show' ? '#fee2e2' : '#f1f5f9',
                                                            color: student.status === 'completed' ? '#166534' : student.status === 'no-show' ? '#991b1b' : '#334155',
                                                            fontSize: '0.75rem',
                                                            fontWeight: '600',
                                                            border: `1px solid ${student.status === 'completed' ? '#bbf7d0' : student.status === 'no-show' ? '#fecaca' : '#e2e8f0'}`
                                                        }}>
                                                            {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        {student.status !== 'no-show' ? (
                                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                                                                <button
                                                                    onClick={() => handleAttendanceUpdate(student.id, student.status)}
                                                                    title={student.status === 'completed' ? 'Undo Completion' : 'Mark Completed'}
                                                                    style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '5px',
                                                                        padding: '6px 12px',
                                                                        borderRadius: '8px',
                                                                        border: 'none',
                                                                        background: student.status === 'completed' ? '#f1f5f9' : '#dbeafe',
                                                                        color: student.status === 'completed' ? '#64748b' : '#1d4ed8',
                                                                        cursor: 'pointer',
                                                                        fontSize: '0.78rem',
                                                                        fontWeight: '700',
                                                                        whiteSpace: 'nowrap',
                                                                    }}
                                                                >
                                                                    {student.status === 'completed' ? (
                                                                        <>
                                                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12l5 5L20 5"/></svg>
                                                                            Undo
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                                                                            Complete
                                                                        </>
                                                                    )}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleNoShowUpdate(student.id)}
                                                                    title="Mark as No-Show"
                                                                    style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '5px',
                                                                        padding: '6px 12px',
                                                                        borderRadius: '8px',
                                                                        border: 'none',
                                                                        background: '#fee2e2',
                                                                        color: '#b91c1c',
                                                                        cursor: 'pointer',
                                                                        fontSize: '0.78rem',
                                                                        fontWeight: '700',
                                                                        whiteSpace: 'nowrap',
                                                                    }}
                                                                >
                                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                                                                    No-Show
                                                                </button>
                                                                <button
                                                                    onClick={() => openReschedulePanel(student.id, student.name)}
                                                                    title="Reschedule Student"
                                                                    style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '5px',
                                                                        padding: '6px 12px',
                                                                        borderRadius: '8px',
                                                                        border: 'none',
                                                                        background: '#fef3c7',
                                                                        color: '#92400e',
                                                                        cursor: 'pointer',
                                                                        fontSize: '0.78rem',
                                                                        fontWeight: '700',
                                                                        whiteSpace: 'nowrap',
                                                                    }}
                                                                >
                                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                                                                    Reschedule
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
                                                                {!student.reschedule_fee_paid && (
                                                                    <button
                                                                        onClick={() => handleMarkFeePaid(student.id)}
                                                                        title={`Confirm ₱${selectedSlot?.type?.toLowerCase() === 'tdc' ? '300' : '1,000'} no-show fee has been collected`}
                                                                        style={{
                                                                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                                            padding: '6px 12px', borderRadius: '8px', border: 'none',
                                                                            background: '#dcfce7', color: '#166534',
                                                                            cursor: 'pointer', fontSize: '0.78rem', fontWeight: '700', whiteSpace: 'nowrap',
                                                                        }}
                                                                    >
                                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" fill="currentColor" stroke="none"/></svg>
                                                                        Mark Fee Paid (₱{selectedSlot?.type?.toLowerCase() === 'tdc' ? '300' : '1,000'})
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => student.reschedule_fee_paid ? openReschedulePanel(student.id, student.name) : null}
                                                                    disabled={!student.reschedule_fee_paid}
                                                                    title={student.reschedule_fee_paid ? 'Reschedule Student' : `Student must pay the ₱${selectedSlot?.type?.toLowerCase() === 'tdc' ? '300' : '1,000'} no-show fee first`}
                                                                    style={{
                                                                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                                        padding: '6px 12px', borderRadius: '8px', border: 'none',
                                                                        background: student.reschedule_fee_paid ? '#fef3c7' : '#f1f5f9',
                                                                        color: student.reschedule_fee_paid ? '#92400e' : '#94a3b8',
                                                                        cursor: student.reschedule_fee_paid ? 'pointer' : 'not-allowed',
                                                                        fontSize: '0.78rem', fontWeight: '700', whiteSpace: 'nowrap',
                                                                        opacity: student.reschedule_fee_paid ? 1 : 0.6,
                                                                    }}
                                                                >
                                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                                                                    Reschedule
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                                                        No students enrolled in this slot yet.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Assign Student Tab */}
                            {studentModalTab === 'unassigned' && (
                                <div className="admin-table-responsive student-table-wrapper" style={{ borderRadius: 0, border: 'none' }}>
                                    {selectedSlot.date !== selectedDate ? (
                                        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⚠️</div>
                                            <p style={{ fontWeight: '700', color: '#334155', marginBottom: '8px', fontSize: '0.95rem' }}>
                                                This is Day 2+ of a multi-day course
                                            </p>
                                            <p style={{ color: '#64748b', fontSize: '0.85rem', maxWidth: '360px', margin: '0 auto' }}>
                                                Students must be rescheduled starting from <strong>Day 1</strong>.
                                                Please navigate to the <strong>{selectedSlot.date}</strong> slot to assign students.
                                            </p>
                                        </div>
                                    ) : loadingUnassigned ? (
                                        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading eligible students...</div>
                                    ) : (
                                        <table className="student-table">
                                            <thead>
                                                <tr>
                                                    <th>Student Name</th>
                                                    <th>Course</th>
                                                    <th>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {unassignedStudents.length > 0 ? unassignedStudents.map(student => (
                                                    <tr key={student.student_id}>
                                                        <td>
                                                            <div className="student-info">
                                                                <div className="student-avatar">{student.first_name.charAt(0)}</div>
                                                                <span className="student-name" style={{ fontWeight: '600' }}>{student.first_name} {student.last_name}</span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                                <span style={{ fontWeight: '500', fontSize: '0.85rem' }}>{student.course_name}</span>
                                                                <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                                    {student.course_type && (
                                                                        <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#1d4ed8', background: '#dbeafe', padding: '2px 7px', borderRadius: '10px', border: '1px solid #bfdbfe' }}>{student.course_type.toUpperCase()}</span>
                                                                    )}
                                                                    {student.course_category?.toLowerCase().includes('promo') && (
                                                                        <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#d97706', background: '#fef3c7', padding: '2px 7px', borderRadius: '10px', border: '1px solid #fde68a' }}>PROMO</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            <button
                                                                onClick={() => handleAssignStudent(student.student_id)}
                                                                style={{
                                                                    padding: '6px 14px',
                                                                    borderRadius: '8px',
                                                                    border: 'none',
                                                                    background: '#dbeafe',
                                                                    color: '#1d4ed8',
                                                                    cursor: 'pointer',
                                                                    fontSize: '0.78rem',
                                                                    fontWeight: '700',
                                                                }}
                                                            >
                                                                Assign
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )) : (
                                                    <tr>
                                                        <td colSpan="3" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                                                            No eligible students found for this slot.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            )}

                            {/* Reschedule Panel Overlay */}
                            {rescheduleInfo && (
                                <div style={{
                                    position: 'absolute', inset: 0, zIndex: 10,
                                    background: '#fff', display: 'flex', flexDirection: 'column',
                                    overflow: 'hidden',
                                }}>
                                    {/* Panel header */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '12px',
                                        padding: '14px 20px', borderBottom: '1px solid var(--border-color)',
                                        background: '#f8fafc', flexShrink: 0,
                                    }}>
                                        <button
                                            onClick={() => setRescheduleInfo(null)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', fontWeight: 600, padding: '4px 8px', borderRadius: '6px' }}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                                            Back
                                        </button>
                                        <div style={{ width: '1px', height: '20px', background: '#e2e8f0' }} />
                                        <div>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>Reschedule: {rescheduleInfo.studentName}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Course: <strong>{rescheduleInfo.courseLabel || '—'}</strong> — Select a new slot</div>
                                        </div>
                                    </div>
                                    {/* Panel body */}
                                    <div style={{ flex: 1, overflowY: 'auto' }}>
                                        {rescheduleInfo.loadingSlots ? (
                                            <div style={{ textAlign: 'center', padding: '50px', color: '#94a3b8' }}>Loading available slots...</div>
                                        ) : rescheduleInfo.slots.length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '50px' }}>
                                                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" style={{ marginBottom: '12px' }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                                <p style={{ fontWeight: 700, color: '#475569', margin: '0 0 6px' }}>No available slots found</p>
                                                <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>There are no upcoming slots with open capacity for this course type.</p>
                                            </div>
                                        ) : (
                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    {(() => {
                                                        const months = [...new Set(rescheduleInfo.slots.map(s => s.date.slice(0, 7)))].sort();
                                                        const active = rescheduleMonthFilter || months[0] || '';
                                                        const idx = months.indexOf(active);
                                                        return (
                                                            <tr><th colSpan="6" style={{ padding: '7px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                                    <button onClick={() => setRescheduleMonthFilter(months[idx - 1])} disabled={idx <= 0} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '3px 9px', fontSize: '0.72rem', fontWeight: 600, color: idx > 0 ? '#475569' : '#cbd5e1', cursor: idx > 0 ? 'pointer' : 'not-allowed', lineHeight: 1.4 }}>‹ Prev</button>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#fff', border: '1.5px solid #1a56db', borderRadius: '8px', padding: '3px 13px', fontSize: '0.78rem', fontWeight: 700, color: '#1a56db', minWidth: '148px', justifyContent: 'center' }}>
                                                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                                                        {active ? new Date(active + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : ''}
                                                                    </div>
                                                                    <button onClick={() => setRescheduleMonthFilter(months[idx + 1])} disabled={idx >= months.length - 1} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '3px 9px', fontSize: '0.72rem', fontWeight: 600, color: idx < months.length - 1 ? '#475569' : '#cbd5e1', cursor: idx < months.length - 1 ? 'pointer' : 'not-allowed', lineHeight: 1.4 }}>Next ›</button>
                                                                </div>
                                                            </th></tr>
                                                        );
                                                    })()}
                                                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date</th>
                                                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Session</th>
                                                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Time</th>
                                                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Type</th>
                                                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Available</th>
                                                        <th style={{ padding: '10px 16px' }}></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {rescheduleInfo.slots.filter(s => { const months = [...new Set(rescheduleInfo.slots.map(x => x.date.slice(0, 7)))].sort(); const active = rescheduleMonthFilter || months[0] || ''; return !active || s.date.startsWith(active); }).map(slot => (
                                                        <tr key={slot.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                            <td style={{ padding: '11px 16px', fontSize: '0.83rem', fontWeight: 600, color: '#1e293b' }}>
                                                                {(!slot.end_date || slot.date === slot.end_date)
                                                                    ? new Date(slot.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                                    : `${new Date(slot.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(slot.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                                                            </td>
                                                            <td style={{ padding: '11px 16px', fontSize: '0.83rem', color: '#334155' }}>{slot.session}</td>
                                                            <td style={{ padding: '11px 16px', fontSize: '0.83rem', color: '#334155', whiteSpace: 'nowrap' }}>{slot.time_range}</td>
                                                            <td style={{ padding: '11px 16px', fontSize: '0.83rem', color: '#334155' }}>
                                                                <span style={{ fontWeight: 600, color: '#1e293b' }}>{(slot.type || '').toUpperCase()}</span>
                                                                {(slot.course_type || slot.transmission) && <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>{[slot.course_type, slot.transmission].filter(Boolean).join(' · ')}</span>}
                                                            </td>
                                                            <td style={{ padding: '11px 16px' }}>
                                                                <span style={{
                                                                    fontSize: '0.78rem', fontWeight: 700,
                                                                    color: slot.available_slots <= 2 ? '#d97706' : '#166534',
                                                                    background: slot.available_slots <= 2 ? '#fef3c7' : '#dcfce7',
                                                                    padding: '2px 9px', borderRadius: '10px',
                                                                    border: `1px solid ${slot.available_slots <= 2 ? '#fde68a' : '#bbf7d0'}`
                                                                }}>
                                                                    {slot.available_slots} / {slot.total_capacity}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '11px 16px', textAlign: 'right' }}>
                                                                <button
                                                                    onClick={() => confirmReschedule(slot.id)}
                                                                    style={{
                                                                        background: 'var(--primary-color, #1a56db)', color: '#fff',
                                                                        border: 'none', borderRadius: '8px', padding: '6px 18px',
                                                                        fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                                                                    }}
                                                                >
                                                                    Select
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="confirm-btn" onClick={() => { setShowStudentModal(false); setRescheduleInfo(null); }}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Auto-Generate Modal */}
            {showAutoModal && (
                <div className="modal-overlay">
                    <div className="modal-container user-modal" style={{ maxWidth: '650px', width: '95%' }}>
                        <div className="modal-header">
                            <div className="modal-header-left">
                                <div className="modal-header-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                                </div>
                                <div>
                                    <h2>Auto-Generate Slots</h2>
                                    <p>Quickly create multiple slots over a date range.</p>
                                </div>
                            </div>
                            <div className="modal-header-right">
                                <button className="close-modal" onClick={() => setShowAutoModal(false)}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>
                        </div>
                        <form onSubmit={handleAutoGenerate}>
                            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', padding: '25px' }}>
                                <div className="form-row">
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>Start Date</label>
                                        <input type="date" name="startDate" value={autoData.startDate} min={today} onChange={handleAutoInputChange} required />
                                    </div>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>End Date</label>
                                        <input type="date" name="endDate" value={autoData.endDate} min={autoData.startDate || today} onChange={handleAutoInputChange} required />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Days of the Week</label>
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '5px' }}>
                                        {[
                                            { id: 1, label: 'Mon' }, { id: 2, label: 'Tue' }, { id: 3, label: 'Wed' },
                                            { id: 4, label: 'Thu' }, { id: 5, label: 'Fri' }, { id: 6, label: 'Sat' }
                                        ].map(day => (
                                            <label key={day.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', background: '#f1f5f9', padding: '6px 12px', borderRadius: '8px', border: autoData.daysOfWeek.includes(day.id) ? '2px solid var(--primary-color)' : '2px solid transparent' }}>
                                                <input
                                                    type="checkbox"
                                                    value={day.id}
                                                    checked={autoData.daysOfWeek.includes(day.id)}
                                                    onChange={handleAutoInputChange}
                                                    style={{ margin: 0 }}
                                                />
                                                <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>{day.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <small style={{ display: 'block', marginTop: '8px', color: '#64748b' }}>*Sundays are automatically excluded.</small>
                                </div>

                                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '20px 0' }} />

                                <div className="form-group">
                                    <label>Type</label>
                                    <select name="type" value={autoData.type} onChange={handleAutoInputChange}>
                                        <option value="tdc">TDC (Theoretical)</option>
                                        <option value="pdc">PDC (Practical)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Session</label>
                                    <select name="session" value={autoData.session} onChange={handleAutoInputChange} required>
                                        <option value="" disabled>-- Select Session --</option>
                                        <option value="Morning">🌅 Morning (08:00 AM – 12:00 PM)</option>
                                        <option value="Afternoon">☀️ Afternoon (01:00 PM – 05:00 PM)</option>
                                        <option value="Whole Day">🕐 Whole Day (08:00 AM – 05:00 PM)</option>
                                    </select>
                                </div>

                                <div className="form-row">
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>{autoData.type === 'tdc' ? 'Modality' : 'Course Type'}</label>
                                        <select name="course_type" value={autoData.course_type} onChange={handleAutoInputChange} required>
                                            <option value="" disabled>-- Select {autoData.type === 'tdc' ? 'Modality' : 'Course'} --</option>
                                            {autoData.type === 'tdc' ? (
                                                <>
                                                    <option value="F2F">Face-to-Face (F2F)</option>
                                                    <option value="Online">Online (OTDC)</option>
                                                </>
                                            ) : (
                                                courses.filter(c => c.category?.toLowerCase() === autoData.type).map(c => (
                                                    <option key={c.id} value={c.name}>{c.name}</option>
                                                ))
                                            )}
                                        </select>
                                    </div>
                                    {autoData.type === 'pdc' && (() => {
                                        const transmissions = getAvailableTransmissions(autoData.course_type);
                                        if (transmissions.length === 0) return null;
                                        return (
                                            <div className="form-group" style={{ flex: 1 }}>
                                                <label>Transmission</label>
                                                <select name="transmission" value={autoData.transmission} onChange={handleAutoInputChange} required>
                                                    {transmissions.map(t => (
                                                        <option key={t} value={t}>{t}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        );
                                    })()}
                                </div>

                                <div className="form-row">
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>Total Capacity per Slot</label>
                                        <input type="number" name="slots" min="1" value={autoData.slots} onChange={handleAutoInputChange} required />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="cancel-btn" onClick={() => setShowAutoModal(false)} disabled={isGenerating}>Cancel</button>
                                <button type="submit" className="confirm-btn" disabled={isGenerating}>
                                    {isGenerating ? 'Generating...' : 'Start Auto-Generate'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Confirm No-Show Modal */}
            {confirmNoShowId && (
                <div className="modal-overlay" style={{ zIndex: 1100 }}>
                    <div className="modal-container" style={{ maxWidth: '480px' }}>
                        <div className="modal-header">
                            <div className="modal-header-left">
                                <div className="modal-header-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                                </div>
                                <div>
                                    <h2>Mark as No-Show</h2>
                                </div>
                            </div>
                            <div className="modal-header-right">
                                <button className="close-modal" onClick={() => setConfirmNoShowId(null)}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>
                        </div>
                        <div className="modal-body" style={{ padding: '0 25px 25px 25px' }}>
                            <p style={{ margin: '0 0 15px 0', fontSize: '0.95rem', color: '#334155', lineHeight: '1.5' }}>
                                Are you sure you want to mark this student as <strong>NO-SHOW</strong>?
                            </p>
                            <div style={{ background: '#fef2f2', borderLeft: '4px solid #ef4444', padding: '12px 16px', borderRadius: '4px' }}>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#991b1b', lineHeight: '1.5' }}>
                                    This action will:
                                </p>
                                <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '0.85rem', color: '#991b1b', lineHeight: '1.5' }}>
                                    <li>Remove them from the current slot.</li>
                                    <li>Require a <strong>₱{selectedSlot?.type?.toLowerCase() === 'tdc' ? '300' : '1,000'} fee</strong> for rescheduling.</li>
                                    <li>Send them an email notification automatically.</li>
                                </ul>
                            </div>
                        </div>
                        <div className="modal-footer" style={{ padding: '20px 25px', background: '#f8fafc', borderRadius: '0 0 16px 16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button
                                onClick={() => setConfirmNoShowId(null)}
                                style={{ padding: '10px 18px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#475569', fontWeight: '600', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={executeNoShowUpdate}
                                style={{ padding: '10px 18px', background: '#ef4444', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '600', cursor: 'pointer', boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)' }}
                            >
                                Confirm No-Show
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── No-Show Reschedule Modal (triggered from No-Show tab) ── */}
            {summaryRescheduleInfo && !summaryStudentModal && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(2px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '32px 16px',
                }} onClick={() => setSummaryRescheduleInfo(null)}>
                    <div style={{
                        background: 'var(--card-bg, #fff)', borderRadius: '16px',
                        width: '100%', maxWidth: '760px',
                        boxShadow: '0 24px 72px rgba(0,0,0,0.22)',
                        overflow: 'hidden',
                    }} onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '16px 24px', borderBottom: '1px solid var(--border-color, #e2e8f0)',
                            background: '#fef3c7',
                        }}>
                            <button
                                onClick={() => setSummaryRescheduleInfo(null)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400e', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', fontWeight: 700, padding: '4px 8px', borderRadius: '6px' }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                                Cancel
                            </button>
                            <div style={{ width: '1px', height: '20px', background: '#fde68a' }} />
                            <div>
                                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#78350f' }}>
                                    Reschedule: {summaryRescheduleInfo.studentName}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#92400e' }}>Course: <strong>{summaryRescheduleInfo.courseLabel || '—'}</strong> — Select a new slot</div>
                            </div>
                        </div>
                        {/* Body */}
                        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                            {summaryRescheduleInfo.loadingSlots ? (
                                <div style={{ textAlign: 'center', padding: '50px', color: '#92400e', fontSize: '0.85rem' }}>Loading available slots…</div>
                            ) : summaryRescheduleInfo.slots.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '50px' }}>
                                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" style={{ marginBottom: '12px' }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                    <p style={{ fontWeight: 700, color: '#475569', margin: '0 0 6px' }}>No available slots found</p>
                                    <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>There are no upcoming slots with open capacity for this course type.</p>
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '560px' }}>
                                        <thead>
                                            {(() => {
                                                const months = [...new Set(summaryRescheduleInfo.slots.map(s => s.date.slice(0, 7)))].sort();
                                                const active = summaryRescheduleMonthFilter || months[0] || '';
                                                const idx = months.indexOf(active);
                                                return (
                                                    <tr><th colSpan="6" style={{ padding: '7px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                            <button onClick={() => setSummaryRescheduleMonthFilter(months[idx - 1])} disabled={idx <= 0} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '3px 9px', fontSize: '0.72rem', fontWeight: 600, color: idx > 0 ? '#475569' : '#cbd5e1', cursor: idx > 0 ? 'pointer' : 'not-allowed', lineHeight: 1.4 }}>‹ Prev</button>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#fff', border: '1.5px solid #1a56db', borderRadius: '8px', padding: '3px 13px', fontSize: '0.78rem', fontWeight: 700, color: '#1a56db', minWidth: '148px', justifyContent: 'center' }}>
                                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                                                {active ? new Date(active + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : ''}
                                                            </div>
                                                            <button onClick={() => setSummaryRescheduleMonthFilter(months[idx + 1])} disabled={idx >= months.length - 1} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '3px 9px', fontSize: '0.72rem', fontWeight: 600, color: idx < months.length - 1 ? '#475569' : '#cbd5e1', cursor: idx < months.length - 1 ? 'pointer' : 'not-allowed', lineHeight: 1.4 }}>Next ›</button>
                                                        </div>
                                                    </th></tr>
                                                );
                                            })()}
                                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                                {['Date', 'Session', 'Time', 'Type', 'Available', ''].map(h => (
                                                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {summaryRescheduleInfo.slots.filter(s => { const months = [...new Set(summaryRescheduleInfo.slots.map(x => x.date.slice(0, 7)))].sort(); const active = summaryRescheduleMonthFilter || months[0] || ''; return !active || s.date.startsWith(active); }).map(slot => (
                                                <tr key={slot.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '11px 16px', fontSize: '0.83rem', fontWeight: 600, color: '#1e293b' }}>
                                                        {(!slot.end_date || slot.date === slot.end_date)
                                                            ? new Date(slot.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                            : `${new Date(slot.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(slot.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                                                    </td>
                                                    <td style={{ padding: '11px 16px', fontSize: '0.83rem', color: '#334155' }}>{slot.session}</td>
                                                    <td style={{ padding: '11px 16px', fontSize: '0.83rem', color: '#334155', whiteSpace: 'nowrap' }}>{slot.time_range}</td>
                                                    <td style={{ padding: '11px 16px', fontSize: '0.83rem', color: '#334155' }}>
                                                        <span style={{ fontWeight: 600, color: '#1e293b' }}>{(slot.type || '').toUpperCase()}</span>
                                                        {(slot.course_type || slot.transmission) && <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>{[slot.course_type, slot.transmission].filter(Boolean).join(' · ')}</span>}
                                                    </td>
                                                    <td style={{ padding: '11px 16px' }}>
                                                        <span style={{
                                                            fontSize: '0.78rem', fontWeight: 700,
                                                            color: slot.available_slots <= 2 ? '#d97706' : '#166534',
                                                            background: slot.available_slots <= 2 ? '#fef3c7' : '#dcfce7',
                                                            padding: '2px 9px', borderRadius: '10px',
                                                            border: `1px solid ${slot.available_slots <= 2 ? '#fde68a' : '#bbf7d0'}`
                                                        }}>
                                                            {slot.available_slots} / {slot.total_capacity}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '11px 16px', textAlign: 'right' }}>
                                                        <button
                                                            onClick={() => confirmSummaryReschedule(slot.id)}
                                                            style={{
                                                                background: '#92400e', color: '#fff',
                                                                border: 'none', borderRadius: '8px', padding: '6px 18px',
                                                                fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                                                            }}
                                                        >
                                                            Select
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showPdcAssignModal && pdcAssignTarget && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1100,
                    background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(2px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '18px',
                }} onClick={() => !pdcAssignLoading && setShowPdcAssignModal(false)}>
                    <div style={{
                        width: '100%', maxWidth: '980px', background: 'var(--card-bg, #fff)', borderRadius: '14px',
                        boxShadow: '0 18px 46px rgba(0,0,0,0.2)', overflow: 'hidden',
                    }} onClick={(e) => e.stopPropagation()}>
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '16px 18px', borderBottom: '1px solid var(--border-color, #e2e8f0)',
                            background: 'linear-gradient(135deg,#eff6ff,#eef2ff)',
                        }}>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1e293b' }}>Assign PDC Schedules</div>
                                <div style={{ fontSize: '0.8rem', color: '#475569' }}>{pdcAssignTarget.student_name || 'Student'} • Earliest date: {pdcAssignTarget.minScheduleDate || '—'}</div>
                            </div>
                            <button
                                onClick={() => !pdcAssignLoading && setShowPdcAssignModal(false)}
                                style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.3rem', lineHeight: 1 }}
                            >×</button>
                        </div>

                        <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '14px 16px' }}>
                            {(() => {
                                const isHalf = (session) => {
                                    const s = String(session || '').toLowerCase();
                                    return s.includes('morning') || s.includes('afternoon') || s.includes('4 hours');
                                };
                                // Session normalization helper to detect overlaps accurately
                                const normalizeSessionKey = (session) => {
                                    const s = String(session || '').toLowerCase().trim();
                                    if (s.includes('morning')) return 'morning';
                                    if (s.includes('afternoon')) return 'afternoon';
                                    if (s.includes('whole') || s.includes('4 hours') || s.includes('8 hours') || !s || s === 'session') return 'whole';
                                    return s;
                                };

                                // Checks if a specific session on a date is already taken by the current student
                                // (either by another day of this course or by another course in this bundle)
                                const isSessionTaken = (slotDate, slotSession) => {
                                    if (!slotDate || !slotSession || !pdcAssignActiveCourseKey) return false;
                                    const slotKey = normalizeSessionKey(slotSession);
                                    
                                    return pdcAssignRows.some(row => {
                                        const isCurrentCourse = row.courseKey === pdcAssignActiveCourseKey;
                                        const entries = [];
                                        
                                        // If it's another course, check both days.
                                        // If it's the current course, only check the "other" day.
                                        if (row.date1 && row.session1 && (!isCurrentCourse || pdcAssignDayMode === 'day2')) {
                                            entries.push({ d: row.date1, s: row.session1 });
                                        }
                                        if (row.date2 && row.session2 && (!isCurrentCourse || pdcAssignDayMode === 'day1')) {
                                            entries.push({ d: row.date2, s: row.session2 });
                                        }
                                        
                                        return entries.some(e => {
                                            if (e.d !== slotDate) return false;
                                            const takenKey = normalizeSessionKey(e.s);
                                            return (takenKey === 'whole' || slotKey === 'whole' || takenKey === slotKey);
                                        });
                                    });
                                };

                                const activeIndex = pdcAssignRows.findIndex((row) => row.courseKey === pdcAssignActiveCourseKey);
                                const fallbackIndex = activeIndex >= 0 ? activeIndex : 0;
                                const activeRow = pdcAssignRows[fallbackIndex] || null;

                                const monthBase = pdcAssignCalendarMonth instanceof Date ? pdcAssignCalendarMonth : new Date();
                                const year = monthBase.getFullYear();
                                const month = monthBase.getMonth();
                                const firstDayWeek = new Date(year, month, 1).getDay();
                                const daysInMonth = new Date(year, month + 1, 0).getDate();
                                const calendarCells = [];
                                for (let i = 0; i < firstDayWeek; i += 1) calendarCells.push(null);
                                for (let day = 1; day <= daysInMonth; day += 1) calendarCells.push(day);
                                while (calendarCells.length % 7 !== 0) calendarCells.push(null);

                                const activeDay1Date = activeRow?.date1 || '';
                                const activeDay2Date = activeRow?.date2 || '';
                                const activeDateForMode = pdcAssignDayMode === 'day2' ? activeDay2Date : activeDay1Date;
                                const selectedSlotForMode = pdcAssignDayMode === 'day2' ? activeRow?.slot2 : activeRow?.slot1;

                                return (
                                    <>
                                        <div style={{
                                            border: '1px solid #bfdbfe', borderRadius: '12px', padding: '10px 12px',
                                            background: '#eff6ff', marginBottom: '12px',
                                        }}>
                                            <div style={{ fontSize: '0.78rem', color: '#1d4ed8', fontWeight: 800 }}>PDC Schedule Progress</div>
                                            <div style={{ fontSize: '0.78rem', color: '#1e3a8a', marginTop: '2px' }}>
                                                Completed {pdcAssignRows.filter((r) => !!r.slot1).length} of {pdcAssignRows.length} PDC course schedules
                                            </div>
                                        </div>

                                        <div style={{
                                            border: '1px solid #bbf7d0', borderRadius: '12px', padding: '10px 12px',
                                            background: '#f0fdf4', marginBottom: '12px',
                                        }}>
                                            <div style={{ fontSize: '0.78rem', color: '#15803d', fontWeight: 800 }}>TDC Schedule Selected</div>
                                            <div style={{ fontSize: '0.78rem', color: '#166534', marginTop: '2px' }}>
                                                OTDC completed on {pdcAssignTarget.completedDate || 'N/A'} — Earliest PDC date: {pdcAssignTarget.minScheduleDate || 'N/A'}
                                            </div>
                                        </div>

                                        <div className="walk-in-container" style={{ padding: 0 }}>
                                            <div className="type-selector-card" style={{ marginBottom: '12px', '--accent': '#3b82f6', '--card-bg': '#fff' }}>
                                                <div className="type-selector-title">Select PDC Course To Schedule</div>
                                                <div className="type-selector-sub">Each selected PDC course needs its own schedule.</div>
                                                <div className="type-btn-group" style={{ flexWrap: 'wrap' }}>
                                                    {pdcAssignRows.map((row) => {
                                                        const active = row.courseKey === (activeRow?.courseKey || null);
                                                        // done = slot1 selected AND (no day2 needed, OR slot2 also selected)
                                                        const done = !!row.slot1 && (!row.needsDay2 || !!row.slot2);
                                                        return (
                                                            <button
                                                                key={row.courseKey}
                                                                type="button"
                                                                className={`type-btn${active ? ' active' : ''}`}
                                                                onClick={() => {
                                                                    setPdcAssignActiveCourseKey(row.courseKey);
                                                                    setPdcAssignDayMode('day1');
                                                                }}
                                                            >
                                                                {done ? '✓ ' : ''}{row.courseName || `PDC Course ${pdcAssignRows.findIndex((x) => x.courseKey === row.courseKey) + 1}`}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                        {activeRow && (
                                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px' }}>
                                                {activeRow.slot1 && (!activeRow.needsDay2 || activeRow.slot2) && (
                                                    <div style={{ display: 'flex', gap: '12px', padding: '14px 16px', borderRadius: '10px', background: '#f0fdf4', border: '1px solid #bbf7d0', marginBottom: '16px' }}>
                                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}><polyline points="20 6 9 17 4 12" /></svg>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ color: '#15803d', fontWeight: 800, fontSize: '0.9rem', marginBottom: '4px' }}>Schedule Complete</div>
                                                            <div style={{ color: '#166534', fontSize: '0.8rem' }}>
                                                                Day 1: <strong>{new Date(activeRow.date1 + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                                                                {activeRow.slot2 && <> · Day 2: <strong>{new Date(activeRow.date2 + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></>}
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                            {activeRow.requiresDay2 && (
                                                                <button style={{ border: '1px solid #bbf7d0', background: '#dcfce7', color: '#15803d', borderRadius: '6px', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => { setPdcAssignRows((prev) => prev.map((r, ridx) => ridx === fallbackIndex ? { ...r, date2: '', slot2: '' } : r)); setPdcAssignDayMode('day2'); }}>
                                                                    Change Day 2
                                                                </button>
                                                            )}
                                                            <button style={{ border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', borderRadius: '6px', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => { setPdcAssignRows((prev) => prev.map((r, ridx) => ridx === fallbackIndex ? { ...r, date1: '', slot1: '', date2: '', slot2: '' } : r)); setPdcAssignDayMode('day1'); }}>
                                                                    Change Day 1
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {activeRow.slot1 && !activeRow.slot2 && activeRow.requiresDay2 && (
                                                    <div style={{ display: 'flex', gap: '12px', padding: '14px 16px', borderRadius: '10px', background: '#eff6ff', border: '1px solid #bfdbfe', marginBottom: '16px' }}>
                                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ color: '#1d4ed8', fontWeight: 800, fontSize: '0.9rem', marginBottom: '4px' }}>Day 2 Selection Required</div>
                                                            <div style={{ color: '#1e3a8a', fontSize: '0.8rem' }}>
                                                                Day 1: <strong>{new Date(activeRow.date1 + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>.<br/>Now pick a date for <strong>Day 2</strong>.
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'flex-start' }}>
                                                            <button style={{ border: '1px solid #bfdbfe', background: '#dbeafe', color: '#1d4ed8', borderRadius: '6px', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => { setPdcAssignRows((prev) => prev.map((r, ridx) => ridx === fallbackIndex ? { ...r, date1: '', slot1: '', date2: '', slot2: '' } : r)); setPdcAssignDayMode('day1'); }}>
                                                                Change Day 1
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {!(activeRow.slot1 && (!activeRow.needsDay2 || activeRow.slot2)) && (
                                                <>
                                                <div className="schedule-calendar-wrap">
                                                    <div className="month-nav-bar">
                                                        <button type="button" className="month-nav-btn-icon" disabled={pdcAssignLoading || pdcAssignMonthLoading} onClick={() => setPdcAssignCalendarMonth(new Date(year, month - 1, 1))}>
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
                                                        </button>
                                                        <h3 className="month-label">{monthBase.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
                                                        <button type="button" className="month-nav-btn-icon" disabled={pdcAssignLoading || pdcAssignMonthLoading} onClick={() => setPdcAssignCalendarMonth(new Date(year, month + 1, 1))}>
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                                                        </button>
                                                    </div>
                                                    <div className="cal-legend-row">
                                                        <div className="cal-legend-item morning-legend">
                                                            <span className="cal-legend-dot morning-dot"></span>
                                                            Morning
                                                        </div>
                                                        <div className="cal-legend-item afternoon-legend">
                                                            <span className="cal-legend-dot afternoon-dot"></span>
                                                            Afternoon
                                                        </div>
                                                        <div className="cal-legend-item whole-legend">
                                                            <span className="cal-legend-dot whole-dot"></span>
                                                            Whole Day
                                                        </div>
                                                    </div>
                                                    <div className="calendar-grid-7">
                                                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="cal-day-header">{d}</div>)}
                                                        {Array.from({ length: firstDayWeek }).map((_, i) => <div key={`pad-${i}`} className="cal-day cal-day--pad" />)}
                                                        
                                                        {Array.from({ length: daysInMonth }).map((_, i) => {
                                                            const d = i + 1;
                                                            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                                            const daySlots = Array.isArray(pdcAssignMonthSlotsMap[dateStr]) ? pdcAssignMonthSlotsMap[dateStr] : [];
                                                            const hasSlots = daySlots.length > 0;
                                                            
                                                            const targetDate = new Date();
                                                            const isToday = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}` === dateStr;
                                                            
                                                            const isDay2Active = pdcAssignDayMode === 'day2' && activeRow?.slot1;
                                                            const effectiveMinDate = [
                                                                pdcAssignTarget.minScheduleDate,
                                                                isDay2Active ? activeRow?.date1 : null
                                                            ].filter(Boolean).sort().pop();
                                                            const beforeMin = !!effectiveMinDate && dateStr < effectiveMinDate;
                                                            
                                                            const isSunday = new Date(year, month, d).getDay() === 0;
                                                            const isDisabled = beforeMin || isSunday || pdcAssignMonthLoading || pdcAssignLoading;
                                                            
                                                            // A day is considered disabled if it's generally disabled (Sunday, before min date)
                                                            // OR if all available sessions on that day are already taken by the student.
                                                            const allSessionsTaken = daySlots.length > 0 && daySlots.every(s => isSessionTaken(dateStr, s.session));
                                                            
                                                            const slotStatus = isDisabled ? '' : daySlots.length === 0 ? ' no-slots' : daySlots.every(s => Number(s.availableSlots || 0) === 0) ? ' full-slots' : ' has-slots';
                                                            let cls = 'cal-day' + slotStatus;
                                                            if (isDisabled || allSessionsTaken) cls += ' cal-day--disabled';
                                                            if (isToday) cls += ' cal-day--today';

                                                            return (
                                                                <div key={d} className={cls}>
                                                                    <div className="cal-day-header-mini">
                                                                        <span className="cal-day-num">{d}</span>
                                                                        {isToday && <span className="cal-day--today-dot" />}
                                                                    </div>
                                                                    {!isDisabled && (
                                                                        <div className="day-slots-container">
                                                                            {(() => {
                                                                                const morningSlots = daySlots.filter(s => (s.session || '').toLowerCase().includes('morning'));
                                                                                const afternoonSlots = daySlots.filter(s => (s.session || '').toLowerCase().includes('afternoon'));
                                                                                const wholeDaySlots = daySlots.filter(s => (s.session || '').toLowerCase().includes('whole'));

                                                                                // When selecting Day 2, enforce the same session type as Day 1.
                                                                                const day1SessionKey = pdcAssignDayMode === 'day2' ? normalizeSessionKey(activeRow?.session1 || '') : null;

                                                                                const renderSubBox = (label, slots, type) => {
                                                                                    if (!slots || slots.length === 0) return null;
                                                                                    const anySelected = slots.some(s => String(selectedSlotForMode || '') === String(s.id));
                                                                                    const isFull = slots.every(s => Number(s.availableSlots || 0) <= 0);
                                                                                    const isTaken = isSessionTaken(dateStr, type);

                                                                                    // For Day 2: disable any session that doesn't exactly match Day 1's session type.
                                                                                    // e.g. if Day 1 = Morning → only Morning allowed for Day 2 (Afternoon & Whole Day disabled).
                                                                                    const isWrongSession = day1SessionKey !== null
                                                                                        && day1SessionKey !== 'whole'
                                                                                        && normalizeSessionKey(type) !== day1SessionKey;

                                                                                    const effectivelyDisabled = isFull || isTaken || isWrongSession;
                                                                                    const disabledTitle = isWrongSession
                                                                                        ? `Day 2 must use the same session as Day 1 (${day1SessionKey}).`
                                                                                        : isTaken
                                                                                            ? 'Session overlaps with your other scheduled course.'
                                                                                            : undefined;

                                                                                    return (
                                                                                        <div
                                                                                            key={type}
                                                                                            className={`session-sub-box ${type}${anySelected ? ' selected' : ''}${isFull ? ' full' : ''}${(isTaken || isWrongSession) ? ' type-btn--disabled' : ''}`}
                                                                                            onClick={async (e) => {
                                                                                                e.stopPropagation();
                                                                                                if (effectivelyDisabled || pdcAssignLoading || pdcAssignMonthLoading) return;
                                                                                                
                                                                                                const slot = slots[0];
                                                                                                
                                                                                                if (pdcAssignDayMode === 'day2') {
                                                                                                    setPdcAssignRows((prev) => prev.map((r, ridx) => (
                                                                                                        ridx === fallbackIndex ? { ...r, date2: dateStr, slot2: String(slot.id), session2: slot.session } : r
                                                                                                    )));
                                                                                                    if (activeDay2Date !== dateStr) {
                                                                                                        await loadPdcAssignRowSlots(fallbackIndex, 'day2', dateStr, null, activeRow);
                                                                                                    }
                                                                                                } else {
                                                                                                    const isSplitDay = activeRow.requiresDay2 || isTwoDayPdcVariant(activeRow);
                                                                                                    const needsDay2 = isSplitDay && isHalf(slot.session);
                                                                                                    
                                                                                                    setPdcAssignRows((prev) => prev.map((r, ridx) => (
                                                                                                        ridx === fallbackIndex ? { ...r, date1: dateStr, slot1: String(slot.id), session1: slot.session, needsDay2, requiresDay2: isSplitDay } : r
                                                                                                    )));
                                                                                                    if (needsDay2) {
                                                                                                        setPdcAssignDayMode('day2');
                                                                                                    }
                                                                                                    if (activeDay1Date !== dateStr) {
                                                                                                        await loadPdcAssignRowSlots(fallbackIndex, 'day1', dateStr, null, activeRow);
                                                                                                    }
                                                                                                }
                                                                                            }}
                                                                                            title={disabledTitle}
                                                                                        >
                                                                                            <div className="session-sub-content">
                                                                                                <div className="flex items-center justify-between gap-1 leading-none mb-1">
                                                                                                    <span className="session-sub-label-text text-[9px] font-black">{label} Class</span>
                                                                                                    <span className="session-sub-count-tag text-[8px] font-bold px-1 rounded bg-white/20">
                                                                                                        {isWrongSession ? 'N/A' : isFull ? 'FULL' : `${Number(slots[0].availableSlots || 0)} Slots`}
                                                                                                    </span>
                                                                                                </div>
                                                                                                <div className="session-sub-time-mini text-[7px] font-medium opacity-80" style={{ marginTop: '2px' }}>{isWrongSession ? `Match Day 1` : slots[0].timeRange || 'Time not set'}</div>
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                };

                                                                                return (
                                                                                    <>
                                                                                        {renderSubBox('Morning', morningSlots, 'morning')}
                                                                                        {renderSubBox('Afternoon', afternoonSlots, 'afternoon')}
                                                                                        {renderSubBox('Whole Day', wholeDaySlots, 'whole')}
                                                                                    </>
                                                                                );
                                                                            })()}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                                </>
                                                )}
                                            </div>
                                        )}
                                        </div>
                                    </>
                                );
                            })()}
                        </div>

                        <div style={{
                            display: 'flex', justifyContent: 'flex-end', gap: '10px',
                            padding: '12px 16px 14px', borderTop: '1px solid var(--border-color, #e2e8f0)', background: '#f8fafc',
                        }}>
                            <button
                                onClick={() => !pdcAssignLoading && setShowPdcAssignModal(false)}
                                disabled={pdcAssignLoading}
                                style={{ background: '#fff', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 14px', fontWeight: 700, cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmPdcAssignments}
                                disabled={pdcAssignLoading}
                                style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 14px', fontWeight: 700, cursor: 'pointer' }}
                            >
                                {pdcAssignLoading ? 'Assigning...' : 'Confirm Assignment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Student Summary Detail Modal ─────────────────────────── */}
            {summaryStudentModal && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(2px)',
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                    padding: '32px 16px', overflowY: 'auto',
                }} onClick={() => { setSummaryStudentModal(null); setSummaryRescheduleInfo(null); }}>
                    <div style={{
                        background: 'var(--card-bg, #fff)', borderRadius: '18px',
                        width: '100%', maxWidth: '960px',
                        boxShadow: '0 24px 72px rgba(0,0,0,0.22)',
                        overflow: 'hidden', flexShrink: 0,
                    }} onClick={e => e.stopPropagation()}>

                        {/* ── Header ── */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '24px 28px 20px',
                            borderBottom: '1px solid var(--border-color, #e2e8f0)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{
                                    width: '54px', height: '54px', borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #1a56db 0%, #3b82f6 100%)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#fff', fontSize: '1.4rem', fontWeight: 700, flexShrink: 0,
                                    boxShadow: '0 4px 12px rgba(26,86,219,0.3)',
                                }}>
                                    {summaryStudentModal.scheduleInfo?.name?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                                <div>
                                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-color)', lineHeight: 1.2 }}>
                                        {summaryStudentModal.loading
                                            ? 'Loading…'
                                            : [summaryStudentModal.student?.first_name, summaryStudentModal.student?.middle_name, summaryStudentModal.student?.last_name].filter(Boolean).join(' ')}
                                    </div>
                                    <div style={{ fontSize: '0.82rem', color: 'var(--secondary-text)', marginTop: '3px' }}>
                                        Student Profile &amp; Payment Details
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => { setSummaryStudentModal(null); setSummaryRescheduleInfo(null); }} style={{
                                background: 'var(--hover-bg, #f1f5f9)', border: 'none', borderRadius: '8px',
                                width: '36px', height: '36px', cursor: 'pointer', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', color: 'var(--secondary-text)',
                                flexShrink: 0,
                            }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        {/* ── Body ── */}
                        <div style={{ padding: '24px 28px 32px', maxHeight: 'calc(90vh - 100px)', overflowY: 'auto' }}>

                        {summaryStudentModal.loading ? (
                            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--secondary-text)' }}>
                                <div style={{ fontSize: '2rem', marginBottom: '10px', opacity: 0.3 }}>⏳</div>
                                <div>Loading student details…</div>
                            </div>
                        ) : (<>

                        {/* ── Quick Actions ── */}
                        {!summaryStudentModal.loading && (() => {
                            const si = summaryStudentModal.scheduleInfo;
                            const isTdcOnline = si?.source === 'tdc_online' || /otdc|online/i.test(si?.course_name || si?.course_type || '');
                            const isNoShow = si?.status === 'no-show';
                            const isCompleted = (si?.booking_status || si?.status) === 'completed';
                            const feePaid = si?.reschedule_fee_paid;
                            const canReschedule = isNoShow && feePaid;
                            const notesJson = parseNotesJson(si?.notes);
                            const isOnboarded = !!notesJson?.tdcOnlineOnboarded;
                            return (
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    background: 'var(--hover-bg, #f8fafc)', borderRadius: '12px',
                                    border: '1px solid var(--border-color, #e2e8f0)',
                                    padding: '14px 20px', marginBottom: '20px', gap: '12px', flexWrap: 'wrap',
                                }}>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--secondary-text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Actions</div>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        {isTdcOnline && !isOnboarded && (
                                             <button
                                                 onClick={() => handleTdcOnlineMarkDone(si?.booking_id)}
                                                 style={{
                                                     display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                     padding: '7px 16px', borderRadius: '8px', border: 'none',
                                                     background: '#dcfce7', color: '#166534', cursor: 'pointer',
                                                     fontSize: '0.82rem', fontWeight: 700,
                                                 }}
                                             >
                                                 <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                 Mark Done
                                             </button>
                                         )}

                                         {!isNoShow && (
                                             <>
                                                 <button
                                                     onClick={() => isTdcOnline 
                                                         ? handleTdcOnlineMarkComplete(si?.booking_id, si?.booking_status || si?.status)
                                                         : handleSummaryAttendance(si?.enrollment_id, si?.status)
                                                     }
                                                     style={{
                                                         display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                         padding: '7px 16px', borderRadius: '8px', border: 'none',
                                                         background: isCompleted ? '#f1f5f9' : '#dbeafe',
                                                         color: isCompleted ? '#64748b' : '#1d4ed8',
                                                         cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700,
                                                     }}
                                                 >
                                                     {isCompleted
                                                         ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12l5 5L20 5"/></svg>Undo Complete</>
                                                         : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>Mark Complete</>}
                                                 </button>
                                                {!isTdcOnline && (
                                                    <button
                                                        onClick={() => handleSummaryNoShow(si?.enrollment_id, summaryStudentModal.student ? [summaryStudentModal.student.first_name, summaryStudentModal.student.last_name].join(' ') : si?.name)}
                                                        style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                            padding: '7px 16px', borderRadius: '8px', border: 'none',
                                                            background: '#fee2e2', color: '#b91c1c',
                                                            cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700,
                                                        }}
                                                    >
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                                                        No-Show
                                                    </button>
                                                )}
                                            </>
                                        )}
                                        {isNoShow && !feePaid && (
                                            <button
                                                onClick={() => handleSummaryMarkFeePaid(si?.enrollment_id)}
                                                title={`Confirm ₱${si?.type?.toLowerCase() === 'tdc' ? '300' : '1,000'} no-show fee has been collected`}
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                    padding: '7px 16px', borderRadius: '8px', border: 'none',
                                                    background: '#dcfce7', color: '#166534',
                                                    cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700,
                                                }}
                                            >
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
                                                Mark Fee Paid (₱{si?.type?.toLowerCase() === 'tdc' ? '300' : '1,000'})
                                            </button>
                                        )}
                                        {!isTdcOnline && (
                                            <button
                                                onClick={() => canReschedule ? openSummaryReschedulePanel(si?.enrollment_id, summaryStudentModal.student ? [summaryStudentModal.student.first_name, summaryStudentModal.student.last_name].join(' ') : si?.name, si?.slot_id, si?.type, si?.branch_id, si?.course_type, si?.transmission) : null}
                                                disabled={!canReschedule}
                                                title={!isNoShow ? 'Student must be marked No-Show first' : !feePaid ? `Student must pay the ₱${si?.type?.toLowerCase() === 'tdc' ? '300' : '1,000'} no-show fee first` : 'Reschedule Student'}
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                    padding: '7px 16px', borderRadius: '8px', border: 'none',
                                                    background: canReschedule ? '#fef3c7' : '#f1f5f9',
                                                    color: canReschedule ? '#92400e' : '#94a3b8',
                                                    cursor: canReschedule ? 'pointer' : 'not-allowed',
                                                    fontSize: '0.82rem', fontWeight: 700,
                                                    opacity: canReschedule ? 1 : 0.6,
                                                }}
                                            >
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                                                Reschedule
                                                {!canReschedule && (
                                                    <span style={{ fontSize: '0.7rem', fontWeight: 600, marginLeft: '2px' }}>
                                                        {!isNoShow ? '(No-Show req.)' : '(Fee req.)'}
                                                    </span>
                                                )}
                                            </button>
                                        )}

                                    </div>
                                </div>
                            );
                        })()}

                        {/* ── Reschedule Panel (shown inline when active) ── */}
                        {summaryRescheduleInfo && (
                            <div style={{
                                borderRadius: '12px', border: '2px solid #fde68a',
                                background: '#fffbeb', marginBottom: '20px', overflow: 'hidden',
                            }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '12px 18px', borderBottom: '1px solid #fde68a',
                                    background: '#fef3c7',
                                }}>
                                    <button
                                        onClick={() => setSummaryRescheduleInfo(null)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400e', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem', fontWeight: 700 }}
                                    >
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                                        Cancel
                                    </button>
                                    <div style={{ width: '1px', height: '18px', background: '#fde68a' }} />
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#78350f' }}>
                                        Reschedule: {summaryRescheduleInfo.studentName} — <span style={{ fontWeight: 400 }}>{summaryRescheduleInfo.courseLabel || 'Select a new slot'}</span>
                                    </div>
                                </div>
                                {summaryRescheduleInfo.loadingSlots ? (
                                    <div style={{ padding: '30px', textAlign: 'center', color: '#92400e', fontSize: '0.85rem' }}>Loading available slots…</div>
                                ) : summaryRescheduleInfo.slots.length === 0 ? (
                                    <div style={{ padding: '30px', textAlign: 'center', color: '#92400e', fontSize: '0.85rem' }}>No upcoming slots with open capacity found.</div>
                                ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '560px' }}>
                                            <thead>
                                                {(() => {
                                                    const months = [...new Set(summaryRescheduleInfo.slots.map(s => s.date.slice(0, 7)))].sort();
                                                    const active = summaryRescheduleMonthFilter || months[0] || '';
                                                    const idx = months.indexOf(active);
                                                    return (
                                                        <tr><th colSpan="6" style={{ padding: '7px 14px', background: '#fef9ec', borderBottom: '1px solid #fde68a' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                                <button onClick={() => setSummaryRescheduleMonthFilter(months[idx - 1])} disabled={idx <= 0} style={{ background: 'none', border: '1px solid #fde68a', borderRadius: '6px', padding: '3px 9px', fontSize: '0.72rem', fontWeight: 600, color: idx > 0 ? '#92400e' : '#f6d28a', cursor: idx > 0 ? 'pointer' : 'not-allowed', lineHeight: 1.4 }}>‹ Prev</button>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#fff', border: '1.5px solid #92400e', borderRadius: '8px', padding: '3px 13px', fontSize: '0.78rem', fontWeight: 700, color: '#92400e', minWidth: '148px', justifyContent: 'center' }}>
                                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                                                    {active ? new Date(active + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : ''}
                                                                </div>
                                                                <button onClick={() => setSummaryRescheduleMonthFilter(months[idx + 1])} disabled={idx >= months.length - 1} style={{ background: 'none', border: '1px solid #fde68a', borderRadius: '6px', padding: '3px 9px', fontSize: '0.72rem', fontWeight: 600, color: idx < months.length - 1 ? '#92400e' : '#f6d28a', cursor: idx < months.length - 1 ? 'pointer' : 'not-allowed', lineHeight: 1.4 }}>Next ›</button>
                                                            </div>
                                                        </th></tr>
                                                    );
                                                })()}
                                                <tr style={{ borderBottom: '1px solid #fde68a' }}>
                                                    {['Date', 'Session', 'Time', 'Type', 'Available', ''].map(h => (
                                                        <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {summaryRescheduleInfo.slots.filter(s => { const months = [...new Set(summaryRescheduleInfo.slots.map(x => x.date.slice(0, 7)))].sort(); const active = summaryRescheduleMonthFilter || months[0] || ''; return !active || s.date.startsWith(active); }).map(slot => (
                                                    <tr key={slot.id} style={{ borderBottom: '1px solid #fef3c7' }}>
                                                        <td style={{ padding: '10px 14px', fontSize: '0.83rem', fontWeight: 600, color: '#1e293b' }}>
                                                            {(!slot.end_date || slot.date === slot.end_date)
                                                                ? new Date(slot.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                                : `${new Date(slot.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(slot.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                                                        </td>
                                                        <td style={{ padding: '10px 14px', fontSize: '0.83rem', color: '#334155' }}>{slot.session}</td>
                                                        <td style={{ padding: '10px 14px', fontSize: '0.83rem', color: '#334155', whiteSpace: 'nowrap' }}>{slot.time_range}</td>
                                                        <td style={{ padding: '10px 14px', fontSize: '0.83rem', color: '#334155' }}>
                                                            <span style={{ fontWeight: 600, color: '#1e293b' }}>{(slot.type || '').toUpperCase()}</span>
                                                            {(slot.course_type || slot.transmission) && <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>{[slot.course_type, slot.transmission].filter(Boolean).join(' · ')}</span>}
                                                        </td>
                                                        <td style={{ padding: '10px 14px' }}>
                                                            <span style={{
                                                                fontSize: '0.78rem', fontWeight: 700,
                                                                color: slot.available_slots <= 2 ? '#d97706' : '#166534',
                                                                background: slot.available_slots <= 2 ? '#fef3c7' : '#dcfce7',
                                                                padding: '2px 9px', borderRadius: '10px',
                                                                border: `1px solid ${slot.available_slots <= 2 ? '#fde68a' : '#bbf7d0'}`
                                                            }}>{slot.available_slots} / {slot.total_capacity}</span>
                                                        </td>
                                                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                                            <button
                                                                onClick={() => confirmSummaryReschedule(slot.id)}
                                                                style={{
                                                                    background: '#92400e', color: '#fff',
                                                                    border: 'none', borderRadius: '8px', padding: '6px 16px',
                                                                    fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                                                                }}
                                                            >Select</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Current Schedule ── */}
                        <div style={{ marginBottom: '24px' }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-color, #1a56db)',
                                textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px',
                            }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                {summaryStudentModal.scheduleInfo?.source === 'tdc_online' ? 'Current Enrollment' : 'Current Schedule'}
                            </div>
                            <div style={{
                                background: 'var(--hover-bg, #f8fafc)', borderRadius: '12px',
                                border: '1px solid var(--border-color, #e2e8f0)', padding: '18px 20px',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: '16px 12px',
                            }}>
                                {(() => {
                                    const si = summaryStudentModal.scheduleInfo;
                                    if (si?.source === 'tdc_online') {
                                        const enrolledOn = si?.created_at
                                            ? new Date(si.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                                            : '—';
                                        return [
                                            ['Course', si?.course_type || 'TDC Online', {}],
                                            ['Type', 'TDC', {}],
                                            ['Mode', 'Online', {}],
                                            ['Status', si?.booking_status ? si.booking_status.charAt(0).toUpperCase() + si.booking_status.slice(1) : '—', {}],
                                            ['Enrolled On', enrolledOn, {}],
                                            ['Payment Type', si?.payment_type || '—', {}],
                                            ['Payment Method', si?.payment_method || '—', {}],
                                            ['Branch', si?.branch_name || '—', { gridColumn: 'span 2' }],
                                            ['Booking ID', si?.booking_id || '—', {}],
                                        ].map(([label, value, spanStyle]) => (
                                            <div key={label} style={spanStyle}>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--secondary-text)', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-color)', lineHeight: 1.3 }}>{value || '—'}</div>
                                            </div>
                                        ));
                                    }

                                    const dateStr = si?.slot_date
                                        ? (si.slot_date === si.slot_end_date
                                            ? new Date(si.slot_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                                            : `${new Date(si.slot_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(si.slot_end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`)
                                        : '—';
                                    return [
                                        ['Course', si?.course_type, {}],
                                        ['Type', si?.type?.toUpperCase(), {}],
                                        ['Transmission', si?.transmission || '—', {}],
                                        ['Session', si?.session || '—', {}],
                                        ['Date', dateStr, {}],
                                        ['Time', si?.time_range || '—', {}],
                                        ['Branch', si?.branch_name || '—', { gridColumn: 'span 2' }],
                                        ['Enrollment', si?.status ? si.status.charAt(0).toUpperCase() + si.status.slice(1) : '—', {}],
                                    ].map(([label, value, spanStyle]) => (
                                        <div key={label} style={spanStyle}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--secondary-text)', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-color)', lineHeight: 1.3 }}>{value || '—'}</div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>

                        {/* ── Personal Information ── */}
                        <div style={{ marginBottom: '24px' }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-color, #1a56db)',
                                textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px',
                            }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                Personal Information
                            </div>
                            <div style={{
                                background: 'var(--hover-bg, #f8fafc)', borderRadius: '12px',
                                border: '1px solid var(--border-color, #e2e8f0)', padding: '18px 20px',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, 1fr)',
                                gap: '16px 24px',
                            }}>
                                {(() => {
                                    const st = summaryStudentModal.student;
                                    return [
                                        ['Email', st?.email],
                                        ['Contact Number', st?.contact_numbers],
                                        ['Gender', st?.gender],
                                        ['Birthday', st?.birthday ? new Date(st.birthday + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null],
                                        ['Age', st?.age],
                                        ['Birth Place', st?.birth_place],
                                        ['Nationality', st?.nationality],
                                        ['Marital Status', st?.marital_status],
                                        ['Zip Code', st?.zip_code],
                                        ['Emergency Contact', st?.emergency_contact_person],
                                        ['Emergency Number', st?.emergency_contact_number],
                                        ['Address', st?.address],
                                    ].filter(([, v]) => v != null && v !== '').map(([label, value]) => (
                                        <div key={label} style={label === 'Address' ? { gridColumn: 'span 3' } : {}}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--secondary-text)', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-color)', lineHeight: 1.4, wordBreak: 'break-word' }}>{value}</div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>

                        {/* ── Booking & Payment History ── */}
                        <div>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-color, #1a56db)',
                                textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px',
                            }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
                                Booking &amp; Payment History
                            </div>
                            {!summaryStudentModal.bookings?.length ? (
                                <div style={{
                                    background: 'var(--hover-bg, #f8fafc)', borderRadius: '12px',
                                    border: '1px solid var(--border-color, #e2e8f0)',
                                    padding: '40px 20px', textAlign: 'center',
                                    color: 'var(--secondary-text)', fontSize: '0.88rem',
                                }}>No booking records found.</div>
                            ) : (
                                <div className="admin-table-responsive" style={{ borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                                        <thead>
                                            <tr style={{ background: 'var(--hover-bg, #f8fafc)', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                                                {['#', 'Course', 'Branch', 'Date', 'Amount', 'Payment Type', 'Method', 'Status'].map(h => (
                                                    <th key={h} style={{
                                                        padding: '11px 14px', textAlign: 'left',
                                                        fontSize: '0.72rem', fontWeight: 700,
                                                        color: 'var(--secondary-text)', textTransform: 'uppercase',
                                                        letterSpacing: '0.04em', whiteSpace: 'nowrap',
                                                    }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {summaryStudentModal.bookings.map((bk, i) => (
                                                <tr key={i} style={{ borderBottom: i < summaryStudentModal.bookings.length - 1 ? '1px solid var(--border-color, #e2e8f0)' : 'none' }}>
                                                    <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: 'var(--secondary-text)', fontWeight: 600, width: '36px' }}>{i + 1}</td>
                                                    <td style={{ padding: '12px 14px', minWidth: '160px' }}>
                                                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-color)', lineHeight: 1.3 }}>{bk.course_name || '—'}</div>
                                                        {bk.course_type && bk.course_type.toLowerCase() !== bk.payment_method?.toLowerCase() && (
                                                            <div style={{ fontSize: '0.72rem', color: 'var(--secondary-text)', marginTop: '2px', textTransform: 'capitalize' }}>{bk.course_type}</div>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: 'var(--text-color)', minWidth: '140px', lineHeight: 1.4 }}>{bk.branch_name || '—'}</td>
                                                    <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: 'var(--text-color)', whiteSpace: 'nowrap' }}>
                                                        {bk.booking_date
                                                            ? new Date(bk.booking_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                            : new Date(bk.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </td>
                                                    <td style={{ padding: '12px 14px', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-color)', whiteSpace: 'nowrap' }}>
                                                        {bk.total_amount != null ? `₱${Number(bk.total_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}
                                                    </td>
                                                    <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: 'var(--text-color)', whiteSpace: 'nowrap' }}>{bk.payment_type || '—'}</td>
                                                    <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: 'var(--text-color)', whiteSpace: 'nowrap' }}>{bk.payment_method || '—'}</td>
                                                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                                        <span style={{
                                                            display: 'inline-block', padding: '3px 10px', borderRadius: '20px',
                                                            fontSize: '0.75rem', fontWeight: 700, textTransform: 'capitalize',
                                                            background:
                                                                bk.status === 'confirmed' || bk.status === 'completed' ? '#dcfce7' :
                                                                bk.status === 'cancelled' ? '#fee2e2' :
                                                                bk.status === 'paid' ? '#dbeafe' : '#fef9c3',
                                                            color:
                                                                bk.status === 'confirmed' || bk.status === 'completed' ? '#166534' :
                                                                bk.status === 'cancelled' ? '#991b1b' :
                                                                bk.status === 'paid' ? '#1d4ed8' : '#854d0e',
                                                        }}>{bk.status}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        </>)}
                        </div>{/* end body */}
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                isDestructive={confirmModal.isDestructive}
            />

            {/* ── Fee Payment Modal (walk-in admin recording) ── */}
            {feePayModal.isOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 2100, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
                    onClick={() => setFeePayModal(prev => ({ ...prev, isOpen: false }))}>
                    <div style={{ background: '#fff', borderRadius: '18px', width: '100%', maxWidth: '420px', overflow: 'hidden', boxShadow: '0 24px 72px rgba(0,0,0,0.25)' }}
                        onClick={e => e.stopPropagation()}>
                        {/* Header strip */}
                        <div style={{ background: 'linear-gradient(135deg, #166534 0%, #16a34a 100%)', padding: '20px 24px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                                </div>
                                <div>
                                    <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.05rem' }}>Record Fee Payment</div>
                                    <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.78rem' }}>Walk-in ₱{feePayModal?.amount || '1,000'} No-Show Reschedule Fee</div>
                                </div>
                            </div>
                        </div>
                        {/* Body */}
                        <div style={{ padding: '24px' }}>
                            <div style={{ marginBottom: '18px' }}>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Amount Collected (₱)</label>
                                <input
                                    type="text"
                                    readOnly
                                    value={feePayModal.amount}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#f8fafc', fontSize: '1.05rem', fontWeight: 700, color: '#64748b', outline: 'none', boxSizing: 'border-box', cursor: 'not-allowed' }}
                                />
                            </div>
                            <div style={{ marginBottom: '18px' }}>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Payment Method</label>
                                <select
                                    value={feePayModal.paymentMethod}
                                    onChange={e => setFeePayModal(prev => ({ ...prev, paymentMethod: e.target.value }))}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', fontWeight: 600, color: '#1e293b', outline: 'none', background: '#fff', boxSizing: 'border-box' }}
                                >
                                    <option value="Cash">Cash</option>
                                    <option value="Starpay">Starpay</option>
                                    <option value="Bank Transfer">Bank Transfer</option>
                                    <option value="MetroBank">MetroBank</option>
                                </select>
                            </div>
                            {feePayModal.paymentMethod !== 'Cash' && (
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Transaction Number</label>
                                <input
                                    type="text"
                                    placeholder="e.g. TXN-20260310-001"
                                    value={feePayModal.transactionNumber}
                                    onChange={e => setFeePayModal(prev => ({ ...prev, transactionNumber: e.target.value }))}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', fontWeight: 600, color: '#1e293b', outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>
                            )}
                            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px 14px', marginBottom: '20px', fontSize: '0.82rem', color: '#166534' }}>
                                <strong>Note:</strong> This records that the student paid the reschedule fee in person. The student will then be eligible for rescheduling.
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    onClick={() => setFeePayModal(prev => ({ ...prev, isOpen: false }))}
                                    style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmFeePayment}
                                    style={{ flex: 1.5, padding: '10px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #166534 0%, #16a34a 100%)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}
                                >
                                    Confirm Payment Received
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Schedule;
