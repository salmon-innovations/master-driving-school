const pool = require('../config/db');
const { sendNoShowEmail, sendPaymentReceiptEmail } = require('../utils/emailService');

const GLOBAL_B1B2_DAILY_CAPACITY = 2;

const isB1B2CourseType = (courseType = '') => {
  const src = String(courseType || '').toLowerCase();
  return src.includes('b1') || src.includes('b2') || src.includes('van') || src.includes('l300');
};

const extractSlotIdsFromNotes = (notes) => {
  let meta = notes;
  if (typeof meta === 'string') {
    try {
      meta = JSON.parse(meta);
    } catch {
      return [];
    }
  }
  if (!meta || typeof meta !== 'object') return [];

  const slotIds = [];
  if (meta.scheduleSlotId) slotIds.push(meta.scheduleSlotId);
  if (meta.scheduleSlotId2) slotIds.push(meta.scheduleSlotId2);

  const pdcSelections = meta.pdcSelections || {};
  Object.values(pdcSelections).forEach((sel) => {
    if (sel?.pdcSlot) slotIds.push(sel.pdcSlot);
    if (sel?.pdcSlot2) slotIds.push(sel.pdcSlot2);
    if (sel?.slot) slotIds.push(sel.slot);
    if (sel?.slot2) slotIds.push(sel.slot2);
  });

  return [...new Set(slotIds.filter(Boolean).map((id) => Number(id)).filter((id) => Number.isFinite(id)))];
};

const extractSecondDaySlotIdsFromNotes = (notes) => {
  let meta = notes;
  if (typeof meta === 'string') {
    try {
      meta = JSON.parse(meta);
    } catch {
      return [];
    }
  }
  if (!meta || typeof meta !== 'object') return [];

  const secondDayIds = [];
  if (meta.scheduleSlotId2) secondDayIds.push(meta.scheduleSlotId2);
  if (meta.promoPdcSlotId2) secondDayIds.push(meta.promoPdcSlotId2);

  const pdcSelections = meta.pdcSelections || {};
  Object.values(pdcSelections).forEach((sel) => {
    if (sel?.pdcSlot2) secondDayIds.push(sel.pdcSlot2);
    if (sel?.slot2) secondDayIds.push(sel.slot2);
    if (sel?.promoPdcSlotId2) secondDayIds.push(sel.promoPdcSlotId2);
  });

  return [...new Set(secondDayIds.filter(Boolean).map((id) => Number(id)).filter((id) => Number.isFinite(id)))];
};

const getGlobalB1B2BookedCount = async (client, date, excludeStudentId = null) => {
  const db = client && typeof client.query === 'function' ? client : pool;
  const enrolledResult = await db.query(
    `SELECT COUNT(DISTINCT se.student_id) AS booked_count
       FROM schedule_enrollments se
       JOIN schedule_slots ss ON ss.id = se.slot_id
      WHERE ss.date = $1
        AND (ss.course_type ILIKE '%B1%' OR ss.course_type ILIKE '%B2%' OR ss.course_type ILIKE '%VAN%' OR ss.course_type ILIKE '%L300%')
        AND se.enrollment_status NOT IN ('cancelled', 'no-show')`,
    [date]
  );

  const enrolledCount = Number(enrolledResult.rows[0]?.booked_count || 0);

  const pendingBookings = await db.query(
    `SELECT user_id, notes
       FROM bookings
      WHERE LOWER(COALESCE(status, '')) = 'pending'
        AND created_at >= NOW() - INTERVAL '20 minutes'`
  );

  const pendingSlotIds = [...new Set(
    pendingBookings.rows.flatMap((row) => extractSlotIdsFromNotes(row.notes))
  )];
  const pendingHolders = new Set();
  if (pendingSlotIds.length > 0) {
    const slotMetaResult = await db.query(
      `SELECT id, to_char(date, 'YYYY-MM-DD') AS date, course_type
         FROM schedule_slots
        WHERE id = ANY($1::int[])`,
      [pendingSlotIds]
    );

    const slotMetaById = new Map();
    slotMetaResult.rows.forEach((row) => {
      slotMetaById.set(Number(row.id), row);
    });

    pendingBookings.rows.forEach((row) => {
      if (excludeStudentId != null && String(row.user_id) === String(excludeStudentId)) return;
      const slotIds = extractSlotIdsFromNotes(row.notes);
      const hasMatchingB1B2Slot = slotIds.some((slotId) => {
        const meta = slotMetaById.get(Number(slotId));
        if (!meta) return false;
        return String(meta.date) === String(date) && isB1B2CourseType(meta.course_type);
      });
      if (hasMatchingB1B2Slot) {
        pendingHolders.add(String(row.user_id));
      }
    });
  }

  const activeBookings = await db.query(
    `SELECT user_id, notes
       FROM bookings
      WHERE LOWER(COALESCE(status, '')) IN ('pending', 'partial_payment', 'paid', 'confirmed', 'completed')`
  );

  const secondDaySlotsByUser = [];
  activeBookings.rows.forEach((row) => {
    if (excludeStudentId != null && String(row.user_id) === String(excludeStudentId)) return;
    const secondDayIds = extractSecondDaySlotIdsFromNotes(row.notes);
    if (secondDayIds.length > 0) {
      secondDaySlotsByUser.push({ userId: row.user_id, slotIds: secondDayIds });
    }
  });

  const secondDaySlotIds = [...new Set(secondDaySlotsByUser.flatMap((entry) => entry.slotIds))];
  if (secondDaySlotIds.length > 0) {
    const secondDayMeta = await db.query(
      `SELECT id, to_char(date, 'YYYY-MM-DD') AS date, course_type
         FROM schedule_slots
        WHERE id = ANY($1::int[])`,
      [secondDaySlotIds]
    );
    const secondDayMetaById = new Map();
    secondDayMeta.rows.forEach((row) => {
      secondDayMetaById.set(Number(row.id), row);
    });

    const hasSecondDayLock = secondDaySlotsByUser.some((entry) => {
      return entry.slotIds.some((slotId) => {
        const meta = secondDayMetaById.get(Number(slotId));
        if (!meta) return false;
        return String(meta.date) === String(date) && isB1B2CourseType(meta.course_type);
      });
    });

    if (hasSecondDayLock) {
      return GLOBAL_B1B2_DAILY_CAPACITY;
    }
  }

  return enrolledCount + pendingHolders.size;
};

