const pool = require('../config/db');

// Get slots for a specific date
const getSlotsByDate = async (req, res) => {
  try {
    const { date, branch_id } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }

    let query = `
      SELECT 
        ss.*,
        json_agg(
          json_build_object(
            'id', se.id,
            'student', json_build_object(
              'first_name', u.first_name,
              'last_name', u.last_name,
              'contact_numbers', u.contact_numbers
            ),
            'enrollment_status', se.enrollment_status
          )
        ) FILTER (WHERE se.id IS NOT NULL) as enrollments
      FROM schedule_slots ss
      LEFT JOIN schedule_enrollments se ON ss.id = se.slot_id
      LEFT JOIN users u ON se.student_id = u.id
      WHERE ss.date = $1
    `;
    
    const params = [date];

    if (branch_id) {
      query += ' AND ss.branch_id = $2';
      params.push(branch_id);
    }

    query += ' GROUP BY ss.id ORDER BY ss.time_range';

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Get slots by date error:', error);
    res.status(500).json({ error: 'Server error while fetching slots' });
  }
};

// Create new slot
const createSlot = async (req, res) => {
  try {
    const { date, type, session, time_range, total_capacity, available_slots, branch_id } = req.body;

    if (!date || !type || !session || !time_range || !total_capacity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO schedule_slots (date, type, session, time_range, total_capacity, available_slots, branch_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [date, type, session, time_range, total_capacity, available_slots || total_capacity, branch_id || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create slot error:', error);
    res.status(500).json({ error: 'Server error while creating slot' });
  }
};

// Update slot
const updateSlot = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, session, time_range, total_capacity, available_slots } = req.body;

    // Log received data for debugging
    console.log('Update slot request:', {
      id,
      type,
      session,
      time_range,
      total_capacity,
      available_slots,
      body: req.body
    });

    // Validate required fields
    if (!type || !session || !time_range || total_capacity === undefined || available_slots === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        received: { type, session, time_range, total_capacity, available_slots }
      });
    }

    const result = await pool.query(
      `UPDATE schedule_slots 
       SET type = $1, session = $2, time_range = $3, total_capacity = $4, available_slots = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [type, session, time_range, total_capacity, available_slots, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update slot error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Server error while updating slot' });
  }
};

// Delete slot
const deleteSlot = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM schedule_slots WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    res.json({ success: true, message: 'Slot deleted successfully' });
  } catch (error) {
    console.error('Delete slot error:', error);
    res.status(500).json({ error: 'Server error while deleting slot' });
  }
};

// Get enrollments for a slot
const getSlotEnrollments = async (req, res) => {
  try {
    const { slotId } = req.params;

    const result = await pool.query(
      `SELECT 
        se.*,
        json_build_object(
          'id', u.id,
          'first_name', u.first_name,
          'last_name', u.last_name,
          'contact_numbers', u.contact_numbers,
          'email', u.email
        ) as student
       FROM schedule_enrollments se
       JOIN users u ON se.student_id = u.id
       WHERE se.slot_id = $1
       ORDER BY se.created_at`,
      [slotId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get slot enrollments error:', error);
    res.status(500).json({ error: 'Server error while fetching enrollments' });
  }
};

// Enroll student in slot
const enrollStudent = async (req, res) => {
  try {
    const { slotId } = req.params;
    const { student_id, enrollment_status } = req.body;

    if (!student_id) {
      return res.status(400).json({ error: 'Student ID is required' });
    }

    // Check if slot has available capacity
    const slotCheck = await pool.query('SELECT available_slots FROM schedule_slots WHERE id = $1', [slotId]);
    
    if (slotCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    if (slotCheck.rows[0].available_slots <= 0) {
      return res.status(400).json({ error: 'No available slots' });
    }

    // Create enrollment
    const result = await pool.query(
      `INSERT INTO schedule_enrollments (slot_id, student_id, enrollment_status)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [slotId, student_id, enrollment_status || 'enrolled']
    );

    // Decrease available slots
    await pool.query(
      'UPDATE schedule_slots SET available_slots = available_slots - 1 WHERE id = $1',
      [slotId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Enroll student error:', error);
    res.status(500).json({ error: 'Server error while enrolling student' });
  }
};

// Update enrollment status
const updateEnrollmentStatus = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const { status } = req.body;

    const result = await pool.query(
      `UPDATE schedule_enrollments 
       SET enrollment_status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, enrollmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update enrollment status error:', error);
    res.status(500).json({ error: 'Server error while updating enrollment' });
  }
};

// Cancel enrollment
const cancelEnrollment = async (req, res) => {
  try {
    const { enrollmentId } = req.params;

    // Get slot_id before deleting
    const enrollment = await pool.query('SELECT slot_id FROM schedule_enrollments WHERE id = $1', [enrollmentId]);
    
    if (enrollment.rows.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    const slotId = enrollment.rows[0].slot_id;

    // Delete enrollment
    await pool.query('DELETE FROM schedule_enrollments WHERE id = $1', [enrollmentId]);

    // Increase available slots
    await pool.query(
      'UPDATE schedule_slots SET available_slots = available_slots + 1 WHERE id = $1',
      [slotId]
    );

    res.json({ success: true, message: 'Enrollment cancelled successfully' });
  } catch (error) {
    console.error('Cancel enrollment error:', error);
    res.status(500).json({ error: 'Server error while cancelling enrollment' });
  }
};

module.exports = {
  getSlotsByDate,
  createSlot,
  updateSlot,
  deleteSlot,
  getSlotEnrollments,
  enrollStudent,
  updateEnrollmentStatus,
  cancelEnrollment,
};
