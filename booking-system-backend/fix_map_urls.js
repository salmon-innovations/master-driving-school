const pool = require('./config/db');
const https = require('https');

function getRedirectUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                resolve(res.headers.location);
            } else {
                resolve(url);
            }
        }).on('error', reject);
    });
}

function extractCoordinates(url) {
    const match = url.match(/@(-?\d+\.\d+,-?\d+\.\d+)/);
    return match ? match[1] : null;
}

function extractPlaceName(url) {
    const match = url.match(/\/place\/([^\/]+)\//);
    if (match) {
        return decodeURIComponent(match[1]).replace(/\+/g, ' ');
    }
    return null;
}

async function run() {
    const { rows } = await pool.query('SELECT id, name, embed_url, address FROM branches');

    for (const row of rows) {
        if (row.embed_url && row.embed_url.includes('maps.app.goo.gl')) {
            const redirectedUrl = await getRedirectUrl(row.embed_url);
            const coords = extractCoordinates(redirectedUrl);
            const placeName = extractPlaceName(redirectedUrl);

            let newQuery = '';
            if (coords) {
                newQuery = coords; // Perfect pin drop at coordinates
            } else if (placeName) {
                newQuery = placeName;
            } else {
                newQuery = row.address; // Fallback
            }

            const newEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(newQuery)}&output=embed`;
            console.log(`Updating ${row.name}: ${newEmbedUrl}`);
            await pool.query('UPDATE branches SET embed_url = $1 WHERE id = $2', [newEmbedUrl, row.id]);
        } else if (row.embed_url && !row.embed_url.includes('output=embed')) {
            const newEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(row.address)}&output=embed`;
            console.log(`Updating fallback ${row.name}: ${newEmbedUrl}`);
            await pool.query('UPDATE branches SET embed_url = $1 WHERE id = $2', [newEmbedUrl, row.id]);
        } else if (!row.embed_url) {
            const newEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent('Master Driving School ' + row.name)}&output=embed`;
            console.log(`Adding ${row.name}: ${newEmbedUrl}`);
            await pool.query('UPDATE branches SET embed_url = $1 WHERE id = $2', [newEmbedUrl, row.id]);
        }
    }

    console.log('Update Complete.');
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
