const fs = require('fs');
const file = 'src/pages/Schedule.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. promoPdcMinDate
content = content.replace(
  "      const afterTdc = new Date(tdcEndDate)\n      // Enforce minimum 2 clear days gap",
  "      const afterTdc = new Date(tdcEndDate)\n      afterTdc.setDate(afterTdc.getDate() + 3) // Enforce minimum 2 clear days gap"
);
content = content.replace(
  "      const afterTdc = new Date(tdcEndDate)\r\n      // Enforce minimum 2 clear days gap",
  "      const afterTdc = new Date(tdcEndDate)\r\n      afterTdc.setDate(afterTdc.getDate() + 3) // Enforce minimum 2 clear days gap"
);
if (!content.includes("afterTdc.getDate() + 3")) {
    content = content.replace(
        "      const afterTdc = new Date(tdcEndDate)\n      return afterTdc > base ? afterTdc : base",
        "      const afterTdc = new Date(tdcEndDate)\n      afterTdc.setDate(afterTdc.getDate() + 3)\n      return afterTdc > base ? afterTdc : base"
    );
    content = content.replace(
        "      const afterTdc = new Date(tdcEndDate)\r\n      return afterTdc > base ? afterTdc : base",
        "      const afterTdc = new Date(tdcEndDate)\r\n      afterTdc.setDate(afterTdc.getDate() + 3)\r\n      return afterTdc > base ? afterTdc : base"
    );
}

// 2. Calendar minAllowedDate fixes
content = content.replace(
  "                            const avail = cellDate >= promoPdcMinDate && cellDate.getDay() !== 0",
  "                            const isDay2 = promoPdcSelectingDay2 && promoPdcDate;\n                            const minAllowedDate = isDay2 ? new Date(promoPdcDate.getTime() + 86400000) : promoPdcMinDate;\n                            const avail = cellDate >= minAllowedDate && cellDate.getDay() !== 0"
);

// 3. handleSlotClick validation
content = content.replace(
  "      // Second pick — validate session matches\n      if (slot.session !== selectedSlot?.session) {",
  "      // Second pick — validate session matches\n      const slotDate = new Date(slot.date + 'T00:00:00');\n      const day1Date = selectedDate ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()) : null;\n      if (day1Date && slotDate <= day1Date) {\n        showNotification('Day 2 must be after Day 1.', 'warning')\n        return\n      }\n      if (slot.session !== selectedSlot?.session) {"
);

// 4. Gray styling for mismatched regular calendar cells
const regularSearch = "                                }`} className={`w-full text-left rounded-[7px] border px-1.5 py-1 flex flex-col gap-[2px] ${!isFullyBooked && isAvailable ? 'cursor-pointer hover:shadow-md transition-all' : 'cursor-not-allowed opacity-50'} ${\n                                  isSlotSelected\n                                    ? 'border-[#2563eb] bg-[#2563eb] text-white shadow-sm'\n                                    : isFullyBooked\n                                      ? 'border-red-200 bg-red-50 text-red-500 opacity-70'";
if (content.includes("isFullyBooked && isAvailable ?")) {
    content = content.replace(
        "className={`w-full text-left rounded-[7px] border px-1.5 py-1 flex flex-col gap-[2px] ${!isFullyBooked && isAvailable ? 'cursor-pointer hover:shadow-md transition-all' : 'cursor-not-allowed opacity-50'} ${\n                                  isSlotSelected\n                                    ? 'border-[#2563eb] bg-[#2563eb] text-white shadow-sm'\n                                    : isFullyBooked",
        "className={`w-full text-left rounded-[7px] border px-1.5 py-1 flex flex-col gap-[2px] ${!isFullyBooked && !(selectingDay2 && selectedSlot && slot.session !== selectedSlot.session) && isAvailable ? 'cursor-pointer hover:shadow-md transition-all' : 'cursor-not-allowed opacity-50'} ${\n                                  isSlotSelected ? 'border-[#2563eb] bg-[#2563eb] text-white shadow-sm' : (selectingDay2 && selectedSlot && slot.session !== selectedSlot.session) ? 'border-gray-200 bg-gray-50 text-gray-500 opacity-70 grayscale' : isFullyBooked"
    );
    content = content.replace(
        "                                  isSlotSelected ? 'bg-white/25 text-white' :\n                                  isFullyBooked ? 'bg-red-100 text-red-600' :",
        "                                  isSlotSelected ? 'bg-white/25 text-white' :\n                                  (selectingDay2 && selectedSlot && slot.session !== selectedSlot.session) ? 'bg-gray-100 text-gray-500' :\n                                  isFullyBooked ? 'bg-red-100 text-red-600' :"
    );
    
    // Apply similarly to onClick
    content = content.replace(
        "                                  if (isFullyBooked) return; \n                                  handleCalendarSlotClick(slot, day);",
        "                                  if (isFullyBooked) return;\n                                  if (selectingDay2 && selectedSlot && slot.session !== selectedSlot.session) { showNotification('Mismatch', 'warning'); return; }\n                                  handleCalendarSlotClick(slot, day);"
    );
}

