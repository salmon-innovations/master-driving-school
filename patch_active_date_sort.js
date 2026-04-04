const fs = require('fs');

const file = 'src/pages/Schedule.jsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "      if (!isTDCCourse && selectingDay2 && selectedSlot && isHalfDay(selectedSlot.session)) {\r\n        slots = slots.filter(s => s.session === selectedSlot.session)\r\n      }\r\n\r\n      return slots\r\n    })()",
  "      if (!isTDCCourse && selectingDay2 && selectedSlot && isHalfDay(selectedSlot.session)) {\r\n        slots = slots.filter(s => s.session === selectedSlot.session)\r\n      }\r\n\r\n      slots.sort((a, b) => ({ morning: 1, afternoon: 2, 'whole day': 3 }[(a.session || '').toLowerCase()] || 99) - ({ morning: 1, afternoon: 2, 'whole day': 3 }[(b.session || '').toLowerCase()] || 99));\r\n\r\n      return slots\r\n    })()"
);

code = code.replace(
  "      if (!isTDCCourse && selectingDay2 && selectedSlot && isHalfDay(selectedSlot.session)) {\n        slots = slots.filter(s => s.session === selectedSlot.session)\n      }\n\n      return slots\n    })()",
  "      if (!isTDCCourse && selectingDay2 && selectedSlot && isHalfDay(selectedSlot.session)) {\n        slots = slots.filter(s => s.session === selectedSlot.session)\n      }\n\n      slots.sort((a, b) => ({ morning: 1, afternoon: 2, 'whole day': 3 }[(a.session || '').toLowerCase()] || 99) - ({ morning: 1, afternoon: 2, 'whole day': 3 }[(b.session || '').toLowerCase()] || 99));\n\n      return slots\n    })()"
);


fs.writeFileSync(file, code);
console.log("Patched array sort successfully");