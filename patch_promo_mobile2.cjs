const fs = require('fs');
const filePath = 'booking-system-frontend/src/pages/Schedule.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Inside promoPdcFiltered2 we want Day 2 to look like Day 1 (blue). But wait!
// The regular PDC calendar shouldn't be affected right? The prompt: 
// "now apply the design, effect, animation, and function on mobile view of regular PDC to Promo Bundle PDC mobile view."
// And earlier: "in the day 2 of the calendar make it same color blue like the day 1 "
// If I change ALL `green` to `blue` globally, I might break the regular PDC Day 2 which is still green, unless the user actually meant they wanted both blue everywhere.
// But it's safer to only do it in the `promoPdcFiltered2` mapping block.
const promo2Start = content.indexOf('{promoPdcFiltered2.map(slot => {');
const promo2End = content.indexOf('                          })}', promo2Start);

let block = content.substring(promo2Start, promo2End);

// Replace green elements with blue elements inside the third map block only
block = block.replace(/\?\s*'shadow-lg shadow-green-500\/20'/g, "? 'shadow-xl shadow-blue-500/30 scale-[1.02]'");
block = block.replace(/isDay2\s*\?\s*'#166534'/g, "isDay2 ? '#fff'");
block = block.replace(/isDay2\s*\?\s*'#22c55e'/g, "isDay2 ? 'rgba(255,255,255,0.3)'");
block = block.replace(/isDay2\s*\n\s*\?\s*\{\s*background:\s*'#dcfce7',\s*color:\s*'#15803d'\s*\}/g, "isDay2\n                                  ? { background: 'rgba(255,255,255,0.18)', color: '#fff' }");

content = content.substring(0, promo2Start) + block + content.substring(promo2End);

fs.writeFileSync(filePath, content);
console.log('Fixed greens to blues in Promo Day 2 block exclusively.');
