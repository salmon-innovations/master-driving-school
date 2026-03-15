const pool = require('./config/db');

async function test() {
  const result = await pool.query(`
    SELECT b.id, b.total_amount, b.payment_type, b.payment_method,
           b.status, b.created_at, b.updated_at, b.notes, b.branch_id,
           u.first_name || ' ' || u.last_name AS student_name,
           c.name AS course_name, br.name AS branch_name
    FROM bookings b
    LEFT JOIN users u ON b.user_id = u.id
    LEFT JOIN courses c ON b.course_id = c.id
    LEFT JOIN branches br ON b.branch_id = br.id
    WHERE b.status IN ('paid', 'collectable')
    ORDER BY b.created_at DESC LIMIT 20
  `);

  const transactions = [];
  for (const row of result.rows) {
    const isPaid = row.status === 'paid' || row.payment_type === 'Full Payment';
    transactions.push({
      transaction_id: `TXN-${new Date(row.created_at).getFullYear()}-${String(row.id).padStart(3, '0')}`,
      student_name: row.student_name,
      amount: parseFloat(row.total_amount || 0),
      payment_method: row.payment_method,
      status: isPaid ? 'Success' : 'Collectable',
      course_name: row.course_name,
    });
    if (row.notes && row.notes.toLowerCase().includes('rescheduling fee')) {
      transactions.push({
        transaction_id: `TXN-${new Date(row.created_at).getFullYear()}-${String(row.id).padStart(3, '0')}-RSF`,
        student_name: row.student_name,
        amount: 1000,
        payment_method: 'Cash',
        status: 'Success',
        course_name: 'Rescheduling Fee',
      });
    }
  }
  console.log(JSON.stringify(transactions, null, 2));
  process.exit(0);
}
test().catch(e => { console.error(e.message); process.exit(1); });
