const pool = require('./config/db');
(async () => {
  const b = (await pool.query(`SELECT id, notes FROM bookings WHERE id = 1`)).rows[0];
  const n = JSON.parse(b.notes || '{}');
  const courseNames = (n.courseList || []).map(c => c.name);
  const cRes = await pool.query(`SELECT name, price, category FROM courses`);
  const byName = new Map(cRes.rows.map(r => [String(r.name || '').trim().toLowerCase(), Number(r.price || 0)]));
  const courseSubtotal = courseNames.reduce((s, name) => s + (byName.get(String(name).trim().toLowerCase()) || 0), 0);
  const reviewer = n.hasReviewer ? 30 : 0;
  const tips = n.hasVehicleTips ? 20 : 0;
  const convenience = 25 * Math.max(1, courseNames.length || 1);
  const base = courseSubtotal + reviewer + tips + convenience;
  const promo = (courseNames.some(x => /tdc/i.test(x)) && courseNames.some(x => /pdc/i.test(x))) ? Number((base * 0.03).toFixed(2)) : 0;
  const net = Number((base - promo).toFixed(2));
  const down = Number((net * 0.5).toFixed(2));
  console.log({ courseSubtotal, reviewer, tips, convenience, promo, net, down });
  process.exit(0);
})();
