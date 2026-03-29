const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { createRepayment, queryRepayment, verifySignature } = require('../utils/starpayService');
const { sendGuestEnrollmentEmail, sendAddonsEmail } = require('../utils/emailService');

/* ─────────────────────────────────────────────────────────────────────
   POST /api/starpay/create-payment
   Body: { courseId, branchId, courseCategory, courseType, amount,
           paymentType, attach?, scheduleSlotId?, scheduleSlotId2? }

   Creates a pending booking and calls StarPay to get a QRPh codeUrl.
   The frontend renders codeUrl as a QR for the student to scan.
 ───────────────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────────────
   INTERNAL HELPER: cleanupExpiredReservations
   Finds bookings that stayed 'pending' for > 20 minutes without success
   and releases their reserved slots back to the available pool.
  ───────────────────────────────────────────────────────────────────── */
const cleanupExpiredReservations = async (client) => {
    try {
        const expiredMinutes = 20;
        const { rows: expired } = await client.query(
            `UPDATE bookings 
                SET status = 'cancelled'
              WHERE status = 'pending' 
                AND created_at < NOW() - INTERVAL '${expiredMinutes} minutes'
              RETURNING id, notes`,
        );

        for (const row of expired) {
            try {
                const meta = JSON.parse(row.notes || '{}');
                for (const key of ['scheduleSlotId', 'scheduleSlotId2']) {
                    if (meta[key]) {
                        await client.query(
                            `UPDATE schedule_slots 
                                SET available_slots = available_slots + 1 
                              WHERE id = $1`,
                            [meta[key]]
                        );
                    }
                }
                console.log(`[StarPay] Reservation expired and released for booking ${row.id}`);
            } catch (jsonErr) {
                console.error(`[StarPay] Cleanup JSON parse error for booking ${row.id}:`, jsonErr.message);
            }
        }
    } catch (err) {
        console.error('[StarPay] cleanupExpiredReservations error:', err.message);
    }
};

