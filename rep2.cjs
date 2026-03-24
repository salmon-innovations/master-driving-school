const fs = require('fs');
const path = '../booking-system-frontend/src/pages/Profile.jsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  "onClick={() => showNotification('Edit profile feature coming soon!', 'info')}",
  "onClick={() => { setProfileForm({ firstName: user?.firstName || '', middleName: user?.middleName || '', lastName: user?.lastName || '', address: user?.address || '', age: user?.age || '', gender: user?.gender || '', birthday: user?.birthday ? new Date(user.birthday).toISOString().split('T')[0] : '', birthPlace: user?.birthPlace || '', nationality: user?.nationality || '', maritalStatus: user?.maritalStatus || '', contactNumbers: user?.contactNumbers || '', zipCode: user?.zipCode || '', emergencyContactPerson: user?.emergencyContactPerson || '', emergencyContactNumber: user?.emergencyContactNumber || '' }); setEditProfileModal(true); }}"
);

content = content.replace(
  "onClick={() => showNotification('Password change coming soon!', 'info')}",
  "onClick={() => { setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); setChangePasswordModal(true); }}"
);

fs.writeFileSync(path, content);
console.log('Replaced successfully');