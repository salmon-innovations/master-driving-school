const fs = require('fs');
let code = fs.readFileSync('src/admin/components/PromoPackageManagement.jsx', 'utf8');
const lines = code.split('\n');
lines.forEach((line, i) => {
    if (line.includes('Unterminated')) console.log(i, line);
});
console.log('Total lines:', lines.length);
