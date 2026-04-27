const pool = require('../config/db');
const { bustCache } = require('../config/db');
const { createRepayment, queryRepayment, verifySignature } = require('../utils/starpayService');
const { sendEnrollmentEmail, sendAddonsEmail } = require('../utils/emailService');
const { calculateSaturdaySurcharge } = require('../utils/financeUtils');

// Short-lived in-memory set of msgIds fulfilled in the last 30 seconds.
// Lets the very first poll after fulfillment short-circuit without querying StarPay.
const recentlyFulfilled = new Map(); // msgId -> expireAt timestamp
const FULFILLED_TTL_MS = 30_000;
const markFulfilled = (msgId) => {
    recentlyFulfilled.set(msgId, Date.now() + FULFILLED_TTL_MS);
    // Clean up stale entries
    const now = Date.now();
    for (const [k, exp] of recentlyFulfilled.entries()) {
        if (exp < now) recentlyFulfilled.delete(k);
    }
};
const wasFulfilled = (msgId) => {
    const exp = recentlyFulfilled.get(msgId);
    if (!exp) return false;
    if (Date.now() > exp) { recentlyFulfilled.delete(msgId); return false; }
    return true;
};

/*
Payment lifecycle (authoritative status rules):

1) pending
    - Booking created, slots atomically reserved, waiting for StarPay success.

2) cancelled
    - StarPay expired/failed/reversed/closed OR pending timed out.
    - Reserved slots must be released.

3) partial_payment
    - Payment succeeded for Downpayment bookings.
    - Enrollment is valid, but remaining balance is still due.

4) paid
    - Payment succeeded for Full Payment bookings.

Notes:
- Do not keep successful Downpayment bookings in pending.
- pending is only for unpaid active StarPay sessions.
- checkStatus treats paid and partial_payment as successful terminal states.
*/

const extractSlotIdsFromMeta = (meta = {}) => {
    const slotIds = [];
    if (meta.scheduleSlotId) slotIds.push(meta.scheduleSlotId);
    if (meta.scheduleSlotId2) slotIds.push(meta.scheduleSlotId2);

    const pdcSelections = meta.pdcSelections || {};
    Object.values(pdcSelections).forEach((sel) => {
        if (sel?.pdcSlot) slotIds.push(sel.pdcSlot);
        if (sel?.pdcSlot2) slotIds.push(sel.pdcSlot2);
        if (sel?.slot) slotIds.push(sel.slot);
        if (sel?.slot2) slotIds.push(sel.slot2);
    });

    return [...new Set(slotIds.filter(Boolean).map(Number))];
};

const isPdcEnrollmentRequest = (payload = {}) => {
    const category = String(payload.courseCategory || '').toLowerCase();
    const courseType = String(payload.courseType || '').toLowerCase();
    const courseName = String(payload.courseName || '').toLowerCase();
    const list = Array.isArray(payload.courseList) ? payload.courseList : [];

    if (category === 'pdc') return true;
    if (courseName.includes('pdc')) return true;
    if (courseType.includes('pdc')) return true;

    return list.some((item) => {
        const itemCategory = String(item?.category || '').toLowerCase();
        const itemName = String(item?.name || '').toLowerCase();
        const itemType = String(item?.type || '').toLowerCase();
        return itemCategory === 'pdc' || itemName.includes('pdc') || itemType.includes('pdc');
    });
};

const hasIncompleteOnlineTdcBooking = async (userId) => {
    const result = await pool.query(
        `SELECT 1
           FROM bookings b
           JOIN courses c ON c.id = b.course_id
          WHERE b.user_id = $1
            AND LOWER(COALESCE(c.category, '')) = 'tdc'
            AND LOWER(COALESCE(b.course_type, '')) LIKE '%online%'
            AND LOWER(COALESCE(b.status, '')) NOT IN ('completed', 'cancelled')
          LIMIT 1`,
        [userId]
    );

    return result.rows.length > 0;
};

const GLOBAL_B1B2_DAILY_CAPACITY = 2;
const isB1B2CourseType = (courseType = '') => {
    const src = String(courseType || '').toLowerCase();
    return src.includes('b1') || src.includes('b2') || src.includes('van') || src.includes('l300');
};