const getRequestBranchScope = async (req) => {
  if (!req.user || !req.user.id) {
    return { role: null, branchId: null, canViewAll: true };
  }

  const role = String(req.user.role || '').toLowerCase();
  if (role === 'super_admin') {
    return { role, branchId: null, canViewAll: true };
  }

  if (role === 'admin') {
    const branchRow = await pool.query('SELECT branch_id FROM users WHERE id = $1', [req.user.id]);
    const branchId = branchRow.rows[0]?.branch_id || null;
    if (role === 'admin') {
      return { role, branchId, canViewAll: !branchId };
    }
  }

  return { role, branchId: null, canViewAll: true };
};

const resolveEffectiveBranchId = (requestedBranchId, scope) => {
  if (scope.canViewAll) return requestedBranchId;
  return scope.branchId || null;
};

const canAccessBranch = (scope, branchId) => {
  if (scope.canViewAll) return true;
  if (!scope.branchId) return false;
  return String(scope.branchId) === String(branchId || '');
};

const getSlotBranchId = async (slotId) => {
  const slotRow = await pool.query('SELECT branch_id FROM schedule_slots WHERE id = $1', [slotId]);
  if (slotRow.rows.length === 0) return null;
  return slotRow.rows[0].branch_id;
};

const getEnrollmentBranchId = async (enrollmentId) => {
  const row = await pool.query(
    `SELECT ss.branch_id
     FROM schedule_enrollments se
     JOIN schedule_slots ss ON ss.id = se.slot_id
     WHERE se.id = $1`,
    [enrollmentId]
  );
  if (row.rows.length === 0) return null;
  return row.rows[0].branch_id;
};

// Get slots (either by specific date, or all upcoming if date is omitted)
const getSlotsByDate = async (req, res) => {
  try {
    const { date, start_date, end_date, branch_id, type } = req.query;
    const scope = await getRequestBranchScope(req);
    if (!scope.canViewAll && !scope.branchId) {
      return res.json([]);
    }
    const requestedBranchId = branch_id ? parseInt(branch_id, 10) : null;
    const effectiveBranchId = resolveEffectiveBranchId(requestedBranchId, scope);

    let query = `
      SELECT 
        ss.id,
        to_char(ss.date, 'YYYY-MM-DD') as date,
        to_char(ss.end_date, 'YYYY-MM-DD') as end_date,
        ss.type,
        ss.session,
        ss.time_range,
        CASE
          WHEN (ss.course_type ILIKE '%B1%' OR ss.course_type ILIKE '%B2%' OR ss.course_type ILIKE '%VAN%' OR ss.course_type ILIKE '%L300%')
            THEN ${GLOBAL_B1B2_DAILY_CAPACITY}
          ELSE ss.total_capacity
        END AS total_capacity,
        CASE
          WHEN (ss.course_type ILIKE '%B1%' OR ss.course_type ILIKE '%B2%' OR ss.course_type ILIKE '%VAN%' OR ss.course_type ILIKE '%L300%') THEN
            GREATEST(
              0,
              ${GLOBAL_B1B2_DAILY_CAPACITY} - (
                SELECT COUNT(DISTINCT se2.student_id)
                FROM schedule_enrollments se2
                JOIN schedule_slots other ON other.id = se2.slot_id
                WHERE other.date = ss.date
                  AND (other.course_type ILIKE '%B1%' OR other.course_type ILIKE '%B2%' OR other.course_type ILIKE '%VAN%' OR other.course_type ILIKE '%L300%')
                  AND se2.enrollment_status NOT IN ('cancelled', 'no-show')
              )
            )
          ELSE ss.available_slots
        END as available_slots,
        ss.branch_id,
        ss.course_type,
        ss.transmission,
        ss.created_at,
        ss.updated_at,
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
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (date) {
      query += ` AND $${paramCount} BETWEEN ss.date AND ss.end_date`;
      params.push(date);
      paramCount++;
    } else if (start_date && end_date) {
      // Overlap logic: slot starts before windown ends AND slot ends after window starts
      query += ` AND ss.date <= $${paramCount + 1} AND COALESCE(ss.end_date, ss.date) >= $${paramCount}`;
      params.push(start_date, end_date);
      paramCount += 2;
    } else if (start_date) {
      query += ` AND ss.date >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    } else {
      query += ` AND ss.date >= CURRENT_DATE`;
    }

    if (effectiveBranchId) {
      // Strict match — only return slots for the specified branch
      query += ` AND ss.branch_id = $${paramCount}`;
      params.push(effectiveBranchId);
      paramCount++;
    }

    if (type) {
      query += ` AND LOWER(ss.type) = LOWER($${paramCount})`;
      params.push(type);
      paramCount++;
    }

    query += ' GROUP BY ss.id ORDER BY ss.date, ss.time_range';

    const result = await pool.query(query, params);
    const slots = result.rows || [];
    const b1b2Dates = [...new Set(
      slots
        .filter((slot) => isB1B2CourseType(slot.course_type))
        .map((slot) => slot.date)
        .filter(Boolean)
    )];

    const engagedByDate = new Map();
    for (const slotDate of b1b2Dates) {
      const engaged = await getGlobalB1B2BookedCount(pool, slotDate);
      engagedByDate.set(slotDate, engaged);
    }

    const normalized = slots.map((slot) => {
      if (!isB1B2CourseType(slot.course_type)) {
        return slot;
      }
      const engaged = engagedByDate.get(slot.date) || 0;
      return {
        ...slot,
        total_capacity: GLOBAL_B1B2_DAILY_CAPACITY,
        available_slots: Math.max(0, GLOBAL_B1B2_DAILY_CAPACITY - engaged),
      };
    });

    res.json(normalized);
  } catch (error) {
    console.error('Get slots error:', error);
    res.status(500).json({ error: 'Server error while fetching slots' });
  }
};

