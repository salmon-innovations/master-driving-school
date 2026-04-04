const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = 'https://www.philippineszipcode.com';
const BROWSE = `${ROOT}/browse/calabarzon/`;
const TARGET = 'booking-system-frontend/src/utils/philippineZipCodes.js';

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function stripTags(s) {
  return s.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

(async () => {
  const browseHtml = await fetch(BROWSE);
  const zipLinks = [...new Set([...browseHtml.matchAll(/href="\/(\d{4})\/"/g)].map((m) => m[1]))].sort();

  const muniToZip = new Map();
  let blocked = 0;

  for (const zip of zipLinks) {
    const html = await fetch(`${ROOT}/${zip}/`);
    if (/hcaptcha|Attention Required|captcha/i.test(html)) {
      blocked++;
      continue;
    }

    const rowRegex = /<tr>[\s\S]*?<td[^>]*>\s*<strong>\s*<a[^>]*title="([^"]+)"[^>]*>[^<]*<\/a>\s*<\/strong>\s*<\/td>\s*<td[^>]*>\s*<strong>\s*<a[^>]*title="([^"]+)"[^>]*>[^<]*<\/a>/gim;
    let m;
    while ((m = rowRegex.exec(html))) {
      const municipality = stripTags(m[2]).toLowerCase();
      if (!municipality || /municipality|province|region|zip code/i.test(municipality)) continue;
      if (!muniToZip.has(municipality)) muniToZip.set(municipality, zip);
    }

    await new Promise((r) => setTimeout(r, 120));
  }

  const source = fs.readFileSync(path.resolve(TARGET), 'utf8');
  const calabMatch = source.match(/const CALABARZON = \{([\s\S]*?)\n\};/);
  if (!calabMatch) throw new Error('CALABARZON block not found');

  const existingKeys = new Set([...calabMatch[1].matchAll(/'([^']+)'\s*:\s*'\d{4}'/g)].map((m) => m[1].toLowerCase()));

  const missing = [];
  for (const [muni, zip] of [...muniToZip.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!existingKeys.has(muni)) missing.push([muni, zip]);
  }

  console.log('zipLinks', zipLinks.length);
  console.log('blockedPages', blocked);
  console.log('municipalitiesFound', muniToZip.size);
  console.log('missingMunicipalities', missing.length);
  for (const [k, z] of missing) {
    console.log(`'${k}': '${z}',`);
  }
})();
