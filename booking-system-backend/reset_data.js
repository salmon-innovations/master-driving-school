const db = require('./config/db.js');

async function run() {
  try {
    // Start transaction
    await db.query('BEGIN');

    // Clear dependent tables first to avoid FK constraints
    console.log("Deleting schedule_enrollments...");
    await db.query('DELETE FROM schedule_enrollments');
    await db.query('ALTER SEQUENCE IF EXISTS schedule_enrollments_id_seq RESTART WITH 1');

    console.log("Deleting bookings...");
    await db.query('DELETE FROM bookings');
    await db.query('ALTER SEQUENCE IF EXISTS bookings_id_seq RESTART WITH 1');
    
    console.log("Deleting transactions (sales)...");
    await db.query('DELETE FROM transactions');
    await db.query('ALTER SEQUENCE IF EXISTS transactions_id_seq RESTART WITH 1');

    console.log("Deleting schedule slots...");
    await db.query('DELETE FROM schedule_slots');
    await db.query('ALTER SEQUENCE IF EXISTS schedule_slots_id_seq RESTART WITH 1');

    console.log("Deleting cart_items...");
    await db.query('DELETE FROM cart_items');
    await db.query('ALTER SEQUENCE IF EXISTS cart_items_id_seq RESTART WITH 1');

    console.log("Deleting student_enrollments...");
    await db.query('DELETE FROM student_enrollments');
    await db.query('ALTER SEQUENCE IF EXISTS student_enrollments_id_seq RESTART WITH 1');

    console.log("Deleting users except admin@gmail.com...");
    await db.query('DELETE FROM users WHERE email != $1', ['admin@gmail.com']);
    
    // Set user sequence to the highest current ID (which will be the admin's ID)
    await db.query("SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1))");

    await db.query('COMMIT');
    console.log("Successfully wiped data and reset sequences!");
  } catch (error) {
    await db.query('ROLLBACK');
    console.error("Error wiping data:", error);
  } finally {
    process.exit(0);
  }
}

run();