// Create new slot
const createSlot = async (req, res) => {
  try {
    const { date, type, session, time_range, total_capacity, available_slots, branch_id, course_type, transmission } = req.body;
    const scope = await getRequestBranchScope(req);

    if (!date || !type || !session || !time_range || !total_capacity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Auto-resolve branch_id: use the one from request body, or look up from logged-in user
    let resolvedBranchId = branch_id || null;
    if (!resolvedBranchId && req.user) {
      const userRow = await pool.query('SELECT branch_id FROM users WHERE id = $1', [req.user.id]);
      resolvedBranchId = userRow.rows[0]?.branch_id || null;
    }

    if (!scope.canViewAll && !canAccessBranch(scope, resolvedBranchId)) {
      return res.status(403).json({ error: 'Access denied for this branch' });
    }

    // Determine end_date based on type and session logic
    console.log(`Creating slot: Date=${date}, Type=${type}, Session=${session}, Branch=${resolvedBranchId}`);

    // Use string manipulation to avoid timezone shifts: date is expected as 'YYYY-MM-DD'
    const addDays = (dateStr, days) => {
      const d = new Date(dateStr);
      // Set specific time to noon to avoid DST/timezone midnight issues
      d.setHours(12, 0, 0, 0);

      // Add days iteratively, skipping Sundays
      let count = 0;
      while (count < days) {
        d.setDate(d.getDate() + 1);
        if (d.getDay() === 0) { // If Sunday, skip and add another day
          d.setDate(d.getDate() + 1);
        }
        count++;
      }
      return d.toISOString().split('T')[0];
    };

    let formattedEndDate = date;
    const cleanType = type.trim().toLowerCase();

    // TDC is always 2 days (15 hours) — one booking covers both days
    if (cleanType === 'tdc') {
      formattedEndDate = addDays(date, 1);
    }
    // PDC Morning/Afternoon: each day is its own single-day record.

    console.log(`Calculated End Date: ${formattedEndDate}`);

    // Check for an existing slot with the same date, type, session, branch, course_type and transmission
    const existing = await pool.query(
      `SELECT id FROM schedule_slots
       WHERE date = $1
         AND LOWER(type) = LOWER($2)
         AND session = $3
         AND branch_id IS NOT DISTINCT FROM $4
         AND (course_type IS NOT DISTINCT FROM $5)
         AND (transmission IS NOT DISTINCT FROM $6)
       LIMIT 1`,
      [date, type, session, resolvedBranchId, course_type || null, transmission || null]
    );

    if (existing.rows.length > 0) {
      // Return the existing slot instead of creating a duplicate
      const existingSlot = await pool.query('SELECT * FROM schedule_slots WHERE id = $1', [existing.rows[0].id]);
      return res.status(200).json(existingSlot.rows[0]);
    }

    const isB1B2 = String(type || '').toLowerCase() === 'pdc' && isB1B2CourseType(course_type);
    const effectiveTotalCapacity = isB1B2 ? GLOBAL_B1B2_DAILY_CAPACITY : Number(total_capacity);
    const effectiveAvailableSlots = isB1B2
      ? GLOBAL_B1B2_DAILY_CAPACITY
      : Number(available_slots || effectiveTotalCapacity);

    const result = await pool.query(
      `INSERT INTO schedule_slots (date, end_date, type, session, time_range, total_capacity, available_slots, branch_id, course_type, transmission)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [date, formattedEndDate, type, session, time_range, effectiveTotalCapacity, effectiveAvailableSlots, resolvedBranchId, course_type || null, transmission || null]
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
    const { type, session, time_range, total_capacity, available_slots, branch_id, course_type, transmission } = req.body;
    const scope = await getRequestBranchScope(req);

    console.log('Update slot request:', { id, type, session, time_range, total_capacity, available_slots, course_type, transmission });

    if (!type || !session || !time_range || total_capacity === undefined || available_slots === undefined) {
      return res.status(400).json({
        error: 'Missing required fields',
        received: { type, session, time_range, total_capacity, available_slots }
      });
    }

    const existingBranchId = await getSlotBranchId(id);
    if (existingBranchId === null) {
      return res.status(404).json({ error: 'Slot not found' });
    }
    if (!scope.canViewAll && !canAccessBranch(scope, existingBranchId)) {
      return res.status(403).json({ error: 'Access denied for this branch slot' });
    }

    // Auto-resolve branch_id from logged-in user if not provided
    let resolvedBranchId = branch_id || null;
    if (!resolvedBranchId && req.user) {
      const userRow = await pool.query('SELECT branch_id FROM users WHERE id = $1', [req.user.id]);
      resolvedBranchId = userRow.rows[0]?.branch_id || null;
    }

    if (!scope.canViewAll) {
      resolvedBranchId = existingBranchId;
    } else if (resolvedBranchId && !canAccessBranch(scope, resolvedBranchId)) {
      return res.status(403).json({ error: 'Access denied for this branch' });
    }

    const existingSlot = await pool.query('SELECT date, course_type FROM schedule_slots WHERE id = $1', [id]);
    if (existingSlot.rows.length === 0) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    const effectiveCourseType = course_type || existingSlot.rows[0].course_type || null;
    const isB1B2 = String(type || '').toLowerCase() === 'pdc' && isB1B2CourseType(effectiveCourseType);
    const requestedCapacity = Number(total_capacity);
    const requestedAvailable = Number(available_slots);
    const effectiveTotalCapacity = isB1B2 ? GLOBAL_B1B2_DAILY_CAPACITY : requestedCapacity;

    let effectiveAvailableSlots = requestedAvailable;
    if (isB1B2) {
      const bookedGlobal = await getGlobalB1B2BookedCount(pool, existingSlot.rows[0].date);
      effectiveAvailableSlots = Math.max(0, GLOBAL_B1B2_DAILY_CAPACITY - bookedGlobal);
    }

    const result = await pool.query(
      `UPDATE schedule_slots 
       SET type = $1, session = $2, time_range = $3, total_capacity = $4, available_slots = $5,
           branch_id = COALESCE($6, branch_id), updated_at = CURRENT_TIMESTAMP, course_type = $8, transmission = $9
       WHERE id = $7
       RETURNING *`,
      [type, session, time_range, effectiveTotalCapacity, effectiveAvailableSlots, resolvedBranchId, id, course_type || null, transmission || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update slot error:', error);
    res.status(500).json({ error: 'Server error while updating slot' });
  }
};

// Delete slot
const deleteSlot = async (req, res) => {
  try {
    const { id } = req.params;
    const scope = await getRequestBranchScope(req);

    const slotBranchId = await getSlotBranchId(id);
    if (slotBranchId === null) {
      return res.status(404).json({ error: 'Slot not found' });
    }
    if (!scope.canViewAll && !canAccessBranch(scope, slotBranchId)) {
      return res.status(403).json({ error: 'Access denied for this branch slot' });
    }

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
    const scope = await getRequestBranchScope(req);

    const slotBranchId = await getSlotBranchId(slotId);
    if (slotBranchId === null) {
      return res.status(404).json({ error: 'Slot not found' });
    }
    if (!scope.canViewAll && !canAccessBranch(scope, slotBranchId)) {
      return res.status(403).json({ error: 'Access denied for this branch slot' });
    }

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
    const scope = await getRequestBranchScope(req);

    const slotBranchId = await getSlotBranchId(slotId);
    if (slotBranchId === null) {
      return res.status(404).json({ error: 'Slot not found' });
    }
    if (!scope.canViewAll && !canAccessBranch(scope, slotBranchId)) {
      return res.status(403).json({ error: 'Access denied for this branch slot' });
    }

    if (!student_id) {
      return res.status(400).json({ error: 'Student ID is required' });
    }

    // Check if slot has available capacity
    const slotCheck = await pool.query('SELECT date, course_type, available_slots FROM schedule_slots WHERE id = $1', [slotId]);

    if (slotCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    const { date, course_type, available_slots } = slotCheck.rows[0];

    if (available_slots <= 0) {
      return res.status(400).json({ error: 'No available slots' });
    }

    // B1/B2 global daily capacity check across all branches and sessions.
    if (isB1B2CourseType(course_type)) {
      const bookedGlobal = await getGlobalB1B2BookedCount(pool, date);
      if (bookedGlobal >= GLOBAL_B1B2_DAILY_CAPACITY) {
        return res.status(400).json({ error: 'The B1/B2 Van/L300 units are fully booked for this date across all branches.' });
      }
    }

    // Create or reactivate enrollment (handles re-enroll after no-show/cancelled)
    const existing = await pool.query(
      'SELECT id, enrollment_status FROM schedule_enrollments WHERE slot_id = $1 AND student_id = $2',
      [slotId, student_id]
    );

    let result;
    if (existing.rows.length > 0) {
      // Re-enroll: update existing record without touching available_slots (already counted)
      const wasActive = !['no-show', 'cancelled'].includes(existing.rows[0].enrollment_status);
      result = await pool.query(
        `UPDATE schedule_enrollments
           SET enrollment_status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE slot_id = $2 AND student_id = $3
         RETURNING *`,
        [enrollment_status || 'enrolled', slotId, student_id]
      );
      // Only decrement capacity if the previous status was inactive (no-show / cancelled)
      if (!wasActive) {
        await pool.query(
          'UPDATE schedule_slots SET available_slots = available_slots - 1 WHERE id = $1 AND available_slots > 0',
          [slotId]
        );
      }
    } else {
      result = await pool.query(
        `INSERT INTO schedule_enrollments (slot_id, student_id, enrollment_status)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [slotId, student_id, enrollment_status || 'enrolled']
      );
      await pool.query(
        'UPDATE schedule_slots SET available_slots = available_slots - 1 WHERE id = $1 AND available_slots > 0',
        [slotId]
      );
    }

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
    const scope = await getRequestBranchScope(req);

    const enrollmentBranchId = await getEnrollmentBranchId(enrollmentId);
    if (enrollmentBranchId === null) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    if (!scope.canViewAll && !canAccessBranch(scope, enrollmentBranchId)) {
      return res.status(403).json({ error: 'Access denied for this branch enrollment' });
    }

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
    const scope = await getRequestBranchScope(req);

    const enrollmentBranchId = await getEnrollmentBranchId(enrollmentId);
    if (enrollmentBranchId === null) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    if (!scope.canViewAll && !canAccessBranch(scope, enrollmentBranchId)) {
      return res.status(403).json({ error: 'Access denied for this branch enrollment' });
    }

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

// Mark reschedule fee as paid (admin confirms ₱1000 no-show fee collected)
const markFeePaid = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const { amount, paymentMethod, transactionNumber } = req.body;
    const scope = await getRequestBranchScope(req);

    const enrollmentBranchId = await getEnrollmentBranchId(enrollmentId);
    if (enrollmentBranchId === null) {
      return res.status(404).json({ error: 'No-show enrollment not found' });
    }
    if (!scope.canViewAll && !canAccessBranch(scope, enrollmentBranchId)) {
      return res.status(403).json({ error: 'Access denied for this branch enrollment' });
    }
    const result = await pool.query(
      `UPDATE schedule_enrollments
         SET reschedule_fee_paid = TRUE,
             walkin_fee_amount = $2,
             walkin_payment_method = $3,
             walkin_transaction_number = $4,
             updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND enrollment_status = 'no-show'
       RETURNING id, reschedule_fee_paid, walkin_fee_amount, walkin_payment_method, walkin_transaction_number`,
      [enrollmentId, amount || null, paymentMethod || null, transactionNumber || null]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No-show enrollment not found' });
    }

    res.json({ success: true, reschedule_fee_paid: true, walkin_fee_amount: result.rows[0].walkin_fee_amount, walkin_payment_method: result.rows[0].walkin_payment_method, walkin_transaction_number: result.rows[0].walkin_transaction_number });
  } catch (error) {
    console.error('Mark fee paid error:', error);
    res.status(500).json({ error: 'Server error while marking fee paid' });
  }
};

