const fs = require('fs');

const file = 'src/pages/Schedule.jsx';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  "  const promoPdcFiltered = promoPdcRawSlots.filter(promoPdcSlotMatches)\n    // Day 2 slots must match vehicle type AND must match the same session as Day 1\n    const promoPdcFiltered2 = promoPdcRawSlots2\n      .filter(promoPdcSlotMatches)",
  "  const promoPdcFiltered = promoPdcRawSlots.filter(promoPdcSlotMatches).sort((a, b) => ({ morning: 1, afternoon: 2, 'whole day': 3 }[(a.session || '').toLowerCase()] || 99) - ({ morning: 1, afternoon: 2, 'whole day': 3 }[(b.session || '').toLowerCase()] || 99));\n    // Day 2 slots must match vehicle type AND must match the same session as Day 1\n    const promoPdcFiltered2 = promoPdcRawSlots2\n      .filter(promoPdcSlotMatches).sort((a, b) => ({ morning: 1, afternoon: 2, 'whole day': 3 }[(a.session || '').toLowerCase()] || 99) - ({ morning: 1, afternoon: 2, 'whole day': 3 }[(b.session || '').toLowerCase()] || 99));"
);
c = c.replace(
  "  const promoPdcFiltered = promoPdcRawSlots.filter(promoPdcSlotMatches)\r\n    // Day 2 slots must match vehicle type AND must match the same session as Day 1\r\n    const promoPdcFiltered2 = promoPdcRawSlots2\r\n      .filter(promoPdcSlotMatches)",
  "  const promoPdcFiltered = promoPdcRawSlots.filter(promoPdcSlotMatches).sort((a, b) => ({ morning: 1, afternoon: 2, 'whole day': 3 }[(a.session || '').toLowerCase()] || 99) - ({ morning: 1, afternoon: 2, 'whole day': 3 }[(b.session || '').toLowerCase()] || 99));\r\n    // Day 2 slots must match vehicle type AND must match the same session as Day 1\r\n    const promoPdcFiltered2 = promoPdcRawSlots2\r\n      .filter(promoPdcSlotMatches).sort((a, b) => ({ morning: 1, afternoon: 2, 'whole day': 3 }[(a.session || '').toLowerCase()] || 99) - ({ morning: 1, afternoon: 2, 'whole day': 3 }[(b.session || '').toLowerCase()] || 99));"
);

c = c.replace(
  "                const day2Slots = dbSlots2.filter(s =>\n                  s.type?.toLowerCase() === 'pdc' &&\n                  pdcCourseTypeMatches(s.course_type)\n                )",
  "                const day2Slots = dbSlots2.filter(s =>\n                  s.type?.toLowerCase() === 'pdc' &&\n                  pdcCourseTypeMatches(s.course_type)\n                ).sort((a, b) => ({ morning: 1, afternoon: 2, 'whole day': 3 }[(a.session || '').toLowerCase()] || 99) - ({ morning: 1, afternoon: 2, 'whole day': 3 }[(b.session || '').toLowerCase()] || 99));"
);
c = c.replace(
  "                const day2Slots = dbSlots2.filter(s =>\r\n                  s.type?.toLowerCase() === 'pdc' &&\r\n                  pdcCourseTypeMatches(s.course_type)\r\n                )",
  "                const day2Slots = dbSlots2.filter(s =>\r\n                  s.type?.toLowerCase() === 'pdc' &&\r\n                  pdcCourseTypeMatches(s.course_type)\r\n                ).sort((a, b) => ({ morning: 1, afternoon: 2, 'whole day': 3 }[(a.session || '').toLowerCase()] || 99) - ({ morning: 1, afternoon: 2, 'whole day': 3 }[(b.session || '').toLowerCase()] || 99));"
);


fs.writeFileSync(file, c);
console.log("Patched array sorts successfully");