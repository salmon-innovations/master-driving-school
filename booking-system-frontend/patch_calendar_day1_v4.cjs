const fs = require('fs');

let code = fs.readFileSync('src/pages/Schedule.jsx', 'utf8');

// 1. UPDATE slotCellBorder
const s1 = /const slotCellBorder = isSel[\s\S]*?'border-gray-200\/80 bg-white hover:border-gray-300';/;

const s1_new = `const slotCellBorder = isSel2
                            ? 'border-green-500 border-2 bg-green-50/40 shadow-md'
                            : isSel
                              ? 'border-[#2563eb] border-2 bg-blue-50/40 shadow-md'
                              : isToday
                                ? 'border-[#2563eb] bg-blue-50/30'
                                : (!avail && !isSel)
                                  ? 'border-transparent bg-gray-50/50'
                                  : hasRealSlots && hasAvailability
                                    ? 'border-orange-300/60 bg-orange-50/25 hover:border-orange-400 hover:shadow-sm'
                                    : hasRealSlots && !hasAvailability
                                      ? 'border-red-200/60 bg-red-50/20'
                                      : 'border-gray-200/80 bg-white hover:border-gray-300';`;

code = code.replace(s1, s1_new);


// 2. UPDATE ONCLICK AND TOP ELEMENTS OF CELL
const s2 = /<div key=\{day\}\s*onClick=\{\(\) => \{\s*if \(!avail\) return;\s*setPromoPdcDate\(new Date\(promoPdcCalMonth\.getFullYear\(\), promoPdcCalMonth\.getMonth\(\), day\)\);\s*\}\}\s*className=\{`min-h-\[52px\] sm:min-h-\[140px\] rounded-lg sm:rounded-xl border flex flex-col overflow-hidden transition-all relative \$\{\s*!avail \? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:shadow-md'\s*\} \$\{slotCellBorder\}`\}\s*>\s*<div className="flex items-center justify-between px-2\.5 pt-2\.5 pb-1 flex-shrink-0">\s*<span className=\{`text-\[13px\] font-bold leading-none \$\{\s*isSel \? 'text-\[#2563eb\]' : isToday \? 'text-\[#2563eb\]' : 'text-gray-500'\s*\}`\}>\{day\}<\/span>\s*\{isToday && <span className="w-1\.5 h-1\.5 rounded-full bg-\[#2563eb\] opacity-60 flex-shrink-0"><\/span>\}/;

const s2_new = `<div key={day}
                              onClick={() => {
                                if (!avail && !isSel) return;
                                if (promoPdcSelectingDay2) {
                                  if (promoPdcDate && cellDate.getTime() === promoPdcDate.getTime()) {
                                    showNotification('Day 2 must be a different date than Day 1.', 'warning');
                                    return;
                                  }
                                  setPromoPdcDate2(new Date(promoPdcCalMonth.getFullYear(), promoPdcCalMonth.getMonth(), day));
                                } else {
                                  setPromoPdcDate(new Date(promoPdcCalMonth.getFullYear(), promoPdcCalMonth.getMonth(), day));
                                }
                              }}
                              className={\`min-h-[52px] sm:min-h-[140px] rounded-lg sm:rounded-xl border flex flex-col overflow-hidden transition-all relative \${
                                (!avail && !isSel) ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:shadow-md'
                              } \${slotCellBorder}\`}
                            >
                              <div className="flex items-center justify-between px-2.5 pt-2.5 pb-1 flex-shrink-0">
                                <span className={\`text-[13px] font-bold leading-none \${
                                  isSel2 ? 'text-green-600' : isSel ? 'text-[#2563eb]' : isToday ? 'text-[#2563eb]' : 'text-gray-500'
                                }\`}>{day}</span>
                                {isToday && !isSel && <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] opacity-60 flex-shrink-0"></span>}
                                {isSel && <span className="text-[8px] font-black text-white bg-[#2563eb] px-1 rounded-sm">D1</span>}
                                {isSel2 && <span className="text-[8px] font-black text-white bg-green-600 px-1 rounded-sm">D2</span>}`;

if (code.match(s2)) {
  code = code.replace(s2, s2_new);
} else {
  console.log("Failed s2");
}

