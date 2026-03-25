const pool = require('../config/db');
const { sendGuestEnrollmentEmail } = require('../utils/emailService');

// Create new booking
const createBooking = async (req, res) => {
  try {
    const { courseId, branchId, bookingDate, bookingTime, notes, totalAmount, paymentType, paymentMethod, hasReviewer, hasVehicleTips, scheduleDate2, scheduleSlotId, scheduleSlotId2 } = req.body;
    const mergedNotes = JSON.stringify({ source: 'manual', note: notes, hasReviewer, hasVehicleTips });
    const userId = req.user.id;

    // Validate required fields
    if (!courseId || !branchId) {
      return res.status(400).json({ error: 'Please provide all required fields' });
    }

    // Automatically set status to 'paid' if payment type is Full Payment
    const status = paymentType === 'Full Payment' ? 'paid' : 'collectable';

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
      [userId, courseId, branchId, bookingDate, validBookingTime, mergedNotes, totalAmount, paymentType || 'Full Payment', paymentMethod || 'Online Payment', status]
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
            const { sendGuestEnrollmentEmail } = require('../utils/emailService');
            
            await sendGuestEnrollmentEmail(u.email, u.first_name, u.last_name, {
                courseName: c.name,
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
                amountPaid: totalAmount,
                paymentStatus: paymentType || 'Full Payment',
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

    // Validate status
    const validStatuses = ['collectable', 'paid', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await pool.query(
      `UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [status, id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
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
