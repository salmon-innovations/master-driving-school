const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgres://postgres:admin123@localhost:5432/booking_system_db'
});

async function run() {
    await client.connect();

    try {
        const res = await client.query(`SELECT pg_get_constraintdef(oid) as cdef FROM pg_constraint WHERE conname = 'schedule_slots_type_check'`);
        console.log(res.rows[0].cdef);
    } catch (e) { console.error(e) }
    await client.end();
}
run();
