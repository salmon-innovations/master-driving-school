const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres', host: 'localhost', database: 'booking_system_db', password: 'admin123', port: 5432,
});

async function checkPrices() {
  const res = await pool.query("SELECT id, name, price FROM courses ORDER BY id");
  res.rows.forEach(r => {
    console.log(`[ID ${r.id}] ${r.name}: ${r.price}`);
  });
  await pool.end();
}
checkPrices();
