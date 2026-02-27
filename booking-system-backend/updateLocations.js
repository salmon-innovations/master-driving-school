const pool = require('./config/db');

async function run() {
    await pool.query('ALTER TABLE branches ADD COLUMN IF NOT EXISTS embed_url TEXT;');
    await pool.query('UPDATE branches SET address = $1, embed_url = $2 WHERE name ILIKE $3', ['2nd Flr, H5JG+742 Maylor\'s 2 Plaza, 176 L. Sumulong Memorial Circle, San Roque, Antipolo, 1870 Rizal', 'https://maps.app.goo.gl/DYLH5Focrywoht5z6', '%Antipolo%']);
    await pool.query('UPDATE branches SET address = $1, embed_url = $2 WHERE name ILIKE $3', ['1594 MacArthur Hwy, Bocaue, Bulacan', 'https://maps.app.goo.gl/ZZbeZbxM6cLhyVGp7', '%Bocaue%']);
    await pool.query('UPDATE branches SET address = $1, embed_url = $2 WHERE name ILIKE $3', ['373 Boni Ave, Mandaluyong City, 1550 Metro Manila', 'https://maps.app.goo.gl/qKiT67QsHsxkRtJz6', '%Mandaluyong%']);
    await pool.query('UPDATE branches SET address = $1, embed_url = $2 WHERE name ILIKE $3', ['CXQ2+H27, R-2, Bacoor, Cavite', 'https://maps.app.goo.gl/GYXxy1b66qv83jDCA', '%Bacoor%']);
    await pool.query('UPDATE branches SET address = $1, embed_url = $2 WHERE name ILIKE $3', ['UNIT A1-B2, JRJ BUILDING, Barangay, CAMALIG, Meycauayan, 3020 Bulacan', 'https://maps.app.goo.gl/uB96gJyE6Btsa3Zs5', '%Meycauayan%']);
    await pool.query('UPDATE branches SET address = $1, embed_url = $2 WHERE name ILIKE $3', ['Biñan, Laguna', 'https://maps.app.goo.gl/24PqL9HyxfVdSqgy8', '%Biñan%']);
    console.log('Finished updating Branches DB!');
    process.exit(0);
}
run();
