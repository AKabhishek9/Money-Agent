// Client-side AES-256 encryption using Web Crypto API (no external library needed)

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;

async function getEncryptionKey(userId: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(userId.padEnd(32, '0').slice(0, 32)),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new TextEncoder().encode('moneyai-vault'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptField(value: string, userId: string): Promise<string> {
  if (!value) return value;
  const key = await getEncryptionKey(userId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    new TextEncoder().encode(value)
  );
  const combined = new Uint8Array([...iv, ...new Uint8Array(encrypted)]);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptField(encrypted: string, userId: string): Promise<string> {
  if (!encrypted) return encrypted;
  try {
    const key = await getEncryptionKey(userId);
    const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, data);
    return new TextDecoder().decode(decrypted);
  } catch {
    // If decryption fails, the value is likely stored in plaintext (pre-encryption migration)
    return encrypted;
  }
}