// 3. update mapping
const s3 = /\{daySlots\.map\(slot => \{\s*const isFullyBooked = slot\.available_slots === 0\s*const isSlotSel = promoPdcSlot\?.id === slot\.id[\s\S]*?return \(\s*<div key=\{slot\.id\} onClick=\{\(e\) => \{\s*e\.stopPropagation\(\);\s*if \(isFullyBooked\) return;\s*setPromoPdcDate\(new Date\(promoPdcCalMonth\.getFullYear\(\), promoPdcCalMonth\.getMonth\(\), day\)\);\s*handleSlotClick\(slot\);\s*\}\} className=\{`w-full text-left rounded-\[7px\] border px-1\.5 py-1 flex flex-col gap-\[2px\] \$\{!isFullyBooked \? 'cursor-pointer hover:shadow-md transition-all' : 'cursor-not-allowed'\} \$\{\s*isSlotSel \? 'border-\[#2563eb\] bg-\[#2563eb\] text-white shadow-sm'\s*: isFullyBooked \? 'border-red-200 bg-red-50 text-red-500 opacity-70'\s*: 'border-orange-200 bg-orange-50 text-orange-700'\s*\}`\}>\s*<div className="flex items-center justify-between gap-1 leading-none">\s*<span className="text-\[9px\] sm:text-\[10px\] font-black truncate flex-1 min-w-0">\{sessionLabel\}<\/span>\s*<span className=\{`text-\[8px\] font-bold flex-shrink-0 px-1 rounded leading-\[1\.5\] \$\{\s*isSlotSel \? 'bg-white\/25 text-white'\s*: isFullyBooked \? 'bg-red-100 text-red-600'\s*: 'bg-orange-100 text-orange-700'\s*\}`\}>\{countLabel\}<\/span>\s*<\/div>\s*<div className="text-\[7px\] sm:text-\[8px\] font-medium opacity-75 truncate leading-none">\{timeStr\}<\/div>\s*<\/div>\s*\);\s*\}\)\}/;

const s3_new = `{daySlots.map(slot => {
                                  const isFullyBooked = slot.available_slots === 0
                                  const isSlotSel = promoPdcSlot?.id === slot.id
                                  const isSlotSel2 = promoPdcSlot2?.id === slot.id
                                  const isSessionMismatch = promoPdcSelectingDay2 && promoPdcSlot && slot.session !== promoPdcSlot.session;
                                  
                                  const sessionLabel = (() => {
                                    const sn = (slot.session || '').toLowerCase()
                                    if (sn.includes('morning')) return 'Morning Class'
                                    if (sn.includes('afternoon')) return 'Afternoon Class'
                                    if (sn.includes('whole')) return 'Whole Day'
                                    return slot.session || 'PDC'
                                  })()
                                  
                                  const countLabel = isFullyBooked ? 'FULL' : \`\${slot.available_slots} Slots\`
                                  const timeStr = (slot.time_range || '').toLowerCase().replace(/ - /g, ' / ').replace(/ am/g, 'am').replace(/ pm/g, 'pm')

                                  return (
                                    <div key={slot.id} onClick={(e) => { 
                                      e.stopPropagation(); 
                                      if (isFullyBooked) return; 
                                      if (isSessionMismatch) {
                                        showNotification(\`For Day 2, please select the same session type: \${promoPdcSlot.session}\`, 'warning');
                                        return;
                                      }
                                      if (promoPdcSelectingDay2) {
                                        setPromoPdcDate2(new Date(promoPdcCalMonth.getFullYear(), promoPdcCalMonth.getMonth(), day));
                                      } else {
                                        setPromoPdcDate(new Date(promoPdcCalMonth.getFullYear(), promoPdcCalMonth.getMonth(), day));
                                      }
                                      handleSlotClick(slot); 
                                    }} className={\`w-full text-left rounded-[7px] border px-1.5 py-1 flex flex-col gap-[2px] \${!isFullyBooked && !isSessionMismatch ? 'cursor-pointer hover:shadow-md transition-all' : 'cursor-not-allowed opacity-50'} \${
                                      isSlotSel2 ? 'border-green-500 bg-green-500 text-white shadow-sm'
                                        : isSlotSel ? 'border-[#2563eb] bg-[#2563eb] text-white shadow-sm'
                                        : (isFullyBooked || isSessionMismatch) ? 'border-red-200 bg-red-50 text-red-500 opacity-70'
                                        : 'border-orange-200 bg-orange-50 text-orange-700'
                                    }\`}>
                                      <div className="flex items-center justify-between gap-1 leading-none">
                                        <span className="text-[9px] sm:text-[10px] font-black truncate flex-1 min-w-0">{sessionLabel}</span>
                                        <span className={\`text-[8px] font-bold flex-shrink-0 px-1 rounded leading-[1.5] \${
                                          (isSlotSel || isSlotSel2) ? 'bg-white/25 text-white'
                                            : (isFullyBooked || isSessionMismatch) ? 'bg-red-100 text-red-600'
                                              : 'bg-orange-100 text-orange-700'
                                        }\`}>{countLabel}</span>
                                      </div>
                                      <div className={\`text-[7px] sm:text-[8px] font-medium truncate leading-none \${isSessionMismatch ? 'opacity-40' : 'opacity-75'}\`}>{timeStr}</div>
                                    </div>
                                  );
                                })}`;

if (code.match(s3)) {
  code = code.replace(s3, s3_new);
  console.log("Patched s3!");
} else {
  console.log("Failed s3");
}

fs.writeFileSync('src/pages/Schedule.jsx', code, 'utf8');
