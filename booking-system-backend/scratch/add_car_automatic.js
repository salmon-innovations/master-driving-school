const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres', host: 'localhost', database: 'booking_system_db', password: 'admin123', port: 5432,
});

async function addCarAutomatic() {
  try {
    // 1. Fetch info from the Manual version to copy settings (price, etc)
    const manualRes = await pool.query("SELECT * FROM courses WHERE id = 4");
    if (manualRes.rows.length === 0) {
        console.error("Manual Car PDC (ID 4) not found");
        return;
    }
    const manual = manualRes.rows[0];

    // 2. Insert the Automatic version
    const insertRes = await pool.query(`
        INSERT INTO courses (name, category, course_type, duration, price, status, description, image_url, pricing_data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
    `, [
        'PDC Car Automatic',
        'PDC',
        'Automatic',
        manual.duration,
        manual.price,
        'active',
        manual.description,
        manual.image_url,
        manual.pricing_data
    ]);

    const newId = insertRes.rows[0].id;
    console.log(`Successfully created "PDC Car Automatic" with ID: ${newId}`);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

addCarAutomatic();
