const fs = require('fs');
let s = fs.readFileSync('src/pages/Schedule.jsx', 'utf8');

const s1 = `                          const cellDate = new Date(promoPdcCalMonth.getFullYear(), promoPdcCalMonth.getMonth(), day)
                          const isDay2 = promoPdcSelectingDay2 && promoPdcDate;
                          const minAllowedDate = isDay2 ? new Date(promoPdcDate.getTime() + 86400000) : promoPdcMinDate;
                          const avail = cellDate >= minAllowedDate && cellDate.getDay() !== 0
                          const today = new Date(); today.setHours(0, 0, 0, 0)
                          const isToday = cellDate.getTime() === today.getTime()
                          const isSel = promoPdcDate?.getDate() === day && promoPdcDate?.getMonth() === promoPdcCalMonth.getMonth() && promoPdcDate?.getFullYear() === promoPdcCalMonth.getFullYear()
                          const currentDayStr = \`\${promoPdcCalMonth.getFullYear()}-\${String(promoPdcCalMonth.getMonth() + 1).padStart(2, '0')}-\${String(day).padStart(2, '0')}\`
                          const daySlots = promoPdcAllFiltered
                            .filter(s => s.date === currentDayStr)
                            .sort((a, b) => ({ morning: 1, afternoon: 2, 'whole day': 3 }[(a.session || '').toLowerCase()] || 99) - ({ morning: 1, afternoon: 2, 'whole day': 3 }[(b.session || '').toLowerCase()] || 99))
                          const hasRealSlots = daySlots.length > 0
                          const hasAvailability = daySlots.some(s => s.available_slots > 0)
                          const slotCellBorder = isSel
                            ? 'border-[#2563eb] border-2 bg-blue-50/40 shadow-md'
                            : isToday
                              ? 'border-[#2563eb] bg-blue-50/30'
                              : !avail
                                ? 'border-transparent bg-gray-50/50'
                                : hasRealSlots && hasAvailability
                                  ? 'border-orange-300/60 bg-orange-50/25 hover:border-orange-400 hover:shadow-sm'
                                  : hasRealSlots && !hasAvailability
                                    ? 'border-red-200/60 bg-red-50/20'
                                    : 'border-gray-200/80 bg-white hover:border-gray-300';
                            return (
                             <div key={day}
                              onClick={() => {
                                if (!avail) return;
                                setPromoPdcDate(new Date(promoPdcCalMonth.getFullYear(), promoPdcCalMonth.getMonth(), day));
                              }}
                              className={\`min-h-[52px] sm:min-h-[140px] rounded-lg sm:rounded-xl border flex flex-col overflow-hidden transition-all relative \${
                                !avail ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:shadow-md'
                              } \${slotCellBorder}\`}
                            >
                              {/* Day number */}
                              <div className="flex items-center justify-between px-1 sm:px-2.5 pt-1.5 sm:pt-2.5 pb-0.5 sm:pb-1 flex-shrink-0">
                                <span className={\`text-[10px] sm:text-[13px] font-bold leading-none \${
                                  isSel ? 'text-[#2563eb]' : isToday ? 'text-[#2563eb]' : 'text-gray-500'
                                }\`}>{day}</span>
                                {isToday && <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-[#2563eb] opacity-60 flex-shrink-0"></span>}
                              </div>`;

