const fs = require("fs");
const file = "booking-system-frontend/src/admin/Admin.jsx";
let content = fs.readFileSync(file, "utf8");
const startToken = "{/* Edit Profile Modal */}";
const endToken = "            </main>";
const startIdx = content.indexOf(startToken);
const endIdx = content.indexOf(endToken, startIdx);
if (startIdx !== -1 && endIdx !== -1) {
    const originalModals = content.substring(startIdx, endIdx);
    const newModal = `{\/* Unified Edit Profile & Settings Modal *\/}
                {showEditProfileModal && (
                    <div className="modal-overlay">
                        <div className="modal-container">
                            <div className="modal-header">
                                <div className="modal-header-left">
                                    <div className="modal-header-icon">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                    </div>
                                    <div>
                                        <h2>{editProfileTab === "personal" ? "Edit Profile" : "Change Password"}</h2>
                                    </div>
                                </div>
                                <div className="modal-header-right">
                                    <button className="close-modal" onClick={() => setShowEditProfileModal(false)}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                </div>
                            </div>
                            
                            <div className="modal-tabs" style={{ display: "flex", borderBottom: "1px solid var(--border-color)", margin: "0 25px" }}>
                                <button 
                                    style={{ padding: "15px 20px", background: "none", border: "none", borderBottom: editProfileTab === "personal" ? "2px solid var(--primary-color)" : "2px solid transparent", color: editProfileTab === "personal" ? "var(--primary-color)" : "var(--secondary-text)", fontWeight: editProfileTab === "personal" ? "600" : "500", cursor: "pointer", outline: "none" }}
                                    onClick={() => setEditProfileTab("personal")}
                                >
                                    Personal Details
                                </button>
                                <button 
                                    style={{ padding: "15px 20px", background: "none", border: "none", borderBottom: editProfileTab === "security" ? "2px solid var(--primary-color)" : "2px solid transparent", color: editProfileTab === "security" ? "var(--primary-color)" : "var(--secondary-text)", fontWeight: editProfileTab === "security" ? "600" : "500", cursor: "pointer", outline: "none" }}
                                    onClick={() => setEditProfileTab("security")}
                                >
                                    Account Security
                                </button>
                            </div>

                            {editProfileTab === "personal" ? (
                                <form onSubmit={handleUpdateProfile}>
                                    <div className="modal-body">
                                        <div className="form-group">
                                            <label>Full Name</label>
                                            <input
                                                type="text"
                                                value={profileFormData.name}
                                                onChange={(e) => setProfileFormData({ ...profileFormData, name: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Email Address</label>
                                            <input
                                                type="email"
                                                value={profileFormData.email}
                                                onChange={(e) => setProfileFormData({ ...profileFormData, email: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="form-row">
                                            <div className="form-group" style={{ flex: 1 }}>
                                                <label>Phone Number</label>
                                                <input
                                                    type="text"
                                                    value={profileFormData.phone}
                                                    onChange={(e) => setProfileFormData({ ...profileFormData, phone: e.target.value })}
                                                    required
                                                />
                                            </div>
                                            <div className="form-group" style={{ flex: 1 }}>
                                                <label>Branch</label>
                                                <input
                                                    type="text"
                                                    value={profileFormData.branch}
                                                    onChange={(e) => setProfileFormData({ ...profileFormData, branch: e.target.value })}
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="modal-footer">
                                        <button type="button" className="cancel-btn" onClick={() => setShowEditProfileModal(false)}>Cancel</button>
                                        <button type="submit" className="confirm-btn">Save Changes</button>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={handleChangePassword}>
                                    <div className="modal-body">
                                        <div className="form-group">
                                            <label>Current Password</label>
                                            <input
                                                type="password"
                                                value={passwordData.currentPassword}
                                                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                                placeholder="Enter current password"
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>New Password</label>
                                            <input
                                                type="password"
                                                value={passwordData.newPassword}
                                                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                                placeholder="Enter new password"
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Confirm New Password</label>
                                            <input
                                                type="password"
                                                value={passwordData.confirmPassword}
                                                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                                placeholder="Repeat new password"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="modal-footer">
                                        <button type="button" className="cancel-btn" onClick={() => setShowEditProfileModal(false)}>Cancel</button>
                                        <button type="submit" className="confirm-btn red">Update Password</button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                )}
`;
    content = content.replace(originalModals, newModal);
    fs.writeFileSync(file, content);
    console.log("Successfully updated Admin.jsx");
} else {
    console.log("Could not find modal block.");
}
