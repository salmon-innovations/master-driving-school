const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const GENERIC_PDC_NAME_RE = /^(pdc\s*course(\s*\d+)?|pdc|4\s*pdc)$/i;

const normalize = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const isSpecificPdcName = (name) => {
  const raw = String(name || '').trim();
  if (!raw) return false;
  if (GENERIC_PDC_NAME_RE.test(raw)) return false;
  const upper = raw.toUpperCase();
  if (upper.includes('TDC') || upper.includes('OTDC') || upper.includes('PROMO') || upper.includes('BUNDLE')) {
    return false;
  }
  return /PDC|A1|TRICYCLE|B1|B2|VAN|L300|CAR|MOTOR/i.test(raw);
};

const parseJson = (raw) => {
  try {
    return raw && String(raw).startsWith('{') ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const extractNamesFromCombined = (combinedCourseNames = '') =>
  String(combinedCourseNames || '')
    .split('+')
    .map((s) => String(s || '').trim())
    .filter(isSpecificPdcName);

const uniqueByNormalized = (items) => {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = normalize(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(String(item).trim());
  }
  return out;
};

const pickOnlineBundlePdcNames = (config) => {
  const bundleTypes = Array.isArray(config?.bundleTypes) ? config.bundleTypes : [];
  const preferred = bundleTypes.find((item) => String(item?.label || '').toUpperCase().includes('OTDC + 4 PDC'));
  if (preferred && Array.isArray(preferred.pdcParts) && preferred.pdcParts.length > 0) {
    return preferred.pdcParts;
  }
  const fallback = bundleTypes.find((item) => String(item?.tdcPart || '').toUpperCase() === 'ONLINE' && Array.isArray(item?.pdcParts) && item.pdcParts.length >= 4);
  if (fallback) return fallback.pdcParts;
  return [];
};

const resolveCourse = (name, pdcCourses) => {
  const n = normalize(name);
  if (!n) return null;

  let best = null;
  let bestScore = -1;

  for (const course of pdcCourses) {
    const hay = normalize(`${course.name} ${course.course_type}`);
    if (!hay) continue;

    let score = 0;
    if (hay === n) score += 200;
    if (hay.includes(n) || n.includes(hay)) score += 120;

    const tokens = n.split(' ').filter(Boolean);
    const overlap = tokens.filter((t) => hay.includes(t)).length;
    score += overlap * 10;

    if (/\ba1\b/.test(n) && /\ba1\b/.test(hay)) score += 40;
    if (/\bb1\b/.test(n) && /\bb1\b/.test(hay)) score += 40;
    if (/\bb2\b/.test(n) && /\bb2\b/.test(hay)) score += 40;
    if (n.includes('tricycle') && hay.includes('tricycle')) score += 40;
    if (n.includes('van') && hay.includes('van')) score += 30;
    if (n.includes('l300') && hay.includes('l300')) score += 30;
    if (n.includes('car') && hay.includes('car')) score += 30;
    if (n.includes('motor') && hay.includes('motor')) score += 30;
    if (n.includes('automatic') && hay.includes('automatic')) score += 20;
    if (n.includes('manual') && hay.includes('manual')) score += 20;

    if (score > bestScore) {
      bestScore = score;
      best = course;
    }
  }

  return bestScore >= 30 ? best : null;
};

async function main() {
  const apply = process.argv.includes('--apply');
  const configPath = path.join(__dirname, '..', 'config', 'course_config.json');
  const courseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const defaultBundlePdcNames = pickOnlineBundlePdcNames(courseConfig);

  const pdcCoursesRes = await pool.query(
    `SELECT id, name, course_type, price
     FROM courses
     WHERE UPPER(COALESCE(category, '')) = 'PDC'
     ORDER BY id ASC`
  );
  const pdcCourses = pdcCoursesRes.rows;

  const bookingsRes = await pool.query(
    `SELECT id, notes, course_type, status
     FROM bookings
     WHERE notes IS NOT NULL
       AND notes ~ '^\\{'
       AND (notes::jsonb->>'pdcScheduleLockedUntilCompletion') = 'true'
     ORDER BY id ASC`
  );

  let scanned = 0;
  let candidates = 0;
  let updated = 0;

  for (const booking of bookingsRes.rows) {
    scanned += 1;
    const notes = parseJson(booking.notes);
    if (!notes || typeof notes !== 'object') continue;

    const existingIds = Array.isArray(notes.pdcCourseIds)
      ? notes.pdcCourseIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
      : [];

    if (existingIds.length >= 4) continue;

    const fromSelections = Object.values(notes.pdcSelections || {})
      .map((v) => v?.courseName)
      .filter(isSpecificPdcName);

    const fromCourseList = (Array.isArray(notes.courseList) ? notes.courseList : [])
      .filter((item) => String(item?.category || '').toUpperCase() === 'PDC')
      .map((item) => item?.name)
      .filter(isSpecificPdcName);

    const fromCombined = extractNamesFromCombined(notes.combinedCourseNames || '');

    let names = uniqueByNormalized([...fromSelections, ...fromCourseList, ...fromCombined]);
    if (names.length === 0) {
      names = uniqueByNormalized(defaultBundlePdcNames);
    }

    if (names.length === 0) continue;

    const resolvedCourses = names
      .map((name) => resolveCourse(name, pdcCourses))
      .filter(Boolean);

    const resolvedIds = [...new Set(resolvedCourses.map((course) => Number(course.id)).filter((id) => Number.isFinite(id) && id > 0))];

    if (resolvedIds.length === 0) continue;

    const existingKey = [...new Set(existingIds)].sort((a, b) => a - b).join(',');
    const resolvedKey = [...resolvedIds].sort((a, b) => a - b).join(',');
    if (existingKey === resolvedKey) continue;

    candidates += 1;

    const existingCourseList = Array.isArray(notes.courseList) ? notes.courseList : [];
    const normalizedCourseList = [...existingCourseList];
    for (const course of resolvedCourses) {
      const exists = normalizedCourseList.some((item) => Number(item?.id) === Number(course.id));
      if (!exists) {
        normalizedCourseList.push({
          id: Number(course.id),
          name: course.name,
          type: course.course_type || '',
          category: 'PDC',
          price: Number(course.price || 0),
        });
      }
    }

    const updatedNotes = {
      ...notes,
      pdcCourseIds: resolvedIds,
      courseList: normalizedCourseList,
    };

    console.log(`[candidate] booking #${booking.id} -> pdcCourseIds: [${resolvedIds.join(', ')}] (${resolvedCourses.map((c) => c.name).join(' | ')})`);

    if (apply) {
      await pool.query('UPDATE bookings SET notes = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [booking.id, JSON.stringify(updatedNotes)]);
      updated += 1;
    }
  }

  console.log(`\nScanned: ${scanned}`);
  console.log(`Candidates: ${candidates}`);
  console.log(`Updated: ${updated}`);
  console.log(apply ? 'Applied changes.' : 'Dry run only. Re-run with --apply to persist changes.');
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
