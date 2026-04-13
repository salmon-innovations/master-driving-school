const pool = require('../config/db');
const { withCache, bustCache } = require('../config/db');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const {
  generateRandomPassword,
  sendPasswordEmail,
  generateVerificationCode,
  sendVerificationEmail,
  sendWalkInEnrollmentEmail,
  sendEnrollmentEmail,
  sendNoShowEmail,
  sendNewsPromoEmail,
  sendPaymentReceiptEmail,
  reloadEmailContent,
  sendTestEmail,
  sendPdcScheduleAssignedEmail,
} = require('../utils/emailService');

const EMAIL_CONTENT_PATH = path.join(__dirname, '../config/emailContent.json');
const ADDONS_CONFIG_PATH = path.join(__dirname, '../config/addonsConfig.json');
const { parseBookingFinancials } = require('../utils/financeUtils');

let permissionsColumnReady = false;

const PERMISSION_GROUPS = [
  {
    id: 'main_menu',
    permissions: [
      'operations.schedules.manage',
      'operations.bookings.manage',
      'operations.walk_in.manage',
      'operations.sales.manage',
      'operations.crm.manage',
      'operations.news.manage',
      'operations.analytics.view',
      'operations.best_selling_courses.view',
    ],
  },
  {
    id: 'management_menu',
    permissions: [
      'accounts.courses.view',
      'accounts.config.view',
    ],
  },
  {
    id: 'course_management_tabs',
    permissions: [
      'accounts.courses.tab.courses',
      'accounts.courses.tab.discounts',
      'accounts.courses.tab.config',
    ],
  },
  {
    id: 'config_management_tabs',
    permissions: [
      'accounts.config.tab.branches',
      'accounts.config.tab.roles',
      'accounts.config.tab.coursetypes',
      'accounts.config.tab.emailcontent',
      'accounts.config.tab.settings',
      'accounts.config.tab.backup',
    ],
  },
  {
    id: 'schedule_page_tabs',
    permissions: [
      'operations.schedules.tab.schedule',
      'operations.schedules.tab.summary',
      'operations.schedules.tab.noshow',
      'operations.schedules.tab.tdc_online',
    ],
  },
  {
    id: 'account_actions',
    permissions: [
      'accounts.users.create',
      'accounts.users.edit',
      'accounts.users.status',
      'accounts.users.reset_password',
    ],
  },
];

const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((group) => group.permissions);
const ALLOWED_PERMISSION_KEYS = new Set(ALL_PERMISSION_KEYS);

const ROLE_PERMISSION_PRESETS = {
  super_admin: [...ALL_PERMISSION_KEYS],
  admin: [
    'operations.schedules.manage',
    'operations.schedules.tab.schedule',
    'operations.schedules.tab.summary',
    'operations.schedules.tab.noshow',
    'operations.schedules.tab.tdc_online',
    'operations.bookings.manage',
    'operations.walk_in.manage',
    'operations.sales.manage',
    'operations.crm.manage',
    'operations.analytics.view',
    'operations.best_selling_courses.view',
    'operations.news.manage',
    'accounts.courses.view',
    'accounts.courses.tab.courses',
    'accounts.courses.tab.discounts',
    'accounts.courses.tab.config',
    'accounts.config.view',
    'accounts.config.tab.branches',
    'accounts.config.tab.coursetypes',
    'accounts.config.tab.emailcontent',
    'accounts.config.tab.settings',
    'accounts.users.create',
    'accounts.users.edit',
    'accounts.users.reset_password',
  ],
};

const ensureUserPermissionsColumn = async () => {
  if (permissionsColumnReady) return;

  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb`);
  await pool.query(`UPDATE users SET permissions = '[]'::jsonb WHERE permissions IS NULL`);

  permissionsColumnReady = true;
};

const normalizePermissions = (permissions) => {
  if (!Array.isArray(permissions)) return [];
  return [
    ...new Set(
      permissions.filter(
        (permission) => typeof permission === 'string'
          && permission.trim().length > 0
          && ALLOWED_PERMISSION_KEYS.has(permission)
      )
    )
  ];
};

const getRoleDefaultPermissions = (role) => {
  const normalizedRole = String(role || '').toLowerCase();
  return [...(ROLE_PERMISSION_PRESETS[normalizedRole] || [])];
};

const getUserBranchScope = async (user = {}) => {
  const role = String(user.role || '').toLowerCase();
  const userId = user.id;

  if (role === 'super_admin') {
    return { role, branchId: null, canViewAll: true };
  }

  const userRow = await pool.query('SELECT branch_id FROM users WHERE id = $1', [userId]);
  const branchId = userRow.rows.length > 0 ? userRow.rows[0].branch_id : null;

  if (role === 'admin') {
    // Admin with null branch_id means "All Branches".
    return { role, branchId, canViewAll: !branchId };
  }

  // Other roles are always branch-scoped.
  return { role, branchId, canViewAll: false };
};

const GLOBAL_B1B2_DAILY_CAPACITY = 2;
const isB1B2CourseType = (courseType = '') => {
  const src = String(courseType || '').toLowerCase();
  return src.includes('b1') || src.includes('b2') || src.includes('van') || src.includes('l300');
};

const getGlobalB1B2BookedCount = async (dbClient, date, excludeStudentId = null) => {
  const params = [date];
  let excludeClause = '';
  if (excludeStudentId) {
    params.push(excludeStudentId);
    excludeClause = ` AND se.student_id <> $${params.length}`;
  }

  const result = await dbClient.query(
    `SELECT COUNT(DISTINCT se.student_id) AS booked_count
       FROM schedule_enrollments se
       JOIN schedule_slots ss ON ss.id = se.slot_id
      WHERE ss.date = $1
        AND (ss.course_type ILIKE '%B1%' OR ss.course_type ILIKE '%B2%' OR ss.course_type ILIKE '%VAN%' OR ss.course_type ILIKE '%L300%')
        AND se.enrollment_status NOT IN ('cancelled', 'no-show')
        ${excludeClause}`,
    params
  );

  return Number(result.rows[0]?.booked_count || 0);
};

const assertB1B2CapacityForSlot = async (dbClient, slotId, excludeStudentId = null, slotRow = null) => {
  let slot = slotRow;
  if (!slot) {
    const slotResult = await dbClient.query(
      `SELECT id, date, course_type FROM schedule_slots WHERE id = $1 LIMIT 1`,
      [slotId]
    );
    slot = slotResult.rows[0] || null;
  }

  if (!slot || !isB1B2CourseType(slot.course_type)) {
    return;
  }

  const booked = await getGlobalB1B2BookedCount(dbClient, slot.date, excludeStudentId);
  if (booked >= GLOBAL_B1B2_DAILY_CAPACITY) {
    throw new Error(`The B1/B2 Van/L300 units are fully booked for ${slot.date} across all branches.`);
  }
};

const isSameBranch = (left, right) => String(left || '') === String(right || '');

const requestIncludesPdcCourse = async ({ courseCategory, courseId, courseIds }, db = pool) => {
  if (String(courseCategory || '').toLowerCase() === 'pdc') {
    return true;
  }

  const normalizedIds = [...new Set(
    (Array.isArray(courseIds) ? courseIds : [courseId])
      .filter(Boolean)
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0)
  )];

  if (normalizedIds.length === 0) {
    return false;
  }

  const result = await db.query(
    `SELECT 1
       FROM courses
      WHERE id = ANY($1::int[])
        AND LOWER(COALESCE(category, '')) = 'pdc'
      LIMIT 1`,
    [normalizedIds]
  );

  return result.rows.length > 0;
};

const hasIncompleteOnlineTdcBooking = async (userId, db = pool) => {
  const result = await db.query(
    `SELECT 1
       FROM bookings b
       JOIN courses c ON c.id = b.course_id
      WHERE b.user_id = $1
        AND LOWER(COALESCE(c.category, '')) = 'tdc'
        AND LOWER(COALESCE(b.course_type, '')) LIKE '%online%'
        AND LOWER(COALESCE(b.status, '')) NOT IN ('completed', 'cancelled')
      LIMIT 1`,
    [userId]
  );

  return result.rows.length > 0;
};

const getBookingAccessInScope = async (bookingId, scope, db = pool) => {
  const bookingRow = await db.query('SELECT id, branch_id FROM bookings WHERE id = $1', [bookingId]);
  if (bookingRow.rows.length === 0) {
    return { exists: false, allowed: false };
  }

  if (scope.canViewAll) {
    return { exists: true, allowed: true, branchId: bookingRow.rows[0].branch_id };
  }

  return {
    exists: true,
    allowed: isSameBranch(bookingRow.rows[0].branch_id, scope.branchId),
    branchId: bookingRow.rows[0].branch_id,
  };
};

const isScopedWithoutBranch = (scope) => !scope.canViewAll && !scope.branchId;

// Get dashboard statistics  (cached 60 s per role+branch)
const getDashboardStats = async (req, res) => {
  try {
    const cacheKey = `stats:${req.user.role}:${req.user.branchId || 'all'}`;
    const isSuperAdmin = String(req.user.role || '').toLowerCase() === 'super_admin';

    const payload = await withCache(cacheKey, async () => {

      const scope = await getUserBranchScope(req.user);
      if (isScopedWithoutBranch(scope)) {
        return {
          success: true,
          stats: {
            totalStudents: 0, monthlyRevenue: 0, pendingBookings: 0,
            todayEnrollments: 0, growthRate: '0.0', retention: 0,
            traffic: 0, addedStudents: 0, walkIns: 0,
          },
        };
      }
      const bookingBranchFilter = scope.branchId && !scope.canViewAll ? ` AND branch_id = ${parseInt(scope.branchId, 10)}` : '';
      const slotBranchFilter = scope.branchId && !scope.canViewAll ? ` AND ss.branch_id = ${parseInt(scope.branchId, 10)}` : '';

      // ── Run all independent queries in parallel ───────────────────────────
      const [
        studentsResult, rawRevenueResult, pendingResult,
        todayEnrollmentsResult, addedStudentsResult, walkInsResult,
        retentionResult, trafficResult,
      ] = await Promise.all([
        pool.query(
          `SELECT COUNT(DISTINCT student_id) as total FROM (
            SELECT user_id as student_id FROM bookings WHERE status IN ('confirmed','completed','paid','partial_payment')${bookingBranchFilter}
            UNION
            SELECT se.student_id FROM schedule_enrollments se JOIN schedule_slots ss ON se.slot_id = ss.id
            WHERE se.enrollment_status IN ('enrolled','completed')${slotBranchFilter}
          ) combined`
        ),
        pool.query(
          `SELECT b.total_amount, b.notes, b.status, b.created_at
           FROM bookings b
           WHERE b.status IN ('confirmed','completed','paid','partial_payment')${bookingBranchFilter}
             AND b.created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'`
        ),
        pool.query(`SELECT COUNT(*) as total FROM bookings WHERE status='pending'${bookingBranchFilter}`),
        pool.query(
          `SELECT COUNT(DISTINCT student_id) as total FROM (
            SELECT b.user_id AS student_id FROM bookings b
            WHERE b.created_at >= CURRENT_DATE AND b.created_at < CURRENT_DATE + INTERVAL '1 day'${bookingBranchFilter ? ` AND b.branch_id = ${parseInt(scope.branchId, 10)}` : ''}
            UNION
            SELECT se.student_id FROM schedule_enrollments se JOIN schedule_slots ss ON se.slot_id = ss.id
            WHERE se.created_at >= CURRENT_DATE AND se.created_at < CURRENT_DATE + INTERVAL '1 day'${slotBranchFilter}
          ) combined`
        ),
        pool.query(
          `SELECT COUNT(*) as total FROM bookings WHERE 1=1${bookingBranchFilter}
           AND EXTRACT(MONTH FROM created_at)=EXTRACT(MONTH FROM CURRENT_DATE)
           AND EXTRACT(YEAR FROM created_at)=EXTRACT(YEAR FROM CURRENT_DATE)`
        ),
        pool.query(
          `SELECT COUNT(*) as total FROM bookings WHERE enrollment_type='walk-in'${bookingBranchFilter}
           AND EXTRACT(MONTH FROM created_at)=EXTRACT(MONTH FROM CURRENT_DATE)
           AND EXTRACT(YEAR FROM created_at)=EXTRACT(YEAR FROM CURRENT_DATE)`
        ),
        pool.query(
          `SELECT COALESCE(ROUND(100.0*COUNT(*) FILTER (WHERE booking_count>1)/NULLIF(COUNT(*),0),1),0) as retention
           FROM (
             SELECT user_id, COUNT(*) as booking_count FROM bookings
             WHERE status IN ('confirmed','completed','paid','partial_payment')${bookingBranchFilter}
               AND created_at >= DATE_TRUNC('year', CURRENT_DATE)
             GROUP BY user_id
           ) s`
        ),
        pool.query(
          `SELECT ((SELECT COUNT(*) FROM users WHERE created_at>=DATE_TRUNC('month',CURRENT_DATE))
                  +(SELECT COUNT(*) FROM bookings WHERE created_at>=DATE_TRUNC('month',CURRENT_DATE)${bookingBranchFilter})) as traffic`
        ),
      ]);

      const todayDate = new Date();
      const currentMonth = todayDate.getMonth();
      const currentYear = todayDate.getFullYear();
      const lastMonthDate = new Date(); lastMonthDate.setMonth(currentMonth - 1);
      const lastMonth = lastMonthDate.getMonth();
      const lastMonthYear = lastMonthDate.getFullYear();

      let currentRevCourse = 0, currentRevAddons = 0, currentRevConv = 0, lastMonthRevenue = 0;
      rawRevenueResult.rows.forEach(b => {
        const d = new Date(b.created_at);
        const isCurrent = d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        const isLast = d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
        const { amount, courseRevenue, addonRevenue, convenienceFee } = parseBookingFinancials(b.total_amount, b.notes);

        if (isCurrent) { 
          currentRevAddons += addonRevenue; 
          currentRevConv += convenienceFee; 
          currentRevCourse += courseRevenue; 
        }
        if (isLast) lastMonthRevenue += isSuperAdmin ? amount : courseRevenue;
      });

      const currentRevenue = isSuperAdmin ? (currentRevCourse + currentRevAddons + currentRevConv) : currentRevCourse;
      let growthRate = 0;
      if (lastMonthRevenue > 0) growthRate = ((currentRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
      else if (currentRevenue > 0) growthRate = 100;

      return {
        success: true,
        stats: {
          totalStudents: parseInt(studentsResult.rows[0].total),
          monthlyRevenue: currentRevenue,
          addon_sales_total: isSuperAdmin ? currentRevAddons : 0,
          convenience_fee_total: isSuperAdmin ? currentRevConv : 0,
          course_revenue: currentRevCourse,
          total_sales_with_addons_and_convenience: isSuperAdmin ? (currentRevCourse + currentRevAddons + currentRevConv) : currentRevCourse,
          pendingBookings: parseInt(pendingResult.rows[0].total),
          todayEnrollments: parseInt(todayEnrollmentsResult.rows[0].total),
          growthRate: growthRate.toFixed(1),
          retention: Number(retentionResult.rows[0].retention || 0),
          traffic: parseInt(trafficResult.rows[0].traffic || 0, 10),
          addedStudents: parseInt(addedStudentsResult.rows[0].total),
          walkIns: parseInt(walkInsResult.rows[0].total),
        },
      };
    }, 60_000); // cache for 60 seconds

    res.json(payload);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Server error while fetching statistics' });
  }
};

