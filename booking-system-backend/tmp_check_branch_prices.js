const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres', host: 'localhost', database: 'booking_system_db', password: 'admin123', port: 5432,
});

async function checkBranchPrices() {
  const res = await pool.query("SELECT id, name, branch_prices FROM courses WHERE id IN (2, 4, 3)");
  res.rows.forEach(r => {
    console.log(`Course ${r.id}: ${r.name}`);
    console.log(`- Branch Prices: ${JSON.stringify(r.branch_prices, null, 2)}`);
  });
  await pool.end();
}
checkBranchPrices();