const initiatePayment = async (req, res) => {
    const userId = req.user.id;
    const {
        courseId,
        branchId,
        courseCategory,
        courseType,
        amount,
        paymentType = 'Full Payment',
        attach,
        scheduleSlotId,
        scheduleSlotId2,
    } = req.body;

    if (!courseId || !amount) {
        return res.status(400).json({ success: false, message: 'courseId and amount are required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Self-cleaning: release any old stuck reservations
        await cleanupExpiredReservations(client);

        // 1. ATOMIC SLOT RESERVATION
        // Hold the slots while the user is paying. 
        // If the slot count is 0, the UPDATE will return 0 rows.
        for (const slotId of [scheduleSlotId, scheduleSlotId2]) {
            if (!slotId) continue;

            const resResult = await client.query(
                `UPDATE schedule_slots 
                    SET available_slots = available_slots - 1 
                  WHERE id = $1 AND available_slots > 0 
                  RETURNING id`,
                [slotId]
            );

            if (resResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({ 
                    success: false, 
                    message: 'Sorry, this schedule slot was just filled by another student. Please select a different time.' 
                });
            }
        }

        // Unique message ID = our order reference
        const msgId = `MDS${Date.now()}U${userId}`;

        // Store info in notes for webhook/sync logic
        const notesPayload = JSON.stringify({
            source: 'starpay',
            scheduleSlotId: scheduleSlotId || null,
            scheduleSlotId2: scheduleSlotId2 || null,
            hasReviewer: req.body.hasReviewer || false,
            hasVehicleTips: req.body.hasVehicleTips || false,
        });

        // Insert pending booking (slots are already decremented!)
        const { rows } = await client.query(
            `INSERT INTO bookings
               (user_id, course_id, branch_id, booking_date, booking_time,
                notes, total_amount, payment_type, payment_method, status, transaction_id)
             VALUES ($1,$2,$3,CURRENT_DATE,NULL,$4,$5,$6,'StarPay','pending',$7)
             RETURNING id`,
            [userId, courseId, branchId || null, notesPayload, amount, paymentType, msgId]
        );
        const bookingId = rows[0].id;

        await client.query('COMMIT');

        // Build callback URL
        const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
        const notifyUrl = `${backendUrl}/api/starpay/webhook`;

        // Create StarPay order
        const spResult = await createRepayment({
            msgId,
            notifyUrl,
            amountPhp: parseFloat(amount),
            attach: attach || `MDS Course: ${courseCategory || ''} ${courseType || ''}`.trim().slice(0, 92),
            branchId: branchId || null,
        });

        const spResponse = spResult?.response || spResult;

        if (!spResponse || spResponse.code !== '200') {
            // Rollback the local reservation if StarPay fails to even generate a QR
            await client.query('BEGIN');
            await client.query(`UPDATE bookings SET status='cancelled' WHERE id=$1`, [bookingId]);
            for (const slotId of [scheduleSlotId, scheduleSlotId2]) {
                if (slotId) {
                    await client.query(`UPDATE schedule_slots SET available_slots = available_slots + 1 WHERE id=$1`, [slotId]);
                }
            }
            await client.query('COMMIT');

            console.error('[StarPay] initiatePayment order failed:', spResponse?.message);
            return res.status(502).json({
                success: false,
                message: `StarPay error ${spResponse?.code || ''}: ${spResponse?.message || 'Order creation failed'}`,
            });
        }

        return res.json({
            success: true,
            codeUrl: spResponse.codeUrl,
            msgId,
            bookingId,
            trxState: spResponse.trxState,
            orderNo: spResponse.orderNo,
        });

    } catch (err) {
        await client.query('ROLLBACK').catch(() => { });
        console.error('[StarPay] initiatePayment error:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
};

/* ─────────────────────────────────────────────────────────────────────
   INTERNAL HELPER: fulfillBookingPayment
   Updates DB, enrolls student, sends emails. 
   Called by both webhook and checkStatus fallback.
  ───────────────────────────────────────────────────────────────────── */
const fulfillBookingPayment = async (originalMsgId, trxAmountCentavos, orderNo) => {
    const amountPhp = (trxAmountCentavos / 100).toFixed(2);

    // Mark booking paid and get schedule slot info
    const { rows } = await pool.query(
        `UPDATE bookings
            SET status       = 'paid',
                total_amount = $1,
                transaction_id = COALESCE($2, transaction_id)
          WHERE transaction_id = $3 AND status = 'pending'
          RETURNING id, user_id, notes`,
        [amountPhp, orderNo, originalMsgId]
    );

    if (!rows.length) return null;

    const { id: bookingId, user_id: studentId, notes } = rows[0];

    // Enroll student in schedule slots stored in notes
    try {
        const meta = JSON.parse(notes || '{}');
        for (const key of ['scheduleSlotId', 'scheduleSlotId2']) {
            if (meta[key]) {
                await pool.query(
                    `INSERT INTO schedule_enrollments (slot_id, student_id, enrollment_status)
                     VALUES ($1, $2, 'enrolled')
                     ON CONFLICT (slot_id, student_id) DO NOTHING`,
                    [meta[key], studentId]
                );
                /* 
                   Slot decrement removed here because it is now done 
                   upfront during initiatePayment (Reservation Logic).
                */
            }
        }

        // Handle reschedule fee payment
        if (meta.source === 'reschedule_fee' && meta.enrollmentId) {
            try {
                await pool.query(
                    `UPDATE schedule_enrollments
                        SET reschedule_fee_paid = TRUE,
                            walkin_payment_method = 'StarPay',
                            walkin_fee_amount = $2,
                            updated_at = CURRENT_TIMESTAMP
                      WHERE id = $1`,
                    [meta.enrollmentId, amountPhp]
                );
                console.log(`[StarPay] Reschedule fee marked paid for enrollment ${meta.enrollmentId}`);
            } catch (feeErr) {
                console.error('[StarPay] Reschedule fee update error:', feeErr.message);
            }
        }

        // Send enrollment email for guests
        if (meta.source === 'starpay_guest' && meta.guestData?.email) {
            const { firstName, lastName, email: gEmail, courseCategory, courseType, paymentType: pType } = meta.guestData;
            try {
                const [courseRow, bookingRow] = await Promise.all([
                    pool.query(
                        `SELECT c.name, br.name AS branch_name, br.address AS branch_address
                           FROM bookings b
                           JOIN courses c ON b.course_id = c.id
                           LEFT JOIN branches br ON b.branch_id = br.id
                          WHERE b.id = $1`, [bookingId]
                    ),
                    pool.query(
                        `SELECT s1.session AS session1, s1.time_range AS time1,
                                s2.session AS session2, s2.time_range AS time2
                           FROM bookings b
                           LEFT JOIN schedule_slots s1 ON s1.id = $2
                           LEFT JOIN schedule_slots s2 ON s2.id = $3
                          WHERE b.id = $1`, [bookingId, meta.scheduleSlotId, meta.scheduleSlotId2]
                    ),
                ]);
                const cr = courseRow.rows[0] || {};
                const sr = bookingRow.rows[0] || {};
                await sendGuestEnrollmentEmail(gEmail, firstName, lastName, {
                    courseName: cr.name || 'N/A',
                    courseCategory,
                    courseType,
                    branchName: cr.branch_name || 'N/A',
                    branchAddress: cr.branch_address || '',
                    scheduleDate: meta.scheduleDate,
                    scheduleSession: sr.session1 || 'N/A',
                    scheduleTime: sr.time1 || 'N/A',
                    scheduleDate2: meta.scheduleDate2 || null,
                    scheduleSession2: sr.session2 || null,
                    scheduleTime2: sr.time2 || null,
                    paymentMethod: 'StarPay',
                    amountPaid: amountPhp,
                    paymentStatus: pType || 'Full Payment',
                }, meta.hasReviewer, meta.hasVehicleTips);
                console.log(`[StarPay] Enrollment email sent to ${gEmail}`);
            } catch (emailErr) {
                console.error('[StarPay] Guest email failed:', emailErr.message);
            }
        }
    } catch (enrollErr) {
        console.error('[StarPay] Enrollment processing error:', enrollErr.message);
    }

    console.log(`[StarPay] Booking ${bookingId} fulfilled via sync/webhook (₱${amountPhp})`);
    return bookingId;
};

/* ─────────────────────────────────────────────────────────────────────
   POST /api/starpay/webhook
   StarPay POSTs { "request": {...}, "signature": "..." } here.
  ───────────────────────────────────────────────────────────────────── */
const handleWebhook = async (req, res) => {
    const { request: rawRequest, signature } = req.body || {};

    if (!rawRequest) {
        return res.status(400).json({ code: '400', message: 'missing request' });
    }

    let notifyRequest;
    try {
        notifyRequest = typeof rawRequest === 'string' ? JSON.parse(rawRequest) : rawRequest;
    } catch {
        return res.status(400).json({ code: '400', message: 'invalid request JSON' });
    }

    console.log('[StarPay] Webhook received:', rawRequest);

    if (!verifySignature(rawRequest, signature)) {
        console.warn('[StarPay] Webhook signature invalid');
        return res.status(400).json({ code: '400', message: 'invalid signature' });
    }

    const { originalMsgId, trxState, trxAmount, orderNo } = notifyRequest;
    const isPaid = trxState === 'SUCCESS';

    try {
        if (isPaid) {
            await fulfillBookingPayment(originalMsgId, trxAmount, orderNo);
        } else {
            // FAIL / REVERSED / CLOSE
            // Mark as cancelled and release slots
            const { rows: canceled } = await pool.query(
                `UPDATE bookings SET status='cancelled'
                  WHERE transaction_id=$1 AND status='pending'
                  RETURNING id, notes`,
                [originalMsgId]
            );

            if (canceled.length) {
                const meta = JSON.parse(canceled[0].notes || '{}');
                for (const key of ['scheduleSlotId', 'scheduleSlotId2']) {
                    if (meta[key]) {
                        await pool.query(
                            `UPDATE schedule_slots SET available_slots = available_slots + 1 
                              WHERE id = $1`,
                            [meta[key]]
                        );
                    }
                }
            }

            // Also clear enrollment link
            await pool.query(
                `UPDATE schedule_enrollments SET starpay_msgid = NULL, starpay_codeurl = NULL
                  WHERE starpay_msgid = $1`,
                [originalMsgId]
            );
            console.log(`[StarPay] Order ${originalMsgId} ${trxState} — cancelled/released`);
        }

        return res.json({ code: '200', message: 'success' });
    } catch (err) {
        console.error('[StarPay] Webhook error:', err.message);
        return res.status(500).json({ code: '500', message: 'server error' });
    }
};

/* ─────────────────────────────────────────────────────────────────────
   GET /api/starpay/status/:msgId
   Frontend polls this periodically after displaying the QR code.
 ───────────────────────────────────────────────────────────────────── */
const checkStatus = async (req, res) => {
    const { msgId } = req.params;

    // Check bookings table first (regular payments)
    const { rows } = await pool.query(
        `SELECT id, status, total_amount, branch_id FROM bookings WHERE transaction_id = $1`,
        [msgId]
    );

    if (rows.length) {
        const booking = rows[0];
        if (booking.status !== 'pending') {
            return res.json({
                success: true,
                localStatus: booking.status,
                starpayState: booking.status === 'paid' ? 'SUCCESS' : 'CLOSE',
                bookingId: booking.id,
                amount: booking.total_amount,
            });
        }
        // booking exists and is still pending — query StarPay
        try {
            const queryMsgId = `QRY${Date.now()}`;
            const spResult = await queryRepayment(queryMsgId, msgId, { branchId: booking.branch_id || null });
            const spResponse = spResult?.response || spResult;

            // FALLBACK: If StarPay says SUCCESS but we are still PENDING, fulfill it now.
            if (spResponse?.trxState === 'SUCCESS' && booking.status === 'pending') {
                console.log(`[StarPay] Fallback fulfillment triggered via checkStatus for ${msgId}`);
                await fulfillBookingPayment(msgId, spResponse.trxAmount, spResponse.orderNo);
            }

            return res.json({
                success: true,
                localStatus: spResponse?.trxState === 'SUCCESS' ? 'paid' : booking.status,
                starpayState: spResponse?.trxState || 'UNKNOWN',
                bookingId: booking.id,
                amount: booking.total_amount,
            });
        } catch (err) {
            console.error('[StarPay] checkStatus query error:', err.message);
            return res.json({ success: true, localStatus: booking.status, starpayState: 'UNKNOWN', bookingId: booking.id, amount: booking.total_amount });
        }
    }

    // Reschedule fee payments: no booking row — check schedule_enrollments
    const { rows: enrollRows } = await pool.query(
        `SELECT se.id, se.reschedule_fee_paid, ss.branch_id
           FROM schedule_enrollments se
           LEFT JOIN schedule_slots ss ON ss.id = se.slot_id
          WHERE se.starpay_msgid = $1`,
        [msgId]
    );

    if (enrollRows.length) {
        const enroll = enrollRows[0];
        if (enroll.reschedule_fee_paid) {
            return res.json({ success: true, localStatus: 'paid', starpayState: 'SUCCESS' });
        }
        // Still unpaid — query StarPay live
        try {
            const queryMsgId = `QRY${Date.now()}`;
            const spResult = await queryRepayment(queryMsgId, msgId, { branchId: enroll.branch_id || null });
            const spResponse = spResult?.response || spResult;

            if (spResponse?.trxState === 'SUCCESS') {
                await pool.query(
                    `UPDATE schedule_enrollments
                        SET reschedule_fee_paid = TRUE,
                            walkin_payment_method = 'StarPay',
                            walkin_fee_amount = $2,
                            updated_at = CURRENT_TIMESTAMP
                      WHERE id = $1`,
                    [enroll.id, (spResponse.trxAmount / 100).toFixed(2)]
                );
            }

            return res.json({
                success: true,
                localStatus: spResponse?.trxState === 'SUCCESS' ? 'paid' : 'pending',
                starpayState: spResponse?.trxState || 'UNKNOWN'
            });
        } catch (err) {
            console.error('[StarPay] checkStatus enroll query error:', err.message);
            return res.json({ success: true, localStatus: 'pending', starpayState: 'UNKNOWN' });
        }
    }

    return res.status(404).json({ success: false, message: 'Order not found' });
};

/* ─────────────────────────────────────────────────────────────────────
   POST /api/starpay/guest-create-payment  (no auth required)
   Body: all guest personal fields + courseId, branchId, scheduleSlotId,
         scheduleSlotId2, scheduleDate, courseCategory, courseType,
         amount, paymentType, attach?

   Creates a guest user account + pending booking, then calls StarPay.
   On webhook SUCCESS the booking is marked paid, student is enrolled
   in schedule slots, and an enrollment email is sent.
 ───────────────────────────────────────────────────────────────────── */
const initiateGuestPayment = async (req, res) => {
    const {
        // Personal info
        firstName, middleName, lastName, email,
        address, age, gender, birthday, birthPlace,
        nationality, maritalStatus, contactNumbers, zipCode,
        emergencyContactPerson, emergencyContactNumber,
        // Course / schedule
        courseId, branchId, courseCategory, courseType,
        scheduleSlotId, scheduleSlotId2, scheduleDate, scheduleDate2,
        // Payment
        amount, paymentType = 'Full Payment', attach,
    } = req.body;

    if (!courseId || !amount || !email || !firstName || !lastName || !contactNumbers) {
        return res.status(400).json({ success: false, message: 'Required fields are missing.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Clean stale reservations
        await cleanupExpiredReservations(client);

        // 1. ATOMIC SLOT RESERVATION
        const parsedBranchId = branchId ? parseInt(branchId, 10) : null;
        for (const slotId of [scheduleSlotId, scheduleSlotId2]) {
            if (!slotId) continue;

            const resResult = await client.query(
                `UPDATE schedule_slots 
                    SET available_slots = available_slots - 1 
                  WHERE id = $1 AND available_slots > 0 
                  RETURNING id`,
                [slotId]
            );

            if (resResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({ 
                    success: false, 
                    message: 'Sorry, this schedule slot was just filled. Please choose a different session.' 
                });
            }
        }

        // Reject if email is already registered
        const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: 'An account with this email already exists. Please sign in to pay online.',
            });
        }

        // Create guest student account
        const randomPassword = require('crypto').randomBytes(12).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        const userResult = await client.query(
            `INSERT INTO users (
                first_name, middle_name, last_name, email, password,
                address, age, gender, birthday, birth_place,
                nationality, marital_status, contact_numbers, zip_code,
                emergency_contact_person, emergency_contact_number,
                is_verified, role, status
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,true,'student','active')
             RETURNING id`,
            [
                firstName, middleName || null, lastName, email, hashedPassword,
                address, age, gender, birthday, birthPlace,
                nationality, maritalStatus, contactNumbers, zipCode,
                emergencyContactPerson, emergencyContactNumber,
            ]
        );
        const userId = userResult.rows[0].id;

        const msgId = `MDS${Date.now()}G${userId}`;

        // Store info in notes
        const notesPayload = JSON.stringify({
            source: 'starpay_guest',
            scheduleSlotId: scheduleSlotId || null,
            scheduleSlotId2: scheduleSlotId2 || null,
            scheduleDate: scheduleDate || null,
            scheduleDate2: scheduleDate2 || null,
            hasReviewer: req.body.hasReviewer || false,
            hasVehicleTips: req.body.hasVehicleTips || false,
            guestData: { firstName, lastName, email, courseCategory, courseType, paymentType },
        });

        const bookingResult = await client.query(
            `INSERT INTO bookings
               (user_id, course_id, branch_id, booking_date, booking_time,
                notes, total_amount, payment_type, payment_method, status,
                transaction_id, enrollment_type, course_type)
             VALUES ($1,$2,$3,CURRENT_DATE,NULL,$4,$5,$6,'StarPay','pending',$7,'guest',$8)
             RETURNING id`,
            [userId, courseId, parsedBranchId, notesPayload, amount, paymentType, msgId, courseType]
        );
        const bookingId = bookingResult.rows[0].id;

        await client.query('COMMIT');

        // StarPay call
        const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
        const notifyUrl = `${backendUrl}/api/starpay/webhook`;

        const spResult = await createRepayment({
            msgId,
            notifyUrl,
            amountPhp: parseFloat(amount),
            attach: attach || `MDS ${courseCategory || ''} ${courseType || ''}`.trim().slice(0, 92),
            branchId: parsedBranchId || null,
        });

        const spResponse = spResult?.response || spResult;

        if (!spResponse || spResponse.code !== '200') {
            await client.query('BEGIN');
            await client.query(`UPDATE bookings SET status='cancelled' WHERE id=$1`, [bookingId]);
            for (const slotId of [scheduleSlotId, scheduleSlotId2]) {
                if (slotId) {
                    await client.query(`UPDATE schedule_slots SET available_slots = available_slots + 1 WHERE id=$1`, [slotId]);
                }
            }
            await client.query('COMMIT');

            console.error('[StarPay] guest initiate failed:', spResponse?.message);
            return res.status(502).json({
                success: false,
                message: `StarPay error: ${spResponse?.message || 'Order creation failed'}`,
            });
        }

        return res.json({
            success: true,
            codeUrl: spResponse.codeUrl,
            msgId,
            bookingId,
        });

    } catch (err) {
        await client.query('ROLLBACK').catch(() => { });
        console.error('[StarPay] initiateGuestPayment error:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
};

/* ─────────────────────────────────────────────────────────────────────
   POST /api/starpay/reschedule-fee/:enrollmentId
   Logged-in student pays the ₱1,000 no-show reschedule fee via StarPay.
   No booking record is created here — it is only created after the
   student has also selected a new schedule date (rescheduleEnrollment).
 ───────────────────────────────────────────────────────────────────── */
const initiateRescheduleFeePayment = async (req, res) => {
    const { enrollmentId } = req.params;
    const userId = req.user.id;

    try {
        // Verify enrollment belongs to this student and is no-show
        const enrollResult = await pool.query(
            `SELECT se.id, se.student_id, se.enrollment_status, se.reschedule_fee_paid,
                    se.starpay_msgid, se.starpay_codeurl, ss.branch_id
             FROM schedule_enrollments se
             JOIN schedule_slots ss ON ss.id = se.slot_id
             WHERE se.id = $1 AND se.student_id = $2`,
            [enrollmentId, userId]
        );

        if (enrollResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Enrollment not found' });
        }

        const enroll = enrollResult.rows[0];
        if (enroll.enrollment_status !== 'no-show') {
            return res.status(400).json({ success: false, message: 'Enrollment is not marked as no-show' });
        }
        if (enroll.reschedule_fee_paid) {
            return res.status(400).json({ success: false, message: 'Reschedule fee already paid' });
        }

        // Reuse existing StarPay order if we already have one stored on the enrollment
        if (enroll.starpay_codeurl && enroll.starpay_msgid) {
            return res.json({
                success: true,
                codeUrl: enroll.starpay_codeurl,
                msgId: enroll.starpay_msgid,
            });
        }

        // ── Call StarPay — store msgId/codeUrl on enrollment row (no booking insert) ──
        const msgId = `RFEE${Date.now()}U${userId}`;
        const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
        const notifyUrl = `${backendUrl}/api/starpay/webhook`;

        const spResult = await createRepayment({
            msgId,
            notifyUrl,
            amountPhp: 1000,
            attach: 'MDS Reschedule Fee',
            branchId: enroll.branch_id || null,
        });

        const spResponse = spResult?.response || spResult;

        if (!spResponse || spResponse.code !== '200') {
            console.error('[StarPay] reschedule fee order failed:', spResponse?.code, spResponse?.message);

            if (spResponse?.code === '511') {
                return res.status(409).json({
                    success: false,
                    message: 'A payment session is still active on StarPay. Please wait about 15 minutes for it to expire, then try again.',
                    waitMinutes: 15,
                });
            }

            return res.status(502).json({
                success: false,
                message: `StarPay error: ${spResponse?.message || 'Order creation failed'}`,
            });
        }

        // Save msgId + codeUrl on the enrollment so we can track status without a booking row
        await pool.query(
            `UPDATE schedule_enrollments SET starpay_msgid = $1, starpay_codeurl = $2 WHERE id = $3`,
            [msgId, spResponse.codeUrl, enrollmentId]
        );

        return res.json({
            success: true,
            codeUrl: spResponse.codeUrl,
            msgId,
        });

    } catch (err) {
        console.error('[StarPay] initiateRescheduleFeePayment error:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = { initiatePayment, initiateGuestPayment, handleWebhook, checkStatus, initiateRescheduleFeePayment };
