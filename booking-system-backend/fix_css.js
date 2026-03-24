const fs = require('fs');
let code = fs.readFileSync('C:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-backend/utils/emailService.js', 'utf8');

const oldCss1 = '.detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }';
const newCss1 = '.detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f3f4f6; clear: both; overflow: hidden; }';

const oldCss2 = '.detail-label { font-weight: 600; color: #6b7280; font-size: 14px; }';
const newCss2 = '.detail-label { font-weight: 600; color: #6b7280; font-size: 14px; float: left; width: 40%; }';

const oldCss3 = '.detail-value { font-weight: 600; color: #1f2937; font-size: 14px; }';
const newCss3 = '.detail-value { font-weight: 600; color: #1f2937; font-size: 14px; float: right; text-align: right; width: 55%; word-wrap: break-word; }';

code = code.replaceAll(oldCss1, newCss1);
code = code.replaceAll(oldCss2, newCss2);
code = code.replaceAll(oldCss3, newCss3);

// Fallback plain space
code = code.replaceAll('class="detail-label">Course:', 'class="detail-label">Course:&nbsp;&nbsp;');
code = code.replaceAll('class="detail-label">Type:', 'class="detail-label">Type:&nbsp;&nbsp;');
code = code.replaceAll('class="detail-label">Branch:', 'class="detail-label">Branch:&nbsp;&nbsp;');
code = code.replaceAll('class="detail-label">Branch Address:', 'class="detail-label">Branch Address:&nbsp;&nbsp;');
code = code.replaceAll('class="detail-label">Payment Method:', 'class="detail-label">Payment Method:&nbsp;&nbsp;');
code = code.replaceAll('class="detail-label">Amount Paid:', 'class="detail-label">Amount Paid:&nbsp;&nbsp;');
code = code.replaceAll('class="detail-label">Payment Status:', 'class="detail-label">Payment Status:&nbsp;&nbsp;');

fs.writeFileSync('C:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-backend/utils/emailService.js', code);
console.log('CSS updated');