// Get all enrollments for the currently logged-in student
const getMyEnrollments = async (req, res) => {
  try {
    const studentId = req.user.id;

    // Query starts from bookings (every course purchase) so students always see
    // their history even before admin assigns them to a schedule slot.
    // A LATERAL subquery attaches the best-matching schedule enrollment (same
    // course category, most recent) without producing duplicate rows.
    const result = await pool.query(
      `SELECT
          b.id                        AS booking_id,
          b.notes                     AS booking_notes,
          c.name                      AS course_name,
          b.total_amount              AS amount_paid,
          b.payment_type              AS payment_status,
          b.payment_method,
          b.course_type,
          b.course_id,
          b.branch_id,
          b.status                    AS booking_status,
          b.created_at                AS enrolled_at,
          c.name                      AS course_full_name,
          c.category                  AS course_category,
          c.duration                  AS course_duration,
          c.price                     AS course_price,
          br.name                     AS branch_name,
          sel.enrollment_id,
          sel.enrollment_status,
          sel.reschedule_fee_paid,
          sel.enrollment_updated_at,
          sel.schedule_date,
          sel.schedule_end_date,
          sel.session,
          sel.time_range,
          sel.slot_type
        FROM bookings b
        LEFT JOIN courses c   ON c.id  = b.course_id
        LEFT JOIN branches br ON br.id = b.branch_id
        LEFT JOIN LATERAL (
          SELECT
              se.id                   AS enrollment_id,
              se.enrollment_status,
              se.reschedule_fee_paid,
              se.updated_at           AS enrollment_updated_at,
              ss.date                 AS schedule_date,
              ss.end_date             AS schedule_end_date,
              ss.session,
              ss.time_range,
              ss.type                 AS slot_type
          FROM schedule_enrollments se
          JOIN schedule_slots ss ON ss.id = se.slot_id
          WHERE se.student_id = b.user_id
            AND LOWER(ss.type) = LOWER(COALESCE(c.category, b.course_type, ''))
          ORDER BY se.created_at DESC
          LIMIT 1
        ) sel ON true
        WHERE b.user_id = $1
          AND b.status NOT IN ('cancelled')
          AND (b.payment_type IS NULL OR b.payment_type NOT IN ('Reschedule Fee'))
          AND (b.notes IS NULL OR (b.notes::jsonb->>'source') IS DISTINCT FROM 'reschedule_fee')
        ORDER BY b.created_at DESC`,
      [studentId]
    );

    res.json({ success: true, enrollments: result.rows });
  } catch (error) {
    console.error('Get my enrollments error:', error);
    res.status(500).json({ error: 'Server error while fetching enrollments' });
  }
};

