const fs = require('fs');
const path = require('path');

const paymentPath = path.join(__dirname, 'src/pages/Payment.jsx');
let paymentCode = fs.readFileSync(paymentPath, 'utf8');

// Replace activeCart[0] payload in createPayment
const newPayloadLogic = `        paymentResponse = await starpayAPI.createPayment({
          cartItems: activeCart.map(item => ({
             courseId: item.id,
             branchId: preSelectedBranch?.id,
             courseCategory: item.category,
             courseType: item.type,
             scheduleSlotId: item.category !== 'PDC' ? scheduleSelection.slot : scheduleSelection.pdcSelections?.[item.id]?.slot,
             scheduleSlotId2: item.category !== 'PDC' ? scheduleSelection.slot2 : scheduleSelection.pdcSelections?.[item.id]?.slot2
          })),
          amount: finalAmount,
          paymentType: paymentType === 'full' ? 'Full Payment' : 'Downpayment',
          hasReviewer: totalsData.reviewerTotal > 0,
          hasVehicleTips: totalsData.vehicleTipsTotal > 0,
          attach: activeCart.map(i => i.shortName || i.name).join(', ').slice(0, 92) + \` | \${paymentType === 'full' ? 'Full' : 'Downpayment'}\`,
        })`;

const oldPayloadRegex = /paymentResponse = await starpayAPI\.createPayment\(\{[\s\S]*?\}\)/;
if (oldPayloadRegex.test(paymentCode)) {
    paymentCode = paymentCode.replace(oldPayloadRegex, newPayloadLogic);
    console.log('[OK] Payment.jsx createPayment patched.');
} else {
    console.log('[FAIL] Could not find createPayment payload in Payment.jsx');
}

fs.writeFileSync(paymentPath, paymentCode);

const schedulePath = path.join(__dirname, 'src/pages/Schedule.jsx');
let scheduleCode = fs.readFileSync(schedulePath, 'utf8');

// Swap global PDC tracking to object mapping
const oldStateRegex = /const \[pdcDate, setPdcDate\] = useState\(null\);?[\s\n]+const \[pdcSlot, setPdcSlot\] = useState\(null\);?[\s\n]+const \[pdcSlotDetails, setPdcSlotDetails\] = useState\(null\);?[\s\n]+const \[pdcDate2, setPdcDate2\] = useState\(null\);?[\s\n]+const \[pdcSlot2, setPdcSlot2\] = useState\(null\);?[\s\n]+const \[pdcSlotDetails2, setPdcSlotDetails2\] = useState\(null\);?/;

if (oldStateRegex.test(scheduleCode)) {
    scheduleCode = scheduleCode.replace(oldStateRegex, `const [pdcSelections, setPdcSelections] = useState({});\n  const pdcCourses = cart.filter(item => item.category === 'PDC' || (item.name && item.name.toUpperCase().includes('PDC')));`);
    console.log('[OK] Schedule.jsx state declarations patched.');
}

fs.writeFileSync(schedulePath, scheduleCode);
console.log('Patch script run complete. Please verify the builds.');
