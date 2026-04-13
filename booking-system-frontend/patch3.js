const fs = require('fs');
const path = 'c:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-backend/controllers/adminController.js';
let content = fs.readFileSync(path, 'utf8');

// Patch 1: getDashboardStats
const getDashboardStatsRegex = /const revenueResult = await pool\.query\(\s*SELECT COALESCE\(SUM\(total_amount\), 0\) as total FROM bookings[\s\S]*?growthRate = 100;\r?\n    }/;
const dashboardStatsPatch = \const isSuperAdmin = String(req.user.role || '').toLowerCase() === 'super_admin';
    const rawRevenueResult = await pool.query(
      \\\SELECT total_amount, notes, status, created_at, b.course_id, c.price as course_price 
       FROM bookings b 
       LEFT JOIN courses c ON b.course_id = c.id 
       WHERE b.status IN ('confirmed', 'completed', 'paid', 'collectable') \\\\
    );

    let currentRevCourse = 0;
    let currentRevAddons = 0;
    let currentRevConv = 0;
    let lastMonthRevenue = 0;

    const todayDate = new Date();
    const currentMonth = todayDate.getMonth();
    const currentYear = todayDate.getFullYear();
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(currentMonth - 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastMonthYear = lastMonthDate.getFullYear();

    rawRevenueResult.rows.forEach(b => {
      const d = new Date(b.created_at);
      const isCurrent = d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      const isLast =  d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;

      const tAmt = parseFloat(b.total_amount || 0);
      let addrev = 0, conv = 0;

      if (b.notes && typeof b.notes === 'string' && b.notes.trim().startsWith('{')) {
        try {
          const js = JSON.parse(b.notes);
          if (js.convenienceFee) conv = parseFloat(js.convenienceFee);
          if (Array.isArray(js.addonsDetailed)) {
             addrev = js.addonsDetailed.reduce((sum, a) => sum + parseFloat(a.price || 0), 0);
          }
        } catch(e) {}
      }

      if (isCurrent) {
        currentRevAddons += addrev;
        currentRevConv += conv;
        currentRevCourse += Math.max(0, tAmt - addrev - conv);
      }
      if (isLast) {
        let l_addrev = 0, l_conv = 0;
        if (b.notes && typeof b.notes === 'string' && b.notes.trim().startsWith('{')) {
          try {
            const js = JSON.parse(b.notes);
            if (js.convenienceFee) l_conv = parseFloat(js.convenienceFee);
            if (Array.isArray(js.addonsDetailed)) {
               l_addrev = js.addonsDetailed.reduce((sum, a) => sum + parseFloat(a.price || 0), 0);
            }
          } catch(e) {}
        }
        let l_courseRev = Math.max(0, tAmt - l_addrev - l_conv);
        lastMonthRevenue += isSuperAdmin ? tAmt : l_courseRev;
      }
    });

    let currentRevenue = isSuperAdmin ? (currentRevCourse + currentRevAddons + currentRevConv) : currentRevCourse;
    let growthRate = 0;
    if (lastMonthRevenue > 0) {
      growthRate = ((currentRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
    } else if (currentRevenue > 0) {
      growthRate = 100;
    }\;
content = content.replace(getDashboardStatsRegex, dashboardStatsPatch);

content = content.replace(
  /monthlyRevenue: currentRevenue,/,
  \monthlyRevenue: currentRevenue,
        addon_sales_total: isSuperAdmin ? currentRevAddons : 0,
        convenience_fee_total: isSuperAdmin ? currentRevConv : 0,
        course_revenue: currentRevCourse,
        total_sales_with_addons_and_convenience: isSuperAdmin ? (currentRevCourse + currentRevAddons + currentRevConv) : currentRevCourse,\
);

// Patch 2: getRevenueData
const getRevenueDataRegex = /const result = await pool\.query\([\s\S]*?res\.json\(\{\s*success: true,\s*data: result\.rows,\s*\}\);/;
const revenueDataPatch = \const isSuperAdmin = String(req.user.role || '').toLowerCase() === 'super_admin';
      const rawRevenue = await pool.query(\\\
        SELECT 
          EXTRACT(MONTH FROM b.created_at) as month_index,
          TO_CHAR(b.created_at, 'Mon') as name,
          b.total_amount, b.notes, b.created_at
        FROM bookings b
        WHERE b.status IN ('confirmed', 'completed', 'paid', 'collectable')
          \
          AND b.created_at >= DATE_TRUNC('year', CURRENT_DATE)
      \\\, params);

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const currentMonthIndex = new Date().getMonth();
      const monthData = {};
      const addonBreakdownMap = {};
      
      let totalAddonsYear = 0;
      let totalConvYear = 0;

      rawRevenue.rows.forEach(r => {
        const m = (parseInt(r.month_index) || 1) - 1;
        const name = months[m];
        if (!monthData[name]) monthData[name] = 0;

        const tAmt = parseFloat(r.total_amount || 0);
        let addrev = 0, conv = 0;

        if (r.notes && typeof r.notes === 'string' && r.notes.trim().startsWith('{')) {
          try {
            const js = JSON.parse(r.notes);
            if (js.convenienceFee) conv = parseFloat(js.convenienceFee);
            if (Array.isArray(js.addonsDetailed)) {
               js.addonsDetailed.forEach(a => {
                  const aPrice = parseFloat(a.price || 0);
                  addrev += aPrice;
                  if (!addonBreakdownMap[a.name]) addonBreakdownMap[a.name] = { count: 0, revenue: 0 };
                  addonBreakdownMap[a.name].count += 1;
                  addonBreakdownMap[a.name].revenue += aPrice;
               });
            }
          } catch (e) {}
        }
        
        let courseRev = Math.max(0, tAmt - addrev - conv);
        totalAddonsYear += addrev;
        totalConvYear += conv;

        monthData[name] += isSuperAdmin ? (courseRev + addrev + conv) : courseRev;
      });

      const finalData = [];
      for (let i = 0; i <= currentMonthIndex; i++) {
        finalData.push({ name: months[i], revenue: monthData[months[i]] || 0 });
      }

      const addon_breakdown = Object.keys(addonBreakdownMap).map(k => ({ name: k, ...addonBreakdownMap[k] })).sort((a,b) => b.revenue - a.revenue);

      res.json({
        success: true,
        data: finalData,
        addon_breakdown: isSuperAdmin ? addon_breakdown : []
      });\;
content = content.replace(getRevenueDataRegex, revenueDataPatch);

fs.writeFileSync(path, content, 'utf8');
console.log('done node patch');
