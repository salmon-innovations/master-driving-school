const fs = require('fs');
let data = fs.readFileSync('src/admin/User.jsx', 'utf8');
data = data.replace(/style=\{\{\s*background: 'var\(--card-bg\)',\s*padding: '14px',\s*borderRadius: '12px',\s*border: '1px solid var\(--border-color\)'\s*\}\}/g, 'className="profile-data-card"');
data = data.replace(/margin: '-50px 30px 0',\s*background: 'var\(--card-bg\)',\s*borderRadius: '16px',\s*padding: '25px',\s*boxShadow: '0 4px 12px rgba\(0,0,0,0.08\)',\s*border: '1px solid var\(--border-color\)',\s*textAlign: 'center',\s*marginBottom: '25px'/g, 'margin: "-50px 30px 0", textAlign: "center", marginBottom: "25px"');
fs.writeFileSync('src/admin/User.jsx', data);
console.log('Replaced');
