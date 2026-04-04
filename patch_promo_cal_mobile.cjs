const fs = require('fs');
let content = fs.readFileSync('booking-system-frontend/src/pages/Schedule.jsx', 'utf8');

// Find the target wrapper
const targetDiv = '<div className="flex flex-col gap-[3px] px-1.5 pb-2 flex-1">';
let lastIndex = content.lastIndexOf(targetDiv);

// Because I need to wrap it specifically inside the Promo PDC section (the 2nd instance approx)
if (lastIndex !== -1) {
  // Let's create the mobile dots replacement
  let mobileDots = `
                                {/* Mobile: dot indicators only - made pointer-events-none so they don't block cell click */}
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
  `;

  // Actually check if we already replaced it or if the previous code isn't hidden:
  let block = content.substring(lastIndex, lastIndex + 2000);
  
  if (block.includes('hidden sm:flex')) {
    console.log('Already patched?!');
  } else {
    // We just replace that exact div line!
    content = content.substring(0, lastIndex) + mobileDots + content.substring(lastIndex + targetDiv.length);
    fs.writeFileSync('booking-system-frontend/src/pages/Schedule.jsx', content);
    console.log('Patched Promo Calendar to hide full pills on mobile and show dots!');
  }
} else {
  console.log('Target div not found.');
}
