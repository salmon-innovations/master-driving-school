const pool = require('./config/db');
pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'bookings'").then(res => {
  console.table(res.rows);
  process.exit();
});