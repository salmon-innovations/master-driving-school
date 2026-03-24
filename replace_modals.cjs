@
const fs = require('fs');
const file = 'booking-system-frontend/src/admin/Admin.jsx';
let content = fs.readFileSync(file, 'utf8');

// Find start of Edit Profile Modal
const startToken = '{/* Edit Profile Modal */}';
const endToken = '            </main>'; // after modally ended

const startIdx = content.indexOf(startToken);
const endIdx = content.indexOf(endToken, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const originalModals = content.substring(startIdx, endIdx);
    
    // We replace the two separate modals with a single unified one that switches between Personal Info and Security based on a state variable.
    // Let's inject editProfileTab state directly where the buttons are clicked or just use a local state inside the modal?
    // Oh, better to just edit the showChangePasswordModal code to inline its body into the edit profile modal or add editProfileTab state at top.
}
@
