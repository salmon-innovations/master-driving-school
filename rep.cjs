const fs = require('fs');
const path = '../booking-system-frontend/src/pages/Profile.jsx';
let content = fs.readFileSync(path, 'utf8');

const oldStr = \                    <button
                      onClick={() => showNotification('Edit profile feature coming soon!', 'info')}
                      className="flex items-center gap-2 px-6 py-2.5 bg-[#2157da] text-white rounded-lg hover:bg-[#1a3a8a] transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit Profile
                    </button>
                    <button
                      onClick={() => showNotification('Password change coming soon!', 'info')}
                      className="flex items-center gap-2 px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17.086V19a1 1 0 01-1 1h-2a1 1 0 01-1-1v-2a1 1 0 01.293-.707L10.243 13.5A6 6 0 1121 9z" />
                      </svg>
                      Change Password
                    </button>\;

const newStr = \                    <button
                      onClick={() => {
                        setProfileForm({
                          firstName: user?.firstName || '',
                          middleName: user?.middleName || '',
                          lastName: user?.lastName || '',
                          address: user?.address || '',
                          age: user?.age || '',
                          gender: user?.gender || '',
                          birthday: user?.birthday ? new Date(user.birthday).toISOString().split('T')[0] : '',
                          birthPlace: user?.birthPlace || '',
                          nationality: user?.nationality || '',
                          maritalStatus: user?.maritalStatus || '',
                          contactNumbers: user?.contactNumbers || '',
                          zipCode: user?.zipCode || '',
                          emergencyContactPerson: user?.emergencyContactPerson || '',
                          emergencyContactNumber: user?.emergencyContactNumber || ''
                        });
                        setEditProfileModal(true);
                      }}
                      className="flex items-center gap-2 px-6 py-2.5 bg-[#2157da] text-white rounded-lg hover:bg-[#1a3a8a] transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit Profile
                    </button>
                    <button
                      onClick={() => {
                        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                        setChangePasswordModal(true);
                      }}
                      className="flex items-center gap-2 px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17.086V19a1 1 0 01-1 1h-2a1 1 0 01-1-1v-2a1 1 0 01.293-.707L10.243 13.5A6 6 0 1121 9z" />
                      </svg>
                      Change Password
                    </button>\;

if(content.includes(oldStr)) {
  fs.writeFileSync(path, content.replace(oldStr, newStr));
  console.log('Replaced successfully');
} else {
  console.log('Could not find string');
}