const pool = require('../config/db');

async function deleteAndReset() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log("=========================================");
        console.log("Usage: node scripts/delete_reset_id.js <table_name> <id_or_name_value> [column_name = 'id']");
        console.log("-----------------------------------------");
        console.log("Examples:");
        console.log("  To delete a user by ID 4:");
        console.log("    node scripts/delete_reset_id.js users 4");
        console.log("");
        console.log("  To delete a user by name 'Juan':");
        console.log("    node scripts/delete_reset_id.js users 'Juan' first_name");
        console.log("=========================================");
        process.exit(1);
    }

    const tableName = args[0];
    const targetValue = args[1];
    const columnName = args[2] || 'id';

    try {
        // 0. Pre-fetch the exact IDs we are going to delete so we can wipe linked dependencies
        const findQuery = `SELECT id FROM "${tableName}" WHERE "${columnName}" = $1`;
        const findResult = await pool.query(findQuery, [targetValue]);

        if (findResult.rowCount === 0) {
            console.log(`\n⚠️  No record found in table '${tableName}' where '${columnName}' = '${targetValue}'`);
            process.exit(0);
        }

        const idsToDelete = findResult.rows.map(r => r.id);

        // 1. If targeting 'users', forcibly detach and scrub foreign keys from child tables first
        if (tableName === 'users') {
            console.log(`\n🧹 Scrubbing active bookings & schedule enrollments linked to User ID(s): ${idsToDelete.join(', ')}...`);

            // 1A. Restore the available_slots back to the schedules they were enrolled in!
            try {
                const restoreSlotsQuery = `
                    UPDATE schedule_slots 
                    SET available_slots = available_slots + counts.slots_to_add
                    FROM (
                        SELECT slot_id as id, COUNT(*) as slots_to_add
                        FROM schedule_enrollments
                        WHERE student_id = ANY($1::int[])
                        GROUP BY slot_id
                    ) AS counts
                    WHERE schedule_slots.id = counts.id;
                `;
                const restoreResult = await pool.query(restoreSlotsQuery, [idsToDelete]);
                if (restoreResult.rowCount > 0) {
                    console.log(`✅ Returned ${restoreResult.rowCount} previously booked schedule slot(s) back into the available pool.`);
                }
            } catch (e) {
                console.log(`⚠️  Failed to restore available_slots...`, e.message);
            }

            try { await pool.query(`DELETE FROM schedule_enrollments WHERE student_id = ANY($1::int[])`, [idsToDelete]); } catch (e) { }
            try { await pool.query(`DELETE FROM payments WHERE booking_id IN (SELECT id FROM bookings WHERE user_id = ANY($1::int[]))`, [idsToDelete]); } catch (e) { }
            try { await pool.query(`DELETE FROM bookings WHERE user_id = ANY($1::int[])`, [idsToDelete]); } catch (e) { }
        }

        // 2. Delete the record
        const deleteQuery = `DELETE FROM "${tableName}" WHERE id = ANY($1::int[])`;
        console.log(`\n⏳ Executing: DELETE FROM "${tableName}" WHERE id IN (${idsToDelete.join(', ')})`);

        const deleteResult = await pool.query(deleteQuery, [idsToDelete]);

        console.log(`✅ Successfully deleted ${deleteResult.rowCount} record(s). Deleted IDs: ${idsToDelete.join(', ')}`);

        // 3. Reset the sequence to ensure the next ID matches perfectly
        try {
            const resetExactQuery = `
        SELECT setval(pg_get_serial_sequence('"${tableName}"', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM "${tableName}";
      `;
            await pool.query(resetExactQuery);

            console.log(`✅ Sequence reset successfully for '${tableName}'.`);
            console.log(`➡️  The next record inserted into '${tableName}' will flawlessly map to the next sequence.`);

            if (tableName === 'users') {
                try {
                    await pool.query(`SELECT setval(pg_get_serial_sequence('"bookings"', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM "bookings"`);
                    await pool.query(`SELECT setval(pg_get_serial_sequence('"schedule_enrollments"', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM "schedule_enrollments"`);
                    await pool.query(`SELECT setval(pg_get_serial_sequence('"payments"', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM "payments"`);
                    console.log(`✅ Sequences reset successfully for dependent tables ('bookings', 'schedule_enrollments').`);
                } catch (e) { }
            }
        } catch (seqErr) {
            console.log(`⚠️  Record was deleted, but sequence reset failed (perhaps table '${tableName}' has no auto-incrementing 'id'):`, seqErr.message);
        }

    } catch (err) {
        if (err.code === '42P01') {
            console.error(`\n❌ Error: Table '${tableName}' does not exist.`);
        } else if (err.code === '42703') {
            console.error(`\n❌ Error: Column '${columnName}' does not exist.`);
        } else {
            console.error('\n❌ SQL Error executing script:', err.message);
        }
    } finally {
        pool.end();
    }
}

deleteAndReset();
