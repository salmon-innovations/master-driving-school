const fs = require('fs');
const file = 'c:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-frontend/src/pages/Schedule.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "s.type?.toLowerCase() === 'pdc' &&\n                  s.session === selectedSlot?.session &&",
  "s.type?.toLowerCase() === 'pdc' &&"
);

content = content.replace(
  "s.type?.toLowerCase() === 'pdc' &&\r\n                  s.session === selectedSlot?.session &&",
  "s.type?.toLowerCase() === 'pdc' &&"
);

const targetText = `                    {day2Slots.map(slot => {
                      const isFull2 = slot.available_slots === 0
                      const isSel2 = selectedSlot2?.id === slot.id
                      const colors2 = sessionColor(slot.session, isSel2, slot.type)
                      return (
                        <button
                          key={slot.id}
                          onClick={() => handleSlotClick(slot)}
                          disabled={isFull2}
                          style={isSel2 ? { background: colors2.bg } : {}}
                          className={\`relative p-4 rounded-2xl text-left border-2 transition-all \${isSel2 ? 'border-transparent shadow-xl shadow-blue-500/30 scale-105'
                            : isFull2 ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60'
                              : 'bg-white border-gray-200 hover:border-[#2157da] hover:shadow-md hover:scale-105'
                            }\`}
                        >`;
const replacement = `                    {day2Slots.map(slot => {
                      const isFull2 = slot.available_slots === 0
                      const isSel2 = selectedSlot2?.id === slot.id
                      const isSessionMismatch = selectedSlot && slot.session !== selectedSlot.session
                      const colors2 = sessionColor(slot.session, isSel2, slot.type)

                      const baseStyle = isSel2 ? { background: colors2.bg } : {}
                      if (isSessionMismatch) {
                        baseStyle.filter = 'grayscale(100%) opacity(50%)'
                        baseStyle.cursor = 'not-allowed'
                      }

                      return (
                        <button
                          key={slot.id}
                          onClick={() => handleSlotClick(slot)}
                          disabled={isFull2 || isSessionMismatch}
                          style={baseStyle}
                          className={\`relative p-4 rounded-2xl text-left border-2 transition-all \${isSel2 ? 'border-transparent shadow-xl shadow-blue-500/30 scale-105'
                            : isFull2 || isSessionMismatch ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60'
                              : 'bg-white border-gray-200 hover:border-[#2157da] hover:shadow-md hover:scale-105'
                            }\`}
                        >`;
                        
let newC = content.replace(targetText, replacement);
if (newC === content) {
    newC = content.replace(targetText.replace(/\n/g, '\r\n'), replacement.replace(/\n/g, '\r\n'));
}

fs.writeFileSync(file, newC);