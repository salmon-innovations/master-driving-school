import re

file_path = 'adminController.js'
with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update getDashboardStats
regex = r"    const revenueResult = await pool\.query\(\s*SELECT COALESCE\(SUM\(total_amount\), 0\) as total FROM bookings[\s\S]*?growthRate = 100;\r?\n    }"
replacement = '''    const isSuperAdmin = String(req.user.role || '').toLowerCase() === 'super_admin';
    const rawRevenueResult = await pool.query(
      SELECT total_amount, notes, status, created_at, b.course_id, c.price as course_price 
       FROM bookings b 
       LEFT JOIN courses c ON b.course_id = c.id 
       WHERE b.status IN ('confirmed', 'completed', 'paid', 'collectable') 
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
        lastMonthRevenue += tAmt;
      }
    });

    let currentRevenue = isSuperAdmin ? (currentRevCourse + currentRevAddons + currentRevConv) : currentRevCourse;
    let growthRate = 0;
    if (lastMonthRevenue > 0) {
      growthRate = ((currentRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
    } else if (currentRevenue > 0) {
      growthRate = 100;
    }'''

text = re.sub(regex, replacement, text)

# 2. Add extra fields to JSON response
text = re.sub(
r"        monthlyRevenue: currentRevenue,",
r"        monthlyRevenue: currentRevenue,\n        addon_sales_total: isSuperAdmin ? currentRevAddons : 0,\n        convenience_fee_total: isSuperAdmin ? currentRevConv : 0,\n        course_revenue: currentRevCourse,\n        total_sales_with_addons_and_convenience: isSuperAdmin ? (currentRevCourse + currentRevAddons + currentRevConv) : currentRevCourse,",
text
)

with open('adminController2.js', 'w', encoding='utf-8') as f:
    f.write(text)
print('Done frontend admin controller updates memory')