// Reschedule a student from one slot to another
const rescheduleEnrollment = async (req, res) => {
  const { enrollmentId } = req.params;
  const { new_slot_id } = req.body;

  if (!new_slot_id) {
    return res.status(400).json({ error: 'new_slot_id is required' });
  }

  const client = await pool.connect();
  try {
    const scope = await getRequestBranchScope(req);

    const sourceEnrollmentBranchId = await getEnrollmentBranchId(enrollmentId);
    if (sourceEnrollmentBranchId === null) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    if (!scope.canViewAll && !canAccessBranch(scope, sourceEnrollmentBranchId)) {
      return res.status(403).json({ error: 'Access denied for this branch enrollment' });
    }

    const targetSlotBranchId = await getSlotBranchId(new_slot_id);
    if (targetSlotBranchId === null) {
      return res.status(404).json({ error: 'Target slot not found' });
    }
    if (!scope.canViewAll && !canAccessBranch(scope, targetSlotBranchId)) {
      return res.status(403).json({ error: 'Access denied for this target branch slot' });
    }

    await client.query('BEGIN');

    // 1. Fetch old enrollment + slot info
    const enrollRow = await client.query(
      `SELECT se.id, se.student_id, se.slot_id, se.enrollment_status, ss.type, ss.branch_id
       FROM schedule_enrollments se
       JOIN schedule_slots ss ON se.slot_id = ss.id
       WHERE se.id = $1`,
      [enrollmentId]
    );

    if (enrollRow.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    const old = enrollRow.rows[0];

    if (parseInt(new_slot_id) === parseInt(old.slot_id)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Student is already in this slot' });
    }

    // 2. Validate new slot has capacity
    const newSlotRow = await client.query(
      `SELECT id, available_slots, date, course_type FROM schedule_slots WHERE id = $1`,
      [new_slot_id]
    );
    if (newSlotRow.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Target slot not found' });
    }
    if (newSlotRow.rows[0].available_slots <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Target slot is full' });
    }

    if (isB1B2CourseType(newSlotRow.rows[0].course_type)) {
      const bookedGlobal = await getGlobalB1B2BookedCount(client, newSlotRow.rows[0].date, old.student_id);
      if (bookedGlobal >= GLOBAL_B1B2_DAILY_CAPACITY) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'The B1/B2 Van/L300 units are fully booked for this date across all branches.' });
      }
    }

    // 3. Cancel old enrollment and restore its capacity (if it was an active seat)
    await client.query(
      `UPDATE schedule_enrollments SET enrollment_status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [enrollmentId]
    );
    const wasActive = !['no-show', 'cancelled'].includes(old.enrollment_status);
    if (wasActive) {
      await client.query(
        `UPDATE schedule_slots SET available_slots = available_slots + 1 WHERE id = $1`,
        [old.slot_id]
      );
    }

    // 4. Cancel any companion future enrollments of the same type (e.g. Day-2 TDC slot)
    if (old.type) {
      const siblings = await client.query(
        `UPDATE schedule_enrollments
           SET enrollment_status = 'cancelled', updated_at = CURRENT_TIMESTAMP
         WHERE student_id = $1
           AND id != $2
           AND enrollment_status NOT IN ('no-show', 'cancelled')
           AND slot_id IN (
             SELECT id FROM schedule_slots WHERE type ILIKE $3 AND date >= CURRENT_DATE
           )
         RETURNING slot_id`,
        [old.student_id, enrollmentId, `%${old.type}%`]
      );
      for (const row of siblings.rows) {
        await client.query(
          `UPDATE schedule_slots SET available_slots = available_slots + 1 WHERE id = $1`,
          [row.slot_id]
        );
      }
    }

    // 5. Enroll in new slot (re-activate if record already exists)
    const existingNew = await client.query(
      `SELECT id, enrollment_status FROM schedule_enrollments WHERE slot_id = $1 AND student_id = $2`,
      [new_slot_id, old.student_id]
    );
    if (existingNew.rows.length > 0) {
      const prevInactive = ['no-show', 'cancelled'].includes(existingNew.rows[0].enrollment_status);
      await client.query(
        `UPDATE schedule_enrollments SET enrollment_status = 'enrolled', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [existingNew.rows[0].id]
      );
      if (prevInactive) {
        await client.query(
          `UPDATE schedule_slots SET available_slots = available_slots - 1 WHERE id = $1 AND available_slots > 0`,
          [new_slot_id]
        );
      }
    } else {
      await client.query(
        `INSERT INTO schedule_enrollments (slot_id, student_id, enrollment_status) VALUES ($1, $2, 'enrolled')`,
        [new_slot_id, old.student_id]
      );
      await client.query(
        `UPDATE schedule_slots SET available_slots = available_slots - 1 WHERE id = $1 AND available_slots > 0`,
        [new_slot_id]
      );
    }

    // 6. Create a booking record now that fee is paid AND new slot is selected
    try {
      const feeRow = await client.query(
        `SELECT se.student_id, se.walkin_fee_amount, se.walkin_payment_method, se.walkin_transaction_number,
                ss.branch_id,
                b.course_id, b.course_type
         FROM schedule_enrollments se
         JOIN schedule_slots ss ON ss.id = se.slot_id
         LEFT JOIN bookings b ON b.user_id = se.student_id
           AND b.payment_type NOT IN ('Reschedule Fee')
           AND b.status IN ('paid','partial_payment','confirmed')
         WHERE se.id = $1
         ORDER BY b.created_at DESC NULLS LAST
         LIMIT 1`,
        [enrollmentId]
      );
      if (feeRow.rows.length > 0) {
        const f = feeRow.rows[0];
        const method = f.walkin_payment_method || 'StarPay';
        const amount = f.walkin_fee_amount || 1000;
        const txn = f.walkin_transaction_number || null;
        await client.query(
          `INSERT INTO bookings
             (user_id, course_id, branch_id, booking_date, booking_time,
              notes, total_amount, payment_type, payment_method, status, transaction_id, course_type)
           VALUES ($1,$2,$3,CURRENT_DATE,NULL,$4,$5,'Reschedule Fee',$6,'paid',$7,$8)`,
          [
            f.student_id, f.course_id || null, f.branch_id || null,
            JSON.stringify({ source: 'reschedule_fee', enrollmentId: parseInt(enrollmentId) }),
            amount, method, txn, f.course_type || null
          ]
        );
      }
    } catch (bookingErr) {
      console.error('Reschedule: booking record creation failed (non-fatal):', bookingErr.message);
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Student rescheduled successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Reschedule enrollment error:', error);
    res.status(500).json({ error: 'Server error while rescheduling' });
  } finally {
    client.release();
  }
};

