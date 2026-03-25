const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// ============================================================
//  EMAIL CONTENT — loaded from config/emailContent.json
//  Edit text via the admin Configuration → Email Content tab.
//  The JSON file is the single source of truth; functions below
//  wrap template strings (use {placeholder} syntax) so the
//  rest of the sending code stays unchanged.
// ============================================================

const EMAIL_CONTENT_PATH = path.join(__dirname, '../config/emailContent.json');

// Replace {key} placeholders in a template string with values from a vars object
const interp = (tpl, vars) =>
  String(tpl || '').replace(/\{(\w+)\}/g, (_, k) => vars[k] !== undefined ? String(vars[k]) : '');

// Convert raw JSON data (all plain strings/arrays) → EMAIL_CONTENT object with function fields
const buildEmailContent = (d) => ({
  ...d,
  walkIn:  { ...d.walkIn,  greeting: (f, l) => interp(d.walkIn.greeting,  { first: f, last: l }) },
  guest:   { ...d.guest,   greeting: (f, l) => interp(d.guest.greeting,   { first: f, last: l }) },
  noShow:  {
    ...d.noShow,
    greeting: (f, l)           => interp(d.noShow.greeting, { first: f, last: l }),
    intro:    (cn, dt, se)     => interp(d.noShow.intro,    { courseName: cn, date: dt, session: se }),
  },
  receipt: {
    ...d.receipt,
    greeting:    (f, l)  => interp(d.receipt.greeting,    { first: f, last: l }),
    pdfNote:     (fn)    => interp(d.receipt.pdfNote,     { filename: fn }),
    balanceNote: (amt)   => interp(d.receipt.balanceNote, { amount: Number(amt).toLocaleString() }),
  },
  news: { ...d.news, greeting: (first) => interp(d.news.greeting, { first: first || 'Student' }) },
});

// Load content from JSON; re-reads on each call so admin changes take effect immediately
const loadEmailContentData = () => {
  try {
    return JSON.parse(fs.readFileSync(EMAIL_CONTENT_PATH, 'utf8'));
  } catch (e) {
    console.warn('[emailService] emailContent.json not found or invalid, using built-in defaults');
    return null;
  }
};

// Module-level mutable variable; rebuilt by reloadEmailContent() after admin saves
let EMAIL_CONTENT = (() => {
  const data = loadEmailContentData();
  return data ? buildEmailContent(data) : buildEmailContent({
  schoolName: 'Master Driving School',
  copyrightYear: '2026',
  footerTagline: 'If you have any questions, please contact our support team.',
  verification: {
    subjectVerify: 'Email Verification - Master Driving School',
    subjectReset: 'Password Reset OTP - Master Driving School',
    titleVerify: 'Email Verification',
    titleReset: 'Password Reset',
    messageVerify: 'Thank you for registering with Master Driving School. Please use the following verification code to complete your registration:',
    messageReset: 'You requested to reset your password. Please use the following OTP to proceed:',
    expiry: 'This code will expire in 10 minutes.',
    notRequested: "If you didn't request this code, please ignore this email.",
  },
  newAccount: {
    subject: 'Account Created - Master Driving School',
    headerTitle: 'Welcome to the Team!',
    credentialsHeading: 'Your Login Credentials',
    passwordRevealHint: 'Click the password above to reveal it',
    securityHeading: '⚠️ Important Security Notice:',
    securityPoints: [
      'Please change your password after your first login',
      'Do not share your password with anyone',
      'Keep this email secure or delete it after changing your password',
    ],
    loginPrompt: 'You can now log in to the system using the credentials provided above.',
    loginButtonText: 'Go to Login Page',
    unexpectedFooter: "If you didn't expect this email, please contact our support team immediately.",
  },
  walkIn: {
    subject: 'Walk-In Enrollment Confirmation - Master Driving School',
    headerSubtitle: 'Walk-In Enrollment Confirmation',
    greeting: 'Hello {first} {last}!',
    intro: 'Your walk-in enrollment has been successfully processed. Below are your enrollment details and login credentials.',
    scheduleHeading: '📅 Your Training Schedule',
    detailsHeading: '📋 Enrollment Details',
    credentialsHeading: '🔐 Your Login Credentials',
    credentialsIntro: 'An account has been created for you. Use the credentials below to log in and manage your enrollment.',
    passwordWarning: '⚠️ Important: Please change your password after your first login for security reasons.',
    verifyHeading: '📧 Verify Your Email',
    verifyIntro: 'To activate your account, please verify your email using the code below:',
    verifyExpiry: 'This code will expire in 10 minutes. You can request a new code from the login page.',
    verifyButtonText: 'Verify Email & Activate Account',
    footerTagline: 'If you have any questions, please contact our support team.',
  },
  guest: {
    subject: 'Enrollment Confirmation - Master Driving School',
    headerSubtitle: 'Enrollment Confirmation',
    greeting: 'Hello {first} {last}!',
    intro: 'Your enrollment has been successfully processed. Below are your enrollment details and schedule information.',
    scheduleHeading: '📅 Your Training Schedule',
    detailsHeading: '📋 Enrollment Details',
    thankYou: 'Thank you for choosing Master Driving School!',
    footerTagline: 'If you have any questions, please contact our support team.',
  },
  noShow: {
    subject: 'Action Required: Missed Training Session - Master Driving School',
    headerSubtitle: 'Missed Session Notice',
    greeting: 'Hello {first} {last},',
    intro: 'We noticed that you did not attend your scheduled training session for <strong>{courseName}</strong> on <strong>{date}</strong> ({session}).',
    feeHeading: 'Rescheduling Fee Required',
    feeNote: 'As per our Cancellation and Refund Policy (Section 3), a rescheduling fee of <b>₱1,000.00</b> is required for unattended sessions before you can re-book.',
    howToHeading: 'How to Reschedule:',
    howToSteps: [
      'Log in to your student portal.',
      'Settle the ₱1,000 rescheduling fee.',
      'Select a new training date from the available schedules.',
    ],
    loginButtonText: 'Log In to Reschedule',
  },
  receipt: {
    subjectFull: 'Full Payment Receipt - Master Driving School',
    subjectDown: 'Downpayment Receipt & Balance Reminder - Master Driving School',
    headerFull: '✅ Full Payment Receipt',
    headerDown: '🧾 Downpayment Receipt',
    greeting: 'Hello {first} {last}!',
    introFull: 'Your full payment has been received and confirmed. Here is your official receipt.',
    introDown: 'Your downpayment has been received. Please see your balance details and how to settle it below.',
    pdfNote: '📎 A <strong>PDF copy</strong> of your receipt is attached to this email (<strong>{filename}</strong>). Please save it for your records.',
    detailsHeading: '📋 Payment Details',
    paidInFull: 'PAID IN FULL ✅',
    amountPaid: 'AMOUNT PAID',
    balanceHeading: '⚠️ Remaining Balance to Pay',
    balanceNote: 'To complete your enrollment, please settle your remaining balance of <strong>₱{amount}</strong>.',
    balanceStepsHeading: 'How to Pay Your Remaining Balance:',
    balanceSteps: [
      'Log in to your student account on our website',
      'Go to <strong>My Profile → Course History</strong>',
      'Click <strong>"Pay Balance Online"</strong> on your enrollment',
      'Choose your preferred payment method (GCash, Cash)',
      'Or pay in person at the branch on your first day of class',
    ],
    successBadge: '🎉',
    successHeading: 'Payment Complete!',
    successNote: 'Your enrollment is fully paid. See you on your training date!',
    viewAccountButton: 'View My Account',
    footerTagline: 'If you have any questions, contact our support team.',
  },
  downpaymentReminder: {
    heading: '💳 Remaining Balance Reminder:',
    note: 'Since your payment type is <strong>Downpayment</strong>, please note that you must settle your remaining balance when you go to the branch on the <strong>first or second day</strong> of your class.',
  },
  vehicleRental: {
    heading: 'ℹ️ Vehicle Rental Requirement:',
    b1b2Note: "For Practical Driving Course (PDC) - B1/B2, students are required to rent their own VAN or L300 for the course instead of using the school's vehicle because we only have one unit for all branches.",
    tricycleNote: "For Practical Driving Course (PDC) - A1 TRICYCLE, students are required to rent their own Tricycle for the course instead of using the school's vehicle because we only have one unit for all branches.",
  },
  requirements: {
    heading: '📌 Requirements to Bring on Your Schedule Date:',
    tdc: [
      'Ball Pen or Pencil',
      'Be timely and attend all 15 hours (split over sessions/days as scheduled)',
      'Valid Government-issued ID (for verification)',
      'Proof of Payment (You can use this email as your official receipt)',
    ],
    pdc: [
      'Valid Government-issued ID (original + photocopy)',
      '2x2 ID Picture (2 copies, white background)',
      'PSA Birth Certificate (original + photocopy)',
      'Medical Certificate (from any clinic)',
      'Proof of Payment (You can use this email as your official receipt)',
      'Student Permit (if applicable)',
    ],
  },
  terms: {
    heading: '📜 Terms and Conditions',
    items: [
      'Students must arrive at least 30 minutes before their scheduled session.',
      'Rescheduling must be done at least 24 hours before the scheduled date.',
      'No-show on the scheduled date may result in forfeiture of the session.',
      "Refunds are subject to the school's refund policy (processing fee may apply).",
      'Students must bring all required documents on the training date.',
      'The school reserves the right to reschedule sessions due to unforeseen circumstances.',
      'Students must follow all safety guidelines and instructions during training.',
      'Completion certificates will be issued only after fulfilling all course requirements.',
      'Personal belongings are the responsibility of the student during training.',
      'By enrolling or creating an account, you agree to receive News, Events, and Promotional emails from Master Driving School.',
      'By enrolling, you agree to abide by all rules and regulations of Master Driving School.',
    ],
  },
  news: {
    headerSubtitle: 'New Announcement & Update',
    greeting: 'Hi {first},',
    intro: 'We have a new update for you from Master Driving School!',
    visitButton: 'Visit Our Website',
    unsubNote: 'You received this email because you enrolled or created an account at Master Driving School.',
  },
  pdf: {
    schoolName: 'MASTER DRIVING SCHOOL',
    titleFull: 'Full Payment Receipt',
    titleDown: 'Downpayment Receipt',
    receiptTitle: 'OFFICIAL RECEIPT',
    footerLine1: 'Master Driving School  •  This is an official receipt',
    footerLine2: 'Keep this receipt for your records. Thank you for choosing Master Driving School!',
    balanceNote: 'Please settle this balance on or before your first day of class.',
  },
  });
})();

