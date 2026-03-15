const p = require('./config/db');
Promise.all([
  p.query("SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position"),
  p.query("SELECT column_name FROM information_schema.columns WHERE table_name='courses' ORDER BY ordinal_position"),
  p.query("SELECT column_name FROM information_schema.columns WHERE table_name='schedule_enrollments' ORDER BY ordinal_position"),
]).then(([u, c, e]) => {
  console.log('USERS:',       u.rows.map(r => r.column_name).join(', '));
  console.log('COURSES:',     c.rows.map(r => r.column_name).join(', '));
  console.log('ENROLLMENTS:', e.rows.map(r => r.column_name).join(', '));
  process.exit(0);
}).catch(err => { console.error(err.message); process.exit(1); });
