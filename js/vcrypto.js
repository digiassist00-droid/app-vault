// Encryption ng mga secret sa loob ng browser. Ang Firebase ay nakakakita lang ng ciphertext.
// AES-256-GCM, ang key ay galing sa team passphrase gamit ang PBKDF2-SHA256.
const enc = new TextEncoder();
const dec = new TextDecoder();
const ITER = 310000;
const CHECK = 'appvault-ok';

export function b64e(buf) {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}
export function b64d(str) {
  const s = atob(str);
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}
export const isEnc = (s) => typeof s === 'string' && s.startsWith('v1.');

export async function deriveVaultKey(pass, saltB64, iter) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: b64d(saltB64), iterations: iter, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}
export async function encStr(key, str) {
  if (str == null || str === '') return '';
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(String(str)));
  return 'v1.' + b64e(iv) + '.' + b64e(ct);
}
export async function decStr(key, s) {
  if (!s) return '';
  if (!isEnc(s)) return s;
  const parts = s.split('.');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(parts[1]) }, key, b64d(parts[2]));
  return dec.decode(pt);
}
export async function createVaultMeta(pass) {
  const salt = b64e(crypto.getRandomValues(new Uint8Array(16)));
  const key = await deriveVaultKey(pass, salt, ITER);
  return { meta: { salt, iter: ITER, verifier: await encStr(key, CHECK) }, key };
}
export async function openVault(pass, meta) {
  const key = await deriveVaultKey(pass, meta.salt, meta.iter);
  if ((await decStr(key, meta.verifier)) !== CHECK) throw new Error('bad passphrase');
  return key;
}
export async function encBytes(key, buf) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, buf);
  return { iv: b64e(iv), data: b64e(ct) };
}
export async function decBytes(key, ivB64, dataB64) {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(ivB64) }, key, b64d(dataB64));
}
