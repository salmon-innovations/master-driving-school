const fs = require('fs');
let s = fs.readFileSync('src/pages/Schedule.jsx', 'utf8');

// 1. Regular Desktop Calendar pill fix (from Red to Gray for mismatched)
const s1 = `                          return (
                            <div
                              key={slot.id}
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                if (isFullyBooked) return; 
                                if (isSessionMismatch) {
                                  showNotification(\`For Day 2, please select the same session type: \${selectedSlot.session}\`, 'warning');
                                  return;
                                }
                                handleCalendarSlotClick(slot, day); 
                              }} className={\`w-full text-left rounded-[7px] border px-1.5 py-1 flex flex-col gap-[2px] \${!isFullyBooked && !isSessionMismatch ? 'cursor-pointer hover:shadow-md transition-all' : 'cursor-not-allowed opacity-50'} \${
                                isSlotSelected
                                  ? 'border-[#2563eb] bg-[#2563eb] text-white shadow-sm'
                                  : (isFullyBooked || isSessionMismatch)
                                    ? 'border-red-200 bg-red-50 text-red-500 opacity-70'
                                    : isTdc
                                      ? 'border-violet-200 bg-violet-50 text-violet-700'
                                      : 'border-orange-200 bg-orange-50 text-orange-700'
                              }\`}
                            >
                            <div className="flex items-center justify-between gap-1 leading-none">
                              <span className="text-[9px] sm:text-[10px] font-black truncate flex-1 min-w-0">{sessionLabel}</span>
                              <span className={\`text-[8px] font-bold flex-shrink-0 px-1 rounded leading-[1.5] \${
                                isSlotSelected ? 'bg-white/25 text-white' :
                                isFullyBooked ? 'bg-red-100 text-red-600' :
                                isTdc ? 'bg-violet-100 text-violet-700' : 'bg-orange-100 text-orange-700'
                              }\`}>{countLabel}</span>
                            </div>`;

const s2 = `                          return (
                            <div
                              key={slot.id}
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                if (isFullyBooked) return; 
                                if (isSessionMismatch) {
                                  showNotification(\`For Day 2, please select the same session type: \${selectedSlot.session}\`, 'warning');
                                  return;
                                }
                                handleCalendarSlotClick(slot, day); 
                              }} className={\`w-full text-left rounded-[7px] border px-1.5 py-1 flex flex-col gap-[2px] \${!isFullyBooked && !isSessionMismatch ? 'cursor-pointer hover:shadow-md transition-all' : 'cursor-not-allowed opacity-50'} \${
                                isSlotSelected
                                  ? 'border-[#2563eb] bg-[#2563eb] text-white shadow-sm'
                                  : isSessionMismatch
                                    ? 'border-gray-200 bg-gray-50 text-gray-500 opacity-70 grayscale'
                                    : isFullyBooked
                                      ? 'border-red-200 bg-red-50 text-red-500 opacity-70'
                                      : isTdc
                                        ? 'border-violet-200 bg-violet-50 text-violet-700'
                                        : 'border-orange-200 bg-orange-50 text-orange-700'
                              }\`}
                            >
                            <div className="flex items-center justify-between gap-1 leading-none">
                              <span className="text-[9px] sm:text-[10px] font-black truncate flex-1 min-w-0">{sessionLabel}</span>
                              <span className={\`text-[8px] font-bold flex-shrink-0 px-1 rounded leading-[1.5] \${
                                isSlotSelected ? 'bg-white/25 text-white' :
                                isSessionMismatch ? 'bg-gray-100 text-gray-500' :
                                isFullyBooked ? 'bg-red-100 text-red-600' :
                                isTdc ? 'bg-violet-100 text-violet-700' : 'bg-orange-100 text-orange-700'
                              }\`}>{countLabel}</span>
                            </div>`;

// Check if first replace exists
if (s.includes(s1)) {
    s = s.replace(s1, s2);
} else {
    // maybe opacity-50 is missing?
    let s1_alt = s1.replace("opacity-50", "");
    if (s.includes(s1_alt)) s = s.replace(s1_alt, s2);
}

// 2. Regular PDC cards list (relevantSlots.map)
const s3 = `                  const cardBg = isDay1
                    ? 'linear-gradient(135deg, #1a4fba 0%, #1e3a8a 100%)'
                    : isDay2
                      ? '#f0fdf4'
                      : isFull
                        ? '#f8fafc'
                        : 'white';
                  const cardBorder = isDay1
                    ? 'transparent'
                    : isDay2
                      ? '#22c55e'
                      : isFull
                        ? '#e2e8f0'
                        : '#e2e8f0';

                  return (
                    <button
                      key={slot.id}
                      onClick={() => handleSlotClick(slot)}
                      disabled={isFull}
                      style={{ background: cardBg, borderColor: cardBorder }}
                      className={\`group relative flex flex-col text-left rounded-2xl border-2 transition-all overflow-hidden \${isFull
                        ? 'opacity-60 cursor-not-allowed'
                        : isDay1
                          ? 'shadow-xl shadow-blue-500/30 scale-[1.02]'
                          : isDay2
                            ? 'shadow-lg shadow-green-500/20'
                            : 'hover:border-[#2157da] hover:shadow-lg hover:scale-[1.02] hover:-translate-y-0.5'
                        }\`}
                    >`;

const s4 = `                  const isSessionMismatch = selectingDay2 && selectedSlot && slot.session !== selectedSlot.session;
                  const cardBg = isDay1
                    ? 'linear-gradient(135deg, #1a4fba 0%, #1e3a8a 100%)'
                    : isDay2
                      ? '#f0fdf4'
                      : isFull || isSessionMismatch
                        ? '#f8fafc'
                        : 'white';
                  const cardBorder = isDay1
                    ? 'transparent'
                    : isDay2
                      ? '#22c55e'
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
                        : isDay1
                          ? 'shadow-xl shadow-blue-500/30 scale-[1.02]'
                          : isDay2
                            ? 'shadow-lg shadow-green-500/20'
                            : 'hover:border-[#2157da] hover:shadow-lg hover:scale-[1.02] hover:-translate-y-0.5'
                        }\`}
                    >`;

s = s.replace(s3, s4);

fs.writeFileSync('src/pages/Schedule.jsx', s, 'utf8');
console.log("Mismatched sessions greyed out in Regular PDC view!");