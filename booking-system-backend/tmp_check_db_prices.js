const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres', host: 'localhost', database: 'booking_system_db', password: 'admin123', port: 5432,
});

async function checkPrices() {
  try {
    const res = await pool.query(`
      SELECT id, name, price, course_type, pricing_data, branch_prices 
      FROM courses 
      WHERE name ILIKE '%TDC%' 
         OR name ILIKE '%Motorcycle%' 
         OR category = 'Promo'
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkPrices();
