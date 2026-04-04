const https = require('https');

const get = (u) => new Promise((res, rej) => {
  https.get(u, (r) => {
    let d = '';
    r.on('data', (c) => (d += c));
    r.on('end', () => res(d));
  }).on('error', rej);
});

(async () => {
  const out = new Map();
  for (let p = 1; p <= 63; p++) {
    const url = p === 1
      ? 'https://www.philippineszipcode.com/location/calabarzon/quezon/'
      : `https://www.philippineszipcode.com/location/calabarzon/quezon/?page=${p}`;
    const html = await get(url);
    const rows = [...html.matchAll(/<tr>[\s\S]*?<\/tr>/gsi)];
    for (const rowMatch of rows) {
      const row = rowMatch[0];
      const muni = row.match(/<td align="center"><strong><a href="\/\d+\/" title="([^"]+)">/i);
      const zip = row.match(/<td align="center"><strong><a href="\/\d+\/" title="(\d{4})">\d{4}<\/a><\/strong><\/td>/i);
      if (muni && zip) {
        out.set(muni[1].trim().toLowerCase(), zip[1]);
      }
    }
  }

  const arr = [...out.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  console.log('count', arr.length);
  for (const [muni, zip] of arr) {
    console.log(`${muni}:${zip}`);
  }
})();
