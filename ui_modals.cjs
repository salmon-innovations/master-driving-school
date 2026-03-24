const fs = require('fs');
const path = 'c:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-frontend/src/pages/Profile.jsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /\{\/\* Edit Profile Modal \*\/\}.*?\{\/\* Change Password Modal \*\/\}.*?\}\)/s;

const newModals = \
    {/* Edit Profile Modal */}
    {editProfileModal && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm shadow-xl transition-all overflow-y-auto">
        <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl relative my-auto">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10 shrink-0">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#2157da]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              Edit Profile
            </h3>
            <button onClick={() => setEditProfileModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
            <form id="edit-profile-form" onSubmit={handleUpdateProfile} className="space-y-8">
              
              {/* Personal Information */}
              <section>
                <div className="flex items-center gap-3 mb-4 pb-2 border-b">
                  <div className="p-2 bg-blue-50 rounded-lg text-[#2157da]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </div>
                  <h4 className="text-lg font-bold text-gray-800">Personal Information</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                  <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">First Name</label><input type="text" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={profileForm.firstName} onChange={e => setProfileForm({...profileForm, firstName: e.target.value})} required/></div>
                  <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Middle Name</label><input type="text" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={profileForm.middleName} onChange={e => setProfileForm({...profileForm, middleName: e.target.value})} /></div>
                  <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Last Name</label><input type="text" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={profileForm.lastName} onChange={e => setProfileForm({...profileForm, lastName: e.target.value})} required/></div>
                  <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Age</label><input type="number" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={profileForm.age} onChange={e => setProfileForm({...profileForm, age: e.target.value})} /></div>
                  <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Gender</label><select className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={profileForm.gender} onChange={e => setProfileForm({...profileForm, gender: e.target.value})}><option value="">Select Gender</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
                  <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Birthday</label><input type="date" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={profileForm.birthday} onChange={e => setProfileForm({...profileForm, birthday: e.target.value})} /></div>
                  <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Birth Place</label><input type="text" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={profileForm.birthPlace} onChange={e => setProfileForm({...profileForm, birthPlace: e.target.value})} /></div>
                  <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Nationality</label><input type="text" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={profileForm.nationality} onChange={e => setProfileForm({...profileForm, nationality: e.target.value})} /></div>
                  <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Marital Status</label><select className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={profileForm.maritalStatus} onChange={e => setProfileForm({...profileForm, maritalStatus: e.target.value})}><option value="">Select</option><option value="single">Single</option><option value="married">Married</option><option value="widowed">Widowed</option></select></div>
                </div>
              </section>

              {/* Address & Contact */}
              <section>
                <div className="flex items-center gap-3 mb-4 pb-2 border-b">
                  <div className="p-2 bg-blue-50 rounded-lg text-[#2157da]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </div>
                  <h4 className="text-lg font-bold text-gray-800">Address & Contact</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2"><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Full Address</label><input type="text" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={profileForm.address} onChange={e => setProfileForm({...profileForm, address: e.target.value})} /></div>
                  <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Contact Numbers</label><input type="text" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={profileForm.contactNumbers} onChange={e => setProfileForm({...profileForm, contactNumbers: e.target.value})} /></div>
                  <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Zip Code</label><input type="text" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={profileForm.zipCode} onChange={e => setProfileForm({...profileForm, zipCode: e.target.value})} /></div>
                </div>
              </section>

              {/* Emergency Contact */}
              <section>
                <div className="flex items-center gap-3 mb-4 pb-2 border-b">
                  <div className="p-2 bg-red-50 rounded-lg text-red-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  </div>
                  <h4 className="text-lg font-bold text-gray-800">Emergency Contact</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Contact Person</label><input type="text" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={profileForm.emergencyContactPerson} onChange={e => setProfileForm({...profileForm, emergencyContactPerson: e.target.value})} /></div>
                  <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Emergency Number</label><input type="text" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={profileForm.emergencyContactNumber} onChange={e => setProfileForm({...profileForm, emergencyContactNumber: e.target.value})} /></div>
                </div>
              </section>

            </form>
          </div>
          <div className="p-4 sm:p-6 border-t border-gray-100 bg-gray-50 flex gap-3 shrink-0 rounded-b-2xl justify-end">
            <button type="button" onClick={() => setEditProfileModal(false)} className="px-6 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 font-bold hover:bg-gray-100 transition-colors">Cancel</button>
            <button type="submit" form="edit-profile-form" disabled={isUpdatingProfile} className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-[#2157da] to-[#3b82f6] text-white font-bold hover:shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              {isUpdatingProfile ? (
                 <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Saving...
                 </>
              ) : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Change Password Modal */}
    {changePasswordModal && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm shadow-xl transition-all">
        <div className="bg-white rounded-2xl w-full max-w-md flex flex-col overflow-hidden shadow-2xl relative">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white relative z-10 shrink-0">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#2157da]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17.086V19a1 1 0 01-1 1h-2a1 1 0 01-1-1v-2a1 1 0 01.293-.707L10.243 13.5A6 6 0 1121 9z" /></svg>
              Change Password
            </h3>
            <button onClick={() => setChangePasswordModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="p-6">
            <form id="change-password-form" onSubmit={handleChangePassword} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Current Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input type="password" required className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={passwordForm.currentPassword} onChange={e => setPasswordForm({...passwordForm, currentPassword: e.target.value})} placeholder="••••••••" />
                </div>
              </div>
              <div className="pt-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">New Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input type="password" required minLength="6" className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#2157da] focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50/50 focus:bg-white" value={passwordForm.newPassword} onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})} placeholder="••••••••" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Confirm New Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H5V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input type="password" required className={\w-full pl-10 pr-4 py-2.5 rounded-lg border focus:ring-2 focus:border-transparent outline-none transition-all text-gray-800 focus:bg-white \\} value={passwordForm.confirmPassword} onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})} placeholder="••••••••" />
                </div>
                {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                  <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    Passwords do not match
                  </p>
                )}
              </div>
            </form>
          </div>
          <div className="p-4 sm:p-6 border-t border-gray-100 bg-gray-50 flex gap-3 shrink-0 rounded-b-2xl">
            <button type="button" onClick={() => setChangePasswordModal(false)} className="flex-1 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-bold hover:bg-gray-100 transition-colors">Cancel</button>
            <button type="submit" form="change-password-form" disabled={isUpdatingPassword || (passwordForm.newPassword !== passwordForm.confirmPassword)} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#2157da] to-[#3b82f6] text-white font-bold hover:shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              {isUpdatingPassword ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Updating...
                </>
              ) : 'Update Password'}
            </button>
          </div>
        </div>
      </div>
    )}
\);

content = content.replace(regex, newModals);
fs.writeFileSync(path, content);
console.log("Replaced");