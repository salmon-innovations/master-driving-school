const fs = require('fs');
const file = 'c:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-frontend/src/pages/Schedule.jsx';
let content = fs.readFileSync(file, 'utf8');

// Patch 1: Regular Calendar Mismatch Gray Styles
const regularTarget = `                                }} className={\`w-full text-left rounded-[7px] border px-1.5 py-1 flex flex-col gap-[2px] \${!isFullyBooked && !isSessionMismatch && isAvailable ? 'cursor-pointer hover:shadow-md transition-all' : 'cursor-not-allowed opacity-50'} \${
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
                                }\`}>{countLabel}</span>`;

const regularReplacement = `                                }} className={\`w-full text-left rounded-[7px] border px-1.5 py-1 flex flex-col gap-[2px] \${!isFullyBooked && !isSessionMismatch && isAvailable ? 'cursor-pointer hover:shadow-md transition-all' : 'cursor-not-allowed opacity-50'} \${
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
                                }\`}>{countLabel}</span>`;


// Patch 2: Promo Calendar Mismatch Gray Styles
const promoTarget = `                                      }} className={\`w-full text-left rounded-[7px] border px-1.5 py-1 flex flex-col gap-[2px] \${!isFullyBooked && avail ? 'cursor-pointer hover:shadow-md transition-all' : 'cursor-not-allowed opacity-50'} \${
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

const promoReplacement = `                                      }} className={\`w-full text-left rounded-[7px] border px-1.5 py-1 flex flex-col gap-[2px] \${!isFullyBooked && !isMismatched && avail ? 'cursor-pointer hover:shadow-md transition-all' : 'cursor-not-allowed opacity-50'} \${
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
                                          }\`}>{countLabel}</span>`;

function patchContent(c, target, replacement) {
    let out = c.replace(target, replacement);
    if (out === c) out = c.replace(target.replace(/\n/g, '\\r\\n'), replacement.replace(/\n/g, '\\r\\n'));
    if (out === c) out = c.replace(target.replace(/\\r\\n/g, '\\n'), replacement.replace(/\\r\\n/g, '\\n'));
    return out;
}

let newContent = patchContent(content, regularTarget, regularReplacement);
newContent = patchContent(newContent, promoTarget, promoReplacement);

fs.writeFileSync(file, newContent);
console.log('Patch complete. File size changed from', content.length, 'to', newContent.length);