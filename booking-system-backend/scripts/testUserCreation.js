const pool = require('../config/db');
const { generateRandomPassword, sendPasswordEmail } = require('../utils/emailService');

async function testUserCreation() {
  try {
    console.log('🧪 Testing user creation...\n');
    
    // Test data
    const testUser = {
      firstName: 'Test',
      middleInitial: 'T',
      lastName: 'User',
      gender: 'Male',
      age: 25,
      birthday: '2001-01-01',
      address: '123 Test Street',
      contactNumber: '0917 123 4567',
      email: 'testuser@example.com',
      role: 'staff',
      branch: 1  // Using branch ID 1
    };
    
    console.log('📋 Test user data:', testUser);
    
    // Check if email exists
    console.log('\n🔍 Checking if user exists...');
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [testUser.email]);
    if (existingUser.rows.length > 0) {
      console.log('⚠️  User already exists, deleting...');
      await pool.query('DELETE FROM users WHERE email = $1', [testUser.email]);
      console.log('✅ Old test user deleted');
    }
    
    // Generate password
    console.log('\n🔐 Generating password...');
    const generatedPassword = generateRandomPassword();
    console.log('✅ Password generated:', generatedPassword);
    
    // Hash password
    console.log('\n🔒 Hashing password...');
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);
    console.log('✅ Password hashed');
    
    // Prepare branch_id
    const branchId = testUser.branch ? parseInt(testUser.branch) : null;
    console.log('\n🏢 Branch ID:', branchId, 'Type:', typeof branchId);
    
    // Insert user
    console.log('\n💾 Inserting user into database...');
    const result = await pool.query(
      `INSERT INTO users (
        first_name, middle_name, last_name, email, password, 
        gender, age, birthday, address, contact_numbers, 
        role, branch_id, status, is_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id, first_name, middle_name, last_name, email, role, branch_id, status, created_at`,
      [
        testUser.firstName,
        testUser.middleInitial || null,
        testUser.lastName,
        testUser.email,
        hashedPassword,
        testUser.gender,
        testUser.age,
        testUser.birthday,
        testUser.address,
        testUser.contactNumber,
        testUser.role,
        branchId,
        'active',
        true
      ]
    );
    
    console.log('\n✅ User created successfully!');
    console.log('📄 Created user:', result.rows[0]);
    
    // Clean up
    console.log('\n🧹 Cleaning up test user...');
    await pool.query('DELETE FROM users WHERE email = $1', [testUser.email]);
    console.log('✅ Test user deleted');
    
    console.log('\n🎉 Test completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('📜 Full error:', error);
    process.exit(1);
  }
}

testUserCreation();
