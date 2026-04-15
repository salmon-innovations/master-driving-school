const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres', host: 'localhost', database: 'booking_system_db', password: 'admin123', port: 5432,
});

async function addCarAutomatic() {
  try {
    const manualRes = await pool.query("SELECT * FROM courses WHERE id = 4");
    if (manualRes.rows.length === 0) return;
    const manual = manualRes.rows[0];

    // Ensure pricing_data is handled correctly as JSON object or null
    let pricingData = manual.pricing_data;
    // If it's a string, we might need to parse it if we were re-encoding, 
    // but the PG driver usually handles objects fine if the column is JSONB.
    
    await pool.query(`
        INSERT INTO courses (name, category, course_type, duration, price, status, description, image_url, pricing_data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
        'PDC Car Automatic',
        'PDC',
        'Automatic',
        manual.duration,
        manual.price,
        'active',
        manual.description,
        manual.image_url,
        pricingData
    ]);

    console.log(`Successfully created "PDC Car Automatic"!`);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

addCarAutomatic();
