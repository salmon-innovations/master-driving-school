const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: 'c:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-backend/.env' });

const envPool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function run() {
    const token = jwt.sign({ id: 1, email: 'admin@gmail.com', role: 'admin' }, process.env.JWT_SECRET || 'your-secret-key', {
        expiresIn: '24h',
    });
    console.log("Token:", token);
    await envPool.end();
}
run();
