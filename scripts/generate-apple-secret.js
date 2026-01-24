/**
 * Generate Apple Sign In client secret (JWT) for Supabase
 *
 * Usage:
 *   1. Download your .p8 key file from Apple Developer
 *   2. Fill in the values below
 *   3. Run: node scripts/generate-apple-secret.js
 */

const crypto = require('crypto');

// ============ FILL THESE IN ============
const TEAM_ID = '2MMDRLGY9S';           // Your Apple Team ID (from Apple Developer account)
const KEY_ID = 'N38QF3JS2F';              // The Key ID shown when you created the key
const CLIENT_ID = 'com.snipeditor.web';  // Your Services ID

// Paste your .p8 file contents here (including the BEGIN/END lines)
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
PASTE_YOUR_KEY_HERE
-----END PRIVATE KEY-----`;
// =======================================

function generateAppleClientSecret() {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + (86400 * 180); // 180 days (max is 6 months)

  const header = {
    alg: 'ES256',
    kid: KEY_ID,
    typ: 'JWT'
  };

  const payload = {
    iss: TEAM_ID,
    iat: now,
    exp: expiry,
    aud: 'https://appleid.apple.com',
    sub: CLIENT_ID
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const sign = crypto.createSign('SHA256');
  sign.update(signatureInput);
  const signature = sign.sign(PRIVATE_KEY);

  // Convert DER signature to raw r||s format for ES256
  const rawSignature = derToRaw(signature);
  const encodedSignature = base64url(rawSignature);

  const jwt = `${signatureInput}.${encodedSignature}`;

  return jwt;
}

function base64url(input) {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function derToRaw(derSignature) {
  // DER format: 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]
  let offset = 2;
  if (derSignature[1] & 0x80) {
    offset += (derSignature[1] & 0x7f);
  }

  const rLength = derSignature[offset + 1];
  let rStart = offset + 2;
  let rBytes = derSignature.slice(rStart, rStart + rLength);

  const sOffset = rStart + rLength;
  const sLength = derSignature[sOffset + 1];
  let sStart = sOffset + 2;
  let sBytes = derSignature.slice(sStart, sStart + sLength);

  // Remove leading zeros if present (DER encoding adds them for positive numbers)
  if (rBytes.length === 33 && rBytes[0] === 0) rBytes = rBytes.slice(1);
  if (sBytes.length === 33 && sBytes[0] === 0) sBytes = sBytes.slice(1);

  // Pad to 32 bytes if needed
  const r = Buffer.alloc(32);
  const s = Buffer.alloc(32);
  rBytes.copy(r, 32 - rBytes.length);
  sBytes.copy(s, 32 - sBytes.length);

  return Buffer.concat([r, s]);
}

// Run it
try {
  if (PRIVATE_KEY.includes('PASTE_YOUR_KEY_HERE')) {
    console.log('Please edit this file and fill in your credentials:\n');
    console.log('  1. KEY_ID - from Apple Developer when you created the key');
    console.log('  2. PRIVATE_KEY - contents of your downloaded .p8 file\n');
    process.exit(1);
  }

  const secret = generateAppleClientSecret();
  console.log('\n========== YOUR APPLE CLIENT SECRET ==========\n');
  console.log(secret);
  console.log('\n===============================================');
  console.log('\nCopy this entire string and paste it into Supabase');
  console.log('Apple provider "Secret Key" field.\n');
  console.log('This secret expires in 180 days. Set a reminder to regenerate it.\n');
} catch (error) {
  console.error('Error generating secret:', error.message);
  process.exit(1);
}
