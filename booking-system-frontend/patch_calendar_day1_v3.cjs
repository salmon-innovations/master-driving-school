const fs = require('fs');

let code = fs.readFileSync('src/pages/Schedule.jsx', 'utf8');

// 1. Add \`isSel2\` check and update \`slotCellBorder\` logic
const currentDayStrRe = /const isSel = promoPdcDate\?\.getDate\(\) === day && promoPdcDate\?\.getMonth\(\) === promoPdcCalMonth\.getMonth\(\) && promoPdcDate\?\.getFullYear\(\) === promoPdcCalMonth\.getFullYear\(\)/;

code = code.replace(currentDayStrRe, 'const isSel = promoPdcDate?.getDate() === day && promoPdcDate?.getMonth() === promoPdcCalMonth.getMonth() && promoPdcDate?.getFullYear() === promoPdcCalMonth.getFullYear()\n                          const isSel2 = promoPdcDate2?.getDate() === day && promoPdcDate2?.getMonth() === promoPdcCalMonth.getMonth() && promoPdcDate2?.getFullYear() === promoPdcCalMonth.getFullYear()');

const slotCellBorderOriginal = `const slotCellBorder = isSel
                            ? 'border-[#2563eb] border-2 bg-blue-50/40 shadow-md'
                            : isToday
                              ? 'border-[#2563eb] bg-blue-50/30'
                              : !avail
                                ? 'border-transparent bg-gray-50/50'
                                : hasRealSlots && hasAvailability
                                  ? 'border-orange-300/60 bg-orange-50/25 hover:border-orange-400 hover:shadow-sm'
                                  : hasRealSlots && !hasAvailability
                                    ? 'border-red-200/60 bg-red-50/20'
                                    : 'border-gray-200/80 bg-white hover:border-gray-300';`;

const slotCellBorderNew = `const slotCellBorder = isSel2
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

code = code.replace(slotCellBorderOriginal, slotCellBorderNew);

const cellOriginal = `                                setPromoPdcDate(new Date(promoPdcCalMonth.getFullYear(), promoPdcCalMonth.getMonth(), day));
                              }}
                              className={\`min-h-[52px] sm:min-h-[140px] rounded-lg sm:rounded-xl border flex flex-col overflow-hidden transition-all relative \${
                                !avail ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:shadow-md'
                              } \${slotCellBorder}\`}
                            >
                              <div className="flex items-center justify-between px-2.5 pt-2.5 pb-1 flex-shrink-0">
                                <span className={\`text-[13px] font-bold leading-none \${
                                  isSel ? 'text-[#2563eb]' : isToday ? 'text-[#2563eb]' : 'text-gray-500'
                                }\`}>{day}</span>
                                {isToday && <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] opacity-60 flex-shrink-0"></span>}`;

const cellNew = `                                if (promoPdcSelectingDay2) {
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

code = code.replace(cellOriginal, cellNew);


const dotOriginal = `                                {daySlots.map(slot => {
                                  const isFullyBooked = slot.available_slots === 0
                                  const isSlotSel = promoPdcSlot?.id === slot.id`;

const dotNew = `                                {daySlots.map(slot => {
                                  const isFullyBooked = slot.available_slots === 0
                                  const isSlotSel = promoPdcSlot?.id === slot.id
                                  const isSlotSel2 = promoPdcSlot2?.id === slot.id
                                  const isSessionMismatch = promoPdcSelectingDay2 && promoPdcSlot && slot.session !== promoPdcSlot.session;`;

code = code.replace(dotOriginal, dotNew);


const onClickOriginal = `                                  return (
                                    <div key={slot.id} onClick={(e) => { e.stopPropagation(); if (isFullyBooked) return; setPromoPdcDate(new Date(promoPdcCalMonth.getFullYear(), promoPdcCalMonth.getMonth(), day)); handleSlotClick(slot); }} className={\`w-full text-left rounded-[7px] border px-1.5 py-1 flex flex-col gap-[2px] \${!isFullyBooked ? 'cursor-pointer hover:shadow-md transition-all' : 'cursor-not-allowed'} \${
                                      isSlotSel ? 'border-[#2563eb] bg-[#2563eb] text-white shadow-sm'
                                        : isFullyBooked ? 'border-red-200 bg-red-50 text-red-500 opacity-70'
                                          : 'border-orange-200 bg-orange-50 text-orange-700'
                                    }\`}>
                                      <div className="flex items-center justify-between gap-1 leading-none">
                                        <span className="text-[9px] sm:text-[10px] font-black truncate flex-1 min-w-0">{sessionLabel}</span>
                                        <span className={\`text-[8px] font-bold flex-shrink-0 px-1 rounded leading-[1.5] \${
                                          isSlotSel ? 'bg-white/25 text-white'
                                            : isFullyBooked ? 'bg-red-100 text-red-600'
                                              : 'bg-orange-100 text-orange-700'
                                        }\`}>{countLabel}</span>`;

const onClickNew = `                                  return (
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
                                        : isSessionMismatch ? 'border-gray-200 bg-gray-50 text-gray-500 opacity-70 grayscale'
                                        : isFullyBooked ? 'border-red-200 bg-red-50 text-red-500 opacity-70'
                                        : 'border-orange-200 bg-orange-50 text-orange-700'
                                    }\`}>
                                      <div className="flex items-center justify-between gap-1 leading-none">
                                        <span className="text-[9px] sm:text-[10px] font-black truncate flex-1 min-w-0">{sessionLabel}</span>
                                        <span className={\`text-[8px] font-bold flex-shrink-0 px-1 rounded leading-[1.5] \${
                                          (isSlotSel || isSlotSel2) ? 'bg-white/25 text-white'
                                            : isSessionMismatch ? 'bg-gray-100 text-gray-500'
                                            : isFullyBooked ? 'bg-red-100 text-red-600'
                                              : 'bg-orange-100 text-orange-700'
                                        }\`}>{countLabel}</span>`;

code = code.replace(onClickOriginal, onClickNew);

fs.writeFileSync('src/pages/Schedule.jsx', code, 'utf8');
console.log("Successfully patched Day 1 mapping part 1!");