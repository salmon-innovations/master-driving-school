/**
 * Reset Booking Data
 *
 * This script will:
 *   - Delete all data from booking-related tables ONLY
 *       • schedule_enrollments  (child of bookings + schedule_slots)
 *       • transactions          (child of bookings)
 *       • bookings              (parent of the above)
 *   - Reset their ID sequences back to 1
 *
 * PRESERVED (not touched):
 *   - users
 *   - courses
 *   - branches
 *   - schedules
 *   - schedule_slots
 *   - student_enrollments
 *   - cart_items
 *
 * Usage:
 *   node scripts/resetBookings.js
 */

const pool = require('../config/db');

const resetBookings = async () => {
    const client = await pool.connect();

    try {
        console.log('\n============================================');
        console.log('   BOOKING RESET SCRIPT');
        console.log('============================================\n');

        // ── Show counts before cleanup ──────────────────────────────────────
        const tablesToCheck = [
            'schedule_enrollments',
            'transactions',
            'bookings',
        ];

        console.log('Current record counts:');
        for (const table of tablesToCheck) {
            try {
                const r = await client.query(`SELECT COUNT(*) FROM ${table}`);
                console.log(`  ${table}: ${r.rows[0].count} records`);
            } catch {
                console.log(`  ${table}: (table not found – skipped)`);
            }
        }

        // ── Confirm before proceeding ───────────────────────────────────────
        console.log('\n⚠️  This will permanently delete all booking records.');
        console.log('   Users, courses, branches, and schedules are PRESERVED.\n');

        await client.query('BEGIN');

        // ── Delete order: children first ────────────────────────────────────
        const tablesToClean = [
            { table: 'schedule_enrollments', seq: 'schedule_enrollments_id_seq' },
            { table: 'transactions', seq: 'transactions_id_seq' },
            { table: 'bookings', seq: 'bookings_id_seq' },
        ];

        console.log('--- Deleting records ---\n');
        for (const { table } of tablesToClean) {
            try {
                const r = await client.query(`DELETE FROM ${table}`);
                console.log(`  ✓ Deleted from  ${table.padEnd(25)} → ${r.rowCount} rows removed`);
            } catch (err) {
                console.log(`  ⚠  ${table}: ${err.message} (skipped)`);
            }
        }

        // ── Reset sequences ─────────────────────────────────────────────────
        console.log('\n--- Resetting sequences ---\n');
        for (const { seq } of tablesToClean) {
            try {
                await client.query(`ALTER SEQUENCE ${seq} RESTART WITH 1`);
                console.log(`  ✓ Reset  ${seq.padEnd(35)} → next ID = 1`);
            } catch {
                console.log(`  ⚠  ${seq}: sequence not found (skipped)`);
            }
        }

        await client.query('COMMIT');

        // ── Verify ──────────────────────────────────────────────────────────
        console.log('\n--- Verification (post-reset counts) ---\n');
        for (const { table } of tablesToClean) {
            try {
                const r = await client.query(`SELECT COUNT(*) FROM ${table}`);
                console.log(`  ✓ ${table}: ${r.rows[0].count} records`);
            } catch {
                console.log(`  ⚠  ${table}: (skipped)`);
            }
        }

        console.log('\n============================================');
        console.log('   RESET COMPLETE');
        console.log('   Bookings / Transactions: CLEARED');
        console.log('   Schedule Enrollments:    CLEARED');
        console.log('   All sequences:           RESET TO 1');
        console.log('   Users / Courses / etc.:  PRESERVED');
        console.log('============================================\n');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('\n✗ Error during reset:', error.message);
        console.error('  All changes have been rolled back.\n');
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
};

resetBookings();
