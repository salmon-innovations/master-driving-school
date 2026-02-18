/**
 * Clean All Database Data (except Users)
 * 
 * This script will:
 * - Delete all data from every table EXCEPT users
 * - Reset all ID sequences back to 1
 * - Keep users table and its sequence untouched
 * 
 * Usage: node scripts/cleanDatabase.js
 */

const pool = require('../config/db');

const cleanDatabase = async () => {
    const client = await pool.connect();

    try {
        console.log('\n========================================');
        console.log('   DATABASE CLEANUP SCRIPT');
        console.log('========================================\n');

        // Show current record counts before cleanup
        console.log('Current record counts:');
        const tables = [
            'bookings',
            'transactions',
            'cart_items',
            'schedule_enrollments',
            'student_enrollments',
            'schedule_slots',
            'schedules',
            'courses',
            'branches',
            'users'
        ];

        for (const table of tables) {
            const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
            console.log(`  ${table}: ${result.rows[0].count} records`);
        }

        console.log('\n--- Starting cleanup (Users will NOT be affected) ---\n');

        await client.query('BEGIN');

        // Delete in order respecting foreign key constraints (children first)
        const tablesToClean = [
            'schedule_enrollments',    // depends on schedule_slots, users
            'student_enrollments',     // depends on schedule_slots, users
            'cart_items',              // depends on users, courses
            'transactions',            // depends on bookings, users
            'bookings',                // depends on users, courses, branches
            'schedule_slots',          // depends on branches
            'schedules',               // depends on branches, users
            'courses',                 // standalone
            'branches',                // standalone
        ];

        for (const table of tablesToClean) {
            const result = await client.query(`DELETE FROM ${table}`);
            console.log(`  Cleaned ${table}: ${result.rowCount} rows deleted`);
        }

        console.log('\n--- Resetting ID sequences back to 1 ---\n');

        // Reset all sequences except users
        const sequencesToReset = [
            'bookings_id_seq',
            'transactions_id_seq',
            'cart_items_id_seq',
            'schedule_enrollments_id_seq',
            'student_enrollments_id_seq',
            'schedule_slots_id_seq',
            'schedules_id_seq',
            'courses_id_seq',
            'branches_id_seq',
        ];

        for (const seq of sequencesToReset) {
            await client.query(`ALTER SEQUENCE ${seq} RESTART WITH 1`);
            console.log(`  Reset ${seq} → starts at 1`);
        }

        await client.query('COMMIT');

        // Verify cleanup
        console.log('\n--- Verification (post-cleanup counts) ---\n');
        for (const table of tables) {
            const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
            const icon = table === 'users' ? '👤' : '✓';
            console.log(`  ${icon} ${table}: ${result.rows[0].count} records`);
        }

        console.log('\n========================================');
        console.log('   CLEANUP COMPLETE');
        console.log('   Users table: PRESERVED');
        console.log('   All other data: CLEARED');
        console.log('   All sequences: RESET TO 1');
        console.log('========================================\n');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('\n✗ Error during cleanup:', error.message);
        console.error('  All changes have been rolled back.\n');
    } finally {
        client.release();
        await pool.end();
    }
};

cleanDatabase();
