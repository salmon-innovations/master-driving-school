require('dotenv').config();
const { sendVerificationEmail } = require('./utils/emailService');

async function testEmail() {
  try {
    console.log('Testing email configuration...');
    console.log('EMAIL_USER:', process.env.EMAIL_USER);
    console.log('EMAIL_HOST:', process.env.EMAIL_HOST);
    console.log('EMAIL_PORT:', process.env.EMAIL_PORT);
    console.log('Password configured:', process.env.EMAIL_PASSWORD ? 'Yes (hidden)' : 'No');
    console.log('\nAttempting to send test email...');
    
    const testCode = '123456';
    const testEmail = 'gabasamarcjeff03@gmail.com'; // Send to client email for testing
    const result = await sendVerificationEmail(testEmail, testCode, 'Test User');
    
    console.log('\n✅ Email test successful!');
    console.log('Check your inbox at:', testEmail);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Email test failed!');
    console.error('Error:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.response) {
      console.error('SMTP Response:', error.response);
    }
    process.exit(1);
  }
}

testEmail();
