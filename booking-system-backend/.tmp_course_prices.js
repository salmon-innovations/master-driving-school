const pool = require('./config/db');
(async () => {
  const q = await pool.query(`
    SELECT id, name, category, price
    FROM courses
    WHERE name ILIKE '%THEORETICAL DRIVING COURSE%' OR name ILIKE '%MOTORCYCLE%' OR name ILIKE '%(CAR)%'
    ORDER BY id DESC
    LIMIT 20
  `);
  console.log(JSON.stringify(q.rows, null, 2));
  process.exit(0);
})();
