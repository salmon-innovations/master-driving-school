const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/Schedule.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// The original border (handled the first fix)
content = content.replace(/'border-green-500 border-2 bg-green-50\/40 shadow-md'/g, "'border-[#2563eb] border-2 bg-blue-50/40 shadow-md'");

// Text color
content = content.replace(/isSel2 \? 'text-green-600' : isSel \? 'text-\[#2563eb\]'/g, "isSel2 ? 'text-[#2563eb]' : isSel ? 'text-[#2563eb]'");

// D2 Badge background
content = content.replace(/bg-green-600 px-1 rounded-sm\">D2/g, "bg-[#2563eb] px-1 rounded-sm\">D2");

// Slot Backgrounds in the Calendar
content = content.replace(
  /isSlotSel2 \? 'border-green-500 bg-green-500 text-white shadow-sm'/g,
  "isSlotSel2 ? 'border-[#2563eb] bg-[#2563eb] text-white shadow-sm'"
);

// If there's another instance of isSlotSel2 styling in the code (around line 2102) maybe we don't touch regular PDC's colors if they are green, but user didn't specify. 
// "in the day 2 of the calendar make it same color blue like the day 1 " - means the calendar. We'll stick to replacing what we've hit.

fs.writeFileSync(filePath, content);
console.log('Patched slotted colors.');
