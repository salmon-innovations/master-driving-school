const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const backendDir = path.join(__dirname, 'booking-system-backend');
const maintenanceFile = path.join(backendDir, '.maintenance');

console.log('==============================================');
console.log('   MASTER DRIVING SCHOOL MAINTENANCE TOOL');
console.log('==============================================\n');

const isMaintenanceOn = fs.existsSync(maintenanceFile);

if (isMaintenanceOn) {
  console.log('[STATUS] System is currently in MAINTENANCE MODE.\n');
  rl.question('Do you want to turn OFF Maintenance Mode? (Y/N): ', (answer) => {
    if (answer.trim().toLowerCase() === 'y') {
      try {
        fs.unlinkSync(maintenanceFile);
        console.log('\n[SUCCESS] Maintenance Mode is now OFF. The website is live.');
      } catch (err) {
        console.error('\n[ERROR] Failed to turn off maintenance mode:', err.message);
      }
    } else {
      console.log('\nOperation cancelled. System remains in maintenance mode.');
    }
    rl.close();
  });
} else {
  console.log('[STATUS] System is currently LIVE (Maintenance Mode is OFF).\n');
  rl.question('Do you want to turn ON Maintenance Mode? (Y/N): ', (answer) => {
    if (answer.trim().toLowerCase() === 'y') {
      try {
        fs.writeFileSync(maintenanceFile, 'Maintenance Mode Active');
        console.log('\n[SUCCESS] Maintenance Mode is now ON. Only admins can access the website.');
      } catch (err) {
        console.error('\n[ERROR] Failed to turn on maintenance mode:', err.message);
      }
    } else {
      console.log('\nOperation cancelled. System remains live.');
    }
    rl.close();
  });
}
