const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-backend/.env' });

const pool = new Pool();

async function cleanup() {
  try {
    console.log('--- Comprehensive Bundle Cleanup ---');
    
    // 1. Clean courses table
    console.log('Cleaning courses table...');
    const res1 = await pool.query(`
      UPDATE courses 
      SET name = TRIM(REPLACE(name, '(Bundle)', ''))
      WHERE name LIKE '%(Bundle)%'
    `);
    console.log(`Updated ${res1.rowCount} courses.`);

    // 2. Clean bookings table text columns
    console.log('Cleaning bookings text columns...');
    const res2 = await pool.query(`
      UPDATE bookings 
      SET 
        course_name = TRIM(REPLACE(course_name, '(Bundle)', '')),
        course_summary = TRIM(REPLACE(course_summary, '(Bundle)', ''))
      WHERE course_name LIKE '%(Bundle)%' OR course_summary LIKE '%(Bundle)%'
    `);
    console.log(`Updated ${res2.rowCount} bookings.`);

    // 3. Clean bookings notes JSONB (deep)
    console.log('Cleaning bookings notes JSONB...');
    const res3 = await pool.query(`
      UPDATE bookings
      SET notes = notes::jsonb || jsonb_build_object(
        'combinedCourseNames', REPLACE(notes::jsonb->>'combinedCourseNames', '(Bundle)', ''),
        'displayNotes', REPLACE(notes::jsonb->>'displayNotes', '(Bundle)', '')
      )
      WHERE notes::text LIKE '%(Bundle)%'
    `);
    console.log(`Updated ${res3.rowCount} booking notes JSON fields.`);

    // 4. Handle nested courseList array if it exists
    const fullRes = await pool.query("SELECT id, notes FROM bookings WHERE notes::text LIKE '%(Bundle)%'");
    for (const row of fullRes.rows) {
      let notes = row.notes;
      if (typeof notes === 'string') {
        try { notes = JSON.parse(notes); } catch(e) { continue; }
      }
      
      let changed = false;
      if (notes.courseList && Array.isArray(notes.courseList)) {
        notes.courseList = notes.courseList.map(c => {
          if (c.name && c.name.includes('(Bundle)')) {
            changed = true;
            return { ...c, name: c.name.replace(/\(Bundle\)/g, '').trim() };
          }
          return c;
        });
      }
      
      if (changed) {
        await pool.query('UPDATE bookings SET notes = $1 WHERE id = $2', [JSON.stringify(notes), row.id]);
      }
    }

    console.log('DONE!');
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

cleanup();
