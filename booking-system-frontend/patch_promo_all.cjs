const fs = require('fs');
let s = fs.readFileSync('src/pages/Schedule.jsx', 'utf8');

// 1. Promo PDC Calendar (isMismatched styling in calendar dots)
// It curr uses border-red-200 bg-red-50 ... I need it to be gray!
const s1 = `                                  const isSessionMismatch = promoPdcSelectingDay2 && promoPdcSlot && slot.session !== promoPdcSlot.session;
                                  return (
                                    <div key={slot.id} onClick={(e) => { 
                                      e.stopPropagation(); 
                                      if (isFullyBooked) return; 
                                      if (isSessionMismatch) {
                                        showNotification(\`For Day 2, please select the same session type: \${promoPdcSlot.session}\`, 'warning');
                                        return;
                                      }
                                      setPromoPdcDate2(new Date(promoPdcDay2CalMonth.getFullYear(), promoPdcDay2CalMonth.getMonth(), day)); 
                                      handleSlotClick(slot); 
                                    }} className={\`w-full text-left rounded-[7px] border px-1.5 py-1 flex flex-col gap-[2px] \${!isFullyBooked && !isSessionMismatch ? 'cursor-pointer hover:shadow-md transition-all' : 'cursor-not-allowed'} \${
                                      isSlotSel2 ? 'border-green-500 bg-green-500 text-white shadow-sm'
                                        : (isFullyBooked || isSessionMismatch) ? 'border-red-200 bg-red-50 text-red-500 opacity-70'
                                          : 'border-orange-200 bg-orange-50 text-orange-700'
                                    }\`}>
                                      <div className="flex items-center justify-between gap-1 leading-none">
                                        <span className="text-[9px] sm:text-[10px] font-black truncate flex-1 min-w-0">{sessionLabel}</span>
                                        <span className={\`text-[8px] font-bold flex-shrink-0 px-1 rounded leading-[1.5] \${
                                          isSlotSel2 ? 'bg-white/25 text-white'
                                            : (isFullyBooked || isSessionMismatch) ? 'bg-red-100 text-red-600'
                                              : 'bg-orange-100 text-orange-700'
                                        }\`}>{countLabel}</span>
                                      </div>`;

const s2 = `                                  const isSessionMismatch = promoPdcSelectingDay2 && promoPdcSlot && slot.session !== promoPdcSlot.session;
                                  return (
                                    <div key={slot.id} onClick={(e) => { 
                                      e.stopPropagation(); 
                                      if (isFullyBooked) return; 
                                      if (isSessionMismatch) {
                                        showNotification(\`For Day 2, please select the same session type: \${promoPdcSlot.session}\`, 'warning');
                                        return;
                                      }
                                      setPromoPdcDate2(new Date(promoPdcDay2CalMonth.getFullYear(), promoPdcDay2CalMonth.getMonth(), day)); 
                                      handleSlotClick(slot); 
                                    }} className={\`w-full text-left rounded-[7px] border px-1.5 py-1 flex flex-col gap-[2px] \${!isFullyBooked && !isSessionMismatch ? 'cursor-pointer hover:shadow-md transition-all' : 'cursor-not-allowed opacity-50'} \${
                                      isSlotSel2 ? 'border-green-500 bg-green-500 text-white shadow-sm'
                                        : isSessionMismatch ? 'border-gray-200 bg-gray-50 text-gray-500 opacity-70 grayscale'
                                        : isFullyBooked ? 'border-red-200 bg-red-50 text-red-500 opacity-70'
                                        : 'border-orange-200 bg-orange-50 text-orange-700'
                                    }\`}>
                                      <div className="flex items-center justify-between gap-1 leading-none">
                                        <span className="text-[9px] sm:text-[10px] font-black truncate flex-1 min-w-0">{sessionLabel}</span>
                                        <span className={\`text-[8px] font-bold flex-shrink-0 px-1 rounded leading-[1.5] \${
                                          isSlotSel2 ? 'bg-white/25 text-white'
                                            : isSessionMismatch ? 'bg-gray-100 text-gray-500'
                                            : isFullyBooked ? 'bg-red-100 text-red-600'
                                            : 'bg-orange-100 text-orange-700'
                                        }\`}>{countLabel}</span>
                                      </div>`;

