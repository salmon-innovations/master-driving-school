const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { generateVerificationCode, sendVerificationEmail } = require('../utils/emailService');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
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

    // Send verification email
    await sendVerificationEmail(email, verificationCode, firstName);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email for verification code.',
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

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }

    // Check if user exists
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

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

      // Send verification email
      await sendVerificationEmail(user.email, verificationCode, user.first_name);

      return res.status(403).json({ 
        error: 'Email not verified. A new verification code has been sent to your email.',
        needsVerification: true,
        userId: user.id,
        email: user.email
      });
    }

    // Generate token
    const token = generateToken(user.id);

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
      `SELECT id, first_name, middle_name, last_name, email, address, age, gender,
       birthday, birth_place, nationality, marital_status, contact_numbers, zip_code,
       emergency_contact_person, emergency_contact_number, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
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
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error' });
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

    // Generate token
    const token = generateToken(user.id);

    res.json({
      success: true,
      message: 'Email verified successfully',
      token,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
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

    // Send email
    await sendVerificationEmail(user.email, verificationCode, user.first_name);

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

    // Send OTP email
    await sendVerificationEmail(user.email, resetCode, user.first_name, 'Password Reset');

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

module.exports = {
  register,
  login,
  getProfile,
  verifyEmail,
  resendVerificationCode,
  forgotPassword,
  verifyResetOTP,
  resetPassword,
};