// Process No-Show & Send Rescheduling Fee Email
const processNoShow = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const scope = await getRequestBranchScope(req);

    const enrollmentBranchId = await getEnrollmentBranchId(enrollmentId);
    if (enrollmentBranchId === null) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    if (!scope.canViewAll && !canAccessBranch(scope, enrollmentBranchId)) {
      return res.status(403).json({ error: 'Access denied for this branch enrollment' });
    }

    // 1. Mark as no-show and retrieve details in one query
    const updateResult = await pool.query(
      `UPDATE schedule_enrollments 
       SET enrollment_status = 'no-show', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING slot_id, student_id`,
      [enrollmentId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    const { slot_id, student_id } = updateResult.rows[0];

    // 2. Increase available_slots in schedule_slots (free up the seat)
    await pool.query(
      'UPDATE schedule_slots SET available_slots = available_slots + 1 WHERE id = $1',
      [slot_id]
    );

    // 3a. Cancel any other ACTIVE enrollments this student has in FUTURE slots
    //     of the same type (TDC/PDC) — this clears the companion Day-2 slot so
    //     the student can be properly rescheduled to a new Day-1 + Day-2 pair.
    const slotTypeRow = await pool.query('SELECT type FROM schedule_slots WHERE id = $1', [slot_id]);
    const slotType = slotTypeRow.rows[0]?.type || '';
    if (slotType) {
      const cancelledSiblings = await pool.query(
        `UPDATE schedule_enrollments
           SET enrollment_status = 'cancelled', updated_at = CURRENT_TIMESTAMP
         WHERE student_id = $1
           AND id != $2
           AND enrollment_status NOT IN ('no-show', 'cancelled')
           AND slot_id IN (
             SELECT id FROM schedule_slots
             WHERE type ILIKE $3 AND date >= CURRENT_DATE
           )
         RETURNING slot_id`,
        [student_id, enrollmentId, `%${slotType}%`]
      );
      // Free up capacity for each cancelled sibling slot
      for (const row of cancelledSiblings.rows) {
        await pool.query(
          'UPDATE schedule_slots SET available_slots = available_slots + 1 WHERE id = $1',
          [row.slot_id]
        );
      }
    }

    // 3. Fetch comprehensive details to send the email
    // Use LATERAL to get the student's most recent booking's course name
    const detailsResult = await pool.query(
      `SELECT 
         u.first_name, u.last_name, u.email,
         ss.date, ss.session, ss.time_range, ss.type,
         c.name as course_name
       FROM users u
       JOIN schedule_slots ss ON ss.id = $1
       LEFT JOIN LATERAL (
         SELECT bk.course_id FROM bookings bk
         WHERE bk.user_id = u.id
         ORDER BY bk.created_at DESC LIMIT 1
       ) bk ON TRUE
       LEFT JOIN courses c ON c.id = bk.course_id
       WHERE u.id = $2`,
      [slot_id, student_id]
    );

    if (detailsResult.rows.length > 0) {
      const details = detailsResult.rows[0];

      const enrollmentDetails = {
        courseName: details.course_name || 'Driving Course Session',
        scheduleDate: details.date,
        scheduleSession: details.session,
        type: details.type
      };

      // 4. Send the dynamically computed No-Show Email
      try {
        await sendNoShowEmail(details.email, details.first_name, details.last_name, enrollmentDetails);
      } catch (e) {
        console.error('Email failed (proceeding):', e);
      }
    }

    res.json({ success: true, message: 'Student marked as No-Show and notification sent.' });
  } catch (error) {
    console.error('Process No-Show error:', error);
    res.status(500).json({ error: 'Server error while processing No-Show' });
  }
};