if (s.includes(s1)) {
    s = s.replace(s1, s2);
} else {
    // fallback replace
    console.log("Could not find calendar dots replacing!");
}


const s3 = `{promoPdcFiltered.map(slot => {
                            const isFull = slot.available_slots === 0
                            const isSel = promoPdcSlot?.id === slot.id
                            const colors = sessionColor(slot.session, isSel)
                            return (
                              <button key={slot.id} onClick={() => handleSlotClick(slot)} disabled={isFull}
                                style={isSel ? { background: colors.bg } : {}}
                                className={\`relative p-4 rounded-2xl text-left border-2 transition-all \${isSel ? 'border-transparent shadow-xl shadow-blue-500/30 scale-105' : isFull ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60' : 'bg-white border-gray-200 hover:border-[#2157da] hover:shadow-md hover:scale-105'}\`}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xl">{sessionIcon(slot.session)}</span>
                                  <div className="flex-1">
                                    <p className={\`font-black text-sm \${isSel ? 'text-white' : 'text-gray-900'}\`}>{slot.session} Session</p>
                                    <p className={\`text-xs font-bold \${isSel ? 'text-blue-100' : 'text-gray-500'}\`}>🕐 {slot.time_range}</p>
                                  </div>
                                  {isSel && <span className="text-[10px] font-black bg-white/20 text-white px-2 py-0.5 rounded-lg">Day 1 ✓</span>}
                                </div>
                                <div className={\`h-1.5 rounded-full overflow-hidden \${isSel ? 'bg-white/20' : 'bg-gray-200'} mb-2\`}>
                                  <div className={\`h-full rounded-full \${isSel ? 'bg-white' : slot.available_slots === 0 ? 'bg-red-500' : 'bg-green-500'}\`}
                                    style={{ width: \`\${((slot.total_capacity - slot.available_slots) / slot.total_capacity) * 100}%\` }} />
                                </div>
                                <p className={\`text-xs font-bold \${isSel ? 'text-blue-100' : 'text-gray-500'}\`}>{(slot.total_capacity || 0) - (slot.available_slots || 0)} / {slot.total_capacity} enrolled</p>
                                {isFull && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-black mt-1 inline-block">FULL</span>}
                                {isSel && <div className="absolute top-2 right-2 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow"><svg className="w-3 h-3 text-[#2157da]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>}
                              </button>
                            )
                          })}`;

