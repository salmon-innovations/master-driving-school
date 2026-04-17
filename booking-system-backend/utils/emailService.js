const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');

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
    feeNote: 'As per our Cancellation and Refund Policy (Section 3), a rescheduling fee of <b>₱{fee}</b> is required for unattended sessions before you can re-book.',
    howToHeading: 'How to Reschedule:',
    howToSteps: [
      'Log in to your student portal.',
      'Settle the ₱{fee} rescheduling fee.',
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
    const paidAmt = Math.max(0, Number(amountPaid || 0));
    const courseAmt = Math.max(0, Number(coursePrice || 0));
    const dueAmt = Math.max(0, Number(balanceDue || 0));
    const resolvedIsFullPayment = Boolean(isFullPayment) && dueAmt <= 0.009;
    const settledTotalAmt = resolvedIsFullPayment ? Math.max(courseAmt, paidAmt) : paidAmt;

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
      .text(resolvedIsFullPayment ? EMAIL_CONTENT.pdf.titleFull : EMAIL_CONTENT.pdf.titleDown, 40, 42, { align: 'center' });

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
    doc.rect(40, y, doc.page.width - 80, 28).fill(resolvedIsFullPayment ? '#dcfce7' : '#fff7ed');
    doc.fillColor(resolvedIsFullPayment ? '#15803d' : '#c2410c').fontSize(11).font('Helvetica-Bold')
      .text(resolvedIsFullPayment ? 'PAID IN FULL ✓' : 'AMOUNT PAID', 48, y + 8);
    doc.text(`PHP ${Number(settledTotalAmt).toLocaleString()}`, 200, y + 8, { align: 'right', width: doc.page.width - 250 });
    y += 38;

    // Balance box (downpayment only)
    if (!resolvedIsFullPayment && dueAmt > 0) {
      doc.rect(40, y, doc.page.width - 80, 52).fill('#fff7ed').stroke('#fb923c');
      doc.fillColor('#c2410c').fontSize(10).font('Helvetica-Bold').text('REMAINING BALANCE DUE', 48, y + 8);
      doc.fillColor('#ea580c').fontSize(16).font('Helvetica-Bold')
        .text(`PHP ${Number(dueAmt).toLocaleString()}`, 48, y + 24);
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

const TRANSIENT_EMAIL_ERROR_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ESOCKET',
  'EPIPE',
  'EAI_AGAIN',
  'ENOTFOUND',
]);

const isTransientEmailError = (error) => {
  if (!error) return false;
  const code = String(error.code || '').toUpperCase();
  if (TRANSIENT_EMAIL_ERROR_CODES.has(code)) return true;

  const message = String(error.message || '').toLowerCase();
  return (
    message.includes('econnreset')
    || message.includes('connection reset')
    || message.includes('socket hang up')
    || message.includes('timed out')
    || message.includes('timeout')
  );
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sendMailWithFallback = async (transporter, mailOptions) => {
  const maxRetries = 2;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const activeTransporter = attempt === 0 ? transporter : createTransporter();
      return await activeTransporter.sendMail(mailOptions);
    } catch (error) {
      lastError = error;
      const isTransient = isTransientEmailError(error);
      if (!isTransient || attempt === maxRetries) break;

      const waitMs = 500 * Math.pow(2, attempt);
      console.warn(`[emailService] SMTP transient error (attempt ${attempt + 1}/${maxRetries + 1}): ${error.message}. Retrying in ${waitMs}ms...`);
      await delay(waitMs);
    }
  }

  if (isResendMode() && process.env.RESEND_API_KEY) {
    try {
      console.warn('[emailService] SMTP failed; retrying with strict Resend SMTP defaults:', lastError?.message || 'unknown error');
      const strictResendTransporter = createStrictResendTransporter();
      return await strictResendTransporter.sendMail(mailOptions);
    } catch (strictError) {
      lastError = strictError;
    }
  }

  // Final non-breaking fallback for non-attachment emails if Resend API key exists.
  const hasAttachments = Array.isArray(mailOptions?.attachments) && mailOptions.attachments.length > 0;
  if (!hasAttachments && process.env.RESEND_API_KEY) {
    try {
      console.warn('[emailService] SMTP failed; falling back to Resend HTTP API for non-attachment email.');
      const apiInfo = await sendViaResendApi(mailOptions);
      return { messageId: apiInfo?.id || apiInfo?.messageId || 'resend-api-fallback' };
    } catch (apiError) {
      lastError = apiError;
    }
  }

  throw lastError;
};

const sendViaResendApi = async ({ from, to, subject, html, text }) => {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is missing for Resend API send');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Resend API error (${response.status}): ${body || response.statusText}`);
  }

  return response.json().catch(() => ({}));
};

