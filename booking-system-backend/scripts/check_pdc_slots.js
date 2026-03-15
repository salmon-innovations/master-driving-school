const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgres://postgres:admin123@localhost:5432/booking_system_db'
});

async function run() {
    await client.connect();

    try {
        const res = await client.query(`SELECT id, type, course_type, transmission FROM schedule_slots LIMIT 20`);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) { console.error(e) }
    await client.end();
}
run();
