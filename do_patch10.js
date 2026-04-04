const fs = require('fs');
const file = 'c:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-frontend/src/pages/Schedule.jsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

// 1. Regular map
let startReg = lines.findIndex(l => l.includes('const isSessionMismatch = selectingDay2 && selectedSlot'));
if (startReg !== -1) {
  for (let i = startReg; i < startReg + 30; i++) {
    if (lines[i].includes('? \'border-red-200 bg-red-50 text-red-500 opacity-70\'')) {
      if (lines[i-1].includes('isFullyBooked || isSessionMismatch')) {
        lines[i-1] = lines[i-1].replace('(isFullyBooked || isSessionMismatch)', 'isSessionMismatch');
        lines[i] = "                                      ? 'border-gray-200 bg-gray-50 text-gray-500 opacity-70 grayscale'\n" +
                   "                                      : isFullyBooked\n" + lines[i];
      }
    }
    if (lines[i].includes('isFullyBooked ? \'bg-red-100 text-red-600\' :')) {
        let replacement = "                                  isSessionMismatch ? 'bg-gray-100 text-gray-500' :\n" + lines[i];
        if (!lines[i-1].includes('isSessionMismatch')) {
             lines.splice(i, 0, "                                  isSessionMismatch ? 'bg-gray-100 text-gray-500' :");
             break;
        }
    }
  }
}

// 2. Promo map
let startPromo = lines.findIndex(l => l.includes('const isMismatched = promoPdcSelectingDay2 && promoPdcSlot'));
if (startPromo !== -1) {
  for (let i = startPromo; i < startPromo + 30; i++) {
    if (lines[i].includes('? \'cursor-pointer hover:shadow-md transition-all\' : \'cursor-not-allowed opacity-50\'')) {
        lines[i] = lines[i].replace('!isFullyBooked && avail', '!isFullyBooked && !isMismatched && avail');
    }
    if (lines[i].includes(': isFullyBooked ? \'border-red-200 bg-red-50 text-red-500 opacity-70\'')) {
        if (!lines[i-1].includes('isMismatched')) {
             lines.splice(i, 0, "                                          : isMismatched ? 'border-gray-200 bg-gray-50 text-gray-500 opacity-70 grayscale'");
             i++;
        }
    }
    if (lines[i].includes(': isFullyBooked ? \'bg-red-100 text-red-600\'')) {
        if (!lines[i-1].includes('isMismatched')) {
             lines.splice(i, 0, "                                              : isMismatched ? 'bg-gray-100 text-gray-500'");
             break; // done with this block
        }
    }
  }
}

fs.writeFileSync(file, lines.join('\n'));
console.log('done');