// 5. Promo calendar cells gray UI
const promoSearch = "className={`w-full text-left rounded-[7px] border px-1.5 py-1 flex flex-col gap-[2px] ${!isFullyBooked && avail ? 'cursor-pointer hover:shadow-md transition-all' : 'cursor-not-allowed opacity-50'} ${\n                                        isSlotSel ? 'border-[#2563eb] bg-[#2563eb] text-white shadow-sm'\n                                          : isFullyBooked";
if (content.includes("!isFullyBooked && avail ?")) {
    content = content.replace(
        "className={`w-full text-left rounded-[7px] border px-1.5 py-1 flex flex-col gap-[2px] ${!isFullyBooked && avail ? 'cursor-pointer hover:shadow-md transition-all' : 'cursor-not-allowed opacity-50'} ${\n                                        isSlotSel ? 'border-[#2563eb] bg-[#2563eb] text-white shadow-sm'\n                                          : isFullyBooked",
        "className={`w-full text-left rounded-[7px] border px-1.5 py-1 flex flex-col gap-[2px] ${!isFullyBooked && !isMismatched && avail ? 'cursor-pointer hover:shadow-md transition-all' : 'cursor-not-allowed opacity-50'} ${\n                                        isSlotSel ? 'border-[#2563eb] bg-[#2563eb] text-white shadow-sm'\n                                          : isMismatched ? 'border-gray-200 bg-gray-50 text-gray-500 opacity-70 grayscale' : isFullyBooked"
    );
    content = content.replace(
        "                                            isSlotSel ? 'bg-white/25 text-white'\n                                              : isFullyBooked ? 'bg-red-100 text-red-600'",
        "                                            isSlotSel ? 'bg-white/25 text-white'\n                                              : isMismatched ? 'bg-gray-100 text-gray-500'\n                                              : isFullyBooked ? 'bg-red-100 text-red-600'"
    );
}

// 6. Slots sorting array
function insertSort(arrayMapRegexName) {
    if (!content.includes(arrayMapRegexName + ".sort(")) {
        content = content.replace(arrayMapRegexName, arrayMapRegexName + ".sort((a,b)=>({morning:1,afternoon:2,'whole day':3}[(a.session||'').toLowerCase()]||99)-({morning:1,afternoon:2,'whole day':3}[(b.session||'').toLowerCase()]||99))");
    }
}
content = content.replace(
    "if (!isTDCCourse && selectingDay2 && selectedSlot && isHalfDay(selectedSlot.session)) {\n        slots = slots.filter(s => s.session === selectedSlot.session)\n      }\n\n      return slots",
    "if (!isTDCCourse && selectingDay2 && selectedSlot && isHalfDay(selectedSlot.session)) {\n        slots = slots.filter(s => s.session === selectedSlot.session)\n      }\n\n      slots.sort((a,b)=>({morning:1,afternoon:2,'whole day':3}[(a.session||'').toLowerCase()]||99)-({morning:1,afternoon:2,'whole day':3}[(b.session||'').toLowerCase()]||99));\n\n      return slots"
);
content = content.replace(
    "const promoPdcFiltered = promoPdcRawSlots.filter(promoPdcSlotMatches)",
    "const promoPdcFiltered = promoPdcRawSlots.filter(promoPdcSlotMatches).sort((a,b)=>({morning:1,afternoon:2,'whole day':3}[(a.session||'').toLowerCase()]||99)-({morning:1,afternoon:2,'whole day':3}[(b.session||'').toLowerCase()]||99))"
);
content = content.replace(
    "const promoPdcFiltered2 = promoPdcRawSlots2\n      .filter(promoPdcSlotMatches)",
    "const promoPdcFiltered2 = promoPdcRawSlots2\n      .filter(promoPdcSlotMatches).sort((a,b)=>({morning:1,afternoon:2,'whole day':3}[(a.session||'').toLowerCase()]||99)-({morning:1,afternoon:2,'whole day':3}[(b.session||'').toLowerCase()]||99))"
);

