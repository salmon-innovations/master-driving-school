const fs=require('fs'); 
let code=fs.readFileSync('c:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-backend/controllers/authController.js', 'utf8');

code = code.replace(/const \{ generateVerificationCode, sendVerificationEmail, sendGuestEnrollmentEmail \} = require\('\.\.\/utils\/emailService'\);/,
`const { generateVerificationCode, sendVerificationEmail, sendGuestEnrollmentEmail, sendAddonsEmail } = require('../utils/emailService');`);

code = code.replace(/paymentMethod, amountPaid, paymentStatus\r?\n\s+\} = req\.body;/,
`paymentMethod, amountPaid, paymentStatus, hasReviewer, hasVehicleTips\n      } = req.body;`);

const newEmailCall = `
    try {
      await sendGuestEnrollmentEmail(email, firstName, lastName, {
        courseName: courseResult.rows[0]?.name || 'N/A',
        courseCategory: courseCategory || courseResult.rows[0]?.category || 'PDC',
        courseType,
        branchName: branchResult.rows[0]?.name || 'N/A',
        branchAddress: branchResult.rows[0]?.address || '',
        scheduleDate,
        scheduleSession: slotResult.rows[0]?.session || 'N/A',
        scheduleTime: slotResult.rows[0]?.time_range || 'N/A',
        scheduleDate2: scheduleDate2Email,
        scheduleSession2: scheduleSession2Email,
        scheduleTime2: scheduleTime2Email,
        paymentMethod,
        amountPaid,
        paymentStatus
      });
      
      if (hasReviewer || hasVehicleTips) {
        await sendAddonsEmail(email, firstName, lastName, hasReviewer, hasVehicleTips);
      }
    } catch (e) {
      console.error('Email failed (proceeding):', e);
    }`;

code = code.replace(/try\s*\{\s*await sendGuestEnrollmentEmail\([\s\S]+?\}\s*catch[\s\S]+?\}/, newEmailCall);

fs.writeFileSync('c:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-backend/controllers/authController.js', code);
console.log("Updated authController.js");