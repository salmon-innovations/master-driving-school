const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'booking_system_db',
  password: process.env.DB_PASSWORD || 'admin123',
  port: process.env.DB_PORT || 5432,
});

async function standardizeAllPdcNames() {
  try {
    console.log('Connecting to database...');
    
    // Mapping of Verbose patterns to Clean names
    // Examples: 
    // "Practical Driving Course(PDC) - (CAR) - Manual" -> "PDC Car Manual"
    // "Practical Driving Course(PDC) - (MOTORCYCLE) - Automatic" -> "PDC Motor Automatic"
    
    const results = await pool.query("SELECT id, name FROM courses WHERE category = 'PDC'");
    console.log(`Analyzing ${results.rowCount} PDC courses...`);

    for (let row of results.rows) {
      const oldName = row.name;
      let newName = oldName;

      // Logic to simplify the name
      // 1. Extract vehicle type from parentheses (CAR), (MOTORCYCLE), etc.
      // 2. Extract transmission MT/Manual or AT/Automatic
      
      const parenMatch = oldName.match(/\(([^)]+)\)/);
      let vehicle = parenMatch ? parenMatch[1] : '';
      
      // Clean up vehicle name
      if (/MOTOR|MOTORCYCLE/i.test(vehicle)) vehicle = 'Motor';
      else if (/A1|TRICYCLE/i.test(vehicle)) vehicle = 'A1 Tricycle';
      else if (/B1|B2|VAN|L300/i.test(vehicle)) vehicle = 'B1 Van B2 L300';
      else if (/CAR/i.test(vehicle)) vehicle = 'Car';
      else vehicle = vehicle.replace(/\b\w/g, c => c.toUpperCase());

      // Transmission
      let transmission = '';
      if (/AUTOMATIC|AUTO|\bAT\b/i.test(oldName)) transmission = 'Automatic';
      else if (/MANUAL|\bMT\b/i.test(oldName)) transmission = 'Manual';

      const parts = ['PDC', vehicle, transmission].filter(Boolean);
      newName = parts.join(' ');

      if (newName !== oldName) {
        console.log(`Updating ID ${row.id}: "${oldName}" -> "${newName}"`);
        await pool.query('UPDATE courses SET name = $1 WHERE id = $2', [newName, row.id]);
      }
    }

    console.log('--- Individual PDC naming standardized! ---');
  } catch (err) {
    console.error('Update failed:', err);
  } finally {
    await pool.end();
  }
}

standardizeAllPdcNames();
