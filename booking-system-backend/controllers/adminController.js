const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { generateRandomPassword, sendPasswordEmail, generateVerificationCode, sendWalkInEnrollmentEmail } = require('../utils/emailService');

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
    const { status, limit = 50 } = req.query;
    const userRole = req.user.role;
    const userId = req.user.id;

    // Always fetch the actual branch_id from DB — don't rely on JWT payload
    let userBranchId = null;
    if (userRole === 'staff' || userRole === 'hrm') {
      const userRow = await pool.query('SELECT branch_id FROM users WHERE id = $1', [userId]);
      userBranchId = userRow.rows[0]?.branch_id || null;
      console.log(`🔍 [getAllBookings] Role: ${userRole}, branch_id from DB: ${userBranchId}`);
    }

    const queryParams = [];
    let paramIndex = 1;
    const whereClauses = [];

    // Branch filter: staff and hrm only see their branch
    if (userBranchId) {
      whereClauses.push(`b.branch_id = $${paramIndex++}`);
      queryParams.push(userBranchId);
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
             b.created_at, b.updated_at,
             COALESCE(b.payment_type, 'N/A') as payment_type,
             COALESCE(b.payment_method, 'N/A') as payment_method,
             COALESCE(b.enrollment_type, 'online') as enrollment_type,
             u.first_name || ' ' || COALESCE(u.middle_name || ' ', '') || u.last_name as student_name,
             u.email as student_email,
             u.contact_numbers as student_contact,
             c.name as course_name, 
             c.price as course_price,
             br.name as branch_name, 
             br.address as branch_address,
             (
               SELECT json_agg(
                 json_build_object('date', ss.date, 'end_date', ss.end_date, 'type', ss.type)
                 ORDER BY ss.date ASC
               )
               FROM schedule_enrollments se
               JOIN schedule_slots ss ON se.slot_id = ss.id
               WHERE se.student_id = b.user_id
             ) as schedule_details
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
    const { role, limit = 100 } = req.query;

    let query = `
      SELECT u.id, u.first_name, u.middle_name, u.last_name, u.email, u.role, 
             u.contact_numbers, u.address, u.gender, u.age, u.birthday, 
             u.status, u.last_login, u.created_at, u.is_verified,
             u.birth_place, u.nationality, u.marital_status, u.zip_code,
             u.emergency_contact_person, u.emergency_contact_number,
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
        COUNT(*) as students
      FROM (
        SELECT created_at FROM bookings
        WHERE created_at >= DATE_TRUNC('year', CURRENT_DATE)
        UNION ALL
        SELECT created_at FROM schedule_enrollments
        WHERE created_at >= DATE_TRUNC('year', CURRENT_DATE)
      ) combined
      GROUP BY TO_CHAR(created_at, 'Mon'), EXTRACT(MONTH FROM created_at)
      ORDER BY EXTRACT(MONTH FROM created_at)
    `);

    // If no data, return placeholder months
    if (result.rows.length === 0) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const currentMonth = new Date().getMonth();
      const placeholderData = months.slice(0, currentMonth + 1).map(name => ({ name, students: 0 }));
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
    console.log('📝 CREATE USER REQUEST - Body:', req.body);

    const {
      firstName,
      middleInitial,
      lastName,
      gender,
      age,
      birthday,
      address,
      contactNumber,
      email,
      role,
      branch,
    } = req.body;

    console.log('📋 Extracted values:', { firstName, middleInitial, lastName, email, role, branch, contactNumber });

    // Only allow creating Admin, HRM, or Staff
    if (role !== 'admin' && role !== 'hrm' && role !== 'staff') {
      console.log('❌ Invalid role:', role);
      return res.status(403).json({ error: 'Can only create admin, HRM, or staff accounts' });
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
        role, branch_id, status, is_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id, first_name, middle_name, last_name, email, role, branch_id, status, created_at`,
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
        role,
        branchId,
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
    const { id } = req.params;
    const {
      firstName,
      middleInitial,
      lastName,
      gender,
      age,
      birthday,
      address,
      contactNumber,
      email,
      role,
      branch,
      status,
      emailChanged,
      avatar,
    } = req.body;

    // Only allow updating Admin, HRM, or Staff
    if (role !== 'admin' && role !== 'hrm' && role !== 'staff') {
      return res.status(403).json({ error: 'Can only update admin, HRM, or staff accounts' });
    }

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
          role = $11,
          branch_id = $12,
          status = $13,
          avatar = $14
        WHERE id = $15
        RETURNING id, first_name, middle_name, last_name, email, role, branch_id, status, avatar`
      : `UPDATE users SET
          first_name = $1,
          middle_name = $2,
          last_name = $3,
          gender = $4,
          age = $5,
          birthday = $6,
          address = $7,
          contact_numbers = $8,
          role = $9,
          branch_id = $10,
          status = $11,
          avatar = $12
        WHERE id = $13
        RETURNING id, first_name, middle_name, last_name, email, role, branch_id, status, avatar`;

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
        role,
        branch ? parseInt(branch) : null,
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
        role,
        branch ? parseInt(branch) : null,
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

    // Get current status
    const userResult = await pool.query('SELECT status FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
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
      courseId, courseCategory, courseType, branchId,
      scheduleSlotId, scheduleDate,
      scheduleSlotId2, scheduleDate2,
      paymentMethod, amountPaid, paymentStatus,
      enrolledBy
    } = req.body;

    // Parse branchId to integer (comes as string from frontend select)
    const parsedBranchId = parseInt(branchId, 10);

    const isMotorcyclePDC = courseCategory?.toLowerCase().includes('motorcycle') || courseType?.toLowerCase().includes('motorcycle');

    // Validate required fields
    if (!firstName || !lastName || !email || !courseId || !parsedBranchId) {
      const missing = [];
      if (!firstName) missing.push('firstName');
      if (!lastName) missing.push('lastName');
      if (!email) missing.push('email');
      if (!courseId) missing.push('courseId');
      if (!parsedBranchId) missing.push('branchId');
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    if (!isMotorcyclePDC && (!scheduleSlotId || !scheduleDate)) {
      const missing = [];
      if (!scheduleSlotId) missing.push('scheduleSlotId');
      if (!scheduleDate) missing.push('scheduleDate');
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    // Pre-flight check: Slot availability and B1/B2 Global Capacity Rule
    if (scheduleSlotId) {
      const slotCheck = await pool.query('SELECT date, course_type, available_slots FROM schedule_slots WHERE id = $1', [scheduleSlotId]);
      if (slotCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Selected schedule slot not found' });
      }
      const { date: slotDate, course_type: slotCourseType, available_slots: slotAvailable } = slotCheck.rows[0];
      if (slotAvailable <= 0) {
        return res.status(400).json({ error: 'The selected slot is fully booked' });
      }
      if (slotCourseType && (slotCourseType.toLowerCase().includes('b1') || slotCourseType.toLowerCase().includes('b2'))) {
        const b1b2Check = await pool.query(`
          SELECT 1 FROM schedule_slots 
          WHERE date = $1 
            AND (course_type ILIKE '%B1%' OR course_type ILIKE '%B2%')
            AND available_slots < total_capacity
        `, [slotDate]);
        if (b1b2Check.rows.length > 0) {
          return res.status(400).json({ error: 'The B1/B2 Van/L300 unit is already fully booked for this date across all branches.' });
        }
      }
    }

    await client.query('BEGIN');

    // 1. Check if user already exists with this email
    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'A user with this email already exists. Please use a different email.' });
    }

    // 2. Generate password and verification code
    const generatedPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);
    const verificationCode = generateVerificationCode();
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
      RETURNING id, first_name, last_name, email`,
      [
        firstName, middleName || null, lastName, email, hashedPassword,
        address, age, gender, birthday, birthPlace,
        nationality, maritalStatus, contactNumbers, zipCode,
        emergencyContactPerson, emergencyContactNumber,
        'walkin_student', parsedBranchId, 'active', false,
        verificationCode, codeExpires
      ]
    );
    const newUser = userResult.rows[0];
    console.log('✅ User created:', newUser.id);

    // 4. Create booking record
    const bookingStatus = paymentStatus === 'Full Payment' ? 'paid' : 'collectable';
    const bookingResult = await client.query(
      `INSERT INTO bookings (
        user_id, course_id, branch_id, booking_date, 
        total_amount, payment_type, payment_method, status,
        enrollment_type, course_type, enrolled_by, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id`,
      [
        newUser.id, courseId, parsedBranchId, scheduleDate,
        amountPaid, paymentStatus, paymentMethod, bookingStatus,
        'walk-in', courseType, enrolledBy, 'Walk-in enrollment'
      ]
    );
    console.log('✅ Booking created:', bookingResult.rows[0].id);

    // 5. Enroll student in schedule slot(s)
    if (scheduleSlotId) {
      await client.query(
        `INSERT INTO schedule_enrollments (slot_id, student_id, enrollment_status)
         VALUES ($1, $2, 'enrolled')`,
        [scheduleSlotId, newUser.id]
      );
      console.log('✅ Schedule enrollment created (Day 1)');

      // 6. Decrement available slots
      await client.query(
        `UPDATE schedule_slots SET available_slots = available_slots - 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND available_slots > 0`,
        [scheduleSlotId]
      );
      console.log('✅ Slot capacity decremented (Day 1)');

      // If TDC (2-day course), enroll in second slot too
      if (scheduleSlotId2 && scheduleDate2) {
        await client.query(
          `INSERT INTO schedule_enrollments (slot_id, student_id, enrollment_status)
           VALUES ($1, $2, 'enrolled')`,
          [scheduleSlotId2, newUser.id]
        );
        console.log('✅ Schedule enrollment created (Day 2)');

        await client.query(
          `UPDATE schedule_slots SET available_slots = available_slots - 1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND available_slots > 0`,
          [scheduleSlotId2]
        );
        console.log('✅ Slot capacity decremented (Day 2)');
      }
    }

    await client.query('COMMIT');

    // 7. Get course and branch details for email
    const courseResult = await pool.query('SELECT name, category FROM courses WHERE id = $1', [courseId]);
    const branchResult = await pool.query('SELECT name, address FROM branches WHERE id = $1', [parsedBranchId]);

    let slotResult = { rows: [] };
    if (scheduleSlotId) {
      slotResult = await pool.query('SELECT session, time_range FROM schedule_slots WHERE id = $1', [scheduleSlotId]);
    }

    const courseName = courseResult.rows[0]?.name || 'N/A';
    const courseCat = courseCategory || courseResult.rows[0]?.category || 'PDC';
    const branchName = branchResult.rows[0]?.name || 'N/A';
    const branchAddress = branchResult.rows[0]?.address || '';
    const scheduleSession = isMotorcyclePDC ? 'TBA' : (slotResult.rows[0]?.session || 'N/A');
    const scheduleTime = isMotorcyclePDC ? 'TBA' : (slotResult.rows[0]?.time_range || 'N/A');

    // Get Day 2 schedule details for TDC
    let scheduleSession2Email = null;
    let scheduleTime2Email = null;
    let scheduleDate2Email = null;
    if (scheduleSlotId2 && scheduleDate2) {
      const slot2Result = await pool.query('SELECT session, time_range FROM schedule_slots WHERE id = $1', [scheduleSlotId2]);
      scheduleSession2Email = slot2Result.rows[0]?.session || 'N/A';
      scheduleTime2Email = slot2Result.rows[0]?.time_range || 'N/A';
      scheduleDate2Email = scheduleDate2;
    }

    // 8. Send walk-in enrollment confirmation email
    try {
      await sendWalkInEnrollmentEmail(email, firstName, lastName, generatedPassword, verificationCode, {
        courseName,
        courseCategory: courseCat,
        courseType,
        branchName,
        branchAddress,
        scheduleDate: isMotorcyclePDC ? 'Admin Assigned' : scheduleDate,
        scheduleSession,
        scheduleTime,
        scheduleDate2: scheduleDate2Email,
        scheduleSession2: scheduleSession2Email,
        scheduleTime2: scheduleTime2Email,
        paymentMethod,
        amountPaid,
        paymentStatus
      });
      console.log('✅ Enrollment email sent to:', email);
    } catch (emailError) {
      console.error('⚠️ Failed to send enrollment email:', emailError.message);
      // Continue - enrollment still succeeded even if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Walk-in enrollment completed successfully. Confirmation email sent to student.',
      data: {
        userId: newUser.id,
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
        u.first_name || ' ' || u.last_name AS student_name,
        c.name AS course_name
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN courses c ON b.course_id = c.id
      WHERE b.status IN ('paid', 'collectable')
      ORDER BY b.created_at DESC
      LIMIT $1`,
      [limit]
    );

    const transactions = result.rows.map((row, index) => {
      // Full Payment bookings are always considered paid/Success
      const isPaid = row.status === 'paid' || row.payment_type === 'Full Payment';
      return {
        transaction_id: `TXN-${new Date(row.created_at).getFullYear()}-${String(row.id).padStart(3, '0')}`,
        booking_id: row.id,
        student_name: row.student_name || 'Unknown',
        transaction_date: row.created_at,
        amount: parseFloat(row.total_amount || 0),
        payment_method: row.payment_method || 'Cash',
        payment_type: row.payment_type || 'Full Payment',
        status: isPaid ? 'Success' : 'Collectable',
        course_name: row.course_name || 'N/A'
      };
    });

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
};
