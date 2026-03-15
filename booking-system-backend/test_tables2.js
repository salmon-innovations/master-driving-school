const db = require('./config/db.js');
async function run() {
  try {
    await db.query("ALTER ROLE neondb_owner SET search_path = public;");
    console.log("Search path configured for neondb_owner.");
    process.exit(0);
  } catch(e) { console.error(e); process.exit(1); }
}
run();