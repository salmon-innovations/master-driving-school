const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/Schedule.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// The original border
content = content.replace(/'border-green-500 border-2 bg-green-50\/40 shadow-md'/g, "'border-[#2563eb] border-2 bg-blue-50/40 shadow-md'");

// Text color
content = content.replace(/isSel2 \? 'text-green-600' : isSel \? 'text-\[#2563eb\]'/g, "isSel2 ? 'text-[#2563eb]' : isSel ? 'text-[#2563eb]'");

// D2 Badge background
content = content.replace(/bg-green-600 px-1 rounded-sm\">D2/g, "bg-[#2563eb] px-1 rounded-sm\">D2");

// Some inside the slot map if any?
// Oh, the dot arrays inside the `daySlots.map`:
content = content.replace(/<span className={`w-1\\.5 h-1\\.5 rounded-full mb-0\\.5 \${isSlotSel \? 'bg-blue-600' : isSlot2Sel \? 'bg-green-500' : isFullyBooked \? 'bg-red-400' : isEmptySlot \? 'bg-gray-200' : 'bg-green-400'}`}<\/span>/g,
  "<span className={`w-1.5 h-1.5 rounded-full mb-0.5 ${isSlotSel ? 'bg-blue-600' : isSlot2Sel ? 'bg-[#2563eb]' : isFullyBooked ? 'bg-red-400' : isEmptySlot ? 'bg-gray-200' : 'bg-[#2563eb]'}`}></span>");

fs.writeFileSync(filePath, content);
console.log('Patched colors.');
