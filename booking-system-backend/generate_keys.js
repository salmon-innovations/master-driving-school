const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const keysDir = path.join(__dirname, 'keys');
if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir);
}

function generateKeyPair(env) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });

    fs.writeFileSync(path.join(keysDir, `starpay_${env}_private.pem`), privateKey);
    fs.writeFileSync(path.join(keysDir, `starpay_${env}_public.pem`), publicKey);
    console.log(`Generated ${env} keys successfully in the 'keys' directory.`);
}

console.log('Generating RSA 2048-bit key pairs...');
generateKeyPair('uat');
generateKeyPair('prod');
