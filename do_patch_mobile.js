const fs = require('fs');

let code = fs.readFileSync('booking-system-frontend/src/pages/Schedule.jsx', 'utf8');

// 1. We are going to erase the entire "PDC Day 2 Slots" mobile list block.
const day2BlockStart = '{/* PDC Day 2 Slots */}';
const day2BlockEnd = '{/* Submit Button */}'; // Wait, let's find the exact boundaries.
const d2a = code.indexOf(day2BlockStart);
const str2 = '{(promoPdcType !== \'Motorcycle\' || promoPdcMotorType) && promoPdcSlot && promoPdcSlot2 && (';
const d2b = code.indexOf(str2);

if (d2a !== -1 && d2b !== -1 && d2b > d2a) {
    code = code.substring(0, d2a) + code.substring(d2b);
    console.log("Day 2 Mobile List Block erased!");
} else {
    console.log("Could not find Day 2 Mobile list boundaries.");
}

// 2. We will convert the Day 1 Mobile list to act conditionally for Day 1 AND Day 2.
// Find: {/* PDC Day 1 Slots */} and replace its wrapper and array iteration.
const listTarget = /\{\/\* PDC Day 1 Slots \*\/\}\s*\{\(promoPdcType !== 'Motorcycle' \|\| promoPdcMotorType\) && promoPdcDate && \(/;

const updatedListStart = `{/* PDC Time Slots (Mobile/Tablet View) */}
                  {(promoPdcType !== 'Motorcycle' || promoPdcMotorType) && (promoPdcDate || promoPdcDate2) && (`;

if (code.match(listTarget)) {
    code = code.replace(listTarget, updatedListStart);
    console.log("Mobile List start updated!");
}

// 3. Update the Title of the Mobile List
const titleTarget = /<h3 className="text-lg font-black text-gray-900">PDC Time Slots — \{pdcTypeLabel\} <span className="text-sm font-bold text-gray-400">\(Day 1\)<\/span><\/h3>/;
const updatedTitle = `<h3 className="text-lg font-black text-gray-900">PDC Time Slots — {pdcTypeLabel} <span className="text-sm font-bold text-gray-400">{promoPdcSelectingDay2 && promoPdcDate2 ? '(Day 2)' : '(Day 1)'}</span></h3>`;
code = code.replace(titleTarget, updatedTitle);

// 4. Update the subtitle Date in Mobile list
const dateSubTarget = /<p className="text-xs text-gray-500 mt-1">\{promoPdcDate\.toLocaleDateString\('en-US', \{ weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' \}\)\}<\/p>/;
const updatedDateSub = `<p className="text-xs text-gray-500 mt-1">
                          {(promoPdcSelectingDay2 && promoPdcDate2 ? promoPdcDate2 : promoPdcDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                          {promoPdcSelectingDay2 && promoPdcDate2 && \` · \${promoPdcSlot?.session} session\`}
                        </p>`;
code = code.replace(dateSubTarget, updatedDateSub);

// 5. Update the array mapped inside the list
const mapTarget = /\{promoPdcFiltered\.map\(slot => \{/g;
code = code.replace(mapTarget, "{(promoPdcSelectingDay2 ? promoPdcFiltered2 : promoPdcFiltered).map(slot => {");

const lengthTarget = /promoPdcFiltered\.length/g;
code = code.replace(lengthTarget, "(promoPdcSelectingDay2 ? promoPdcFiltered2 : promoPdcFiltered).length");

// 6. Update the 'isDay1' and 'isDay2' and 'isFull' logic inside the mapping
const logicTarget = /const isFull = slot\.available_slots === 0\s*const isDay1 = promoPdcSlot\?\.id === slot\.id\s*const isDay2 = false/;
const updatedLogic = `const isFull = slot.available_slots === 0
                  const isDay1 = promoPdcSlot?.id === slot.id && !promoPdcSelectingDay2
                  const isDay2 = promoPdcSlot2?.id === slot.id && promoPdcSelectingDay2`;
code = code.replace(logicTarget, updatedLogic);

// Update disabled logic
const disableTarget = /disabled=\{isFull || isDay1\}/;
code = code.replace(disableTarget, "disabled={isFull || isDay1 || (promoPdcSelectingDay2 && isFull)}"); // wait, just use isFull || isDay1

const disabledTarget2 = /disabled=\{isFull \|\| isDay1\}/g;
code = code.replace(disabledTarget2, "disabled={isFull || isDay1}");

// ClassName shadow-green for Day 2 like STANDALONE
const classNameTarget = /className=\{`group relative flex flex-col p-4 text-left rounded-2xl border-2 transition-all overflow-hidden \$\{isFull \? 'opacity-60 cursor-not-allowed' : isDay1 \? 'shadow-xl shadow-blue-500\/30 scale-\[1\.02\]' : 'hover:shadow-md hover:-translate-y-0\.5'\}`\}/;
const updatedClassName = `className={\`group relative flex flex-col p-4 text-left rounded-2xl border-2 transition-all overflow-hidden \${isFull ? 'opacity-60 cursor-not-allowed' : isDay1 ? 'shadow-xl shadow-blue-500/30 scale-[1.02]' : isDay2 ? 'shadow-xl shadow-green-500/30 scale-[1.02]' : 'hover:shadow-md hover:-translate-y-0.5'}\`}`;
code = code.replace(classNameTarget, updatedClassName);

fs.writeFileSync('booking-system-frontend/src/pages/Schedule.jsx', code);