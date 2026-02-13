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

module.exports = {
  generateVerificationCode,
  sendVerificationEmail,
  generateRandomPassword,
  sendPasswordEmail,
};
