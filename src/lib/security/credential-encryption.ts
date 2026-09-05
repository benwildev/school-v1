import crypto from 'crypto';

/**
 * Derives a 32-byte key from environment secret or a secure fallback.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.DEVICE_CREDENTIAL_SECRET || process.env.NEXTAUTH_SECRET || 'edusmart-bd-production-device-encryption-key-salt-2026';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts sensitive device credentials or secrets using AES-256-GCM.
 * Output format: iv_hex:authTag_hex:ciphertext_hex
 */
export function encryptCredential(plaintext: string): string {
  if (!plaintext) return '';
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;
}

/**
 * Decrypts AES-256-GCM encrypted credentials.
 * Expects format: iv_hex:authTag_hex:ciphertext_hex
 */
export function decryptCredential(encryptedText: string): string {
  if (!encryptedText) return '';
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted credential format');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = getEncryptionKey();

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generates a SHA-256 hash of an API key for fast, secure lookup without storing plaintext.
 */
export function hashApiKey(apiKey: string): string {
  if (!apiKey) return '';
  return crypto.createHash('sha256').update(apiKey.trim()).digest('hex');
}

/**
 * Constant-time comparison for API keys and webhook signatures.
 */
export function secureTimingSafeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Redacts sensitive credentials from device objects before returning to clients or writing to logs.
 */
export function redactDeviceSecrets<T extends Record<string, any>>(device: T): Omit<T, 'credentialsEncrypted' | 'apiKeyHash'> & { hasCredentials: boolean } {
  const { credentialsEncrypted, apiKeyHash, ...safeDevice } = device;
  return {
    ...safeDevice,
    hasCredentials: Boolean(credentialsEncrypted || apiKeyHash),
  } as any;
}

/**
 * General sanitizer to ensure objects never leak passwords, tokens, or device keys in logs or audit records.
 */
export function sanitizeLogPayload(payload: any): any {
  if (!payload || typeof payload !== 'object') return payload;
  if (Array.isArray(payload)) return payload.map(sanitizeLogPayload);

  const sensitiveKeys = new Set([
    'password',
    'passwordhash',
    'password_hash',
    'token',
    'accesstoken',
    'refreshtoken',
    'apikey',
    'api_key',
    'secret',
    'credentials',
    'credentialsencrypted',
    'credentials_encrypted',
    'apikeyhash',
    'api_key_hash',
    'otp',
  ]);

  const sanitized: Record<string, any> = {};
  for (const [k, v] of Object.entries(payload)) {
    const normalizedKey = k.toLowerCase().replace(/[-_]/g, '');
    if (
      sensitiveKeys.has(normalizedKey) ||
      normalizedKey.includes('secret') ||
      normalizedKey.includes('token') ||
      normalizedKey.includes('password') ||
      normalizedKey.includes('apikey')
    ) {
      sanitized[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      sanitized[k] = sanitizeLogPayload(v);
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

// Aliases for compatibility
export const encryptDeviceCredentials = encryptCredential;
export const decryptDeviceCredentials = decryptCredential;
export const verifyApiKey = (providedKey: string, storedHash: string): boolean => {
  const computedHash = hashApiKey(providedKey);
  return secureTimingSafeCompare(computedHash, storedHash);
};
export const redactSensitiveData = sanitizeLogPayload;

