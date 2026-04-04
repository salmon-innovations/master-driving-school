const fs = require('fs');
const file = 'c:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-frontend/src/pages/Schedule.jsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

let start = lines.findIndex(l => l.includes('{day2Slots.map(slot => {'));
if (start !== -1) {
  let isFull2Idx = -1;
  let returnIdx = -1;
  for (let i = start; i < start + 10; i++) {
    if (lines[i].includes('const isFull2')) isFull2Idx = i;
    if (lines[i].includes('return (')) { returnIdx = i; break; }
  }
  
  if (returnIdx !== -1) {
    // Add isSessionMismatch
    lines.splice(returnIdx, 0, "                      const isSessionMismatch = selectedSlot && slot.session !== selectedSlot.session;");
    lines.splice(returnIdx + 1, 0, "                      const baseStyle = isSel2 ? { background: colors2.bg } : {};");
    lines.splice(returnIdx + 2, 0, "                      if (isSessionMismatch) { baseStyle.filter = 'grayscale(100%) opacity(50%)'; baseStyle.cursor = 'not-allowed'; }");
    
    // Now fix the button
    let buttonIdx = -1;
    for (let i = returnIdx + 3; i < returnIdx + 20; i++) {
      if (lines[i].includes('<button')) {
        buttonIdx = i;
        break;
      }
    }
    
    if (buttonIdx !== -1) {
      for (let i = buttonIdx; i < buttonIdx + 10; i++) {
        if (lines[i].includes('disabled={isFull2}')) {
          lines[i] = lines[i].replace('disabled={isFull2}', 'disabled={isFull2 || isSessionMismatch}');
        }
        if (lines[i].includes('style={isSel2')) {
          lines[i] = Object.assign(lines[i].replace(/style=\{[^\}]+\}/g, 'style={baseStyle}'), {length: lines[i].length}); // Note: simple replace
          lines[i] = "                          style={baseStyle}";
        }
        if (lines[i].includes(': isFull2 ?')) {
          lines[i] = lines[i].replace(': isFull2 ?', ': isFull2 || isSessionMismatch ?');
        }
      }
    }
  }
}

fs.writeFileSync(file, lines.join('\n'));