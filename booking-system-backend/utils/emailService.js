const nodemailer = require('nodemailer');

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

// Generate 6-digit verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate random password (8 characters with numbers and special characters)
const generateRandomPassword = () => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const specialChars = '!@#$%^&*';

  // Ensure at least one of each type
  let password = '';
  password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
  password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
  password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  password += specialChars.charAt(Math.floor(Math.random() * specialChars.length));

  // Fill remaining 4 characters randomly
  const allChars = uppercase + lowercase + numbers + specialChars;
  for (let i = 0; i < 4; i++) {
    password += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

// Send verification email
const sendVerificationEmail = async (email, code, firstName, type = 'Email Verification') => {
  try {
    const transporter = createTransporter();

    const isPasswordReset = type === 'Password Reset';
    const subject = isPasswordReset
      ? 'Password Reset OTP - Master Driving School'
      : 'Email Verification - Master Driving School';

    const title = isPasswordReset ? 'Password Reset' : 'Email Verification';
    const message = isPasswordReset
      ? 'You requested to reset your password. Please use the following OTP to proceed:'
      : 'Thank you for registering with Master Driving School. Please use the following verification code to complete your registration:';

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2157da; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background-color: #f9f9f9; }
            .code { font-size: 32px; font-weight: bold; color: #2157da; text-align: center; padding: 20px; background-color: #fff; border: 2px dashed #2157da; margin: 20px 0; letter-spacing: 5px; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Master Driving School</h1>
              <h2>${title}</h2>
            </div>
            <div class="content">
              <h2>Hello ${firstName}!</h2>
              <p>${message}</p>
              <div class="code">${code}</div>
              <p>This code will expire in 10 minutes.</p>
              <p>If you didn't request this code, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>&copy; 2026 Master Driving School. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hello ${firstName}!\n\nYour ${isPasswordReset ? 'OTP' : 'verification code'} is: ${code}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this email.\n\nMaster Driving School`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ ${type} email sent to:`, email);
    console.log('Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    console.error('Error details:', error);
    throw error; // Propagate error to see it in registration response
  }
};

// Send password email to new admin/staff user
const sendPasswordEmail = async (email, password, firstName, role) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Account Created - Master Driving School',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2157da; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background-color: #f9f9f9; }
            .credentials { background-color: #fff; border: 2px solid #2157da; padding: 20px; margin: 20px 0; border-radius: 8px; }
            .password-box { font-family: 'Courier New', monospace; font-size: 18px; font-weight: bold; color: #2157da; padding: 12px; background-color: #f0f4ff; border-radius: 5px; margin: 10px 0; user-select: all; }
            .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
            .btn { display: inline-block; padding: 12px 24px; background-color: #2157da; color: #ffffff !important; text-decoration: none; border-radius: 5px; margin-top: 15px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Master Driving School</h1>
              <h2>Welcome to the Team!</h2>
            </div>
            <div class="content">
              <h2>Hello ${firstName}!</h2>
              <p>Your ${role.charAt(0).toUpperCase() + role.slice(1)} account has been successfully created.</p>
              
              <div class="credentials">
                <h3 style="margin-top: 0; color: #2157da;">Your Login Credentials</h3>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Password:</strong></p>
                <div class="password-box" id="password" onclick="this.style.color='#2157da'; this.textContent='${password}'" style="color: transparent; text-shadow: 0 0 8px rgba(33, 87, 218, 0.5); cursor: pointer;">${password}</div>
                <p style="font-size: 12px; color: #666; margin-top: 10px;">
                  <em>Click the password above to reveal it</em>
                </p>
              </div>
              
              <div class="warning">
                <strong>⚠️ Important Security Notice:</strong>
                <ul style="margin: 10px 0;">
                  <li>Please change your password after your first login</li>
                  <li>Do not share your password with anyone</li>
                  <li>Keep this email secure or delete it after changing your password</li>
                </ul>
              </div>
              
              <p>You can now log in to the system using the credentials provided above.</p>
              
              <p style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/signin" class="btn" style="display: inline-block; padding: 12px 24px; background-color: #2157da; color: #ffffff !important; text-decoration: none; border-radius: 5px; margin-top: 15px; font-weight: bold;">Go to Login Page</a>
              </p>
            </div>
            <div class="footer">
              <p>&copy; 2026 Master Driving School. All rights reserved.</p>
              <p>If you didn't expect this email, please contact our support team immediately.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hello ${firstName}!\n\nYour ${role.charAt(0).toUpperCase() + role.slice(1)} account has been successfully created.\n\nYour Login Credentials:\nEmail: ${email}\nPassword: ${password}\n\nIMPORTANT: Please change your password after your first login for security reasons.\n\nMaster Driving School`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Password email sent to:`, email);
    console.log('Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Password email sending failed:', error.message);
    console.error('Error details:', error);
    throw error;
  }
};

// Helper to safely format dates regardless of whether they are YYYY-MM-DD or full ISO strings
const formatDisplayDate = (dateString) => {
  if (!dateString) return null;
  // Strip time/timezone to get absolute YYYY-MM-DD
  const rawDate = typeof dateString === 'string' ? dateString.split('T')[0] : String(dateString).split('T')[0];
  const parts = rawDate.split('-');

  if (parts.length === 3) {
    const [y, m, d] = parts.map(Number);
    // Parse it perfectly at Local noon, avoiding any UTC/midnight shifts
    const safeDateObj = new Date(y, m - 1, d, 12, 0, 0);
    return safeDateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  // Fallback
  return new Date(dateString).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

// Helper to calculate the 2nd day strictly for TDC courses (skips Sundays)
const computeTDCDay2 = (dateString) => {
  if (!dateString) return null;

  const rawDate = typeof dateString === 'string' ? dateString.split('T')[0] : String(dateString).split('T')[0];
  const parts = rawDate.split('-');

  if (parts.length === 3) {
    const [y, m, d] = parts.map(Number);
    const dateObj = new Date(y, m - 1, d, 12, 0, 0);

    // Add 1 day
    dateObj.setDate(dateObj.getDate() + 1);
    // Skip Sunday
    if (dateObj.getDay() === 0) dateObj.setDate(dateObj.getDate() + 1);

    // Return formatted result
    return dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }
  return null;
};

// Send walk-in enrollment confirmation email with schedule, password, and verification code
const sendWalkInEnrollmentEmail = async (email, firstName, lastName, password, verificationCode, enrollmentDetails) => {
  try {
    const transporter = createTransporter();
    const { courseName, courseCategory, courseType, branchName, branchAddress, scheduleDate, scheduleSession, scheduleTime, scheduleDate2, scheduleSession2, scheduleTime2, paymentMethod, amountPaid, paymentStatus } = enrollmentDetails;

    const isTDC = (courseCategory || '').toUpperCase() === 'TDC';
    const formattedDate = formatDisplayDate(scheduleDate);

    // Dynamically fulfill Day 2 for TDC directly, or bind to passed 2nd slots if PDC
    const effectiveDate2 = (isTDC && !scheduleDate2) ? computeTDCDay2(scheduleDate) : formatDisplayDate(scheduleDate2);
    const effectiveSession2 = (isTDC && !scheduleSession2) ? scheduleSession : scheduleSession2;
    const effectiveTime2 = (isTDC && !scheduleTime2) ? scheduleTime : scheduleTime2;

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Walk-In Enrollment Confirmation - Master Driving School',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 0; }
            .header { background: linear-gradient(135deg, #1a4fba 0%, #3b82f6 100%); color: white; padding: 30px 20px; text-align: center; }
            .header h1 { margin: 0 0 5px 0; font-size: 24px; }
            .header h2 { margin: 0; font-size: 16px; font-weight: 400; opacity: 0.9; }
            .content { padding: 30px; background-color: #f9f9f9; }
            .section { background: white; border-radius: 10px; padding: 20px; margin-bottom: 20px; border: 1px solid #e5e7eb; }
            .section h3 { color: #1a4fba; margin-top: 0; font-size: 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
            .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
            .detail-row:last-child { border-bottom: none; }
            .detail-label { font-weight: 600; color: #6b7280; font-size: 14px; }
            .detail-value { font-weight: 600; color: #1f2937; font-size: 14px; }
            .schedule-highlight { background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%); border: 2px solid #3b82f6; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center; }
            .schedule-highlight h3 { color: #1a4fba; margin: 0 0 15px 0; font-size: 18px; }
            .schedule-date { font-size: 22px; font-weight: 800; color: #1e40af; margin: 5px 0; }
            .schedule-session { font-size: 16px; color: #3b82f6; margin: 5px 0; }
            .credentials { background: #fff; border: 2px solid #1a4fba; padding: 20px; margin: 20px 0; border-radius: 10px; }
            .credentials h3 { color: #1a4fba; margin-top: 0; }
            .password-box { font-family: 'Courier New', monospace; font-size: 20px; font-weight: bold; color: #1a4fba; padding: 12px; background-color: #f0f4ff; border-radius: 8px; margin: 10px 0; text-align: center; letter-spacing: 2px; }
            .verification-code { font-size: 32px; font-weight: bold; color: #1a4fba; text-align: center; padding: 15px; background-color: #fff; border: 2px dashed #1a4fba; margin: 15px 0; letter-spacing: 8px; border-radius: 8px; }
            .requirements { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
            .requirements h4 { color: #92400e; margin: 0 0 10px 0; }
            .requirements ul { margin: 0; padding-left: 20px; }
            .requirements li { padding: 4px 0; color: #78350f; font-size: 14px; }
            .terms { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin: 20px 0; font-size: 12px; color: #64748b; }
            .terms h4 { color: #334155; margin-top: 0; font-size: 14px; }
            .terms ol { padding-left: 20px; margin: 10px 0; }
            .terms li { padding: 3px 0; }
            .warning { background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 15px; margin: 15px 0; border-radius: 0 8px 8px 0; font-size: 13px; color: #991b1b; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; background: #f1f5f9; }
            .btn { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #1a4fba 0%, #3b82f6 100%); color: #ffffff !important; text-decoration: none; border-radius: 8px; margin-top: 15px; font-weight: bold; font-size: 16px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Master Driving School</h1>
              <h2>Walk-In Enrollment Confirmation</h2>
            </div>
            <div class="content">
              <h2 style="margin-top: 0;">Hello ${firstName} ${lastName}!</h2>
              <p>Your walk-in enrollment has been successfully processed. Below are your enrollment details and login credentials.</p>
              
              <div class="schedule-highlight">
                <h3>📅 Your Training Schedule</h3>
                ${isTDC && effectiveDate2 ? `
                <div style="margin-bottom: 15px;">
                  <div style="font-size: 12px; font-weight: 800; color: #3b82f6; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Day 1</div>
                  <div class="schedule-date">${formattedDate}</div>
                  <div class="schedule-session">${scheduleSession}</div>
                  <div style="font-size: 14px; color: #6b7280; margin-top: 5px;">${scheduleTime}</div>
                </div>
                <hr style="border: none; border-top: 2px dashed #93c5fd; margin: 15px 0;">
                <div>
                  <div style="font-size: 12px; font-weight: 800; color: #3b82f6; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Day 2</div>
                  <div class="schedule-date">${effectiveDate2}</div>
                  <div class="schedule-session">${effectiveSession2}</div>
                  <div style="font-size: 14px; color: #6b7280; margin-top: 5px;">${effectiveTime2}</div>
                </div>
                ` : `
                <div class="schedule-date">${formattedDate}</div>
                <div class="schedule-session">${scheduleSession}</div>
                <div style="font-size: 14px; color: #6b7280; margin-top: 5px;">${scheduleTime}</div>
                `}
              </div>

              <div class="section">
                <h3>📋 Enrollment Details</h3>
                <div class="detail-row">
                  <span class="detail-label">Course:</span>
                  <span class="detail-value">${courseName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Type:</span>
                  <span class="detail-value">${courseType.toUpperCase()}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Branch:</span>
                  <span class="detail-value">${branchName}</span>
                </div>
                ${branchAddress ? `<div class="detail-row"><span class="detail-label">Branch Address:</span><span class="detail-value">${branchAddress}</span></div>` : ''}
                <div class="detail-row">
                  <span class="detail-label">Payment Method:</span>
                  <span class="detail-value">${paymentMethod}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Amount Paid:</span>
                  <span class="detail-value">₱${Number(amountPaid).toLocaleString()}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Payment Status:</span>
                  <span class="detail-value">${paymentStatus}</span>
                </div>
              </div>

              <div class="credentials">
                <h3>🔐 Your Login Credentials</h3>
                <p>An account has been created for you. Use the credentials below to log in and manage your enrollment.</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Password:</strong></p>
                <div class="password-box">${password}</div>
                <div class="warning">
                  <strong>⚠️ Important:</strong> Please change your password after your first login for security reasons.
                </div>
              </div>

              <div style="background: white; border: 2px solid #1a4fba; border-radius: 10px; padding: 20px; margin: 20px 0; text-align: center;">
                <h3 style="color: #1a4fba; margin-top: 0;">📧 Verify Your Email</h3>
                <p>To activate your account, please verify your email using the code below:</p>
                <div class="verification-code">${verificationCode}</div>
                <p style="font-size: 13px; color: #6b7280;">This code will expire in 10 minutes. You can request a new code from the login page.</p>
              </div>

              <div class="requirements">
                <h4>📌 Requirements to Bring on Your Schedule Date:</h4>
                <ul>
                  ${isTDC ? `
                  <li>Ball Pen or Pencil</li>
                  <li>Be timely and attend all 15 hours (split over sessions/days as scheduled)</li>
                  <li>Valid Government-issued ID (for verification)</li>
                  <li>Proof of Payment / Payment Receipt</li>
                  ` : `
                  <li>Valid Government-issued ID (original + photocopy)</li>
                  <li>2x2 ID Picture (2 copies, white background)</li>
                  <li>PSA Birth Certificate (original + photocopy)</li>
                  <li>Medical Certificate (from any clinic)</li>
                  <li>Proof of Payment / Payment Receipt</li>
                  <li>Student Permit (if applicable)</li>
                  `}
                </ul>
              </div>

              <div class="terms">
                <h4>📜 Terms and Conditions</h4>
                <ol>
                  <li>Students must arrive at least 30 minutes before their scheduled session.</li>
                  <li>Rescheduling must be done at least 24 hours before the scheduled date.</li>
                  <li>No-show on the scheduled date may result in forfeiture of the session.</li>
                  <li>Refunds are subject to the school's refund policy (processing fee may apply).</li>
                  <li>Students must bring all required documents on the training date.</li>
                  <li>The school reserves the right to reschedule sessions due to unforeseen circumstances.</li>
                  <li>Students must follow all safety guidelines and instructions during training.</li>
                  <li>Completion certificates will be issued only after fulfilling all course requirements.</li>
                  <li>Personal belongings are the responsibility of the student during training.</li>
                  <li>By enrolling, you agree to abide by all rules and regulations of Master Driving School.</li>
                </ol>
              </div>

              <p style="text-align: center; margin-top: 25px;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?email=${encodeURIComponent(email)}" class="btn">Verify Email & Activate Account</a>
              </p>
            </div>
            <div class="footer">
              <p>&copy; 2026 Master Driving School. All rights reserved.</p>
              <p>If you have any questions, please contact our support team.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hello ${firstName} ${lastName}!\n\nYour walk-in enrollment has been successfully processed.\n\nSchedule Day 1: ${formattedDate}\nSession: ${scheduleSession}\nTime: ${scheduleTime}\n${effectiveDate2 ? `\nSchedule Day 2: ${effectiveDate2}\nSession: ${effectiveSession2}\nTime: ${effectiveTime2}\n` : ''}Course: ${courseName} (${courseType})\nBranch: ${branchName}\n\nLogin Credentials:\nEmail: ${email}\nPassword: ${password}\n\nVerification Code: ${verificationCode}\n\nPlease verify your email to activate your account.\n\nIMPORTANT: Change your password after first login.\n\nMaster Driving School`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Walk-in enrollment email sent to:', email);
    console.log('Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Walk-in enrollment email sending failed:', error.message);
    throw error;
  }
};

// Send guest enrollment confirmation without login credentials
const sendGuestEnrollmentEmail = async (email, firstName, lastName, enrollmentDetails) => {
  try {
    const transporter = createTransporter();
    const { courseName, courseCategory, courseType, branchName, branchAddress, scheduleDate, scheduleSession, scheduleTime, scheduleDate2, scheduleSession2, scheduleTime2, paymentMethod, amountPaid, paymentStatus } = enrollmentDetails;

    const isTDC = (courseCategory || '').toUpperCase() === 'TDC';
    const formattedDate = formatDisplayDate(scheduleDate);

    // Dynamically fulfill Day 2 for TDC directly, or bind to passed 2nd slots if PDC
    const effectiveDate2 = (isTDC && !scheduleDate2) ? computeTDCDay2(scheduleDate) : formatDisplayDate(scheduleDate2);
    const effectiveSession2 = (isTDC && !scheduleSession2) ? scheduleSession : scheduleSession2;
    const effectiveTime2 = (isTDC && !scheduleTime2) ? scheduleTime : scheduleTime2;

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Enrollment Confirmation - Master Driving School',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 0; }
            .header { background: linear-gradient(135deg, #1a4fba 0%, #3b82f6 100%); color: white; padding: 30px 20px; text-align: center; }
            .header h1 { margin: 0 0 5px 0; font-size: 24px; }
            .header h2 { margin: 0; font-size: 16px; font-weight: 400; opacity: 0.9; }
            .content { padding: 30px; background-color: #f9f9f9; }
            .section { background: white; border-radius: 10px; padding: 20px; margin-bottom: 20px; border: 1px solid #e5e7eb; }
            .section h3 { color: #1a4fba; margin-top: 0; font-size: 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
            .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
            .detail-row:last-child { border-bottom: none; }
            .detail-label { font-weight: 600; color: #6b7280; font-size: 14px; }
            .detail-value { font-weight: 600; color: #1f2937; font-size: 14px; }
            .schedule-highlight { background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%); border: 2px solid #3b82f6; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center; }
            .schedule-highlight h3 { color: #1a4fba; margin: 0 0 15px 0; font-size: 18px; }
            .schedule-date { font-size: 22px; font-weight: 800; color: #1e40af; margin: 5px 0; }
            .schedule-session { font-size: 16px; color: #3b82f6; margin: 5px 0; }
            .requirements { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
            .requirements h4 { color: #92400e; margin: 0 0 10px 0; }
            .requirements ul { margin: 0; padding-left: 20px; }
            .requirements li { padding: 4px 0; color: #78350f; font-size: 14px; }
            .terms { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin: 20px 0; font-size: 12px; color: #64748b; }
            .terms h4 { color: #334155; margin-top: 0; font-size: 14px; }
            .terms ol { padding-left: 20px; margin: 10px 0; }
            .terms li { padding: 3px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; background: #f1f5f9; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Master Driving School</h1>
              <h2>Enrollment Confirmation</h2>
            </div>
            <div class="content">
              <h2 style="margin-top: 0;">Hello ${firstName} ${lastName}!</h2>
              <p>Your enrollment has been successfully processed. Below are your enrollment details and schedule information.</p>
              
              <div class="schedule-highlight">
                <h3>📅 Your Training Schedule</h3>
                ${isTDC && effectiveDate2 ? `
                <div style="margin-bottom: 15px;">
                  <div style="font-size: 12px; font-weight: 800; color: #3b82f6; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Day 1</div>
                  <div class="schedule-date">${formattedDate}</div>
                  <div class="schedule-session">${scheduleSession}</div>
                  <div style="font-size: 14px; color: #6b7280; margin-top: 5px;">${scheduleTime}</div>
                </div>
                <hr style="border: none; border-top: 2px dashed #93c5fd; margin: 15px 0;">
                <div>
                  <div style="font-size: 12px; font-weight: 800; color: #3b82f6; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Day 2</div>
                  <div class="schedule-date">${effectiveDate2}</div>
                  <div class="schedule-session">${effectiveSession2}</div>
                  <div style="font-size: 14px; color: #6b7280; margin-top: 5px;">${effectiveTime2}</div>
                </div>
                ` : `
                <div class="schedule-date">${formattedDate}</div>
                <div class="schedule-session">${scheduleSession}</div>
                <div style="font-size: 14px; color: #6b7280; margin-top: 5px;">${scheduleTime}</div>
                `}
              </div>

              <div class="section">
                <h3>📋 Enrollment Details</h3>
                <div class="detail-row">
                  <span class="detail-label">Course:</span>
                  <span class="detail-value">${courseName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Type:</span>
                  <span class="detail-value">${courseType.toUpperCase()}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Branch:</span>
                  <span class="detail-value">${branchName}</span>
                </div>
                ${branchAddress ? `<div class="detail-row"><span class="detail-label">Branch Address:</span><span class="detail-value">${branchAddress}</span></div>` : ''}
                <div class="detail-row">
                  <span class="detail-label">Payment Method:</span>
                  <span class="detail-value">${paymentMethod}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Amount Paid:</span>
                  <span class="detail-value">₱${Number(amountPaid).toLocaleString()}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Payment Status:</span>
                  <span class="detail-value">${paymentStatus}</span>
                </div>
              </div>

              <div class="requirements">
                <h4>📌 Requirements to Bring on Your Schedule Date:</h4>
                <ul>
                  ${isTDC ? `
                  <li>Ball Pen or Pencil</li>
                  <li>Be timely and attend all 15 hours (split over sessions/days as scheduled)</li>
                  <li>Valid Government-issued ID (for verification)</li>
                  <li>Proof of Payment / Payment Receipt</li>
                  ` : `
                  <li>Valid Government-issued ID (original + photocopy)</li>
                  <li>2x2 ID Picture (2 copies, white background)</li>
                  <li>PSA Birth Certificate (original + photocopy)</li>
                  <li>Medical Certificate (from any clinic)</li>
                  <li>Proof of Payment / Payment Receipt</li>
                  <li>Student Permit (if applicable)</li>
                  `}
                </ul>
              </div>

              <div class="terms">
                <h4>📜 Terms and Conditions</h4>
                <ol>
                  <li>Students must arrive at least 30 minutes before their scheduled session.</li>
                  <li>Rescheduling must be done at least 24 hours before the scheduled date.</li>
                  <li>No-show on the scheduled date may result in forfeiture of the session.</li>
                  <li>Refunds are subject to the school's refund policy (processing fee may apply).</li>
                  <li>Students must bring all required documents on the training date.</li>
                  <li>The school reserves the right to reschedule sessions due to unforeseen circumstances.</li>
                  <li>Students must follow all safety guidelines and instructions during training.</li>
                  <li>Completion certificates will be issued only after fulfilling all course requirements.</li>
                  <li>Personal belongings are the responsibility of the student during training.</li>
                  <li>By enrolling, you agree to abide by all rules and regulations of Master Driving School.</li>
                </ol>
              </div>
            </div>
            <div class="footer">
              <p>&copy; 2026 Master Driving School. All rights reserved.</p>
              <p>If you have any questions, please contact our support team.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hello ${firstName} ${lastName}!\n\nYour enrollment has been successfully processed.\n\nSchedule Day 1: ${formattedDate}\nSession: ${scheduleSession}\nTime: ${scheduleTime}\n${effectiveDate2 ? `\nSchedule Day 2: ${effectiveDate2}\nSession: ${effectiveSession2}\nTime: ${effectiveTime2}\n` : ''}Course: ${courseName} (${courseType})\nBranch: ${branchName}\n\nThank you for choosing Master Driving School!`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Guest enrollment email sent to:', email);
    console.log('Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Guest enrollment email sending failed:', error.message);
    throw error;
  }
};

// Send No-Show Email for Unattended Sessions
const sendNoShowEmail = async (email, firstName, lastName, enrollmentDetails) => {
  try {
    const transporter = createTransporter();
    const { courseName, scheduleDate, scheduleSession } = enrollmentDetails;
    const formattedDate = formatDisplayDate(scheduleDate);

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Action Required: Missed Training Session - Master Driving School',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
            .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px 20px; text-align: center; }
            .content { padding: 30px; background-color: #f9f9f9; }
            .fee-box { background: #fee2e2; border: 2px solid #ef4444; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
            .fee-amount { font-size: 24px; font-weight: bold; color: #b91c1c; margin: 10px 0; }
            .details { background: white; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 20px; }
            .btn { display: inline-block; padding: 12px 24px; background-color: #ef4444; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">Master Driving School</h1>
              <h2 style="margin: 5px 0 0; font-size: 16px; font-weight: normal;">Missed Session Notice</h2>
            </div>
            <div class="content">
              <h2 style="margin-top: 0;">Hello ${firstName} ${lastName},</h2>
              <p>We noticed that you did not attend your scheduled training session for <strong>${courseName}</strong> on <strong>${formattedDate}</strong> (${scheduleSession}).</p>
              
              <div class="fee-box">
                <h3 style="margin-top: 0; color: #991b1b;">Rescheduling Fee Required</h3>
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #7f1d1d;">As per our Cancellation and Refund Policy (Section 3), a rescheduling fee of <b>₱1,000.00</b> is required for unattended sessions before you can re-book.</p>
              </div>

              <div class="details">
                <h4 style="margin-top: 0;">How to Reschedule:</h4>
                <ol style="margin-bottom: 0;">
                  <li>Log in to your student portal.</li>
                  <li>Settle the ₱1,000 rescheduling fee.</li>
                  <li>Select a new training date from the available schedules.</li>
                </ol>
              </div>
              
              <div style="text-align: center; margin-top: 30px;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" class="btn">Log In to Reschedule</a>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ No-show email sent to:', email);
    return true;
  } catch (error) {
    console.error('❌ No-show email sending failed:', error.message);
    throw error;
  }
};

module.exports = {
  generateVerificationCode,
  sendVerificationEmail,
  generateRandomPassword,
  sendPasswordEmail,
  sendWalkInEnrollmentEmail,
  sendGuestEnrollmentEmail,
  sendNoShowEmail
};
