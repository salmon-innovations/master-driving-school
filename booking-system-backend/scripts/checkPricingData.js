const pool = require('../config/db');
require('dotenv').config();

async function checkPricingData() {
  try {
    const result = await pool.query('SELECT id, name, category, course_type, price, pricing_data FROM courses ORDER BY id');
    
    console.log('=== ALL COURSES AND PRICING DATA ===\n');
    
    result.rows.forEach(course => {
      console.log(`ID: ${course.id} | ${course.name}`);
      console.log(`  Category: ${course.category} | Type: ${course.course_type || 'N/A'}`);
      console.log(`  Main Price: ₱${course.price}`);
      
      if (course.pricing_data && course.pricing_data.length > 0) {
        console.log(`  Pricing Variations (${course.pricing_data.length}):`);
        course.pricing_data.forEach(variation => {
          console.log(`    - ${variation.type}: ₱${variation.price}`);
        });
      } else {
        console.log(`  Pricing Variations: None`);
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkPricingData();
