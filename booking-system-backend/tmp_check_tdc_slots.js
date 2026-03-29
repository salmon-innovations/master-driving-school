const pool = require('./config/db');

async function checkTdcSlots() {
  try {
    const result = await pool.query(`
      SELECT id, date, end_date, type, session, time_range 
      FROM schedule_slots 
      WHERE type ILIKE 'tdc' AND date = '2026-03-26'
    `);
    console.log('TDC Slots for 2026-03-26:');
    console.log(JSON.stringify(result.rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkTdcSlots();