// Called by the admin API after saving emailContent.json to hot-reload without restart
const reloadEmailContent = () => {
  const data = loadEmailContentData();
  if (data) {
    EMAIL_CONTENT = buildEmailContent(data);
    console.log('[emailService] EMAIL_CONTENT reloaded from disk');
    return true;
  }
  return false;
};
// ============================================================
//  END OF EMAIL CONTENT CONFIGURATION
// ============================================================

// Generate PDF receipt buffer
const generateReceiptPDF = (firstName, lastName, receiptData) => {
  return new Promise((resolve, reject) => {
    const {
      bookingId, transactionId, courseName, amountPaid,
      coursePrice, paymentMethod, paymentDate, isFullPayment, balanceDue,
    } = receiptData;

    const doc = new PDFDocument({ size: 'A5', margin: 40 });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const formattedDate = paymentDate
      ? new Date(paymentDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // Header bar
    doc.rect(0, 0, doc.page.width, 70).fill('#1a4fba');
    doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold')
      .text(EMAIL_CONTENT.pdf.schoolName, 40, 18, { align: 'center' });
    doc.fontSize(11).font('Helvetica')
      .text(isFullPayment ? EMAIL_CONTENT.pdf.titleFull : EMAIL_CONTENT.pdf.titleDown, 40, 42, { align: 'center' });

    // Receipt title
    doc.fillColor('#1a4fba').fontSize(13).font('Helvetica-Bold')
      .text(EMAIL_CONTENT.pdf.receiptTitle, 40, 88, { align: 'center' });

    // Divider
    doc.moveTo(40, 108).lineTo(doc.page.width - 40, 108).strokeColor('#e5e7eb').stroke();

    // Details
    const rows = [
      ['Transaction ID', transactionId],
      ['Booking ID', `BK-${String(bookingId).padStart(3, '0')}`],
      ['Course', courseName],
      ['Course Price', `PHP ${Number(coursePrice).toLocaleString()}`],
      ['Date', formattedDate],
      ['Payment Method', paymentMethod],
      ['Amount Paid', `PHP ${Number(amountPaid).toLocaleString()}`],
    ];

    let y = 118;
    rows.forEach(([label, value], i) => {
      if (i % 2 === 0) doc.rect(40, y, doc.page.width - 80, 22).fill('#f9fafb');
      doc.fillColor('#6b7280').fontSize(9).font('Helvetica').text(label, 48, y + 7);
      doc.fillColor('#111827').fontSize(9).font('Helvetica-Bold').text(value, 200, y + 7, { align: 'right', width: doc.page.width - 250 });
      y += 22;
    });

    // Total row
    doc.rect(40, y, doc.page.width - 80, 28).fill(isFullPayment ? '#dcfce7' : '#fff7ed');
    doc.fillColor(isFullPayment ? '#15803d' : '#c2410c').fontSize(11).font('Helvetica-Bold')
      .text(isFullPayment ? 'PAID IN FULL ✓' : 'AMOUNT PAID', 48, y + 8);
    doc.text(`PHP ${Number(amountPaid).toLocaleString()}`, 200, y + 8, { align: 'right', width: doc.page.width - 250 });
    y += 38;

    // Balance box (downpayment only)
    if (!isFullPayment && balanceDue > 0) {
      doc.rect(40, y, doc.page.width - 80, 52).fill('#fff7ed').stroke('#fb923c');
      doc.fillColor('#c2410c').fontSize(10).font('Helvetica-Bold').text('REMAINING BALANCE DUE', 48, y + 8);
      doc.fillColor('#ea580c').fontSize(16).font('Helvetica-Bold')
        .text(`PHP ${Number(balanceDue).toLocaleString()}`, 48, y + 24);
      doc.fillColor('#9a3412').fontSize(8).font('Helvetica')
        .text(EMAIL_CONTENT.pdf.balanceNote, 48, y + 42, { width: doc.page.width - 100 });
      y += 62;
    }

    // Footer
    y = Math.max(y + 10, doc.page.height - 70);
    doc.moveTo(40, y).lineTo(doc.page.width - 40, y).strokeColor('#e5e7eb').stroke();
    doc.fillColor('#9ca3af').fontSize(8).font('Helvetica')
      .text(EMAIL_CONTENT.pdf.footerLine1, 40, y + 8, { align: 'center' })
      .text(EMAIL_CONTENT.pdf.footerLine2, 40, y + 20, { align: 'center' });

    doc.end();
  });
};

// Create email transporter
const createTransporter = () => {
  const rawService = String(process.env.EMAIL_SERVICE || '').toLowerCase().trim();
  const useResend = rawService === 'resend' || !!process.env.RESEND_API_KEY;

  // Resend SMTP defaults: host=smtp.resend.com, user=resend, pass=<RESEND_API_KEY>
  if (useResend) {
    const port = parseInt(process.env.EMAIL_PORT || '465', 10);
    const secure = process.env.EMAIL_SECURE
      ? process.env.EMAIL_SECURE === 'true'
      : port === 465;

    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.resend.com',
      port,
      secure,
      auth: {
        user: process.env.EMAIL_USER || 'resend',
        pass: process.env.RESEND_API_KEY || process.env.EMAIL_PASSWORD,
      },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  const port = parseInt(process.env.EMAIL_PORT || '587', 10);
  const secure = process.env.EMAIL_SECURE === 'true' || port === 465;

  return nodemailer.createTransport({
    // Gmail/default SMTP fallback.
    service: process.env.EMAIL_SERVICE || 'gmail',
    host: process.env.EMAIL_HOST || undefined,
    port,
    secure,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    tls: {
      rejectUnauthorized: false
    }
  });
};

const isResendMode = () => {
  const rawService = String(process.env.EMAIL_SERVICE || '').toLowerCase().trim();
  return rawService === 'resend' || !!process.env.RESEND_API_KEY;
};

const createStrictResendTransporter = () => {
  return nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: {
      user: 'resend',
      pass: process.env.RESEND_API_KEY,
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    tls: {
      rejectUnauthorized: false,
    },
  });
};

const sendMailWithFallback = async (transporter, mailOptions) => {
  try {
    return await transporter.sendMail(mailOptions);
  } catch (error) {
    if (isResendMode() && process.env.RESEND_API_KEY) {
      console.warn('[emailService] Primary send failed; retrying with strict Resend SMTP defaults:', error.message);
      const strictResendTransporter = createStrictResendTransporter();
      return strictResendTransporter.sendMail(mailOptions);
    }
    throw error;
  }
};

// Resolve a valid From address. Prevent placeholder values from breaking SMTP/API delivery.
const getFromAddress = () => {
  const configuredFrom = String(process.env.EMAIL_FROM || '').trim();

  if (configuredFrom && !/your-verified-domain/i.test(configuredFrom)) {
    return configuredFrom;
  }

  console.warn('[emailService] EMAIL_FROM is missing or uses placeholder value; falling back to onboarding sender');
  return 'Master Driving School <onboarding@resend.dev>';
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
      ? EMAIL_CONTENT.verification.subjectReset
      : EMAIL_CONTENT.verification.subjectVerify;

    const title = isPasswordReset ? EMAIL_CONTENT.verification.titleReset : EMAIL_CONTENT.verification.titleVerify;
    const message = isPasswordReset
      ? EMAIL_CONTENT.verification.messageReset
      : EMAIL_CONTENT.verification.messageVerify;

    const mailOptions = {
      from: getFromAddress(),
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
              <h1>${EMAIL_CONTENT.schoolName}</h1>
              <h2>${title}</h2>
            </div>
            <div class="content">
              <h2>Hello ${firstName}!</h2>
              <p>${message}</p>
              <div class="code">${code}</div>
              <p>${EMAIL_CONTENT.verification.expiry}</p>
              <p>${EMAIL_CONTENT.verification.notRequested}</p>
            </div>
            <div class="footer">
              <p>&copy; ${EMAIL_CONTENT.copyrightYear} ${EMAIL_CONTENT.schoolName}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hello ${firstName}!\n\nYour ${isPasswordReset ? 'OTP' : 'verification code'} is: ${code}\n\n${EMAIL_CONTENT.verification.expiry}\n\n${EMAIL_CONTENT.verification.notRequested}\n\n${EMAIL_CONTENT.schoolName}`,

    };

    const info = await sendMailWithFallback(transporter, mailOptions);
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
      from: getFromAddress(),
      to: email,
      subject: EMAIL_CONTENT.newAccount.subject,
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
              <h1>${EMAIL_CONTENT.schoolName}</h1>
              <h2>${EMAIL_CONTENT.newAccount.headerTitle}</h2>
            </div>
            <div class="content">
              <h2>Hello ${firstName}!</h2>
              <p>Your ${role.charAt(0).toUpperCase() + role.slice(1)} account has been successfully created.</p>
              
              <div class="credentials">
                <h3 style="margin-top: 0; color: #2157da;">${EMAIL_CONTENT.newAccount.credentialsHeading}</h3>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Password:</strong></p>
                <div class="password-box" id="password" onclick="this.style.color='#2157da'; this.textContent='${password}'" style="color: transparent; text-shadow: 0 0 8px rgba(33, 87, 218, 0.5); cursor: pointer;">${password}</div>
                <p style="font-size: 12px; color: #666; margin-top: 10px;">
                  <em>${EMAIL_CONTENT.newAccount.passwordRevealHint}</em>
                </p>
              </div>
              
              <div class="warning">
                <strong>${EMAIL_CONTENT.newAccount.securityHeading}</strong>
                <ul style="margin: 10px 0;">
                  ${EMAIL_CONTENT.newAccount.securityPoints.map(p => `<li>${p}</li>`).join('\n                  ')}
                </ul>
              </div>
              
              <p>${EMAIL_CONTENT.newAccount.loginPrompt}</p>
              
              <p style="text-align: center;">
                <a href="${EMAIL_CONTENT.newAccount.buttonUrl || process.env.FRONTEND_URL + '/signin' || 'http://localhost:5173/signin'}" class="btn" style="display: inline-block; padding: 12px 24px; background-color: #2157da; color: #ffffff !important; text-decoration: none; border-radius: 5px; margin-top: 15px; font-weight: bold;">${EMAIL_CONTENT.newAccount.loginButtonText}</a>
              </p>
            </div>
            <div class="footer">
              <p>&copy; ${EMAIL_CONTENT.copyrightYear} ${EMAIL_CONTENT.schoolName}. All rights reserved.</p>
              <p>${EMAIL_CONTENT.newAccount.unexpectedFooter}</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hello ${firstName}!\n\nYour ${role.charAt(0).toUpperCase() + role.slice(1)} account has been successfully created.\n\nYour Login Credentials:\nEmail: ${email}\nPassword: ${password}\n\nIMPORTANT: Please change your password after your first login for security reasons.\n\nMaster Driving School`,
    };

    const info = await sendMailWithFallback(transporter, mailOptions);
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
    const isDownpayment = paymentStatus && paymentStatus.toLowerCase().includes('downpayment');
    const courseNameLower = (courseName || '').toLowerCase();
    const isB1B2 = courseNameLower.includes('b1') || courseNameLower.includes('b2') || courseNameLower.includes('van') || courseNameLower.includes('l300');
    const isTricycle = courseNameLower.includes('a1') || courseNameLower.includes('tricycle');

    const mailOptions = {
      from: getFromAddress(),
      to: email,
      subject: EMAIL_CONTENT.walkIn.subject,
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
            .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f3f4f6; clear: both; overflow: hidden; }
            .detail-row:last-child { border-bottom: none; }
            .detail-label { font-weight: 600; color: #6b7280; font-size: 14px; float: left; width: 40%; }
            .detail-value { font-weight: 600; color: #1f2937; font-size: 14px; float: right; text-align: right; width: 55%; word-wrap: break-word; }
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
              <h1>${EMAIL_CONTENT.schoolName}</h1>
              <h2>${EMAIL_CONTENT.walkIn.headerSubtitle}</h2>
            </div>
            <div class="content">
              <h2 style="margin-top: 0;">${EMAIL_CONTENT.walkIn.greeting(firstName, lastName)}</h2>
              <p>${EMAIL_CONTENT.walkIn.intro}</p>
              
              <div class="schedule-highlight">
                <h3>${EMAIL_CONTENT.walkIn.scheduleHeading}</h3>
                ${effectiveDate2 ? `
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
                <h3>${EMAIL_CONTENT.walkIn.detailsHeading}</h3>
                <div class="detail-row">
                  <span class="detail-label">Course:&nbsp;&nbsp;</span>
                  <span class="detail-value">${courseName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Type:&nbsp;&nbsp;</span>
                  <span class="detail-value">${(courseType || 'N/A').toUpperCase()}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Branch:&nbsp;&nbsp;</span>
                  <span class="detail-value">${branchName}</span>
                </div>
                ${branchAddress ? `<div class="detail-row"><span class="detail-label">Branch Address:&nbsp;&nbsp;</span><span class="detail-value">${branchAddress}</span></div>` : ''}
                <div class="detail-row">
                  <span class="detail-label">Payment Method:&nbsp;&nbsp;</span>
                  <span class="detail-value">${paymentMethod}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Amount Paid:&nbsp;&nbsp;</span>
                  <span class="detail-value">₱${Number(amountPaid).toLocaleString()}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Payment Status:&nbsp;&nbsp;</span>
                  <span class="detail-value">${paymentStatus}</span>
                </div>
              </div>

              ${isDownpayment ? `
              <div class="requirements" style="background: #e0f2fe; border-left: 4px solid #0284c7;">
                <h4 style="color: #0369a1; margin-top: 0;">${EMAIL_CONTENT.downpaymentReminder.heading}</h4>
                <p style="margin: 0; font-size: 14px; color: #0c4a6e;">${EMAIL_CONTENT.downpaymentReminder.note}</p>
              </div>
              ` : ''}

              ${isB1B2 ? `
              <div style="background: #eff6ff; border-left: 4px solid #2157da; padding: 12px 15px; margin: 15px 0; border-radius: 0 8px 8px 0; font-size: 13px;">
                <strong style="color: #1e40af;">${EMAIL_CONTENT.vehicleRental.heading}</strong>
                <p style="margin: 6px 0 0; color: #1e3a8a;">${EMAIL_CONTENT.vehicleRental.b1b2Note}</p>
              </div>
              ` : ''}

              ${isTricycle ? `
              <div style="background: #eff6ff; border-left: 4px solid #2157da; padding: 12px 15px; margin: 15px 0; border-radius: 0 8px 8px 0; font-size: 13px;">
                <strong style="color: #1e40af;">${EMAIL_CONTENT.vehicleRental.heading}</strong>
                <p style="margin: 6px 0 0; color: #1e3a8a;">${EMAIL_CONTENT.vehicleRental.tricycleNote}</p>
              </div>
              ` : ''}

              <div class="credentials">
                <h3>${EMAIL_CONTENT.walkIn.credentialsHeading}</h3>
                <p>${EMAIL_CONTENT.walkIn.credentialsIntro}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Password:</strong></p>
                <div class="password-box">${password}</div>
                <div class="warning">
                  <strong>${EMAIL_CONTENT.walkIn.passwordWarning}</strong>
                </div>
              </div>

              <div style="background: white; border: 2px solid #1a4fba; border-radius: 10px; padding: 20px; margin: 20px 0; text-align: center;">
                <h3 style="color: #1a4fba; margin-top: 0;">${EMAIL_CONTENT.walkIn.verifyHeading}</h3>
                <p>${EMAIL_CONTENT.walkIn.verifyIntro}</p>
                <div class="verification-code">${verificationCode}</div>
                <p style="font-size: 13px; color: #6b7280;">${EMAIL_CONTENT.walkIn.verifyExpiry}</p>
              </div>

              <div class="requirements">
                <h4>${EMAIL_CONTENT.requirements.heading}</h4>
                <ul>
                  ${(isTDC ? EMAIL_CONTENT.requirements.tdc : EMAIL_CONTENT.requirements.pdc).map(item => `<li>${item}</li>`).join('\n                  ')}
                </ul>
              </div>

              <div class="terms">
                <h4>${EMAIL_CONTENT.terms.heading}</h4>
                <ol>
                  ${EMAIL_CONTENT.terms.items.map(item => `<li>${item}</li>`).join('\n                  ')}
                </ol>
              </div>

              <p style="text-align: center; margin-top: 25px;">
                <a href="${EMAIL_CONTENT.walkIn.buttonUrl || process.env.FRONTEND_URL + '/verify-email?email=' + encodeURIComponent(email) || 'http://localhost:5173/verify-email?email=' + encodeURIComponent(email)}" class="btn">${EMAIL_CONTENT.walkIn.verifyButtonText}</a>
              </p>
            </div>
            <div class="footer">
              <p>&copy; ${EMAIL_CONTENT.copyrightYear} ${EMAIL_CONTENT.schoolName}. All rights reserved.</p>
              <p>${EMAIL_CONTENT.walkIn.footerTagline}</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hello ${firstName} ${lastName}!\n\nYour walk-in enrollment has been successfully processed.\n\nSchedule Day 1: ${formattedDate}\nSession: ${scheduleSession}\nTime: ${scheduleTime}\n${effectiveDate2 ? `\nSchedule Day 2: ${effectiveDate2}\nSession: ${effectiveSession2}\nTime: ${effectiveTime2}\n` : ''}Course: ${courseName} (${courseType})\nBranch: ${branchName}\n\nLogin Credentials:\nEmail: ${email}\nPassword: ${password}\n\nVerification Code: ${verificationCode}\n\nPlease verify your email to activate your account.\n\n${isDownpayment ? `REMAINING BALANCE REMINDER: Since your payment type is Downpayment, you must settle your remaining balance when you go to the branch on the first or second day of your class.\n\n` : ''}${isB1B2 ? `VEHICLE RENTAL NOTE: For PDC - B1/B2, students are required to rent their own VAN or L300 for the course instead of using the school's vehicle because we only have one unit for all branches.\n\n` : ''}${isTricycle ? `VEHICLE RENTAL NOTE: For PDC - A1 TRICYCLE, students are required to rent their own Tricycle for the course instead of using the school's vehicle because we only have one unit for all branches.\n\n` : ''}IMPORTANT: Change your password after first login.\n\nMaster Driving School`,
    };

    const info = await sendMailWithFallback(transporter, mailOptions);
    console.log('✅ Walk-in enrollment email sent to:', email);
    console.log('Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Walk-in enrollment email sending failed:', error.message);
    throw error;
  }
};

// Send guest enrollment confirmation without login credentials
const sendGuestEnrollmentEmail = async (email, firstName, lastName, enrollmentDetails, hasReviewer = false, hasVehicleTips = false) => {
  try {
    const transporter = createTransporter();
    const { courseName, courseCategory, courseType, branchName, branchAddress, scheduleDate, scheduleSession, scheduleTime, scheduleDate2, scheduleSession2, scheduleTime2, paymentMethod, amountPaid, paymentStatus } = enrollmentDetails;

    const isTDC = (courseCategory || '').toUpperCase() === 'TDC';
    const formattedDate = formatDisplayDate(scheduleDate);

    // Dynamically fulfill Day 2 for TDC directly, or bind to passed 2nd slots if PDC
    const effectiveDate2 = (isTDC && !scheduleDate2) ? computeTDCDay2(scheduleDate) : formatDisplayDate(scheduleDate2);
    const effectiveSession2 = (isTDC && !scheduleSession2) ? scheduleSession : scheduleSession2;
    const effectiveTime2 = (isTDC && !scheduleTime2) ? scheduleTime : scheduleTime2;
    const isDownpayment = paymentStatus && paymentStatus.toLowerCase().includes('downpayment');
    const courseNameLower = (courseName || '').toLowerCase();
    const isB1B2 = courseNameLower.includes('b1') || courseNameLower.includes('b2') || courseNameLower.includes('van') || courseNameLower.includes('l300');
    const isTricycle = courseNameLower.includes('a1') || courseNameLower.includes('tricycle');

    const path = require('path');
    const attachments = [];
    let items = [];
    if (hasReviewer) {
        items.push('Driving School Reviewer');
        attachments.push({ filename: 'MASTER-TDC-PDC-REVIEWER-AND-GUIDE.pdf', path: path.join(__dirname, 'AddOns', 'MASTER-TDC-PDC-REVIEWER-AND-GUIDE.pdf') });
    }
    if (hasVehicleTips) {
        items.push('Vehicle Maintenance Guide');
        attachments.push({ filename: 'Vehicle-Maintenance-Guide.pdf', path: path.join(__dirname, 'AddOns', 'Vehicle-Maintenance-Guide.pdf') });
    }

    const mailOptions = {
      from: getFromAddress(),
      to: email,
      subject: EMAIL_CONTENT.guest.subject,
      attachments,
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
            .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f3f4f6; clear: both; overflow: hidden; }
            .detail-row:last-child { border-bottom: none; }
            .detail-label { font-weight: 600; color: #6b7280; font-size: 14px; float: left; width: 40%; }
            .detail-value { font-weight: 600; color: #1f2937; font-size: 14px; float: right; text-align: right; width: 55%; word-wrap: break-word; }
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
              <h1>${EMAIL_CONTENT.schoolName}</h1>
              <h2>${EMAIL_CONTENT.guest.headerSubtitle}</h2>
            </div>
            <div class="content">
              <h2 style="margin-top: 0;">${EMAIL_CONTENT.guest.greeting(firstName, lastName)}</h2>
              <p>${EMAIL_CONTENT.guest.intro}</p>
              
              <div class="schedule-highlight">
                <h3>${EMAIL_CONTENT.guest.scheduleHeading}</h3>
                ${effectiveDate2 ? `
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

              
              ${items.length > 0 ? `
              <div class="section" style="background: #e0f2fe; border-left: 4px solid #3b82f6;">
                <h3 style="color: #1e40af; margin-top: 0;">🎁 Your Requested Add-ons</h3>
                <p style="margin: 0 0 10px 0; font-size: 14px;">Thank you for availing our additional review materials! We have attached them directly to this email.</p>
                <ul style="margin: 0; padding-left: 20px; font-weight: bold; color: #1e3a8a;">
                  ${items.map(i => `<li>${i}</li>`).join('')}
                </ul>
              </div>
              ` : ''}

              <div class="section">
                <h3>${EMAIL_CONTENT.guest.detailsHeading}</h3>
                <div class="detail-row">
                  <span class="detail-label">Course:&nbsp;&nbsp;</span>
                  <span class="detail-value">${courseName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Type:&nbsp;&nbsp;</span>
                  <span class="detail-value">${(courseType || 'N/A').toUpperCase()}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Branch:&nbsp;&nbsp;</span>
                  <span class="detail-value">${branchName}</span>
                </div>
                ${branchAddress ? `<div class="detail-row"><span class="detail-label">Branch Address:&nbsp;&nbsp;</span><span class="detail-value">${branchAddress}</span></div>` : ''}
                <div class="detail-row">
                  <span class="detail-label">Payment Method:&nbsp;&nbsp;</span>
                  <span class="detail-value">${paymentMethod}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Amount Paid:&nbsp;&nbsp;</span>
                  <span class="detail-value">₱${Number(amountPaid).toLocaleString()}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Payment Status:&nbsp;&nbsp;</span>
                  <span class="detail-value">${paymentStatus}</span>
                </div>
              </div>

              ${isDownpayment ? `
              <div class="requirements" style="background: #e0f2fe; border-left: 4px solid #0284c7;">
                <h4 style="color: #0369a1; margin-top: 0;">${EMAIL_CONTENT.downpaymentReminder.heading}</h4>
                <p style="margin: 0; font-size: 14px; color: #0c4a6e;">${EMAIL_CONTENT.downpaymentReminder.note}</p>
              </div>
              ` : ''}

              ${isB1B2 ? `
              <div style="background: #eff6ff; border-left: 4px solid #2157da; padding: 12px 15px; margin: 15px 0; border-radius: 0 8px 8px 0; font-size: 13px;">
                <strong style="color: #1e40af;">${EMAIL_CONTENT.vehicleRental.heading}</strong>
                <p style="margin: 6px 0 0; color: #1e3a8a;">${EMAIL_CONTENT.vehicleRental.b1b2Note}</p>
              </div>
              ` : ''}

              ${isTricycle ? `
              <div style="background: #eff6ff; border-left: 4px solid #2157da; padding: 12px 15px; margin: 15px 0; border-radius: 0 8px 8px 0; font-size: 13px;">
                <strong style="color: #1e40af;">${EMAIL_CONTENT.vehicleRental.heading}</strong>
                <p style="margin: 6px 0 0; color: #1e3a8a;">${EMAIL_CONTENT.vehicleRental.tricycleNote}</p>
              </div>
              ` : ''}

              <div class="requirements">
                <h4>${EMAIL_CONTENT.requirements.heading}</h4>
                <ul>
                  ${(isTDC ? EMAIL_CONTENT.requirements.tdc : EMAIL_CONTENT.requirements.pdc).map(item => `<li>${item}</li>`).join('\n                  ')}
                </ul>
              </div>

              <div class="terms">
                <h4>${EMAIL_CONTENT.terms.heading}</h4>
                <ol>
                  ${EMAIL_CONTENT.terms.items.map(item => `<li>${item}</li>`).join('\n                  ')}
                </ol>
              </div>
            </div>
            <div class="footer">
              <p>&copy; ${EMAIL_CONTENT.copyrightYear} ${EMAIL_CONTENT.schoolName}. All rights reserved.</p>
              <p>${EMAIL_CONTENT.guest.footerTagline}</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hello ${firstName} ${lastName}!\n\nYour enrollment has been successfully processed.\n\nSchedule Day 1: ${formattedDate}\nSession: ${scheduleSession}\nTime: ${scheduleTime}\n${effectiveDate2 ? `\nSchedule Day 2: ${effectiveDate2}\nSession: ${effectiveSession2}\nTime: ${effectiveTime2}\n` : ''}Course: ${courseName} (${courseType})\nBranch: ${branchName}\n\n${isDownpayment ? `REMAINING BALANCE REMINDER: Since your payment type is Downpayment, you must settle your remaining balance when you go to the branch on the first or second day of your class.\n\n` : ''}${isB1B2 ? `VEHICLE RENTAL NOTE: For PDC - B1/B2, students are required to rent their own VAN or L300 for the course instead of using the school's vehicle because we only have one unit for all branches.\n\n` : ''}${isTricycle ? `VEHICLE RENTAL NOTE: For PDC - A1 TRICYCLE, students are required to rent their own Tricycle for the course instead of using the school's vehicle because we only have one unit for all branches.\n\n` : ''}Thank you for choosing Master Driving School!`,
    };

    const info = await sendMailWithFallback(transporter, mailOptions);
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
      from: getFromAddress(),
      to: email,
      subject: EMAIL_CONTENT.noShow.subject,
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
              <h1>${EMAIL_CONTENT.schoolName}</h1>
              <h2 style="margin: 5px 0 0; font-size: 16px; font-weight: normal;">${EMAIL_CONTENT.noShow.headerSubtitle}</h2>
            </div>
            <div class="content">
              <h2 style="margin-top: 0;">${EMAIL_CONTENT.noShow.greeting(firstName, lastName)}</h2>
              <p>${EMAIL_CONTENT.noShow.intro(courseName, formattedDate, scheduleSession)}</p>
              
              <div class="fee-box">
                <h3 style="margin-top: 0; color: #991b1b;">${EMAIL_CONTENT.noShow.feeHeading}</h3>
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #7f1d1d;">${EMAIL_CONTENT.noShow.feeNote}</p>
              </div>

              <div class="details">
                <h4 style="margin-top: 0;">${EMAIL_CONTENT.noShow.howToHeading}</h4>
                <ol style="margin-bottom: 0;">
                  ${EMAIL_CONTENT.noShow.howToSteps.map(s => `<li>${s}</li>`).join('\n                  ')}
                </ol>
              </div>
              
              <div style="text-align: center; margin-top: 30px;">
                <a href="" class="btn"></a>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await sendMailWithFallback(transporter, mailOptions);
    console.log('✅ No-show email sent to:', email);
    return true;
  } catch (error) {
    console.error('❌ No-show email sending failed:', error.message);
    throw error;
  }
};

// Send News, Events, or Promos to students
const sendNewsPromoEmail = async (email, firstName, newsTitle, newsDescription, newsType, newsTag) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: getFromAddress(),
      to: email,
      subject: `[${newsType}] ${newsTitle} - ${EMAIL_CONTENT.schoolName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
            .header { background: linear-gradient(135deg, #1a4fba 0%, #3b82f6 100%); color: white; padding: 25px 20px; text-align: center; }
            .content { padding: 30px; background-color: #f9f9f9; }
            .news-box { background: white; border-radius: 8px; padding: 20px; margin: 15px 0; border: 1px solid #e5e7eb; }
            .news-tag { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; background: #e0f2fe; color: #0284c7; margin-bottom: 10px; }
            .news-type { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; }
            .footer { text-align: center; padding: 20px; font-size: 11px; color: #9ca3af; background: #f1f5f9; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${EMAIL_CONTENT.schoolName}</h1>
              <h2 style="margin: 5px 0 0; font-size: 15px; font-weight: normal; opacity: 0.9;">${EMAIL_CONTENT.news.headerSubtitle}</h2>
            </div>
            <div class="content">
              <h2 style="margin-top: 0;">${EMAIL_CONTENT.news.greeting(firstName)}</h2>
              <p>${EMAIL_CONTENT.news.intro}</p>
              
              <div class="news-box">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                   <span class="news-tag">${newsTag}</span>
                   <span class="news-type">${newsType}</span>
                </div>
                <h3 style="color: #1a4fba; margin: 10px 0;">${newsTitle}</h3>
                <p style="white-space: pre-wrap; margin-bottom: 0;">${newsDescription}</p>
              </div>

              <div style="text-align: center; margin-top: 25px;">
                <a href="" style="display: inline-block; padding: 12px 24px; background-color: #1a4fba; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;"></a>
              </div>
            </div>
            <div class="footer">
              <p>${EMAIL_CONTENT.news.unsubNote}</p>
              <p>&copy; ${new Date().getFullYear()} ${EMAIL_CONTENT.schoolName}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await sendMailWithFallback(transporter, mailOptions);
    return true;
  } catch (error) {
    console.error('❌ News promo email sending failed:', error.message);
    throw error; // Handle failures in the batch loop gracefully
  }
};

// Send payment receipt email (downpayment or full payment)
const sendPaymentReceiptEmail = async (email, firstName, lastName, receiptData) => {
  try {
    const transporter = createTransporter();
    const {
      bookingId,
      transactionId,
      courseName,
      amountPaid,
      coursePrice,
      paymentMethod,
      paymentDate,
      isFullPayment,
      balanceDue,
    } = receiptData;

    const formattedDate = paymentDate
      ? new Date(paymentDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const subject = isFullPayment
      ? EMAIL_CONTENT.receipt.subjectFull
      : EMAIL_CONTENT.receipt.subjectDown;

    // Generate PDF attachment
    const pdfBuffer = await generateReceiptPDF(firstName, lastName, receiptData);
    const safeSurname = (lastName || 'Student').replace(/[^a-zA-Z0-9]/g, '_');
    const pdfFilename = `Receipt-${safeSurname}.pdf`;

    const mailOptions = {
      from: getFromAddress(),
      to: email,
      subject,
      attachments: [
        {
          filename: pdfFilename,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
            .header { background: linear-gradient(135deg, #1a4fba 0%, #3b82f6 100%); color: white; padding: 30px 20px; text-align: center; }
            .content { padding: 30px; background: #f9f9f9; }
            .receipt-box { background: white; border-radius: 10px; padding: 24px; margin-bottom: 20px; border: 1px solid #e5e7eb; }
            .receipt-box h3 { color: #1a4fba; margin-top: 0; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
            .details-table { width: 100%; border-collapse: collapse; font-size: 14px; }
            .details-table tr { border-bottom: 1px solid #f3f4f6; }
            .details-table tr:last-child { border-bottom: none; }
            .details-table td { padding: 9px 4px; vertical-align: top; }
            .details-table td.lbl { color: #6b7280; font-weight: 600; width: 48%; padding-right: 12px; }
            .details-table td.val { font-weight: 700; color: #1f2937; width: 52%; }
            .total-row { background: #f0fdf4; border-radius: 8px; padding: 14px 10px; margin-top: 10px; }
            .total-inner { width: 100%; border-collapse: collapse; }
            .total-inner td { vertical-align: middle; }
            .total-label { font-size: 15px; font-weight: 700; color: #15803d; }
            .total-value { font-size: 18px; font-weight: 800; color: #15803d; text-align: right; }
            .balance-box { background: #fff7ed; border: 2px solid #fb923c; border-radius: 10px; padding: 20px; margin: 20px 0; }
            .balance-box h4 { color: #c2410c; margin: 0 0 12px 0; }
            .balance-amount { font-size: 24px; font-weight: 800; color: #ea580c; margin: 8px 0; }
            .steps { background: white; border-radius: 8px; padding: 16px; border: 1px solid #fed7aa; margin-top: 12px; }
            .steps ol { margin: 0; padding-left: 20px; }
            .steps li { padding: 4px 0; font-size: 14px; color: #7c2d12; }
            .success-badge { background: #dcfce7; border: 2px solid #16a34a; border-radius: 10px; padding: 16px; text-align: center; margin: 20px 0; }
            .pdf-note { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #1e40af; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #9ca3af; background: #f1f5f9; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${EMAIL_CONTENT.schoolName}</h1>
              <h2 style="margin:0;font-size:16px;font-weight:400;opacity:.9;">
                ${isFullPayment ? EMAIL_CONTENT.receipt.headerFull : EMAIL_CONTENT.receipt.headerDown}
              </h2>
            </div>
            <div class="content">
              <h2 style="margin-top:0;">${EMAIL_CONTENT.receipt.greeting(firstName, lastName)}</h2>
              <p>
                ${isFullPayment
                  ? EMAIL_CONTENT.receipt.introFull
                  : EMAIL_CONTENT.receipt.introDown}
              </p>

              <div class="pdf-note">
                ${EMAIL_CONTENT.receipt.pdfNote(pdfFilename)}
              </div>

              <div class="receipt-box">
                <h3>${EMAIL_CONTENT.receipt.detailsHeading}</h3>
                <table class="details-table">
                  <tr><td class="lbl">Transaction ID</td><td class="val">${transactionId}</td></tr>
                  <tr><td class="lbl">Booking ID</td><td class="val">BK-${String(bookingId).padStart(3, '0')}</td></tr>
                  <tr><td class="lbl">Course</td><td class="val">${courseName}</td></tr>
                  <tr><td class="lbl">Course Price</td><td class="val">₱${Number(coursePrice).toLocaleString()}</td></tr>
                  <tr><td class="lbl">Date</td><td class="val">${formattedDate}</td></tr>
                  <tr><td class="lbl">Payment Method</td><td class="val">${paymentMethod}</td></tr>
                  <tr><td class="lbl">Amount Paid</td><td class="val" style="color:#16a34a;">₱${Number(amountPaid).toLocaleString()}</td></tr>
                </table>
                <div class="total-row">
                  <table class="total-inner">
                    <tr>
                      <td class="total-label">${isFullPayment ? EMAIL_CONTENT.receipt.paidInFull : EMAIL_CONTENT.receipt.amountPaid}</td>
                      <td class="total-value">₱${Number(amountPaid).toLocaleString()}</td>
                    </tr>
                  </table>
                </div>
              </div>

              ${!isFullPayment && balanceDue > 0 ? `
              <div class="balance-box">
                <h4>${EMAIL_CONTENT.receipt.balanceHeading}</h4>
                <div class="balance-amount">₱${Number(balanceDue).toLocaleString()}</div>
                <p style="margin:0;font-size:14px;color:#9a3412;">${EMAIL_CONTENT.receipt.balanceNote(balanceDue)}</p>
                <div class="steps">
                  <strong style="color:#92400e;">${EMAIL_CONTENT.receipt.balanceStepsHeading}</strong>
                  <ol>
                    ${EMAIL_CONTENT.receipt.balanceSteps.map(s => `<li>${s}</li>`).join('\n                    ')}
                  </ol>
                </div>
              </div>
              ` : ''}

              ${isFullPayment ? `
              <div class="success-badge">
                <div style="font-size:32px;margin-bottom:8px;">${EMAIL_CONTENT.receipt.successBadge}</div>
                <h3 style="color:#15803d;margin:0 0 6px 0;">${EMAIL_CONTENT.receipt.successHeading}</h3>
                <p style="margin:0;font-size:14px;color:#166534;">${EMAIL_CONTENT.receipt.successNote}</p>
              </div>
              ` : ''}

              <p style="text-align:center;margin-top:20px;">
                <a href=""
                   style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#1a4fba,#3b82f6);color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">
                  ${EMAIL_CONTENT.receipt.viewAccountButton}
                </a>
              </p>
            </div>
            <div class="footer">
              <p>&copy; ${EMAIL_CONTENT.copyrightYear} ${EMAIL_CONTENT.schoolName}. All rights reserved.</p>
              <p>${EMAIL_CONTENT.receipt.footerTagline}</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await sendMailWithFallback(transporter, mailOptions);
    console.log(`✅ Payment receipt email sent to: ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Payment receipt email failed:', error.message);
    throw error;
  }
};

const sendAddonsEmail = async (email, firstName, lastName, hasReviewer, hasVehicleTips) => {
  try {
    const transporter = createTransporter();
    const attachments = [];
    let items = [];
    if (hasReviewer) {
      items.push('Driving School Reviewer');
      attachments.push({ filename: 'MASTER-TDC-PDC-REVIEWER-AND-GUIDE.pdf', path: path.join(__dirname, 'AddOns', 'MASTER-TDC-PDC-REVIEWER-AND-GUIDE.pdf') });
    }
    if (hasVehicleTips) {
      items.push('Vehicle Maintenance Guide');
      attachments.push({ filename: 'Vehicle-Maintenance-Guide.pdf', path: path.join(__dirname, 'AddOns', 'Vehicle-Maintenance-Guide.pdf') });
    }
    if (attachments.length === 0) return;
    const mailOptions = { 
      from: getFromAddress(), 
      to: email, 
      subject: 'Your Driving School Add-ons', 
      attachments, 
      html: `<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px;"><div style="max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;"><div style="background: linear-gradient(135deg, #1a4fba 0%, #3b82f6 100%); color: white; padding: 30px 20px; text-align: center;"><h1 style="margin:0;font-size:24px;">Your Add-ons Are Here!</h1></div><div style="padding: 30px; background: #fff;"><p>Hi ${firstName},</p><p>Thank you for availing our additional review materials! We have attached the following requested add-ons to this email:</p><ul>${items.map(i=>'<li><strong>'+i+'</strong></li>').join('')}</ul><p>These guides will greatly help with your driving preparation. If you have any questions, feel free to reach out to us.</p><br><p>Best regards,<br>The MDS Team</p></div></div></body></html>`
    };
    await sendMailWithFallback(transporter, mailOptions);
    console.log('[EmailService] Add-ons sent to:', email);
  } catch (err) { console.error('Addons email error:', err); }
};

const sendTestEmail = async (email, html, subject) => {
  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: getFromAddress(),
      to: email,
      subject: subject || 'Test Email Preview',
      html: html
    };
    await sendMailWithFallback(transporter, mailOptions);
    console.log('[EmailService] Test email sent to:', email);
    return true;
  } catch (err) {
    console.error('Test email error:', err);
    throw err;
  }
};

module.exports = {
  sendTestEmail,
  sendAddonsEmail,
  reloadEmailContent,
  generateVerificationCode,
  sendVerificationEmail,
  generateRandomPassword,
  sendPasswordEmail,
  sendWalkInEnrollmentEmail,
  sendGuestEnrollmentEmail,
  sendNoShowEmail,
  sendNewsPromoEmail,
  sendPaymentReceiptEmail,
};
