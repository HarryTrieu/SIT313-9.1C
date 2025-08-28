// Minimal hashing helper using Web Crypto
export async function hashString(input) {
  const enc = new TextEncoder();
  const data = enc.encode(String(input));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
