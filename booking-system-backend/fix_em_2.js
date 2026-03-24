const fs = require('fs');

const f = 'C:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-backend/utils/emailService.js';
let content = fs.readFileSync(f, 'utf8');

const targetStr = `    const isTricycle = courseNameLower.includes('a1') || courseNameLower.includes('tricycle');

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: EMAIL_CONTENT.guest.subject,
      attachments,
      html: \``;

const repStr = `    const isTricycle = courseNameLower.includes('a1') || courseNameLower.includes('tricycle');

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
      from: process.env.EMAIL_FROM,
      to: email,
      subject: EMAIL_CONTENT.guest.subject,
      attachments,
      html: \``;

content = content.replace(targetStr, repStr);
fs.writeFileSync(f, content);
console.log('Fixed attachments definition');
