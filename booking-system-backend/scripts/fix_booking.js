const fs=require('fs'); 
let code=fs.readFileSync('c:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-backend/controllers/bookingController.js', 'utf8'); 

const replacement = `const pool = require('../config/db');
const { sendAddonsEmail } = require('../utils/emailService');

// Create new booking
const createBooking = async (req, res) => {
  try {
    const { courseId, branchId, bookingDate, bookingTime, notes, totalAmount, paymentType, paymentMethod, hasReviewer, hasVehicleTips } = req.body;
    const mergedNotes = JSON.stringify({ source: 'manual', note: notes, hasReviewer, hasVehicleTips });
    const userId = req.user.id;

    // Validate required fields
    if (!courseId || !branchId) {
      return res.status(400).json({ error: 'Please provide all required fields' });
    }

    // Automatically set status to 'paid' if payment type is Full Payment
    const status = paymentType === 'Full Payment' ? 'paid' : 'collectable';

    // Insert booking
    const result = await pool.query(
      \`INSERT INTO bookings (user_id, course_id, branch_id, booking_date, booking_time, notes, total_amount, payment_type, payment_method, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *\`,
      [userId, courseId, branchId, bookingDate, bookingTime, mergedNotes, totalAmount, paymentType || 'Full Payment', paymentMethod || 'Online Payment', status]
    );

    // Send addons if any
    if (hasReviewer || hasVehicleTips) {
        const userQ = await pool.query(\`SELECT email, first_name, last_name FROM users WHERE id = $1\`, [userId]);
        if (userQ.rows.length) {
           const u = userQ.rows[0];
           await sendAddonsEmail(u.email, u.first_name, u.last_name, hasReviewer, hasVehicleTips);
        }
    }

    res.status(201).json({`;

code = code.replace(/const pool = require\('\.\.\/config\/db'\);[\s\S]+?res\.status\(201\)\.json\(\{/, replacement); 
fs.writeFileSync('c:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-backend/controllers/bookingController.js', code);