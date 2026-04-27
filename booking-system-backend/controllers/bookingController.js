const pool = require('../config/db');
const { sendEnrollmentEmail } = require('../utils/emailService');

// Create new booking
const createBooking = async (req, res) => {
  try {
    const { courseId, branchId, bookingDate, bookingTime, notes, amount, totalAmount, paymentType, paymentMethod, hasReviewer, hasVehicleTips, scheduleDate2, scheduleSlotId, scheduleSlotId2 } = req.body;
    const amountPaid = amount || totalAmount;
    const assessedTotal = totalAmount || amount;

    const mergedNotes = JSON.stringify({ source: 'manual', note: notes, hasReviewer, hasVehicleTips });
    const userId = req.user.id;

    // Validate required fields
    if (!courseId || !branchId) {
      return res.status(400).json({ error: 'Please provide all required fields' });
    }

    // Automatically set status based on payment type, BUT ONLY if Staff/Admin.
    // Students can NEVER create a 'paid' booking manually; they must go through StarPay.
    const userRole = (req.user?.role || 'student').toLowerCase();
    const isStaff = userRole !== 'student' && userRole !== 'user';
    
    let status = 'pending';
    if (isStaff) {
      const toAmount = (v) => {
        if (v == null) return 0;
        const n = Number(String(v).replace(/[^0-9.-]/g, ''));
        return Number.isFinite(n) ? n : 0;
      };
      const isExplicitFull = String(paymentType || '').toLowerCase().trim() === 'full payment';
      const isPaidInFull = (toAmount(amountPaid) >= toAmount(assessedTotal) - 0.009) && toAmount(assessedTotal) > 0;
      status = (isExplicitFull || isPaidInFull) ? 'paid' : 'partial_payment';
    } else {
      // Force pending for students. They should be using the StarPay flow anyway.
      status = 'pending';
    }

    // Format booking time properly (e.g., convert 'N/A' to null)
    let validBookingTime = (bookingTime === 'N/A' || !bookingTime) ? null : bookingTime;
    
    // Parse time range like "08:00 AM - 05:00 PM" into PostgreSQL time format (e.g., "08:00:00")
    if (validBookingTime && validBookingTime.includes('-')) {
      const startTimeStr = validBookingTime.split('-')[0].trim();
      const match = startTimeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (match) {
        let [ , hours, minutes, modifier ] = match;
        let hrs = parseInt(hours, 10);
        if (modifier) {
          if (modifier.toUpperCase() === 'PM' && hrs < 12) hrs += 12;
          if (modifier.toUpperCase() === 'AM' && hrs === 12) hrs = 0;
        }
        validBookingTime = `${hrs.toString().padStart(2, '0')}:${minutes}:00`;
      } else {
        validBookingTime = null; // Fallback for unparseable time
      }
    }

    // Insert booking
    const result = await pool.query(
      `INSERT INTO bookings (user_id, course_id, branch_id, booking_date, booking_time, notes, total_amount, payment_type, payment_method, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [userId, courseId, branchId, bookingDate, validBookingTime, mergedNotes, amountPaid, paymentType || 'Full Payment', paymentMethod || 'Online Payment', status]
    );

    // Send addons if any
    
    
    // Send enrollment confirmation (and addons if requested)
    if (scheduleSlotId) {
        const s1 = await pool.query('SELECT session, time_range FROM schedule_slots WHERE id = $1', [scheduleSlotId]);
        if (s1.rows.length) { req.body._session1 = s1.rows[0].session; req.body._time1 = s1.rows[0].time_range; }
    }
    if (scheduleSlotId2) {
        const s2 = await pool.query('SELECT session, time_range FROM schedule_slots WHERE id = $1', [scheduleSlotId2]);
        if (s2.rows.length) { req.body._session2 = s2.rows[0].session; req.body._time2 = s2.rows[0].time_range; }
    }

    try {
        const userQ = await pool.query('SELECT email, first_name, last_name FROM users WHERE id = $1', [userId]);
        const branchQ = await pool.query('SELECT name, address FROM branches WHERE id = $1', [branchId]);
        const courseQ = await pool.query('SELECT name, category FROM courses WHERE id = $1', [courseId]);
        
        if (userQ.rows.length && branchQ.rows.length && courseQ.rows.length) {
            const u = userQ.rows[0];
            const b = branchQ.rows[0];
            const c = courseQ.rows[0];
            const { sendEnrollmentEmail } = require('../utils/emailService');
            
            // Dynamic 3% Multi-course discount fallback for email
            const isManualBundle = !!req.body.isManualBundle;
            
            let effectivePromo = Number(req.body.promoDiscount || 0);
            let effectivePromoPct = Number(req.body.promoPct || 0);
            
            if (effectivePromo === 0 && isManualBundle) {
                const subtotalForDynamic = Number(req.body.subtotal || 0);
                effectivePromo = Number((subtotalForDynamic * 0.03).toFixed(2));
                effectivePromoPct = 3;
            }

            await sendEnrollmentEmail(u.email, u.first_name, u.last_name, {
              bookingId: result.rows[0]?.id || null,
                courseName: c.name,
              courseList: courseList,
              addonsDetailed: Array.isArray(req.body.addonsDetailed) ? req.body.addonsDetailed : [],
                courseCategory: c.category || req.body.courseCategory || 'PDC',
                courseType: c.type || req.body.courseType || 'f2f',
                branchName: b.name,
                branchAddress: b.address,
                scheduleDate: bookingDate,
                
                scheduleSession: req.body._session1 || 'Session',
                scheduleTime: req.body._time1 || bookingTime || 'N/A',
                scheduleDate2: scheduleDate2 || null,
                scheduleSession2: req.body._session2 || null,
                scheduleTime2: req.body._time2 || null,
 
                paymentMethod: paymentMethod || 'Cash',
                amountPaid: amountPaid,
                paymentStatus: paymentType || 'Full Payment',
                subtotal: req.body.subtotal || 0,
                promoDiscount: effectivePromo,
                promoPct: effectivePromoPct,
                isManualBundle: isManualBundle,
                convenienceFee: Number(req.body.convenienceFee || 0),
                totalAmount: Number(req.body.totalAmount || req.body.grandTotal || req.body.finalTotal || 0),
            }, hasReviewer, hasVehicleTips);
        }
    } catch (e) {
        console.error('Failed to send enrollment email:', e);
    }


    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      booking: result.rows[0],
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Server error while creating booking', details: error.message });
  }
};

// Get all bookings for current user
const getUserBookings = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT b.*, c.name as course_name, c.price as course_price, 
       br.name as branch_name, br.address as branch_address
       FROM bookings b
       LEFT JOIN courses c ON b.course_id = c.id
       LEFT JOIN branches br ON b.branch_id = br.id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      bookings: result.rows,
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Server error while fetching bookings' });
  }
};

// Get single booking by ID
const getBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT b.*, c.name as course_name, c.price as course_price, c.description as course_description,
       br.name as branch_name, br.address as branch_address, br.contact_number as branch_contact
       FROM bookings b
       LEFT JOIN courses c ON b.course_id = c.id
       LEFT JOIN branches br ON b.branch_id = br.id
       WHERE b.id = $1 AND b.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({
      success: true,
      booking: result.rows[0],
    });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ error: 'Server error while fetching booking' });
  }
};

// Update booking status
const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;
    const userRole = (req.user?.role || 'student').toLowerCase();

    // DEBUG LOG
    const fs = require('fs');
    try {
        fs.appendFileSync('debug_logs.txt', `[${new Date().toISOString()}] UPDATE REQ: id=${id}, userId=${userId}, role=${userRole}, status=${status}\n`);
    } catch (e) {}

    // Normalize status to lowercase for comparison
    const normalizedStatus = String(status || '').toLowerCase();

    // Validate status
    const validStatuses = ['partial_payment', 'paid', 'cancelled'];
    if (!validStatuses.includes(normalizedStatus)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Security Harden: Students can only cancel. Paid/Partial status updates require admin/staff.
    const isStaff = userRole !== 'student' && userRole !== 'user';
    if (!isStaff && normalizedStatus !== 'cancelled') {
        return res.status(403).json({ error: 'You do not have permission to mark a booking as paid. Please complete payment via the gateway.' });
    }

    try {
        fs.appendFileSync('debug_logs.txt', `[${new Date().toISOString()}] UPDATE EXEC: isStaff=${isStaff}, id=${id}, userId=${userId}, normStatus=${normalizedStatus}\n`);
    } catch (e) {}

    const result = await pool.query(
      `UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 ${!isStaff ? "AND user_id = $3 AND status IN ('pending', 'partial_payment')" : ''}
       RETURNING *`,
      !isStaff ? [normalizedStatus, id, userId] : [normalizedStatus, id]
    );

    if (result.rows.length === 0) {
      // Check WHY it was 0 rows.
      if (!isStaff) {
          const { rows } = await pool.query(`SELECT status, user_id FROM bookings WHERE id = $1`, [id]);
          if (rows.length > 0) {
              try { fs.appendFileSync('debug_logs.txt', `[${new Date().toISOString()}] UPDATE FAIL: DB status is ${rows[0].status}, user is ${rows[0].user_id} (Expected pending & ${userId})\n`); } catch(e){}
              return res.status(400).json({ error: `Cannot cancel a booking that is currently ${rows[0].status}.` });
          }
      }
      return res.status(404).json({ error: 'Booking not found' });
    }

    // If cancelled, reclaim slots
    if (normalizedStatus === 'cancelled' && result.rows[0]) {
        try {
            const meta = JSON.parse(result.rows[0].notes || '{}');
            // Helper function to extract slot IDs (assuming it exists or using a quick regex)
            const slotIds = [];
            if (meta.slotId) slotIds.push(meta.slotId);
            if (meta.slotId2) slotIds.push(meta.slotId2);
            if (meta.pdcSelections) {
                Object.values(meta.pdcSelections).forEach(s => {
                    if (s.pdcSlot) slotIds.push(s.pdcSlot);
                    if (s.pdcSlot2) slotIds.push(s.pdcSlot2);
                });
            }
            for (const sId of [...new Set(slotIds)].filter(Boolean)) {
                await pool.query('UPDATE schedule_slots SET available_slots = available_slots + 1 WHERE id = $1', [sId]);
            }
        } catch (e) {
            console.error('Failed to reclaim slots during manual cancellation:', e);
        }
    }

    res.json({
      success: true,
      message: 'Booking status updated successfully',
      booking: result.rows[0],
    });
  } catch (error) {
    console.error('Update booking error:', error);
    res.status(500).json({ error: 'Server error while updating booking' });
  }
};

// Delete booking
const deleteBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      'DELETE FROM bookings WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({
      success: true,
      message: 'Booking deleted successfully',
    });
  } catch (error) {
    console.error('Delete booking error:', error);
    res.status(500).json({ error: 'Server error while deleting booking' });
  }
};

module.exports = {
  createBooking,
  getUserBookings,
  getBookingById,
  updateBookingStatus,
  deleteBooking,
};
