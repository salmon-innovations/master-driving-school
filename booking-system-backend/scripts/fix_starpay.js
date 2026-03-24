const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', 'controllers', 'starpayController.js');
let code = fs.readFileSync(targetPath, 'utf-8');

const targetString = "console.log(`[StarPay] Booking ${bookingId} marked paid";

const addonsLogic = `
                // --- Inject Add-ons Email ---
                if (meta.hasReviewer || meta.hasVehicleTips) {
                    try {
                        const studentUser = await pool.query('SELECT email, first_name, last_name FROM users WHERE id = $1', [studentId]);
                        if (studentUser.rows.length > 0) {
                            const { email: stEmail, first_name: stFName, last_name: stLName } = studentUser.rows[0];
                            await sendAddonsEmail(stEmail, stFName, stLName, meta.hasReviewer, meta.hasVehicleTips);
                            console.log(\`[StarPay] Addons email sent to \${stEmail}\`);
                        }
                    } catch (addonErr) {
                        console.error('[StarPay] Addons email failed:', addonErr.message);
                    }
                }
                // ----------------------------
                \${targetString}`;

if (code.includes('console.log(`[StarPay] Booking ${bookingId} marked paid') && !code.includes('// --- Inject Add-ons Email ---')) {
    code = code.replace('console.log(`[StarPay] Booking ${bookingId} marked paid', addonsLogic);
    console.log("Successfully inserted Addons Logic");
} else {
    console.log("Could not find insertion point or already inserted");
}

fs.writeFileSync(targetPath, code, 'utf-8');

code = code.replace("const { sendGuestEnrollmentEmail } = require('../utils/emailService');", "const { sendGuestEnrollmentEmail, sendAddonsEmail } = require('../utils/emailService');"); fs.writeFileSync(targetPath, code, 'utf-8');
