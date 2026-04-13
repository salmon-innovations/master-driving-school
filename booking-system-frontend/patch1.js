const fs = require('fs');

async function patchBackend() {
  const file = 'adminController.js';
  let txt = fs.readFileSync(file, 'utf8');
  
  // 1. modify getDashboardStats
  txt = txt.replace(/const revenueResult = await pool.query\([\s\S]*?const lastMonthRevenueResult/m, 
// Compute detailed revenue
    const isSuperAdmin = String(req.user.role || '').toLowerCase() === 'super_admin';
    const rawRevenueResult = await pool.query(\
      SELECT total_amount, notes, course_id, b.id, b.status, c.price as course_base_price
      FROM bookings b
      LEFT JOIN courses c ON b.course_id = c.id
      WHERE b.status IN ('confirmed', 'completed', 'paid', 'collectable') \
      AND EXTRACT(MONTH FROM b.created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(YEAR FROM b.created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
    \);
    
    let totalCourseRev = 0;
    let totalAddonsRev = 0;
    let totalConvFee = 0;
    
    rawRevenueResult.rows.forEach(r => {
      let sub = 0;
      let conv = 0;
      let addrev = 0;
      let isParsed = false;
      if (r.notes) {
        try {
          const js = typeof r.notes === 'string' && r.notes.startsWith('{') ? JSON.parse(r.notes) : r.notes;
          if (js) {
            conv = Number(js.convenienceFee || 0);
            if (Array.isArray(js.addonsDetailed)) {
                addrev = js.addonsDetailed.reduce((a, b) => a + Number(b.price || 0), 0);
            }
            if (Array.isArray(js.courseList)) {
                sub = js.courseList.reduce((a, b) => a + Number(b.price || 0), 0);
            } else if (js.subtotal) {
                sub = js.subtotal;
            } else {
                sub = Number(r.course_base_price || 0);
            }
            
            // if promoDiscount applied, apply proportionally to subtotal and addons? No, usually promo discount applies to subtotal+addons. 
            // We can just use the flat addrev and conv fee, and subtract those from total_amount to get course revenue if we don't have promo discount.
            isParsed = true;
          }
        } catch(e){}
      }
      
      const tAmt = Number(r.total_amount || 0);
      if (isParsed) {
          totalAddonsRev += addrev;
          totalConvFee += conv;
          // exact course rev = overall total - addons - conv 
          totalCourseRev += (tAmt - addrev - conv);
      } else {
          totalCourseRev += tAmt;
      }
    });

    const currentRevenue = isSuperAdmin ? (totalCourseRev + totalAddonsRev + totalConvFee) : totalCourseRev;
    
    const lastMonthRevenueResult);

  // 2. add addon breakdowns to the exported stats in getDashboardStats
  txt = txt.replace(/monthlyRevenue: currentRevenue,/g, 
  monthlyRevenue: currentRevenue,
        addon_sales_total: isSuperAdmin ? totalAddonsRev : 0,
        convenience_fee_total: isSuperAdmin ? totalConvFee : 0,
        total_sales_with_addons_and_convenience: isSuperAdmin ? (totalCourseRev + totalAddonsRev + totalConvFee) : totalCourseRev,
        course_revenue: totalCourseRev,);

  fs.writeFileSync(file, txt);
  console.log("Patched getDashboardStats in adminController.js");
}
patchBackend();
