const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'booking_system',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

async function updateNaming() {
  try {
    console.log('Connecting to database...');
    
    // 1. Update the Courses master table
    console.log('Updating courses table...');
    const courseRes = await pool.query(`
      UPDATE courses 
      SET name = name || ' (Bundle)' 
      WHERE name LIKE '%OTDC + 4 PDC%' 
      AND name NOT LIKE '%(Bundle)%'
    `);
    console.log(`Updated ${courseRes.rowCount} courses.`);

    // 2. Update existing Bookings records
    console.log('Updating existing bookings records...');
    const bookingRes = await pool.query(`
      UPDATE bookings 
      SET course_name = course_name || ' (Bundle)' 
      WHERE course_name LIKE '%OTDC + 4 PDC%' 
      AND course_name NOT LIKE '%(Bundle)%'
    `);
    console.log(`Updated ${bookingRes.rowCount} booking records.`);

    // 3. Update notes JSONB in bookings if needed
    // (Optional: specifically for the 'combinedCourseNames' inside notes)
    console.log('Updating combinedCourseNames in bookings notes...');
    const notesRes = await pool.query(`
      UPDATE bookings 
      SET notes = jsonb_set(
        notes, 
        '{combinedCourseNames}', 
        to_jsonb(notes->>'combinedCourseNames' || ' (Bundle)')
      )
      WHERE notes->>'combinedCourseNames' LIKE '%OTDC + 4 PDC%'
      AND notes->>'combinedCourseNames' NOT LIKE '%(Bundle)%';
    `);
    console.log(`Updated ${notesRes.rowCount} booking notes.`);

    console.log('Database naming update complete!');
  } catch (err) {
    console.error('Update failed:', err);
  } finally {
    await pool.end();
  }
}

updateNaming();
