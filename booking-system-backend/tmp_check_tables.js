const pool = require('./config/db');
async function check() {
  const res = await pool.query("SELECT id, name, price, discount FROM courses WHERE discount IS NOT NULL AND discount > 0 LIMIT 10");
  console.log('Courses with discounts:');
  console.table(res.rows);
  pool.end();
}
check();
