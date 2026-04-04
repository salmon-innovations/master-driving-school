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
  admin: [...ALL_PERMISSION_KEYS],
  staff: [
    'operations.schedules.manage',
    'operations.bookings.manage',
    'operations.walk_in.manage',
    'operations.sales.manage',
    'operations.crm.manage',
    'operations.news.manage',
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

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    // Get total enrolled students (from bookings + schedule_enrollments)
    const studentsResult = await pool.query(
      `SELECT COUNT(DISTINCT student_id) as total FROM (
        SELECT user_id as student_id FROM bookings WHERE status IN ('confirmed', 'completed', 'paid', 'collectable')
        UNION
        SELECT student_id FROM schedule_enrollments WHERE enrollment_status IN ('enrolled', 'completed')
      ) combined`
    );

    // Get total revenue this month
    const revenueResult = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM bookings 
       WHERE status IN ('confirmed', 'completed', 'paid', 'collectable') 
       AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
       AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`
    );

    // Get total revenue LAST month for growth rate
    const lastMonthRevenueResult = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM bookings 
       WHERE status IN ('confirmed', 'completed', 'paid', 'collectable') 
       AND created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
       AND created_at < DATE_TRUNC('month', CURRENT_DATE)`
    );

    // Get pending bookings count
    const pendingResult = await pool.query(
      `SELECT COUNT(*) as total FROM bookings WHERE status = 'pending'`
    );

    // Get today's enrollments
    const todayEnrollmentsResult = await pool.query(
      `SELECT COUNT(*) as total FROM (
        SELECT id FROM bookings WHERE created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + INTERVAL '1 day'
        UNION ALL
        SELECT id FROM schedule_enrollments WHERE created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + INTERVAL '1 day'
      ) combined`
    );

    // Get this month's added students (for Analytics Page)
    const addedStudentsResult = await pool.query(
      `SELECT COUNT(*) as total FROM bookings 
       WHERE EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
       AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`
    );

    // Get walk-ins count (total or monthly? Analytics likely wants total or relevant timeframe. Let's do monthly)
    const walkInsResult = await pool.query(
      `SELECT COUNT(*) as total FROM bookings 
       WHERE enrollment_type = 'walk-in'
       AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
       AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`
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
        retention: 95.5, // Mock data
        traffic: 1250,   // Mock data
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
    const userRole = req.user.role;
    const userId = req.user.id;

    // Always fetch the actual branch_id from DB — don't rely on JWT payload
    let userBranchId = null;
    if (userRole === 'staff') {
      const userRow = await pool.query('SELECT branch_id FROM users WHERE id = $1', [userId]);
      if (userRow.rows.length > 0) {
        userBranchId = userRow.rows[0].branch_id;
        console.log(`🔍 [getAllBookings] Role: ${userRole}, branch_id from DB: ${userBranchId}`);
      } else {
        console.warn(`⚠️ [getAllBookings] Staff user ID ${userId} not found in database.`);
      }
    }

    const queryParams = [];
    let paramIndex = 1;
    const whereClauses = [];

    // Branch filter: staff restricted to their branch; admins can filter by selected branch
    const effectiveBranchId = userBranchId || (branchId ? parseInt(branchId) : null);
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

    const { role, limit = 100 } = req.query;

    let query = `
      SELECT u.id, u.first_name, u.middle_name, u.last_name, u.email, u.role, 
             u.contact_numbers, u.address, u.gender, u.age, u.birthday, 
             u.status, u.last_login, u.created_at, u.is_verified,
             u.birth_place, u.nationality, u.marital_status, u.zip_code,
             u.emergency_contact_person, u.emergency_contact_number,
             COALESCE(u.permissions, '[]'::jsonb) as permissions,
             COALESCE(u.branch_id, (
                SELECT branch_id FROM bookings WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1
             )) as branch_id, 
             COALESCE(b.name, (
                SELECT br.name FROM bookings bk JOIN branches br ON bk.branch_id = br.id WHERE bk.user_id = u.id ORDER BY bk.created_at DESC LIMIT 1
             )) as branch_name, u.avatar
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
    `;

    const queryParams = [];

    if (role) {
      query += ` WHERE u.role = $1`;
      queryParams.push(role);
      query += ` ORDER BY u.created_at DESC LIMIT $2`;
      queryParams.push(limit);
    } else {
      query += ` ORDER BY u.created_at DESC LIMIT $1`;
      queryParams.push(limit);
    }

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
    if (!name || name.trim().length < 2) {
      return res.json({ success: true, students: [] });
    }

    const searchPattern = `%${name.trim()}%`;
    const query = `
      SELECT u.id, u.first_name, u.middle_name, u.last_name, u.email, u.role, 
             u.contact_numbers, u.address, u.gender, u.age, u.birthday, 
             u.status, u.birth_place, u.nationality, u.marital_status, u.zip_code,
             u.emergency_contact_person, u.emergency_contact_number
      FROM users u
      WHERE (u.first_name ILIKE $1 OR u.last_name ILIKE $1 OR u.email ILIKE $1)
      AND (u.role = 'student' OR u.role = 'walkin_student')
      LIMIT 10
    `;

    const result = await pool.query(query, [searchPattern]);

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

    // Validate status
    const validStatuses = ['collectable', 'paid', 'cancelled', 'completed'];
    if (!validStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({ error: 'Invalid status' });
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
    const result = await pool.query(`
      SELECT 
        TO_CHAR(created_at, 'Mon') as name,
        COALESCE(SUM(total_amount), 0) as revenue
      FROM bookings
      WHERE status IN ('confirmed', 'completed', 'paid', 'collectable')
        AND created_at >= DATE_TRUNC('year', CURRENT_DATE)
      GROUP BY TO_CHAR(created_at, 'Mon'), EXTRACT(MONTH FROM created_at)
      ORDER BY EXTRACT(MONTH FROM created_at)
    `);

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
    const result = await pool.query(`
      SELECT 
        TO_CHAR(created_at, 'Mon') as name,
        COUNT(*) as students,
        COUNT(CASE WHEN enrollment_type = 'walk-in' THEN 1 END) as walkins,
        COUNT(CASE WHEN enrollment_type != 'walk-in' OR enrollment_type IS NULL THEN 1 END) as online
      FROM (
        SELECT created_at, enrollment_type FROM bookings
        WHERE created_at >= DATE_TRUNC('year', CURRENT_DATE)
        UNION ALL
        SELECT created_at, 'online' as enrollment_type FROM schedule_enrollments
        WHERE created_at >= DATE_TRUNC('year', CURRENT_DATE)
      ) combined
      GROUP BY TO_CHAR(created_at, 'Mon'), EXTRACT(MONTH FROM created_at)
      ORDER BY EXTRACT(MONTH FROM created_at)
    `);

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
    const result = await pool.query(`
      SELECT 
        c.id,
        c.name as course_name,
        c.price,
        c.description,
        COUNT(b.id) as total_bookings,
        COALESCE(SUM(b.total_amount), 0) as total_revenue,
        COUNT(CASE WHEN b.status IN ('confirmed', 'completed', 'paid') THEN 1 END) as completed_bookings
      FROM courses c
      LEFT JOIN bookings b ON c.id = b.course_id
      GROUP BY c.id, c.name, c.price, c.description
      ORDER BY total_bookings DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      courses: result.rows,
    });
  } catch (error) {
    console.error('Get best selling courses error:', error);
    res.status(500).json({ error: 'Server error while fetching course statistics' });
  }
};

// Create new user (Admin/Staff only)
const createUser = async (req, res) => {
  try {
    await ensureUserPermissionsColumn();

    console.log('📝 CREATE USER REQUEST - Body:', req.body);

    const {
      firstName,
      middleInitial,
      lastName,
      gender,
      age,
      birthday,
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

    // Only allow creating Admin or Staff
    if (role !== 'admin' && role !== 'staff') {
      console.log('❌ Invalid role:', role);
      return res.status(403).json({ error: 'Can only create admin or staff accounts' });
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

    // Prepare branch_id value
    const branchId = branch ? parseInt(branch) : null;
    console.log('🏢 Branch ID:', branchId);

    // Insert new user
    console.log('💾 Inserting user into database...');
    const result = await pool.query(
      `INSERT INTO users (
        first_name, middle_name, last_name, email, password, 
        gender, age, birthday, address, contact_numbers, 
        zip_code, role, branch_id, permissions, status, is_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
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
        address,
        contactNumber,
        zipCode || null,
        role,
        branchId,
        JSON.stringify(normalizedPermissions),
        'active',
        true, // Auto-verify admin/staff accounts
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

    const { id } = req.params;
    const {
      firstName,
      middleInitial,
      lastName,
      gender,
      age,
      birthday,
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

    // Get current user email
    const currentUserResult = await pool.query('SELECT email, first_name FROM users WHERE id = $1', [id]);
    if (currentUserResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentEmail = currentUserResult.rows[0].email;
    const isEmailChanged = email !== currentEmail;

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
          address = $9,
          contact_numbers = $10,
          zip_code = $11,
          role = $12,
          branch_id = $13,
          permissions = $14,
          status = $15,
          avatar = $16
        WHERE id = $17
        RETURNING id, first_name, middle_name, last_name, email, role, branch_id, permissions, status, avatar`
      : `UPDATE users SET
          first_name = $1,
          middle_name = $2,
          last_name = $3,
          gender = $4,
          age = $5,
          birthday = $6,
          address = $7,
          contact_numbers = $8,
          zip_code = $9,
          role = $10,
          branch_id = $11,
          permissions = $12,
          status = $13,
          avatar = $14
        WHERE id = $15
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
        address,
        contactNumber,
        zipCode || null,
        role,
        branch ? parseInt(branch) : null,
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
        address,
        contactNumber,
        zipCode || null,
        role,
        branch ? parseInt(branch) : null,
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

    // Get current user data
    const userResult = await pool.query('SELECT status, role FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
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

    // Validate password
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if user exists
    const userResult = await pool.query(
      'SELECT id, email, first_name, last_name FROM users WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

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
      paymentMethod, amountPaid, paymentStatus,
      enrolledBy, addons = []
    } = req.body;

    console.log('🔍 Walk-in enrollment received - TDC:', courseType, 'PDC:', courseTypePdc);

    // Parse branchId to integer (comes as string from frontend select)
    const parsedBranchId = parseInt(branchId, 10);

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

    // Pre-flight check: Slot availability (all slots!)
    const slotsToCheck = [scheduleSlotId, scheduleSlotId2, promoPdcSlotId2].filter(Boolean);
    for (const slotId of slotsToCheck) {
        const slotCheck = await pool.query('SELECT date, course_type, available_slots FROM schedule_slots WHERE id = $1', [slotId]);
        if (slotCheck.rows.length === 0) {
          return res.status(404).json({ error: `Selected schedule slot ${slotId} not found` });
        }
        const { date: slotDate, course_type: slotCourseType, available_slots: slotAvailable } = slotCheck.rows[0];
        if (slotAvailable <= 0) {
          return res.status(400).json({ error: `The selected slot on ${slotDate} is fully booked` });
        }
        if (slotCourseType && (slotCourseType.toLowerCase().includes('b1') || slotCourseType.toLowerCase().includes('b2'))) {
          const b1b2Check = await pool.query(`
            SELECT 1 FROM schedule_slots 
            WHERE date = $1 
              AND (course_type ILIKE '%B1%' OR course_type ILIKE '%B2%')
              AND available_slots < total_capacity
          `, [slotDate]);
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
    
    // Fetch all course names for accurate display in booking table
    let combinedCourseNames = '';
    try {
      const idsToFetch = Array.isArray(courseIds) ? courseIds : [courseId];
      const namesResult = await client.query('SELECT id, name FROM courses WHERE id = ANY($1)', [idsToFetch]);
      const nameMap = {};
      namesResult.rows.forEach(r => nameMap[r.id] = r.name);
      combinedCourseNames = idsToFetch.map(id => nameMap[id]).filter(Boolean).join(' + ');
    } catch (e) {
      console.error('Error fetching combined names:', e);
      combinedCourseNames = 'Custom Bundle';
    }

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
      { id: scheduleSlotId, date: scheduleDate, label: 'Day 1' },
      { id: scheduleSlotId2, date: scheduleDate2, label: 'Day 2' },
      { id: promoPdcSlotId2, date: promoPdcDate2, label: 'Promo PDC Day 2' }
    ].filter(s => s.id);

    for (const slot of allSlots) {
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
    if (scheduleSlotId2 && scheduleDate2) {
      const slot2Result = await pool.query('SELECT session, time_range FROM schedule_slots WHERE id = $1', [scheduleSlotId2]);
      pdcSession1 = slot2Result.rows[0]?.session || 'N/A';
      pdcTime1 = slot2Result.rows[0]?.time_range || 'N/A';
      pdcDate1 = scheduleDate2;
    }

    // Get PDC Day 2 details
    let pdcSession2 = null;
    let pdcTime2 = null;
    let pdcDate2 = null;
    if (promoPdcSlotId2 && promoPdcDate2) {
      const promoSlot2Result = await pool.query('SELECT session, time_range FROM schedule_slots WHERE id = $1', [promoPdcSlotId2]);
      pdcSession2 = promoSlot2Result.rows[0]?.session || 'N/A';
      pdcTime2 = promoSlot2Result.rows[0]?.time_range || 'N/A';
      pdcDate2 = promoPdcDate2;
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
      WHERE b.status IN ('paid', 'collectable', 'confirmed', 'completed')
      ORDER BY b.created_at DESC
      LIMIT $1`,
      [limit]
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

    const result = await pool.query(
      `SELECT 
        b.id,
        b.booking_date,
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
      WHERE b.status = 'collectable' AND b.payment_type != 'Full Payment'
      ORDER BY b.created_at DESC
      LIMIT $1`,
      [limit]
    );

    const bookings = result.rows.map(row => {
      const coursePrice = parseFloat(row.course_price || 0);
      const amountPaid = parseFloat(row.total_amount || 0);
      const balanceDue = Math.max(0, coursePrice - amountPaid);

      return {
        id: row.id,
        student_name: row.student_name || 'Unknown',
        student_contact: row.student_contact || row.student_email || 'N/A',
        course_name: row.course_name || 'N/A',
        total_amount: amountPaid,
        course_price: coursePrice,
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
    // Determine counts for each stage
    const totalUsersResult = await pool.query('SELECT COUNT(*) as count FROM users');
    const totalBookingsResult = await pool.query('SELECT COUNT(*) as count FROM bookings');
    const activeBookingsResult = await pool.query("SELECT COUNT(*) as count FROM bookings WHERE status IN ('confirmed', 'paid', 'collectable')");
    const completedBookingsResult = await pool.query("SELECT COUNT(*) as count FROM bookings WHERE status = 'completed'");

    const totalUsers = parseInt(totalUsersResult.rows[0].count);
    const totalBookings = parseInt(totalBookingsResult.rows[0].count);
    const activeBookings = parseInt(activeBookingsResult.rows[0].count);
    const completedBookings = parseInt(completedBookingsResult.rows[0].count);

    // Mock Visitors & Inquiries based on Users (placeholder logic)
    const visitors = Math.max(totalUsers * 5, 100);
    const inquiries = Math.max(totalUsers * 2, 50);

    const funnelData = [
      { name: 'Visitors', value: visitors, fill: '#8884d8' },
      { name: 'Inquiries', value: inquiries, fill: '#83a6ed' },
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
    const result = await pool.query(`
      SELECT c.category, COUNT(b.id) as count
      FROM bookings b
      JOIN courses c ON b.course_id = c.id
      GROUP BY c.category
      ORDER BY count DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get course distribution error:', error);
    res.status(500).json({ error: 'Server error while fetching course distribution' });
  }
};

// Get branch performance
const getBranchPerformance = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT br.name as branch_name, COALESCE(SUM(b.total_amount), 0) as revenue
      FROM bookings b
      JOIN branches br ON b.branch_id = br.id
      WHERE b.status IN ('confirmed', 'completed', 'paid', 'collectable')
      GROUP BY br.name
      ORDER BY revenue DESC
    `);

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
    const userRole = req.user.role;
    const userId = req.user.id;

    // Always resolve branch from DB — not from JWT payload
    let userBranchId = null;
    if (userRole === 'staff') {
      const branchRow = await pool.query('SELECT branch_id FROM users WHERE id = $1', [userId]);
      userBranchId = branchRow.rows[0]?.branch_id || null;
    }

    // Build branch condition
    const branchCondition = userBranchId
      ? `AND b.branch_id = ${parseInt(userBranchId)}`
      : ''; // admin = no filter

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
    await sendPasswordEmail(email, 'Temp#1234', firstName, 'staff');
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
    const branchId = req.query.branch_id ? parseInt(req.query.branch_id, 10) : null;
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

