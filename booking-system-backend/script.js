const pool = require('./config/db');

async function run() {
  try {
    const u1 = await pool.query(
      `INSERT INTO users (first_name, last_name, email, password, role, contact_numbers, is_verified) 
       VALUES ('Juan', 'Dela Cruz', 'juan' || CAST(EXTRACT(EPOCH FROM NOW()) AS text) || '@example.com', 'dummyhash', 'student', '09123456789', true) 
       RETURNING id`
    );
    const uid1 = u1.rows[0].id;

    const u2 = await pool.query(
      `INSERT INTO users (first_name, last_name, email, password, role, contact_numbers, is_verified) 
       VALUES ('Maria', 'Clara', 'maria' || CAST(EXTRACT(EPOCH FROM NOW()) AS text) || '@example.com', 'dummyhash', 'student', '09987654321', true) 
       RETURNING id`
    );
    const uid2 = u2.rows[0].id;

    const cRes = await pool.query(`SELECT id, name FROM courses WHERE category ILIKE '%PDC%' LIMIT 1`);
    if (cRes.rows.length === 0) throw new Error('No PDC course found.');
    const cid = cRes.rows[0].id;
    const cName = cRes.rows[0].name;

    const bRes = await pool.query(`SELECT id FROM branches LIMIT 1`);
    const bid = bRes.rows[0].id;

    await pool.query(
      `INSERT INTO bookings (user_id, course_id, branch_id, course_type, status, total_amount, booking_date) 
       VALUES ($1, $2, $3, 'Manual', 'paid', 1000, CURRENT_DATE)`, [uid1, cid, bid]
    );
    await pool.query(
      `INSERT INTO bookings (user_id, course_id, branch_id, course_type, status, total_amount, booking_date) 
       VALUES ($1, $2, $3, 'Automatic', 'paid', 1000, CURRENT_DATE)`, [uid2, cid, bid]
    );

    const sRes1 = await pool.query(
      `INSERT INTO schedule_slots (branch_id, type, date, end_date, session, time_range, total_capacity, available_slots, course_type, transmission) 
       VALUES ($1, 'pdc', CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE - INTERVAL '2 days', 'Morning', '08:00 AM - 12:00 PM', 5, 3, $2, 'Manual') 
       RETURNING id`, [bid, cName]
    );
    const sid1 = sRes1.rows[0].id;

    await pool.query(
      `INSERT INTO schedule_enrollments (slot_id, student_id, enrollment_status) 
       VALUES ($1, $2, 'no-show')`, [sid1, uid1]
    );
    await pool.query(
      `INSERT INTO schedule_enrollments (slot_id, student_id, enrollment_status) 
       VALUES ($1, $2, 'no-show')`, [sid1, uid2]
    );

    const sRes2 = await pool.query(
      `INSERT INTO schedule_slots (branch_id, type, date, end_date, session, time_range, total_capacity, available_slots, course_type, transmission) 
       VALUES ($1, 'pdc', CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE + INTERVAL '2 days', 'Afternoon', '01:00 PM - 05:00 PM', 5, 5, $2, 'Manual') 
       RETURNING id`, [bid, cName]
    );

    console.log('Successfully created Dummy Students, missed past slots, and future slot to test rescheduling!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
