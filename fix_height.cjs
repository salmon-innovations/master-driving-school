const fs = require('fs');
const file = 'booking-system-frontend/src/admin/WalkInEnrollment.jsx';
let content = fs.readFileSync(file, 'utf8');

// Promo chunk
const oldPromoTags = \                                                                        {!hasSlots && <span className="no-slot-tag" style={{ marginLeft: '4px' }}>NO SLOT</span>}
                                                                        {hasSlots && isFull && <span className="full-tag" style={{ marginLeft: '4px' }}>FULL</span>}\;
const newPromoTags = \                                                                        {!hasSlots && <span style={{ fontSize: '0.55rem', fontWeight: '800', padding: '2px 5px', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#94a3b8', marginLeft: '4px', whiteSpace: 'nowrap' }}>NO SLOT</span>}
                                                                        {hasSlots && isFull && <span style={{ fontSize: '0.55rem', fontWeight: '800', padding: '2px 5px', borderRadius: '4px', backgroundColor: '#fee2e2', color: '#ef4444', marginLeft: '4px', whiteSpace: 'nowrap' }}>FULL</span>}\;
content = content.replace(oldPromoTags, newPromoTags);

const oldPromoTime = \                                                                    {hasSlots && (
                                                                        hasMultiple ? (
                                                                            <select 
                                                                                className="session-mini-select"\;

const oldPromoTimeEnd = \                                                                            </select>
                                                                        ) : (
                                                                            <div className="session-sub-time" style={{ textTransform: 'lowercase', marginTop: '0', fontSize: '0.55rem', opacity: 0.8 }}>
                                                                                {slots[0].time_range.replace(/ - /g, ' / ').replace(/ AM/ig, 'am').replace(/ PM/ig, 'pm')}
                                                                            </div>
                                                                        )
                                                                    )}\;
                                                                    
const newPromoTime = \                                                                    {hasSlots && hasMultiple ? (
                                                                            <select 
                                                                                className="session-mini-select"\;

const newPromoTimeEnd = \                                                                            </select>
                                                                    ) : (
                                                                        <div className="session-sub-time" style={{ textTransform: 'lowercase', marginTop: '0', fontSize: '0.55rem', opacity: (!hasSlots || isFull) ? 0.5 : 0.8 }}>
                                                                            {hasSlots ? slots[0].time_range.replace(/ - /g, ' / ').replace(/ AM/ig, 'am').replace(/ PM/ig, 'pm') : (label === 'Morning' ? '8:00am / 12:00pm' : label === 'Afternoon' ? '1:00pm / 5:00pm' : '8:00am / 5:00pm')}
                                                                        </div>
                                                                    )}\;

content = content.replace(oldPromoTime, newPromoTime);
content = content.replace(oldPromoTimeEnd, newPromoTimeEnd);


// Regular chunk
const oldRegTags = \                                                                            {!hasSlots && <span className="no-slot-tag" style={{ marginLeft: '4px' }}>NO SLOT</span>}
                                                                            {hasSlots && allFull && <span className="full-tag" style={{ marginLeft: '4px' }}>FULL</span>}\;
const newRegTags = \                                                                            {!hasSlots && <span style={{ fontSize: '0.55rem', fontWeight: '800', padding: '2px 5px', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#94a3b8', marginLeft: '4px', whiteSpace: 'nowrap' }}>NO SLOT</span>}
                                                                            {hasSlots && allFull && <span style={{ fontSize: '0.55rem', fontWeight: '800', padding: '2px 5px', borderRadius: '4px', backgroundColor: '#fee2e2', color: '#ef4444', marginLeft: '4px', whiteSpace: 'nowrap' }}>FULL</span>}\;
content = content.replace(oldRegTags, newRegTags);

const oldRegTime = \                                                                        {hasSlots && (
                                                                             hasMultiple ? (
                                                                                 <select 
                                                                                     className="session-mini-select"\;

const oldRegTimeEnd = \                                                                                 </select>
                                                                             ) : (
                                                                                 <div className="session-sub-time" style={{ textTransform: 'lowercase', marginTop: '0', fontSize: '0.55rem', opacity: 0.8 }}>
                                                                                     {slots[0].time_range.replace(/ - /g, ' / ').replace(/ AM/ig, 'am').replace(/ PM/ig, 'pm')}
                                                                                 </div>
                                                                             )
                                                                        )}\;

const newRegTime = \                                                                        {hasSlots && hasMultiple ? (
                                                                                 <select 
                                                                                     className="session-mini-select"\;

const newRegTimeEnd = \                                                                                 </select>
                                                                        ) : (
                                                                            <div className="session-sub-time" style={{ textTransform: 'lowercase', marginTop: '0', fontSize: '0.55rem', opacity: (!hasSlots || allFull) ? 0.5 : 0.8 }}>
                                                                                {hasSlots ? slots[0].time_range.replace(/ - /g, ' / ').replace(/ AM/ig, 'am').replace(/ PM/ig, 'pm') : (label === 'Morning' ? '8:00am / 12:00pm' : label === 'Afternoon' ? '1:00pm / 5:00pm' : '8:00am / 5:00pm')}
                                                                            </div>
                                                                        )}\;

content = content.replace(oldRegTime, newRegTime);
content = content.replace(oldRegTimeEnd, newRegTimeEnd);

fs.writeFileSync(file, content);
console.log('Done replacement');
