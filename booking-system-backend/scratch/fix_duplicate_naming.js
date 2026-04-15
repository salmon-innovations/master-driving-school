const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'booking_system_db',
  password: process.env.DB_PASSWORD || 'admin123',
  port: process.env.DB_PORT || 5432,
});

async function cleanup() {
  try {
    console.log('--- Database Cleanup Started ---');

    // 1. Fix duplicate (Bundle) (Bundle) in courses table
    const courseFix = await pool.query(`
      UPDATE courses 
      SET name = regexp_replace(name, '\\s*\\(Bundle\\)\\s*\\(Bundle\\)', ' (Bundle)', 'gi')
      WHERE name ~* '\\(Bundle\\).*\\(Bundle\\)'
    `);
    console.log(`Cleaned up duplicates in courses table: ${courseFix.rowCount}`);

    // Since we don't have course_name column in bookings table (it was a joint alias),
    // we must check if any hardcoded names exist in the JSON notes.

    // 2. Fix duplicate (Bundle) inside the JSON notes (combinedCourseNames)
    const notesFix = await pool.query(`
      UPDATE bookings 
      SET notes = jsonb_set(
        notes::jsonb, 
        '{combinedCourseNames}', 
        to_jsonb(regexp_replace(notes::jsonb->>'combinedCourseNames', '\\s*\\(Bundle\\)\\s*\\(Bundle\\)', ' (Bundle)', 'gi'))
      )::text
      WHERE notes::jsonb->>'combinedCourseNames' ~* '\\(Bundle\\).*\\(Bundle\\)'
    `);
    console.log(`Cleaned up duplicates in combinedCourseNames notes: ${notesFix.rowCount}`);

    // 3. Fix row-level duplicates in displayNotes if they exist
    const displayFix = await pool.query(`
      UPDATE bookings 
      SET notes = jsonb_set(
        notes::jsonb, 
        '{displayNotes}', 
        to_jsonb(regexp_replace(notes::jsonb->>'displayNotes', '\\s*\\(Bundle\\)\\s*\\(Bundle\\)', ' (Bundle)', 'gi'))
      )::text
      WHERE notes::jsonb->>'displayNotes' ~* '\\(Bundle\\).*\\(Bundle\\)'
    `);
    console.log(`Cleaned up duplicates in displayNotes: ${displayFix.rowCount}`);

    // 4. One final pass: If any 'combinedCourseNames' has (Bundle) but we want it to just be the raw names 
    // (since the join provides the label), we can also strip it.
    // However, the user wants consistency. 
    
    console.log('--- Cleanup Finished ---');
  } catch (err) {
    console.error('Cleanup failed:', err);
  } finally {
    await pool.end();
  }
}

cleanup();