// Get all bookings for admin view
const getAllBookings = async (req, res) => {
  try {
    const { status, limit = 50, branchId } = req.query;
    const scope = await getUserBranchScope(req.user);
    if (isScopedWithoutBranch(scope)) {
      return res.json({ success: true, bookings: [] });
    }
    const requestedBranchId = branchId ? parseInt(branchId, 10) : null;
    const effectiveBranchId = scope.canViewAll ? requestedBranchId : scope.branchId;

    const queryParams = [];
    let paramIndex = 1;
    const whereClauses = [];

    if (effectiveBranchId) {
      whereClauses.push(`b.branch_id = $${paramIndex++}`);
      queryParams.push(effectiveBranchId);
    }

    if (status) {
      whereClauses.push(`b.status = $${paramIndex++}`);
      queryParams.push(status);
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    queryParams.push(limit);

    const query = `
      SELECT b.id, b.user_id, b.course_id, b.branch_id, b.booking_date, 
             b.booking_time, b.status, b.notes, b.total_amount,
             b.created_at, b.updated_at, b.course_type,
             COALESCE(b.payment_type, 'N/A') as payment_type,
             COALESCE(b.payment_method, 'N/A') as payment_method,
             COALESCE(b.enrollment_type, 'online') as enrollment_type,
             u.first_name || ' ' || COALESCE(u.middle_name || ' ', '') || u.last_name as student_name,
             u.email as student_email,
             u.contact_numbers as student_contact,
             u.address as student_address,
             c.name as course_name, 
             c.price as course_price,
             br.name as branch_name, 
             br.address as branch_address,
             (
               SELECT json_agg(
                 json_build_object('date', ss.date, 'end_date', ss.end_date, 'type', ss.type, 'time_range', ss.time_range)
                 ORDER BY ss.date ASC
               )
               FROM schedule_enrollments se
               JOIN schedule_slots ss ON se.slot_id = ss.id
               WHERE 
                 se.booking_id = b.id OR
                 (se.booking_id IS NULL AND se.student_id = b.user_id AND se.enrollment_status NOT IN ('cancelled', 'no-show'))
             ) as schedule_details,
             -- Fallback slot 1 from notes JSON (for pending StarPay bookings not yet enrolled)
             (
               SELECT json_build_object('date', ss.date, 'end_date', ss.end_date, 'type', ss.type, 'time_range', ss.time_range)
               FROM schedule_slots ss
               WHERE ss.id = (
                 CASE
                   WHEN b.notes IS NOT NULL
                     AND b.notes ~ '^\{'
                     AND (b.notes::jsonb->>'scheduleSlotId') IS NOT NULL
                     AND (b.notes::jsonb->>'scheduleSlotId') ~ '^[0-9]+$'
                   THEN CAST(b.notes::jsonb->>'scheduleSlotId' AS INTEGER)
                   ELSE NULL
                 END
               )
             ) as notes_slot,
             -- Fallback slot 2 from notes JSON (for PDC 2-day pending bookings)
             (
               SELECT json_build_object('date', ss.date, 'end_date', ss.end_date, 'type', ss.type, 'time_range', ss.time_range)
               FROM schedule_slots ss
               WHERE ss.id = (
                 CASE
                   WHEN b.notes IS NOT NULL
                     AND b.notes ~ '^\{'
                     AND (b.notes::jsonb->>'scheduleSlotId2') IS NOT NULL
                     AND (b.notes::jsonb->>'scheduleSlotId2') ~ '^[0-9]+$'
                   THEN CAST(b.notes::jsonb->>'scheduleSlotId2' AS INTEGER)
                   ELSE NULL
                 END
               )
             ) as notes_slot2
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN courses c ON b.course_id = c.id
      LEFT JOIN branches br ON b.branch_id = br.id
      ${whereSQL}
      ORDER BY b.created_at DESC LIMIT $${paramIndex}
    `;

    const result = await pool.query(query, queryParams);

    res.json({
      success: true,
      bookings: result.rows,
    });
  } catch (error) {
    console.error('Get all bookings error:', error);
    res.status(500).json({ error: 'Server error while fetching bookings' });
  }
};

// Get all users
const getAllUsers = async (req, res) => {
  try {
    await ensureUserPermissionsColumn();
    const scope = await getUserBranchScope(req.user);
    if (isScopedWithoutBranch(scope)) {
      return res.json({ success: true, users: [] });
    }

    const { role, limit = 100 } = req.query;

    const userBranchExpr = `COALESCE(u.branch_id, (
      SELECT branch_id FROM bookings WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1
    ))`;

    let query = `
      SELECT u.id, u.first_name, u.middle_name, u.last_name, u.email, u.role, 
             u.contact_numbers, u.address, u.gender, u.age, u.birthday, 
             u.status, u.last_login, u.created_at, u.is_verified,
             u.birth_place, u.nationality, u.marital_status, u.zip_code,
             u.emergency_contact_person, u.emergency_contact_number,
             COALESCE(u.permissions, '[]'::jsonb) as permissions,
             ${userBranchExpr} as branch_id,
             COALESCE(b.name, (
                SELECT br.name FROM bookings bk JOIN branches br ON bk.branch_id = br.id WHERE bk.user_id = u.id ORDER BY bk.created_at DESC LIMIT 1
             )) as branch_name, u.avatar
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
    `;

    const queryParams = [];
    const whereClauses = [];
    let paramIndex = 1;

    if (!scope.canViewAll && scope.branchId) {
      whereClauses.push(`${userBranchExpr} = $${paramIndex++}`);
      queryParams.push(scope.branchId);
    }

    if (role) {
      whereClauses.push(`u.role = $${paramIndex++}`);
      queryParams.push(role);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    query += ` ORDER BY u.created_at DESC LIMIT $${paramIndex}`;
    queryParams.push(limit);

    const result = await pool.query(query, queryParams);

    res.json({
      success: true,
      users: result.rows,
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Server error while fetching users' });
  }
};

// Search students for auto-fill in enrollment
const searchStudents = async (req, res) => {
  try {
    const { name } = req.query;
    const scope = await getUserBranchScope(req.user);
    if (isScopedWithoutBranch(scope)) {
      return res.json({ success: true, students: [] });
    }
    if (!name || name.trim().length < 2) {
      return res.json({ success: true, students: [] });
    }

    const searchPattern = `%${name.trim()}%`;
    const queryParams = [searchPattern];
    const branchClause = (!scope.canViewAll && scope.branchId)
      ? ` AND COALESCE(u.branch_id, (SELECT branch_id FROM bookings WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1)) = $2`
      : '';
    if (!scope.canViewAll && scope.branchId) {
      queryParams.push(scope.branchId);
    }
    const query = `
      SELECT u.id, u.first_name, u.middle_name, u.last_name, u.email, u.role, 
             u.contact_numbers, u.address, u.gender, u.age, u.birthday, 
             u.status, u.birth_place, u.nationality, u.marital_status, u.zip_code,
             u.emergency_contact_person, u.emergency_contact_number
      FROM users u
      WHERE (u.first_name ILIKE $1 OR u.last_name ILIKE $1 OR u.email ILIKE $1)
      AND (u.role = 'student' OR u.role = 'walkin_student')
      ${branchClause}
      LIMIT 10
    `;

    const result = await pool.query(query, queryParams);

    res.json({
      success: true,
      students: result.rows,
    });
  } catch (error) {
    console.error('Search students error:', error);
    res.status(500).json({ error: 'Server error while searching students' });
  }
};

// Update booking status (admin)
const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const scope = await getUserBranchScope(req.user);

    // Validate status
    const validStatuses = ['partial_payment', 'paid', 'cancelled', 'completed'];
    if (!validStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const access = await getBookingAccessInScope(id, scope);
    if (!access.exists) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    if (!access.allowed) {
      return res.status(403).json({ error: 'Access denied for this branch booking' });
    }

    const result = await pool.query(
      `UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status.toLowerCase(), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({
      success: true,
      message: 'Booking status updated successfully',
      booking: result.rows[0],
    });

    // Invalidate dashboard stats cache so next load reflects the change
    bustCache(`stats:super_admin:all`, `stats:admin:${result.rows[0].branch_id}`, `stats:admin:all`);
  } catch (error) {
    console.error('Update booking error:', error);
    res.status(500).json({ error: 'Server error while updating booking' });
  }
};

// Delete booking (admin)
const deleteBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const scope = await getUserBranchScope(req.user);

    const access = await getBookingAccessInScope(id, scope);
    if (!access.exists) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    if (!access.allowed) {
      return res.status(403).json({ error: 'Access denied for this branch booking' });
    }

    const result = await pool.query(
      'DELETE FROM bookings WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({
      success: true,
      message: 'Booking deleted successfully',
    });
  } catch (error) {
    console.error('Delete booking error:', error);
    res.status(500).json({ error: 'Server error while deleting booking' });
  }
};

// Get revenue data for charts (monthly)
const getRevenueData = async (req, res) => {
  try {
    const scope = await getUserBranchScope(req.user);
    if (isScopedWithoutBranch(scope)) {
      return res.json({ success: true, data: [] });
    }
    const params = [];
    const branchClause = (!scope.canViewAll && scope.branchId)
      ? ` AND branch_id = $1`
      : '';
    if (!scope.canViewAll && scope.branchId) params.push(scope.branchId);

    const isSuperAdmin = String(req.user.role || '').toLowerCase() === 'super_admin';
    const rawRevenue = await pool.query(`
      SELECT 
        EXTRACT(MONTH FROM b.created_at) as month_index,
        TO_CHAR(b.created_at, 'Mon') as name,
        b.total_amount, b.notes, b.created_at
      FROM bookings b
      WHERE b.status IN ('confirmed', 'completed', 'paid', 'partial_payment')
        ${branchClause}
        AND b.created_at >= DATE_TRUNC('year', CURRENT_DATE)
    `, params);

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonthIndex = new Date().getMonth();
    const monthData = {};
    const addonBreakdownMap = {};
    
    let totalAddonsYear = 0;
    let totalConvYear = 0;

    rawRevenue.rows.forEach(r => {
      const m = (parseInt(r.month_index) || 1) - 1;
      const name = months[m];
      if (!monthData[name]) monthData[name] = 0;

      const { amount, courseRevenue, addonRevenue, convenienceFee, notesJson } = parseBookingFinancials(r.total_amount, r.notes);

      if (notesJson && Array.isArray(notesJson.addonsDetailed)) {
         notesJson.addonsDetailed.forEach(a => {
            const aPrice = parseFloat(a.price || 0);
            if (!addonBreakdownMap[a.name]) addonBreakdownMap[a.name] = { count: 0, revenue: 0 };
            addonBreakdownMap[a.name].count += 1;
            addonBreakdownMap[a.name].revenue += aPrice;
         });
      }
      
      totalAddonsYear += addonRevenue;
      totalConvYear += convenienceFee;

      monthData[name] += isSuperAdmin ? amount : courseRevenue;
    });

    const finalData = [];
    for (let i = 0; i <= currentMonthIndex; i++) {
        finalData.push({ name: months[i], revenue: monthData[months[i]] || 0 });
    }

    const addon_breakdown = Object.keys(addonBreakdownMap).map(k => ({ name: k, ...addonBreakdownMap[k] })).sort((a,b) => b.revenue - a.revenue);

    res.json({
      success: true,
      data: finalData,
      addon_breakdown: isSuperAdmin ? addon_breakdown : []
    });
  } catch (error) {
    console.error('Get revenue data error:', error);
    res.status(500).json({ error: 'Server error while fetching revenue data' });
  }
};

// Get enrollment data for charts (monthly)
const getEnrollmentData = async (req, res) => {
  try {
    const scope = await getUserBranchScope(req.user);
    if (isScopedWithoutBranch(scope)) {
      return res.json({ success: true, data: [] });
    }
    const params = [];
    const bookingBranchClause = (!scope.canViewAll && scope.branchId)
      ? ` AND branch_id = $1`
      : '';
    const slotBranchClause = (!scope.canViewAll && scope.branchId)
      ? ` AND ss.branch_id = $1`
      : '';
    if (!scope.canViewAll && scope.branchId) params.push(scope.branchId);

    const result = await pool.query(`
      SELECT 
        TO_CHAR(b.created_at, 'Mon') as name,
        COUNT(DISTINCT b.user_id) as students,
        COUNT(DISTINCT CASE WHEN b.enrollment_type = 'walk-in' THEN b.user_id END) as walkins,
        COUNT(DISTINCT CASE WHEN b.enrollment_type != 'walk-in' OR b.enrollment_type IS NULL THEN b.user_id END) as online
      FROM bookings b
      WHERE b.created_at >= DATE_TRUNC('year', CURRENT_DATE)
      AND b.status IN ('confirmed', 'completed', 'paid', 'partial_payment')
      ${bookingBranchClause}
      GROUP BY TO_CHAR(b.created_at, 'Mon'), EXTRACT(MONTH FROM b.created_at)
      ORDER BY EXTRACT(MONTH FROM b.created_at)
    `, params);

    // If no data, return placeholder months
    if (result.rows.length === 0) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const currentMonth = new Date().getMonth();
      const placeholderData = months.slice(0, currentMonth + 1).map(name => ({ name, students: 0, walkins: 0, online: 0 }));
      return res.json({ success: true, data: placeholderData });
    }

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get enrollment data error:', error);
    res.status(500).json({ error: 'Server error while fetching enrollment data' });
  }
};

// Get best selling courses
const getBestSellingCourses = async (req, res) => {
  try {
    const { branchId, filter } = req.query;
    const scope = await getUserBranchScope(req.user);
    if (isScopedWithoutBranch(scope)) {
      return res.json({ success: true, courses: [] });
    }
    const requestedBranchId = branchId ? parseInt(branchId, 10) : null;
    const effectiveBranchId = scope.canViewAll ? requestedBranchId : scope.branchId;
    
    const conditionClauses = [];
    const queryParams = [];
    let paramIndex = 1;

    if (effectiveBranchId) {
      conditionClauses.push(`b.branch_id = $${paramIndex++}`);
      queryParams.push(effectiveBranchId);
    }

    if (filter === 'today') {
      conditionClauses.push(`DATE(b.created_at) = CURRENT_DATE`);
    } else if (filter === 'this_week') {
      conditionClauses.push(`b.created_at >= date_trunc('week', CURRENT_DATE)`);
    } else if (filter === 'this_month') {
      conditionClauses.push(`b.created_at >= date_trunc('month', CURRENT_DATE)`);
    } else if (filter === 'this_year') {
      conditionClauses.push(`b.created_at >= date_trunc('year', CURRENT_DATE)`);
    }

    const joinConditions = conditionClauses.length > 0 ? `AND ${conditionClauses.join(' AND ')}` : '';

    const result = await pool.query(`
      WITH filtered_bookings AS (
        SELECT b.id, b.course_id, b.total_amount, b.status, b.notes
        FROM bookings b
        WHERE 1=1 ${joinConditions ? ` ${joinConditions.replace(/^AND\s+/i, 'AND ')}` : ''}
      ),
      note_items AS (
        SELECT
          fb.id AS booking_id,
          CASE WHEN (item->>'id') ~ '^[0-9]+$' THEN (item->>'id')::int ELSE NULL END AS course_id,
          NULLIF(TRIM(item->>'name'), '') AS course_name,
          CASE
            WHEN (item->>'price') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (item->>'price')::numeric
            ELSE NULL
          END AS course_price,
          fb.total_amount,
          fb.status
        FROM filtered_bookings fb
        CROSS JOIN LATERAL jsonb_array_elements((fb.notes::jsonb)->'courseList') AS item
        WHERE fb.notes IS NOT NULL
          AND fb.notes ~ '^\\{'
          AND jsonb_typeof((fb.notes::jsonb)->'courseList') = 'array'
          AND jsonb_array_length((fb.notes::jsonb)->'courseList') > 0
      ),
      note_totals AS (
        SELECT
          booking_id,
          COALESCE(SUM(COALESCE(course_price, 0)), 0) AS listed_total,
          COUNT(*) AS item_count
        FROM note_items
        GROUP BY booking_id
      ),
      expanded_bookings AS (
        -- Bundle-aware expansion from notes.courseList
        SELECT
          COALESCE(ni.course_id, c_by_name.id) AS course_id,
          CASE
            WHEN nt.listed_total > 0 AND ni.course_price IS NOT NULL
              THEN (ni.total_amount * (ni.course_price / nt.listed_total))
            WHEN nt.item_count > 0
              THEN (ni.total_amount / nt.item_count)
            ELSE ni.total_amount
          END AS allocated_revenue,
          ni.status
        FROM note_items ni
        JOIN note_totals nt ON nt.booking_id = ni.booking_id
        LEFT JOIN courses c_by_name
          ON LOWER(TRIM(c_by_name.name)) = LOWER(TRIM(COALESCE(ni.course_name, '')))

        UNION ALL

        -- Legacy fallback: no courseList in notes
        SELECT
          fb.course_id,
          fb.total_amount AS allocated_revenue,
          fb.status
        FROM filtered_bookings fb
        WHERE NOT (
          fb.notes IS NOT NULL
          AND fb.notes ~ '^\\{'
          AND jsonb_typeof((fb.notes::jsonb)->'courseList') = 'array'
          AND jsonb_array_length((fb.notes::jsonb)->'courseList') > 0
        )
      ),
      course_agg AS (
        SELECT
          eb.course_id,
          COUNT(*) AS total_bookings,
          COALESCE(SUM(eb.allocated_revenue), 0) AS total_revenue,
          COUNT(CASE WHEN eb.status IN ('confirmed', 'completed', 'paid') THEN 1 END) AS completed_bookings
        FROM expanded_bookings eb
        WHERE eb.course_id IS NOT NULL
        GROUP BY eb.course_id
      )
      SELECT
        c.id,
        c.name AS course_name,
        c.price,
        c.description,
        COALESCE(ca.total_bookings, 0) AS total_bookings,
        COALESCE(ca.total_revenue, 0) AS total_revenue,
        COALESCE(ca.completed_bookings, 0) AS completed_bookings
      FROM courses c
      LEFT JOIN course_agg ca ON ca.course_id = c.id
      ORDER BY COALESCE(ca.total_bookings, 0) DESC, COALESCE(ca.total_revenue, 0) DESC
      LIMIT 10
    `, queryParams);

    res.json({
      success: true,
      courses: result.rows,
    });
  } catch (error) {
    console.error('Get best selling courses error:', error);
    res.status(500).json({ error: 'Server error while fetching course statistics' });
  }
};

// Create new user (Admin only)
const createUser = async (req, res) => {
  try {
    await ensureUserPermissionsColumn();
    const scope = await getUserBranchScope(req.user);

    console.log('ðŸ“ CREATE USER REQUEST - Body:', req.body);

    const {
      firstName,
      middleInitial,
      lastName,
      gender,
      age,
      birthday,
      nationality,
      address,
      zipCode,
      contactNumber,
      email,
      role,
      branch,
      permissions,
    } = req.body;

    const providedPermissions = normalizePermissions(permissions);
    const normalizedPermissions = providedPermissions.length > 0
      ? providedPermissions
      : getRoleDefaultPermissions(role);

    console.log('ðŸ“‹ Extracted values:', { firstName, middleInitial, lastName, email, role, branch, contactNumber });

    // Only allow creating Admin accounts.
    if (role !== 'admin') {
      console.log('âŒ Invalid role:', role);
      return res.status(403).json({ error: 'Can only create admin accounts' });
    }

    // Check if user already exists
    console.log('ðŸ” Checking if user exists with email:', email);
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      console.log('âŒ User already exists with email:', email);
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Generate random password
    console.log('ðŸ” Generating random password...');
    const generatedPassword = generateRandomPassword();
    console.log('âœ… Password generated successfully');

    // Hash password
    console.log('ðŸ”’ Hashing password...');
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);
    console.log('âœ… Password hashed successfully');

    // Prepare branch_id value. Admin can be assigned to all branches via branch = 'all'.
    const normalizedBranchValue = String(branch || '').trim().toLowerCase();
    const branchId = normalizedBranchValue && normalizedBranchValue !== 'all'
      ? parseInt(normalizedBranchValue, 10)
      : null;
    if (normalizedBranchValue && normalizedBranchValue !== 'all' && Number.isNaN(branchId)) {
      return res.status(400).json({ error: 'Invalid branch selection' });
    }
    if (!scope.canViewAll) {
      if (!branchId || !isSameBranch(branchId, scope.branchId)) {
        return res.status(403).json({ error: 'Branch managers can only create users in their assigned branch' });
      }
    }
    console.log('ðŸ¢ Branch ID:', branchId);

    // Insert new user
    console.log('ðŸ’¾ Inserting user into database...');
    const result = await pool.query(
      `INSERT INTO users (
        first_name, middle_name, last_name, email, password, 
        gender, age, birthday, nationality, address, contact_numbers, 
        zip_code, role, branch_id, permissions, status, is_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id, first_name, middle_name, last_name, email, role, branch_id, permissions, status, created_at`,
      [
        firstName,
        middleInitial || null,
        lastName,
        email,
        hashedPassword,
        gender,
        age,
        birthday,
        nationality || null,
        address,
        contactNumber,
        zipCode || null,
        role,
        branchId,
        JSON.stringify(normalizedPermissions),
        'active',
        true, // Auto-verify admin accounts
      ]
    );
    console.log('âœ… User inserted successfully:', result.rows[0]);

    // Send password email (non-blocking)
    try {
      console.log('ðŸ“§ Sending password email to:', email);
      await sendPasswordEmail(email, generatedPassword, firstName, role);
      console.log('âœ… Password email sent successfully to:', email);
    } catch (emailError) {
      console.error('âŒ Failed to send password email:', emailError);
      // Continue even if email fails - user is created
    }

    res.status(201).json({
      success: true,
      message: 'User created successfully. Login credentials sent to email.',
      user: result.rows[0],
      passwordSent: true,
    });
  } catch (error) {
    console.error('âŒ CREATE USER ERROR - Full details:', error);
    console.error('âŒ Error message:', error.message);
    console.error('âŒ Error stack:', error.stack);
    res.status(500).json({ error: 'Server error while creating user' });
  }
};

// Update user
const updateUser = async (req, res) => {
  try {
    await ensureUserPermissionsColumn();
    const scope = await getUserBranchScope(req.user);

    const { id } = req.params;
    const {
      firstName,
      middleInitial,
      lastName,
      gender,
      age,
      birthday,
      nationality,
      address,
      zipCode,
      contactNumber,
      email,
      role,
      branch,
      status,
      emailChanged,
      avatar,
      permissions,
    } = req.body;

    const providedPermissions = normalizePermissions(permissions);
    const normalizedPermissions = providedPermissions.length > 0
      ? providedPermissions
      : getRoleDefaultPermissions(role);

    // Get current user email and role
    const currentUserResult = await pool.query(
      `SELECT email, first_name, role,
              COALESCE(branch_id, (SELECT branch_id FROM bookings WHERE user_id = users.id ORDER BY created_at DESC LIMIT 1)) AS branch_id
       FROM users WHERE id = $1`,
      [id]
    );
    if (currentUserResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentEmail = currentUserResult.rows[0].email;
    const currentRole = currentUserResult.rows[0].role;
    const currentBranchId = currentUserResult.rows[0].branch_id;
    const isEmailChanged = email !== currentEmail;

    if (!scope.canViewAll && !isSameBranch(currentBranchId, scope.branchId)) {
      return res.status(403).json({ error: 'Access denied for this branch user' });
    }

    // Keep super_admin role immutable in this admin management flow.
    // This prevents creating a second super admin via role changes.
    if (currentRole !== 'super_admin' && role === 'super_admin') {
      return res.status(403).json({ error: 'Cannot assign Super Admin role from this page' });
    }
    if (currentRole === 'super_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Super Admin role cannot be changed' });
    }

    const normalizedBranchValue = String(branch || '').trim().toLowerCase();
    const parsedBranchId = normalizedBranchValue && normalizedBranchValue !== 'all'
      ? parseInt(normalizedBranchValue, 10)
      : null;
    if (normalizedBranchValue && normalizedBranchValue !== 'all' && Number.isNaN(parsedBranchId)) {
      return res.status(400).json({ error: 'Invalid branch selection' });
    }
    if (!scope.canViewAll) {
      if (!parsedBranchId || !isSameBranch(parsedBranchId, scope.branchId)) {
        return res.status(403).json({ error: 'Branch managers can only assign users to their branch' });
      }
    }

    // Check if email is taken by another user
    if (isEmailChanged) {
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, id]
      );
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'Email is already taken by another user' });
      }
    }

    let newPassword = null;
    let hashedPassword = null;

    // Generate new password only if email changed
    if (isEmailChanged) {
      newPassword = generateRandomPassword();
      const bcrypt = require('bcryptjs');
      hashedPassword = await bcrypt.hash(newPassword, 10);
    }

    // Update user with or without password
    const updateQuery = isEmailChanged
      ? `UPDATE users SET
          first_name = $1,
          middle_name = $2,
          last_name = $3,
          email = $4,
          password = $5,
          gender = $6,
          age = $7,
          birthday = $8,
          nationality = $9,
          address = $10,
          contact_numbers = $11,
          zip_code = $12,
          role = $13,
          branch_id = $14,
          permissions = $15,
          status = $16,
          avatar = $17
        WHERE id = $18
        RETURNING id, first_name, middle_name, last_name, email, role, branch_id, permissions, status, avatar`
      : `UPDATE users SET
          first_name = $1,
          middle_name = $2,
          last_name = $3,
          gender = $4,
          age = $5,
          birthday = $6,
          nationality = $7,
          address = $8,
          contact_numbers = $9,
          zip_code = $10,
          role = $11,
          branch_id = $12,
          permissions = $13,
          status = $14,
          avatar = $15
        WHERE id = $16
        RETURNING id, first_name, middle_name, last_name, email, role, branch_id, permissions, status, avatar`;

    const updateParams = isEmailChanged
      ? [
        firstName,
        middleInitial || null,
        lastName,
        email,
        hashedPassword,
        gender,
        age,
        birthday,
        nationality || null,
        address,
        contactNumber,
        zipCode || null,
        role,
        parsedBranchId,
        JSON.stringify(normalizedPermissions),
        status,
        avatar || null,
        id,
      ]
      : [
        firstName,
        middleInitial || null,
        lastName,
        gender,
        age,
        birthday,
        nationality || null,
        address,
        contactNumber,
        zipCode || null,
        role,
        parsedBranchId,
        JSON.stringify(normalizedPermissions),
        status,
        avatar || null,
        id,
      ];

    const result = await pool.query(updateQuery, updateParams);

    // Send new password email if email was changed
    let passwordSent = false;
    if (isEmailChanged && newPassword) {
      try {
        await sendPasswordEmail(email, newPassword, firstName, role);
        console.log('âœ… New password email sent to updated email:', email);
        passwordSent = true;
      } catch (emailError) {
        console.error('âŒ Failed to send new password email:', emailError);
        // Continue even if email fails
      }
    }

    res.json({
      success: true,
      message: isEmailChanged
        ? 'User updated successfully. New password sent to updated email.'
        : 'User updated successfully',
      user: result.rows[0],
      passwordSent: passwordSent,
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Server error while updating user' });
  }
};

// Toggle user status
const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const scope = await getUserBranchScope(req.user);

    // Get current user data
    const userResult = await pool.query(
      `SELECT status, role,
              COALESCE(branch_id, (SELECT branch_id FROM bookings WHERE user_id = users.id ORDER BY created_at DESC LIMIT 1)) AS branch_id
       FROM users WHERE id = $1`,
      [id]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!scope.canViewAll && !isSameBranch(userResult.rows[0].branch_id, scope.branchId)) {
      return res.status(403).json({ error: 'Access denied for this branch user' });
    }

    // Protect super_admin accounts from being deactivated by anyone
    if (userResult.rows[0].role === 'super_admin') {
      return res.status(403).json({ error: 'Super Admin accounts cannot be deactivated.' });
    }

    const currentStatus = (userResult.rows[0].status || 'active').toLowerCase();
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

    // Update status
    const result = await pool.query(
      `UPDATE users SET status = $1 
       WHERE id = $2 
       RETURNING id, status`,
      [newStatus, id]
    );

    res.json({
      success: true,
      message: `User ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`,
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({ error: 'Server error while toggling user status' });
  }
};

// Reset user password (Admin only)
const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    const scope = await getUserBranchScope(req.user);

    // Validate password
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if user exists
    const userResult = await pool.query(
      `SELECT id, email, first_name, last_name,
              COALESCE(branch_id, (SELECT branch_id FROM bookings WHERE user_id = users.id ORDER BY created_at DESC LIMIT 1)) AS branch_id
       FROM users WHERE id = $1`,
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    if (!scope.canViewAll && !isSameBranch(user.branch_id, scope.branchId)) {
      return res.status(403).json({ error: 'Access denied for this branch user' });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in database
    await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [hashedPassword, id]
    );

    res.json({
      success: true,
      message: 'Password reset successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name
      }
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error while resetting password' });
  }
};

// Walk-in Enrollment - Create student account, booking, and schedule enrollment
const walkInEnrollment = async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('ðŸ“ WALK-IN ENROLLMENT REQUEST:', req.body);

    const {
      firstName, middleName, lastName, age, gender, birthday,
      nationality, maritalStatus, address, zipCode, birthPlace,
      contactNumbers, email, emergencyContactPerson, emergencyContactNumber,
      courseId, courseIds, pdcCourseIds = [], courseCategory, courseType, courseTypePdc, branchId,
      scheduleSlotId, scheduleDate,
      scheduleSlotId2, scheduleDate2,
      promoPdcSlotId2, promoPdcDate2,
      promoPdcSchedules = [],
      pdcScheduleLockedUntilCompletion,
      pdcScheduleLockReason,
      paymentMethod, amountPaid, paymentStatus,
      enrolledBy, addons = []
    } = req.body;

    const normalizePaymentMethod = (method) => {
      const m = String(method || '').trim().toLowerCase();
      if (m === 'starpay' || m === 'starpay' || m === 'star pay') return 'StarPay';
      if (m === 'gcash' || m === 'g-cash') return 'GCash';
      if (m === 'metrobank' || m === 'metro bank') return 'MetroBank';
      if (m === 'cash') return 'Cash';
      return method || 'Cash';
    };
    const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);
    const isPromoPdcLocked = !!pdcScheduleLockedUntilCompletion;

    console.log('ðŸ” Walk-in enrollment received - TDC:', courseType, 'PDC:', courseTypePdc);

    // Parse branchId to integer (comes as string from frontend select)
    const parsedBranchId = parseInt(branchId, 10);
    const categoryNorm = String(courseCategory || '').toUpperCase();
    const courseTypeNorm = String(courseType || '').toLowerCase();
    const tdcScheduleLabelNorm = String(req.body?.tdcScheduleLabel || '').toLowerCase();
    const lockReasonNorm = String(pdcScheduleLockReason || '').toLowerCase();
    const hasOtdcMarker =
      courseTypeNorm.includes('online')
      || courseTypeNorm.includes('otdc')
      || tdcScheduleLabelNorm.includes('online')
      || tdcScheduleLabelNorm.includes('otdc');
    const isOnlineTdcNoSchedule =
      ((categoryNorm === 'TDC' || categoryNorm === 'PROMO') && hasOtdcMarker)
      || (isPromoPdcLocked && (hasOtdcMarker || lockReasonNorm.includes('otdc')));
    const scope = await getUserBranchScope(req.user);

    // Validate required fields
    if (!firstName || !lastName || !email || !courseId || !parsedBranchId || (!isOnlineTdcNoSchedule && (!scheduleSlotId || !scheduleDate))) {
      const missing = [];
      if (!firstName) missing.push('firstName');
      if (!lastName) missing.push('lastName');
      if (!email) missing.push('email');
      if (!courseId) missing.push('courseId');
      if (!parsedBranchId) missing.push('branchId');
      if (!isOnlineTdcNoSchedule && !scheduleSlotId) missing.push('scheduleSlotId');
      if (!isOnlineTdcNoSchedule && !scheduleDate) missing.push('scheduleDate');
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    if (!scope.canViewAll && !isSameBranch(parsedBranchId, scope.branchId)) {
      return res.status(403).json({ error: 'Branch managers can only enroll walk-ins in their assigned branch' });
    }

    const includesPdcCourse = await requestIncludesPdcCourse({ courseCategory, courseId, courseIds }, pool);
    if (includesPdcCourse) {
      const existingUserByEmail = await pool.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
      if (existingUserByEmail.rows.length > 0) {
        const blocked = await hasIncompleteOnlineTdcBooking(existingUserByEmail.rows[0].id, pool);
        if (blocked) {
          return res.status(403).json({
            error: 'PDC enrollment is blocked. Student must complete Online TDC first. Mark it as Complete in CRM before enrolling to any PDC course.'
          });
        }
      }
    }

    const pdcSchedules = Array.isArray(promoPdcSchedules) ? promoPdcSchedules : [];
    const resolvedTdcTypeFromLabel = (() => {
      const src = String(req.body?.tdcScheduleLabel || '').toUpperCase();
      if (src.includes('ONLINE')) return 'ONLINE';
      if (src.includes('F2F')) return 'F2F';
      return '';
    })();

    const fallbackPdcDay1 = pdcSchedules.find(s => s?.scheduleSlotId && s?.scheduleDate) || null;
    const fallbackPdcDay2 = pdcSchedules.find(s => s?.promoPdcSlotId2 && s?.promoPdcDate2) || null;

    const resolvedScheduleSlotId2 = scheduleSlotId2 || fallbackPdcDay1?.scheduleSlotId || null;
    const resolvedScheduleDate2 = scheduleDate2 || fallbackPdcDay1?.scheduleDate || null;
    const resolvedPromoPdcSlotId2 = promoPdcSlotId2 || fallbackPdcDay2?.promoPdcSlotId2 || null;
    const resolvedPromoPdcDate2 = promoPdcDate2 || fallbackPdcDay2?.promoPdcDate2 || null;

    // Pre-flight check: Slot availability (all slots)
    const slotsToCheck = [
      scheduleSlotId,
      resolvedScheduleSlotId2,
      resolvedPromoPdcSlotId2,
      ...pdcSchedules.flatMap(s => [s?.scheduleSlotId, s?.promoPdcSlotId2])
    ].filter(Boolean);

    const uniqueSlotsToCheck = [...new Set(slotsToCheck)];
    for (const slotId of uniqueSlotsToCheck) {
        const slotCheck = await pool.query('SELECT date, course_type, available_slots, branch_id FROM schedule_slots WHERE id = $1', [slotId]);
        if (slotCheck.rows.length === 0) {
          return res.status(404).json({ error: `Selected schedule slot ${slotId} not found` });
        }
        const { date: slotDate, course_type: slotCourseType, available_slots: slotAvailable, branch_id: slotBranchId } = slotCheck.rows[0];
        if (!isSameBranch(slotBranchId, parsedBranchId)) {
          return res.status(400).json({ error: 'Selected schedule slot does not belong to the chosen branch' });
        }
        if (slotAvailable <= 0) {
          return res.status(400).json({ error: `The selected slot on ${slotDate} is fully booked` });
        }
        if (slotCourseType && isB1B2CourseType(slotCourseType)) {
          try {
            await assertB1B2CapacityForSlot(pool, slotId);
          } catch (capErr) {
            return res.status(400).json({ error: capErr.message });
          }
        }
    }

    await client.query('BEGIN');

    // 1. Handle user account (create or retrieve/update existing)
    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    let userId;
    let generatedPassword = null;
    let verificationCode = null;
    let isNewUser = false;

    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].id;
      // Update existing user details (to keep the profile data current)
      await client.query(
        `UPDATE users SET
          first_name = $1, middle_name = $2, last_name = $3,
          address = $4, age = $5, gender = $6, birthday = $7,
          birth_place = $8, nationality = $9, marital_status = $10,
          contact_numbers = $11, zip_code = $12,
          emergency_contact_person = $13, emergency_contact_number = $14
        WHERE id = $15`,
        [
          firstName, middleName || null, lastName, address, age, gender, birthday,
          birthPlace, nationality, maritalStatus, contactNumbers, zipCode,
          emergencyContactPerson, emergencyContactNumber, userId
        ]
      );
      console.log('âœ… Existing user updated:', userId);
    } else {
      isNewUser = true;
      // 2. Generate password and verification code
      generatedPassword = generateRandomPassword();
      const hashedPassword = await bcrypt.hash(generatedPassword, 10);
      verificationCode = generateVerificationCode();
      const codeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // 3. Create user account with 'walkin_student' role
      const userResult = await client.query(
        `INSERT INTO users (
          first_name, middle_name, last_name, email, password,
          address, age, gender, birthday, birth_place,
          nationality, marital_status, contact_numbers, zip_code,
          emergency_contact_person, emergency_contact_number,
          role, branch_id, status, is_verified,
          verification_code, verification_code_expires
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        RETURNING id`,
        [
          firstName, middleName || null, lastName, email, hashedPassword,
          address, age, gender, birthday, birthPlace,
          nationality, maritalStatus, contactNumbers, zipCode,
          emergencyContactPerson, emergencyContactNumber,
          'walkin_student', parsedBranchId, 'active', false,
          verificationCode, codeExpires
        ]
      );
      userId = userResult.rows[0].id;
      console.log('âœ… User created:', userId);
    }

    // 4. Create booking record
    const bookingStatus = paymentStatus === 'Full Payment' ? 'paid' : 'partial_payment';
    const primaryCourseId = Array.isArray(courseIds) ? courseIds[0] : courseId;
    
    // Fetch all course details for accurate booking display and notes payload
    let combinedCourseNames = '';
    let notesCourseList = [];
    let notesPdcSelections = {};
    try {
      const idsToFetch = [...new Set([
        ...(Array.isArray(courseIds) ? courseIds : [courseId]),
        ...(Array.isArray(pdcCourseIds) ? pdcCourseIds : []),
      ].map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
      const courseMetaResult = await client.query(
        'SELECT id, name, category, course_type, price FROM courses WHERE id = ANY($1)',
        [idsToFetch]
      );
      const courseMetaById = new Map(
        courseMetaResult.rows.map((row) => [Number(row.id), row])
      );

      combinedCourseNames = idsToFetch
        .map((id) => courseMetaById.get(Number(id))?.name)
        .filter(Boolean)
        .join(' + ');

      notesCourseList = idsToFetch
        .map((id) => {
          const meta = courseMetaById.get(Number(id));
          if (!meta) return null;
          const selectedTdcType = String(courseType || '').toLowerCase() === 'promo-bundle'
            ? resolvedTdcTypeFromLabel
            : String(courseType || '');
          const selectedPdcType = String(courseTypePdc || '');
          let effectiveType = meta.course_type || '';

          if (String(meta.category || '').toUpperCase() === 'TDC' && selectedTdcType) {
            effectiveType = selectedTdcType;
          } else if (String(meta.category || '').toUpperCase() === 'PDC' && selectedPdcType) {
            effectiveType = selectedPdcType;
          }

          return {
            id: meta.id,
            name: meta.name,
            type: effectiveType,
            category: meta.category || '',
            price: Number(meta.price || 0),
          };
        })
        .filter(Boolean);

      pdcSchedules.forEach((schedule, idx) => {
        const resolvedCourseId = Number(schedule?.courseId) || null;
        const courseMeta = resolvedCourseId ? courseMetaById.get(resolvedCourseId) : null;
        const selectionKey = String(resolvedCourseId || `pdc_${idx + 1}`);
        const resolvedLabel = String(schedule?.label || schedule?.courseName || '').trim();
        const resolvedCourseName = String(schedule?.courseName || resolvedLabel || courseMeta?.name || `PDC Course ${idx + 1}`).trim();
        const resolvedCourseType = String(schedule?.courseTypeDetailed || schedule?.courseType || courseMeta?.course_type || '').trim();

        notesPdcSelections[selectionKey] = {
          courseId: resolvedCourseId || schedule?.courseId || null,
          label: resolvedLabel || resolvedCourseName,
          courseName: resolvedCourseName,
          courseType: resolvedCourseType,
          transmission: schedule?.transmission || null,
          scheduleSlotId: schedule?.scheduleSlotId || null,
          promoPdcSlotId2: schedule?.promoPdcSlotId2 || null,
          pdcDate: schedule?.scheduleDate || null,
          pdcDate2: schedule?.promoPdcDate2 || null,
          pdcSlotDetails: {
            session: schedule?.scheduleSession || null,
            time_range: schedule?.scheduleTime || null,
          },
          pdcSlotDetails2: {
            session: schedule?.promoPdcSession2 || null,
            time_range: schedule?.promoPdcTime2 || null,
          },
        };
      });

      const shouldStoreLegacyPdcSelection =
        (Array.isArray(idsToFetch) && idsToFetch.length > 1)
        || String(courseCategory || '').toUpperCase() === 'PROMO';

      if (shouldStoreLegacyPdcSelection && Object.keys(notesPdcSelections).length === 0 && (resolvedScheduleDate2 || resolvedPromoPdcDate2)) {
        const fallbackPdcId = idsToFetch.find((id) => Number(id) !== Number(primaryCourseId));
        const fallbackMeta = fallbackPdcId ? courseMetaById.get(Number(fallbackPdcId)) : null;
        notesPdcSelections.legacy = {
          courseId: fallbackPdcId || null,
          courseName: fallbackMeta?.name || 'PDC Course',
          courseType: fallbackMeta?.course_type || '',
          scheduleSlotId: resolvedScheduleSlotId2 || null,
          promoPdcSlotId2: resolvedPromoPdcSlotId2 || null,
          pdcDate: resolvedScheduleDate2 || null,
          pdcDate2: resolvedPromoPdcDate2 || null,
          pdcSlotDetails: {
            session: null,
            time_range: null,
          },
          pdcSlotDetails2: {
            session: null,
            time_range: null,
          },
        };
      }

      if (isPromoPdcLocked) {
        notesPdcSelections = {};
      }
    } catch (e) {
      console.error('Error fetching combined names:', e);
      combinedCourseNames = 'Custom Bundle';
    }

    const hasReviewerAddon = Array.isArray(addons) && addons.some(a =>
      (typeof a === 'string' && (a === 'addon-reviewer' || a.includes('Reviewer'))) ||
      (a && typeof a === 'object' && (a.id === 'addon-reviewer' || (a.name && a.name.includes('Reviewer'))))
    );
    const hasVehicleTipsAddon = Array.isArray(addons) && addons.some(a =>
      (typeof a === 'string' && (a === 'addon-tips' || a.includes('Maintenance'))) ||
      (a && typeof a === 'object' && (a.id === 'addon-tips' || (a.name && a.name.includes('Maintenance'))))
    );

    const toAmount = (value) => {
      if (value == null) return 0;
      const numeric = Number(String(value).replace(/[^0-9.-]/g, ''));
      return Number.isFinite(numeric) ? numeric : 0;
    };

    const normalizedCourseListForPricing = (() => {
      const source = Array.isArray(req.body?.courseList) && req.body.courseList.length
        ? req.body.courseList
        : notesCourseList;
      return (Array.isArray(source) ? source : []).map((item) => ({
        id: item?.id || null,
        name: item?.name || item?.courseName || item?.label || '',
        type: item?.type || item?.courseType || '',
        category: item?.category || '',
        price: Math.max(0, toAmount(item?.finalPrice ?? item?.discountedPrice ?? item?.netPrice ?? item?.lineTotal ?? item?.price ?? item?.amount ?? item?.coursePrice ?? 0)),
      }));
    })();

    const normalizedAddonsDetailed = (Array.isArray(addons) ? addons : []).map((addon) => ({
      name: typeof addon === 'object' ? (addon?.name || addon?.id || 'Add-on') : String(addon || 'Add-on'),
      price: Math.max(0, toAmount(typeof addon === 'object' ? addon?.price : 0)),
    }));

    const normalizedSubtotal = Math.max(0, toAmount(req.body?.subtotal));
    const normalizedConvenienceFee = Math.max(0, toAmount(req.body?.convenienceFee));
    let normalizedPromoDiscount = Math.max(0, toAmount(req.body?.promoDiscount));

    const normalizedCourseTotal = normalizedCourseListForPricing.reduce((sum, item) => sum + Math.max(0, toAmount(item?.price)), 0);
    const isPromoBundleRequest = String(courseType || '').toLowerCase().includes('promo-bundle') || String(courseCategory || '').toUpperCase().includes('PROMO');
    if (normalizedPromoDiscount <= 0 && isPromoBundleRequest && normalizedCourseTotal > 0) {
      normalizedPromoDiscount = Number((normalizedCourseTotal * 0.03).toFixed(2));
    }

    const normalizedBreakdownTotal = Math.max(0, Number((
      (normalizedSubtotal > 0 ? normalizedSubtotal : normalizedCourseTotal + normalizedAddonsDetailed.reduce((s, a) => s + toAmount(a?.price), 0))
      + normalizedConvenienceFee
      - normalizedPromoDiscount
    ).toFixed(2)));

    const normalizedTotalAssessment = [
      req.body?.totalAmount,
      req.body?.finalTotal,
      req.body?.grandTotal,
      req.body?.assessedTotal,
      normalizedBreakdownTotal,
    ]
      .map((v) => Math.max(0, toAmount(v)))
      .find((v) => v > 0) || 0;

    const bookingDateForRecord = scheduleDate || new Date().toISOString().slice(0, 10);

    const bookingResult = await client.query(
      `INSERT INTO bookings (
        user_id, course_id, branch_id, booking_date, 
        total_amount, payment_type, payment_method, status,
        enrollment_type, course_type, enrolled_by, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id`,
      [
        userId, primaryCourseId, parsedBranchId, bookingDateForRecord,
        amountPaid, paymentStatus, normalizedPaymentMethod, bookingStatus,
        'walk-in', courseType || (Array.isArray(courseIds) ? 'Bundle' : null), enrolledBy, 
        JSON.stringify({
          source: 'walk_in',
          noScheduleRequired: isOnlineTdcNoSchedule,
          isOnlineTdcNoSchedule,
          scheduleSlotId: scheduleSlotId || null,
          scheduleSlotId2: resolvedScheduleSlotId2 || null,
          promoPdcSlotId2: resolvedPromoPdcSlotId2 || null,
          scheduleDate: scheduleDate || null,
          scheduleDate2: resolvedScheduleDate2 || null,
          promoPdcDate2: resolvedPromoPdcDate2 || null,
          pdcSelections: notesPdcSelections,
          pdcCourseIds: [...new Set((Array.isArray(pdcCourseIds) ? pdcCourseIds : [])
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id) && id > 0))],
          pdcScheduleLockedUntilCompletion: isPromoPdcLocked,
          pdcScheduleLockReason: isPromoPdcLocked
            ? (pdcScheduleLockReason || 'PDC schedule will be assigned by Admin/Superadmin after OTDC is marked complete.')
            : null,
          courseList: normalizedCourseListForPricing,
          paymentType: paymentStatus || null,
          hasReviewer: hasReviewerAddon,
          hasVehicleTips: hasVehicleTipsAddon,
          displayNotes: `Walk-In Enrollment: ${combinedCourseNames}`,
          combinedCourseNames,
          addonNames: (addons || []).map(a => typeof a === 'object' ? a.name : a).filter(Boolean).join(', '),
          addonsDetailed: normalizedAddonsDetailed,
          courseTypePdc,
          courseTypeTdc: notesCourseList.some((item) => String(item?.category || '').toUpperCase() === 'TDC')
            ? (resolvedTdcTypeFromLabel || notesCourseList.find((item) => String(item?.category || '').toUpperCase() === 'TDC')?.type || courseType || null)
            : null,
          subtotal: normalizedSubtotal,
          promoDiscount: normalizedPromoDiscount,
          convenienceFee: normalizedConvenienceFee,
          totalAmount: normalizedTotalAssessment,
          initialAmountPaid: Math.max(0, toAmount(amountPaid))
        })
      ]
    );
    console.log('âœ… Booking created:', bookingResult.rows[0].id);

    // 6. Slot capacity management (Loops through all passed slots)
    const allSlots = [
      { id: scheduleSlotId, date: scheduleDate, label: 'TDC Day 1' },
      { id: resolvedScheduleSlotId2, date: resolvedScheduleDate2, label: 'PDC Day 1' },
      { id: resolvedPromoPdcSlotId2, date: resolvedPromoPdcDate2, label: 'PDC Day 2' },
      ...pdcSchedules.flatMap((s, idx) => ([
        { id: s?.scheduleSlotId, date: s?.scheduleDate, label: `PDC ${idx + 1} Day 1` },
        { id: s?.promoPdcSlotId2, date: s?.promoPdcDate2, label: `PDC ${idx + 1} Day 2` }
      ]))
    ].filter(s => s.id);

    const uniqueAllSlots = [...new Map(allSlots.map(s => [String(s.id), s])).values()];

    for (const slot of uniqueAllSlots) {
      const enrollResult = await client.query(
        `INSERT INTO schedule_enrollments (slot_id, student_id, enrollment_status, booking_id)
         VALUES ($1, $2, 'enrolled', $3)
         ON CONFLICT (slot_id, student_id) 
         DO UPDATE SET booking_id = EXCLUDED.booking_id
         RETURNING (xmax = 0) AS is_new_enrollment`,
        [slot.id, userId, bookingResult.rows[0].id]
      );
      
      const isNewEnrollment = enrollResult.rows[0].is_new_enrollment;
      
      if (isNewEnrollment) {
        await assertB1B2CapacityForSlot(client, slot.id, userId);
        const dec = await client.query(
          `UPDATE schedule_slots
              SET available_slots = available_slots - 1,
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
              AND available_slots > 0
            RETURNING id`,
          [slot.id]
        );
        if (dec.rows.length === 0) {
          throw new Error(`Selected slot ${slot.id} is already full.`);
        }
        console.log(`âœ… New enrollment created & capacity updated for ${slot.label}`);
      } else {
        console.log(`âœ… Existing enrollment updated/re-linked for ${slot.label} (no capacity change)`);
      }
    }

    await client.query('COMMIT');

    // 7. Get course and branch details for email
    const courseResult = await pool.query('SELECT category FROM courses WHERE id = $1', [courseId]);
    const branchResult = await pool.query('SELECT name, address FROM branches WHERE id = $1', [parsedBranchId]);
    
    // Fetch slot details for up to 3 slots (TDC, PDC Day 1, PDC Day 2)
    const slotResult = scheduleSlotId
      ? await pool.query('SELECT session, time_range, end_date FROM schedule_slots WHERE id = $1', [scheduleSlotId])
      : { rows: [] };
    
    const courseNameEmail = combinedCourseNames || 'Driving Course';
    const courseCat = courseCategory || courseResult.rows[0]?.category || 'PDC';
    const branchName = branchResult.rows[0]?.name || 'N/A';
    const branchAddress = branchResult.rows[0]?.address || '';
    const scheduleSession = isOnlineTdcNoSchedule ? 'N/A (Online)' : (slotResult.rows[0]?.session || 'N/A');
    const scheduleTime = isOnlineTdcNoSchedule ? 'Provider-managed' : (slotResult.rows[0]?.time_range || 'N/A');
    const scheduleEndDate = isOnlineTdcNoSchedule ? null : (slotResult.rows[0]?.end_date || null);

    const isRegularPdc = String(courseCat || '').toUpperCase() === 'PDC';

    // Resolve PDC details (regular single PDC vs promo/bundle payload shape)
    let pdcSession1 = null;
    let pdcTime1 = null;
    let pdcDate1 = null;
    if (isRegularPdc) {
      pdcDate1 = scheduleDate || null;
      pdcSession1 = slotResult.rows[0]?.session || null;
      pdcTime1 = slotResult.rows[0]?.time_range || null;
    } else if (resolvedScheduleSlotId2 && resolvedScheduleDate2) {
      const slot2Result = await pool.query('SELECT session, time_range FROM schedule_slots WHERE id = $1', [resolvedScheduleSlotId2]);
      pdcSession1 = slot2Result.rows[0]?.session || 'N/A';
      pdcTime1 = slot2Result.rows[0]?.time_range || 'N/A';
      pdcDate1 = resolvedScheduleDate2;
    }

    // Get PDC Day 2 details
    let pdcSession2 = null;
    let pdcTime2 = null;
    let pdcDate2 = null;
    if (isRegularPdc && resolvedScheduleSlotId2 && resolvedScheduleDate2) {
      const pdcSlot2Result = await pool.query('SELECT session, time_range FROM schedule_slots WHERE id = $1', [resolvedScheduleSlotId2]);
      pdcSession2 = pdcSlot2Result.rows[0]?.session || 'N/A';
      pdcTime2 = pdcSlot2Result.rows[0]?.time_range || 'N/A';
      pdcDate2 = resolvedScheduleDate2;
    } else if (resolvedPromoPdcSlotId2 && resolvedPromoPdcDate2) {
      const promoSlot2Result = await pool.query('SELECT session, time_range FROM schedule_slots WHERE id = $1', [resolvedPromoPdcSlotId2]);
      pdcSession2 = promoSlot2Result.rows[0]?.session || 'N/A';
      pdcTime2 = promoSlot2Result.rows[0]?.time_range || 'N/A';
      pdcDate2 = resolvedPromoPdcDate2;
    }

    // Detect if Digital Add-ons were selected
    const hasReviewer = Array.isArray(addons) && addons.some(a => 
      (typeof a === 'string' && (a === 'addon-reviewer' || a.includes('Reviewer'))) ||
      (a && typeof a === 'object' && (a.id === 'addon-reviewer' || (a.name && a.name.includes('Reviewer'))))
    );
    const hasVehicleTips = Array.isArray(addons) && addons.some(a => 
      (typeof a === 'string' && (a === 'addon-tips' || a.includes('Maintenance'))) ||
      (a && typeof a === 'object' && (a.id === 'addon-tips' || (a.name && a.name.includes('Maintenance'))))
    );

    // Construct a list of all add-on names for display
    const addonNames = (addons || []).map(a => typeof a === 'object' ? a.name : a).filter(Boolean).join(', ');

    // 8. Send walk-in enrollment confirmation email
    try {
      const resolvedTdcLabel = (() => {
        const source = String(req.body?.tdcScheduleLabel || '').trim();
        if (source) return source;
        const tdc = notesCourseList.find((item) => String(item?.category || '').toUpperCase() === 'TDC');
        if (!tdc) return 'TDC';
        const tdcType = String(tdc?.type || '').toUpperCase();
        return tdcType ? `TDC ${tdcType}` : 'TDC';
      })();

      await sendWalkInEnrollmentEmail(email, firstName, lastName, generatedPassword, verificationCode, {
        bookingId: bookingResult.rows[0].id,
        courseName: courseNameEmail,
        courseList: normalizedCourseListForPricing,
        courseCategory: courseCat,
        courseType: (String(courseType || '').toLowerCase() === 'promo-bundle' ? (resolvedTdcTypeFromLabel || courseType) : courseType),
        courseTypePdc, // Pass both types for bundles
        tdcLabel: resolvedTdcLabel,
        branchName,
        branchAddress,
        scheduleDate: isOnlineTdcNoSchedule ? null : (scheduleDate || null),
        scheduleSession,
        scheduleTime,
        scheduleEndDate, // For TDC Auto-Day 2
        pdcDate1,
        pdcSession1,
        pdcTime1,
        pdcDate2,
        pdcSession2,
        pdcTime2,
        pdcSchedules,
        pdcScheduleLockedUntilCompletion: isPromoPdcLocked,
        pdcScheduleLockReason: isPromoPdcLocked
          ? (pdcScheduleLockReason || 'PDC schedule will be assigned by Admin/Superadmin after OTDC is marked complete.')
          : null,
        paymentMethod: normalizedPaymentMethod,
        amountPaid,
        paymentStatus,
        addonNames, // Added for accuracy in enrollment details box
        addonsDetailed: normalizedAddonsDetailed,
        subtotal: normalizedSubtotal,
        promoDiscount: normalizedPromoDiscount,
        convenienceFee: normalizedConvenienceFee,
        totalAmount: normalizedTotalAssessment,
        isNewUser // Pass flag to control credentials display in email
      }, hasReviewer, hasVehicleTips);
      console.log('âœ… Enrollment email sent to:', email);
    } catch (emailError) {
      console.error('âš ï¸ Failed to send enrollment email:', emailError.message);
      // Continue - enrollment still succeeded even if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Walk-in enrollment completed successfully. Confirmation email sent to student.',
      data: {
        userId: userId,
        bookingId: bookingResult.rows[0].id,
        email: email,
        emailSent: true
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('âŒ Walk-in enrollment error:', error);

    if (error.code === '23505') { // Unique violation
      if (error.constraint === 'schedule_enrollments_slot_id_student_id_key') {
        return res.status(400).json({ error: 'Student is already enrolled in this schedule slot.' });
      }
      return res.status(400).json({ error: 'A record with this information already exists.' });
    }

    res.status(500).json({ error: 'Server error during walk-in enrollment. Please try again.' });
  } finally {
    client.release();
  }
};

// Get all financial transactions (derived from bookings)
const getAllTransactions = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const scope = await getUserBranchScope(req.user);
    if (isScopedWithoutBranch(scope)) {
      return res.json({ success: true, transactions: [] });
    }

    const whereParts = ["b.status IN ('paid', 'partial_payment', 'confirmed', 'completed')"];
    const queryParams = [];
    let paramIndex = 1;

    if (!scope.canViewAll && scope.branchId) {
      whereParts.push(`b.branch_id = $${paramIndex++}`);
      queryParams.push(scope.branchId);
    }

    queryParams.push(limit);

    const result = await pool.query(
      `SELECT 
        b.id,
        b.user_id,
        b.booking_date,
        b.total_amount,
        b.payment_type,
        b.payment_method,
        b.status,
        b.created_at,
        b.updated_at,
        b.notes,
        b.branch_id,
        u.first_name || ' ' || u.last_name AS student_name,
        c.name AS course_name,
        br.name AS branch_name
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN courses c ON b.course_id = c.id
      LEFT JOIN branches br ON b.branch_id = br.id
      WHERE ${whereParts.join(' AND ')}
      ORDER BY b.created_at DESC
      LIMIT $${paramIndex}`,
      queryParams
    );

    const transactions = [];
    const isSuperAdmin = String(req.user.role || '').toLowerCase() === 'super_admin';

    for (const row of result.rows) {
      const tAmt = parseFloat(row.total_amount || 0);
      let addrev = 0, conv = 0;

      if (row.notes && typeof row.notes === 'string' && row.notes.trim().startsWith('{')) {
        try {
          const js = JSON.parse(row.notes);
          if (js.convenienceFee) conv = parseFloat(js.convenienceFee);
          if (Array.isArray(js.addonsDetailed)) {
             addrev = js.addonsDetailed.reduce((sum, a) => sum + parseFloat(a.price || 0), 0);
          }
        } catch(e) {}
      }

      const courseRev = Math.max(0, tAmt - addrev - conv);
      let finalAmt = isSuperAdmin ? tAmt : courseRev;

      // Full Payment bookings, confirmed (StarPay) and directly-paid bookings are Success
      const isPaid = row.status === 'paid' || row.status === 'confirmed' || row.status === 'completed' || row.payment_type === 'Full Payment';
      transactions.push({
        transaction_id: `TXN-${new Date(row.created_at).getFullYear()}-${String(row.id).padStart(3, '0')}`,
        booking_id: row.id,
        student_name: row.student_name || 'Unknown',
        transaction_date: row.created_at,
        amount: finalAmt,
        payment_method: row.payment_method || 'Cash',
        payment_type: row.payment_type || 'Full Payment',
        status: isPaid ? 'Success' : 'Partial Payment',
        course_name: row.course_name || 'N/A',
        branch_name: row.branch_name || 'Unknown',
        branch_id: row.branch_id || null,
        notes: isSuperAdmin ? row.notes : null
      });

      // Emit a separate row for the rescheduling fee if present in notes
      if (row.notes && row.notes.toLowerCase().includes('rescheduling fee')) {
        transactions.push({
          transaction_id: `TXN-${new Date(row.created_at).getFullYear()}-${String(row.id).padStart(3, '0')}-RSF`,
          booking_id: row.id,
          student_name: row.student_name || 'Unknown',
          transaction_date: row.updated_at || row.created_at,
          amount: 1000,
          payment_method: 'Cash',
          payment_type: 'Rescheduling Fee',
          status: 'Success',
          course_name: 'Rescheduling Fee',
          branch_name: row.branch_name || 'Unknown',
          branch_id: row.branch_id || null
        });
      }
    }

    res.json({ success: true, transactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};

// Get unpaid/partial-payment bookings
const getUnpaidBookings = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const { branchId } = req.query;
    const scope = await getUserBranchScope(req.user);
    if (isScopedWithoutBranch(scope)) {
      return res.json({ success: true, bookings: [] });
    }
    const requestedBranchId = branchId ? parseInt(branchId, 10) : null;
    const effectiveBranchId = scope.canViewAll ? requestedBranchId : scope.branchId;

    const whereParts = ["b.status IN ('partial_payment')", "b.payment_type != 'Full Payment'"];
    const params = [];
    let paramIdx = 1;
    if (effectiveBranchId) {
      whereParts.push(`b.branch_id = $${paramIdx++}`);
      params.push(effectiveBranchId);
    }
    params.push(limit);

    const result = await pool.query(
      `SELECT 
        b.id,
        b.branch_id,
        b.booking_date,
        b.notes,
        b.total_amount,
        b.payment_type,
        b.payment_method,
        b.status,
        b.created_at,
        u.first_name || ' ' || u.last_name AS student_name,
        u.contact_numbers AS student_contact,
        u.email AS student_email,
        c.name AS course_name,
        c.price AS course_price
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN courses c ON b.course_id = c.id
      WHERE ${whereParts.join(' AND ')}
      ORDER BY b.created_at DESC
      LIMIT $${paramIdx}`,
      params
    );

    const bookings = result.rows.map(row => {
      const amountPaid = parseFloat(row.total_amount || 0);
      let notesJson = null;
      try {
        if (typeof row.notes === 'string' && row.notes.trim().startsWith('{')) {
          notesJson = JSON.parse(row.notes);
        }
      } catch (_) {
        notesJson = null;
      }

      const noteCourseList = Array.isArray(notesJson?.courseList) ? notesJson.courseList : [];
      const noteAddons = Array.isArray(notesJson?.addonsDetailed) ? notesJson.addonsDetailed : [];
      const noteSubtotal = Number(notesJson?.subtotal || 0);
      const noteConvenience = Number(notesJson?.convenienceFee || 0);
      const noteDiscount = Number(notesJson?.promoDiscount || 0);

      const courseListTotal = noteCourseList.reduce((sum, c) => sum + Number(c?.price || 0), 0);
      const addonsTotal = noteAddons.reduce((sum, a) => sum + Number(a?.price || 0), 0);

      const computedFromNotes =
        noteSubtotal > 0
          ? noteSubtotal + noteConvenience - noteDiscount
          : (courseListTotal + addonsTotal + noteConvenience - noteDiscount);

      const fallbackCoursePrice = parseFloat(row.course_price || 0);
      const isDownpayment = /down\s*-?\s*payment/i.test(String(row.payment_type || ''));
      const inferredDownpaymentTotal = isDownpayment && amountPaid > 0 ? amountPaid * 2 : 0;

      const assessedTotal =
        computedFromNotes > 0
          ? computedFromNotes
          : (inferredDownpaymentTotal > 0 ? inferredDownpaymentTotal : fallbackCoursePrice);

      const balanceDue = Math.max(0, Number((assessedTotal - amountPaid).toFixed(2)));

      return {
        id: row.id,
        student_name: row.student_name || 'Unknown',
        student_contact: row.student_contact || row.student_email || 'N/A',
        course_name: row.course_name || 'N/A',
        total_amount: amountPaid,
        course_price: assessedTotal,
        balance_due: balanceDue,
        payment_type: row.payment_type || 'N/A',
        status: row.status,
        booking_date: row.booking_date,
        created_at: row.created_at,
        branch_id: row.branch_id || null
      };
    });

    res.json({ success: true, bookings });
  } catch (error) {
    console.error('Error fetching unpaid bookings:', error);
    res.status(500).json({ error: 'Failed to fetch unpaid bookings' });
  }
};

// Get funnel data
const getFunnelData = async (req, res) => {
  try {
    const scope = await getUserBranchScope(req.user);
    if (isScopedWithoutBranch(scope)) {
      return res.json({ success: true, data: [
        { name: 'Visitors', value: 0, fill: '#8884d8' },
        { name: 'Enrolled', value: 0, fill: '#8dd1e1' },
        { name: 'Active', value: 0, fill: '#82ca9d' },
        { name: 'Graduates', value: 0, fill: '#a4de6c' },
      ] });
    }
    const params = [];
    const userBranchClause = (!scope.canViewAll && scope.branchId)
      ? ` WHERE COALESCE(branch_id, (SELECT branch_id FROM bookings WHERE user_id = users.id ORDER BY created_at DESC LIMIT 1)) = $1`
      : '';
    const bookingBranchClause = (!scope.canViewAll && scope.branchId)
      ? ` AND branch_id = $1`
      : '';
    if (!scope.canViewAll && scope.branchId) params.push(scope.branchId);

    // Real student journey stages
    const totalUsersResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM users
       ${userBranchClause}${userBranchClause ? ' AND' : ' WHERE'} role IN ('student', 'walkin_student')`,
      params
    );
    const totalBookingsResult = await pool.query(
      `SELECT COUNT(DISTINCT user_id) as count
       FROM bookings
      WHERE status IN ('confirmed', 'completed', 'paid', 'partial_payment') ${bookingBranchClause}`,
      params
    );
    const activeBookingsResult = await pool.query(
      `SELECT COUNT(DISTINCT user_id) as count
       FROM bookings
      WHERE status IN ('confirmed', 'paid', 'partial_payment') ${bookingBranchClause}`,
      params
    );
    const completedBookingsResult = await pool.query(
      `SELECT COUNT(DISTINCT user_id) as count
       FROM bookings
       WHERE status = 'completed' ${bookingBranchClause}`,
      params
    );

    const visitors = parseInt(totalUsersResult.rows[0].count || 0, 10);
    const totalBookings = parseInt(totalBookingsResult.rows[0].count || 0, 10);
    const activeBookings = parseInt(activeBookingsResult.rows[0].count || 0, 10);
    const completedBookings = parseInt(completedBookingsResult.rows[0].count || 0, 10);

    const funnelData = [
      { name: 'Visitors', value: visitors, fill: '#8884d8' },
      { name: 'Enrolled', value: totalBookings, fill: '#8dd1e1' },
      { name: 'Active', value: activeBookings, fill: '#82ca9d' },
      { name: 'Graduates', value: completedBookings, fill: '#a4de6c' },
    ];

    res.json({ success: true, data: funnelData });
  } catch (error) {
    console.error('Get funnel data error:', error);
    res.status(500).json({ error: 'Server error while fetching funnel data' });
  }
};

// Get course distribution
const getCourseDistribution = async (req, res) => {
  try {
    const scope = await getUserBranchScope(req.user);
    if (isScopedWithoutBranch(scope)) {
      return res.json({ success: true, data: [] });
    }
    const params = [];
    const branchClause = (!scope.canViewAll && scope.branchId)
      ? ` AND b.branch_id = $1`
      : '';
    if (!scope.canViewAll && scope.branchId) params.push(scope.branchId);

    const result = await pool.query(`
      WITH expanded AS (
        -- Bundle-aware path: count each course listed in notes.courseList
        SELECT
          UPPER(TRIM(COALESCE(item->>'category', ''))) AS category
        FROM bookings b
        CROSS JOIN LATERAL jsonb_array_elements((b.notes::jsonb)->'courseList') AS item
        WHERE b.notes IS NOT NULL
          AND b.notes ~ '^\\{'
          AND jsonb_typeof((b.notes::jsonb)->'courseList') = 'array'
          AND jsonb_array_length((b.notes::jsonb)->'courseList') > 0
          ${branchClause}

        UNION ALL

        -- Legacy fallback: use primary course_id when courseList is unavailable
        SELECT
          UPPER(TRIM(COALESCE(c.category, ''))) AS category
        FROM bookings b
        JOIN courses c ON b.course_id = c.id
        WHERE (
          b.notes IS NULL
          OR b.notes !~ '^\\{'
          OR jsonb_typeof((b.notes::jsonb)->'courseList') IS DISTINCT FROM 'array'
          OR jsonb_array_length((b.notes::jsonb)->'courseList') = 0
        )
        ${branchClause}
      )
      SELECT category, COUNT(*) AS count
      FROM expanded
      WHERE category <> ''
      GROUP BY category
      ORDER BY count DESC
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get course distribution error:', error);
    res.status(500).json({ error: 'Server error while fetching course distribution' });
  }
};

// Get branch performance
const getBranchPerformance = async (req, res) => {
  try {
    const scope = await getUserBranchScope(req.user);
    if (isScopedWithoutBranch(scope)) {
      return res.json({ success: true, data: [] });
    }
    const params = [];
    const branchClause = (!scope.canViewAll && scope.branchId)
      ? ` AND b.branch_id = $1`
      : '';
    if (!scope.canViewAll && scope.branchId) params.push(scope.branchId);

    const result = await pool.query(`
      SELECT br.name as branch_name, COALESCE(SUM(b.total_amount), 0) as revenue
      FROM bookings b
      JOIN branches br ON b.branch_id = br.id
      WHERE b.status IN ('confirmed', 'completed', 'paid', 'partial_payment')
      ${branchClause}
      GROUP BY br.name
      ORDER BY revenue DESC
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get branch performance error:', error);
    res.status(500).json({ error: 'Server error while fetching branch performance' });
  }
};


const markBookingAsPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_method, transaction_id, amount_to_collect } = req.body;
    const scope = await getUserBranchScope(req.user);

    const access = await getBookingAccessInScope(id, scope);
    if (!access.exists) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    if (!access.allowed) {
      return res.status(403).json({ error: 'Access denied for this branch booking' });
    }

    // Fetch booking + course price
    const bookingResult = await pool.query(
      `SELECT b.*, c.price AS course_price
       FROM bookings b
       LEFT JOIN courses c ON b.course_id = c.id
       WHERE b.id = $1`,
      [id]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];
    const coursePrice = parseFloat(booking.course_price || 0);
    const previousAmount = parseFloat(booking.total_amount || 0);
    const isDownpaymentBooking = String(booking.payment_type || '').toLowerCase().includes('down');

    let notesJson = {};
    try {
      notesJson = booking.notes && String(booking.notes).startsWith('{') ? JSON.parse(booking.notes) : {};
    } catch (_) {
      notesJson = {};
    }

    const toAmount = (value) => {
      if (value == null) return 0;
      const numeric = Number(String(value).replace(/[^0-9.-]/g, ''));
      return Number.isFinite(numeric) ? numeric : 0;
    };

    const notesCourseTotal = (Array.isArray(notesJson?.courseList) ? notesJson.courseList : []).reduce((sum, item) => {
      const line = item?.finalPrice ?? item?.discountedPrice ?? item?.netPrice ?? item?.lineTotal ?? item?.price ?? item?.amount ?? item?.coursePrice ?? 0;
      return sum + Math.max(0, toAmount(line));
    }, 0);
    const notesAddonTotal = (Array.isArray(notesJson?.addonsDetailed) ? notesJson.addonsDetailed : []).reduce((sum, item) => {
      return sum + Math.max(0, toAmount(item?.price || 0));
    }, 0);

    const notesPromo = Math.max(0, toAmount(notesJson?.promoDiscount || 0));
    const notesConvenience = Math.max(0, toAmount(notesJson?.convenienceFee || 0));
    const notesSubtotal = Math.max(0, toAmount(notesJson?.subtotal || 0));
    const notesDerivedAssessment = Math.max(0, Number(((notesSubtotal > 0 ? notesSubtotal : (notesCourseTotal + notesAddonTotal)) + notesConvenience - notesPromo).toFixed(2)));
    const explicitNotesAssessment = [
      notesJson?.totalAmount,
      notesJson?.grandTotal,
      notesJson?.finalTotal,
      notesJson?.assessedTotal,
      notesJson?.payableAmount,
      notesJson?.amountToPay,
    ]
      .map((v) => Math.max(0, toAmount(v)))
      .find((v) => v > 0) || 0;

    const estimatedAssessment = isDownpaymentBooking && previousAmount > 0
      ? (previousAmount * 2)
      : coursePrice;
    const targetAssessment = Math.max(
      explicitNotesAssessment,
      notesDerivedAssessment,
      estimatedAssessment,
      previousAmount,
      coursePrice
    );

    let collectAmount = Number(amount_to_collect);
    if (!Number.isFinite(collectAmount) || collectAmount <= 0) {
      collectAmount = Math.max(0, targetAssessment - previousAmount);
    }

    const nextTotalAmount = Math.min(targetAssessment, previousAmount + collectAmount);
    const remainingBalance = Math.max(0, Number((targetAssessment - nextTotalAmount).toFixed(2)));
    const nextStatus = remainingBalance <= 0.009 ? 'paid' : 'partial_payment';
    const nextPaymentType = nextStatus === 'paid' ? 'Full Payment' : 'Downpayment';

    const result = await pool.query(
      `UPDATE bookings
       SET status = $1,
           total_amount = $2,
           payment_type = $3,
           payment_method = COALESCE($4, payment_method),
           transaction_id = COALESCE($5, transaction_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [nextStatus, Number(nextTotalAmount.toFixed(2)), nextPaymentType, payment_method || null, transaction_id || null, id]
    );

    try {
      const paymentHistory = Array.isArray(notesJson.paymentHistory) ? notesJson.paymentHistory : [];
      const collectedNow = Math.max(0, Number((nextTotalAmount - previousAmount).toFixed(2)));
      if (!Number.isFinite(Number(notesJson.initialAmountPaid))) {
        notesJson.initialAmountPaid = Math.max(0, Number(previousAmount.toFixed(2)));
      }
      paymentHistory.push({
        at: new Date().toISOString(),
        amount: collectedNow,
        paymentMethod: payment_method || booking.payment_method || 'Cash',
        transactionId: transaction_id || booking.transaction_id || null,
        statusAfter: nextStatus,
        totalPaidAfter: Math.max(0, Number(nextTotalAmount.toFixed(2))),
      });
      notesJson.paymentHistory = paymentHistory;

      await pool.query(
        `UPDATE bookings SET notes = $2 WHERE id = $1`,
        [id, JSON.stringify(notesJson)]
      );
    } catch (notesErr) {
      console.error('Payment history notes update failed (non-fatal):', notesErr.message);
    }

    // Auto-enroll in schedule slot(s) if stored in notes (e.g. older online StarPay bookings)
    try {
      const meta = JSON.parse(booking.notes || '{}');
      for (const key of ['scheduleSlotId', 'scheduleSlotId2']) {
        if (meta[key]) {
          await assertB1B2CapacityForSlot(pool, meta[key], booking.user_id);
          await pool.query(
            `INSERT INTO schedule_enrollments (slot_id, student_id, enrollment_status)
             VALUES ($1, $2, 'enrolled')
             ON CONFLICT (slot_id, student_id) DO NOTHING`,
            [meta[key], booking.user_id]
          );
          const dec = await pool.query(
            `UPDATE schedule_slots
                SET available_slots = available_slots - 1
              WHERE id = $1
                AND available_slots > 0
              RETURNING id`,
            [meta[key]]
          );
          if (dec.rows.length === 0) {
            throw new Error(`Selected slot ${meta[key]} is already full.`);
          }
        }
      }
    } catch (enrollErr) {
      console.error('Auto-enroll on markAsPaid failed (non-fatal):', enrollErr.message);
    }

    // Auto-send receipt only when fully paid.
    if (nextStatus === 'paid') {
      try {
        const userResult = await pool.query(
          `SELECT u.first_name, u.last_name, u.email, c.name AS course_name
           FROM bookings b
           JOIN users u ON b.user_id = u.id
           LEFT JOIN courses c ON b.course_id = c.id
           WHERE b.id = $1`,
          [id]
        );
        if (userResult.rows.length > 0) {
          const u = userResult.rows[0];
          const receiptPaymentAmount = Math.max(0, Number((nextTotalAmount - previousAmount).toFixed(2)));
          await sendPaymentReceiptEmail(u.email, u.first_name, u.last_name, {
            bookingId: id,
            transactionId: transaction_id || `TXN-${new Date().getFullYear()}-${String(id).padStart(3, '0')}`,
            courseName: u.course_name || 'N/A',
            amountPaid: receiptPaymentAmount,
            coursePrice: targetAssessment,
            paymentMethod: payment_method || 'Cash',
            paymentDate: new Date(),
            isFullPayment: true,
            balanceDue: 0,
          });
        }
      } catch (emailErr) {
        console.error('Receipt email failed (non-fatal):', emailErr.message);
      }
    }

    res.json({
      success: true,
      message: nextStatus === 'paid' ? 'Booking marked as fully paid' : 'Partial payment recorded',
      booking: result.rows[0],
      course_price: targetAssessment,
      previous_amount: previousAmount,
      balance_collected: Number((nextTotalAmount - previousAmount).toFixed(2)),
      remaining_balance: remainingBalance,
    });

    // Bust stats cache so dashboard immediately reflects new revenue/pending counts
    bustCache(`stats:super_admin:all`, `stats:admin:${result.rows[0].branch_id}`, `stats:admin:all`);
  } catch (error) {
    console.error('Mark as paid error:', error);
    res.status(500).json({ error: 'Server error while marking booking as paid' });
  }
};

const assignPdcSchedule = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { assignments } = req.body || {};
    const scope = await getUserBranchScope(req.user);

    const access = await getBookingAccessInScope(id, scope);
    if (!access.exists) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    if (!access.allowed) {
      return res.status(403).json({ error: 'Access denied for this branch booking' });
    }

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ error: 'At least one PDC assignment is required.' });
    }

    await client.query('BEGIN');

    const bookingResult = await client.query(
      `SELECT id, user_id, branch_id, status, notes, updated_at
       FROM bookings
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];
    const status = String(booking.status || '').toLowerCase();

    let notesJson = {};
    try {
      notesJson = booking.notes && String(booking.notes).startsWith('{') ? JSON.parse(booking.notes) : {};
    } catch {
      notesJson = {};
    }

    const isPdcLockedByOtdc = !!notesJson?.pdcScheduleLockedUntilCompletion;

    if (isPdcLockedByOtdc && status !== 'completed') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'OTDC must be marked complete before assigning PDC schedules for this booking.' });
    }

    if (!isPdcLockedByOtdc && !['paid', 'confirmed', 'completed'].includes(status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Booking must be paid/confirmed/completed before assigning PDC schedule.' });
    }

    const getDateOnlyString = (input) => {
      const d = new Date(input || Date.now());
      d.setHours(0, 0, 0, 0);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    let minSchedDateFromCompletion = null;
    if (isPdcLockedByOtdc) {
      const completedBase = new Date(booking.updated_at || Date.now());
      completedBase.setHours(0, 0, 0, 0);
      completedBase.setDate(completedBase.getDate() + 2);
      minSchedDateFromCompletion = getDateOnlyString(completedBase);
    }

    const normalizedAssignments = assignments.map((item, idx) => {
      const slot1 = Number(item?.scheduleSlotId || item?.pdcSlot || 0);
      const slot2Raw = item?.promoPdcSlotId2 || item?.pdcSlot2 || null;
      const slot2 = slot2Raw ? Number(slot2Raw) : null;
      const key = String(item?.courseKey || item?.courseId || `pdc_${idx + 1}`);
      return {
        courseKey: key,
        courseId: item?.courseId || null,
        courseName: item?.courseName || `PDC Course ${idx + 1}`,
        courseType: item?.courseType || '',
        pdcDate: item?.pdcDate || item?.scheduleDate || null,
        pdcDate2: item?.pdcDate2 || item?.promoPdcDate2 || null,
        scheduleSlotId: slot1,
        promoPdcSlotId2: slot2,
      };
    });

    // Only assignments with a slot1 are processed; others are silently skipped (partial allowed)
    const validAssignments = normalizedAssignments.filter(item => !!item.scheduleSlotId);
    if (validAssignments.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'At least one PDC course must have a Day 1 slot assigned.' });
    }

    const slotIds = [...new Set(
      normalizedAssignments
        .flatMap((item) => [item.scheduleSlotId, item.promoPdcSlotId2])
        .filter(Boolean)
        .map((v) => Number(v))
    )];

    const slotMap = new Map();
    if (slotIds.length > 0) {
      const slotsResult = await client.query(
        `SELECT id, branch_id, type, date, end_date, session, time_range, available_slots, course_type
         FROM schedule_slots
         WHERE id = ANY($1::int[])`,
        [slotIds]
      );

      slotsResult.rows.forEach((slot) => {
        slotMap.set(Number(slot.id), slot);
      });
    }

    const ensureEnrollment = async (slotId) => {
      const slotMeta = slotMap.get(Number(slotId));
      const existing = await client.query(
        `SELECT id, enrollment_status
         FROM schedule_enrollments
         WHERE slot_id = $1 AND student_id = $2
         LIMIT 1`,
        [slotId, booking.user_id]
      );

      if (existing.rows.length === 0) {
        await assertB1B2CapacityForSlot(client, slotId, booking.user_id, slotMeta);
        const dec = await client.query(
          `UPDATE schedule_slots
           SET available_slots = available_slots - 1
           WHERE id = $1 AND available_slots > 0
           RETURNING id`,
          [slotId]
        );
        if (dec.rows.length === 0) {
          throw new Error('Selected slot is already full.');
        }
        await client.query(
          `INSERT INTO schedule_enrollments (slot_id, student_id, enrollment_status, booking_id)
           VALUES ($1, $2, 'enrolled', $3)`,
          [slotId, booking.user_id, booking.id]
        );
        return;
      }

      const prevStatus = String(existing.rows[0].enrollment_status || '').toLowerCase();
      if (prevStatus === 'cancelled' || prevStatus === 'no-show') {
        await assertB1B2CapacityForSlot(client, slotId, booking.user_id, slotMeta);
        const dec = await client.query(
          `UPDATE schedule_slots
           SET available_slots = available_slots - 1
           WHERE id = $1 AND available_slots > 0
           RETURNING id`,
          [slotId]
        );
        if (dec.rows.length === 0) {
          throw new Error('Selected slot is already full.');
        }
      }

      await client.query(
        `UPDATE schedule_enrollments
         SET enrollment_status = 'enrolled',
             booking_id = $2
         WHERE id = $1`,
        [existing.rows[0].id, booking.id]
      );
    };

    const nextPdcSelections = {
      ...(notesJson?.pdcSelections && typeof notesJson.pdcSelections === 'object' ? notesJson.pdcSelections : {}),
    };

    for (const item of validAssignments) {
      const slot1 = slotMap.get(Number(item.scheduleSlotId));
      if (!slot1) {
        throw new Error(`Slot ${item.scheduleSlotId} not found.`);
      }
      if (String(slot1.type || '').toLowerCase() !== 'pdc') {
        throw new Error(`Slot ${item.scheduleSlotId} is not a PDC slot.`);
      }
      if (booking.branch_id && slot1.branch_id && Number(slot1.branch_id) !== Number(booking.branch_id)) {
        throw new Error('Selected PDC slot does not match booking branch.');
      }
      if (minSchedDateFromCompletion && String(slot1.date || '') < minSchedDateFromCompletion) {
        throw new Error(`PDC scheduling can start on ${minSchedDateFromCompletion} based on OTDC completion date.`);
      }

      await ensureEnrollment(Number(item.scheduleSlotId));

      let slot2 = null;
      if (item.promoPdcSlotId2) {
        slot2 = slotMap.get(Number(item.promoPdcSlotId2));
        if (!slot2) {
          throw new Error(`Slot ${item.promoPdcSlotId2} not found.`);
        }
        if (String(slot2.type || '').toLowerCase() !== 'pdc') {
          throw new Error(`Slot ${item.promoPdcSlotId2} is not a PDC slot.`);
        }
        if (booking.branch_id && slot2.branch_id && Number(slot2.branch_id) !== Number(booking.branch_id)) {
          throw new Error('Selected PDC Day 2 slot does not match booking branch.');
        }
        if (minSchedDateFromCompletion && String(slot2.date || '') < minSchedDateFromCompletion) {
          throw new Error(`PDC scheduling can start on ${minSchedDateFromCompletion} based on OTDC completion date.`);
        }
        await ensureEnrollment(Number(item.promoPdcSlotId2));
      }

      nextPdcSelections[item.courseKey] = {
        courseId: item.courseId,
        courseName: item.courseName,
        courseType: item.courseType,
        pdcDate: item.pdcDate || slot1.date || null,
        pdcSlot: Number(item.scheduleSlotId),
        pdcSlotDetails: {
          id: Number(item.scheduleSlotId),
          session: slot1.session,
          type: slot1.type,
          time: slot1.time_range,
          time_range: slot1.time_range,
          date: slot1.date,
          end_date: slot1.end_date || null,
        },
        pdcDate2: slot2 ? (item.pdcDate2 || slot2.date || null) : null,
        pdcSlot2: slot2 ? Number(item.promoPdcSlotId2) : null,
        pdcSlotDetails2: slot2 ? {
          id: Number(item.promoPdcSlotId2),
          session: slot2.session,
          type: slot2.type,
          time: slot2.time_range,
          time_range: slot2.time_range,
          date: slot2.date,
          end_date: slot2.end_date || null,
        } : null,
      };
    }

    const updatedNotes = {
      ...notesJson,
      pdcSelections: nextPdcSelections,
      pdcScheduleLockedUntilCompletion: false,
      pdcScheduleAssignedAt: new Date().toISOString(),
      pdcScheduleAssignedBy: req.user?.id || null,
    };

    await client.query(
      `UPDATE bookings
       SET notes = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [booking.id, JSON.stringify(updatedNotes)]
    );

    await client.query('COMMIT');

    // Send PDC schedule confirmation email (non-fatal)
    try {
      const studentResult = await pool.query(
        `SELECT u.first_name, u.last_name, u.email, br.name AS branch_name
         FROM bookings b
         JOIN users u ON b.user_id = u.id
         LEFT JOIN branches br ON b.branch_id = br.id
         WHERE b.id = $1`, [booking.id]
      );
      if (studentResult.rows.length > 0) {
        const stu = studentResult.rows[0];
        const emailAssignments = Object.values(nextPdcSelections).map(sel => ({
          courseName:  sel.courseName,
          courseType:  sel.courseType,
          pdcDate:     sel.pdcDate,
          pdcSession:  sel.pdcSlotDetails?.session,
          pdcTime:     sel.pdcSlotDetails?.time_range,
          pdcDate2:    sel.pdcDate2 || null,
          pdcSession2: sel.pdcSlotDetails2?.session || null,
          pdcTime2:    sel.pdcSlotDetails2?.time_range || null,
        }));
        await sendPdcScheduleAssignedEmail(
          stu.email, stu.first_name, stu.last_name,
          emailAssignments, stu.branch_name || ''
        );
      }
    } catch (emailErr) {
      console.error('PDC schedule email (non-fatal):', emailErr.message);
    }

    return res.json({
      success: true,
      message: 'PDC schedule assigned successfully.',
      bookingId: booking.id,
      pdcSelections: nextPdcSelections,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Assign PDC schedule error:', error);
    return res.status(500).json({ error: error.message || 'Server error while assigning PDC schedule' });
  } finally {
    client.release();
  }
};

// Send payment receipt email on demand (admin action)
const sendReceiptEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const scope = await getUserBranchScope(req.user);

    const access = await getBookingAccessInScope(id, scope);
    if (!access.exists) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    if (!access.allowed) {
      return res.status(403).json({ error: 'Access denied for this branch booking' });
    }

    const result = await pool.query(
      `SELECT b.id, b.total_amount, b.payment_type, b.payment_method, b.status, b.created_at, b.notes,
              u.first_name, u.last_name, u.email,
              c.name AS course_name, c.price AS course_price
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       LEFT JOIN courses c ON b.course_id = c.id
       WHERE b.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const row = result.rows[0];
    const amountPaid = Math.max(0, parseFloat(row.total_amount || 0));
    const baseCoursePrice = Math.max(0, parseFloat(row.course_price || 0));
    const paymentTypeRaw = String(row.payment_type || '').toLowerCase();
    const isDownpayment = paymentTypeRaw.includes('down');

    let notesJson = {};
    try {
      notesJson = row.notes ? JSON.parse(row.notes) : {};
    } catch (_) {
      notesJson = {};
    }

    const toAmount = (value) => {
      if (value == null) return 0;
      const numeric = Number(String(value).replace(/[^0-9.-]/g, ''));
      return Number.isFinite(numeric) ? numeric : 0;
    };

    const notesCourseTotal = (Array.isArray(notesJson?.courseList) ? notesJson.courseList : []).reduce((sum, item) => {
      const line = item?.finalPrice ?? item?.discountedPrice ?? item?.netPrice ?? item?.lineTotal ?? item?.price ?? item?.amount ?? item?.coursePrice ?? 0;
      return sum + Math.max(0, toAmount(line));
    }, 0);
    const notesAddonTotal = (Array.isArray(notesJson?.addonsDetailed) ? notesJson.addonsDetailed : []).reduce((sum, item) => {
      return sum + Math.max(0, toAmount(item?.price || 0));
    }, 0);

    const notesPromo = Math.max(0, toAmount(notesJson?.promoDiscount || 0));
    const notesConvenience = Math.max(0, toAmount(notesJson?.convenienceFee || 0));
    const notesSubtotal = Math.max(0, toAmount(notesJson?.subtotal || 0));
    const notesDerivedAssessment = Math.max(0, Number(((notesSubtotal > 0 ? notesSubtotal : (notesCourseTotal + notesAddonTotal)) + notesConvenience - notesPromo).toFixed(2)));
    const explicitNotesAssessment = [notesJson?.totalAmount, notesJson?.grandTotal, notesJson?.finalTotal, notesJson?.assessedTotal]
      .map((v) => Math.max(0, toAmount(v)))
      .find((v) => v > 0) || 0;

    const coursePrice = explicitNotesAssessment > 0
      ? explicitNotesAssessment
      : (notesDerivedAssessment > 0 ? notesDerivedAssessment : baseCoursePrice);
    const balanceDue = Math.max(0, Number((coursePrice - amountPaid).toFixed(2)));
    const isFullPayment = !isDownpayment && (row.status === 'paid' || balanceDue <= 0.009);

    const paymentHistory = Array.isArray(notesJson?.paymentHistory) ? notesJson.paymentHistory : [];
    const lastPayment = paymentHistory.length > 0 ? paymentHistory[paymentHistory.length - 1] : null;
    const initialAmountPaid = Math.max(0, toAmount(notesJson?.initialAmountPaid || 0));
    const inferredCollectedNow = initialAmountPaid > 0 && amountPaid > initialAmountPaid
      ? Math.max(0, Number((amountPaid - initialAmountPaid).toFixed(2)))
      : 0;
    const amountPaidForReceipt = Math.max(
      0,
      toAmount(lastPayment?.amount || 0) || inferredCollectedNow || amountPaid
    );
    const receiptTxnId = String(lastPayment?.transactionId || '').trim() || `TXN-${new Date(row.created_at).getFullYear()}-${String(row.id).padStart(3, '0')}`;
    const receiptPaymentDate = lastPayment?.at || row.created_at;
    const receiptPaymentMethod = lastPayment?.paymentMethod || row.payment_method || 'Cash';

    await sendPaymentReceiptEmail(row.email, row.first_name, row.last_name, {
      bookingId: row.id,
      transactionId: receiptTxnId,
      courseName: row.course_name || 'N/A',
      amountPaid: amountPaidForReceipt,
      coursePrice,
      paymentMethod: receiptPaymentMethod,
      paymentDate: receiptPaymentDate,
      isFullPayment,
      balanceDue,
    });

    res.json({ success: true, message: `Receipt sent to ${row.email}` });
  } catch (error) {
    console.error('Send receipt email error:', error);
    res.status(500).json({ error: 'Failed to send receipt email' });
  }
};

// Get notifications â€” payment and enrollment events filtered by branch role
const getNotifications = async (req, res) => {
  try {
    const scope = await getUserBranchScope(req.user);
    if (isScopedWithoutBranch(scope)) {
      return res.json({ success: true, notifications: [] });
    }
    const branchCondition = (!scope.canViewAll && scope.branchId)
      ? `AND b.branch_id = ${parseInt(scope.branchId, 10)}`
      : '';

    const query = `
      SELECT
        b.id::text AS id,
        b.total_amount,
        b.payment_method,
        b.payment_type,
        b.status,
        u.first_name || ' ' || u.last_name AS student_name,
        c.name AS course_name,
        br.name AS branch_name,
        b.created_at AS time,
        -- Determine notification category
        CASE
          WHEN b.notes IS NOT NULL AND b.notes ~ '^\\{'
            AND (b.notes::jsonb->>'rescheduled') = 'true'
          THEN 'reschedule'
          WHEN LOWER(COALESCE(b.status, '')) <> 'completed'
            AND b.notes IS NOT NULL AND b.notes ~ '^\\{'
            AND (
              (b.notes::jsonb->>'isOnlineTdcNoSchedule') = 'true'
              OR (b.notes::jsonb->>'pdcScheduleLockedUntilCompletion') = 'true'
            )
            OR (
              LOWER(COALESCE(b.status, '')) <> 'completed'
              AND (
              LOWER(COALESCE(c.category, '')) = 'tdc'
              AND LOWER(COALESCE(b.course_type, '')) LIKE '%online%'
              )
            )
          THEN 'online_tdc_account_setup'
          WHEN b.payment_type = 'Full Payment'
            AND b.status IN ('paid', 'confirmed', 'completed')
          THEN 'payment_full'
          WHEN b.payment_type = 'Downpayment'
            OR (b.payment_type IS NOT NULL AND b.payment_type <> 'Full Payment'
                AND b.status IN ('partial_payment'))
          THEN 'payment_down'
          ELSE 'enrollment'
        END AS notif_type,

        -- Dynamic title
        CASE
          WHEN b.notes IS NOT NULL AND b.notes ~ '^\\{'
            AND (b.notes::jsonb->>'rescheduled') = 'true'
          THEN 'Reschedule Request'
          WHEN LOWER(COALESCE(b.status, '')) <> 'completed'
            AND b.notes IS NOT NULL AND b.notes ~ '^\\{'
            AND (
              (b.notes::jsonb->>'isOnlineTdcNoSchedule') = 'true'
              OR (b.notes::jsonb->>'pdcScheduleLockedUntilCompletion') = 'true'
            )
            OR (
              LOWER(COALESCE(b.status, '')) <> 'completed'
              AND (
              LOWER(COALESCE(c.category, '')) = 'tdc'
              AND LOWER(COALESCE(b.course_type, '')) LIKE '%online%'
              )
            )
          THEN 'Online TDC Account Setup Needed'
          WHEN b.payment_type = 'Full Payment'
            AND b.status IN ('paid', 'confirmed', 'completed')
          THEN 'Full Payment Received'
          WHEN b.payment_type = 'Downpayment'
            OR (b.payment_type IS NOT NULL AND b.payment_type <> 'Full Payment'
                AND b.status IN ('partial_payment'))
          THEN 'Partial Payment Received'
          ELSE 'New Student Enrollment'
        END AS title,

        -- Dynamic message
        CASE
          WHEN b.notes IS NOT NULL AND b.notes ~ '^\\{'
            AND (b.notes::jsonb->>'rescheduled') = 'true'
          THEN u.first_name || ' ' || u.last_name
            || ' requested a reschedule for '
            || COALESCE(c.name, 'a course')
            || ' at ' || COALESCE(br.name, 'branch')
          WHEN LOWER(COALESCE(b.status, '')) <> 'completed'
            AND b.notes IS NOT NULL AND b.notes ~ '^\\{'
            AND (
              (b.notes::jsonb->>'isOnlineTdcNoSchedule') = 'true'
              OR (b.notes::jsonb->>'pdcScheduleLockedUntilCompletion') = 'true'
            )
            OR (
              LOWER(COALESCE(b.status, '')) <> 'completed'
              AND (
              LOWER(COALESCE(c.category, '')) = 'tdc'
              AND LOWER(COALESCE(b.course_type, '')) LIKE '%online%'
              )
            )
          THEN 'Student ' || u.first_name || ' ' || u.last_name
            || ' enrolled in Online TDC at ' || COALESCE(br.name, 'branch')
            || '. Please register provider account access, and schedule PDC only after OTDC completion is marked in CRM.'
          WHEN b.payment_type = 'Full Payment'
            AND b.status IN ('paid', 'confirmed', 'completed')
          THEN u.first_name || ' ' || u.last_name
            || ' paid â‚±' || TO_CHAR(COALESCE(b.total_amount, 0), 'FM999,999,990.00')
            || ' in full for ' || COALESCE(c.name, 'a course')
            || ' at ' || COALESCE(br.name, 'branch')
            || ' via ' || COALESCE(b.payment_method, 'Online')
          WHEN b.payment_type = 'Downpayment'
            OR (b.payment_type IS NOT NULL AND b.payment_type <> 'Full Payment'
                AND b.status IN ('partial_payment'))
          THEN u.first_name || ' ' || u.last_name
            || ' made a â‚±' || TO_CHAR(COALESCE(b.total_amount, 0), 'FM999,999,990.00')
            || ' downpayment for ' || COALESCE(c.name, 'a course')
            || ' at ' || COALESCE(br.name, 'branch')
          ELSE
            u.first_name || ' ' || u.last_name
            || ' enrolled in ' || COALESCE(c.name, 'a course')
            || ' at ' || COALESCE(br.name, 'branch')
        END AS message

      FROM bookings b
      JOIN users u ON b.user_id = u.id
      LEFT JOIN courses c ON b.course_id = c.id
      LEFT JOIN branches br ON b.branch_id = br.id
      WHERE b.status IN ('paid', 'partial_payment', 'confirmed', 'completed')
        ${branchCondition}
      ORDER BY b.created_at DESC
      LIMIT 50
    `;

    const result = await pool.query(query);

    const typeMap = {
      payment_full: 'success',
      payment_down: 'warning',
      reschedule:   'info',
      online_tdc_account_setup: 'warning',
      enrollment:   'info',
    };

    const notifications = result.rows.map(row => ({
      id:         row.id,
      notifType:  row.notif_type,
      type:       typeMap[row.notif_type] || 'info',
      title:      row.title,
      message:    row.message,
      time:       row.time,
      branch:     row.branch_name,
      student:    row.student_name,
      course:     row.course_name,
      amount:     row.total_amount,
      paymentMethod: row.payment_method,
    }));

    res.json({ success: true, notifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Server error while fetching notifications' });
  }
};

// â”€â”€ Email content config endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const getEmailContent = async (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(EMAIL_CONTENT_PATH, 'utf8'));
    res.json({ success: true, content: data });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load email content' });
  }
};

const updateEmailContent = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || typeof content !== 'object') {
      return res.status(400).json({ error: 'Invalid content payload' });
    }
    fs.writeFileSync(EMAIL_CONTENT_PATH, JSON.stringify(content, null, 2), 'utf8');
    reloadEmailContent();
    res.json({ success: true, message: 'Email content updated successfully' });
  } catch (e) {
    console.error('updateEmailContent error:', e);
    res.status(500).json({ error: 'Failed to save email content' });
  }
};

