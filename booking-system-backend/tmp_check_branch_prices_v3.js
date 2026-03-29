const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres', host: 'localhost', database: 'booking_system_db', password: 'admin123', port: 5432,
});

async function checkBranchPrices() {
  const res = await pool.query("SELECT id, name, branch_prices FROM courses");
  res.rows.forEach(r => {
    if (r.branch_prices && Array.isArray(r.branch_prices) && r.branch_prices.length > 0) {
      console.log(`Course ${r.id}: ${r.name}`);
      console.log(`- Branch Overrides: ${JSON.stringify(r.branch_prices, null, 2)}`);
    }
  });
  await pool.end();
}
checkBranchPrices();
