const fs = require('fs');

let code = fs.readFileSync('src/pages/Schedule.jsx', 'utf8');

// 1. Add `isSel2` check and update `slotCellBorder` logic
const currentDayStrRe = /const isSel = promoPdcDate\?.getDate\(\) === day && promoPdcDate\?.getMonth\(\) === promoPdcCalMonth\.getMonth\(\) && promoPdcDate\?.getFullYear\(\) === promoPdcCalMonth\.getFullYear\(\)/;

code = code.replace(currentDayStrRe, \`const isSel = promoPdcDate?.getDate() === day && promoPdcDate?.getMonth() === promoPdcCalMonth.getMonth() && promoPdcDate?.getFullYear() === promoPdcCalMonth.getFullYear()
                          const isSel2 = promoPdcDate2?.getDate() === day && promoPdcDate2?.getMonth() === promoPdcCalMonth.getMonth() && promoPdcDate2?.getFullYear() === promoPdcCalMonth.getFullYear()\`);

const slotCellBorderOriginal = \`const slotCellBorder = isSel
                            ? 'border-[#2563eb] border-2 bg-blue-50/40 shadow-md'
                            : isToday
                              ? 'border-[#2563eb] bg-blue-50/30'
                              : !avail
                                ? 'border-transparent bg-gray-50/50'
                                : hasRealSlots && hasAvailability
                                  ? 'border-orange-300/60 bg-orange-50/25 hover:border-orange-400 hover:shadow-sm'
                                  : hasRealSlots && !hasAvailability
                                    ? 'border-red-200/60 bg-red-50/20'
                                    : 'border-gray-200/80 bg-white hover:border-gray-300';\`;

const slotCellBorderNew = \`const slotCellBorder = isSel2
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
                                        : 'border-gray-200/80 bg-white hover:border-gray-300';\`;

code = code.replace(slotCellBorderOriginal, slotCellBorderNew);

// 2. Update the cell HTML to handle `isSel2` and `onClick` Day 2 condition
const cellOriginal = \`                            return (
                             <div key={day}
                              onClick={() => {
                                if (!avail) return;
                                setPromoPdcDate(new Date(promoPdcCalMonth.getFullYear(), promoPdcCalMonth.getMonth(), day));
                              }}
                              className={\\\`min-h-[52px] sm:min-h-[140px] rounded-lg sm:rounded-xl border flex flex-col overflow-hidden transition-all relative \\$\\{
                                !avail ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:shadow-md'
                              } \\$\\{slotCellBorder}\\\`}
                            >
                              <div className="flex items-center justify-between px-2.5 pt-2.5 pb-1 flex-shrink-0">
                                <span className={\\\`text-[13px] font-bold leading-none \\$\\{
                                  isSel ? 'text-[#2563eb]' : isToday ? 'text-[#2563eb]' : 'text-gray-500'
                                }\\\`}>{day}</span>
                                {isToday && <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] opacity-60 flex-shrink-0"></span>}\`;

const cellNew = \`                            return (
                             <div key={day}
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
                              className={\\\`min-h-[52px] sm:min-h-[140px] rounded-lg sm:rounded-xl border flex flex-col overflow-hidden transition-all relative \\$\\{
                                (!avail && !isSel) ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:shadow-md'
                              } \\$\\{slotCellBorder}\\\`}
                            >
                              <div className="flex items-center justify-between px-2.5 pt-2.5 pb-1 flex-shrink-0">
                                <span className={\\\`text-[13px] font-bold leading-none \\$\\{
                                  isSel2 ? 'text-green-600' : isSel ? 'text-[#2563eb]' : isToday ? 'text-[#2563eb]' : 'text-gray-500'
                                }\\\`}>{day}</span>
                                {isToday && !isSel && <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] opacity-60 flex-shrink-0"></span>}
                                {isSel && <span className="text-[8px] font-black text-white bg-[#2563eb] px-1 rounded-sm">D1</span>}
                                {isSel2 && <span className="text-[8px] font-black text-white bg-green-600 px-1 rounded-sm">D2</span>}\`;
code = code.replace(cellOriginal, cellNew);

// 3. Update the inner dots (Desktop: Slot pills)
const pillOriginal1 = \`                          return (
                            <div
                              key={slot.id}
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                if (isFullyBooked) return; 
                                if (isSessionMismatch) {
                                  showNotification(\\\`For Day 2, please select the same session type: \\$\\{selectedSlot.session}\\\`, 'warning');
                                  return;
                                }
                                handleCalendarSlotClick(slot, day); 
                              }} className={\\\`w-full text-left rounded-[7px] border px-1.5 py-1 flex flex-col gap-[2px] \\$\\{!isFullyBooked && !isSessionMismatch ? 'cursor-pointer hover:shadow-md transition-all' : 'cursor-not-allowed'} \\$\\{\`;
                           
// ...wait, that's Regular PDC. Let me check the Promo PDC exact rendering... it's lower down.
// Let me just search by the exact structure of the code.

fs.writeFileSync('src/pages/Schedule.jsx', code, 'utf8');
console.log("Successfully patched Day 1 mapping part 1!");