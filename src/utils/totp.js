// Minimal TOTP helper using Web Crypto and Base32
// Implements RFC6238 TOTP (HMAC-SHA1, 30s step, 6 digits)
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32ToBytes(b32) {
  const cleaned = String(b32).replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
  const bytes = [];
  let bits = 0;
  let value = 0;
  for (let i = 0; i < cleaned.length; i++) {
    const idx = alphabet.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

function generateRandomBase32(length = 16) {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  // map to base32 alphabet
  let out = '';
  for (let i = 0; i < arr.length; i++) {
    out += alphabet[arr[i] % 32];
  }
  return out;
}

function toBigEndianBuffer(num) {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  // num may be BigInt, but we'll use Number here for time steps
  const hi = Math.floor(num / Math.pow(2, 32));
  const lo = num >>> 0;
  view.setUint32(0, hi);
  view.setUint32(4, lo);
  return new Uint8Array(buf);
}

async function hmacSha1(keyBytes, message) {
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, message);
  return new Uint8Array(sig);
}

async function generateTOTP(secretBase32, forTime = Date.now(), step = 30, digits = 6) {
  const key = base32ToBytes(secretBase32);
  const counter = Math.floor(forTime / 1000 / step);
  const counterBuf = toBigEndianBuffer(counter);
  const sig = await hmacSha1(key, counterBuf);
  const offset = sig[sig.length - 1] & 0xf;
  const code = ((sig[offset] & 0x7f) << 24) | ((sig[offset + 1] & 0xff) << 16) | ((sig[offset + 2] & 0xff) << 8) | (sig[offset + 3] & 0xff);
  const otp = (code % Math.pow(10, digits)).toString().padStart(digits, '0');
  return otp;
}

async function verifyTOTP(secretBase32, token, window = 1, step = 30, digits = 6) {
  token = String(token).trim();
  const now = Date.now();
  for (let i = -window; i <= window; i++) {
    const t = now + i * step * 1000;
    const generated = await generateTOTP(secretBase32, t, step, digits);
    if (generated === token) return true;
  }
  return false;
}

function otpauthURL({ secret, label = 'dev@deakin', issuer = 'DEV@Deakin', algorithm = 'SHA1', digits = 6, period = 30 }) {
  const params = new URLSearchParams({ secret, issuer, algorithm, digits: String(digits), period: String(period) });
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?${params.toString()}`;
}

export { generateRandomBase32, generateTOTP, verifyTOTP, otpauthURL };