// Get unassigned students for a slot (supports TDC, PDC, and Promo bundle students)
const getUnassignedPdcStudents = async (req, res) => {
  try {
    const { course_type, slot_type = 'pdc', branch_id } = req.query;
    const scope = await getRequestBranchScope(req);
    if (!scope.canViewAll && !scope.branchId) {
      return res.json({ success: true, students: [] });
    }
    const requestedBranchId = branch_id ? parseInt(branch_id, 10) : null;
    const effectiveBranchId = resolveEffectiveBranchId(requestedBranchId, scope);

    // $1 — slot_type pattern used for category matching and enrollment check
    const params = [`%${slot_type}%`];

    // Optional course_type filter: checks the booking's stored type (b.course_type),
    // the course entity's type (c.course_type), and the course name (c.name).
    // b.course_type is the most reliable match because it stores the exact type selected
    // during walk-in enrollment (e.g. 'Motorcycle', 'F2F', 'CarAT').
    let courseTypeFilter = '';
    if (course_type) {
      params.push(`%${course_type}%`);
      const p = params.length;
      courseTypeFilter = `AND (b.course_type ILIKE $${p} OR c.course_type ILIKE $${p} OR c.name ILIKE $${p})`;
    }

    // Branch filter: only return students who enrolled at the same branch as the target slot
    let branchFilter = '';
    if (effectiveBranchId) {
      params.push(effectiveBranchId);
      branchFilter = `AND b.branch_id = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT 
        b.id as booking_id, 
        u.id as student_id, 
        u.first_name, 
        u.last_name, 
        u.contact_numbers as phone,
        c.name as course_name,
        c.category as course_category,
        c.course_type as course_type_label,
        b.course_type, 
        b.created_at,
        (
          SELECT COUNT(*) 
          FROM schedule_enrollments se2 
          JOIN schedule_slots ss2 ON se2.slot_id = ss2.id
          WHERE se2.student_id = u.id 
            AND ss2.type ILIKE $1
            AND se2.enrollment_status = 'no-show'
        ) as no_show_count
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN courses c ON b.course_id = c.id
      WHERE (c.category ILIKE $1 OR c.category ILIKE '%Promo%')
        AND b.status IN ('paid', 'confirmed', 'partial_payment')
        ${courseTypeFilter}
        ${branchFilter}
        AND NOT EXISTS (
           SELECT 1 FROM schedule_enrollments se 
           JOIN schedule_slots ss ON se.slot_id = ss.id
           WHERE se.student_id = u.id 
             AND ss.type ILIKE $1
             AND se.enrollment_status NOT IN ('no-show', 'cancelled')
        )
        AND EXISTS (
           SELECT 1 FROM schedule_enrollments se3
           JOIN schedule_slots ss3 ON se3.slot_id = ss3.id
           WHERE se3.student_id = u.id
             AND ss3.type ILIKE $1
             AND se3.enrollment_status = 'no-show'
        )
      ORDER BY b.created_at DESC`,
      params
    );
    res.json({ success: true, students: result.rows });
  } catch (error) {
    console.error('getUnassignedPdcStudents error:', error);
    res.status(500).json({ error: 'Server error while fetching unassigned students' });
  }
};

