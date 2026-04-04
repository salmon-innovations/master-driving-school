const fs = require('fs');
let c = fs.readFileSync('src/admin/Schedule.jsx', 'utf8');

c = c.replace(/title="Confirm ?1,000 /g, 'title={Confirm ?{selectedSlot?.type?.toLowerCase() === \'tdc\' ? \'300\' : \'1,000\'} ');
c = c.replace(/Confirm ?1,000 no-show fee has been collected"/g, 'no-show fee has been collected}'); 

c = c.replace(/Mark Fee Paid \(?1,000\)/g, 'Mark Fee Paid (?{selectedSlot?.type?.toLowerCase() === \'tdc\' ? \'300\' : \'1,000\'})');

c = c.replace(/pay the ?1,000 no-show fee first'/g, 'pay the ? no-show fee first');

c = c.replace(/'Student must pay the ?/, 'Student must pay the ?'); // fixes previous match that didn't have template backtick

c = c.replace(/<strong>?1,000 fee<\/strong>/g, '<strong>?{selectedSlot?.type?.toLowerCase() === \'tdc\' ? \'300\' : \'1,000\'} fee</strong>');

c = c.replace(/Walk-in ?1,000 /, 'Walk-in ?{feePayModal?.amount || \'1,000\'} ');

fs.writeFileSync('src/admin/Schedule.jsx', c);
console.log('done')