// Resolve a valid From address. Prevent placeholder values from breaking SMTP/API delivery.
const getFromAddress = () => {
  const fallbackFrom = 'Master Driving School <onboarding@resend.dev>';
  const configuredFrom = String(process.env.EMAIL_FROM || '')
    .replace(/^['"`]+|['"`]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!configuredFrom || /your-verified-domain/i.test(configuredFrom)) {
    console.warn('[emailService] EMAIL_FROM is missing or uses placeholder value; falling back to onboarding sender');
    return fallbackFrom;
  }

  const plainEmailRegex = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
  const namedEmailMatch = configuredFrom.match(/^([^<>]+)<\s*([^<>\s]+@[^<>\s]+\.[^<>\s]+)\s*>$/);
  const looseNamedEmailMatch = configuredFrom.match(/^(.+?)\s+([^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)$/);

  if (plainEmailRegex.test(configuredFrom)) {
    return configuredFrom;
  }

  if (namedEmailMatch) {
    const displayName = namedEmailMatch[1].trim().replace(/^['"]+|['"]+$/g, '');
    const email = namedEmailMatch[2].trim();
    if (displayName && plainEmailRegex.test(email)) {
      return `${displayName} <${email}>`;
    }
  }

  // Accept common misformat: "Name email@domain.com" and normalize it.
  if (looseNamedEmailMatch) {
    const displayName = looseNamedEmailMatch[1].trim().replace(/^['"]+|['"]+$/g, '');
    const email = looseNamedEmailMatch[2].trim();
    if (displayName && plainEmailRegex.test(email)) {
      return `${displayName} <${email}>`;
    }
  }

  console.warn('[emailService] EMAIL_FROM format is invalid; falling back to onboarding sender');
  return fallbackFrom;
};

const getFrontendUrl = () => {
  const url = process.env.FRONTEND_URL || 'http://localhost:5173';
  // If multiple URLs are provided (comma-separated), take the first one.
  return url.split(',')[0].trim();
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

    if (isResendMode() && process.env.RESEND_API_KEY) {
      await sendViaResendApi(mailOptions);
      console.log(`✅ ${type} email sent via Resend API to:`, email);
      return true;
    }

    const transporter = createTransporter();
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

// Send password email to new admin user
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
                <a href="${getFrontendUrl()}/signin" class="btn" style="display: inline-block; padding: 12px 24px; background-color: #2157da; color: #ffffff !important; text-decoration: none; border-radius: 5px; margin-top: 15px; font-weight: bold;">${EMAIL_CONTENT.newAccount.loginButtonText}</a>
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

const inferSessionFromTimeRange = (timeRange = '') => {
  const raw = String(timeRange || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  if ((raw.includes('08:00 am') || raw.includes('8:00 am')) && (raw.includes('05:00 pm') || raw.includes('5:00 pm'))) return 'Whole Day';
  if ((raw.includes('08:00 am') || raw.includes('8:00 am')) && raw.includes('12:00 pm')) return 'Morning';
  if ((raw.includes('01:00 pm') || raw.includes('1:00 pm')) && (raw.includes('05:00 pm') || raw.includes('5:00 pm'))) return 'Afternoon';
  return null;
};

const normalizeSessionLabel = (session = '') => {
  const raw = String(session || '').trim();
  if (!raw) return null;
  const cleaned = raw.replace(/\b(pdc|tdc)\b/ig, '').replace(/\s+/g, ' ').trim();
  const lowered = cleaned.toLowerCase();
  if (lowered.includes('whole')) return 'Whole Day';
  if (lowered.includes('morning')) return 'Morning';
  if (lowered.includes('afternoon')) return 'Afternoon';
  return cleaned;
};

const resolveDisplaySession = (session = '', timeRange = '') =>
  normalizeSessionLabel(session) || inferSessionFromTimeRange(timeRange) || 'N/A';

const buildDetailedScheduleLabel = (rawLabel = '', rawType = '', transmission = '') => {
  const normalizedLabel = String(rawLabel || '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s*-\s*DAY\s*\d+\s*$/i, '')
    .trim();
  const source = `${normalizedLabel} ${rawType}`.toUpperCase();
  const txCodeRaw = String(transmission || '').toUpperCase().trim();
  const hasManual = txCodeRaw === 'MT' || source.includes(' MANUAL ') || source.endsWith(' MANUAL') || source.includes('(MANUAL)') || /(^|\W)MT($|\W)/.test(source);
  const hasAutomatic = txCodeRaw === 'AT' || source.includes(' AUTOMATIC ') || source.includes(' AUTO ') || source.endsWith(' AUTOMATIC') || source.includes('(AUTOMATIC)') || /(^|\W)AT($|\W)/.test(source);
  const txWord = hasManual && !hasAutomatic ? 'Manual' : hasAutomatic && !hasManual ? 'Automatic' : '';

  if (source.includes('TDC') || source.includes('THEORETICAL')) {
    if (source.includes('ONLINE')) return 'TDC Online';
    if (source.includes('F2F') || source.includes('FACE TO FACE') || source.includes('FACE-TO-FACE')) return 'TDC F2F';
    return 'TDC';
  }

  if (source.includes('A1') || source.includes('TRICYCLE') || source.includes('V1-TRICYCLE')) {
    return 'PDC A1-Tricycle';
  }

  if ((source.includes('B1') || source.includes('VAN')) && (source.includes('B2') || source.includes('L300'))) {
    return 'PDC B1-Van/B2-L300';
  }

  if (source.includes('MOTORCYCLE') || source.includes('MOTOR') || source.includes('MOTO') || source.includes('BIKE')) {
    return ['PDC Motorcycle', txWord].filter(Boolean).join(' ');
  }

  if (source.includes('CAR')) {
    return ['PDC Car', txWord].filter(Boolean).join(' ');
  }

  if (hasManual || hasAutomatic) {
    // Single-course PDC records sometimes carry only transmission in type.
    return ['PDC Car', txWord].filter(Boolean).join(' ');
  }

  if (source.includes('PDC') || source.includes('PRACTICAL')) {
    return txWord ? `PDC Car ${txWord}` : 'PDC';
  }

  return normalizedLabel || 'PDC';
};

const compactScheduleLabelForDisplay = (rawLabel = '', rawType = '', transmission = '') => {
  const normalized = String(rawLabel || '')
    .replace(/[\u2013\u2014]/g, '-')
    .trim();

  const dayMatch = normalized.match(/\s*-\s*day\s*(\d+)\s*$/i);
  const daySuffix = dayMatch ? ` - Day ${dayMatch[1]}` : '';
  const baseLabel = dayMatch ? normalized.slice(0, dayMatch.index).trim() : normalized;

  const compactBase = buildDetailedScheduleLabel(baseLabel, rawType, transmission);
  if (daySuffix) return `${compactBase}${daySuffix}`;
  return compactBase;
};

const computeEmailRemainingBalance = (enrollmentDetails = {}, amountPaid = 0, paymentStatus = '') => {
  const toAmount = (value) => {
    if (value == null) return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const cleaned = String(value).replace(/[^0-9.-]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const paid = Math.max(0, toAmount(amountPaid));
  const statusLower = String(paymentStatus || '').toLowerCase();
  const isDownpayment = statusLower.includes('down');
  if (!isDownpayment) return 0;

  const explicitRemaining = [
    enrollmentDetails?.remainingBalance,
    enrollmentDetails?.balanceDue,
    enrollmentDetails?.balance_due,
  ]
    .map((v) => toAmount(v))
    .find((v) => Number.isFinite(v) && v > 0);
  if (Number.isFinite(explicitRemaining) && explicitRemaining > 0) {
    return Number(explicitRemaining.toFixed(2));
  }

  const explicitTotals = [
    enrollmentDetails?.totalAmount,
    enrollmentDetails?.grandTotal,
    enrollmentDetails?.finalTotal,
    enrollmentDetails?.assessedTotal,
    enrollmentDetails?.payableAmount,
    enrollmentDetails?.amountToPay,
  ]
    .map((v) => toAmount(v))
    .filter((v) => Number.isFinite(v) && v > 0);
  const explicitAssessment = explicitTotals.find((v) => v > paid + 0.009);
  if (Number.isFinite(explicitAssessment) && explicitAssessment > 0) {
    return Math.max(0, Number((explicitAssessment - paid).toFixed(2)));
  }

  const courseList = Array.isArray(enrollmentDetails?.courseList) ? enrollmentDetails.courseList : [];
  const courseTotal = courseList.reduce((sum, item) => {
    const resolvedLinePrice =
      item?.finalPrice ?? item?.discountedPrice ?? item?.netPrice ?? item?.lineTotal ?? item?.price ?? item?.amount ?? item?.coursePrice ?? 0;
    return sum + Math.max(0, toAmount(resolvedLinePrice));
  }, 0);

  const addonNamesRaw = String(enrollmentDetails?.addonNames || '').toLowerCase();
  const hasReviewerAddonByName = addonNamesRaw.includes('reviewer');
  const hasVehicleTipsAddonByName = addonNamesRaw.includes('maintenance') || addonNamesRaw.includes('vehicle');

  const addons = Array.isArray(enrollmentDetails?.addonsDetailed) ? enrollmentDetails.addonsDetailed : [];
  const detailedAddonTotal = addons.reduce((sum, item) => sum + Math.max(0, toAmount(item?.price || 0)), 0);
  const inferredAddonTotal = detailedAddonTotal > 0
    ? detailedAddonTotal
    : (hasReviewerAddonByName || enrollmentDetails?.hasReviewer ? 30 : 0)
      + (hasVehicleTipsAddonByName || enrollmentDetails?.hasVehicleTips ? 20 : 0);

  const paymentMethodRaw = String(enrollmentDetails?.paymentMethod || '').toLowerCase();
  const courseTypeRaw = String(enrollmentDetails?.courseType || '').toLowerCase();
  const isLikelyOnline = paymentMethodRaw.includes('online') || paymentMethodRaw.includes('starpay') || paymentMethodRaw.includes('gcash') || courseTypeRaw.includes('online');
  let convenienceFee = Math.max(0, toAmount(enrollmentDetails?.convenienceFee || 0));
  if (convenienceFee <= 0 && isLikelyOnline) {
    convenienceFee = 25;
  }

  let promoDiscount = Math.max(0, toAmount(enrollmentDetails?.promoDiscount || 0));

  const addonTotal = inferredAddonTotal;
  const computedTotal = Math.max(0, Number((courseTotal + addonTotal + convenienceFee - promoDiscount).toFixed(2)));
  if (computedTotal > paid + 0.009) {
    return Math.max(0, Number((computedTotal - paid).toFixed(2)));
  }

  const listedCoursePrice = Math.max(0, toAmount(enrollmentDetails?.coursePrice || 0));
  if (listedCoursePrice > paid + 0.009) {
    return Math.max(0, Number((listedCoursePrice - paid).toFixed(2)));
  }

  // Legacy fallback: most downpayment flows collect roughly half at first payment.
  return Math.max(0, Number((paid).toFixed(2)));
};

const enrichEnrollmentDetailsForBalance = async (enrollmentDetails = {}, hasReviewer = false, hasVehicleTips = false) => {
  const merged = {
    ...(enrollmentDetails || {}),
    hasReviewer: enrollmentDetails?.hasReviewer != null ? enrollmentDetails.hasReviewer : !!hasReviewer,
    hasVehicleTips: enrollmentDetails?.hasVehicleTips != null ? enrollmentDetails.hasVehicleTips : !!hasVehicleTips,
  };

  try {
    if (merged?.bookingId) {
      const bookingRes = await pool.query(
        `SELECT notes FROM bookings WHERE id = $1 LIMIT 1`,
        [merged.bookingId]
      );
      const bookingRow = bookingRes?.rows?.[0] || null;
      if (bookingRow?.notes) {
        const notes = typeof bookingRow.notes === 'string' ? JSON.parse(bookingRow.notes) : bookingRow.notes;
        if (notes && typeof notes === 'object') {
          if ((!Array.isArray(merged.courseList) || merged.courseList.length === 0) && Array.isArray(notes.courseList) && notes.courseList.length) {
            merged.courseList = notes.courseList;
          }
          if ((!Array.isArray(merged.addonsDetailed) || merged.addonsDetailed.length === 0) && Array.isArray(notes.addonsDetailed) && notes.addonsDetailed.length) {
            merged.addonsDetailed = notes.addonsDetailed;
          }
          if (!merged.addonNames && notes.addonNames) {
            merged.addonNames = notes.addonNames;
          }
          for (const key of ['subtotal', 'promoDiscount', 'convenienceFee', 'totalAmount', 'grandTotal', 'finalTotal', 'assessedTotal', 'coursePrice']) {
            if (merged[key] == null || Number(merged[key] || 0) === 0) {
              if (notes[key] != null) merged[key] = notes[key];
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[emailService] Failed to enrich booking notes for remaining balance:', err.message);
  }

  try {
    const hasAnyExplicitTotal = Number(merged?.totalAmount || merged?.grandTotal || merged?.finalTotal || merged?.assessedTotal || 0) > 0;
    const hasPricedCourseList = Array.isArray(merged?.courseList) && merged.courseList.some((item) => Number(item?.price ?? item?.finalPrice ?? item?.discountedPrice ?? 0) > 0);
    const hasCoursePrice = Number(merged?.coursePrice || 0) > 0;
    if (!hasAnyExplicitTotal && !hasPricedCourseList && !hasCoursePrice && merged?.courseName) {
      const courseRes = await pool.query(
        `SELECT price
           FROM courses
          WHERE LOWER(name) = LOWER($1)
          LIMIT 1`,
        [String(merged.courseName)]
      );
      const courseRow = courseRes?.rows?.[0] || null;
      if (courseRow?.price != null) {
        merged.coursePrice = Number(courseRow.price) || 0;
      }
    }
  } catch (err) {
    console.warn('[emailService] Failed to enrich course price for remaining balance:', err.message);
  }

  return merged;
};

const resolveTdcScheduleLabel = (enrollmentDetails = {}, courseType = '', courseList = []) => {
  const explicit = String(enrollmentDetails?.tdcLabel || '').trim();
  if (explicit) return explicit;

  const list = Array.isArray(courseList) ? courseList : [];
  const tdcItem = list.find((item) => {
    const src = `${item?.name || ''} ${item?.category || ''}`.toUpperCase();
    return src.includes('TDC') || src.includes('THEORETICAL');
  });

  const typeCandidates = [
    enrollmentDetails?.courseTypeTdc,
    courseType,
    tdcItem?.type,
  ]
    .map((v) => String(v || '').toUpperCase().trim())
    .filter(Boolean);

  if (typeCandidates.some((v) => v.includes('ONLINE'))) return 'TDC Online';
  if (typeCandidates.some((v) => v.includes('F2F') || v.includes('FACE TO FACE') || v.includes('FACE-TO-FACE'))) return 'TDC F2F';

  return 'TDC';
};

// Send walk-in enrollment confirmation email with schedule, password, verification code, and optional PDF add-ons
const sendWalkInEnrollmentEmail = async (email, firstName, lastName, password, verificationCode, enrollmentDetails, hasReviewer = false, hasVehicleTips = false) => {
  try {
    const transporter = createTransporter();
    const { courseName, courseCategory, courseType, branchName, branchAddress, scheduleDate, scheduleSession, scheduleTime, scheduleDate2, scheduleSession2, scheduleTime2, pdcSchedules, paymentMethod, amountPaid, paymentStatus } = enrollmentDetails;

    const categoryNorm = String(courseCategory || '').toUpperCase();
    const isPromo = categoryNorm.includes('PROMO');
    const isTDC = categoryNorm.includes('TDC') || categoryNorm.includes('THEORETICAL');
    const isRegularPdc = categoryNorm.includes('PDC') || categoryNorm.includes('PRACTICAL');
    const isOnlineTdc = (isTDC || isPromo) && (String(courseType || '').toLowerCase().includes('online') || String(courseType || '').toLowerCase().includes('otdc') || String(courseName || '').toLowerCase().includes('otdc'));
    const isPdcScheduleLocked = !!enrollmentDetails?.pdcScheduleLockedUntilCompletion;
    const pdcLockReason = enrollmentDetails?.pdcScheduleLockReason || 'Branch Manager will assigns your PDC schedule after OTDC is marked complete.';
    const formattedDate = formatDisplayDate(scheduleDate);
    const displayPrimarySession = resolveDisplaySession(scheduleSession, scheduleTime);
    
    const schedules = [];
    const tdcLabel = String(enrollmentDetails?.tdcLabel || 'TDC').trim();

    const effectivePdcType = String(
      enrollmentDetails?.courseTypePdc
      || courseType
      || pdcSchedules?.[0]?.courseTypeDetailed
      || pdcSchedules?.[0]?.courseType
      || ''
    ).trim();
    const effectivePdcTransmission = String(
      enrollmentDetails?.transmission
      || pdcSchedules?.[0]?.transmission
      || ''
    ).trim();

    const primaryScheduleLabel = (() => {
      if (isTDC || isPromo) {
        return resolveTdcScheduleLabel(enrollmentDetails, courseType, enrollmentDetails?.courseList || []);
      }
      return buildDetailedScheduleLabel(courseName || 'Primary Schedule', effectivePdcType || courseType || '', effectivePdcTransmission);
    })();

    if (!isOnlineTdc && !isRegularPdc) {
      // Day 1 (Always present)
      schedules.push({
        label: `${primaryScheduleLabel} - Day 1`,
        date: formattedDate,
        session: displayPrimarySession,
        time: scheduleTime
      });
    }

    // TDC Day 2
    const { scheduleEndDate, pdcDate1, pdcSession1, pdcTime1, pdcDate2, pdcSession2, pdcTime2 } = enrollmentDetails;
    const tdcDay2 = scheduleEndDate ? formatDisplayDate(scheduleEndDate) : (isTDC || isPromo ? computeTDCDay2(scheduleDate) : null);
    if (!isOnlineTdc && !isRegularPdc && tdcDay2) {
      schedules.push({
        label: `${primaryScheduleLabel} - Day 2`,
        date: tdcDay2,
        session: displayPrimarySession,
        time: scheduleTime
      });
    }

    const hasMultiPdc = Array.isArray(pdcSchedules) && pdcSchedules.length > 0;

    if (!isOnlineTdc && hasMultiPdc) {
      pdcSchedules.forEach((s, idx) => {
        const baseLabel = buildDetailedScheduleLabel(
          s?.label || s?.courseName || `PDC ${idx + 1}`,
          s?.courseTypeDetailed || s?.courseType || '',
          s?.transmission || ''
        );
        const d1 = formatDisplayDate(s?.scheduleDate);
        const d2 = formatDisplayDate(s?.promoPdcDate2 || s?.scheduleDate2);

        if (d1) {
          const day1Session = resolveDisplaySession(s?.scheduleSession || s?.scheduleSession2 || 'Morning', s?.scheduleTime || s?.scheduleTime2 || '08:00 AM - 12:00 PM');
          schedules.push({
            label: `${baseLabel} - Day 1`,
            date: d1,
            session: day1Session,
            time: s?.scheduleTime || s?.scheduleTime2 || '08:00 AM - 12:00 PM'
          });
        }

        if (d2) {
          const day2Session = resolveDisplaySession(s?.promoPdcSession2 || s?.scheduleSession2 || 'Morning', s?.promoPdcTime2 || s?.scheduleTime2 || '08:00 AM - 12:00 PM');
          schedules.push({
            label: `${baseLabel} - Day 2`,
            date: d2,
            session: day2Session,
            time: s?.promoPdcTime2 || s?.scheduleTime2 || '08:00 AM - 12:00 PM'
          });
        }
      });
    } else if (!isOnlineTdc) {
      // Backward compatibility for older payloads that only pass one PDC schedule.
      const fallbackPdcLabel = buildDetailedScheduleLabel(courseName || 'PDC', effectivePdcType || 'PDC', effectivePdcTransmission);
      if (pdcDate1) {
        const day1Session = resolveDisplaySession(pdcSession1 || 'Morning', pdcTime1 || '08:00 AM - 12:00 PM');
        schedules.push({
          label: `${fallbackPdcLabel} - Day 1`,
          date: formatDisplayDate(pdcDate1),
          session: day1Session,
          time: pdcTime1 || '08:00 AM - 12:00 PM'
        });
      }

      if (pdcDate2) {
        const day2Session = resolveDisplaySession(pdcSession2 || 'Morning', pdcTime2 || '08:00 AM - 12:00 PM');
        schedules.push({
          label: `${fallbackPdcLabel} - Day 2`,
          date: formatDisplayDate(pdcDate2),
          session: day2Session,
          time: pdcTime2 || '08:00 AM - 12:00 PM'
        });
      }
    }

    const isDownpayment = paymentStatus && paymentStatus.toLowerCase().includes('downpayment');
    const pricingDetails = await enrichEnrollmentDetailsForBalance(enrollmentDetails, hasReviewer, hasVehicleTips);
    const remainingBalanceDue = computeEmailRemainingBalance(pricingDetails, amountPaid, paymentStatus);
    const courseNameLower = (courseName || '').toLowerCase();
    const isTricycle = courseNameLower.includes('a1') || courseNameLower.includes('tricycle');

    const path = require('path');
    const attachments = [];
    if (hasReviewer) {
      attachments.push({ filename: 'Driving-School-Reviewer.pdf', path: path.join(__dirname, 'AddOns', 'MASTER-TDC-PDC-REVIEWER-AND-GUIDE.pdf') });
    }
    if (hasVehicleTips) {
      attachments.push({ filename: 'Vehicle-Maintenance-Guide.pdf', path: path.join(__dirname, 'AddOns', 'Vehicle-Maintenance-Guide.pdf') });
    }

    const mailOptions = {
      from: getFromAddress(),
      to: email,
      subject: EMAIL_CONTENT.walkIn.subject,
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
            .schedule-date { font-size: 20px; font-weight: 800; color: #1e40af; margin: 5px 0; }
            .schedule-session { font-size: 15px; color: #3b82f6; margin: 3px 0; font-weight: 600; }
            .schedule-time { font-size: 13px; color: #6b7280; margin-top: 2px; }
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
              
              ${isOnlineTdc ? `
              <div class="requirements" style="background: #ecfeff; border-left: 4px solid #0891b2; margin: 18px 0; border-radius: 8px;">
                <h4 style="color: #0e7490; margin: 0 0 8px 0;">💻 Online TDC Provider Notice</h4>
                <p style="margin: 0; font-size: 14px; color: #155e75;">
                  Please expect an email regarding your online course. Kindly check your inbox (including spam/junk) and follow the instructions. If not received, please contact us.
                </p>
              </div>

              <div class="requirements" style="background: #fdfae6; border-left: 4px solid #f59e0b; margin: 15px 0; border-radius: 8px; padding: 15px;">
                <h4 style="color: #b45309; margin: 0 0 10px 0;">SELF-PACED ONLINE THEORETICAL DRIVING COURSE (OTDC)</h4>
                <p style="margin: 0 0 15px 0; font-size: 14px; color: #78350f;">Pwede nyo itong gawin kahit kailan, saan, at paano nyo gusto.</p>
                <div style="font-weight: bold; color: #92400e; margin-bottom: 8px;">Step-by-Step Guide:</div>
                <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #78350f; line-height: 1.6;">
                  <li><strong>Check your Email</strong><br/>After payment, makakatanggap kayo ng OTDC link sa inyong email.</li>
                  <li style="margin-top: 8px;"><strong>Complete the Modules</strong><br/>May 3 modules<br/>Each module has 20–30 videos<br/>Panoorin lahat ng videos tungkol sa LTO road safety rules and regulations</li>
                  <li style="margin-top: 8px;"><strong>Take the Exams</strong><br/>May exam after bawat module<br/>Kailangan maipasa para makapag proceed sa next module</li>
                  <li style="margin-top: 8px;"><strong>Final Step (Branch Visit)</strong><br/>Kapag tapos na ang 3 modules<br/>Pumunta sa branch kung saan kayo nag-enroll<br/>Para sa Final Assessment at TDC Certificate</li>
                </ol>
                <div style="margin-top: 15px; font-size: 13px; font-weight: bold; color: #991b1b; text-align: center;">
                  Reminder:<br/>Tapusin within 30 days para maiwasan ang account deactivation.
                </div>
              </div>

              ${isPdcScheduleLocked ? `
              <div class="requirements" style="background: #eff6ff; border-left: 4px solid #2563eb; margin: 12px 0 18px 0; border-radius: 8px;">
                <h4 style="color: #1d4ed8; margin: 0 0 8px 0;">🗓️ PDC Scheduling Notice</h4>
                <p style="margin: 0; font-size: 14px; color: #1e3a8a;">${pdcLockReason}</p>
              </div>
              ` : ''}
              ` : `
              <div class="schedule-highlight">
                <h3>${EMAIL_CONTENT.walkIn.scheduleHeading}</h3>
                ${schedules.map((s, idx) => `
                  <div style="margin-bottom: ${idx === schedules.length - 1 ? '0' : '15px'};">
                    <div style="font-size: 11px; font-weight: 800; color: #3b82f6; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 4px;">${compactScheduleLabelForDisplay(s.label, s?.courseType || '', s?.transmission || '')}</div>
                    <div class="schedule-date">${s.date}</div>
                    <div class="schedule-session">${s.session}</div>
                    <div class="schedule-time">${s.time}</div>
                  </div>
                  ${idx === schedules.length - 1 ? '' : '<hr style="border: none; border-top: 2px dashed #93c5fd; margin: 15px 0;">'}
                `).join('')}
              </div>
              `}

              <div class="section">
                <h3>${EMAIL_CONTENT.walkIn.detailsHeading}</h3>
                <div class="detail-row">
                  <span class="detail-label">Course:&nbsp;&nbsp;</span>
                  <span class="detail-value">${courseName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Type:&nbsp;&nbsp;</span>
                  <span class="detail-value">${(() => {
                    const tdcLabel = courseType ? `${courseType.toUpperCase()} (TDC)` : '';
                    const pdcLabel = enrollmentDetails.courseTypePdc ? `${enrollmentDetails.courseTypePdc.toUpperCase()} (PDC)` : '';
                    if (tdcLabel && pdcLabel) return `${tdcLabel} + ${pdcLabel}`;
                    return (courseType || 'N/A').toUpperCase();
                  })()}</span>
                </div>
                ${enrollmentDetails.addonNames ? `
                <div class="detail-row">
                  <span class="detail-label">Add-ons:&nbsp;&nbsp;</span>
                  <span class="detail-value">${enrollmentDetails.addonNames}</span>
                </div>
                ` : ''}
                <div class="detail-row">
                  <span class="detail-label">Branch:&nbsp;&nbsp;</span>
                  <span class="detail-value">${branchName}</span>
                </div>
                ${branchAddress ? `<div class="detail-row"><span class="detail-label">Branch Address:&nbsp;&nbsp;</span><span class="detail-value">${branchAddress}</span></div>` : ''}
                <div class="detail-row">
                  <span class="detail-label">Payment Method:&nbsp;&nbsp;</span>
                  <span class="detail-value">${paymentMethod}</span>
                </div>
                ${enrollmentDetails.promoDiscount > 0 ? `
                <div class="detail-row">
                  <span class="detail-label">Subtotal:&nbsp;&nbsp;</span>
                  <span class="detail-value">₱${Number(enrollmentDetails.subtotal || (amountPaid + enrollmentDetails.promoDiscount)).toLocaleString()}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Discount (${enrollmentDetails.promoPct || 0}%):&nbsp;&nbsp;</span>
                  <span class="detail-value" style="color: #16a34a;">- ₱${Number(enrollmentDetails.promoDiscount).toLocaleString()}</span>
                </div>
                ` : ''}
                <div class="detail-row">
                  <span class="detail-label">Amount Paid:&nbsp;&nbsp;</span>
                  <span class="detail-value">₱${Number(amountPaid).toLocaleString()}</span>
                </div>
                ${isDownpayment && remainingBalanceDue > 0 ? `
                <div class="detail-row">
                  <span class="detail-label">Remaining Balance:&nbsp;&nbsp;</span>
                  <span class="detail-value">₱${Number(remainingBalanceDue).toLocaleString()}</span>
                </div>
                ` : ''}
                <div class="detail-row">
                  <span class="detail-label">Payment Status:&nbsp;&nbsp;</span>
                  <span class="detail-value">${paymentStatus}</span>
                </div>
                ${isPdcScheduleLocked ? `<div class="detail-row"><span class="detail-label">PDC Schedule:&nbsp;&nbsp;</span><span class="detail-value">${pdcLockReason}</span></div>` : ''}
              </div>

              ${isDownpayment ? `
              <div class="requirements" style="background: #e0f2fe; border-left: 4px solid #0284c7;">
                <h4 style="color: #0369a1; margin-top: 0;">${EMAIL_CONTENT.downpaymentReminder.heading}</h4>
                <p style="margin: 0; font-size: 14px; color: #0c4a6e;">${EMAIL_CONTENT.downpaymentReminder.note}</p>
              </div>
              ` : ''}

              ${isTricycle ? `
              <div style="background: #eff6ff; border-left: 4px solid #2157da; padding: 12px 15px; margin: 15px 0; border-radius: 0 8px 8px 0; font-size: 13px;">
                <strong style="color: #1e40af;">${EMAIL_CONTENT.vehicleRental.heading}</strong>
                <p style="margin: 6px 0 0; color: #1e3a8a;">${EMAIL_CONTENT.vehicleRental.tricycleNote}</p>
              </div>
              ` : ''}
              
              ${enrollmentDetails.isNewUser ? `
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

              <p style="text-align: center; margin-top: 25px;">
                <a href="${getFrontendUrl()}/verify-email?email=${encodeURIComponent(email)}" class="btn">${EMAIL_CONTENT.walkIn.verifyButtonText}</a>
              </p>
              ` : `
               <div class="credentials" style="background: #f0fdf4; border-color: #15803d;">
                <h3 style="color: #15803d; border-bottom: 2px solid #dcfce7; padding-bottom: 10px;">✅ Re-enrollment Successful</h3>
                <p style="margin-top: 15px;">Welcome back! Your new course has been successfully linked to your existing account: <strong>${email}</strong>.</p>
                <p>You can use your current password to log in and manage your enrollment details.</p>
              </div>
              
              <p style="text-align: center; margin-top: 25px;">
                <a href="${getFrontendUrl()}/signin" class="btn">Log In to Your Account</a>
              </p>
              `}

              ${(hasReviewer || hasVehicleTips) ? `
              <div class="requirements" style="background: #ecfdf5; border-left: 4px solid #10b981; margin: 20px 0; border-radius: 8px;">
                <h4 style="color: #065f46; margin: 0 0 8px 0;">🎉 Your Digital Learning Materials Are Attached!</h4>
                <p style="margin: 0; font-size: 14px; color: #064e3b;">We've included the following master guides to help you start your training:</p>
                <ul style="margin: 10px 0 0; padding-left: 20px; color: #064e3b; font-size: 14px;">
                  ${hasReviewer ? '<li><strong>Driving School Reviewer</strong> (Master TDC & PDC Guide)</li>' : ''}
                  ${hasVehicleTips ? '<li><strong>Vehicle Maintenance Tips</strong> (Complete Maintenance Guide)</li>' : ''}
                </ul>
                <p style="margin-top: 10px; font-size: 13px; font-style: italic; color: #065f46;">Check the attachments of this email to download your copies.</p>
              </div>
              ` : ''}

              ${!isOnlineTdc ? `
              <div class="requirements">
                <h4>${EMAIL_CONTENT.requirements.heading}</h4>
                <ul>
                  ${(isTDC ? EMAIL_CONTENT.requirements.tdc : EMAIL_CONTENT.requirements.pdc).map(item => `<li>${item}</li>`).join('\n                  ')}
                </ul>
              </div>
              ` : ''}

              <div class="terms">
                <h4>${EMAIL_CONTENT.terms.heading}</h4>
                <ol>
                  ${EMAIL_CONTENT.terms.items.map(item => `<li>${item}</li>`).join('\n                  ')}
                </ol>
              </div>

            </div>
            <div class="footer">
              <p>&copy; ${EMAIL_CONTENT.copyrightYear} ${EMAIL_CONTENT.schoolName}. All rights reserved.</p>
              <p>${EMAIL_CONTENT.walkIn.footerTagline}</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    // Construct plain text version
    let plainText = `Hello ${firstName} ${lastName}!\n\nYour walk-in enrollment has been successfully processed.\n`;
    if (isOnlineTdc) {
      plainText += `\nONLINE TDC PROVIDER NOTICE:\nPlease expect an email regarding your online course. Kindly check your inbox (including spam/junk) and follow the instructions. If not received, please contact us.\n\nSELF-PACED ONLINE THEORETICAL DRIVING COURSE (OTDC)\nPwede nyo itong gawin kahit kailan, saan, at paano nyo gusto.\n\nStep-by-Step Guide:\n1. Check your Email\n   After payment, makakatanggap kayo ng OTDC link sa inyong email.\n2. Complete the Modules\n   May 3 modules. Each module has 20–30 videos.\n   Panoorin lahat ng videos tungkol sa LTO road safety rules and regulations.\n3. Take the Exams\n   May exam after bawat module.\n   Kailangan maipasa para makapag proceed sa next module.\n4. Final Step (Branch Visit)\n   Kapag tapos na ang 3 modules, pumunta sa branch kung saan kayo nag-enroll para sa Final Assessment at TDC Certificate.\n\nReminder:\nTapusin within 30 days para maiwasan ang account deactivation.\n`;

      if (isPdcScheduleLocked) {
        plainText += `\nPDC SCHEDULING NOTICE:\n${pdcLockReason}\n`;
      }
    } else {
      plainText += `\nYOUR TRAINING SCHEDULE:\n`;
      plainText += schedules.map(s => `${compactScheduleLabelForDisplay(s.label, s?.courseType || '', s?.transmission || '')}: ${s.date}\nSession: ${s.session} (${s.time})`).join('\n\n');
    }
    plainText += `\n\nCourse: ${courseName} (${courseType})\nBranch: ${branchName}\n`;
    if (enrollmentDetails.promoDiscount > 0) {
      plainText += `Discount (${enrollmentDetails.promoPct || 0}%): - PHP ${Number(enrollmentDetails.promoDiscount).toLocaleString()}\n`;
    }
    
    if (enrollmentDetails.isNewUser) {
      plainText += `\nLogin Credentials:\nEmail: ${email}\nPassword: ${password}\n\nVerification Code: ${verificationCode}\n`;
    } else {
      plainText += `\nWelcome back! Your new course has been linked to your existing account (${email}).\n`;
    }

    if (isDownpayment) {
      if (remainingBalanceDue > 0) {
        plainText += `\nRemaining Balance: PHP ${Number(remainingBalanceDue).toLocaleString()}\n`;
      }
      plainText += `\nREMAINING BALANCE REMINDER: Since your payment type is Downpayment, you must settle your remaining balance when you go to the branch on the first day of your class or pay via starpay in profile.\n`;
    }
    if (isTricycle) plainText += `\nVEHICLE RENTAL NOTE: For PDC - A1 TRICYCLE, students are required to rent their own Tricycle.\n`;
    
    plainText += `\nMaster Driving School`;
    mailOptions.text = plainText;

    const info = await sendMailWithFallback(transporter, mailOptions);
    console.log('✅ Walk-in enrollment email sent to:', email);
    console.log('Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Walk-in enrollment email sending failed:', error.message);
    throw error;
  }
};

// Send enrollment confirmation without login credentials.
const sendEnrollmentEmail = async (email, firstName, lastName, enrollmentDetails, hasReviewer = false, hasVehicleTips = false) => {
  try {
    const transporter = createTransporter();
    const { courseName, courseList, courseCategory, courseType, branchName, branchAddress, scheduleDate, scheduleSession, scheduleTime, scheduleDate2, scheduleSession2, scheduleTime2, pdcSchedules, paymentMethod, amountPaid, paymentStatus } = enrollmentDetails;

    const isTDC = (courseCategory || '').toUpperCase() === 'TDC';
    const isPromo = (courseCategory || '').toUpperCase() === 'PROMO';
    const isOnlineTdc = (isTDC || isPromo) && (String(courseType || '').toLowerCase().includes('online') || String(courseType || '').toLowerCase().includes('otdc') || String(courseName || '').toLowerCase().includes('otdc'));
    const isPdcScheduleLocked = !!enrollmentDetails?.pdcScheduleLockedUntilCompletion;
    const pdcLockReason = enrollmentDetails?.pdcScheduleLockReason || 'Branch Manager will assigns your PDC schedule after OTDC is marked complete.';
    const formattedDate = formatDisplayDate(scheduleDate);
    const displayScheduleSession = resolveDisplaySession(scheduleSession, scheduleTime);

    // Dynamically fulfill Day 2 for TDC directly, or bind to passed 2nd slots if PDC
    const effectiveDate2 = (isTDC && !scheduleDate2) ? computeTDCDay2(scheduleDate) : formatDisplayDate(scheduleDate2);
    const effectiveSession2Raw = (isTDC && !scheduleSession2) ? scheduleSession : scheduleSession2;
    const effectiveSession2 = resolveDisplaySession(effectiveSession2Raw, scheduleTime2 || scheduleTime);
    const effectiveTime2 = (isTDC && !scheduleTime2) ? scheduleTime : scheduleTime2;
    const hasMultiPdc = Array.isArray(pdcSchedules) && pdcSchedules.length > 0;
    const hasPrimarySchedule = !!scheduleDate && !isOnlineTdc;
    const effectivePdcType = String(
      enrollmentDetails?.courseTypePdc
      || courseType
      || pdcSchedules?.[0]?.courseTypeDetailed
      || pdcSchedules?.[0]?.courseType
      || ''
    ).trim();
    const effectivePdcTransmission = String(
      enrollmentDetails?.transmission
      || pdcSchedules?.[0]?.transmission
      || ''
    ).trim();

    const primaryScheduleLabel = (() => {
      if (isTDC || isPromo) {
        return resolveTdcScheduleLabel(enrollmentDetails, courseType, courseList);
      }
      return buildDetailedScheduleLabel(courseName || 'Primary Schedule', effectivePdcType || courseType || '', effectivePdcTransmission);
    })();
    const incomingCourseList = Array.isArray(courseList) ? courseList.filter(Boolean) : [];
    const fallbackCourseList = [];
    if (!incomingCourseList.length) {
      if (courseName) {
        fallbackCourseList.push({
          name: courseName,
          type: courseType || (isTDC ? 'TDC' : 'standard'),
          category: courseCategory || null,
        });
      }
      if (hasMultiPdc) {
        pdcSchedules.forEach((s) => {
          fallbackCourseList.push({
            name: s?.label || s?.courseName || 'PDC',
            type: s?.courseTypeDetailed || s?.courseType || 'PDC',
            category: 'PDC',
          });
        });
      }
    }

    const normalizeCourseName = (value = '') => String(value)
      .toLowerCase()
      .replace(/\(pdc\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const dedupedCourseMap = new Map();
    [...incomingCourseList, ...fallbackCourseList].forEach((c) => {
      const nameKey = normalizeCourseName(c?.name || '');
      const typeKey = String(c?.type || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const key = `${nameKey}::${typeKey}`;
      if (!dedupedCourseMap.has(key) && (nameKey || typeKey)) {
        dedupedCourseMap.set(key, c);
      }
    });
    const normalizedCourseList = [...dedupedCourseMap.values()];
    const hasCourseList = normalizedCourseList.length > 0;

    const courseListHtml = hasCourseList
      ? normalizedCourseList.map((c, idx) => {
          const n = c?.name || `Course ${idx + 1}`;
          const t = c?.type ? String(c.type).toUpperCase() : 'STANDARD';
          return `<div style="margin: 0 0 6px 0;"><span style="font-weight:700; color:#0f172a;">${idx + 1}.</span> ${n} <span style="color:#64748b;">(${t})</span></div>`;
        }).join('')
      : '';

    const sanitizeType = (value = '') => {
      const t = String(value || '').toUpperCase().trim();
      if (!t || t === 'STANDARD' || t === 'PDC' || t === 'TDC') return null;
      return t;
    };

    const courseTypeSummary = hasCourseList
      ? [...new Set(normalizedCourseList.map((c) => sanitizeType(c?.type)).filter(Boolean))].join(', ') || (courseType || 'N/A').toUpperCase()
      : (courseType || 'N/A').toUpperCase();

    const normalizedPdcSchedules = (Array.isArray(pdcSchedules) ? pdcSchedules : []).map((s) => {
      const time1 = s?.scheduleTime || 'N/A';
      const time2 = s?.scheduleTime2 || time1;
      return {
        ...s,
        scheduleLabelDisplay: compactScheduleLabelForDisplay(s?.label || s?.courseName || 'PDC', s?.courseTypeDetailed || s?.courseType || '', s?.transmission || ''),
        scheduleSessionDisplay: resolveDisplaySession(s?.scheduleSession || s?.scheduleSession2, time1),
        scheduleSession2Display: resolveDisplaySession(s?.scheduleSession2 || s?.scheduleSession, time2),
      };
    });

    const multiPdcHtml = hasMultiPdc
      ? normalizedPdcSchedules.map((s, idx) => {
          const d1 = formatDisplayDate(s.scheduleDate);
          const d2 = formatDisplayDate(s.scheduleDate2);
          return `
            <div style="margin-top: ${idx === 0 ? '0' : '16px'}; padding-top: ${idx === 0 ? '0' : '16px'}; border-top: ${idx === 0 ? 'none' : '2px dashed #93c5fd'};">
              <div style="font-size: 12px; font-weight: 800; color: #10b981; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">${s.scheduleLabelDisplay || `PDC ${idx + 1}`}</div>
              ${d2 ? `
                <div style="font-size: 12px; font-weight: 800; color: #3b82f6; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Day 1</div>
                <div class="schedule-date">${d1}</div>
                <div class="schedule-session">${s.scheduleSessionDisplay || 'N/A'}</div>
                <div style="font-size: 14px; color: #6b7280; margin-top: 5px;">${s.scheduleTime || 'N/A'}</div>
                <div style="margin-top:10px; font-size: 12px; font-weight: 800; color: #3b82f6; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Day 2</div>
                <div class="schedule-date">${d2}</div>
                <div class="schedule-session">${s.scheduleSession2Display || 'N/A'}</div>
                <div style="font-size: 14px; color: #6b7280; margin-top: 5px;">${s.scheduleTime2 || 'N/A'}</div>
              ` : `
                <div class="schedule-date">${d1}</div>
                <div class="schedule-session">${s.scheduleSessionDisplay || 'N/A'}</div>
                <div style="font-size: 14px; color: #6b7280; margin-top: 5px;">${s.scheduleTime || 'N/A'}</div>
              `}
            </div>
          `;
        }).join('')
      : '';

    const primaryScheduleHtml = hasPrimarySchedule
      ? (effectiveDate2 ? `
        <div style="margin-bottom: ${hasMultiPdc ? '18px' : '0'}; padding-bottom: ${hasMultiPdc ? '14px' : '0'}; border-bottom: ${hasMultiPdc ? '2px dashed #93c5fd' : 'none'};">
          <div style="font-size: 12px; font-weight: 800; color: #10b981; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">${primaryScheduleLabel}</div>
          <div style="font-size: 12px; font-weight: 800; color: #3b82f6; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Day 1</div>
          <div class="schedule-date">${formattedDate}</div>
          <div class="schedule-session">${displayScheduleSession}</div>
          <div style="font-size: 14px; color: #6b7280; margin-top: 5px;">${scheduleTime || 'N/A'}</div>
          <div style="margin-top:10px; font-size: 12px; font-weight: 800; color: #3b82f6; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Day 2</div>
          <div class="schedule-date">${effectiveDate2}</div>
          <div class="schedule-session">${effectiveSession2 || 'N/A'}</div>
          <div style="font-size: 14px; color: #6b7280; margin-top: 5px;">${effectiveTime2 || 'N/A'}</div>
        </div>
      ` : `
        <div style="margin-bottom: ${hasMultiPdc ? '18px' : '0'}; padding-bottom: ${hasMultiPdc ? '14px' : '0'}; border-bottom: ${hasMultiPdc ? '2px dashed #93c5fd' : 'none'};">
          <div style="font-size: 12px; font-weight: 800; color: #10b981; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">${primaryScheduleLabel}</div>
          <div class="schedule-date">${formattedDate}</div>
          <div class="schedule-session">${displayScheduleSession}</div>
          <div style="font-size: 14px; color: #6b7280; margin-top: 5px;">${scheduleTime || 'N/A'}</div>
        </div>
      `)
      : '';
    const isDownpayment = paymentStatus && paymentStatus.toLowerCase().includes('downpayment');
    const pricingDetails = await enrichEnrollmentDetailsForBalance(enrollmentDetails, hasReviewer, hasVehicleTips);
    const remainingBalanceDue = computeEmailRemainingBalance(pricingDetails, amountPaid, paymentStatus);
    const courseNameLower = (courseName || '').toLowerCase();
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
              
              ${isOnlineTdc ? `
              <div class="requirements" style="background: #ecfeff; border-left: 4px solid #0891b2; margin: 18px 0; border-radius: 8px;">
                <h4 style="color: #0e7490; margin: 0 0 8px 0;">💻 Online TDC Provider Notice</h4>
                <p style="margin: 0; font-size: 14px; color: #155e75;">
                  Please expect an email regarding your online course. Kindly check your inbox (including spam/junk) and follow the instructions. If not received, please contact us.
                </p>
              </div>

              <div class="requirements" style="background: #fdfae6; border-left: 4px solid #f59e0b; margin: 15px 0; border-radius: 8px; padding: 15px;">
                <h4 style="color: #b45309; margin: 0 0 10px 0;">SELF-PACED ONLINE THEORETICAL DRIVING COURSE (OTDC)</h4>
                <p style="margin: 0 0 15px 0; font-size: 14px; color: #78350f;">Pwede nyo itong gawin kahit kailan, saan, at paano nyo gusto.</p>
                <div style="font-weight: bold; color: #92400e; margin-bottom: 8px;">Step-by-Step Guide:</div>
                <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #78350f; line-height: 1.6;">
                  <li><strong>Check your Email</strong><br/>After payment, makakatanggap kayo ng OTDC link sa inyong email.</li>
                  <li style="margin-top: 8px;"><strong>Complete the Modules</strong><br/>May 3 modules<br/>Each module has 20–30 videos<br/>Panoorin lahat ng videos tungkol sa LTO road safety rules and regulations</li>
                  <li style="margin-top: 8px;"><strong>Take the Exams</strong><br/>May exam after bawat module<br/>Kailangan maipasa para makapag proceed sa next module</li>
                  <li style="margin-top: 8px;"><strong>Final Step (Branch Visit)</strong><br/>Kapag tapos na ang 3 modules<br/>Pumunta sa branch kung saan kayo nag-enroll<br/>Para sa Final Assessment at TDC Certificate</li>
                </ol>
                <div style="margin-top: 15px; font-size: 13px; font-weight: bold; color: #991b1b; text-align: center;">
                  Reminder:<br/>Tapusin within 30 days para maiwasan ang account deactivation.
                </div>
              </div>
              ${isPdcScheduleLocked ? `
              <div class="requirements" style="background: #eff6ff; border-left: 4px solid #2563eb; margin: 12px 0 18px 0; border-radius: 8px;">
                <h4 style="color: #1d4ed8; margin: 0 0 8px 0;">🗓️ PDC Scheduling Notice</h4>
                <p style="margin: 0; font-size: 14px; color: #1e3a8a;">${pdcLockReason}</p>
              </div>
              ` : ''}
              ` : `
              <div class="schedule-highlight">
                <h3>${EMAIL_CONTENT.guest.scheduleHeading}</h3>
                ${(hasMultiPdc || hasPrimarySchedule)
                  ? `${primaryScheduleHtml}${multiPdcHtml}`
                  : `
                <div class="schedule-date">N/A</div>
                <div class="schedule-session">No schedule data found</div>
                <div style="font-size: 14px; color: #6b7280; margin-top: 5px;">Please contact support if this persists.</div>
                `}
              </div>
              `}

              
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
                ${hasCourseList ? `<div class="detail-row"><span class="detail-label">Enrolled Courses (${normalizedCourseList.length}):&nbsp;&nbsp;</span><span class="detail-value" style="line-height:1.4;">${courseListHtml}</span></div>` : ''}
                <div class="detail-row">
                  <span class="detail-label">Type:&nbsp;&nbsp;</span>
                  <span class="detail-value">${courseTypeSummary}</span>
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
                ${enrollmentDetails.promoDiscount > 0 ? `
                <div class="detail-row">
                  <span class="detail-label">Subtotal:&nbsp;&nbsp;</span>
                  <span class="detail-value">₱${Number(enrollmentDetails.subtotal || (amountPaid + enrollmentDetails.promoDiscount)).toLocaleString()}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Discount (${enrollmentDetails.promoPct || 0}%):&nbsp;&nbsp;</span>
                  <span class="detail-value" style="color: #16a34a;">- ₱${Number(enrollmentDetails.promoDiscount).toLocaleString()}</span>
                </div>
                ` : ''}
                <div class="detail-row">
                  <span class="detail-label">Amount Paid:&nbsp;&nbsp;</span>
                  <span class="detail-value">₱${Number(amountPaid).toLocaleString()}</span>
                </div>
                ${isDownpayment && remainingBalanceDue > 0 ? `<div class="detail-row"><span class="detail-label">Remaining Balance:&nbsp;&nbsp;</span><span class="detail-value">₱${Number(remainingBalanceDue).toLocaleString()}</span></div>` : ''}
                <div class="detail-row">
                  <span class="detail-label">Payment Status:&nbsp;&nbsp;</span>
                  <span class="detail-value">${paymentStatus}</span>
                </div>
                ${isPdcScheduleLocked ? `<div class="detail-row"><span class="detail-label">PDC Schedule:&nbsp;&nbsp;</span><span class="detail-value">${pdcLockReason}</span></div>` : ''}
              </div>

              ${isDownpayment ? `
              <div class="requirements" style="background: #e0f2fe; border-left: 4px solid #0284c7;">
                <h4 style="color: #0369a1; margin-top: 0;">${EMAIL_CONTENT.downpaymentReminder.heading}</h4>
                <p style="margin: 0; font-size: 14px; color: #0c4a6e;">${EMAIL_CONTENT.downpaymentReminder.note}</p>
              </div>
              ` : ''}

              ${isTricycle ? `
              <div style="background: #eff6ff; border-left: 4px solid #2157da; padding: 12px 15px; margin: 15px 0; border-radius: 0 8px 8px 0; font-size: 13px;">
                <strong style="color: #1e40af;">${EMAIL_CONTENT.vehicleRental.heading}</strong>
                <p style="margin: 6px 0 0; color: #1e3a8a;">${EMAIL_CONTENT.vehicleRental.tricycleNote}</p>
              </div>
              ` : ''}

              ${!isOnlineTdc ? `
              <div class="requirements">
                <h4>${EMAIL_CONTENT.requirements.heading}</h4>
                <ul>
                  ${(isTDC ? EMAIL_CONTENT.requirements.tdc : EMAIL_CONTENT.requirements.pdc).map(item => `<li>${item}</li>`).join('\n                  ')}
                </ul>
              </div>
              ` : ''}

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
      text: `Hello ${firstName} ${lastName}!\n\nYour enrollment has been successfully processed.\n\n${[isOnlineTdc ? `ONLINE TDC PROVIDER NOTICE:\nPlease expect an email regarding your online course. Kindly check your inbox (including spam/junk) and follow the instructions. If not received, please contact us.\n\nSELF-PACED ONLINE THEORETICAL DRIVING COURSE (OTDC)\nPwede nyo itong gawin kahit kailan, saan, at paano nyo gusto.\n\nStep-by-Step Guide:\n1. Check your Email\n   After payment, makakatanggap kayo ng OTDC link sa inyong email.\n2. Complete the Modules\n   May 3 modules. Each module has 20–30 videos.\n   Panoorin lahat ng videos tungkol sa LTO road safety rules and regulations.\n3. Take the Exams\n   May exam after bawat module.\n   Kailangan maipasa para makapag proceed sa next module.\n4. Final Step (Branch Visit)\n   Kapag tapos na ang 3 modules, pumunta sa branch kung saan kayo nag-enroll para sa Final Assessment at TDC Certificate.\n\nReminder:\nTapusin within 30 days para maiwasan ang account deactivation.${isPdcScheduleLocked ? `\n\nPDC SCHEDULING NOTICE:\n${pdcLockReason}` : ''}` : (hasPrimarySchedule ? `${primaryScheduleLabel}\nDay 1: ${formattedDate}\nSession: ${displayScheduleSession}\nTime: ${scheduleTime || 'N/A'}${effectiveDate2 ? `\nDay 2: ${effectiveDate2}\nSession: ${effectiveSession2 || 'N/A'}\nTime: ${effectiveTime2 || 'N/A'}` : ''}` : ''), hasMultiPdc
        ? normalizedPdcSchedules.map((s, idx) => {
            const d1 = formatDisplayDate(s.scheduleDate);
            const d2 = formatDisplayDate(s.scheduleDate2);
            return `${s.scheduleLabelDisplay || `PDC ${idx + 1}`}\nDay 1: ${d1}\nSession: ${s.scheduleSessionDisplay || 'N/A'}\nTime: ${s.scheduleTime || 'N/A'}${d2 ? `\nDay 2: ${d2}\nSession: ${s.scheduleSession2Display || 'N/A'}\nTime: ${s.scheduleTime2 || 'N/A'}` : ''}`;
          }).join('\n\n')
        : ''].filter(Boolean).join('\n\n')}\nCourse: ${courseName} (${courseType})\n${hasCourseList ? `Enrolled Courses:\n${normalizedCourseList.map((c, idx) => `${idx + 1}. ${c?.name || `Course ${idx + 1}`} (${(c?.type || 'standard').toUpperCase()})`).join('\n')}\n` : ''}Branch: ${branchName}\n\n${isDownpayment ? `${remainingBalanceDue > 0 ? `Remaining Balance: PHP ${Number(remainingBalanceDue).toLocaleString()}\n` : ''}REMAINING BALANCE REMINDER: Since your payment type is Downpayment, you must settle your remaining balance when you go to the branch on the first or second day of your class.\n\n` : ''}${isTricycle ? `VEHICLE RENTAL NOTE: For PDC - A1 TRICYCLE, students are required to rent their own Tricycle for the course instead of using the school's vehicle because we only have one unit for all branches.\n\n` : ''}Thank you for choosing Master Driving School!`,
    };

    const info = await sendMailWithFallback(transporter, mailOptions);
    console.log('✅ Enrollment email sent to:', email);
    console.log('Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Enrollment email sending failed:', error.message);
    throw error;
  }
};

// Send No-Show Email for Unattended Sessions
const sendNoShowEmail = async (email, firstName, lastName, enrollmentDetails) => {
  try {
    const transporter = createTransporter();
    const { courseName, scheduleDate, scheduleSession } = enrollmentDetails;
    const formattedDate = formatDisplayDate(scheduleDate);
    const feeAmount = (enrollmentDetails.type || courseName || '').toLowerCase().includes('tdc') ? '300.00' : '1,000.00';

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
                  <p style="margin: 0 0 10px 0; font-size: 14px; color: #7f1d1d;">${EMAIL_CONTENT.noShow.feeNote.replace('{fee}', feeAmount)}</p>
                </div>

                <div class="details">
                  <h4 style="margin-top: 0;">${EMAIL_CONTENT.noShow.howToHeading}</h4>
                  <ol style="margin-bottom: 0;">
                    ${EMAIL_CONTENT.noShow.howToSteps.map(s => s.replace('{fee}', feeAmount)).map(s => `<li>${s}</li>`).join('\n                  ')}
              
              <div style="text-align: center; margin-top: 30px;">
                <a href="${getFrontendUrl()}/profile" class="btn">${EMAIL_CONTENT.noShow.loginButtonText}</a>
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
                <a href="${getFrontendUrl()}" style="display: inline-block; padding: 12px 24px; background-color: #1a4fba; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">${EMAIL_CONTENT.news.visitButton}</a>
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

    const paidAmt = Math.max(0, Number(amountPaid || 0));
    const courseAmt = Math.max(0, Number(coursePrice || 0));
    const dueAmt = Math.max(0, Number(balanceDue || 0));
    const resolvedIsFullPayment = Boolean(isFullPayment) && dueAmt <= 0.009;
    const settledTotalAmt = resolvedIsFullPayment ? Math.max(courseAmt, paidAmt) : paidAmt;

    const formattedDate = paymentDate
      ? new Date(paymentDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const subject = resolvedIsFullPayment
      ? EMAIL_CONTENT.receipt.subjectFull
      : EMAIL_CONTENT.receipt.subjectDown;

    // Generate PDF attachment
    const pdfBuffer = await generateReceiptPDF(firstName, lastName, receiptData);
    const safeSurname = (lastName || 'Student').replace(/[^a-zA-Z0-9]/g, '_');
    const pdfFilename = `Service-Invoice-${safeSurname}.pdf`;

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
                ${resolvedIsFullPayment ? EMAIL_CONTENT.receipt.headerFull : EMAIL_CONTENT.receipt.headerDown}
              </h2>
            </div>
            <div class="content">
              <h2 style="margin-top:0;">${EMAIL_CONTENT.receipt.greeting(firstName, lastName)}</h2>
              <p>
                ${resolvedIsFullPayment
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
                  ${receiptData.promoDiscount > 0 ? `
                  <tr><td class="lbl">Discount (${receiptData.promoPct || 0}%)</td><td class="val" style="color:#16a34a;">- ₱${Number(receiptData.promoDiscount).toLocaleString()}</td></tr>
                  ` : ''}
                  <tr><td class="lbl">Date</td><td class="val">${formattedDate}</td></tr>
                  <tr><td class="lbl">Payment Method</td><td class="val">${paymentMethod}</td></tr>
                  <tr><td class="lbl">Amount Paid</td><td class="val" style="color:#16a34a;">₱${Number(amountPaid).toLocaleString()}</td></tr>
                </table>
                <div class="total-row">
                  <table class="total-inner">
                    <tr>
                      <td class="total-label">${resolvedIsFullPayment ? EMAIL_CONTENT.receipt.paidInFull : EMAIL_CONTENT.receipt.amountPaid}</td>
                      <td class="total-value">₱${Number(settledTotalAmt).toLocaleString()}</td>
                    </tr>
                  </table>
                </div>
              </div>

              ${!resolvedIsFullPayment && dueAmt > 0 ? `
              <div class="balance-box">
                <h4>${EMAIL_CONTENT.receipt.balanceHeading}</h4>
                <div class="balance-amount">₱${Number(dueAmt).toLocaleString()}</div>
                <p style="margin:0;font-size:14px;color:#9a3412;">${EMAIL_CONTENT.receipt.balanceNote(dueAmt)}</p>
                <div class="steps">
                  <strong style="color:#92400e;">${EMAIL_CONTENT.receipt.balanceStepsHeading}</strong>
                  <ol>
                    ${EMAIL_CONTENT.receipt.balanceSteps.map(s => `<li>${s}</li>`).join('\n                    ')}
                  </ol>
                </div>
              </div>
              ` : ''}

              ${resolvedIsFullPayment ? `
              <div class="success-badge">
                <div style="font-size:32px;margin-bottom:8px;">${EMAIL_CONTENT.receipt.successBadge}</div>
                <h3 style="color:#15803d;margin:0 0 6px 0;">${EMAIL_CONTENT.receipt.successHeading}</h3>
                <p style="margin:0;font-size:14px;color:#166534;">${EMAIL_CONTENT.receipt.successNote}</p>
              </div>
              ` : ''}

              <p style="text-align:center;margin-top:20px;">
                <a href="${getFrontendUrl()}/profile"
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

/**
 * Send a PDC Schedule Assignment confirmation email to the student.
 * @param {string} email
 * @param {string} firstName
 * @param {string} lastName
 * @param {Object[]} pdcAssignments  - array of { courseName, courseType, pdcDate, pdcSession, pdcTime, pdcDate2, pdcSession2, pdcTime2 }
 * @param {string} branchName
 */
const sendPdcScheduleAssignedEmail = async (email, firstName, lastName, pdcAssignments = [], branchName = '') => {
  try {
    const transporter = createTransporter();
    const schoolName = EMAIL_CONTENT.schoolName || 'Master Driving School';

    const formatDate = (d) => {
      if (!d) return null;
      try {
        return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      } catch { return d; }
    };

    const courseCardsHtml = pdcAssignments.map((a, idx) => {
      const d1 = formatDate(a.pdcDate);
      const d2 = formatDate(a.pdcDate2);
      const hasDay2 = !!d2;
      return `
        <div style="background:#fff;border-radius:12px;border:1px solid #dbeafe;padding:20px 24px;margin-bottom:${idx < pdcAssignments.length - 1 ? '16px' : '0'};">
          <div style="font-size:11px;font-weight:800;color:#10b981;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px;">
            Course ${idx + 1}
          </div>
          <div style="font-size:16px;font-weight:800;color:#1e293b;margin-bottom:14px;line-height:1.3;">
            ${a.courseName || 'PDC Course'}
            ${a.courseType ? `<span style="font-size:12px;font-weight:600;color:#64748b;margin-left:6px;">(${a.courseType})</span>` : ''}
          </div>
          ${hasDay2 ? `
            <div style="display:flex;gap:16px;flex-wrap:wrap;">
              <div style="flex:1;min-width:140px;background:linear-gradient(135deg,#eff6ff,#e0e7ff);border-radius:10px;padding:14px 16px;border:1.5px solid #bfdbfe;">
                <div style="font-size:10px;font-weight:800;color:#3b82f6;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">📅 Day 1</div>
                <div style="font-size:17px;font-weight:800;color:#1e40af;margin-bottom:4px;">${d1}</div>
                <div style="font-size:13px;color:#3b82f6;font-weight:600;">${a.pdcSession || ''}</div>
                ${a.pdcTime ? `<div style="font-size:12px;color:#64748b;margin-top:3px;">${a.pdcTime}</div>` : ''}
              </div>
              <div style="flex:1;min-width:140px;background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-radius:10px;padding:14px 16px;border:1.5px solid #86efac;">
                <div style="font-size:10px;font-weight:800;color:#10b981;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">📅 Day 2</div>
                <div style="font-size:17px;font-weight:800;color:#15803d;margin-bottom:4px;">${d2}</div>
                <div style="font-size:13px;color:#10b981;font-weight:600;">${a.pdcSession2 || a.pdcSession || ''}</div>
                ${(a.pdcTime2 || a.pdcTime) ? `<div style="font-size:12px;color:#64748b;margin-top:3px;">${a.pdcTime2 || a.pdcTime}</div>` : ''}
              </div>
            </div>
          ` : `
            <div style="background:linear-gradient(135deg,#eff6ff,#e0e7ff);border-radius:10px;padding:14px 16px;border:1.5px solid #bfdbfe;">
              <div style="font-size:10px;font-weight:800;color:#3b82f6;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">📅 Schedule</div>
              <div style="font-size:17px;font-weight:800;color:#1e40af;margin-bottom:4px;">${d1}</div>
              <div style="font-size:13px;color:#3b82f6;font-weight:600;">${a.pdcSession || ''}</div>
              ${a.pdcTime ? `<div style="font-size:12px;color:#64748b;margin-top:3px;">${a.pdcTime}</div>` : ''}
            </div>
          `}
        </div>
      `;
    }).join('');

    const plainCourses = pdcAssignments.map((a, idx) => {
      const d1 = formatDate(a.pdcDate);
      const d2 = formatDate(a.pdcDate2);
      let txt = `Course ${idx + 1}: ${a.courseName || 'PDC Course'}\n  Day 1: ${d1} — ${a.pdcSession || ''} ${a.pdcTime ? `(${a.pdcTime})` : ''}`;
      if (d2) txt += `\n  Day 2: ${d2} — ${a.pdcSession2 || a.pdcSession || ''} ${(a.pdcTime2 || a.pdcTime) ? `(${a.pdcTime2 || a.pdcTime})` : ''}`;
      return txt;
    }).join('\n\n');

    const mailOptions = {
      from: getFromAddress(),
      to: email,
      subject: `Your PDC Schedule Has Been Assigned — ${schoolName}`,
      html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0}
    .container{max-width:620px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden}
    .header{background:linear-gradient(135deg,#1a4fba 0%,#3b82f6 100%);color:#fff;padding:32px 24px;text-align:center}
    .header h1{margin:0 0 6px;font-size:26px}
    .header p{margin:0;font-size:15px;opacity:.9}
    .content{padding:32px 28px;background:#f8fafc}
    .alert-box{background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #22c55e;border-radius:12px;padding:18px 20px;margin-bottom:24px;text-align:center}
    .alert-box .icon{font-size:36px;margin-bottom:8px}
    .alert-box h2{color:#15803d;margin:0 0 6px;font-size:18px}
    .alert-box p{margin:0;font-size:14px;color:#166534}
    .section-title{font-size:12px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:1.2px;margin:0 0 14px}
    .info-row{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #f1f5f9;font-size:14px}
    .info-row:last-child{border-bottom:none}
    .info-label{color:#64748b;font-weight:600}
    .info-value{color:#1f2937;font-weight:700;text-align:right}
    .requirements{background:#fef3c7;border-left:4px solid #f59e0b;padding:15px 20px;margin:20px 0;border-radius:0 8px 8px 0}
    .requirements h4{color:#92400e;margin:0 0 10px}
    .requirements ul{margin:0;padding-left:20px}
    .requirements li{padding:4px 0;color:#78350f;font-size:14px}
    .footer{text-align:center;padding:20px;font-size:12px;color:#9ca3af;background:#f1f5f9}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${schoolName}</h1>
      <p>PDC Schedule Confirmation</p>
    </div>
    <div class="content">
      <h2 style="margin-top:0">Hi ${firstName} ${lastName}! 👋</h2>
      <div class="alert-box">
        <div class="icon">🎉</div>
        <h2>Your PDC Schedule is Confirmed!</h2>
        <p>Your Practical Driving Course schedule has been assigned by our branch manager. Please review your schedule details below.</p>
      </div>

      <div class="section-title">Your PDC Schedule(s)</div>
      ${courseCardsHtml}

      ${branchName ? `
      <div style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:16px 20px;margin-top:20px;">
        <div class="section-title">Branch Information</div>
        <div class="info-row"><span class="info-label">Branch:&nbsp;&nbsp;</span><span class="info-value">${branchName}</span></div>
      </div>` : ''}

      <div class="requirements" style="margin-top:20px">
        <h4>📋 What to Bring on Your First Day</h4>
        <ul>
          <li>Valid Government-Issued ID (Driver's License or any ID)</li>
          <li>Student's Permit (if applicable)</li>
          <li>Comfortable clothing suitable for driving</li>
          <li>Any remaining balance payment (if downpayment was made)</li>
        </ul>
      </div>

      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 18px;margin-top:16px;font-size:13px;color:#1e40af;">
        ⏰ <strong>Important:</strong> Please arrive at least 10 minutes before your scheduled session. If you need to reschedule, contact the branch as soon as possible.
      </div>

      <p style="text-align:center;margin-top:24px">
        <a href="${getFrontendUrl()}/profile" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#1a4fba,#3b82f6);color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">
          View in My Account
        </a>
      </p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${schoolName}. All rights reserved.</p>
      <p>This is an automated message — please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>`,
      text: `Hi ${firstName} ${lastName}!\n\nYour PDC schedule has been assigned.\n\n${plainCourses}\n\n${branchName ? `Branch: ${branchName}\n\n` : ''}What to bring: Valid ID, Student's Permit (if any), comfortable clothing, and any remaining payment.\n\nThank you for choosing ${schoolName}!`,
    };

    const info = await sendMailWithFallback(transporter, mailOptions);
    console.log('✅ PDC schedule assignment email sent to:', email);
    return true;
  } catch (error) {
    console.error('❌ PDC schedule assignment email failed:', error.message);
    throw error;
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
  sendEnrollmentEmail,
  sendNoShowEmail,
  sendNewsPromoEmail,
  sendPaymentReceiptEmail,
  sendPdcScheduleAssignedEmail,
};
