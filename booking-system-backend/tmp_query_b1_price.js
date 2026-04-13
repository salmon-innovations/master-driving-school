const pool = require('./config/db');
(async () => {
  try {
    const sql = "SELECT id,name,category,price,discount,course_type,pricing_data,branch_prices FROM courses WHERE name ILIKE '%B1%' OR course_type ILIKE '%B1%' ORDER BY id";
    const r = await pool.query(sql);
    console.log(JSON.stringify(r.rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
})();
