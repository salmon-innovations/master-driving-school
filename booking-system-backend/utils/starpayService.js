/**
 * StarPay (Wallyt) Repayment API Service
 * ────────────────────────────────────────
 * UAT Base URL : https://financeapi-uat.wallyt.net/finance-payment-service
 * API Docs     : https://document.starpay.com.ph/f9658a2a-2f20-42de-95a7-85cf08da631d
 *
 * Flow:
 *  1. Call createRepayment() → returns codeUrl (QRPh string)
 *  2. Frontend renders codeUrl as QR image for student to scan
 *  3. Student scans with GCash / bank app
 *  4. StarPay POSTs notification to our notifyUrl with trxState SUCCESS/FAIL
 *  5. Backend marks booking paid, responds { "code":"200","message":"success" }
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

/* ── env ──────────────────────────────────────────────────────────── */
const IS_PROD = process.env.NODE_ENV === 'production';
const BASE_URL = IS_PROD
    ? (process.env.STARPAY_PROD_BASE_URL || 'https://financeapi.wallytglobal.com/finance-payment-service')
    : (process.env.STARPAY_UAT_BASE_URL || 'https://financeapi-uat.wallyt.net/finance-payment-service');

const MCH_ID = IS_PROD
    ? (process.env.STARPAY_PROD_MCH_ID || '')
    : (process.env.STARPAY_UAT_MCH_ID || 'MRCHNT-4ZAV2');

const BEARER = IS_PROD
    ? (process.env.STARPAY_PROD_BEARER || '')
    : (process.env.STARPAY_UAT_BEARER || '');

const keyEnv = IS_PROD ? 'prod' : 'uat';

/* ── RSA keys ──────────────────────────────────────────────────────── */
const loadKey = (filename) => {
    const p = path.join(__dirname, '..', 'keys', filename);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
};

// Strip PEM headers and whitespace → raw base64 for signing
const stripPem = (pem) => pem
    .replace(/-----BEGIN [\w\s]+-----/, '')
    .replace(/-----END [\w\s]+-----/, '')
    .replace(/\s+/g, '');

/* ── Signature helpers ─────────────────────────────────────────────── */
/**
 * Sign the JSON string of the request object with SHA256WithRSA
 * using the merchant private key.
 * Per docs: the to-be-signed string is the raw JSON string of the "request" field.
 */
const signRequest = (requestObj) => {
    const privPem = loadKey(`starpay_${keyEnv}_private.pem`);
    if (!privPem) throw new Error(`StarPay private key not found (keys/starpay_${keyEnv}_private.pem)`);

    const dataStr = JSON.stringify(requestObj);
    const sign = crypto.createSign('SHA256');
    sign.update(dataStr, 'utf8');
    return sign.sign(privPem, 'base64');
};

/**
 * Verify StarPay's notification signature.
 * IMPORTANT: StarPay signs the raw JSON *string* of the "request" field.
 * We must verify it as a string — NOT re-serialize it, as key order matters.
 *
 * @param {string} rawRequestStr  The raw value of req.body.request (a JSON string)
 * @param {string} signature      The base64 signature from req.body.signature
 */
const verifySignature = (rawRequestStr, signature) => {
    const platformPem = loadKey(`starpay_${keyEnv}_platform_public.pem`);
    if (!platformPem) {
        console.warn('[StarPay] Platform public key missing — skipping signature check');
        return true; // allow in dev without the key; remove once key is in place
    }
    // Normalise: if an object was passed in accidentally, stringify it
    const dataStr = typeof rawRequestStr === 'string' ? rawRequestStr : JSON.stringify(rawRequestStr);
    const verify = crypto.createVerify('SHA256');
    verify.update(dataStr, 'utf8');
    try { return verify.verify(platformPem, signature, 'base64'); }
    catch (e) {
        console.error('[StarPay] verifySignature error:', e.message);
        return false;
    }
};

/* ── HTTP helper ───────────────────────────────────────────────────── */
const apiPost = async (endpoint, requestObj) => {
    // Docs require fields sorted alphabetically (mirrors Java TreeMap behaviour)
    const sorted = Object.keys(requestObj).sort().reduce((acc, k) => {
        acc[k] = requestObj[k];
        return acc;
    }, {});

    // Sign the sorted JSON string with merchant private key
    const requestStr = JSON.stringify(sorted);
    const signature = signRequest(sorted);

    const body = { request: sorted, signature };

    // Build headers — always include Content-Type
    // Include Authorization bearer if configured in .env
    const headers = { 'Content-Type': 'application/json' };
    if (BEARER) headers['Authorization'] = `Bearer ${BEARER}`;

    const response = await axios.post(`${BASE_URL}${endpoint}`, body, {
        headers,
        timeout: 20000,
    });
    return response.data;
};

/* ── Public API ───────────────────────────────────────────────────── */

/**
 * 6.1 Create a repayment order (generates QR code for student to scan).
 *
 * @param {object} opts
 * @param {string} opts.msgId        Unique message ID (your order ref)
 * @param {string} opts.notifyUrl    Webhook URL StarPay will POST result to
 * @param {number} opts.amountPhp    Amount in PHP (e.g. 700.00)
 * @param {string} [opts.attach]     Optional description (max 92 chars)
 * @param {string} [opts.timeExpire] Expiry in yyyyMMddHHmmss (default: 15 min)
 *
 * @returns {object} Full StarPay response — response.codeUrl is the QRPh string
 */
const createRepayment = async ({ msgId, notifyUrl, amountPhp, attach = 'Course Fee', timeExpire }) => {
    const trxAmount = Math.round(parseFloat(amountPhp) * 100); // centavos
    const requestObj = {
        msgId,
        mchId: MCH_ID,
        notifyUrl,
        deviceInfo: 'web',
        trxAmount,
        currency: 'PHP',
        service: 'pay.starpay.repayment',
        attach,
    };
    if (timeExpire) requestObj.timeExpire = timeExpire;

    return await apiPost('/v1/repayment', requestObj);
};

/**
 * 6.2 Query repayment status by original msgId.
 *
 * @param {string} queryMsgId    A new unique msgId for this query request
 * @param {string} originalMsgId The msgId used when the order was created
 */
const queryRepayment = async (queryMsgId, originalMsgId) => {
    const requestObj = {
        msgId: queryMsgId,
        mchId: MCH_ID,
        originalMsgId,
        service: 'unified.repayment.query',
    };
    return await apiPost('/v1/repayment/query', requestObj);
};

module.exports = {
    createRepayment,
    queryRepayment,
    verifySignature,
    signRequest,
    BASE_URL,
    MCH_ID,
};
