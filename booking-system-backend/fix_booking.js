const fs = require('fs');
let code = fs.readFileSync('C:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-backend/controllers/bookingController.js', 'utf8');

const regex = /if \(hasReviewer \|\| hasVehicleTips\) \{\s*const userQ = await pool\.query\(`SELECT email, first_name, last_name FROM users WHERE id = \$1`, \[userId\]\);\s*if \(userQ\.rows\.length\) \{\s*const u = userQ\.rows\[0\];\s*await sendAddonsEmail\(u\.email, u\.first_name, u\.last_name, hasReviewer, hasVehicleTips\);\s*\}\s*\}/;

const replaceStr = `
    // Send enrollment confirmation (and addons if requested)
    try {
        const userQ = await pool.query('SELECT email, first_name, last_name FROM users WHERE id = $1', [userId]);
        const branchQ = await pool.query('SELECT name, address FROM branches WHERE id = $1', [branchId]);
        const courseQ = await pool.query('SELECT name, category, type FROM courses WHERE id = $1', [courseId]);
        
        if (userQ.rows.length && branchQ.rows.length && courseQ.rows.length) {
            const u = userQ.rows[0];
            const b = branchQ.rows[0];
            const c = courseQ.rows[0];
            const { sendGuestEnrollmentEmail } = require('../utils/emailService');
            
            await sendGuestEnrollmentEmail(u.email, u.first_name, u.last_name, {
                courseName: c.name,
                courseCategory: c.category || req.body.courseCategory || 'PDC',
                courseType: c.type || req.body.courseType || 'f2f',
                branchName: b.name,
                branchAddress: b.address,
                scheduleDate: bookingDate,
                scheduleSession: 'Session',
                scheduleTime: bookingTime || 'N/A',
                paymentMethod: paymentMethod || 'Cash',
                amountPaid: totalAmount,
                paymentStatus: paymentType || 'Full Payment',
            }, hasReviewer, hasVehicleTips);
        }
    } catch (e) {
        console.error('Failed to send enrollment email:', e);
    }
`;

code = code.replace(/const \{ sendAddonsEmail \} = require\('\.\.\/utils\/emailService'\);/, "const { sendAddonsEmail, sendGuestEnrollmentEmail } = require('../utils/emailService');");
code = code.replace(regex, replaceStr);

fs.writeFileSync('C:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-backend/controllers/bookingController.js', code);
console.log('bookingController updated');