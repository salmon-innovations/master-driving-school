const fs = require('fs');
let code = fs.readFileSync('C:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-backend/controllers/bookingController.js', 'utf8');

const regex = /const \{ courseId, branchId, bookingDate, bookingTime, notes, totalAmount, paymentType, paymentMethod, hasReviewer, hasVehicleTips \} = req\.body;/;
const replaceStr = "const { courseId, branchId, bookingDate, bookingTime, notes, totalAmount, paymentType, paymentMethod, hasReviewer, hasVehicleTips, scheduleDate2, scheduleSlotId, scheduleSlotId2 } = req.body;";
code = code.replace(regex, replaceStr);

const emailBlockRegex = /scheduleSession: 'Session',\s*scheduleTime: bookingTime \|\| 'N\/A',/s;
const emailBlockReplace = `
                scheduleSession: req.body._session1 || 'Session',
                scheduleTime: req.body._time1 || bookingTime || 'N/A',
                scheduleDate2: scheduleDate2 || null,
                scheduleSession2: req.body._session2 || null,
                scheduleTime2: req.body._time2 || null,
`;
code = code.replace(emailBlockRegex, emailBlockReplace);

const lookupRegex = /\/\/ Send enrollment confirmation \(and addons if requested\)/;
const lookupReplace = `
    // Send enrollment confirmation (and addons if requested)
    if (scheduleSlotId) {
        const s1 = await pool.query('SELECT session, time_range FROM schedule_slots WHERE id = $1', [scheduleSlotId]);
        if (s1.rows.length) { req.body._session1 = s1.rows[0].session; req.body._time1 = s1.rows[0].time_range; }
    }
    if (scheduleSlotId2) {
        const s2 = await pool.query('SELECT session, time_range FROM schedule_slots WHERE id = $1', [scheduleSlotId2]);
        if (s2.rows.length) { req.body._session2 = s2.rows[0].session; req.body._time2 = s2.rows[0].time_range; }
    }
`;
code = code.replace(lookupRegex, lookupReplace);

fs.writeFileSync('C:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-backend/controllers/bookingController.js', code);
console.log('Updated bookingController.js');