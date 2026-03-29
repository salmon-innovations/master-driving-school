const fs = require('fs');
const file = 'booking-system-frontend/src/admin/css/walkInEnrollment.css';
let content = fs.readFileSync(file, 'utf8');

const target1 = \.session-sub-box.full {
    background: rgba(239, 68, 68, 0.07);
    border-color: rgba(239, 68, 68, 0.22);
    cursor: not-allowed;
}\;
content = content.replace(target1, \.session-sub-box.full {
    cursor: not-allowed;
    opacity: 0.65;
}\);

const target2 = \.session-sub-box.full .session-sub-label span { color: #dc2626; }\;
content = content.replace(target2, \/* .session-sub-box.full .session-sub-label span { color: #dc2626; } */\);

fs.writeFileSync(file, content);
console.log('Fixed CSS');
