import fs from 'fs';

const content = fs.readFileSync('src/pages/Payment.jsx', 'utf8');

function count(str, char) {
    let count = 0;
    for (let i = 0; i < str.length; i++) {
        if (str[i] === char) count++;
    }
    return count;
}

console.log("Braces: { =", count(content, '{'), "} =", count(content, '}'));
console.log("brackets: [ =", count(content, '['), "] =", count(content, ']'));
console.log("Parens: ( =", count(content, '('), ") =", count(content, ')'));

try {
    new Function(content.replace(/import\s+.*\s+from\s+['"].*['"]/g, '').replace(/export\s+default\s+\w+/g, ''));
    console.log("Basic syntax check passed (excluding imports/exports)");
} catch (e) {
    console.log("Syntax Error:", e.message);
}
