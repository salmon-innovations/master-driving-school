const fs = require('fs');
const file = 'booking-system-frontend/src/admin/WalkInEnrollment.jsx';
let content = fs.readFileSync(file, 'utf8');

// The replacement code block for the header section
const newTagSectionPromo = \                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2px', width: '100%' }}>
                                                                        <div className="session-sub-label" style={{ flex: 1 }}>
                                                                            <span style={{ textTransform: 'capitalize', fontSize: '0.65rem' }}>{label === 'Morning' ? 'Morning Class' : label === 'Afternoon' ? 'Afternoon Class' : label}</span>
                                                                        </div>
                                                                        {!hasSlots && <span className="no-slot-tag" style={{ marginLeft: '4px' }}>NO SLOT</span>}
                                                                        {hasSlots && isFull && <span className="full-tag" style={{ marginLeft: '4px' }}>FULL</span>}
                                                                        {hasSlots && !isFull && !hasMultiple && (
                                                                            <span style={{
                                                                                fontSize: '0.55rem',
                                                                                fontWeight: '800',
                                                                                padding: '2px 5px',
                                                                                borderRadius: '4px',
                                                                                backgroundColor: type === 'morning' ? '#ffedd5' : type === 'afternoon' ? '#fef3c7' : '#e0e7ff',
                                                                                color: type === 'morning' ? '#c2410c' : type === 'afternoon' ? '#b45309' : '#1d4ed8',
                                                                                marginLeft: '4px',
                                                                                whiteSpace: 'nowrap'
                                                                            }}>
                                                                                {slots[0].available_slots} Slots
                                                                            </span>
                                                                        )}
                                                                    </div>\;

// And for the bottom section
const newTimePromo = \                                                                        ) : (
                                                                            <div className="session-sub-time" style={{ textTransform: 'lowercase', marginTop: '0' }}>
                                                                                {slots[0].time_range.replace(/ - /g, ' / ').replace(/ AM/ig, 'am').replace(/ PM/ig, 'pm')}
                                                                            </div>
                                                                        )\;

// Same blocks for the non-promo section with just a different indent level.
// Or we can just use string replacement on the exact chunks

// Block 1 (Promo)
const target1_header = \                                                                    <div className="session-sub-label">
                                                                        <span>{label}</span>
                                                                    </div>
                                                                    {!hasSlots && <span className="no-slot-tag">NO SLOT</span>}
                                                                    {hasSlots && isFull && <span className="full-tag">FULL</span>}\;
content = content.replace(target1_header, newTagSectionPromo);

const target1_bottom = \                                                                        ) : (
                                                                            <div className="session-sub-time">
                                                                                <div>{slots[0].time_range}</div>
                                                                                <div style={{ fontSize: '0.7rem', fontWeight: 'bold', marginTop: '2px', opacity: 0.9 }}>
                                                                                    {slots[0].available_slots} Slots
                                                                                </div>
                                                                            </div>
                                                                        )\;
content = content.replace(target1_bottom, newTimePromo);


// Block 2 (Non-promo - has slightly different indent base)
const newTagSectionReg = \                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2px', width: '100%' }}>
                                                                            <div className="session-sub-label" style={{ flex: 1 }}>
                                                                                <span style={{ textTransform: 'capitalize', fontSize: '0.65rem' }}>{label === 'Morning' ? 'Morning Class' : label === 'Afternoon' ? 'Afternoon Class' : label}</span>
                                                                            </div>
                                                                            {!hasSlots && <span className="no-slot-tag" style={{ marginLeft: '4px' }}>NO SLOT</span>}
                                                                            {hasSlots && allFull && <span className="full-tag" style={{ marginLeft: '4px' }}>FULL</span>}
                                                                            {hasSlots && !allFull && !hasMultiple && (
                                                                                <span style={{
                                                                                    fontSize: '0.55rem',
                                                                                    fontWeight: '800',
                                                                                    padding: '2px 5px',
                                                                                    borderRadius: '4px',
                                                                                    backgroundColor: type === 'morning' ? '#ffedd5' : type === 'afternoon' ? '#fef3c7' : '#e0e7ff',
                                                                                    color: type === 'morning' ? '#c2410c' : type === 'afternoon' ? '#b45309' : '#1d4ed8',
                                                                                    marginLeft: '4px',
                                                                                    whiteSpace: 'nowrap'
                                                                                }}>
                                                                                    {slots[0].available_slots} Slots
                                                                                </span>
                                                                            )}
                                                                        </div>\;

const target2_header = \                                                                        <div className="session-sub-label">
                                                                            <span>{label}</span>
                                                                        </div>
                                                                        {!hasSlots && <span className="no-slot-tag">NO SLOT</span>}
                                                                        {hasSlots && allFull && <span className="full-tag">FULL</span>}\;
content = content.replace(target2_header, newTagSectionReg);

const newTimeReg = \                                                                             ) : (
                                                                                 <div className="session-sub-time" style={{ textTransform: 'lowercase', marginTop: '0' }}>
                                                                                     {slots[0].time_range.replace(/ - /g, ' / ').replace(/ AM/ig, 'am').replace(/ PM/ig, 'pm')}
                                                                                 </div>
                                                                             )\;

const target2_bottom = \                                                                             ) : (
                                                                                 <div className="session-sub-time">
                                                                                     <div>{slots[0].time_range}</div>
                                                                                     <div style={{ fontSize: '0.7rem', fontWeight: 'bold', marginTop: '2px', opacity: 0.9 }}>
                                                                                         {slots[0].available_slots} Slots
                                                                                     </div>
                                                                                 </div>
                                                                             )\;
content = content.replace(target2_bottom, newTimeReg);

fs.writeFileSync(file, content);
console.log('Done replacement');