// 7. Inject Promo Mobile UI Card correctly!
let s1 = content.indexOf("{(promoPdcSelectingDay2 && promoPdcDate2 ? promoPdcFiltered2 : promoPdcFiltered).map(slot => {");
let s2 = content.indexOf("                        </div>\n                      )}", s1);
if (s1 !== -1 && s2 !== -1) {
    const newPromoMobileCard = `{(promoPdcSelectingDay2 && promoPdcDate2 ? promoPdcFiltered2 : promoPdcFiltered).map(slot => {
                            const isFull = slot.available_slots === 0
                            const isSel = promoPdcSelectingDay2 ? promoPdcSlot2?.id === slot.id : promoPdcSlot?.id === slot.id;
                            const isSessionMismatch = promoPdcSelectingDay2 && promoPdcSlot && slot.session !== promoPdcSlot.session;
                            
                            const bookedPct = ((slot.total_capacity - slot.available_slots) / slot.total_capacity) * 100

                            const sessionMeta = {
                              'Morning': { icon: '🌅', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', pill: 'bg-orange-100 text-orange-700' },
                              'Afternoon': { icon: '☀️', color: '#ca8a04', bg: '#fefce8', border: '#fde68a', pill: 'bg-yellow-100 text-yellow-700' },
                              'Whole Day': { icon: '🕐', color: '#2157da', bg: '#eff6ff', border: '#bfdbfe', pill: 'bg-blue-100 text-blue-700' },
                            }[slot.session] || { icon: '🕐', color: '#2157da', bg: '#eff6ff', border: '#bfdbfe', pill: 'bg-blue-100 text-blue-700' }

                            const courseLabel = (() => {
                              const base = 'PDC';
                              const parts = [base];
                              if (slot.course_type && slot.course_type !== 'both' && slot.course_type !== 'any') {
                                parts.push(slot.course_type);
                              }
                              if (slot.transmission) {
                                parts.push(slot.transmission);
                              }
                              return parts.join(' · ');
                            })()

                            const statusColor = isFull ? '#ef4444' : bookedPct > 70 ? '#f59e0b' : '#22c55e';
                            const statusLabel = isFull ? 'FULL' : bookedPct > 70 ? 'FILLING UP' : 'OPEN';
                            const statusBg = isFull ? '#fef2f2' : bookedPct > 70 ? '#fffbeb' : '#f0fdf4';
                            const statusText = isFull ? '#dc2626' : bookedPct > 70 ? '#b45309' : '#15803d';

                            const cardBg = isSel
                              ? (promoPdcSelectingDay2 ? '#f0fdf4' : 'linear-gradient(135deg, #1a4fba 0%, #1e3a8a 100%)')
                              : isFull || isSessionMismatch
                                ? '#f8fafc'
                                : 'white';
                                
                            const cardBorder = isSel
                              ? (promoPdcSelectingDay2 ? '#22c55e' : 'transparent')
                              : isFull || isSessionMismatch
                                ? '#e2e8f0'
                                : '#e2e8f0';

                            const baseStyle = { background: cardBg, borderColor: cardBorder }
                            if (isSessionMismatch) {
                              baseStyle.filter = 'grayscale(100%) opacity(50%)'
                            }

                            return (
                              <button
                                key={slot.id}
                                onClick={() => { if (!isSessionMismatch) handleSlotClick(slot) }}
                                disabled={isFull || isSessionMismatch}
                                style={baseStyle}
                                className={\`group relative flex flex-col text-left rounded-2xl border-2 transition-all overflow-hidden \${isFull || isSessionMismatch
                                  ? 'opacity-60 cursor-not-allowed'
                                  : isSel
                                    ? (promoPdcSelectingDay2 ? 'shadow-lg shadow-green-500/20' : 'shadow-xl shadow-blue-500/30 scale-[1.02]')
                                    : 'hover:border-[#2157da] hover:shadow-lg hover:scale-[1.02] hover:-translate-y-0.5'
                                  }\`}
                              >
                                <div
                                  className="h-1.5 w-full flex-shrink-0"
                                  style={{ background: isSel ? (promoPdcSelectingDay2 ? '#22c55e' : 'rgba(255,255,255,0.3)') : sessionMeta.color }}
                                />
                                <div className="p-5 flex flex-col flex-1">
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xl leading-none">{sessionMeta.icon}</span>
                                      <span
                                        className="text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full"
                                        style={(!promoPdcSelectingDay2 && isSel)
                                          ? { background: 'rgba(255,255,255,0.18)', color: '#fff' }
                                          : { background: sessionMeta.bg, color: sessionMeta.color, border: \`1px solid \${sessionMeta.border}\` }
                                        }
                                      >
                                        {slot.session}
                                      </span>
                                    </div>
                                    <span
                                      className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full"
                                      style={isFull
                                        ? { background: '#fef2f2', color: '#dc2626' }
                                        : (!promoPdcSelectingDay2 && isSel)
                                          ? { background: 'rgba(255,255,255,0.18)', color: '#fff' }
                                          : (promoPdcSelectingDay2 && isSel)
                                            ? { background: '#dcfce7', color: '#15803d' }
                                            : { background: statusBg, color: statusText }
                                      }
                                    >
                                      {isSel ? (promoPdcSelectingDay2 ? '✓ DAY 2' : '✓ DAY 1') : statusLabel}
                                    </span>
                                  </div>
                                  <p
                                    className="text-[11px] font-bold uppercase tracking-wider mb-2 leading-tight"
                                    style={{ color: (!promoPdcSelectingDay2 && isSel) ? 'rgba(255,255,255,0.65)' : '#94a3b8' }}
                                  >
                                    {courseLabel}
                                  </p>
                                  <p
                                    className="text-base font-black mb-1"
                                    style={{ color: (!promoPdcSelectingDay2 && isSel) ? '#fff' : (promoPdcSelectingDay2 && isSel) ? '#166534' : '#1e293b' }}
                                  >
                                    {slot.session} Session
                                  </p>
                                  <div
                                    className="flex items-center gap-1.5 text-sm font-bold mb-4"
                                    style={{ color: (!promoPdcSelectingDay2 && isSel) ? 'rgba(255,255,255,0.9)' : '#334155' }}
                                  >
                                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <circle cx="12" cy="12" r="10" strokeWidth="2" />
                                      <polyline points="12 6 12 12 16 14" strokeWidth="2" />
                                    </svg>
                                    {slot.time_range}
                                  </div>
                                  <div className="mt-auto">
                                    <div
                                      className="h-1.5 rounded-full overflow-hidden mb-2"
                                      style={{ background: (!promoPdcSelectingDay2 && isSel) ? 'rgba(255,255,255,0.2)' : '#e2e8f0' }}
                                    >
                                      <div
                                        className="h-full rounded-full transition-all"
                                        style={{
                                          width: \`\${bookedPct}%\`,
                                          background: (!promoPdcSelectingDay2 && isSel) ? 'rgba(255,255,255,0.8)' : statusColor
                                        }}
                                      />
                                    </div>
                                    <p
                                      className="text-xs font-semibold"
                                      style={{ color: (!promoPdcSelectingDay2 && isSel) ? 'rgba(255,255,255,0.65)' : '#64748b' }}
                                    >
                                      {(slot.total_capacity || 0) - (slot.available_slots || 0)} / {slot.total_capacity} Students Enrolled
                                    </p>
                                  </div>
                                </div>
                                {(!promoPdcSelectingDay2 && isSel) && (
                                  <div className="absolute top-4 right-4">
                                    <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center shadow">
                                      <svg className="w-4 h-4 text-[#2157da]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    </div>
                                  </div>
                                )}
                              </button>
                            )
                          })}`;
    content = content.substring(0, s1) + newPromoMobileCard + "\n" + content.substring(s2);
}

fs.writeFileSync(file, content);
console.log("Restorer applied");