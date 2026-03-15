const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://postgres:admin123@localhost:5432/booking_system_db'
});

async function run() {
  await client.connect();

  try {
    const courseRes = await client.query("SELECT id, name FROM courses WHERE category = 'PDC' AND (name ILIKE '%Motorcycle%' OR category ILIKE '%Motorcycle%') LIMIT 1");
    if (courseRes.rows.length === 0) {
      console.log('No PDC Motorcycle course found.');
      return;
    }
    const course = courseRes.rows[0];

    const branchRes = await client.query("SELECT id FROM branches LIMIT 1");
    const branchId = branchRes.rows[0].id;

    // Cleanup if they exist from a failed run
    await client.query("DELETE FROM users WHERE email IN ('pdcdummy4@example.com', 'noshowdummy4@example.com')");

    const userRes1 = await client.query(`
      INSERT INTO users (first_name, last_name, email, password, role, contact_numbers, branch_id) 
      VALUES ('DummyPDC', 'Unassigned', 'pdcdummy4@example.com', 'hash', 'student', '09123456789', $1) 
      RETURNING id
    `, [branchId]);
    const student1Id = userRes1.rows[0].id;

    const userRes2 = await client.query(`
      INSERT INTO users (first_name, last_name, email, password, role, contact_numbers, branch_id) 
      VALUES ('DummyNo', 'Show', 'noshowdummy4@example.com', 'hash', 'student', '09987654321', $1) 
      RETURNING id
    `, [branchId]);
    const student2Id = userRes2.rows[0].id;

    const today = new Date().toISOString().split('T')[0];

    await client.query(`
      INSERT INTO bookings (user_id, course_id, branch_id, status, total_amount, payment_type, payment_method, course_type, enrollment_type, booking_date, booking_time)
      VALUES ($1, $2, $3, 'paid', 1500, 'full', 'Cash', 'manual', 'walk-in', $4, '08:00:00')
    `, [student1Id, course.id, branchId, today]);

    await client.query(`
      INSERT INTO bookings (user_id, course_id, branch_id, status, total_amount, payment_type, payment_method, course_type, enrollment_type, booking_date, booking_time)
      VALUES ($1, $2, $3, 'paid', 1500, 'full', 'Cash', 'manual', 'walk-in', $4, '08:00:00')
    `, [student2Id, course.id, branchId, today]);

    const yestDate = new Date();
    yestDate.setDate(yestDate.getDate() - 2);
    const dateStr = yestDate.toISOString().split('T')[0];

    // insert a past slot
    const slotRes = await client.query(`
      INSERT INTO schedule_slots (branch_id, type, date, end_date, session, time_range, total_capacity, available_slots, course_type, transmission)
      VALUES ($1, 'PDC-Motorcycle', $2, $2, 'Morning', '08:00 AM - 12:00 PM', 5, 4, 'manual', 'manual')
      RETURNING id
    `, [branchId, dateStr]);
    const slotId = slotRes.rows[0].id;

    await client.query(`
      INSERT INTO schedule_enrollments (slot_id, student_id, enrollment_status)
      VALUES ($1, $2, 'no-show')
    `, [slotId, student2Id]);

    console.log('Dummy data inserted successfully!');
    console.log('- Unassigned PDC Student ID:', student1Id, 'Name: DummyPDC Unassigned');
    console.log('- No-Show Student ID:', student2Id, 'Name: DummyNo Show');

  } catch (err) {
    console.error('Error insert dummy script:', err);
  } finally {
    await client.end();
  }
}

run();
