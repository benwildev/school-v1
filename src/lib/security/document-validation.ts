import crypto from 'crypto';

export const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_DOCUMENT_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedDocumentMime = typeof ALLOWED_DOCUMENT_MIMES[number];

export const ALLOWED_DOCUMENT_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'] as const;

/**
 * Validates binary file buffer against magic byte signatures to prevent MIME spoofing.
 */
export function detectMagicMime(buffer: Buffer): AllowedDocumentMime | null {
  if (buffer.length < 4) return null;

  // PDF: %PDF (0x25 0x50 0x44 0x46)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return 'application/pdf';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return 'image/png';
  }

  // JPEG / JPG: FF D8 FF
  if (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  // WEBP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Sanitizes and generates a cryptographically random server-side storage filename.
 * Guarantees zero path traversal (../ or ..\), no script execution, and safe extension mapping.
 */
export function generateSafeServerFilename(mime: AllowedDocumentMime): string {
  const extensionMap: Record<AllowedDocumentMime, string> = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };

  const ext = extensionMap[mime] || '.bin';
  const randomId = crypto.randomUUID();
  return `${randomId}${ext}`;
}

/**
 * Validates uploaded binary document against size, extension, and binary magic bytes.
 */
export function validateDocumentUpload(
  buffer: Buffer,
  clientFileName?: string
): { valid: boolean; error?: string; detectedMime?: AllowedDocumentMime; safeFilename?: string } {
  if (buffer.length > MAX_DOCUMENT_SIZE_BYTES) {
    return {
      valid: false,
      error: `ফাইলের আকার সর্বোচ্চ ৫ মেগাবাইট হতে পারবে (বর্তমান আকার: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB)।`,
    };
  }

  if (buffer.length === 0) {
    return { valid: false, error: 'ফাইলটি খালি বা অকার্যকর।' };
  }

  // Verify client extension if provided
  if (clientFileName) {
    const lowerName = clientFileName.toLowerCase();
    // Check path traversal attempts
    if (lowerName.includes('..') || lowerName.includes('/') || lowerName.includes('\\')) {
      return { valid: false, error: 'অবৈধ ফাইলনেম বা পাথ ব্যবহারের চেষ্টা করা হয়েছে।' };
    }

    const hasAllowedExt = ALLOWED_DOCUMENT_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    if (!hasAllowedExt) {
      return {
        valid: false,
        error: 'শুধুমাত্র PDF, JPG, JPEG, PNG এবং WEBP ফাইল গ্রহণযোগ্য।',
      };
    }
  }

  // Verify real binary content via magic bytes
  const detectedMime = detectMagicMime(buffer);
  if (!detectedMime) {
    return {
      valid: false,
      error: 'ফাইলের ভেতরের তথ্য অকার্যকর বা গ্রহণযোগ্য ফরম্যাটের সাথে মিলছে না (MIME spoofing প্রতিরোধ)।',
    };
  }

  const safeFilename = generateSafeServerFilename(detectedMime);
  return { valid: true, detectedMime, safeFilename };
}

/**
 * Validates document URLs to prevent Server-Side Request Forgery (SSRF)
 * and malicious URI schemes (javascript:, file:, data:, etc.).
 */
export function validateDocumentUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: 'শুধুমাত্র নিরাপদ HTTP/HTTPS প্রোটোকল অনুমোদিত।' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block localhost and loopback
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]') {
      return { valid: false, error: 'অভ্যন্তরীণ বা সংরক্ষিত আইপি অ্যাক্সেস নিষিদ্ধ।' };
    }

    // Block cloud metadata service IP
    if (hostname === '169.254.169.254') {
      return { valid: false, error: 'ক্লাউড মেটাডাটা সার্ভিসে অ্যাক্সেস নিষিদ্ধ।' };
    }

    // Block private RFC 1918 IPv4 ranges
    if (
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    ) {
      return { valid: false, error: 'ব্যক্তিগত লোকাল নেটওয়ার্ক আইপি অ্যাক্সেস নিষিদ্ধ।' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'অবৈধ ফাইল ইউআরএল ফরম্যাট।' };
  }
}
