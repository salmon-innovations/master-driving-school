const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { generateRandomPassword, sendPasswordEmail } = require('../utils/emailService');

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    // Get total enrolled students (unique users with bookings)
    const studentsResult = await pool.query(
      `SELECT COUNT(DISTINCT user_id) as total FROM bookings WHERE status IN ('confirmed', 'completed')`
    );

    // Get total revenue (sum of all confirmed/completed bookings)
    const revenueResult = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM bookings 
       WHERE status IN ('confirmed', 'completed') 
       AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
       AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`
    );

    // Get pending bookings count
    const pendingResult = await pool.query(
      `SELECT COUNT(*) as total FROM bookings WHERE status = 'pending'`
    );

    // Get today's enrollments
    const todayEnrollmentsResult = await pool.query(
      `SELECT COUNT(*) as total FROM bookings 
       WHERE DATE(created_at) = CURRENT_DATE`
    );

    res.json({
      success: true,
      stats: {
        totalStudents: parseInt(studentsResult.rows[0].total),
        monthlyRevenue: parseFloat(revenueResult.rows[0].total),
        pendingBookings: parseInt(pendingResult.rows[0].total),
        todayEnrollments: parseInt(todayEnrollmentsResult.rows[0].total),
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

    let query = `
      SELECT b.*, 
             u.first_name || ' ' || u.middle_name || ' ' || u.last_name as student_name,
             u.email as student_email,
             u.contact_numbers as student_contact,
             c.name as course_name, 
             c.price as course_price,
             br.name as branch_name, 
             br.address as branch_address
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN courses c ON b.course_id = c.id
      LEFT JOIN branches br ON b.branch_id = br.id
    `;

    const queryParams = [];
    
    if (status) {
      query += ` WHERE b.status = $1`;
      queryParams.push(status);
      query += ` ORDER BY b.created_at DESC LIMIT $2`;
      queryParams.push(limit);
    } else {
      query += ` ORDER BY b.created_at DESC LIMIT $1`;
      queryParams.push(limit);
    }

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
             u.branch_id, b.name as branch_name
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
    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await pool.query(
      `UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, id]
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
      WHERE status IN ('confirmed', 'completed')
        AND created_at >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY TO_CHAR(created_at, 'Mon'), EXTRACT(MONTH FROM created_at)
      ORDER BY EXTRACT(MONTH FROM created_at)
    `);

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
      FROM bookings
      WHERE created_at >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY TO_CHAR(created_at, 'Mon'), EXTRACT(MONTH FROM created_at)
      ORDER BY EXTRACT(MONTH FROM created_at)
    `);

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
        COUNT(CASE WHEN b.status = 'confirmed' OR b.status = 'completed' THEN 1 END) as completed_bookings
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
          status = $13
        WHERE id = $14
        RETURNING id, first_name, middle_name, last_name, email, role, branch_id, status`
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
          status = $11
        WHERE id = $12
        RETURNING id, first_name, middle_name, last_name, email, role, branch_id, status`;

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
};
