const pool = require('./config/db');
(async () => {
  const q = await pool.query(`
    SELECT id, course_id, total_amount, payment_type, notes, created_at
    FROM bookings
    ORDER BY id DESC
    LIMIT 30
  `);
  const rows = q.rows.map(r => {
    let n = null;
    try { n = JSON.parse(r.notes || '{}'); } catch {}
    const courseList = Array.isArray(n?.courseList) ? n.courseList : [];
    const hasTdc = courseList.some(c => String(c?.category || c?.name || '').toLowerCase().includes('tdc'));
    const hasPdc = courseList.some(c => String(c?.category || c?.name || '').toLowerCase().includes('pdc'));
    return {
      id: r.id,
      total_amount: Number(r.total_amount || 0),
      payment_type: r.payment_type,
      course_id: r.course_id,
      created_at: r.created_at,
      noteKeys: n ? Object.keys(n) : [],
      hasReviewer: n?.hasReviewer,
      hasVehicleTips: n?.hasVehicleTips,
      convenienceFee: n?.convenienceFee,
      promoDiscount: n?.promoDiscount,
      addonsDetailed: n?.addonsDetailed,
      courseListLen: courseList.length,
      pdcSelectionsLen: n?.pdcSelections ? Object.keys(n.pdcSelections).length : 0,
      hasTdc,
      hasPdc,
      courseNames: courseList.map(c => c?.name).filter(Boolean),
    };
  });
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
})();
