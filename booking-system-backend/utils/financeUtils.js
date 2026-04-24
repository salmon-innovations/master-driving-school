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
    // Surcharge is now embedded in the course price on the frontend.
    // This function now returns 0 to avoid double-charging or separate line items.
    return 0;
};

module.exports = {
    parseBookingFinancials,
    calculateSaturdaySurcharge
};
