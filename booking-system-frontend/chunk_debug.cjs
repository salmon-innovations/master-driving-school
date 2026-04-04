const isSel = promoPdcDate?.getDate() === day && promoPdcDate?.getMonth() === promoPdcCalMonth.getMonth() && promoPdcDate?.getFullYear() === promoPdcCalMonth.getFullYear()
                          const currentDayStr = `${promoPdcCalMonth.getFullYear()}-${String(promoPdcCalMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
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
                              className={`min-h-[52px] sm:min-h-[140px] rounded-lg sm:rounded-xl border flex flex-col overflow-hidden transition-all relative ${
                                !avail ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:shadow-md'
                              } ${slotCellBorder}`}
                            >
                              <div className="flex items-center justify-between px-2.5 pt-2.5 pb-1 flex-shrink-0">
                                <span className={`text-[13px] font-bold leading-none ${
                                  isSel ? 'text-[#2563eb]' : isToday ? 'text-[#2563eb]' : 'text-gray-500'
                                }`}>{day}</span>
                                {isToday && <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] opacity-60 flex-shrink-0"></span>}
                              </div>
                              <div className="flex flex-col gap-[3px] px-1.5 pb-2 flex-1">
                                {daySlot