const sendTestEmailRoute = async (req, res) => {
  try {
    const { email, html, subject } = req.body;
    if (!email || !html) return res.status(400).json({error: 'Missing email or html'});
    const emailService = require('../utils/emailService');
    if (emailService.sendTestEmail) {
      await emailService.sendTestEmail(email, html, subject);
      res.json({success: true});
    } else {
      res.status(500).json({error: 'Test email function not found'});
    }
  } catch (e) {
    console.error('Test email route error:', e);
    res.status(500).json({error: 'Failed to send test email'});
  }
};

const sendAllEmailDesignsRoute = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || !String(email).includes('@')) {
      return res.status(400).json({ error: 'A valid email is required' });
    }

    const firstName = 'Jeff';
    const lastName = 'Gabasa';
    const sampleDate = new Date().toISOString().split('T')[0];

    const enrollmentDetails = {
      courseName: 'PDC B1/B2 (Manual)',
      courseCategory: 'PDC',
      courseType: 'manual',
      branchName: 'Main Branch',
      branchAddress: '123 Master Drive St., City',
      scheduleDate: sampleDate,
      scheduleSession: 'Morning Session',
      scheduleTime: '8:00 AM - 12:00 PM',
      scheduleDate2: sampleDate,
      scheduleSession2: 'Afternoon Session',
      scheduleTime2: '1:00 PM - 5:00 PM',
      paymentMethod: 'GCash',
      amountPaid: 1500,
      paymentStatus: 'Downpayment',
    };

    await sendVerificationEmail(email, '123456', firstName, 'Email Verification');
    await sendVerificationEmail(email, '654321', firstName, 'Password Reset');
    await sendPasswordEmail(email, 'Temp#1234', firstName, 'admin');
    await sendWalkInEnrollmentEmail(email, firstName, lastName, 'Temp#1234', '112233', enrollmentDetails);
    await sendEnrollmentEmail(email, firstName, lastName, enrollmentDetails, true, true);
    await sendNoShowEmail(email, firstName, lastName, {
      courseName: 'PDC B1/B2 (Manual)',
      scheduleDate: sampleDate,
      scheduleSession: 'Morning Session',
    });
    await sendNewsPromoEmail(
      email,
      firstName,
      'Summer Enrollment Promo',
      'Enroll this week and enjoy discounted rates on selected courses. Limited slots only.',
      'PROMO',
      'LIMITED OFFER'
    );
    await sendPaymentReceiptEmail(email, firstName, lastName, {
      bookingId: 123,
      transactionId: 'TXN-TEST-DOWN-001',
      courseName: 'PDC B1/B2 (Manual)',
      amountPaid: 1500,
      coursePrice: 3500,
      paymentMethod: 'GCash',
      paymentDate: new Date().toISOString(),
      isFullPayment: false,
      balanceDue: 2000,
    });
    await sendPaymentReceiptEmail(email, firstName, lastName, {
      bookingId: 124,
      transactionId: 'TXN-TEST-FULL-001',
      courseName: 'TDC',
      amountPaid: 1000,
      coursePrice: 1000,
      paymentMethod: 'Cash',
      paymentDate: new Date().toISOString(),
      isFullPayment: true,
      balanceDue: 0,
    });
    return res.json({ success: true, message: 'All template emails sent successfully' });
  } catch (e) {
    console.error('sendAllEmailDesignsRoute error:', e);
    return res.status(500).json({ error: 'Failed to send one or more template emails' });
  }
};

