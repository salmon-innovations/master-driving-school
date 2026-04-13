const pool = require('./config/db');
pool.query('SELECT column_name FROM information_schema.columns WHERE table_name=$1', ['schedule_slots'])
  .then(r => { console.log(r.rows); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
