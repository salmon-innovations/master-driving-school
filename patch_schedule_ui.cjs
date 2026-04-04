const fs = require('fs');
let c = fs.readFileSync('booking-system-frontend/src/pages/Schedule.jsx', 'utf8');

c = c.replaceAll("morning: 1, afternoon: 2, 'whole day': 3", 
  "'morning class': 1, 'afternoon class': 2, 'whole day class': 3, 'morning': 1, 'afternoon': 2, 'whole day': 3");

c = c.replaceAll("min-h-[100px]", "min-h-[52px] sm:min-h-[140px]");
c = c.replaceAll("min-h-[110px]", "min-h-[52px] sm:min-h-[140px]");
c = c.replaceAll("text-[10px] sm:text-[11px] truncate", "text-[9px] sm:text-xs truncate font-medium");
c = c.replaceAll("text-xs sm:text-sm font-semibold", "text-[10px] sm:text-xs font-semibold");

fs.writeFileSync('booking-system-frontend/src/pages/Schedule.jsx', c);
console.log('Patched frontend schedule.');