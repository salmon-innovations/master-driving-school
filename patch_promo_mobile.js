const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'booking-system-frontend', 'src', 'pages', 'Schedule.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Extract the relevantSlots mapping function logic
const relStart = content.indexOf('{relevantSlots.map(');
const relRetStart = content.indexOf('return (', relStart);
const relMapEnd = content.indexOf('                })}', relStart);
const mapInnerFuncLogic = content.substring(relStart + '{relevantSlots.map('.length, relMapEnd);

// For promo1:
const promo1Start = content.indexOf('{promoPdcFiltered.map(slot => {');
const promo1End = content.indexOf('                          })}', promo1Start);

let promo1Logic = mapInnerFuncLogic
  .replace(/\(slot\) => \{/, 'slot => {')
  .replace(/const isDay1 = selectedSlot\?\.id === slot\.id/g, 'const isDay1 = promoPdcSlot?.id === slot.id\n                              const isSel = promoPdcSlot?.id === slot.id')
  .replace(/const isDay2 = selectedSlot2\?\.id === slot\.id/g, 'const isDay2 = false');

content = content.substring(0, promo1Start) + '{promoPdcFiltered.map(' + promo1Logic + '                          })}' + content.substring(promo1End + 29);

// For promo2:
const promo2Start = content.indexOf('{promoPdcFiltered2.map(slot => {');
const promo2End = content.indexOf('                          })}', promo2Start);

let promo2Logic = mapInnerFuncLogic
  .replace(/\(slot\) => \{/, 'slot => {')
  .replace(/const isDay1 = selectedSlot\?\.id === slot\.id/g, 'const isDay1 = false\n                              const isSel = promoPdcSlot2?.id === slot.id')
  .replace(/const isDay2 = selectedSlot2\?\.id === slot\.id/g, 'const isDay2 = promoPdcSlot2?.id === slot.id');

// The user also wanted Day 2 design exact same color blue like day 1 (even in mobile!)
// So let's override the `isDay2` styling to match `isDay1`!
promo2Logic = promo2Logic
  .replace(/cardBg = isDay1\s*\n\s*\?\s*'linear-gradient\(135deg, #1a4fba 0%, #1e3a8a 100%\)'\s*\n\s*:\s*isDay2\s*\n\s*\?\s*'#f0fdf4'/g,
    "cardBg = isDay1 ? 'linear-gradient(135deg, #1a4fba 0%, #1e3a8a 100%)' : isDay2 ? 'linear-gradient(135deg, #1a4fba 0%, #1e3a8a 100%)'")
  .replace(/cardBorder = isDay1\s*\n\s*\?\s*'transparent'\s*\n\s*:\s*isDay2\s*\n\s*\?\s*'#22c55e'/g,
    "cardBorder = isDay1 ? 'transparent' : isDay2 ? 'transparent'")
  .replace(/isDay1 \? 'rgba\(255,255,255,0\.3\)' : isDay2 \? '#22c55e'/g,
    "isDay1 ? 'rgba(255,255,255,0.3)' : isDay2 ? 'rgba(255,255,255,0.3)'")
  .replace(/isDay1 \? '✓ DAY 1' : isDay2 \? '✓ DAY 2'/g,
    "isDay1 ? '✓ DAY 1' : isDay2 ? '✓ DAY 2'")
  .replace(/isDay1\s*\n\s*\?\s*\{ background: 'rgba\(255,255,255,0\.18\)', color: '#fff' \}\s*\n\s*:\s*isDay2\s*\n\s*\?\s*\{ background: '#dcfce7', color: '#15803d' \}/g,
    "isDay1\n                                ? { background: 'rgba(255,255,255,0.18)', color: '#fff' }\n                                : isDay2\n                                  ? { background: 'rgba(255,255,255,0.18)', color: '#fff' }")
  .replace(/isDay1 \? '#fff' : isDay2 \? '#166534'/g,
    "isDay1 ? '#fff' : isDay2 ? '#fff'");

// Ensure the green shadow on Day 2 selection is made blue in the button className!
promo2Logic = promo2Logic.replace(/isDay2\s*\n\s*\?\s*'shadow-lg shadow-green-500\/20'/g,
  "isDay2\n                            ? 'shadow-xl shadow-blue-500/30 scale-[1.02]'");

// Let's actually adjust `promo1Logic` to make sure Day 2 is completely removed and we just check 'isDay1' since these cards are separated blocks.
content = content.substring(0, promo2Start) + '{promoPdcFiltered2.map(' + promo2Logic + '                          })}' + content.substring(promo2End + 29);

// Write changes
fs.writeFileSync(filePath, content);
console.log('Mobile cards patched!');
