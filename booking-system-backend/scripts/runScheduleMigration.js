const pool = require('../config/db');

async function runMigration() {
  try {
    console.log('🔄 Running schedule tables migration...');
    
    // Drop existing tables if they exist (CASCADE will drop dependent objects)
    console.log('🗑️  Dropping existing tables...');
    await pool.query('DROP TABLE IF EXISTS schedule_enrollments CASCADE');
    await pool.query('DROP TABLE IF EXISTS schedule_slots CASCADE');
    console.log('✅ Dropped old tables');
    
    // Create schedule_slots table
    await pool.query(`
      CREATE TABLE schedule_slots (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        type VARCHAR(10) NOT NULL CHECK (type IN ('tdc', 'pdc')),
        session VARCHAR(20) NOT NULL CHECK (session IN ('Morning', 'Afternoon', 'Whole Day')),
        time_range VARCHAR(50) NOT NULL,
        total_capacity INTEGER NOT NULL,
        available_slots INTEGER NOT NULL,
        branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created schedule_slots table');
    
    // Create schedule_enrollments table
    await pool.query(`
      CREATE TABLE schedule_enrollments (
        id SERIAL PRIMARY KEY,
        slot_id INTEGER REFERENCES schedule_slots(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        enrollment_status VARCHAR(20) DEFAULT 'enrolled' CHECK (enrollment_status IN ('enrolled', 'completed', 'cancelled', 'no-show')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(slot_id, student_id)
      )
    `);
    console.log('✅ Created schedule_enrollments table');
    
    // Create indexes
    await pool.query('CREATE INDEX idx_schedule_slots_date ON schedule_slots(date)');
    await pool.query('CREATE INDEX idx_schedule_slots_branch ON schedule_slots(branch_id)');
    await pool.query('CREATE INDEX idx_schedule_enrollments_slot ON schedule_enrollments(slot_id)');
    await pool.query('CREATE INDEX idx_schedule_enrollments_student ON schedule_enrollments(student_id)');
    console.log('✅ Created indexes');
    
    // Verify tables were created with correct schema
    const columnsCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'schedule_slots'
      ORDER BY ordinal_position
    `);
    console.log('📋 Columns in schedule_slots:', columnsCheck.rows.map(r => r.column_name).join(', '));
    
    console.log('✅ Schedule tables migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

runMigration();
