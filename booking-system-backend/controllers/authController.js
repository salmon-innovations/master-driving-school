const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const path = require('path');
const fs = require('fs');
const { generateVerificationCode, sendVerificationEmail, sendGuestEnrollmentEmail } = require('../utils/emailService');

// Generate JWT token
const generateToken = (userId, role = 'student', branchId = null) => {
  return jwt.sign({ id: userId, role: role, branch_id: branchId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// Register new user
const register = async (req, res) => {
  try {
    const {
      firstName,
      middleName,
      lastName,
      email,
      password,
      address,
      age,
      gender,
      birthday,
      birthPlace,
      nationality,
      maritalStatus,
      contactNumbers,
      zipCode,
      emergencyContactPerson,
      emergencyContactNumber,
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'Please provide all required fields' });
    }

    // Validate age
    if (age && (parseInt(age) <= 0 || parseInt(age) < 18)) {
      return res.status(400).json({ error: 'Age must be 18 or above' });
    }

    // Validate contact numbers (format: +63-9XX-XXX-XXXX)
    if (contactNumbers) {
      const cleanNumber = contactNumbers.replace(/\D/g, '');
      // Should have 10 digits after country code (63) or 11 digits if starting with 0
      if (cleanNumber.length !== 11 && cleanNumber.length !== 12) {
        return res.status(400).json({ error: 'Contact number must be in valid format' });
      }
      // If 12 digits, should start with 63, if 11 should start with 0
      if (cleanNumber.length === 12 && !cleanNumber.startsWith('63')) {
        return res.status(400).json({ error: 'Invalid contact number format' });
      }
      if (cleanNumber.length === 11 && !cleanNumber.startsWith('0')) {
        return res.status(400).json({ error: 'Invalid contact number format' });
      }
    }

    // Validate emergency contact number (format: +63-9XX-XXX-XXXX)
    if (emergencyContactNumber) {
      const cleanEmergencyNumber = emergencyContactNumber.replace(/\D/g, '');
      // Should have 10 digits after country code (63) or 11 digits if starting with 0
      if (cleanEmergencyNumber.length !== 11 && cleanEmergencyNumber.length !== 12) {
        return res.status(400).json({ error: 'Emergency contact number must be in valid format' });
      }
      // If 12 digits, should start with 63, if 11 should start with 0
      if (cleanEmergencyNumber.length === 12 && !cleanEmergencyNumber.startsWith('63')) {
        return res.status(400).json({ error: 'Invalid emergency contact number format' });
      }
      if (cleanEmergencyNumber.length === 11 && !cleanEmergencyNumber.startsWith('0')) {
        return res.status(400).json({ error: 'Invalid emergency contact number format' });
      }
    }

    // Validate email format
    if (!/@/.test(email) || !/\.com$/.test(email.toLowerCase())) {
      return res.status(400).json({ error: 'Email must contain @ and end with .com' });
    }

    // Validate password length
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if user already exists
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate verification code
    const verificationCode = generateVerificationCode();
    const codeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Insert user into database
    const result = await pool.query(
      `INSERT INTO users (
        first_name, middle_name, last_name, email, password,
        address, age, gender, birthday, birth_place,
        nationality, marital_status, contact_numbers, zip_code,
        emergency_contact_person, emergency_contact_number,
        verification_code, verification_code_expires, is_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING id, first_name, last_name, email`,
      [
        firstName,
        middleName,
        lastName,
        email,
        hashedPassword,
        address,
        age,
        gender,
        birthday,
        birthPlace,
        nationality,
        maritalStatus,
        contactNumbers,
        zipCode,
        emergencyContactPerson,
        emergencyContactNumber,
        verificationCode,
        codeExpires,
        false, // is_verified
      ]
    );

    const user = result.rows[0];

    // Send verification email and report actual delivery status.
    let verificationEmailSent = true;
    try {
      await sendVerificationEmail(email, verificationCode, firstName);
      console.log('✅ Verification email sent successfully');
    } catch (emailError) {
      verificationEmailSent = false;
      console.error('⚠️ Failed to send verification email:', emailError.message);
    }

    res.status(201).json({
      success: true,
      message: verificationEmailSent
        ? 'Registration successful. Please check your email for verification code.'
        : 'Registration successful, but we could not send the verification code right now. Please use Resend Code in Verify Email.',
      emailSent: verificationEmailSent,
      user: {
        id: user.id,
        email: user.email,
        needsVerification: true,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
};

// Process Guest Checkout (User creation, booking, schedule, and email)
const guestCheckout = async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      firstName, middleName, lastName, email, address, age, gender, birthday,
      birthPlace, nationality, maritalStatus, contactNumbers, zipCode,
      emergencyContactPerson, emergencyContactNumber,
      courseId, courseCategory, courseType, branchId,
      scheduleSlotId, scheduleDate,
      scheduleSlotId2, scheduleDate2,
      paymentMethod, amountPaid, paymentStatus, hasReviewer, hasVehicleTips
      } = req.body;

    if (!firstName || !lastName || !email || !contactNumbers || !courseId) {
      return res.status(400).json({ error: 'Please provide all required fields.' });
    }

    const parsedBranchId = branchId ? parseInt(branchId, 10) : null;

    await client.query('BEGIN');

    // 1. Check if user already exists
    const userExists = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'User with this email already exists. Please sign in instead.' });
    }

    // 2. Generate random password just for DB constraint (NOT sent to user)
    const randomPassword = require('crypto').randomBytes(12).toString('hex');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(randomPassword, salt);

    // 3. Insert user as guest_student
    const result = await client.query(
      `INSERT INTO users (
        first_name, middle_name, last_name, email, password,
        address, age, gender, birthday, birth_place,
        nationality, marital_status, contact_numbers, zip_code,
        emergency_contact_person, emergency_contact_number,
        is_verified, role, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING id, email`,
      [
        firstName, middleName || null, lastName, email, hashedPassword,
        address, age, gender, birthday, birthPlace,
        nationality, maritalStatus, contactNumbers, zipCode,
        emergencyContactPerson, emergencyContactNumber,
        true, 'student', 'active'
      ]
    );

    const newUser = result.rows[0];

    // 4. Create booking
    const bookingStatus = paymentStatus === 'Full Payment' ? 'paid' : 'collectable';
    const bookingResult = await client.query(
      `INSERT INTO bookings (
        user_id, course_id, branch_id, booking_date, 
        total_amount, payment_type, payment_method, status,
        enrollment_type, course_type, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        newUser.id, courseId, parsedBranchId, scheduleDate,
        amountPaid, paymentStatus, paymentMethod, bookingStatus,
        'guest', courseType, 'Guest enrollment'
      ]
    );

    // 5. Enroll in schedule
    if (scheduleSlotId) {
      await client.query(
        `INSERT INTO schedule_enrollments (slot_id, student_id, enrollment_status)
         VALUES ($1, $2, 'enrolled')`,
        [scheduleSlotId, newUser.id]
      );
      await client.query(
        `UPDATE schedule_slots SET available_slots = available_slots - 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND available_slots > 0`,
        [scheduleSlotId]
      );
    }

    // 6. Day 2 schedule if applicable
    if (scheduleSlotId2 && scheduleDate2) {
      await client.query(
        `INSERT INTO schedule_enrollments (slot_id, student_id, enrollment_status)
         VALUES ($1, $2, 'enrolled')`,
        [scheduleSlotId2, newUser.id]
      );
      await client.query(
        `UPDATE schedule_slots SET available_slots = available_slots - 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND available_slots > 0`,
        [scheduleSlotId2]
      );
    }

    await client.query('COMMIT');

    // 7. Send Guest email WITHOUT login details
    const courseResult = await pool.query('SELECT name, category FROM courses WHERE id = $1', [courseId]);
    const branchResult = await pool.query('SELECT name, address FROM branches WHERE id = $1', [parsedBranchId]);
    const slotResult = await pool.query('SELECT session, time_range FROM schedule_slots WHERE id = $1', [scheduleSlotId]);

    let scheduleSession2Email = null, scheduleTime2Email = null, scheduleDate2Email = null;
    if (scheduleSlotId2) {
      const slot2Result = await pool.query('SELECT session, time_range FROM schedule_slots WHERE id = $1', [scheduleSlotId2]);
      scheduleSession2Email = slot2Result.rows[0]?.session;
      scheduleTime2Email = slot2Result.rows[0]?.time_range;
      scheduleDate2Email = scheduleDate2;
    }

    
    try {
      await sendGuestEnrollmentEmail(email, firstName, lastName, {
        courseName: courseResult.rows[0]?.name || 'N/A',
        courseCategory: courseCategory || courseResult.rows[0]?.category || 'PDC',
        courseType,
        branchName: branchResult.rows[0]?.name || 'N/A',
        branchAddress: branchResult.rows[0]?.address || '',
        scheduleDate,
        scheduleSession: slotResult.rows[0]?.session || 'N/A',
        scheduleTime: slotResult.rows[0]?.time_range || 'N/A',
        scheduleDate2: scheduleDate2Email,
        scheduleSession2: scheduleSession2Email,
        scheduleTime2: scheduleTime2Email,
        paymentMethod,
        amountPaid,
        paymentStatus
      }, hasReviewer, hasVehicleTips);
    } catch (e) {
      console.error('Email failed (proceeding):', e);
    }

    res.status(201).json({
      success: true,
      message: 'Guest Checkout successful. Enrollment email sent.'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Guest Checkout error:', error);
    res.status(500).json({ error: 'Server error during guest checkout' });
  } finally {
    client.release();
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password: encodedPassword, isEncoded } = req.body;

    // Validate input
    if (!email || !encodedPassword) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }

    let password = encodedPassword;
    if (isEncoded) {
      try {
        password = decodeURIComponent(escape(Buffer.from(encodedPassword, 'base64').toString('ascii')));
      } catch (e) {
        console.warn('Failed to decode password string', e);
      }
    }

    // Check if user exists
    const result = await pool.query(
      'SELECT u.*, b.id as user_branch_id FROM users u LEFT JOIN branches b ON u.branch_id = b.id WHERE u.email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Debug: Log user status from database
    console.log('🔍 Login attempt for:', user.email);
    console.log('🔍 User status from DB:', user.status);
    console.log('🔍 User role:', user.role);

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if account is inactive (check before email verification)
    const userStatus = (user.status || 'active').toLowerCase();
    console.log('🔍 Processed status:', userStatus);

    if (userStatus === 'inactive') {
      console.log('❌ Login blocked: Account is inactive for user:', user.email);
      return res.status(403).json({
        error: 'Your account has been locked. Please contact support for assistance.',
        accountLocked: true,
        email: user.email
      });
    }

    console.log('✅ Status check passed, account is active');

    // Check if email is verified
    if (!user.is_verified) {
      // Generate new verification code
      const verificationCode = generateVerificationCode();
      const codeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Update verification code in database
      await pool.query(
        'UPDATE users SET verification_code = $1, verification_code_expires = $2 WHERE id = $3',
        [verificationCode, codeExpires, user.id]
      );

      let verificationEmailSent = true;
      try {
        await sendVerificationEmail(user.email, verificationCode, user.first_name);
        console.log('✅ Verification email sent successfully');
      } catch (emailError) {
        verificationEmailSent = false;
        console.error('⚠️ Failed to send verification email:', emailError.message);
      }

      return res.status(200).json({
        success: false,
        message: verificationEmailSent
          ? 'Email not verified. A new verification code has been sent to your email.'
          : 'Email not verified. We could not send a verification code right now. Please try Resend Code again shortly.',
        needsVerification: true,
        userId: user.id,
        email: user.email,
        emailSent: verificationEmailSent,
      });
    }

    // Generate token with role and branch_id
    const token = generateToken(user.id, user.role || 'student', user.branch_id || null);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role, // Added role to login response
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.first_name, u.middle_name, u.last_name, u.email, u.address, u.age, u.gender,
       u.birthday, u.birth_place, u.nationality, u.marital_status, u.contact_numbers, u.zip_code,
       u.emergency_contact_person, u.emergency_contact_number, u.created_at, u.role, u.branch_id, u.permissions,
       u.avatar,
       b.name as branch_name
       FROM users u
       LEFT JOIN branches b ON u.branch_id = b.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const permissions = Array.isArray(user.permissions)
      ? user.permissions.filter((permission) => typeof permission === 'string')
      : [];

    res.json({
      success: true,
      user: {
        id: user.id,
        firstName: user.first_name,
        middleName: user.middle_name,
        lastName: user.last_name,
        email: user.email,
        address: user.address,
        age: user.age,
        gender: user.gender,
        birthday: user.birthday,
        birthPlace: user.birth_place,
        nationality: user.nationality,
        maritalStatus: user.marital_status,
        contactNumbers: user.contact_numbers,
        zipCode: user.zip_code,
        emergencyContactPerson: user.emergency_contact_person,
        emergencyContactNumber: user.emergency_contact_number,
        createdAt: user.created_at,
        role: user.role,
        branchId: user.branch_id,
        branchName: user.branch_name,
        avatar: user.avatar || null,
        permissions,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Upload / change profile picture
const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user.id;

    // Build the public URL path for the uploaded file
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    // Fetch old avatar so we can delete the old file
    const oldResult = await pool.query('SELECT avatar FROM users WHERE id = $1', [userId]);
    const oldAvatar = oldResult.rows[0]?.avatar || null;

    // Save new avatar URL to DB
    await pool.query('UPDATE users SET avatar = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [avatarUrl, userId]);

    // Delete old uploaded file (but only if it is a server-uploaded file, not a data-url or external url)
    if (oldAvatar && oldAvatar.startsWith('/uploads/')) {
      const oldFilePath = path.join(__dirname, '..', oldAvatar);
      fs.unlink(oldFilePath, (err) => {
        if (err) console.warn('Could not delete old avatar file:', err.message);
      });
    }

    res.json({
      success: true,
      message: 'Profile picture updated successfully',
      avatarUrl,
    });
  } catch (error) {
    console.error('Upload profile picture error:', error);
    res.status(500).json({ error: 'Server error while uploading profile picture' });
  }
};

// Verify email with code
const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }

    // Find user with matching email and code
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND verification_code = $2',
      [email, code]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    const user = result.rows[0];

    // Check if code expired
    if (new Date() > new Date(user.verification_code_expires)) {
      return res.status(400).json({ error: 'Verification code has expired' });
    }

    // Mark user as verified and clear verification fields
    await pool.query(
      `UPDATE users 
       SET is_verified = true, verification_code = NULL, verification_code_expires = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [user.id]
    );

    // Generate token with role
    const token = generateToken(user.id, user.role || 'student');

    res.json({
      success: true,
      message: 'Email verified successfully',
      token,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Server error during verification' });
  }
};

// Resend verification code
const resendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Check if already verified
    if (user.is_verified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    // Generate new code
    const verificationCode = generateVerificationCode();
    const codeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update user with new code
    await pool.query(
      'UPDATE users SET verification_code = $1, verification_code_expires = $2 WHERE id = $3',
      [verificationCode, codeExpires, user.id]
    );

    // Send email and return an error if delivery fails.
    try {
      await sendVerificationEmail(user.email, verificationCode, user.first_name);
      console.log('✅ Verification email sent successfully');
    } catch (emailError) {
      console.error('⚠️ Failed to send verification email:', emailError.message);
      return res.status(500).json({
        error: 'Failed to send verification code email. Please try again in a moment.',
        emailSent: false,
      });
    }

    res.json({
      success: true,
      message: 'Verification code sent successfully',
    });
  } catch (error) {
    console.error('Resend code error:', error);
    res.status(500).json({ error: 'Server error while resending code' });
  }
};

