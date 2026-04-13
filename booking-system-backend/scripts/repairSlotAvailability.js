const pool = require('../config/db');

async function repairSlotAvailability() {
  try {
    const result = await pool.query(`
      WITH active_counts AS (
        SELECT
          slot_id,
          COUNT(*)::int AS used_count
        FROM schedule_enrollments
        WHERE enrollment_status NOT IN ('cancelled', 'no-show')
        GROUP BY slot_id
      )
      UPDATE schedule_slots s
      SET
        available_slots = GREATEST(0, LEAST(s.total_capacity, s.total_capacity - COALESCE(a.used_count, 0))),
        updated_at = CURRENT_TIMESTAMP
      FROM (SELECT id FROM schedule_slots) all_slots
      LEFT JOIN active_counts a ON a.slot_id = all_slots.id
      WHERE s.id = all_slots.id
      RETURNING s.id
    `);

    console.log(`Recomputed slot availability for ${result.rowCount} slots.`);
  } catch (error) {
    console.error('Failed to repair slot availability:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

repairSlotAvailability();
