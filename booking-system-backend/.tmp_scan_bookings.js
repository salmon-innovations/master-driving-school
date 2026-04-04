const pool = require('./config/db');
(async () => {
  const q = await pool.query(`
    SELECT id, total_amount, payment_type, course_price, course_name, course_category, notes, addons
    FROM bookings
    ORDER BY id DESC
    LIMIT 20
  `);
  const rows = q.rows.map(r => {
    let n = null;
    try { n = JSON.parse(r.notes || '{}'); } catch {}
    return {
      id: r.id,
      total_amount: r.total_amount,
      payment_type: r.payment_type,
      course_price: r.course_price,
      course_name: r.course_name,
      course_category: r.course_category,
      addons: r.addons,
      noteKeys: n ? Object.keys(n) : [],
      hasReviewer: n?.hasReviewer,
      hasVehicleTips: n?.hasVehicleTips,
      convenienceFee: n?.convenienceFee,
      promoDiscount: n?.promoDiscount,
      addonsDetailed: n?.addonsDetailed,
      courseListLen: Array.isArray(n?.courseList) ? n.courseList.length : 0,
      pdcSelectionsLen: n?.pdcSelections ? Object.keys(n.pdcSelections).length : 0,
    };
  });
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
})();
