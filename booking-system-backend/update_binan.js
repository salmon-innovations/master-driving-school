const pool = require('./config/db');

async function run() {
    const targetId = 8; // Binan Branch
    const url = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3865.662338306186!2d121.08618690000002!3d14.3310358!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3397d9e6bc9db379%3A0x4dc1226469e8e15d!2sMASTER%20DRIVING%20SCHOOL!5e0!3m2!1sen!2sph!4v1772005018776!5m2!1sen!2sph';

    await pool.query('UPDATE branches SET embed_url = $1 WHERE id = $2', [url, targetId]);
    console.log('Updated Binan Branch Map Embed URL successfully!');
    process.exit();
}
run();
