const fs = require('fs');
const file = 'src/pages/Schedule.jsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

let startPromo = lines.findIndex(l => l.includes('const isMismatched = promoPdcSelectingDay2 && promoPdcSlot'));
if (startPromo !== -1) {
  for (let i = startPromo; i < startPromo + 30; i++) {
    if (lines[i].includes(': isFullyBooked ? \'bg-red-100 text-red-600\'')) {
        if (!lines[i-1].includes('isMismatched')) {
             lines.splice(i, 0, "                                              : isMismatched ? 'bg-gray-100 text-gray-500'");
             break; // done with this block
        }
    }
  }
}
fs.writeFileSync(file, lines.join('\n'));