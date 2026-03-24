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

        // Unique message ID = our order reference
        const msgId = `MDS${Date.now()}U${userId}`;

        // Store schedule slots in notes so webhook can enroll later
        const notesPayload = JSON.stringify({
            source: 'starpay',
            scheduleSlotId: scheduleSlotId || null,
            scheduleSlotId2: scheduleSlotId2 || null,
            hasReviewer: req.body.hasReviewer || false,
            hasVehicleTips: req.body.hasVehicleTips || false,
        });

        // Insert pending booking
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

        // Build webhook callback URL
        const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
        const notifyUrl = `${backendUrl}/api/starpay/webhook`;

        // Create StarPay repayment order → get QR code
        const spResult = await createRepayment({
            msgId,
            notifyUrl,
            amountPhp: parseFloat(amount),
            attach: attach || `MDS Course: ${courseCategory || ''} ${courseType || ''}`.trim().slice(0, 92),
            branchId: branchId || null,
        });

        const spResponse = spResult?.response || spResult;

        if (!spResponse || spResponse.code !== '200') {
            // Rollback booking
            await pool.query(`UPDATE bookings SET status='cancelled' WHERE id=$1`, [bookingId]);
            console.error('[StarPay] order failed — code:', spResponse?.code, 'message:', spResponse?.message);
            return res.status(502).json({
                success: false,
                message: `StarPay error ${spResponse?.code || ''}: ${spResponse?.message || 'Order creation failed'}`,
            });
        }

        return res.json({
            success: true,
            codeUrl: spResponse.codeUrl,   // QRPh string — render as QR on frontend
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
   POST /api/starpay/webhook
   StarPay POSTs { "request": {...}, "signature": "..." } here.
   No auth middleware — we verify RSA signature instead.
   Must respond with { "code": "200", "message": "success" }
 ───────────────────────────────────────────────────────────────────── */
const handleWebhook = async (req, res) => {
    const { request: rawRequest, signature } = req.body || {};

    if (!rawRequest) {
        return res.status(400).json({ code: '400', message: 'missing request' });
    }

    // Parse the request JSON string into an object for business logic
    let notifyRequest;
    try {
        notifyRequest = typeof rawRequest === 'string' ? JSON.parse(rawRequest) : rawRequest;
    } catch {
        return res.status(400).json({ code: '400', message: 'invalid request JSON' });
    }

    console.log('[StarPay] Webhook received:', rawRequest);

    // Verify RSA signature against the RAW string (not re-serialized object)
    if (!verifySignature(rawRequest, signature)) {
        console.warn('[StarPay] Webhook signature invalid');
        return res.status(400).json({ code: '400', message: 'invalid signature' });
    }

    const { originalMsgId, trxState, trxAmount, orderNo, mchId } = notifyRequest;
    const isPaid = trxState === 'SUCCESS';

    try {
        if (isPaid) {
            const amountPhp = (trxAmount / 100).toFixed(2);

            // Mark booking paid and get schedule slot info
            const { rows } = await pool.query(
                `UPDATE bookings
                    SET status       = 'paid',
                        total_amount = $1,
                        transaction_id = COALESCE($2, transaction_id)
                  WHERE transaction_id = $3
                  RETURNING id, user_id, notes`,
                [amountPhp, orderNo, originalMsgId]
            );

            if (rows.length) {
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
                            await pool.query(
                                `UPDATE schedule_slots
                                    SET available_slots = GREATEST(available_slots - 1, 0)
                                  WHERE id = $1`,
                                [meta[key]]
                            );
                        }
                    }

                    // Handle reschedule fee payment — only mark fee paid on enrollment.
                    // The booking record is created later when the student picks a new slot.
                    if (meta.source === 'reschedule_fee' && meta.enrollmentId) {
                        try {
                            await pool.query(
                                `UPDATE schedule_enrollments
                                    SET reschedule_fee_paid = TRUE,
                                        walkin_payment_method = 'StarPay',
                                        walkin_fee_amount = $2,
                                        updated_at = CURRENT_TIMESTAMP
                                  WHERE id = $1`,
                                [meta.enrollmentId, (trxAmount / 100).toFixed(2)]
                            );
                            console.log(`[StarPay] Reschedule fee marked paid for enrollment ${meta.enrollmentId}`);
                        } catch (feeErr) {
                            console.error('[StarPay] Reschedule fee update error (non-fatal):', feeErr.message);
                        }
                    }

                    // Send enrollment email for guests who paid via StarPay
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
                            console.error('[StarPay] Guest email failed (non-fatal):', emailErr.message);
                        }
                    }
                } catch (enrollErr) {
                    console.error('[StarPay] Enrollment error (non-fatal):', enrollErr.message);
                }

                
                
                console.log(`[StarPay] Booking ${bookingId} marked paid (₱${amountPhp})`);
            }
        } else {
            // FAIL / REVERSED / CLOSE
            // Cancel any regular pending booking for this msgId
            await pool.query(
                `UPDATE bookings SET status='cancelled'
                  WHERE transaction_id=$1 AND status='pending'`,
                [originalMsgId]
            );
            // Also clear the starpay order from the enrollment (so student can retry)
            await pool.query(
                `UPDATE schedule_enrollments SET starpay_msgid = NULL, starpay_codeurl = NULL
                  WHERE starpay_msgid = $1`,
                [originalMsgId]
            );
            console.log(`[StarPay] Order ${originalMsgId} ${trxState} — cancelled/cleared`);
        }

        // StarPay expects exactly this response
        return res.json({ code: '200', message: 'success' });

    } catch (err) {
        console.error('[StarPay] Webhook DB error:', err.message);
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
            return res.json({
                success: true,
                localStatus: booking.status,
                starpayState: spResponse?.trxState || 'UNKNOWN',
                bookingId: booking.id,
                amount: booking.total_amount,
            });
        } catch {
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
            return res.json({ success: true, localStatus: 'pending', starpayState: spResponse?.trxState || 'UNKNOWN' });
        } catch {
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

        // Reject if email is already registered
        const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: 'An account with this email already exists. Please sign in to pay online.',
            });
        }

        // Create guest student account (random unusable password)
        const randomPassword = require('crypto').randomBytes(12).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);
        const parsedBranchId = branchId ? parseInt(branchId, 10) : null;

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

        // Store everything needed by the webhook to enroll + email
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

        // Call StarPay — if it fails we cancel the booking (user account stays)
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
            await pool.query(`UPDATE bookings SET status='cancelled' WHERE id=$1`, [bookingId]);
            console.error('[StarPay] guest order failed — code:', spResponse?.code, 'message:', spResponse?.message);
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
