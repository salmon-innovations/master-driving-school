const pool = require('../config/db');

async function addTestSlots() {
  try {
    const result = await pool.query(`
      INSERT INTO schedule_slots (date, type, session, time_range, total_capacity, available_slots)
      VALUES 
        ('2026-02-13', 'tdc', 'Whole Day', '08:00 AM - 05:00 PM', 20, 20),
        ('2026-02-13', 'pdc', 'Morning', '08:00 AM - 12:00 PM', 10, 10),
        ('2026-02-13', 'pdc', 'Afternoon', '01:00 PM - 05:00 PM', 8, 8)
      RETURNING *
    `);
    
    console.log('✅ Added test slots for February 13, 2026:');
    console.table(result.rows.map(r => ({
      id: r.id,
      date: r.date.toISOString().split('T')[0],
      type: r.type.toUpperCase(),
      session: r.session,
      time: r.time_range,
      capacity: `${r.available_slots}/${r.total_capacity}`
    })));
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

addTestSlots();