// Student pays their own remaining balance online
const payRemainingBalance = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { bookingId } = req.params;
    const { payment_method, payment_type } = req.body;

    // Verify this booking belongs to the logged-in student
    const bookingResult = await pool.query(
      `SELECT b.*, c.price AS course_price, c.name AS course_name,
              u.first_name, u.last_name, u.email
       FROM bookings b
       LEFT JOIN courses c ON b.course_id = c.id
       JOIN users u ON b.user_id = u.id
       WHERE b.id = $1 AND b.user_id = $2`,
      [bookingId, studentId]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found or not yours' });
    }

    const booking = bookingResult.rows[0];
    if (booking.status === 'paid') {
      return res.status(400).json({ error: 'Booking is already fully paid' });
    }

    const coursePrice = parseFloat(booking.course_price || 0);
    const previousAmount = parseFloat(booking.total_amount || 0);

    let notesJson = {};
    try {
      notesJson = booking.notes && String(booking.notes).startsWith('{') ? JSON.parse(booking.notes) : {};
    } catch (_) {
      notesJson = {};
    }

    const toAmount = (value) => {
      if (value == null) return 0;
      const numeric = Number(String(value).replace(/[^0-9.-]/g, ''));
      return Number.isFinite(numeric) ? numeric : 0;
    };

    const notesCourseTotal = (Array.isArray(notesJson?.courseList) ? notesJson.courseList : []).reduce((sum, item) => {
      const line = item?.finalPrice ?? item?.discountedPrice ?? item?.netPrice ?? item?.lineTotal ?? item?.price ?? item?.amount ?? item?.coursePrice ?? 0;
      return sum + Math.max(0, toAmount(line));
    }, 0);
    const notesAddonTotal = (Array.isArray(notesJson?.addonsDetailed) ? notesJson.addonsDetailed : []).reduce((sum, item) => {
      return sum + Math.max(0, toAmount(item?.price || 0));
    }, 0);
    const notesPromo = Math.max(0, toAmount(notesJson?.promoDiscount || 0));
    const notesConvenience = Math.max(0, toAmount(notesJson?.convenienceFee || 0));
    const notesSubtotal = Math.max(0, toAmount(notesJson?.subtotal || 0));
    const notesDerivedAssessment = Math.max(0, Number(((notesSubtotal > 0 ? notesSubtotal : (notesCourseTotal + notesAddonTotal)) + notesConvenience - notesPromo).toFixed(2)));
    const explicitNotesAssessment = [
      notesJson?.totalAmount,
      notesJson?.grandTotal,
      notesJson?.finalTotal,
      notesJson?.assessedTotal,
      notesJson?.payableAmount,
      notesJson?.amountToPay,
    ]
      .map((v) => Math.max(0, toAmount(v)))
      .find((v) => v > 0) || 0;

    const assessedTotal = Math.max(explicitNotesAssessment, notesDerivedAssessment, coursePrice, previousAmount);

    const normalizedChoice = String(payment_type || '').toLowerCase();
    const wantsDownpayment = ['downpayment', 'down payment', 'down-payment'].includes(normalizedChoice);
    const isPending = String(booking.status || '').toLowerCase() === 'pending';

    let nextStatus = 'paid';
    let nextPaymentType = 'Full Payment';
    let amountPaid = assessedTotal;

    if (isPending && wantsDownpayment) {
      nextStatus = 'partial_payment';
      nextPaymentType = 'Downpayment';
      amountPaid = Math.max(0, assessedTotal * 0.5);
    }

    await pool.query(
      `UPDATE bookings
       SET status = $1,
           total_amount = $2,
           payment_type = $3,
           payment_method = COALESCE($4, payment_method),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [nextStatus, amountPaid, nextPaymentType, payment_method || null, bookingId]
    );

    try {
      const notesJson = booking.notes && String(booking.notes).startsWith('{') ? JSON.parse(booking.notes) : {};
      const paymentHistory = Array.isArray(notesJson.paymentHistory) ? notesJson.paymentHistory : [];
      const collectedNow = Math.max(0, Number((amountPaid - previousAmount).toFixed(2)));
      if (!Number.isFinite(Number(notesJson.initialAmountPaid))) {
        notesJson.initialAmountPaid = Math.max(0, Number(previousAmount.toFixed(2)));
      }
      paymentHistory.push({
        at: new Date().toISOString(),
        amount: collectedNow,
        paymentMethod: payment_method || booking.payment_method || 'Online',
        transactionId: null,
        statusAfter: nextStatus,
        totalPaidAfter: Math.max(0, Number(amountPaid.toFixed(2))),
      });
      notesJson.paymentHistory = paymentHistory;
      await pool.query(
        `UPDATE bookings SET notes = $2 WHERE id = $1`,
        [bookingId, JSON.stringify(notesJson)]
      );
    } catch (notesErr) {
      console.error('Payment history notes update failed (non-fatal):', notesErr.message);
    }

    try {
      const collectedNow = Math.max(0, Number((amountPaid - previousAmount).toFixed(2)));
      await sendPaymentReceiptEmail(booking.email, booking.first_name, booking.last_name, {
        bookingId: booking.id,
        transactionId: `TXN-${new Date().getFullYear()}-${String(booking.id).padStart(3, '0')}`,
        courseName: booking.course_name || 'N/A',
        amountPaid: nextStatus === 'paid' ? collectedNow : amountPaid,
        coursePrice: assessedTotal,
        promoDiscount: toAmount(notesJson?.promoDiscount || 0),
        promoPct: toAmount(notesJson?.promoPct || 0),
        paymentMethod: payment_method || 'Online',
        paymentDate: new Date(),
        isFullPayment: nextStatus === 'paid',
        balanceDue: Math.max(0, assessedTotal - amountPaid),
      });
    } catch (emailErr) {
      console.error('Receipt email failed (non-fatal):', emailErr.message);
    }

    res.json({
      success: true,
      message: nextStatus === 'partial_payment'
        ? 'Downpayment received successfully! Remaining balance is still due (Partial Payment).'
        : 'Payment processed successfully! A receipt has been sent to your email.',
      status: nextStatus,
      payment_type: nextPaymentType,
      amount_paid: amountPaid,
      balance_due: Math.max(0, assessedTotal - amountPaid),
      balance_collected: Math.max(0, amountPaid - previousAmount),
    });
  } catch (error) {
    console.error('Pay remaining balance error:', error);
    res.status(500).json({ error: 'Server error while processing payment' });
  }
};

// Request free reschedule within 5 days
const requestFreeReschedule = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const studentId = req.user.userId || req.user.id; // handle different token structures

    const checkResult = await pool.query(
      `SELECT updated_at 
       FROM schedule_enrollments 
       WHERE id = $1 AND student_id = $2 AND enrollment_status = 'no-show'`,
      [enrollmentId, studentId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'No-Show enrollment not found or unauthorized' });
    }

    const { updated_at } = checkResult.rows[0];
    const diffDays = (Date.now() - new Date(updated_at).getTime()) / (1000 * 3600 * 24);

    if (diffDays > 5) {
      return res.status(400).json({ error: '5-day grace period has expired' });
    }

    await pool.query(
      `UPDATE schedule_enrollments
       SET reschedule_fee_paid = TRUE,
           walkin_fee_amount = 0,
           walkin_payment_method = 'Free Grace Period',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [enrollmentId]
    );

    res.json({ success: true, message: 'Free reschedule processed. You can now book a new session.' });
  } catch (error) {
    console.error('Request free reschedule error:', error);
    res.status(500).json({ error: 'Server error processing request' });
  }
};

// Get all No-Show students with slot + fee info (admin)
const getNoShowStudents = async (req, res) => {
  try {
    const { branchId } = req.query;
    const scope = await getRequestBranchScope(req);
    if (!scope.canViewAll && !scope.branchId) {
      return res.json({ success: true, data: [] });
    }
    const requestedBranchId = branchId ? parseInt(branchId, 10) : null;
    const effectiveBranchId = resolveEffectiveBranchId(requestedBranchId, scope);
    const params = [];
    let branchFilter = '';
    if (effectiveBranchId) {
      params.push(effectiveBranchId);
      branchFilter = `AND ss.branch_id = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT
         se.id            AS enrollment_id,
         se.student_id,
         se.reschedule_fee_paid,
         se.updated_at    AS no_show_date,
         u.first_name,
         u.last_name,
         u.email,
         ss.id            AS slot_id,
         ss.date          AS slot_date,
         ss.end_date      AS slot_end_date,
         ss.session,
         ss.time_range,
         ss.type,
         ss.course_type,
         ss.transmission,
         ss.branch_id,
         b.name           AS branch_name
       FROM schedule_enrollments se
       JOIN users u           ON u.id = se.student_id
       JOIN schedule_slots ss ON ss.id = se.slot_id
       LEFT JOIN branches b   ON b.id = ss.branch_id
       WHERE se.enrollment_status = 'no-show'
         ${branchFilter}
       ORDER BY se.updated_at DESC`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('getNoShowStudents error:', error);
    res.status(500).json({ error: 'Server error fetching no-show students' });
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
  markFeePaid,
  getMyEnrollments,
  processNoShow,
  requestFreeReschedule,
  rescheduleEnrollment,
  getUnassignedPdcStudents,
  payRemainingBalance,
  getNoShowStudents,
};