const s3_new = `{promoPdcFiltered.map(slot => {
                            const isFull = slot.available_slots === 0
                            const isDay1 = promoPdcSlot?.id === slot.id
                            const bookedPct = ((slot.total_capacity - slot.available_slots) / slot.total_capacity) * 100

                            const sessionMeta = {
                              'Morning': { icon: '🌅', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', pill: 'bg-orange-100 text-orange-700' },
                              'Afternoon': { icon: '☀️', color: '#ca8a04', bg: '#fefce8', border: '#fde68a', pill: 'bg-yellow-100 text-yellow-700' },
                              'Whole Day': { icon: '🕐', color: '#2157da', bg: '#eff6ff', border: '#bfdbfe', pill: 'bg-blue-100 text-blue-700' },
                            }[slot.session] || { icon: '🕐', color: '#2157da', bg: '#eff6ff', border: '#bfdbfe', pill: 'bg-blue-100 text-blue-700' }

                            const cardBg = isDay1
                              ? 'linear-gradient(135deg, #1a4fba 0%, #1e3a8a 100%)'
                              : isFull
                                ? '#f8fafc'
                                : 'white';
                                
                            const cardBorder = isDay1
                              ? 'transparent'
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
                                    : 'hover:border-[#2157da] hover:shadow-lg hover:scale-[1.02] hover:-translate-y-0.5'
                                  }\`}
                              >
                                <div
                                  className="h-1.5 w-full flex-shrink-0"
                                  style={{ background: isDay1 ? 'rgba(255,255,255,0.3)' : sessionMeta.color }}
                                />
                                <div className="p-5 flex flex-col flex-1">
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xl leading-none">{sessionMeta.icon}</span>
                                      <span
                                        className="text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full text-white"
                                        style={{ background: isDay1 ? 'rgba(255,255,255,0.18)' : sessionMeta.color }}
                                      >
                                        {slot.session}
                                      </span>
                                    </div>
                                    <span
                                      className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full"
                                      style={isFull
                                        ? { background: '#fef2f2', color: '#dc2626' }
                                        : isDay1
                                          ? { background: 'rgba(255,255,255,0.18)', color: '#fff' }
                                          : { background: '#f0fdf4', color: '#15803d' }
                                      }
                                    >
                                      {isDay1 ? '✓ DAY 1' : isFull ? 'FULL' : 'OPEN'}
                                    </span>
                                  </div>
                                  <p
                                    className="text-base font-black mb-1"
                                    style={{ color: isDay1 ? '#fff' : '#1e293b' }}
                                  >
                                    {slot.session} Session
                                  </p>
                                  <div
                                    className="flex items-center gap-1.5 text-sm font-bold mb-4"
                                    style={{ color: isDay1 ? 'rgba(255,255,255,0.9)' : '#334155' }}
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
                                      style={{ background: isDay1 ? 'rgba(255,255,255,0.2)' : '#e2e8f0' }}
                                    >
                                      <div
                                        className="h-full rounded-full transition-all"
                                        style={{
                                          width: \`\${bookedPct}%\`,
                                          background: isDay1 ? 'rgba(255,255,255,0.8)' : (isFull ? '#ef4444' : '#22c55e')
                                        }}
                                      />
                                    </div>
                                    <p
                                      className="text-xs font-semibold"
                                      style={{ color: isDay1 ? 'rgba(255,255,255,0.65)' : '#64748b' }}
                                    >
                                      {(slot.total_capacity || 0) - (slot.available_slots || 0)} / {slot.total_capacity} Enrolled
                                    </p>
                                  </div>
                                </div>
                              </button>
                            )
                          })}`;


const s4 = `{promoPdcFiltered2.map(slot => {
                            const isFull = slot.available_slots === 0
                            const isSel = promoPdcSlot2?.id === slot.id
                            const colors = sessionColor(slot.session, isSel, slot.type)
                            return (
                              <button key={slot.id} onClick={() => handleSlotClick(slot)} disabled={isFull}
                                style={isSel ? { background: colors.bg } : {}}
                                className={\`relative p-4 rounded-2xl text-left border-2 transition-all \${isSel ? 'border-transparent shadow-xl shadow-green-500/30 scale-105' : isFull ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60' : 'bg-white border-gray-200 hover:border-green-500 hover:shadow-md hover:scale-105'}\`}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xl">{sessionIcon(slot.session)}</span>
                                  <div className="flex-1">
                                    <p className={\`font-black text-sm \${isSel ? 'text-white' : 'text-gray-900'}\`}>{slot.session} Session</p>
                                    <p className={\`text-xs font-bold \${isSel ? 'text-green-100' : 'text-gray-500'}\`}>🕐 {slot.time_range}</p>
                                  </div>
                                  {isSel && <span className="text-[10px] font-black bg-white/20 text-white px-2 py-0.5 rounded-lg">Day 2 ✓</span>}
                                </div>
                                <div className={\`h-1.5 rounded-full overflow-hidden \${isSel ? 'bg-white/20' : 'bg-gray-200'} mb-2\`}>
                                  <div className={\`h-full rounded-full \${isSel ? 'bg-white' : slot.available_slots === 0 ? 'bg-red-500' : 'bg-green-500'}\`}
                                    style={{ width: \`\${((slot.total_capacity - slot.available_slots) / slot.total_capacity) * 100}%\` }} />
                                </div>
                                <p className={\`text-xs font-bold \${isSel ? 'text-green-100' : 'text-gray-500'}\`}>{(slot.total_capacity || 0) - (slot.available_slots || 0)} / {slot.total_capacity} enrolled</p>
                                {isFull && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-black mt-1 inline-block">FULL</span>}
                                {isSel && <div className="absolute top-2 right-2 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow"><svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>}
                              </button>
                            )
                          })}`;


