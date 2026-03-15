const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const BASE_URL = 'https://financeapi-uat.wallyt.net/finance-payment-service';
const BEARER = process.env.STARPAY_UAT_BEARER || '';

const MCH_IDS_TO_TRY = [
  'MRCHNT-4ZAV2',
  '101550000011',
];

async function test(MCH_ID) {
  console.log(`\n=========================================`);
  console.log(`mchId   : ${MCH_ID}`);
  console.log(`Bearer  : ${BEARER ? BEARER.substring(0, 12) + '...' : 'NONE'}`);

  const privPem = fs.readFileSync(path.join('keys', 'starpay_uat_private.pem'), 'utf8');

  const reqObj = {
    attach: 'Test payment',
    currency: 'PHP',
    deviceInfo: 'web',
    mchId: MCH_ID,
    msgId: 'MDSTEST' + Date.now(),
    notifyUrl: 'https://example.com/wh',
    service: 'pay.starpay.repayment',
    trxAmount: 10000,
  };

  // Sort keys alphabetically (required by StarPay)
  const sorted = Object.keys(reqObj).sort().reduce((acc, k) => {
    acc[k] = reqObj[k];
    return acc;
  }, {});

  const reqStr = JSON.stringify(sorted);

  const sign = crypto.createSign('SHA256');
  sign.update(reqStr, 'utf8');
  const sig = sign.sign(privPem, 'base64');

  const headers = { 'Content-Type': 'application/json' };
  if (BEARER) headers['Authorization'] = `Bearer ${BEARER}`;

  // Try 1: request as object
  try {
    const r = await axios.post(
      `${BASE_URL}/v1/repayment`,
      { request: sorted, signature: sig },
      { headers, timeout: 20000 }
    );
    console.log(`[OBJ] ${r.data?.response?.code} - ${r.data?.response?.message}`);
    if (r.data?.response?.code === '200') console.log('SUCCESS!', JSON.stringify(r.data, null, 2));
  } catch (e) {
    console.log(`[OBJ] HTTP ${e.response?.status}:`, JSON.stringify(e.response?.data));
  }

  // Try 2: request as string
  try {
    const r2 = await axios.post(
      `${BASE_URL}/v1/repayment`,
      { request: reqStr, signature: sig },
      { headers, timeout: 20000 }
    );
    console.log(`[STR] ${r2.data?.response?.code} - ${r2.data?.response?.message}`);
    if (r2.data?.response?.code === '200') console.log('SUCCESS!', JSON.stringify(r2.data, null, 2));
  } catch (e) {
    console.log(`[STR] HTTP ${e.response?.status}:`, JSON.stringify(e.response?.data));
  }
}

async function main() {
  for (const id of MCH_IDS_TO_TRY) {
    await test(id);
  }
}

main();
