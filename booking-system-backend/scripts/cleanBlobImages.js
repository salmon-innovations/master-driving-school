const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function cleanBlobImages() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking for courses with blob URLs...\n');
    
    // Find courses with blob URLs
    const coursesWithBlobs = await client.query(`
      SELECT id, name, image_url 
      FROM courses 
      WHERE image_url LIKE '%blob:%'
    `);
    
    console.log(`Found ${coursesWithBlobs.rows.length} courses with blob URLs\n`);
    
    if (coursesWithBlobs.rows.length === 0) {
      console.log('✅ No blob URLs found. Database is clean!');
      return;
    }
    
    coursesWithBlobs.rows.forEach(course => {
      console.log(`  - Course #${course.id}: ${course.name}`);
    });
    
    console.log('\n🗑️  Removing blob URLs from courses...');
    
    // Update courses to remove blob URLs
    await client.query(`
      UPDATE courses 
      SET image_url = NULL 
      WHERE image_url LIKE '%blob:%'
    `);
    
    console.log('✅ Blob URLs removed successfully!\n');
    
    // Verify
    const remaining = await client.query(`
      SELECT COUNT(*) as count 
      FROM courses 
      WHERE image_url LIKE '%blob:%'
    `);
    
    console.log(`✅ Verification: ${remaining.rows[0].count} blob URLs remaining`);
    console.log('\n💡 Tip: Upload new images to these courses - they will be stored as base64 and work correctly.');
    
  } catch (error) {
    console.error('❌ Error cleaning blob URLs:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

cleanBlobImages()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
