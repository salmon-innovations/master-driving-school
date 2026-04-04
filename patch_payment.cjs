const fs = require('fs');

const replacement = "{/* Schedule */}\\n" +
"                    {scheduleSelection && (\\n" +
"                      <div className=\\"space-y-3\\">\\n" +
"                        <div className=\\"p-3 bg-white/5 rounded-xl border border-white/10\\">\\n" +
"                          <div className=\\"flex items-center justify-between mb-2\\">\\n" +
"                            <div className=\\"flex items-center gap-2\\">\\n" +
"                              <span className=\\"text-base\\">📅</span>\\n" +
"                              <p className=\\"text-[10px] font-black text-green-400 uppercase tracking-widest\\">\\n" +
"                                {scheduleSelection.pdcDate ? 'TDC Schedule' : 'Schedule'}\\n" +
"                              </p>\\n" +
"                            </div>\\n" +
"                            <button onClick={() => onNavigate('schedule')} className=\\"text-[10px] font-black text-blue-300 hover:text-white bg-blue-500/20 hover:bg-blue-500/40 px-2 py-1 rounded-lg transition-all uppercase tracking-wide\\">\\n" +
"                              Change\\n" +
"                            </button>\\n" +
"                          </div>\\n" +
"\\n" +
"                          {scheduleSelection.isMotorcyclePDC && !scheduleSelection.pdcDate ? (\\n" +
"                            <p className=\\"text-xs font-bold text-white/80 text-center mt-2\\">Assigned by Admin after payment</p>\\n" +
"                          ) : (\\n" +
"                            <div className=\\"mt-2 space-y-1.5\\">\\n" +
"                              {scheduleSelection.slotDetails?.type?.toLowerCase() === 'tdc' && scheduleSelection.slotDetails?.end_date && scheduleSelection.slotDetails.end_date !== scheduleSelection.slotDetails.date ? (\\n" +
"                                <>\\n" +
"                                  <p className=\\"text-[10px] text-gray-400 font-bold uppercase tracking-wider\\">Day 1 & Day 2</p>\\n" +
"                                  <p className=\\"text-xs font-semibold text-white/90\\">\\n" +
"                                    {scheduleSelection.date && new Date(scheduleSelection.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} &amp; {new Date(scheduleSelection.slotDetails.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}\\n" +
"                                  </p>\\n" +
"                                </>\\n" +
"                              ) : (\\n" +
"                                <>\\n" +
"                                  {scheduleSelection.date2 && <p className=\\"text-[10px] text-gray-400 font-bold uppercase tracking-wider\\">Day 1</p>}\\n" +
"                                  <p className=\\"text-xs font-semibold text-white/90\\">\\n" +
"                                    {scheduleSelection.date && new Date(scheduleSelection.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}\\n" +
"                                  </p>\\n" +
"                                </>\\n" +
"                              )}\\n" +
"                              <p className=\\"text-xs text-white/70 flex items-center gap-1.5\\">\\n" +
"                                <span>🕒</span>{scheduleSelection.slotDetails?.time_range || scheduleSelection.slotDetails?.time}\\n" +
"                              </p>\\n" +
"                              {scheduleSelection.date2 && (\\n" +
"                                <div className=\\"mt-2 pt-2 border-t border-white/10 space-y-1\\">\\n" +
"                                  <p className=\\"text-[10px] text-gray-400 font-bold uppercase tracking-wider\\">Day 2</p>\\n" +
"                                  <p className=\\"text-xs font-semibold text-white/90\\">\\n" +
"                                    {scheduleSelection.date2 && new Date(scheduleSelection.date2).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}\\n" +
"                                  </p>\\n" +
"                                  <p className=\\"text-xs text-white/70 flex items-center gap-1.5\\">\\n" +
"                                    <span>🕒</span>{scheduleSelection.slotDetails2?.time_range || scheduleSelection.slotDetails2?.time}\\n" +
"                                  </p>\\n" +
"                                </div>\\n" +
"                              )}\\n" +
"                            </div>\\n" +
"                          )}\\n" +
"                        </div>\\n" +
"\\n" +
"                        {scheduleSelection.pdcDate && (\\n" +
"                          <div className=\\"p-3 bg-white/5 rounded-xl border border-white/10\\">\\n" +
"                            <div className=\\"flex items-center gap-2 mb-2\\">\\n" +
"                              <span className=\\"text-base\\">🚘</span>\\n" +
"                              <p className=\\"text-[10px] font-black text-blue-400 uppercase tracking-widest\\">PDC Schedule</p>\\n" +
"                            </div>\\n" +
"\\n" +
"                            <div className=\\"mt-2 space-y-1.5\\">\\n" +
"                              {scheduleSelection.pdcDate2 ? (\\n" +
"                                <>\\n" +
"                                  <p className=\\"text-[10px] text-gray-400 font-bold uppercase tracking-wider\\">Day 1</p>\\n" +
"                                  <p className=\\"text-xs font-semibold text-white/90\\">\\n" +
"                                    {new Date(scheduleSelection.pdcDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}\\n" +
"                                  </p>\\n" +
"                                  <p className=\\"text-xs text-white/70 flex items-center gap-1.5 mb-2\\">\\n" +
"                                    <span>🕒</span>{scheduleSelection.pdcSlotDetails?.time_range || scheduleSelection.pdcSlotDetails?.time}\\n" +
"                                  </p>\\n" +
"                                  <div className=\\"mt-2 pt-2 border-t border-white/10 space-y-1\\">\\n" +
"                                    <p className=\\"text-[10px] text-gray-400 font-bold uppercase tracking-wider\\">Day 2</p>\\n" +
"                                    <p className=\\"text-xs font-semibold text-white/90\\">\\n" +
"                                      {new Date(scheduleSelection.pdcDate2).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}\\n" +
"                                    </p>\\n" +
"                                    <p className=\\"text-xs text-white/70 flex items-center gap-1.5\\">\\n" +
"                                      <span>🕒</span>{scheduleSelection.pdcSlotDetails2?.time_range || scheduleSelection.pdcSlotDetails2?.time}\\n" +
"                                    </p>\\n" +
"                                  </div>\\n" +
"                                </>\\n" +
"                              ) : (\\n" +
"                                <>\\n" +
"                                  <p className=\\"text-[10px] text-gray-400 font-bold uppercase tracking-wider\\">Date</p>\\n" +
"                                  <p className=\\"text-xs font-semibold text-white/90\\">\\n" +
"                                    {new Date(scheduleSelection.pdcDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}\\n" +
"                                  </p>\\n" +
"                                  <p className=\\"text-xs text-white/70 flex items-center gap-1.5\\">\\n" +
"                                    <span>🕒</span>{scheduleSelection.pdcSlotDetails?.time_range || scheduleSelection.pdcSlotDetails?.time}\\n" +
"                                  </p>\\n" +
"                                </>\\n" +
"                              )}\\n" +
"                            </div>\\n" +
"                          </div>\\n" +
"                        )}\\n" +
"                      </div>\\n" +
"                    )}";

let content = fs.readFileSync('booking-system-frontend/src/pages/Payment.jsx', 'utf8');

const sIdx = content.indexOf('{/* Schedule */}');
const endDivSearchStr = '                        )}';
const endDivIdx = content.indexOf(endDivSearchStr, sIdx) + endDivSearchStr.length + '\n                      </div>'.length;

content = content.substring(0, sIdx) + replacement + content.substring(endDivIdx);

fs.writeFileSync('booking-system-frontend/src/pages/Payment.jsx', content);
console.log('Patched correctly');