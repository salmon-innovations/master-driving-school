const fs = require('fs');
const path = 'c:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-frontend/src/pages/Profile.jsx';
let content = fs.readFileSync(path, 'utf8');

const modalsCode = `
    {/* Edit Profile Modal */}
    {editProfileModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm shadow-xl transition-all">
        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl relative">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white relative z-10">
            <h3 className="text-xl font-bold text-gray-800">Edit Profile</h3>
            <button onClick={() => setEditProfileModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="p-6 overflow-y-auto flex-1">
            <form id="edit-profile-form" onSubmit={handleUpdateProfile}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700">First Name</label><input type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" value={profileForm.firstName} onChange={e => setProfileForm({...profileForm, firstName: e.target.value})} required/></div>
                <div><label className="block text-sm font-medium text-gray-700">Middle Name</label><input type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" value={profileForm.middleName} onChange={e => setProfileForm({...profileForm, middleName: e.target.value})} /></div>
                <div><label className="block text-sm font-medium text-gray-700">Last Name</label><input type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" value={profileForm.lastName} onChange={e => setProfileForm({...profileForm, lastName: e.target.value})} required/></div>
                <div><label className="block text-sm font-medium text-gray-700">Address</label><input type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" value={profileForm.address} onChange={e => setProfileForm({...profileForm, address: e.target.value})} /></div>
                <div><label className="block text-sm font-medium text-gray-700">Age</label><input type="number" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" value={profileForm.age} onChange={e => setProfileForm({...profileForm, age: e.target.value})} /></div>
                <div><label className="block text-sm font-medium text-gray-700">Gender</label><select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" value={profileForm.gender} onChange={e => setProfileForm({...profileForm, gender: e.target.value})}><option value="">Select Gender</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
                <div><label className="block text-sm font-medium text-gray-700">Birthday</label><input type="date" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" value={profileForm.birthday} onChange={e => setProfileForm({...profileForm, birthday: e.target.value})} /></div>
                <div><label className="block text-sm font-medium text-gray-700">Birth Place</label><input type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" value={profileForm.birthPlace} onChange={e => setProfileForm({...profileForm, birthPlace: e.target.value})} /></div>
                <div><label className="block text-sm font-medium text-gray-700">Nationality</label><input type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" value={profileForm.nationality} onChange={e => setProfileForm({...profileForm, nationality: e.target.value})} /></div>
                <div><label className="block text-sm font-medium text-gray-700">Marital Status</label><select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" value={profileForm.maritalStatus} onChange={e => setProfileForm({...profileForm, maritalStatus: e.target.value})}><option value="">Select</option><option value="single">Single</option><option value="married">Married</option><option value="widowed">Widowed</option></select></div>
                <div><label className="block text-sm font-medium text-gray-700">Contact Numbers</label><input type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" value={profileForm.contactNumbers} onChange={e => setProfileForm({...profileForm, contactNumbers: e.target.value})} /></div>
                <div><label className="block text-sm font-medium text-gray-700">Zip Code</label><input type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" value={profileForm.zipCode} onChange={e => setProfileForm({...profileForm, zipCode: e.target.value})} /></div>
                <div><label className="block text-sm font-medium text-gray-700">Emergency Contact Person</label><input type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" value={profileForm.emergencyContactPerson} onChange={e => setProfileForm({...profileForm, emergencyContactPerson: e.target.value})} /></div>
                <div><label className="block text-sm font-medium text-gray-700">Emergency Contact Number</label><input type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" value={profileForm.emergencyContactNumber} onChange={e => setProfileForm({...profileForm, emergencyContactNumber: e.target.value})} /></div>
              </div>
            </form>
          </div>
          <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
            <button type="button" onClick={() => setEditProfileModal(false)} className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100">Cancel</button>
            <button type="submit" form="edit-profile-form" disabled={isUpdatingProfile} className="px-6 py-2.5 rounded-lg bg-[#2157da] text-white font-medium hover:bg-[#1a3a8a] disabled:opacity-50">
              {isUpdatingProfile ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Change Password Modal */}
    {changePasswordModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm shadow-xl transition-all">
        <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden shadow-2xl relative">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white relative z-10">
            <h3 className="text-xl font-bold text-gray-800">Change Password</h3>
            <button onClick={() => setChangePasswordModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="p-6 overflow-y-auto">
            <form id="change-password-form" onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Current Password</label>
                <input type="password" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" value={passwordForm.currentPassword} onChange={e => setPasswordForm({...passwordForm, currentPassword: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">New Password</label>
                <input type="password" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" value={passwordForm.newPassword} onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                <input type="password" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" value={passwordForm.confirmPassword} onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})} />
              </div>
            </form>
          </div>
          <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
            <button type="button" onClick={() => setChangePasswordModal(false)} className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100">Cancel</button>
            <button type="submit" form="change-password-form" disabled={isUpdatingPassword} className="flex-1 py-2.5 rounded-lg bg-[#2157da] text-white font-medium hover:bg-[#1a3a8a] disabled:opacity-50">
              {isUpdatingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </div>
      </div>
    )}
`;

content = content.replace('    )}\n    </>\n  )\n}\n\nexport default Profile', '    )}\n' + modalsCode + '\n    </>\n  )\n}\n\nexport default Profile');

fs.writeFileSync(path, content);
console.log('Modals injected successfully!');
