const fs = require('fs');
const file = 'C:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-backend/utils/emailService.js';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  /const sendGuestEnrollmentEmail = async \(email, firstName, lastName, enrollmentDetails\) => \{/,
  'const sendGuestEnrollmentEmail = async (email, firstName, lastName, enrollmentDetails, hasReviewer = false, hasVehicleTips = false) => {'
);

const attachmentsLogic = `
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
`;
data = data.replace(
  /    const mailOptions = \{/,
  attachmentsLogic + '\n    const mailOptions = {'
);

data = data.replace(
  /      subject: EMAIL_CONTENT\.guest\.subject,/,
  '      subject: EMAIL_CONTENT.guest.subject,\n      attachments,'
);

const addonsHtml = `
              \${items.length > 0 ? \`
              <div class="section" style="background: #e0f2fe; border-left: 4px solid #3b82f6;">
                <h3 style="color: #1e40af; margin-top: 0;">🎁 Your Requested Add-ons</h3>
                <p style="margin: 0 0 10px 0; font-size: 14px;">Thank you for availing our additional review materials! We have attached them directly to this email.</p>
                <ul style="margin: 0; padding-left: 20px; font-weight: bold; color: #1e3a8a;">
                  \${items.map(i => \`<li>\${i}</li>\`).join('')}
                </ul>
              </div>
              \` : ''}
`;

data = data.replace(
  /(<div class="section">\s*?<h3>\$\{EMAIL_CONTENT\.guest\.detailsHeading\}<\/h3>)/,
  addonsHtml + '\n              $1'
);

fs.writeFileSync(file, data);
console.log('emailService.js updated');
