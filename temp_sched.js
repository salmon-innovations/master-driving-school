{/* Schedule */}
                    {scheduleSelection && (
                      <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-base">📅</span>
                            <p className="text-[10px] font-black text-green-400 uppercase tracking-widest">Schedule</p>
                          </div>
                          <button onClick={() => onNavigate('schedule')} className="text-[10px] font-black text-blue-300 hover:text-white bg-blue-500/20 hover:bg-blue-500/40 px-2 py-1 rounded-lg transition-all uppercase tracking-wide">
                            Change
                          </button>
                        </div>

                        {scheduleSelection.isMotorcyclePDC ? (
                          <p className="text-xs font-bold text-white/80 text-center mt-2">Assigned by Admin after payment</p>
                        ) : (
                          <div className="mt-2 space-y-1.5">
                            {scheduleSelection.slotDetails?.type?.toLowerCase() === 'tdc' && scheduleSelection.slotDetails?.end_date && scheduleSelection.slotDetails.end_date !== scheduleSelection.slotDetails.date ? (
                              <>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Day 1 & Day 2</p>
                                <p className="text-xs font-semibold text-white/90">
                                  {scheduleSelection.date && new Date(scheduleSelection.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} &amp; {new Date(scheduleSelection.slotDetails.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                              </>
                            ) : (
                              <>
                                {scheduleSelection.date2 && <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Day 1</p>}
                                <p className="text-xs font-semibold text-white/90">
                                  {scheduleSelection.date && new Date(scheduleSelection.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                              </>
                            )}
                            <p className="text-xs text-white/70 flex items-center gap-1.5">
                              <span>🕒</span>{scheduleSelection.slotDetails?.time_range || scheduleSelection.slotDetails?.time}
                            </p>
                            {scheduleSelection.date2 && (
                              <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Day 2</p>
                                <p className="text-xs font-semibold text-white/90">
                                  {scheduleSelection.date2 && new Date(scheduleSelection.date2).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                                <p className="text-xs text-white/70 flex items-center gap-1.5">
                                  <span>🕒</span>{scheduleSelection.slotDetails2?.time_range || scheduleSelection.slotDetails2?.time}
                                </p>
                              </div>
                            