const s4_new = `{promoPdcFiltered2.map(slot => {
                            const isFull = slot.available_slots === 0
                            const isDay2 = promoPdcSlot2?.id === slot.id
                            const isSessionMismatch = promoPdcSelectingDay2 && promoPdcSlot && slot.session !== promoPdcSlot.session;
                            
                            const bookedPct = ((slot.total_capacity - slot.available_slots) / slot.total_capacity) * 100

                            const sessionMeta = {
                              'Morning': { icon: '🌅', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', pill: 'bg-orange-100 text-orange-700' },
                              'Afternoon': { icon: '☀️', color: '#ca8a04', bg: '#fefce8', border: '#fde68a', pill: 'bg-yellow-100 text-yellow-700' },
                              'Whole Day': { icon: '🕐', color: '#2157da', bg: '#eff6ff', border: '#bfdbfe', pill: 'bg-blue-100 text-blue-700' },
                            }[slot.session] || { icon: '🕐', color: '#2157da', bg: '#eff6ff', border: '#bfdbfe', pill: 'bg-blue-100 text-blue-700' }

                            const cardBg = isDay2
                              ? '#f0fdf4'
                              : isFull || isSessionMismatch
                                ? '#f8fafc'
                                : 'white';
                                
                            const cardBorder = isDay2
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
                                  : isDay2
                                    ? 'shadow-lg shadow-green-500/20'
                                    : 'hover:border-[#2157da] hover:shadow-lg hover:scale-[1.02] hover:-translate-y-0.5'
                                  }\`}
                              >
                                <div
                                  className="h-1.5 w-full flex-shrink-0"
                                  style={{ background: isDay2 ? '#22c55e' : sessionMeta.color }}
                                />
                                <div className="p-5 flex flex-col flex-1">
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xl leading-none">{sessionMeta.icon}</span>
                                      <span
                                        className="text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full text-white"
                                        style={{ background: isDay2 ? '#22c55e' : sessionMeta.color }}
                                      >
                                        {slot.session}
                                      </span>
                                    </div>
                                    <span
                                      className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full"
                                      style={isFull
                                        ? { background: '#fef2f2', color: '#dc2626' }
                                        : isDay2
                                          ? { background: '#dcfce7', color: '#15803d' }
                                          : { background: '#f0fdf4', color: '#15803d' }
                                      }
                                    >
                                      {isDay2 ? '✓ DAY 2' : isFull ? 'FULL' : 'OPEN'}
                                    </span>
                                  </div>
                                  <p
                                    className="text-base font-black mb-1"
                                    style={{ color: isDay2 ? '#166534' : '#1e293b' }}
                                  >
                                    {slot.session} Session
                                  </p>
                                  <div
                                    className="flex items-center gap-1.5 text-sm font-bold mb-4"
                                    style={{ color: '#334155' }}
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
                                      style={{ background: '#e2e8f0' }}
                                    >
                                      <div
                                        className="h-full rounded-full transition-all"
                                        style={{
                                          width: \`\${bookedPct}%\`,
                                          background: isDay2 ? '#22c55e' : (isFull ? '#ef4444' : '#22c55e')
                                        }}
                                      />
                                    </div>
                                    <p
                                      className="text-xs font-semibold"
                                      style={{ color: '#64748b' }}
                                    >
                                      {(slot.total_capacity || 0) - (slot.available_slots || 0)} / {slot.total_capacity} Enrolled
                                    </p>
                                  </div>
                                </div>
                              </button>
                            )
                          })}`;


if (s.includes(s3)) s = s.replace(s3, s3_new);
if (s.includes(s4)) s = s.replace(s4, s4_new);

fs.writeFileSync('src/pages/Schedule.jsx', s, 'utf8');
console.log("Promo PDC completely patched!");