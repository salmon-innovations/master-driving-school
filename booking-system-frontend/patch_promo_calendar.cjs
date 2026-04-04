const fs = require('fs');

const filePath = 'src/pages/Schedule.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetOld = `                              } \${slotCellBorder}\`}
                            >
                              <div className="flex items-center justify-between px-2.5 pt-2.5 pb-1 flex-shrink-0">
                                <span className={\`text-[13px] font-bold leading-none \${
                                  isSel ? 'text-[#2563eb]' : isToday ? 'text-[#2563eb]' : 'text-gray-500'
                                }\`}>{day}</span>
                                {isToday && <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] opacity-60 flex-shrink-0"></span>}
                              </div>
                              <div className="flex flex-col gap-[3px] px-1.5 pb-2 flex-1">
                                {daySlots.map(slot => {
                                  const isFullyBooked = slot.available_slots === 0
                                  const isSlotSel = promoPdcSlot?.id === slot.id
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
                                        }\`}>{countLabel}</span>
                                      </div>
                                      <div className="text-[7px] sm:text-[8px] font-medium opacity-75 truncate leading-none">{timeStr}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>`;

const targetNew = `                              } \${slotCellBorder}\`}
                            >
                              {/* Day number */}
                              <div className="flex items-center justify-between px-1 sm:px-2.5 pt-1.5 sm:pt-2.5 pb-0.5 sm:pb-1 flex-shrink-0">
                                <span className={\`text-[10px] sm:text-[13px] font-bold leading-none \${
                                  isSel ? 'text-[#2563eb]' : isToday ? 'text-[#2563eb]' : 'text-gray-500'
                                }\`}>{day}</span>
                                {isToday && <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-[#2563eb] opacity-60 flex-shrink-0"></span>}
                              </div>

                              {/* Mobile: dot indicators only - made pointer-events-none */}
                              <div className="flex sm:hidden flex-wrap gap-0.5 px-0.5 pb-1 pointer-events-none">
                                {daySlots.slice(0, 4).map((slot) => {
                                  const isFullyBooked = slot.available_slots === 0;
                                  const isSlotSelected = promoPdcSlot?.id === slot.id || promoPdcSlot2?.id === slot.id;
                                  return (
                                    <div
                                      key={slot.id}
                                      className={\`w-1.5 h-1.5 rounded-full flex-shrink-0 \${
                                        isSlotSelected ? 'bg-[#2563eb]' :
                                        isFullyBooked ? 'bg-red-400' :
                                        slot.session === 'Morning' ? 'bg-orange-400' :
                                        slot.session === 'Afternoon' ? 'bg-yellow-400' :
                                        'bg-blue-400'
                                      }\`}
                                    />
                                  );
                                })}
                              </div>

                              {/* Desktop: Slot pills — full labels */}
                              <div className="hidden sm:flex flex-col gap-[3px] px-1.5 pb-2 flex-1">
                                {daySlots.map(slot => {
                                  const isFullyBooked = slot.available_slots === 0
                                  const isSlotSel = promoPdcSlot?.id === slot.id || promoPdcSlot2?.id === slot.id
                                  const isMismatched = promoPdcSelectingDay2 && promoPdcSlot && slot.session !== promoPdcSlot.session;

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
                                      if (isMismatched) { showNotification('Mismatch', 'warning'); return; }
                                      setPromoPdcDate(new Date(promoPdcCalMonth.getFullYear(), promoPdcCalMonth.getMonth(), day)); 
                                      handleSlotClick(slot); 
                                    }} className={\`w-full text-left rounded-[7px] border px-1.5 py-1 flex flex-col gap-[2px] \${!isFullyBooked && !isMismatched ? 'cursor-pointer hover:shadow-md transition-all' : 'cursor-not-allowed opacity-50'} \${
                                      isSlotSel ? 'border-[#2563eb] bg-[#2563eb] text-white shadow-sm'
                                        : isMismatched ? 'border-gray-200 bg-gray-50 text-gray-500 opacity-70 grayscale'
                                        : isFullyBooked ? 'border-red-200 bg-red-50 text-red-500 opacity-70'
                                        : 'border-orange-200 bg-orange-50 text-orange-700'
                                    }\`}>
                                      <div className="flex items-center justify-between gap-1 leading-none">
                                        <span className="text-[9px] sm:text-[10px] font-black truncate flex-1 min-w-0">{sessionLabel}</span>
                                        <span className={\`text-[8px] font-bold flex-shrink-0 px-1 rounded leading-[1.5] \${
                                          isSlotSel ? 'bg-white/25 text-white'
                                            : isMismatched ? 'bg-gray-100 text-gray-500'
                                            : isFullyBooked ? 'bg-red-100 text-red-600'
                                            : 'bg-orange-100 text-orange-700'
                                        }\`}>{countLabel}</span>
                                      </div>
                                      <div className="text-[7px] sm:text-[8px] font-medium opacity-75 truncate leading-none">{timeStr}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>`;

content = content.replace("className={`min-h-[100px] rounded-xl", "className={`min-h-[52px] sm:min-h-[140px] rounded-lg sm:rounded-xl");
let x = content.replace(targetOld, targetNew);
fs.writeFileSync(filePath, x);
console.log("Promo Calendar mobile view patched!");