const s2 = `                          const cellDate = new Date(promoPdcCalMonth.getFullYear(), promoPdcCalMonth.getMonth(), day)
                          const isBeforeDay1 = promoPdcSelectingDay2 && promoPdcDate && cellDate < promoPdcDate;
                          const isDay1Marker = promoPdcSelectingDay2 && promoPdcDate?.getDate() === day && promoPdcDate?.getMonth() === promoPdcCalMonth.getMonth() && promoPdcDate?.getFullYear() === promoPdcCalMonth.getFullYear();
                          const isDay1Selected = !promoPdcSelectingDay2 && promoPdcDate?.getDate() === day && promoPdcDate?.getMonth() === promoPdcCalMonth.getMonth() && promoPdcDate?.getFullYear() === promoPdcCalMonth.getFullYear();
                          const isDay2Selected = promoPdcSelectingDay2 && promoPdcDate2?.getDate() === day && promoPdcDate2?.getMonth() === promoPdcCalMonth.getMonth() && promoPdcDate2?.getFullYear() === promoPdcCalMonth.getFullYear();
                          const isSel = isDay1Marker || isDay1Selected || isDay2Selected;
                          
                          const avail = cellDate >= promoPdcMinDate && cellDate.getDay() !== 0 && !isBeforeDay1;

                          const today = new Date(); today.setHours(0, 0, 0, 0)
                          const isToday = cellDate.getTime() === today.getTime()
                          
                          const currentDayStr = \`\${promoPdcCalMonth.getFullYear()}-\${String(promoPdcCalMonth.getMonth() + 1).padStart(2, '0')}-\${String(day).padStart(2, '0')}\`
                          const daySlots = promoPdcAllFiltered
                            .filter(s => s.date === currentDayStr)
                            .sort((a, b) => ({ morning: 1, afternoon: 2, 'whole day': 3 }[(a.session || '').toLowerCase()] || 99) - ({ morning: 1, afternoon: 2, 'whole day': 3 }[(b.session || '').toLowerCase()] || 99))
                          const hasRealSlots = daySlots.length > 0
                          const hasAvailability = daySlots.some(s => s.available_slots > 0)
                          
                          const slotCellBorder = isDay1Marker
                            ? 'border-orange-300 bg-orange-50'
                            : isDay2Selected || isDay1Selected
                              ? 'border-[#2563eb] border-2 bg-blue-50/40 shadow-md'
                              : isToday
                                ? 'border-[#2563eb] bg-blue-50/30'
                                : !avail
                                  ? 'border-transparent bg-gray-50/50'
                                  : hasRealSlots && hasAvailability
                                    ? 'border-orange-300/60 bg-orange-50/25 hover:border-orange-400 hover:shadow-sm'
                                    : hasRealSlots && !hasAvailability
                                      ? 'border-red-200/60 bg-red-50/20'
                                      : 'border-gray-200/80 bg-white hover:border-gray-300';
                            return (
                             <div key={day}
                              onClick={() => {
                                if (!avail || isDay1Marker) return;
                                if (promoPdcSelectingDay2) {
                                  setPromoPdcDate2(new Date(promoPdcCalMonth.getFullYear(), promoPdcCalMonth.getMonth(), day));
                                } else {
                                  setPromoPdcDate(new Date(promoPdcCalMonth.getFullYear(), promoPdcCalMonth.getMonth(), day));
                                }
                              }}
                              className={\`min-h-[52px] sm:min-h-[140px] rounded-lg sm:rounded-xl border flex flex-col overflow-hidden transition-all relative \${
                                !avail || isDay1Marker ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:shadow-md'
                              } \${slotCellBorder}\`}
                            >
                              {/* Day number */}
                              <div className="flex items-center justify-between px-1 sm:px-2.5 pt-1.5 sm:pt-2.5 pb-0.5 sm:pb-1 flex-shrink-0">
                                <span className={\`text-[10px] sm:text-[13px] font-bold leading-none \${
                                  isDay1Selected || isDay2Selected ? 'text-[#2563eb]' :
                                  isDay1Marker ? 'text-orange-500' :
                                  isToday ? 'text-[#2563eb]' : 'text-gray-500'
                                }\`}>{day}</span>
                                {isToday && <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-[#2563eb] opacity-60 flex-shrink-0"></span>}
                              </div>`;

s = s.replace(s1, s2);
fs.writeFileSync('src/pages/Schedule.jsx', s, 'utf8');
console.log("FIXED!");