// Forgot Password - Send OTP
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      // Don't reveal if user exists or not for security
      return res.json({
        success: true,
        message: 'If an account exists with this email, you will receive an OTP shortly.',
      });
    }

    const user = result.rows[0];

    // Generate OTP code
    const resetCode = generateVerificationCode();
    const codeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store reset code
    await pool.query(
      'UPDATE users SET verification_code = $1, verification_code_expires = $2 WHERE id = $3',
      [resetCode, codeExpires, user.id]
    );

    // Send OTP email and return an error if delivery fails.
    try {
      await sendVerificationEmail(user.email, resetCode, user.first_name, 'Password Reset');
      console.log('✅ Password reset email sent successfully');
    } catch (emailError) {
      console.error('⚠️ Failed to send password reset email:', emailError.message);
      return res.status(500).json({
        error: 'Failed to send OTP email. Please try again in a moment.',
        emailSent: false,
      });
    }

    res.json({
      success: true,
      message: 'OTP sent to your email. Please check your inbox.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Server error while processing request' });
  }
};

// Verify Reset OTP
const verifyResetOTP = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    // Find user with matching email and code
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND verification_code = $2',
      [email, code]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    const user = result.rows[0];

    // Check if code expired
    if (new Date() > new Date(user.verification_code_expires)) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    res.json({
      success: true,
      message: 'OTP verified successfully. You can now reset your password.',
    });
  } catch (error) {
    console.error('Verify reset OTP error:', error);
    res.status(500).json({ error: 'Server error during verification' });
  }
};

