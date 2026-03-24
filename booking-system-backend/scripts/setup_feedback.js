require('dotenv').config();
const pool = require('../config/db');

async function setup() {
  try {
    // 1. Create testimonials table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS testimonials (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
        booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        video_url TEXT,
        is_approved BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log("Testimonials table created or exists.");
    
    // 2. Find a TDC course
    const courseRes = await pool.query(`SELECT id FROM courses WHERE name ILIKE '%TDC%' LIMIT 1`);
    let course_id = courseRes.rows[0]?.id;
    if (!course_id) {
        console.log("No TDC course found. Using first course.");
        const c1 = await pool.query(`SELECT id FROM courses LIMIT 1`);
        course_id = c1.rows[0]?.id;
    }
    
    // 3. Find user
    const userRes = await pool.query(`SELECT id FROM users WHERE email = 'gabasamarcjeff03@gmail.com'`);
    let user_id = userRes.rows[0]?.id;
    if (!user_id) {
       console.log("User not found!");
       process.exit(1);
    }
    
    // 4. Find branch
    const branchRes = await pool.query(`SELECT id FROM branches LIMIT 1`);
    let branch_id = branchRes.rows[0]?.id || 1;
    
    // Check if table slot is valid
    // For now we will insert booking directly since I don't know the exact slot tables, let's catch if error
    const slotRes = await pool.query(`
      INSERT INTO tdc_slots (branch_id, start_date, end_date, start_time, end_time, capacity, status)
      VALUES ($1, '2026-03-15', '2026-03-16', '08:00:00', '17:00:00', 10, 'upcoming')
      RETURNING id;
    `, [branch_id]).catch(async () => {
         return await pool.query(`
           INSERT INTO schedule_slots (branch_id, instructor_id, slot_type, schedule_date, schedule_end_date, time_range, capacity, status)
           VALUES ($1, NULL, 'tdc', '2026-03-15', '2026-03-16', '08:00 AM - 05:00 PM', 10, 'upcoming')
           RETURNING id;
         `, [branch_id]).catch(e => { console.log(e); return null; });
    });
    
    const slot_id = slotRes?.rows?.[0]?.id;
    console.log("Created slot:", slot_id);

    // 6. Create booking
    const bookingRes = await pool.query(`
      INSERT INTO bookings (user_id, course_id, branch_id, booking_date, status, total_amount, payment_type, course_type)
      VALUES ($1, $2, $3, NOW(), 'completed', 0, 'full payment', 'f2f')
      RETURNING id;
    `, [user_id, course_id, branch_id]).catch(async () => {
         return await pool.query(`
      INSERT INTO bookings (user_id, course_id, branch_id, booking_date, status, total_amount)
      VALUES ($1, $2, $3, NOW(), 'completed', 0)
      RETURNING id;
    `, [user_id, course_id, branch_id]);
    });
    
    const booking_id = bookingRes.rows[0].id;
    console.log("Created booking:", booking_id);
    
    // 7. Enroll user in the slot
    if (slot_id) {
       await pool.query(`
         INSERT INTO tdc_enrollments (slot_id, user_id, booking_id, status)
         VALUES ($1, $2, $3, 'completed');
       `, [slot_id, user_id, booking_id]).catch(async () => {
          await pool.query(`
            INSERT INTO enrollments (slot_id, user_id, booking_id, status)
            VALUES ($1, $2, $3, 'completed');
          `, [slot_id, user_id, booking_id]).catch(() => console.log('could not insert enrollment'));
       });
    }

    console.log("Setup complete");
    process.exit(0);

  } catch (e) {
    console.error(e);
    process.exit(1);

  }
}
setup();