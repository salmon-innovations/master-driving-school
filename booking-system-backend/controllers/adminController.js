const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const {
  generateRandomPassword,
  sendPasswordEmail,
  generateVerificationCode,
  sendVerificationEmail,
  sendWalkInEnrollmentEmail,
  sendGuestEnrollmentEmail,
  sendNoShowEmail,
  sendNewsPromoEmail,
  sendPaymentReceiptEmail,
  reloadEmailContent,
  sendTestEmail,
} = require('../utils/emailService');

const EMAIL_CONTENT_PATH = path.join(__dirname, '../config/emailContent.json');
const ADDONS_CONFIG_PATH = path.join(__dirname, '../config/addonsConfig.json');

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

const isSameBranch = (left, right) => String(left || '') === String(right || '');

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

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    const scope = await getUserBranchScope(req.user);
    if (isScopedWithoutBranch(scope)) {
      return res.json({
        success: true,
        stats: {
          totalStudents: 0,
          monthlyRevenue: 0,
          pendingBookings: 0,
          todayEnrollments: 0,
          growthRate: '0.0',
          retention: 0,
          traffic: 0,
          addedStudents: 0,
          walkIns: 0,
        },
      });
    }
    const bookingBranchFilter = scope.branchId && !scope.canViewAll ? ` AND branch_id = ${parseInt(scope.branchId, 10)}` : '';
    const slotBranchFilter = scope.branchId && !scope.canViewAll ? ` AND ss.branch_id = ${parseInt(scope.branchId, 10)}` : '';

    // Get total enrolled students (from bookings + schedule_enrollments)
    const studentsResult = await pool.query(
      `SELECT COUNT(DISTINCT student_id) as total FROM (
        SELECT user_id as student_id FROM bookings WHERE status IN ('confirmed', 'completed', 'paid', 'collectable')${bookingBranchFilter}
        UNION
        SELECT se.student_id
        FROM schedule_enrollments se
        JOIN schedule_slots ss ON se.slot_id = ss.id
        WHERE se.enrollment_status IN ('enrolled', 'completed')${slotBranchFilter}
      ) combined`
    );

    // Get total revenue this month
    const revenueResult = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM bookings 
       WHERE status IN ('confirmed', 'completed', 'paid', 'collectable')
       ${bookingBranchFilter}
       AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
       AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`
    );

    // Get total revenue LAST month for growth rate
    const lastMonthRevenueResult = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM bookings 
       WHERE status IN ('confirmed', 'completed', 'paid', 'collectable')
       ${bookingBranchFilter}
       AND created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
       AND created_at < DATE_TRUNC('month', CURRENT_DATE)`
    );

    // Get pending bookings count
    const pendingResult = await pool.query(
      `SELECT COUNT(*) as total FROM bookings WHERE status = 'pending'${bookingBranchFilter}`
    );

    // Get today's enrollments as unique students (avoid double-counting multi-slot bookings)
    const todayEnrollmentsResult = await pool.query(
      `SELECT COUNT(DISTINCT student_id) as total FROM (
        SELECT b.user_id AS student_id
        FROM bookings b
        WHERE b.created_at >= CURRENT_DATE AND b.created_at < CURRENT_DATE + INTERVAL '1 day'${bookingBranchFilter ? ` AND b.branch_id = ${parseInt(scope.branchId, 10)}` : ''}
        UNION
        SELECT se.student_id AS student_id
        FROM schedule_enrollments se
        JOIN schedule_slots ss ON se.slot_id = ss.id
        WHERE se.created_at >= CURRENT_DATE AND se.created_at < CURRENT_DATE + INTERVAL '1 day'${slotBranchFilter}
      ) combined`
    );

    // Get this month's added students (for Analytics Page)
    const addedStudentsResult = await pool.query(
      `SELECT COUNT(*) as total FROM bookings 
       WHERE 1=1${bookingBranchFilter}
       AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
       AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`
    );

    // Get walk-ins count (total or monthly? Analytics likely wants total or relevant timeframe. Let's do monthly)
    const walkInsResult = await pool.query(
      `SELECT COUNT(*) as total FROM bookings 
       WHERE enrollment_type = 'walk-in'${bookingBranchFilter}
       AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
       AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`
    );

    // Retention: % of students with repeat bookings among active enrolled students this year
    const retentionResult = await pool.query(
      `SELECT COALESCE(ROUND(
          100.0 * COUNT(*) FILTER (WHERE booking_count > 1) / NULLIF(COUNT(*), 0),
          1
        ), 0) as retention
       FROM (
         SELECT user_id, COUNT(*) as booking_count
         FROM bookings
         WHERE status IN ('confirmed', 'completed', 'paid', 'collectable')
           ${bookingBranchFilter}
           AND created_at >= DATE_TRUNC('year', CURRENT_DATE)
         GROUP BY user_id
       ) repeat_stats`
    );

    // Traffic: monthly page-activity proxy (new users + booking actions this month)
    const trafficResult = await pool.query(
      `SELECT (
          (SELECT COUNT(*) FROM users
           WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
             ${scope.branchId && !scope.canViewAll ? ` AND COALESCE(branch_id, (SELECT branch_id FROM bookings WHERE user_id = users.id ORDER BY created_at DESC LIMIT 1)) = ${parseInt(scope.branchId, 10)}` : ''})
          +
          (SELECT COUNT(*) FROM bookings
           WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
             ${bookingBranchFilter})
        ) as traffic`
    );

    // Calculate Growth Rate
    const currentRevenue = parseFloat(revenueResult.rows[0].total);
    const lastMonthRevenue = parseFloat(lastMonthRevenueResult.rows[0].total);
    let growthRate = 0;
    if (lastMonthRevenue > 0) {
      growthRate = ((currentRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
    } else if (currentRevenue > 0) {
      growthRate = 100;
    }

    res.json({
      success: true,
      stats: {
        totalStudents: parseInt(studentsResult.rows[0].total),
        monthlyRevenue: currentRevenue,
        pendingBookings: parseInt(pendingResult.rows[0].total),
        todayEnrollments: parseInt(todayEnrollmentsResult.rows[0].total),

        // Extended stats for analytics
        growthRate: growthRate.toFixed(1),
        retention: Number(retentionResult.rows[0].retention || 0),
        traffic: parseInt(trafficResult.rows[0].traffic || 0, 10),
        addedStudents: parseInt(addedStudentsResult.rows[0].total),
        walkIns: parseInt(walkInsResult.rows[0].total)
      },
    });
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
    const validStatuses = ['collectable', 'paid', 'cancelled', 'completed'];
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

    const result = await pool.query(`
      SELECT 
        TO_CHAR(created_at, 'Mon') as name,
        COALESCE(SUM(total_amount), 0) as revenue
      FROM bookings
      WHERE status IN ('confirmed', 'completed', 'paid', 'collectable')
        ${branchClause}
        AND created_at >= DATE_TRUNC('year', CURRENT_DATE)
      GROUP BY TO_CHAR(created_at, 'Mon'), EXTRACT(MONTH FROM created_at)
      ORDER BY EXTRACT(MONTH FROM created_at)
    `, params);

    // If no data, return placeholder months
    if (result.rows.length === 0) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const currentMonth = new Date().getMonth();
      const placeholderData = months.slice(0, currentMonth + 1).map(name => ({ name, revenue: 0 }));
      return res.json({ success: true, data: placeholderData });
    }

    res.json({
      success: true,
      data: result.rows,
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
      AND b.status IN ('confirmed', 'completed', 'paid', 'collectable')
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

    console.log('📝 CREATE USER REQUEST - Body:', req.body);

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

    console.log('📋 Extracted values:', { firstName, middleInitial, lastName, email, role, branch, contactNumber });

    // Only allow creating Admin accounts.
    if (role !== 'admin') {
      console.log('❌ Invalid role:', role);
      return res.status(403).json({ error: 'Can only create admin accounts' });
    }

    // Check if user already exists
    console.log('🔍 Checking if user exists with email:', email);
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      console.log('❌ User already exists with email:', email);
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Generate random password
    console.log('🔐 Generating random password...');
    const generatedPassword = generateRandomPassword();
    console.log('✅ Password generated successfully');

    // Hash password
    console.log('🔒 Hashing password...');
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);
    console.log('✅ Password hashed successfully');

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
    console.log('🏢 Branch ID:', branchId);

    // Insert new user
    console.log('💾 Inserting user into database...');
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
    console.log('✅ User inserted successfully:', result.rows[0]);

    // Send password email (non-blocking)
    try {
      console.log('📧 Sending password email to:', email);
      await sendPasswordEmail(email, generatedPassword, firstName, role);
      console.log('✅ Password email sent successfully to:', email);
    } catch (emailError) {
      console.error('❌ Failed to send password email:', emailError);
      // Continue even if email fails - user is created
    }

    res.status(201).json({
      success: true,
      message: 'User created successfully. Login credentials sent to email.',
      user: result.rows[0],
      passwordSent: true,
    });
  } catch (error) {
    console.error('❌ CREATE USER ERROR - Full details:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
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
        console.log('✅ New password email sent to updated email:', email);
        passwordSent = true;
      } catch (emailError) {
        console.error('❌ Failed to send new password email:', emailError);
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
    console.log('📝 WALK-IN ENROLLMENT REQUEST:', req.body);

    const {
      firstName, middleName, lastName, age, gender, birthday,
      nationality, maritalStatus, address, zipCode, birthPlace,
      contactNumbers, email, emergencyContactPerson, emergencyContactNumber,
      courseId, courseIds, courseCategory, courseType, courseTypePdc, branchId,
      scheduleSlotId, scheduleDate,
      scheduleSlotId2, scheduleDate2,
      promoPdcSlotId2, promoPdcDate2,
      promoPdcSchedules = [],
      paymentMethod, amountPaid, paymentStatus,
      enrolledBy, addons = []
    } = req.body;

    console.log('🔍 Walk-in enrollment received - TDC:', courseType, 'PDC:', courseTypePdc);

    // Parse branchId to integer (comes as string from frontend select)
    const parsedBranchId = parseInt(branchId, 10);
    const scope = await getUserBranchScope(req.user);

    // Validate required fields
    if (!firstName || !lastName || !email || !courseId || !parsedBranchId || !scheduleSlotId || !scheduleDate) {
      const missing = [];
      if (!firstName) missing.push('firstName');
      if (!lastName) missing.push('lastName');
      if (!email) missing.push('email');
      if (!courseId) missing.push('courseId');
      if (!parsedBranchId) missing.push('branchId');
      if (!scheduleSlotId) missing.push('scheduleSlotId');
      if (!scheduleDate) missing.push('scheduleDate');
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    if (!scope.canViewAll && !isSameBranch(parsedBranchId, scope.branchId)) {
      return res.status(403).json({ error: 'Branch managers can only enroll walk-ins in their assigned branch' });
    }

    const pdcSchedules = Array.isArray(promoPdcSchedules) ? promoPdcSchedules : [];

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
        if (slotCourseType && (slotCourseType.toLowerCase().includes('b1') || slotCourseType.toLowerCase().includes('b2'))) {
          const b1b2Check = await pool.query(`
            SELECT 1 FROM schedule_slots 
            WHERE date = $1 
              AND (course_type ILIKE '%B1%' OR course_type ILIKE '%B2%')
              AND branch_id IS NOT DISTINCT FROM $2
              AND available_slots < total_capacity
          `, [slotDate, slotBranchId]);
          if (b1b2Check.rows.length > 0) {
            return res.status(400).json({ error: `The B1/B2 unit is already fully booked for ${slotDate}.` });
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
      console.log('✅ Existing user updated:', userId);
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
      console.log('✅ User created:', userId);
    }

    // 4. Create booking record
    const bookingStatus = paymentStatus === 'Full Payment' ? 'paid' : 'collectable';
    const primaryCourseId = Array.isArray(courseIds) ? courseIds[0] : courseId;
    
    // Fetch all course details for accurate booking display and notes payload
    let combinedCourseNames = '';
    let notesCourseList = [];
    let notesPdcSelections = {};
    try {
      const idsToFetch = Array.isArray(courseIds) ? courseIds : [courseId];
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
          return {
            id: meta.id,
            name: meta.name,
            type: meta.course_type || '',
            category: meta.category || '',
            price: Number(meta.price || 0),
          };
        })
        .filter(Boolean);

      pdcSchedules.forEach((schedule, idx) => {
        const resolvedCourseId = Number(schedule?.courseId) || null;
        const courseMeta = resolvedCourseId ? courseMetaById.get(resolvedCourseId) : null;
        const selectionKey = String(resolvedCourseId || `pdc_${idx + 1}`);

        notesPdcSelections[selectionKey] = {
          courseId: resolvedCourseId || schedule?.courseId || null,
          courseName: courseMeta?.name || `PDC Course ${idx + 1}`,
          courseType: courseMeta?.course_type || '',
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

      if (Object.keys(notesPdcSelections).length === 0 && (resolvedScheduleDate2 || resolvedPromoPdcDate2)) {
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

    const bookingResult = await client.query(
      `INSERT INTO bookings (
        user_id, course_id, branch_id, booking_date, 
        total_amount, payment_type, payment_method, status,
        enrollment_type, course_type, enrolled_by, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id`,
      [
        userId, primaryCourseId, parsedBranchId, scheduleDate,
        amountPaid, paymentStatus, paymentMethod, bookingStatus,
        'walk-in', courseType || (Array.isArray(courseIds) ? 'Bundle' : null), enrolledBy, 
        JSON.stringify({
          source: 'walk_in',
          scheduleSlotId: scheduleSlotId || null,
          scheduleSlotId2: resolvedScheduleSlotId2 || null,
          promoPdcSlotId2: resolvedPromoPdcSlotId2 || null,
          scheduleDate: scheduleDate || null,
          scheduleDate2: resolvedScheduleDate2 || null,
          promoPdcDate2: resolvedPromoPdcDate2 || null,
          pdcSelections: notesPdcSelections,
          courseList: notesCourseList,
          paymentType: paymentStatus || null,
          hasReviewer: hasReviewerAddon,
          hasVehicleTips: hasVehicleTipsAddon,
          displayNotes: `Walk-In Enrollment: ${combinedCourseNames}`,
          combinedCourseNames,
          addonNames: (addons || []).map(a => typeof a === 'object' ? a.name : a).filter(Boolean).join(', '),
          addonsDetailed: (addons || []).map(a => ({ name: a.name, price: a.price || 0 })),
          courseTypePdc,
          courseTypeTdc: courseType,
          subtotal: req.body.subtotal || 0,
          promoDiscount: req.body.promoDiscount || 0,
          convenienceFee: req.body.convenienceFee || 0
        })
      ]
    );
    console.log('✅ Booking created:', bookingResult.rows[0].id);

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
        await client.query(
          `UPDATE schedule_slots SET available_slots = GREATEST(available_slots - 1, 0), updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [slot.id]
        );
        console.log(`✅ New enrollment created & capacity updated for ${slot.label}`);
      } else {
        console.log(`✅ Existing enrollment updated/re-linked for ${slot.label} (no capacity change)`);
      }
    }

    await client.query('COMMIT');

    // 7. Get course and branch details for email
    const courseResult = await pool.query('SELECT category FROM courses WHERE id = $1', [courseId]);
    const branchResult = await pool.query('SELECT name, address FROM branches WHERE id = $1', [parsedBranchId]);
    
    // Fetch slot details for up to 3 slots (TDC, PDC Day 1, PDC Day 2)
    const slotResult = await pool.query('SELECT session, time_range, end_date FROM schedule_slots WHERE id = $1', [scheduleSlotId]);
    
    const courseNameEmail = combinedCourseNames || 'Driving Course';
    const courseCat = courseCategory || courseResult.rows[0]?.category || 'PDC';
    const branchName = branchResult.rows[0]?.name || 'N/A';
    const branchAddress = branchResult.rows[0]?.address || '';
    const scheduleSession = slotResult.rows[0]?.session || 'N/A';
    const scheduleTime = slotResult.rows[0]?.time_range || 'N/A';
    const scheduleEndDate = slotResult.rows[0]?.end_date || null;

    // Get PDC Day 1 details
    let pdcSession1 = null;
    let pdcTime1 = null;
    let pdcDate1 = null;
    if (resolvedScheduleSlotId2 && resolvedScheduleDate2) {
      const slot2Result = await pool.query('SELECT session, time_range FROM schedule_slots WHERE id = $1', [resolvedScheduleSlotId2]);
      pdcSession1 = slot2Result.rows[0]?.session || 'N/A';
      pdcTime1 = slot2Result.rows[0]?.time_range || 'N/A';
      pdcDate1 = resolvedScheduleDate2;
    }

    // Get PDC Day 2 details
    let pdcSession2 = null;
    let pdcTime2 = null;
    let pdcDate2 = null;
    if (resolvedPromoPdcSlotId2 && resolvedPromoPdcDate2) {
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
      await sendWalkInEnrollmentEmail(email, firstName, lastName, generatedPassword, verificationCode, {
        courseName: courseNameEmail,
        courseCategory: courseCat,
        courseType,
        courseTypePdc, // Pass both types for bundles
        branchName,
        branchAddress,
        scheduleDate,
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
        paymentMethod,
        amountPaid,
        paymentStatus,
        addonNames, // Added for accuracy in enrollment details box
        isNewUser // Pass flag to control credentials display in email
      }, hasReviewer, hasVehicleTips);
      console.log('✅ Enrollment email sent to:', email);
    } catch (emailError) {
      console.error('⚠️ Failed to send enrollment email:', emailError.message);
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
    console.error('❌ Walk-in enrollment error:', error);

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

    const whereParts = ["b.status IN ('paid', 'collectable', 'confirmed', 'completed')"];
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
    for (const row of result.rows) {
      // Full Payment bookings, confirmed (StarPay) and directly-paid bookings are Success
      const isPaid = row.status === 'paid' || row.status === 'confirmed' || row.status === 'completed' || row.payment_type === 'Full Payment';
      transactions.push({
        transaction_id: `TXN-${new Date(row.created_at).getFullYear()}-${String(row.id).padStart(3, '0')}`,
        booking_id: row.id,
        student_name: row.student_name || 'Unknown',
        transaction_date: row.created_at,
        amount: parseFloat(row.total_amount || 0),
        payment_method: row.payment_method || 'Cash',
        payment_type: row.payment_type || 'Full Payment',
        status: isPaid ? 'Success' : 'Collectable',
        course_name: row.course_name || 'N/A',
        branch_name: row.branch_name || 'Unknown',
        branch_id: row.branch_id || null,
        notes: row.notes || null
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

// Get unpaid/collectable bookings
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

    const whereParts = ["b.status = 'collectable'", "b.payment_type != 'Full Payment'"];
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
        created_at: row.created_at
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
       WHERE status IN ('confirmed', 'completed', 'paid', 'collectable') ${bookingBranchClause}`,
      params
    );
    const activeBookingsResult = await pool.query(
      `SELECT COUNT(DISTINCT user_id) as count
       FROM bookings
       WHERE status IN ('confirmed', 'paid', 'collectable') ${bookingBranchClause}`,
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
      WHERE b.status IN ('confirmed', 'completed', 'paid', 'collectable')
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
    const estimatedAssessment = isDownpaymentBooking && previousAmount > 0
      ? (previousAmount * 2)
      : coursePrice;
    const targetAssessment = Math.max(estimatedAssessment, previousAmount, coursePrice);

    let collectAmount = Number(amount_to_collect);
    if (!Number.isFinite(collectAmount) || collectAmount <= 0) {
      collectAmount = Math.max(0, targetAssessment - previousAmount);
    }

    const nextTotalAmount = Math.min(targetAssessment, previousAmount + collectAmount);
    const remainingBalance = Math.max(0, Number((targetAssessment - nextTotalAmount).toFixed(2)));
    const nextStatus = remainingBalance <= 0.009 ? 'paid' : 'collectable';
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

    // Auto-enroll in schedule slot(s) if stored in notes (e.g. StarPay guest bookings)
    try {
      const meta = JSON.parse(booking.notes || '{}');
      for (const key of ['scheduleSlotId', 'scheduleSlotId2']) {
        if (meta[key]) {
          await pool.query(
            `INSERT INTO schedule_enrollments (slot_id, student_id, enrollment_status)
             VALUES ($1, $2, 'enrolled')
             ON CONFLICT (slot_id, student_id) DO NOTHING`,
            [meta[key], booking.user_id]
          );
          await pool.query(
            `UPDATE schedule_slots SET available_slots = GREATEST(available_slots - 1, 0) WHERE id = $1`,
            [meta[key]]
          );
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
          await sendPaymentReceiptEmail(u.email, u.first_name, u.last_name, {
            bookingId: id,
            transactionId: transaction_id || `TXN-${new Date().getFullYear()}-${String(id).padStart(3, '0')}`,
            courseName: u.course_name || 'N/A',
            amountPaid: nextTotalAmount,
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
  } catch (error) {
    console.error('Mark as paid error:', error);
    res.status(500).json({ error: 'Server error while marking booking as paid' });
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
      `SELECT b.id, b.total_amount, b.payment_type, b.payment_method, b.status, b.created_at,
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
    const isFullPayment = row.status === 'paid' || row.payment_type === 'Full Payment';
    const coursePrice = parseFloat(row.course_price || 0);
    const amountPaid = parseFloat(row.total_amount || 0);
    const balanceDue = Math.max(0, coursePrice - amountPaid);

    await sendPaymentReceiptEmail(row.email, row.first_name, row.last_name, {
      bookingId: row.id,
      transactionId: `TXN-${new Date(row.created_at).getFullYear()}-${String(row.id).padStart(3, '0')}`,
      courseName: row.course_name || 'N/A',
      amountPaid,
      coursePrice,
      paymentMethod: row.payment_method || 'Cash',
      paymentDate: row.created_at,
      isFullPayment,
      balanceDue,
    });

    res.json({ success: true, message: `Receipt sent to ${row.email}` });
  } catch (error) {
    console.error('Send receipt email error:', error);
    res.status(500).json({ error: 'Failed to send receipt email' });
  }
};

// Get notifications — payment and enrollment events filtered by branch role
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
          WHEN b.payment_type = 'Full Payment'
            AND b.status IN ('paid', 'confirmed', 'completed')
          THEN 'payment_full'
          WHEN b.payment_type = 'Downpayment'
            OR (b.payment_type IS NOT NULL AND b.payment_type <> 'Full Payment'
                AND b.status = 'collectable')
          THEN 'payment_down'
          ELSE 'enrollment'
        END AS notif_type,

        -- Dynamic title
        CASE
          WHEN b.notes IS NOT NULL AND b.notes ~ '^\\{'
            AND (b.notes::jsonb->>'rescheduled') = 'true'
          THEN 'Reschedule Request'
          WHEN b.payment_type = 'Full Payment'
            AND b.status IN ('paid', 'confirmed', 'completed')
          THEN 'Full Payment Received'
          WHEN b.payment_type = 'Downpayment'
            OR (b.payment_type IS NOT NULL AND b.payment_type <> 'Full Payment'
                AND b.status = 'collectable')
          THEN 'Downpayment Received'
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
          WHEN b.payment_type = 'Full Payment'
            AND b.status IN ('paid', 'confirmed', 'completed')
          THEN u.first_name || ' ' || u.last_name
            || ' paid ₱' || TO_CHAR(COALESCE(b.total_amount, 0), 'FM999,999,990.00')
            || ' in full for ' || COALESCE(c.name, 'a course')
            || ' at ' || COALESCE(br.name, 'branch')
            || ' via ' || COALESCE(b.payment_method, 'Online')
          WHEN b.payment_type = 'Downpayment'
            OR (b.payment_type IS NOT NULL AND b.payment_type <> 'Full Payment'
                AND b.status = 'collectable')
          THEN u.first_name || ' ' || u.last_name
            || ' made a ₱' || TO_CHAR(COALESCE(b.total_amount, 0), 'FM999,999,990.00')
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
      WHERE b.status IN ('paid', 'collectable', 'confirmed', 'completed')
        ${branchCondition}
      ORDER BY b.created_at DESC
      LIMIT 50
    `;

    const result = await pool.query(query);

    const typeMap = {
      payment_full: 'success',
      payment_down: 'warning',
      reschedule:   'info',
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

// ── Email content config endpoints ───────────────────────────────────────────
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
    await sendGuestEnrollmentEmail(email, firstName, lastName, enrollmentDetails, true, true);
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
  sendReceiptEmail,
  getEmailContent,
  updateEmailContent,
  sendTestEmailRoute,
};

// ─── Student summary detail ────────────────────────────────────────────────
// ── Add-ons config endpoints ──────────────────────────────────────────────
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
    
    console.log(`🚀 Starting DB backup to ${filename}...`);
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
    
    console.log('🚮 Clearing database (Students & Bookings)...');
    
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

    console.log(`📥 Importing SQL backup from ${file.originalname}...`);
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
  sendReceiptEmail,
  getEmailContent,
  updateEmailContent,
  sendTestEmailRoute,
  sendAllEmailDesignsRoute,
  getTodayStudents,
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

