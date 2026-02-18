const pool = require('../config/db');

async function resetScheduleSlots() {
  try {
    console.log('🔄 Resetting schedule_slots table...');
    
    // Delete all data from schedule_slots
    await pool.query('DELETE FROM schedule_slots');
    console.log('✅ Deleted all schedule_slots data');
    
    // Reset the ID sequence to start from 1
    await pool.query('ALTER SEQUENCE schedule_slots_id_seq RESTART WITH 1');
    console.log('✅ Reset ID sequence to start at 1');
    
    // Verify
    const result = await pool.query('SELECT COUNT(*) as count FROM schedule_slots');
    console.log(`📊 Current record count: ${result.rows[0].count}`);
    
    console.log('✅ Schedule slots table reset successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Full error:', err);
    process.exit(1);
  }
}

resetScheduleSlots();