// Reset Password
const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, OTP, and new password are required' });
    }

    // Validate password length
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Find user with matching email and code
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND verification_code = $2',
      [email, code]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    const user = result.rows[0];

    // Check if code expired
    if (new Date() > new Date(user.verification_code_expires)) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password and clear verification fields
    await pool.query(
      `UPDATE users 
       SET password = $1, verification_code = NULL, verification_code_expires = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [hashedPassword, user.id]
    );

    res.json({
      success: true,
      message: 'Password reset successfully. You can now sign in with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error while resetting password' });
  }
};

// Logout user (update last_login timestamp)
const logout = async (req, res) => {
  try {
    const userId = req.user.id; // From authenticateToken middleware

    // Update last_login timestamp
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [userId]
    );

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Server error during logout' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      firstName,
      middleName,
      lastName,
      email,
      address,
      age,
      gender,
      birthday,
      birthPlace,
      nationality,
      maritalStatus,
      contactNumbers,
      zipCode,
      emergencyContactPerson,
      emergencyContactNumber
    } = req.body;

    // Optional: Email check if changed
    if (email) {
      const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId]);
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ error: 'This email is already in use by another account.' });
      }
    }

    const result = await pool.query(
      `UPDATE users SET
        first_name = $1,
        middle_name = $2,
        last_name = $3,
        email = COALESCE($4, email),
        address = $5,
        age = $6,
        gender = $7,
        birthday = $8,
        birth_place = $9,
        nationality = $10,
        marital_status = $11,
        contact_numbers = $12,
        zip_code = $13,
        emergency_contact_person = $14,
        emergency_contact_number = $15
       WHERE id = $16
       RETURNING *`,
      [
        firstName, middleName, lastName, email, address, age, gender, birthday,
        birthPlace, nationality, maritalStatus, contactNumbers, zipCode,
        emergencyContactPerson, emergencyContactNumber, userId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Only return non-sensitive fields to the client
    const updatedUser = { ...result.rows[0] };
    delete updatedUser.password;
    delete updatedUser.verification_code;

    res.json({ message: 'Profile updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    const result = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid current password' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
};

module.exports = {
  register,
  guestCheckout,
  login,
  logout,
  getProfile,
  verifyEmail,
  resendVerificationCode,
  forgotPassword,
  verifyResetOTP,
  resetPassword,
  updateProfile,
  changePassword,
  uploadProfilePicture,
};