const getTodayStudents = async (req, res) => {
  try {
    const dateParam = req.query.date;
    const today = dateParam || new Date().toISOString().split('T')[0];
    const requestedBranchId = req.query.branch_id ? parseInt(req.query.branch_id, 10) : null;
    const scope = await getUserBranchScope(req.user);
    if (isScopedWithoutBranch(scope)) {
      return res.json({ success: true, date: today, data: [], total: 0 });
    }
    const branchId = scope.canViewAll ? requestedBranchId : scope.branchId;
    const result = await pool.query(`
      SELECT
        ss.id as slot_id,
        se.id as enrollment_id,
        se.reschedule_fee_paid,
        ss.time_range,
        ss.course_type,
        ss.type,
        ss.transmission,
        ss.session,
        ss.date as slot_date,
        ss.end_date as slot_end_date,
        br.name as branch_name,
        ss.branch_id,
        u.id as student_id,
        u.first_name || ' ' || COALESCE(u.middle_name || ' ', '') || u.last_name as student_name,
        u.email,
        u.contact_numbers,
        se.enrollment_status
      FROM schedule_slots ss
      JOIN schedule_enrollments se ON ss.id = se.slot_id
      JOIN users u ON se.student_id = u.id
      LEFT JOIN branches br ON ss.branch_id = br.id
      WHERE $1::date BETWEEN ss.date AND ss.end_date
        AND se.enrollment_status IN ('enrolled', 'completed')
        AND ($2::int IS NULL OR ss.branch_id = $2::int)
      ORDER BY ss.course_type, ss.time_range, u.last_name
    `, [today, branchId]);

    const grouped = {};
    result.rows.forEach(row => {
      const typeLower = (row.type || '').toLowerCase();
      let label;
      if (typeLower === 'tdc') {
        label = `TDC ${row.course_type || ''}`.trim();
      } else if (typeLower === 'pdc') {
        label = `PDC${row.transmission ? ' ' + row.transmission : ''}`.trim();
      } else {
        label = row.course_type || row.type || 'General';
      }
      if (!grouped[label]) grouped[label] = { course_type: label, type: row.type, students: [] };
      grouped[label].students.push({
        student_id: row.student_id,
        enrollment_id: row.enrollment_id,
        name: row.student_name,
        email: row.email,
        contact: row.contact_numbers,
        status: row.enrollment_status,
        reschedule_fee_paid: row.reschedule_fee_paid,
        time_range: row.time_range,
        session: row.session,
        slot_date: row.slot_date,
        slot_end_date: row.slot_end_date,
        branch_name: row.branch_name,
        branch_id: row.branch_id,
        transmission: row.transmission,
        slot_id: row.slot_id,
      });
    });

    // Sort: TDC first, then PDC, then others; alphabetically within each type
    const sortedData = Object.values(grouped).sort((a, b) => {
      const order = { tdc: 0, pdc: 1 };
      const ao = order[a.type] ?? 2;
      const bo = order[b.type] ?? 2;
      return ao !== bo ? ao - bo : a.course_type.localeCompare(b.course_type);
    });

    res.json({
      success: true,
      date: today,
      data: sortedData,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Get today students error:', error);
    res.status(500).json({ error: 'Server error while fetching today students' });
  }
};

const getTdcOnlineStudents = async (req, res) => {
  try {
    const requestedBranchId = req.query.branch_id ? parseInt(req.query.branch_id, 10) : null;
    const scope = await getUserBranchScope(req.user);
    if (isScopedWithoutBranch(scope)) {
      return res.json({ success: true, data: [], total: 0 });
    }

    const branchId = scope.canViewAll ? requestedBranchId : scope.branchId;

    const result = await pool.query(
      `SELECT
        b.id AS booking_id,
        b.status AS booking_status,
        b.booking_date,
        b.created_at,
        b.total_amount,
        COALESCE(b.payment_type, 'N/A') AS payment_type,
        COALESCE(b.payment_method, 'N/A') AS payment_method,
        COALESCE(b.enrollment_type, 'online') AS enrollment_type,
        b.course_type,
        c.name AS course_name,
        c.category AS course_category,
        u.id AS student_id,
        TRIM(u.first_name || ' ' || COALESCE(u.middle_name || ' ', '') || u.last_name) AS student_name,
        u.email,
        u.contact_numbers,
        b.branch_id,
        br.name AS branch_name
      FROM bookings b
      JOIN users u ON u.id = b.user_id
      LEFT JOIN courses c ON c.id = b.course_id
      LEFT JOIN branches br ON br.id = b.branch_id
      WHERE (
          (
            LOWER(COALESCE(c.category, '')) = 'tdc'
            AND LOWER(COALESCE(b.course_type, '')) LIKE '%online%'
          )
          OR (
            b.notes IS NOT NULL
            AND b.notes ~ '^\\{'
            AND (
              (b.notes::jsonb->>'isOnlineTdcNoSchedule') = 'true'
              OR EXISTS (
                SELECT 1
                FROM jsonb_array_elements(COALESCE(b.notes::jsonb->'courseList', '[]'::jsonb)) AS cl(item)
                WHERE LOWER(COALESCE(cl.item->>'category', '')) = 'tdc'
                  AND LOWER(COALESCE(cl.item->>'type', '')) LIKE '%online%'
              )
            )
          )
        )
        AND LOWER(COALESCE(b.status, '')) IN ('pending', 'confirmed', 'paid', 'partial_payment')
        AND ($1::int IS NULL OR b.branch_id = $1::int)
      ORDER BY b.created_at DESC`,
      [branchId]
    );

    return res.json({
      success: true,
      data: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Get TDC online students error:', error);
    return res.status(500).json({ error: 'Server error while fetching TDC online students' });
  }
};

const getPdcSchedulingQueue = async (req, res) => {
  try {
    const isSpecificPdcName = (name = '') => {
      const raw = String(name || '').trim();
      if (!raw) return false;
      if (/^(pdc\s*course(\s*\d+)?|pdc|4\s*pdc)$/i.test(raw)) return false;
      return true;
    };

    const applyTransmissionToName = (name = '', courseType = '') => {
      const cleanName = String(name || '').trim();
      const cleanType = String(courseType || '').trim();
      if (!cleanName) return cleanName;
      if (!cleanType) return cleanName;
      const lowerName = cleanName.toLowerCase();
      const lowerType = cleanType.toLowerCase();
      if (lowerName.includes(lowerType)) return cleanName;
      return `${cleanName} - ${cleanType}`;
    };

    const requestedBranchId = req.query.branch_id ? parseInt(req.query.branch_id, 10) : null;
    const scope = await getUserBranchScope(req.user);
    if (isScopedWithoutBranch(scope)) {
      return res.json({ success: true, data: [], total: 0 });
    }

    const branchId = scope.canViewAll ? requestedBranchId : scope.branchId;

    const result = await pool.query(
      `SELECT
        b.id,
        b.notes,
        b.course_type,
        b.updated_at,
        b.created_at,
        c.name AS course_name,
        u.email AS student_email,
        u.contact_numbers AS student_contact,
        TRIM(u.first_name || ' ' || COALESCE(u.middle_name || ' ', '') || u.last_name) AS student_name,
        b.branch_id,
        br.name AS branch_name
      FROM bookings b
      JOIN users u ON u.id = b.user_id
      LEFT JOIN courses c ON c.id = b.course_id
      LEFT JOIN branches br ON br.id = b.branch_id
      WHERE LOWER(COALESCE(b.status, '')) = 'completed'
        AND b.notes IS NOT NULL
        AND b.notes ~ '^\\{'
        AND (b.notes::jsonb->>'pdcScheduleLockedUntilCompletion') = 'true'
        AND ($1::int IS NULL OR b.branch_id = $1::int)
      ORDER BY b.updated_at DESC, b.created_at DESC`,
      [branchId]
    );

    const rows = Array.isArray(result?.rows) ? result.rows : [];

    const allPdcCourseIds = [...new Set(
      rows
        .flatMap((row) => {
          let notesJson = {};
          try {
            notesJson = row?.notes && String(row.notes).startsWith('{') ? JSON.parse(row.notes) : {};
          } catch {
            notesJson = {};
          }
          return Array.isArray(notesJson?.pdcCourseIds)
            ? notesJson.pdcCourseIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
            : [];
        })
    )];

    const pdcCourseNameById = new Map();
    if (allPdcCourseIds.length > 0) {
      const pdcRes = await pool.query('SELECT id, name, course_type FROM courses WHERE id = ANY($1::int[])', [allPdcCourseIds]);
      pdcRes.rows.forEach((course) => {
        pdcCourseNameById.set(Number(course.id), {
          name: course.name,
          courseType: course.course_type || '',
        });
      });
    }

    const isTwoDayVariant = (courseName = '', courseType = '') => {
      const src = `${courseName} ${courseType}`.toUpperCase();
      if (src.includes('MOTOR') || src.includes('MOTORCYCLE')) return false;
      if (src.includes('AUTOMATIC') || src.includes('MANUAL')) return true;
      if (src.includes('CAR') || src.includes('B1') || src.includes('B2') || src.includes('VAN') || src.includes('L300')) return true;
      if (src.includes('TRICYCLE') || src.includes('V1') || src.includes('A1')) return true;
      return false;
    };

    const toInputDate = (value) => {
      if (!value) return '';
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return '';
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const addDays = (dateStr, days = 0) => {
      if (!dateStr) return '';
      const d = new Date(`${dateStr}T00:00:00`);
      if (Number.isNaN(d.getTime())) return '';
      d.setDate(d.getDate() + Number(days || 0));
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const data = rows.map((row) => {
      let notesJson = {};
      try {
        notesJson = row?.notes && String(row.notes).startsWith('{') ? JSON.parse(row.notes) : {};
      } catch {
        notesJson = {};
      }

      const pdcSelections = Object.entries(notesJson?.pdcSelections || {}).map(([key, value], idx) => ({
        key: String(key || `pdc_${idx + 1}`),
        courseId: value?.courseId || null,
        courseName: value?.courseName || '',
        courseType: value?.courseType || '',
      }));

      const fromCourseList = (Array.isArray(notesJson?.courseList) ? notesJson.courseList : [])
        .filter((item) => String(item?.category || '').toUpperCase() === 'PDC')
        .map((item, idx) => ({
          key: String(item?.id || `pdc_list_${idx + 1}`),
          courseId: item?.id || null,
          courseName: item?.name || '',
          courseType: item?.type || '',
        }));

      const fromPdcIds = (Array.isArray(notesJson?.pdcCourseIds) ? notesJson.pdcCourseIds : [])
        .map((id, idx) => {
          const numId = Number(id);
          const courseMeta = pdcCourseNameById.get(numId);
          return {
            key: `pdc_id_${numId || idx + 1}`,
            courseId: Number.isFinite(numId) ? numId : null,
            courseName: courseMeta?.name || '',
            courseType: courseMeta?.courseType || '',
          };
        });

      const fromCombinedNames = String(notesJson?.combinedCourseNames || row?.course_name || '')
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
          key: `pdc_combined_${idx + 1}`,
          courseId: null,
          courseName: name,
          courseType: '',
        }));

      // Strict waterfall: use the first source that produces results.
      // This prevents the same course appearing twice with different name formats
      // (e.g. "PDC-(A1-TRICYCLE)-V1-Tricycle" from pdcSelections vs
      //       "PDC-(A1-TRICYCLE)" from courseList).
      let bestSource;
      if (pdcSelections.filter((item) => isSpecificPdcName(item?.courseName)).length > 0) {
        bestSource = pdcSelections;
      } else if (fromPdcIds.filter((item) => isSpecificPdcName(item?.courseName)).length > 0) {
        bestSource = fromPdcIds;
      } else if (fromCourseList.filter((item) => isSpecificPdcName(item?.courseName)).length > 0) {
        // When falling back to courseList, restrict to pdcCourseIds if available
        const pdcIdSet = new Set(
          (Array.isArray(notesJson?.pdcCourseIds) ? notesJson.pdcCourseIds : [])
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id) && id > 0)
        );
        bestSource = pdcIdSet.size > 0
          ? fromCourseList.filter((item) => pdcIdSet.has(Number(item?.courseId)))
          : fromCourseList;
        if (bestSource.length === 0) bestSource = fromCourseList;
      } else {
        bestSource = fromCombinedNames;
      }

      const seen = new Set();
      const pdcCourses = bestSource
        .filter((item) => isSpecificPdcName(item?.courseName || ''))
        .filter((item) => {
          // Deduplicate by normalized base name (strip transmission suffix) + courseId
          const baseName = String(item?.courseName || '').toLowerCase().trim()
            .replace(/\s+/g, ' ')
            .replace(/\s*-\s*(automatic|manual|mt|at|v1-tricycle|b1-van\/b2-l300)\s*$/i, '');
          const key = `${String(item?.courseId || '')}::${baseName}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((item, idx) => ({
          key: item.key || `pdc_${idx + 1}`,
          courseId: item.courseId || null,
          courseName: applyTransmissionToName(item.courseName, item.courseType),
          courseType: item.courseType || '',
          requiresDay2: isTwoDayVariant(item.courseName, item.courseType),
        }));

      const completedDate = toInputDate(row?.updated_at || row?.created_at || null);

      return {
        id: row.id,
        student_name: row.student_name,
        student_email: row.student_email,
        student_contact: row.student_contact,
        branch_name: row.branch_name,
        branch_id: row.branch_id,
        course_name: row.course_name,
        course_type: row.course_type,
        completedDate,
        minScheduleDate: addDays(completedDate, 2),
        notesJson,
        locked: true,
        hasOnlineTdc: true,
        hasPdc: pdcCourses.length > 0,
        pdcCourses: pdcCourses.length > 0
          ? pdcCourses
          : [{ key: 'pdc_1', courseId: null, courseName: 'PDC Course', courseType: '', requiresDay2: false }],
      };
    });

    return res.json({
      success: true,
      data,
      total: data.length,
    });
  } catch (error) {
    console.error('Get PDC scheduling queue error:', error);
    return res.status(500).json({ error: 'Server error while fetching PDC scheduling queue' });
  }
};

module.exports = {
  getDashboardStats,
  getAllBookings,
  getAllUsers,
  updateBookingStatus,
  deleteBooking,
  getRevenueData,
  getEnrollmentData,
  getBestSellingCourses,
  createUser,
  updateUser,
  toggleUserStatus,
  resetUserPassword,
  walkInEnrollment,
  getAllTransactions,
  getUnpaidBookings,
  getFunnelData,
  getCourseDistribution,
  getBranchPerformance,
  getNotifications,
  markBookingAsPaid,
  assignPdcSchedule,
  sendReceiptEmail,
  getEmailContent,
  updateEmailContent,
  sendTestEmailRoute,
};

// â”€â”€â”€ Student summary detail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â”€â”€ Add-ons config endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const getAddonsConfig = async (req, res) => {
  try {
    if (!fs.existsSync(ADDONS_CONFIG_PATH)) {
      return res.json({ success: true, config: { reviewer: 30, vehicleTips: 20, convenienceFee: 25, promoBundleDiscountPercent: 3 } });
    }
    const data = JSON.parse(fs.readFileSync(ADDONS_CONFIG_PATH, 'utf8'));
    res.json({ success: true, config: data });
  } catch (e) {
    console.error('Error fetching addons config:', e);
    res.status(500).json({ error: 'Failed to load add-ons config' });
  }
};

const updateAddonsConfig = async (req, res) => {
  try {
    const { config } = req.body;
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'Invalid config payload' });
    }
    fs.writeFileSync(ADDONS_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    res.json({ success: true, message: 'Add-ons config updated successfully', config });
  } catch (e) {
    console.error('Error updating addons config:', e);
    res.status(500).json({ error: 'Failed to update add-ons config' });
  }
};

const getStudentDetail = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (isNaN(studentId)) return res.status(400).json({ error: 'Invalid student ID' });

    // User personal info
    const userRes = await pool.query(`
      SELECT u.id, u.first_name, u.middle_name, u.last_name, u.email,
        u.contact_numbers, u.address, u.gender, u.age, u.birthday,
        u.birth_place, u.nationality, u.marital_status, u.zip_code,
        u.emergency_contact_person, u.emergency_contact_number,
        b.name as branch_name
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
      WHERE u.id = $1
    `, [studentId]);

    if (userRes.rows.length === 0) return res.status(404).json({ error: 'Student not found' });

    // Booking + payment info (latest 10)
    const bookingsRes = await pool.query(`
      SELECT bk.id, bk.booking_date, bk.status, bk.total_amount,
        COALESCE(bk.payment_type, 'N/A') as payment_type,
        COALESCE(bk.payment_method, 'N/A') as payment_method,
        COALESCE(bk.enrollment_type, 'online') as enrollment_type,
        bk.course_type, bk.created_at,
        c.name as course_name,
        c.price as course_price,
        br.name as branch_name
      FROM bookings bk
      LEFT JOIN courses c ON bk.course_id = c.id
      LEFT JOIN branches br ON bk.branch_id = br.id
      WHERE bk.user_id = $1
      ORDER BY bk.created_at DESC
      LIMIT 10
    `, [studentId]);

    res.json({
      success: true,
      student: userRes.rows[0],
      bookings: bookingsRes.rows,
    });
  } catch (error) {
    console.error('Get student detail error:', error);
    res.status(500).json({ error: 'Server error while fetching student detail' });
  }
};

// FULL DATABASE BACKUP (.sql)
const getDatabaseBackup = async (req, res) => {
  try {
    const { exec } = require('child_process');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp}.sql`;
    const filepath = path.join(__dirname, '..', 'tmp', filename);

    // Ensure tmp exists
    if (!fs.existsSync(path.join(__dirname, '..', 'tmp'))) {
      fs.mkdirSync(path.join(__dirname, '..', 'tmp'));
    }

    const { execSync } = require('child_process');
    // On Windows, use quotes around path. Handle both locally and cloud (DATABASE_URL preferred)
    const dumpPath = process.platform === 'win32' 
      ? '"C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe"' 
      : 'pg_dump';
    
    let cmd = '';
    const dbUrl = process.env.DATABASE_URL;

    if (dbUrl) {
      cmd = `${dumpPath} -d "${dbUrl}" --inserts -F p -f "${filepath}"`;
    } else {
      // Use individual params
      const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env;
      if (!DB_NAME) throw new Error('Database Configuration not found in environment');
      
      // Set PGPASSWORD so pg_dump doesn't prompt
      process.env.PGPASSWORD = DB_PASSWORD;
      cmd = `${dumpPath} -h ${DB_HOST || 'localhost'} -p ${DB_PORT || 5432} -U ${DB_USER || 'postgres'} --inserts -F p -f "${filepath}" ${DB_NAME}`;
    }
    
    console.log(`ðŸš€ Starting DB backup to ${filename}...`);
    exec(cmd, (error, stdout, stderr) => {
      // Clear password from env after use
      delete process.env.PGPASSWORD;
      
      if (error) {
        console.error('Backup error:', error);
        return res.status(500).json({ error: 'Failed to generate backup' });
      }
      
      res.download(filepath, filename, (err) => {
        if (err) console.error('Download error:', err);
        // Delete after sending
        setTimeout(() => fs.unlinkSync(filepath), 10000);
      });
    });
  } catch (error) {
    console.error('DB backup controller error:', error);
    res.status(500).json({ error: error.message || 'Backup failed' });
  }
};

// EXPORT STUDENTS AS CSV
const exportStudentsCSV = async (req, res) => {
  try {
    const { startDate, endDate, branchId } = req.query;
    let queryParams = [];
    let paramIndex = 1;

    let whereClauses = ["u.role IN ('student', 'walkin_student')"];
    
    if (startDate) {
      whereClauses.push(`u.created_at >= $${paramIndex++}`);
      queryParams.push(startDate + ' 00:00:00');
    }
    if (endDate) {
      whereClauses.push(`u.created_at <= $${paramIndex++}`);
      queryParams.push(endDate + ' 23:59:59');
    }
    if (branchId) {
      whereClauses.push(`u.branch_id = $${paramIndex++}`);
      queryParams.push(parseInt(branchId));
    }

    const whereSQL = whereClauses.join(' AND ');

    const query = `
      SELECT 
        u.first_name as "First Name", 
        u.middle_name as "Middle Name", 
        u.last_name as "Last Name", 
        u.email as "Email Address", 
        u.gender as "Gender", 
        u.age as "Age", 
        TO_CHAR(u.birthday, 'YYYY-MM-DD') as "Birthday",
        u.address as "Home Address", 
        u.contact_numbers as "Contact Number",
        TO_CHAR(u.created_at, 'Month DD, YYYY') as "Registration Date",
        u.status as "Account Status", 
        b.name as "Primary Branch"
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
      WHERE ${whereSQL}
      ORDER BY u.created_at DESC
    `;
    const result = await pool.query(query, queryParams);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
};

// EXPORT TRANSACTIONS AS CSV
const exportTransactionsCSV = async (req, res) => {
  try {
    const { startDate, endDate, branchId } = req.query;
    let queryParams = [];
    let paramIndex = 1;

    let whereClauses = [];
    
    if (startDate) {
      whereClauses.push(`b.created_at >= $${paramIndex++}`);
      queryParams.push(startDate + ' 00:00:00');
    }
    if (endDate) {
      whereClauses.push(`b.created_at <= $${paramIndex++}`);
      queryParams.push(endDate + ' 23:59:59');
    }
    if (branchId) {
      whereClauses.push(`b.branch_id = $${paramIndex++}`);
      queryParams.push(parseInt(branchId));
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
      SELECT 
        b.id as "Booking ID", 
        TO_CHAR(b.created_at, 'Month DD, YYYY') as "Transaction Date",
        UPPER(u.first_name || ' ' || u.last_name) as "Student Name",
        u.email as "Student Email",
        c.name as "Course Name", 
        b.course_type as "Category",
        b.total_amount as "Paid Amount",
        UPPER(b.status) as "Payment Status",
        b.payment_type as "Pay Type", 
        b.payment_method as "Method",
        br.name as "Branch",
        b.enrollment_type as "Enrollment"
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN courses c ON b.course_id = c.id
      LEFT JOIN branches br ON b.branch_id = br.id
      ${whereSQL}
      ORDER BY b.created_at DESC
    `;
    const result = await pool.query(query, queryParams);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
};

// CLEAR DATABASE (STUDENTS & BOOKINGS ONLY)
const clearDatabase = async (req, res) => {
  try {
    // Start a transaction for safety
    await pool.query('BEGIN');
    
    console.log('ðŸš® Clearing database (Students & Bookings)...');
    
    // Delete in order due to foreign key constraints
    await pool.query('DELETE FROM schedule_enrollments');
    await pool.query('DELETE FROM bookings');
    await pool.query("DELETE FROM users WHERE role IN ('student', 'walkin_student')");
    
    await pool.query('COMMIT');
    res.json({ success: true, message: 'Database cleared: All student and booking data removed successfully.' });
  } catch (error) {
    if (pool) await pool.query('ROLLBACK');
    console.error('Clear DB error:', error);
    res.status(500).json({ error: 'Failed to clear database' });
  }
};

// IMPORT SQL BACKUP
const importSQLBackup = async (req, res) => {
  try {
    const { file } = req;
    if (!file) return res.status(400).json({ error: 'No backup file provided' });

    const { exec } = require('child_process');
    const psqlPath = '"C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe"';
    const filepath = file.path;
    
    let cmd = '';
    const dbUrl = process.env.DATABASE_URL;

    if (dbUrl) {
      cmd = `${psqlPath} -d "${dbUrl}" -f "${filepath}"`;
    } else {
      const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env;
      process.env.PGPASSWORD = DB_PASSWORD;
      cmd = `${psqlPath} -h ${DB_HOST || 'localhost'} -p ${DB_PORT || 5432} -U ${DB_USER || 'postgres'} -d ${DB_NAME} -f "${filepath}"`;
    }

    console.log(`ðŸ“¥ Importing SQL backup from ${file.originalname}...`);
    exec(cmd, (error, stdout, stderr) => {
      delete process.env.PGPASSWORD;
      // Also delete the temp uploaded file
      try { fs.unlinkSync(filepath); } catch(e) {}
      
      if (error) {
        console.error('Import error:', error);
        return res.status(500).json({ error: 'Failed to import backup' });
      }
      res.json({ success: true, message: 'Database restored successfully!' });
    });
  } catch (error) {
    console.error('Import controller error:', error);
    res.status(500).json({ error: 'Import process failed' });
  }
};

const importStudentsCSV = async (req, res) => {
  try {
    const { file } = req;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const csv = require('csv-parser');
    const results = [];
    const filepath = file.path;

    fs.createReadStream(filepath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        let imported = 0;
        let skipped = 0;

        for (const row of results) {
          try {
            // Basic mapping
            const email = row.email || row.student_email;
            if (!email) { skipped++; continue; }

            // Find branch if provided
            let branchId = null;
            if (row.branch_name) {
              const bRes = await pool.query('SELECT id FROM branches WHERE name ILIKE $1', [row.branch_name]);
              if (bRes.rows.length > 0) branchId = bRes.rows[0].id;
            }

            const query = `
              INSERT INTO users (
                first_name, last_name, email, contact_numbers, gender, address, branch_id, role, password, is_verified
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              ON CONFLICT (email) DO NOTHING
            `;
            
            const values = [
              row.first_name || row.fullname?.split(' ')[0] || 'Student',
              row.last_name || row.fullname?.split(' ').slice(1).join(' ') || 'User',
              email,
              row.mobile || row.phone || row.contact_numbers || '',
              row.gender || 'Not specified',
              row.address || '',
              branchId,
              row.role || 'student',
              '$2a$10$7d...hashPlaceholder...', // Default password hash should be handled
              true
            ];

            const insertRes = await pool.query(query, values);
            if (insertRes.rowCount > 0) imported++;
            else skipped++;
          } catch (err) {
            console.error('Row import error:', err);
            skipped++;
          }
        }

        try { fs.unlinkSync(filepath); } catch(e) {}
        res.json({ success: true, message: `Import complete: ${imported} imported, ${skipped} skipped (duplicates/errors).` });
      });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Failed to process CSV' });
  }
};

const importTransactionsCSV = async (req, res) => {
  try {
    const { file } = req;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const csv = require('csv-parser');
    const results = [];
    const filepath = file.path;

    fs.createReadStream(filepath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        let imported = 0;
        let skipped = 0;

        for (const row of results) {
          try {
            // Find student
            const email = row.student_email || row.email;
            const courseName = row.course_name;
            
            if (!email || !courseName) { skipped++; continue; }

            const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
            const courseRes = await pool.query('SELECT id FROM courses WHERE name ILIKE $1', [courseName]);
            
            if (userRes.rows.length === 0 || courseRes.rows.length === 0) {
              skipped++;
              continue;
            }

            const userId = userRes.rows[0].id;
            const courseId = courseRes.rows[0].id;

            // Optional: Find branch
            let branchId = null;
            if (row.branch_name) {
              const bRes = await pool.query('SELECT id FROM branches WHERE name ILIKE $1', [row.branch_name]);
              if (bRes.rows.length > 0) branchId = bRes.rows[0].id;
            }

            const query = `
              INSERT INTO bookings (
                user_id, course_id, branch_id, total_amount, status, payment_type, payment_method, enrollment_type, course_type
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `;
            
            const values = [
              userId, courseId, branchId,
              row.amount || 0,
              row.payment_status || 'paid',
              row.payment_type || 'full',
              row.payment_method || 'walk-in',
              row.enrollment_type || 'walk-in',
              row.course_type || 'Personal'
            ];

            await pool.query(query, values);
            imported++;
          } catch (err) {
            console.error('Transaction row error:', err);
            skipped++;
          }
        }

        try { fs.unlinkSync(filepath); } catch(e) {}
        res.json({ success: true, message: `Import complete: ${imported} transactions imported, ${skipped} skipped.` });
      });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Failed to process CSV' });
  }
};

module.exports = {
  getDashboardStats,
  getAllBookings,
  getAllUsers,
  updateBookingStatus,
  deleteBooking,
  getRevenueData,
  getEnrollmentData,
  getBestSellingCourses,
  createUser,
  updateUser,
  toggleUserStatus,
  resetUserPassword,
  walkInEnrollment,
  searchStudents,
  getAllTransactions,
  getUnpaidBookings,
  getFunnelData,
  getCourseDistribution,
  getBranchPerformance,
  getNotifications,
  markBookingAsPaid,
  assignPdcSchedule,
  sendReceiptEmail,
  getEmailContent,
  updateEmailContent,
  sendTestEmailRoute,
  sendAllEmailDesignsRoute,
  getTodayStudents,
  getTdcOnlineStudents,
  getPdcSchedulingQueue,
  getStudentDetail,
  getAddonsConfig,
  updateAddonsConfig,
  getDatabaseBackup,
  exportStudentsCSV,
  exportTransactionsCSV,
  clearDatabase,
  importSQLBackup,
  importStudentsCSV,
  importTransactionsCSV,
};


