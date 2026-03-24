const fs = require('fs');
const path = '../booking-system-frontend/src/pages/Profile.jsx';
let content = fs.readFileSync(path, 'utf8');

const modalsCode = \$modals\;

content = content.replace('    )}\n    </>\n  )\n}\n\nexport default Profile', '    )}\n' + modalsCode + '\n    </>\n  )\n}\n\nexport default Profile');

fs.writeFileSync(path, content);
console.log('Modals injected!');