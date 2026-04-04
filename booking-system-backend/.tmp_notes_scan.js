const pool = require('./config/db');
(async () => {
  const q = await pool.query(`
    SELECT id, total_amount, payment_type, notes
    FROM bookings
    ORDER BY id DESC
    LIMIT 8
  `);
  const rows = q.rows.map(r => {
    let parsed = null;
    try { parsed = JSON.parse(r.notes || '{}'); } catch {}
    return {
      id: r.id,
      total_amount: r.total_amount,
      payment_type: r.payment_type,
      noteKeys: parsed ? Object.keys(parsed) : [],
      promoDiscount: parsed?.promoDiscount,
      convenienceFee: parsed?.convenienceFee,
      addonsDetailed: parsed?.addonsDetailed,
      totalAssessed: parsed?.totalAssessed,
      netTotal: parsed?.netTotal,
      totalAmount: parsed?.totalAmount,
      amountPaid: parsed?.amountPaid,
      remainingBalance: parsed?.remainingBalance,
      hasReviewer: parsed?.hasReviewer,
      hasVehicleTips: parsed?.hasVehicleTips,
      courseList: parsed?.courseList,
    };
  });
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
})();