const getGlobalB1B2BookedCount = async (client, date, excludeStudentId = null) => {
    const params = [date];
    let excludeClause = '';
    if (excludeStudentId) {
        params.push(excludeStudentId);
        excludeClause = ` AND se.student_id <> $${params.length}`;
    }

    const result = await client.query(
        `SELECT COUNT(DISTINCT se.student_id) AS booked_count
           FROM schedule_enrollments se
           JOIN schedule_slots ss ON ss.id = se.slot_id
          WHERE ss.date = $1
            AND (ss.course_type ILIKE '%B1%' OR ss.course_type ILIKE '%B2%' OR ss.course_type ILIKE '%VAN%' OR ss.course_type ILIKE '%L300%')
            AND se.enrollment_status NOT IN ('cancelled', 'no-show')
            ${excludeClause}`,
        params
    );

    return Number(result.rows[0]?.booked_count || 0);
};

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
                for (const slotId of extractSlotIdsFromMeta(meta)) {
                    await client.query(
                        `UPDATE schedule_slots 
                            SET available_slots = available_slots + 1 
                          WHERE id = $1`,
                        [slotId]
                    );
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
        courseTypePdc,
        courseTypeTdc,
        amount,
        paymentType = 'Full Payment',
        attach,
        scheduleSlotId,
        scheduleSlotId2,
        scheduleDate,
        scheduleDate2,
        scheduleSession,
        scheduleSession2,
        scheduleTime,
        scheduleTime2,
        pdcSelections,
        courseList,
        courseName,
        branchName,
        branchAddress,
        tdcScheduleLabel,
        promoPct = 0
    } = req.body;

    if (!courseId || !amount) {
        return res.status(400).json({ success: false, message: 'courseId and amount are required' });
    }

    if (isPdcEnrollmentRequest(req.body)) {
        const blocked = await hasIncompleteOnlineTdcBooking(userId);
        if (blocked) {
            return res.status(403).json({
                success: false,
                message: 'PDC enrollment is blocked. Your Online TDC must be marked Complete in CRM before enrolling in any PDC course.',
            });
        }
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Self-cleaning: release any old stuck reservations
        await cleanupExpiredReservations(client);

        const requestedSlotIds = [...new Set([scheduleSlotId, scheduleSlotId2].filter(Boolean).map(Number))];
        const slotMetaById = new Map();
        if (requestedSlotIds.length > 0) {
            const slotResult = await client.query(
                `SELECT id, date, course_type, branch_id
                   FROM schedule_slots
                  WHERE id = ANY($1::int[])
                  FOR UPDATE`,
                [requestedSlotIds]
            );

            slotResult.rows.forEach((row) => {
                slotMetaById.set(Number(row.id), row);
            });

            for (const slotId of requestedSlotIds) {
                const slotMeta = slotMetaById.get(Number(slotId));
                if (!slotMeta) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({
                        success: false,
                        message: `Selected schedule slot ${slotId} not found.`,
                    });
                }

                if (branchId && slotMeta.branch_id && Number(slotMeta.branch_id) !== Number(branchId)) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        success: false,
                        message: 'Selected schedule slot does not belong to the chosen branch.',
                    });
                }

                if (isB1B2CourseType(slotMeta.course_type)) {
                    const globalBooked = await getGlobalB1B2BookedCount(client, slotMeta.date, userId);
                    if (globalBooked >= GLOBAL_B1B2_DAILY_CAPACITY) {
                        await client.query('ROLLBACK');
                        return res.status(409).json({
                            success: false,
                            message: `The B1/B2 Van/L300 units are fully booked for ${slotMeta.date} across all branches.`,
                        });
                    }
                }
            }
        }

        // 1. ATOMIC SLOT RESERVATION
        // Hold the slots while the user is paying. 
        // If the slot count is 0, the UPDATE will return 0 rows.
        for (const slotId of requestedSlotIds) {
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

        const pdcSchedulesForSurcharge = Array.isArray(req.body.promoPdcSchedules) ? [...req.body.promoPdcSchedules] : [];
        if (String(req.body.courseCategory || '').toUpperCase() === 'PDC' && !req.body.isOnlineTdcNoSchedule) {
          pdcSchedulesForSurcharge.push({
            scheduleDate: req.body.scheduleDate,
            scheduleDate2: req.body.scheduleDate2
          });
        }

        // Store info in notes for webhook/sync logic
        const notesPayload = JSON.stringify({
            source: 'starpay',
            scheduleSlotId: scheduleSlotId || null,
            scheduleSlotId2: scheduleSlotId2 || null,
            scheduleDate: req.body.scheduleDate || null,
            scheduleDate2: req.body.scheduleDate2 || null,
            scheduleSession: req.body.scheduleSession || null,
            scheduleSession2: req.body.scheduleSession2 || null,
            scheduleTime: req.body.scheduleTime || null,
            scheduleTime2: req.body.scheduleTime2 || null,
            pdcSelections: req.body.pdcSelections || {},
            pdcCourseIds: Array.isArray(req.body.pdcCourseIds) ? req.body.pdcCourseIds.map(Number).filter(Number.isFinite) : [],
            noScheduleRequired: !!req.body.noScheduleRequired,
            isOnlineTdcNoSchedule: !!req.body.isOnlineTdcNoSchedule,
            pdcScheduleLockedUntilCompletion: !!req.body.pdcScheduleLockedUntilCompletion,
            pdcScheduleLockReason: req.body.pdcScheduleLockReason || null,
            courseList: Array.isArray(req.body.courseList) ? req.body.courseList : [],
            courseTypePdc: req.body.courseTypePdc || null,
            courseTypeTdc: req.body.courseTypeTdc || null,
            tdcScheduleLabel: req.body.tdcScheduleLabel || null,
            addonsDetailed: Array.isArray(req.body.addonsDetailed) ? req.body.addonsDetailed : [],
            subtotal: req.body.subtotal || 0,
            promoDiscount: req.body.promoDiscount || 0,
            promoPct: Number(promoPct || 0),
            convenienceFee: Number(req.body.convenienceFee || 0),
            saturdaySurcharge: Number(req.body.saturdaySurcharge || calculateSaturdaySurcharge(pdcSchedulesForSurcharge)),
            totalAmount: Number(req.body.totalAmount || req.body.finalTotal || req.body.grandTotal || 0),
            initialAmountPaid: Number(amount || 0),
            isManualBundle: !!req.body.isManualBundle,
            isTestMode: !!req.body.isTestMode,
            paymentType,
            hasReviewer: !!req.body.hasReviewer,
            hasVehicleTips: !!req.body.hasVehicleTips,
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
            console.log('[StarPay] DEBUG: Status for ' + msgId + ' returned trxState: ' + (spResponse ? spResponse.trxState : 'N/A'));

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
const fulfillBookingPayment = async (originalMsgId, trxAmountCentavos, orderNo, caller='unknown') => {
    console.log('[StarPay] fulfillBookingPayment CALLED by ' + caller + ' for ' + originalMsgId);
    console.log(`[StarPay] Fulfilling booking for transaction ${originalMsgId}. Test Mode: ${orderNo?.startsWith('TEST-')}`);
    const amountPhp = (trxAmountCentavos / 100).toFixed(2);

    // Fetch booking to check metadata for isTestMode
    const { rows: metaRows } = await pool.query(
        `SELECT notes FROM bookings WHERE transaction_id = $1`,
        [originalMsgId]
    );
    const meta = metaRows[0] ? JSON.parse(metaRows[0].notes || '{}') : {};

        // Mark booking based on payment type:
        // - Full Payment => paid
        // - Downpayment => partial_payment (remaining balance still due)
    const { rows } = await pool.query(
        `UPDATE bookings
                        SET status       = CASE
                                                                WHEN ($3 = TRUE) THEN 'paid'
                                                                WHEN LOWER(COALESCE(payment_type, '')) ~ 'down[\\s-]*payment'
                                                                    THEN 'partial_payment'
                                                                ELSE 'paid'
                                                             END,
                total_amount = $1,
                                        updated_at = CURRENT_TIMESTAMP
          WHERE transaction_id = $2 AND status = 'pending'
                    RETURNING id, user_id, notes, status`,
                                [amountPhp, originalMsgId, !!meta.isTestMode]
    );

    if (!rows.length) return null;

    const { id: bookingId, user_id: studentId, notes: notesRaw } = rows[0];
    console.log(`[StarPay] Booking ${bookingId} status updated to fulfilled.`);

    // Enroll student in schedule slots stored in notes
    try {
        // meta is already parsed at line 416

        for (const slotId of extractSlotIdsFromMeta(meta)) {
            await pool.query(
                `INSERT INTO schedule_enrollments (slot_id, student_id, enrollment_status)
                 VALUES ($1, $2, 'enrolled')
                 ON CONFLICT (slot_id, student_id) DO NOTHING`,
                [slotId, studentId]
            );
            /* 
               Slot decrement removed here because it is now done 
               upfront during initiatePayment (Reservation Logic).
            */
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

        // Send enrollment email for logged-in students
        if (meta.source === 'starpay' && studentId) {
            try {
                const pdcSelections = meta.pdcSelections || {};
                const pdcSlotIds = [];
                Object.values(pdcSelections).forEach((sel) => {
                    if (sel?.pdcSlot) pdcSlotIds.push(sel.pdcSlot);
                    if (sel?.pdcSlot2) pdcSlotIds.push(sel.pdcSlot2);
                    if (sel?.slot) pdcSlotIds.push(sel.slot);
                    if (sel?.slot2) pdcSlotIds.push(sel.slot2);
                });

                let pdcSlotLookup = {};
                if (pdcSlotIds.length) {
                    const { rows: pdcRows } = await pool.query(
                        `SELECT id, session, time_range FROM schedule_slots WHERE id = ANY($1::int[])`,
                        [[...new Set(pdcSlotIds.map(Number))]]
                    );
                    pdcSlotLookup = pdcRows.reduce((acc, row) => {
                        acc[row.id] = row;
                        return acc;
                    }, {});
                }

                const pdcSchedules = Object.values(pdcSelections).map((sel) => {
                    const slot1 = pdcSlotLookup[sel?.pdcSlot || sel?.slot] || {};
                    const slot2 = pdcSlotLookup[sel?.pdcSlot2 || sel?.slot2] || {};
                    return {
                        label: sel?.label || sel?.courseName || 'PDC',
                        courseName: sel?.courseName || 'PDC',
                        courseType: sel?.courseType || sel?.courseTypeDetailed || '',
                        transmission: sel?.transmission || null,
                        scheduleDate: sel?.pdcDate || sel?.date || null,
                        scheduleSession: slot1.session || sel?.pdcSlotDetails?.session || sel?.slot?.session || null,
                        scheduleTime: slot1.time_range || sel?.pdcSlotDetails?.time || sel?.pdcSlotDetails?.time_range || sel?.slot?.time_range || null,
                        scheduleDate2: sel?.pdcDate2 || sel?.date2 || null,
                        scheduleSession2: slot2.session || sel?.pdcSlotDetails2?.session || sel?.slot2?.session || null,
                        scheduleTime2: slot2.time_range || sel?.pdcSlotDetails2?.time || sel?.pdcSlotDetails2?.time_range || sel?.slot2?.time_range || null,
                    };
                }).filter((s) => s.scheduleDate);

                const { rows: detailsRows } = await pool.query(
                    `SELECT u.first_name, u.last_name, u.email,
                            c.name AS course_name, c.category AS course_category,
                            b.course_type,
                            br.name AS branch_name, br.address AS branch_address,
                            s1.date AS date1, s1.session AS session1, s1.time_range AS time1,
                            s2.date AS date2, s2.session AS session2, s2.time_range AS time2
                       FROM bookings b
                       JOIN users u ON u.id = b.user_id
                       JOIN courses c ON c.id = b.course_id
                       LEFT JOIN branches br ON br.id = b.branch_id
                       LEFT JOIN schedule_slots s1 ON s1.id = $2
                       LEFT JOIN schedule_slots s2 ON s2.id = $3
                      WHERE b.id = $1`,
                    [bookingId, meta.scheduleSlotId || null, meta.scheduleSlotId2 || null]
                );

                const d = detailsRows[0] || {};
                if (d.email) {
                        console.log(`[StarPay] Triggering enrollment email to: ${d.email} for student ${d.first_name}`);
                        // Dynamic 3% Multi-course discount fallback
                        const isManualBundle = !!meta.isManualBundle;
                        
                        let effectivePromo = Number(meta.promoDiscount || 0);
                        let effectivePromoPct = Number(meta.promoPct || 0);
                        
                        if (effectivePromo === 0 && isManualBundle) {
                            const subtotalForDynamic = Number(meta.subtotal || 0);
                            effectivePromo = Number((subtotalForDynamic * 0.03).toFixed(2));
                            effectivePromoPct = 3;
                        }

                        sendEnrollmentEmail(d.email, d.first_name || 'Student', d.last_name || '', {
                            bookingId,
                            courseName: d.course_name || 'N/A',
                            courseList: meta.courseList || [],
                            addonsDetailed: Array.isArray(meta.addonsDetailed) ? meta.addonsDetailed : [],
                            courseCategory: d.course_category || null,
                            courseType: d.course_type || null,
                            courseTypePdc: meta.courseTypePdc || null,
                            courseTypeTdc: meta.courseTypeTdc || null,
                            subtotal: Number(meta.subtotal || 0),
                            promoDiscount: effectivePromo,
                            promoPct: effectivePromoPct,
                            isManualBundle: isManualBundle,
                            convenienceFee: Number(meta.convenienceFee || 0),
                            totalAmount: Number(meta.totalAmount || meta.grandTotal || meta.finalTotal || 0),
                        tdcLabel: (() => {
                            const explicit = String(meta.tdcScheduleLabel || '').trim();
                            if (explicit) return explicit;
                            const ct = String(d.course_type || '').toUpperCase();
                            if (ct.includes('ONLINE')) return 'TDC Online';
                            if (ct.includes('F2F') || ct.includes('FACE TO FACE')) return 'TDC F2F';
                            return 'TDC';
                        })(),
                        branchName: d.branch_name || 'N/A',
                        branchAddress: d.branch_address || '',
                        scheduleDate: meta.scheduleDate || d.date1 || null,
                        scheduleSession: d.session1 || meta.scheduleSession || null,
                        scheduleTime: d.time1 || meta.scheduleTime || 'N/A',
                        scheduleDate2: meta.scheduleDate2 || d.date2 || null,
                        scheduleSession2: d.session2 || meta.scheduleSession2 || null,
                        scheduleTime2: d.time2 || meta.scheduleTime2 || null,
                        pdcSchedules,
                        pdcScheduleLockedUntilCompletion: !!meta.pdcScheduleLockedUntilCompletion,
                        pdcScheduleLockReason: meta.pdcScheduleLockReason || null,
                        paymentMethod: 'StarPay',
                        amountPaid: amountPhp,
                        paymentStatus: meta.paymentType || 'Full Payment',
                    }, meta.hasReviewer, meta.hasVehicleTips).catch(e => console.error('[StarPay] Async email error:', e.message));
                    console.log(`[StarPay] Enrollment email initiated in background for ${d.email}`);
                }
            } catch (emailErr) {
                console.error('[StarPay] Logged-in enrollment email failed:', emailErr.message);
            }
        }
    } catch (enrollErr) {
        console.error('[StarPay] Enrollment processing error:', enrollErr.message);
    }

    // --- BUST DASHBOARD CACHE LIVE ---
    try {
        bustCache('stats:super_admin:all', 'stats:admin:all');
        const userBranchRow = await pool.query('SELECT branch_id FROM users WHERE id = $1', [studentId]);
        if (userBranchRow.rows.length > 0 && userBranchRow.rows[0].branch_id) {
            bustCache(`stats:admin:${userBranchRow.rows[0].branch_id}`);
        }
    } catch (cacheErr) {
        console.error('[StarPay] Cache Bust error:', cacheErr.message);
    }

    console.log(`[StarPay] Booking ${bookingId} fulfilled via sync/webhook (₱${amountPhp})`);
    markFulfilled(originalMsgId);
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
            await fulfillBookingPayment(originalMsgId, trxAmount, orderNo, 'webhook');
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
                for (const slotId of extractSlotIdsFromMeta(meta)) {
                    await pool.query(
                        `UPDATE schedule_slots SET available_slots = available_slots + 1 
                          WHERE id = $1`,
                        [slotId]
                    );
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

    // Prevent Cloudflare / any CDN from caching these polling responses.
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Surrogate-Control', 'no-store');

    // Check bookings table first (regular payments)
    const { rows } = await pool.query(
        `SELECT id, status, total_amount, branch_id FROM bookings WHERE transaction_id = $1`,
        [msgId]
    );

    if (rows.length) {
        const booking = rows[0];
        if (booking.status !== 'pending') {
            const successfulLocalStatus = ['paid', 'partial_payment'].includes(String(booking.status || '').toLowerCase());
            const isCancelled = String(booking.status || '').toLowerCase() === 'cancelled';
            return res.json({
                success: true,
                localStatus: booking.status,
                starpayState: successfulLocalStatus ? 'SUCCESS' : (isCancelled ? 'CANCEL' : 'CLOSE'),
                bookingId: booking.id,
                amount: booking.total_amount,
            });
        }

        // Was just fulfilled by webhook/fallback? Short-circuit — DB write may still be
        // committing, but the next poll (1.5s later) will pick it up from the DB.
        if (wasFulfilled(msgId)) {
            return res.json({
                success: true,
                localStatus: 'paid',
                starpayState: 'SUCCESS',
                bookingId: booking.id,
                amount: booking.total_amount,
            });
        }

        // booking exists and is still pending — query StarPay
        try {
            const queryMsgId = `QRY${Date.now()}`;
            const spResult = await queryRepayment(queryMsgId, msgId, { branchId: booking.branch_id || null });
            const spResponse = spResult?.response || spResult;
            console.log('[StarPay] DEBUG: Status for ' + msgId + ' returned trxState: ' + (spResponse ? spResponse.trxState : 'N/A'));

            // FALLBACK: If StarPay says SUCCESS but we are still PENDING, fulfill it now
            // in the background so the response goes back to the frontend immediately.
            if (spResponse?.trxState === 'SUCCESS' && booking.status === 'pending') {
                console.log(`[StarPay] Fallback fulfillment triggered via checkStatus for ${msgId}`);
                markFulfilled(msgId); // mark now so next poll short-circuits
                fulfillBookingPayment(msgId, spResponse.trxAmount, spResponse.orderNo, 'poll-fallback')
                    .catch(e => console.error('[StarPay] Async fulfillment error:', e.message));
            }

            return res.json({
                success: true,
                localStatus: spResponse?.trxState === 'SUCCESS' ? (booking.payment_type === 'Full Payment' ? 'paid' : 'partial_payment') : booking.status,
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
        `SELECT se.id, se.reschedule_fee_paid, ss.branch_id AS slot_branch_id, ss.type,
                (
                  SELECT b.branch_id FROM bookings b 
                  LEFT JOIN courses c ON c.id = b.course_id
                  WHERE b.user_id = se.student_id 
                    AND b.status NOT IN ('cancelled')
                    AND (b.payment_type IS NULL OR b.payment_type NOT IN ('Reschedule Fee'))
                    AND LOWER(COALESCE(c.category, b.course_type, '')) = LOWER(ss.type)
                  ORDER BY b.created_at DESC 
                  LIMIT 1
                ) as booking_branch_id,
                (SELECT u.branch_id FROM users u WHERE u.id = se.student_id) AS user_branch_id
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
        // Still unpaid â€” query StarPay live
        try {
            const queryMsgId = `QRY${Date.now()}`;
            const branchIdToUse = enroll.booking_branch_id || enroll.user_branch_id || enroll.slot_branch_id || null;
            const spResult = await queryRepayment(queryMsgId, msgId, { branchId: branchIdToUse });
            const spResponse = spResult?.response || spResult;
            console.log('[StarPay] DEBUG: Status for ' + msgId + ' returned trxState: ' + (spResponse ? spResponse.trxState : 'N/A'));

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

    // Fallback path: older rows may have had transaction_id replaced by orderNo
    // after success. Query StarPay directly, then resolve by returned orderNo.
    try {
        const queryMsgId = `QRY${Date.now()}`;
        const spResult = await queryRepayment(queryMsgId, msgId);
        const spResponse = spResult?.response || spResult;
            console.log('[StarPay] DEBUG: Status for ' + msgId + ' returned trxState: ' + (spResponse ? spResponse.trxState : 'N/A'));
        const trxState = String(spResponse?.trxState || '').toUpperCase();

        if (trxState === 'SUCCESS') {
            const orderNo = spResponse?.orderNo;
            if (orderNo) {
                const { rows: orderRows } = await pool.query(
                    `SELECT id, status, total_amount FROM bookings WHERE transaction_id = $1 ORDER BY id DESC LIMIT 1`,
                    [orderNo]
                );

                if (orderRows.length) {
                    const booking = orderRows[0];
                    return res.json({
                        success: true,
                        localStatus: booking.status || 'paid',
                        starpayState: 'SUCCESS',
                        bookingId: booking.id,
                        amount: booking.total_amount,
                    });
                }
            }

            return res.json({ success: true, localStatus: 'paid', starpayState: 'SUCCESS' });
        }

        if (['FAIL', 'CLOSE', 'REVERSED', 'CANCEL'].includes(trxState)) {
            return res.json({ success: true, localStatus: 'cancelled', starpayState: trxState });
        }
    } catch (err) {
        console.error('[StarPay] checkStatus final fallback error:', err.message);
    }

    return res.status(404).json({ success: false, message: 'Order not found' });
};

/* ─────────────────────────────────────────────────────────────────────
   POST /api/starpay/simulate-success/:msgId
   Development/Testing helper to force a transaction to SUCCESS.
 ───────────────────────────────────────────────────────────────────── */
const simulateSuccess = async (req, res) => {
    const { msgId } = req.params;
    
    // Only allow in dev or if explicitly enabled
    const isDev = process.env.NODE_ENV !== 'production';
    const forceEnable = String(process.env.STARPAY_ENABLE_TEST_MODE || 'false').toLowerCase() === 'true';
    
    if (!isDev && !forceEnable) {
        return res.status(403).json({ success: false, message: 'Test mode is disabled in production.' });
    }

    try {
        const { rows } = await pool.query(
            `SELECT id, total_amount, payment_type FROM bookings WHERE transaction_id = $1 AND status = 'pending'`,
            [msgId]
        );

        if (!rows.length) {
            // Check if it's a reschedule fee
            const { rows: enrollRows } = await pool.query(
                `SELECT id FROM schedule_enrollments WHERE starpay_msgid = $1 AND reschedule_fee_paid = FALSE`,
                [msgId]
            );
            
            if (enrollRows.length) {
                await fulfillBookingPayment(msgId, 100000, `TEST-SIM-${Date.now()}`); // Mock 1000 PHP
                return res.json({ success: true, message: 'Reschedule fee simulated successfully.' });
            }

            return res.status(404).json({ success: false, message: 'Pending transaction not found.' });
        }

        const booking = rows[0];
        const amountCentavos = Math.round(Number(booking.total_amount) * 100);

        await fulfillBookingPayment(msgId, amountCentavos, `TEST-SIM-${Date.now()}`);

        return res.json({ success: true, message: 'Payment simulated successfully.' });
    } catch (err) {
        console.error('[StarPay] simulateSuccess error:', err.message);
        return res.status(500).json({ success: false, message: err.message });
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
                    se.starpay_msgid, se.starpay_codeurl, ss.branch_id AS slot_branch_id, ss.type,
                    (
                      SELECT b.branch_id FROM bookings b 
                      LEFT JOIN courses c ON c.id = b.course_id
                      WHERE b.user_id = se.student_id 
                        AND b.status NOT IN ('cancelled')
                        AND LOWER(COALESCE(c.category, b.course_type, '')) = LOWER(ss.type)
                      ORDER BY b.created_at DESC 
                      LIMIT 1
                    ) as booking_branch_id,
                    u.branch_id AS user_branch_id
             FROM schedule_enrollments se
             JOIN schedule_slots ss ON ss.id = se.slot_id
             JOIN users u ON u.id = se.student_id
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
        
        const feeAmount = (enroll.type || '').toLowerCase() === 'tdc' ? 300 : 1000;

        const spResult = await createRepayment({
            msgId,
            notifyUrl,
            amountPhp: feeAmount,
            attach: 'MDS Reschedule Fee',
            branchId: enroll.booking_branch_id || enroll.user_branch_id || enroll.slot_branch_id || null,
        });

        const spResponse = spResult?.response || spResult;
            console.log('[StarPay] DEBUG: Status for ' + msgId + ' returned trxState: ' + (spResponse ? spResponse.trxState : 'N/A'));

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

module.exports = { 
    initiatePayment, 
    handleWebhook, 
    checkStatus, 
    initiateRescheduleFeePayment,
    simulateSuccess
};
