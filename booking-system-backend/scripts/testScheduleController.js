const controller = require('../controllers/scheduleController');

console.log('Checking schedule controller exports...');
console.log('getSlotsByDate:', typeof controller.getSlotsByDate);
console.log('createSlot:', typeof controller.createSlot);
console.log('updateSlot:', typeof controller.updateSlot);
console.log('deleteSlot:', typeof controller.deleteSlot);
console.log('getSlotEnrollments:', typeof controller.getSlotEnrollments);
console.log('enrollStudent:', typeof controller.enrollStudent);
console.log('updateEnrollmentStatus:', typeof controller.updateEnrollmentStatus);
console.log('cancelEnrollment:', typeof controller.cancelEnrollment);
