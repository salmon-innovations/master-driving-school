const fs = require('fs');
const p = 'C:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-backend/utils/emailService.js';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  /<a href="\$\{process\.env\.FRONTEND_URL \|\| 'http:\/\/localhost:5173'\}\/login"\s*class="btn">\$\{EMAIL_CONTENT\.noShow\.loginButtonText\}<\/a>/g,
  '<a href="" class="btn"></a>'
);

c = c.replace(
  /<a href="\$\{process\.env\.FRONTEND_URL \|\| 'http:\/\/localhost:5173'\}" style="display: inline-block; padding: 12px 24px; background-color: #1a4fba; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">\$\{EMAIL_CONTENT\.news\.visitButton\}<\/a>/g,
  '<a href="" style="display: inline-block; padding: 12px 24px; background-color: #1a4fba; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;"></a>'
);

c = c.replace(
  /<a href="\$\{process\.env\.FRONTEND_URL \|\| 'http:\/\/localhost:5173'\}\/profile"/g,
  '<a href=""'
);

c = c.replace(
  /<a href="\$\{process\.env\.FRONTEND_URL \|\| 'http:\/\/localhost:5173'\}\/verify-email\?email=\$\{encodeURIComponent\(email\)\}"\s*class="btn">\$\{EMAIL_CONTENT\.guest\.verifyButtonText\}<\/a>/g,
  '<a href="" class="btn"></a>'
);


fs.writeFileSync(p, c);
console.log('patched');
