const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_nUy1mLAHD6TZ@ep-summer-king-a1rsfih7-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
});

async function clearStud() {
  try {
    const studentRes = await pool.query('SELECT * FROM student_enrollments WHERE email = $1', ['gabasamarcjeff03@gmail.com']);
    console.log('Student Enrollments:', studentRes.rows);
    for (const student of studentRes.rows) {
      // Find the schedule_enrollment for this student
      const enrollRes = await pool.query('SELECT * FROM schedule_enrollments WHERE student_id = $1', [student.id]);
      console.log('Assoc Schedule Enrollments:', enrollRes.rows);
      for (const en of enrollRes.rows) {
        if(en.slot_id) {
          await pool.query('UPDATE schedule_slots SET available_slots = available_slots + 1 WHERE id = $1', [en.slot_id]);
          console.log('Restored slot for slot_id', en.slot_id);
        }
        await pool.query('DELETE FROM schedule_enrollments WHERE id = $1', [en.id]);
      }
      // Also delete any transactions
      await pool.query('DELETE FROM transactions WHERE enrollment_id = $1', [student.id]);
      
      await pool.query('DELETE FROM student_enrollments WHERE id = $1', [student.id]);
      console.log('Deleted student enrollment id:', student.id);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    pool.end();
  }
}

clearStud();