const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres', host: 'localhost', database: 'booking_system_db', password: 'admin123', port: 5432,
});

async function fixNames() {
  try {
    const results = await pool.query("SELECT id, name FROM courses"); // Check all since some were updated to PDC PDC
    
    for (let row of results.rows) {
      // Find original intent from description or type if name is lost
      // But actually, I can just check the course_type column in the DB!
      // Let's fetch more columns.
    }
    
    // Manual mapping for the core 4 PDC courses based on their IDs if necessary, 
    // or just use typical patterns from course_type.
    
    const update = async (id, name) => {
        await pool.query('UPDATE courses SET name = $1 WHERE id = $2', [name, id]);
        console.log(`ID ${id} set to "${name}"`);
    };

    // Based on the IDs from the previous run:
    // ID 4: CAR
    // ID 3: MOTORCYCLE
    // ID 6: B1-VAN/B2-L300
    // ID 5: A1-TRICYCLE
    
    // Wait, let me check the course_type to see if it's Manual/Auto
    const rows = await pool.query("SELECT id, name, course_type FROM courses WHERE id IN (3,4,5,6)");
    for (let r of rows.rows) {
        let vehicle = '';
        if (r.id === 3) vehicle = 'Motor';
        if (r.id === 4) vehicle = 'Car';
        if (r.id === 5) vehicle = 'A1 Tricycle';
        if (r.id === 6) vehicle = 'B1 Van B2 L300';
        
        let trans = '';
        if (/AUTO|AT/i.test(r.course_type)) trans = 'Automatic';
        else if (/MANUAL|MT/i.test(r.course_type)) trans = 'Manual';
        
        const finalName = `PDC ${vehicle} ${trans}`.trim();
        await update(r.id, finalName);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

fixNames();
