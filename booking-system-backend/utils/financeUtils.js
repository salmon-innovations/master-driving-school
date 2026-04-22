/**
 * Centralized utility for parsing and calculating financial data from bookings.
 * This guarantees consistency between the frontend admin dashboard and the backend analytics.
 */

const parseBookingFinancials = (rawAmount, notes) => {
    let notesJson = null;
    if (typeof notes === 'object' && notes !== null) {
        notesJson = notes;
    } else if (typeof notes === 'string' && notes.trim().startsWith('{')) {
        try {
            notesJson = JSON.parse(notes);
        } catch (e) {
            // Ignore format errors silently
        }
    }

    let addonRevenue = 0;
    let convenienceFee = 0;
    let saturdaySurcharge = 0;

    if (notesJson) {
        if (Array.isArray(notesJson.addonsDetailed)) {
            addonRevenue = notesJson.addonsDetailed.reduce((sum, addon) => {
                const p = Number(addon?.price);
                return sum + (Number.isFinite(p) ? p : 0);
            }, 0);
        }
        
        const conv = Number(notesJson.convenienceFee);
        if (Number.isFinite(conv)) {
            convenienceFee = conv;
        }

        const sat = Number(notesJson.saturdaySurcharge);
        if (Number.isFinite(sat)) {
            saturdaySurcharge = sat;
        }
    }

    const tAmt = Number(rawAmount);
    const amount = Number.isFinite(tAmt) ? tAmt : 0;
    
    // Ensure course revenue doesn't go below 0 (for partial payments that are less than add-ons + fees)
    const courseRevenue = Math.max(0, amount - addonRevenue - convenienceFee - saturdaySurcharge);

    return {
        amount,
        courseRevenue,
        addonRevenue,
        convenienceFee,
        saturdaySurcharge,
        notesJson
    };
};

const calculateSaturdaySurcharge = (pdcSchedules) => {
    if (!Array.isArray(pdcSchedules)) return 0;
    
    let totalSurcharge = 0;
    pdcSchedules.forEach(s => {
        // Only PDC courses attract the surcharge
        // Day 1
        if (s.pdcDate || s.scheduleDate) {
            const date = new Date(s.pdcDate || s.scheduleDate);
            if (date.getDay() === 6) { // 6 is Saturday
                totalSurcharge += 150;
            }
        }
        // Day 2
        if (s.pdcDate2 || s.promoPdcDate2 || s.scheduleDate2) {
            const date2 = new Date(s.pdcDate2 || s.promoPdcDate2 || s.scheduleDate2);
            if (date2.getDay() === 6) {
                totalSurcharge += 150;
            }
        }
    });
    
    return totalSurcharge;
};

module.exports = {
    parseBookingFinancials,
    calculateSaturdaySurcharge
};
