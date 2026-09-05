/**
 * Bangladeshi Mobile Phone Normalization & Validation Utility
 *
 * Valid mobile operators in Bangladesh:
 * 013, 017 - Grameenphone
 * 014, 019 - Banglalink
 * 018 - Robi
 * 016 - Airtel (merged with Robi)
 * 015 - Teletalk
 */

export interface PhoneNormalizationResult {
  isValid: boolean;
  normalizedPhone?: string; // Canonical E.164: +8801XXXXXXXXX
  localPhone?: string;      // 01XXXXXXXXX
  operator?: string;        // 'Grameenphone' | 'Banglalink' | 'Robi' | 'Airtel' | 'Teletalk'
  error?: string;
}

const OPERATOR_PREFIX_MAP: Record<string, string> = {
  '013': 'Grameenphone',
  '017': 'Grameenphone',
  '014': 'Banglalink',
  '019': 'Banglalink',
  '018': 'Robi',
  '016': 'Airtel',
  '015': 'Teletalk',
};

/**
 * Normalizes a given phone string to canonical E.164 format (+8801XXXXXXXXX).
 */
export function normalizeBangladeshiPhone(input: string | null | undefined): PhoneNormalizationResult {
  if (!input) {
    return { isValid: false, error: 'Phone number is required' };
  }

  // Remove spaces, hyphens, parentheses, plus signs
  let cleaned = input.trim().replace(/[\s\-().]/g, '');

  // Handle leading '+'
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // Strip leading 88 or 880
  if (cleaned.startsWith('880')) {
    cleaned = cleaned.substring(2); // leaves '01XXXXXXXXX'
  } else if (cleaned.startsWith('88') && cleaned.length === 13) {
    cleaned = cleaned.substring(2);
  }

  // If missing leading 0 (e.g. '1712345678', 10 digits)
  if (cleaned.length === 10 && cleaned.startsWith('1')) {
    cleaned = '0' + cleaned;
  }

  // Check 11-digit local format: 01[3-9]\d{8}
  if (!/^01[3-9]\d{8}$/.test(cleaned)) {
    return {
      isValid: false,
      error: `Invalid Bangladeshi mobile number: ${input}. Must be an 11-digit number starting with 01[3-9].`,
    };
  }

  const prefix = cleaned.substring(0, 3);
  const operator = OPERATOR_PREFIX_MAP[prefix] || 'Unknown';
  const normalizedPhone = `+88${cleaned}`;

  return {
    isValid: true,
    normalizedPhone,
    localPhone: cleaned,
    operator,
  };
}

/**
 * Formats a normalized phone number for UI display in Bangladesh.
 * e.g. +8801712345678 -> 01712-345678
 */
export function formatPhoneForDisplay(phone: string | null | undefined): string {
  const res = normalizeBangladeshiPhone(phone);
  if (!res.isValid || !res.localPhone) return phone || '';
  return `${res.localPhone.slice(0, 5)}-${res.localPhone.slice(5)}`;
}

/**
 * Checks if a string is a valid Bangladeshi phone number.
 */
export function isValidBangladeshiPhone(input: string | null | undefined): boolean {
  const res = normalizeBangladeshiPhone(input);
  return res.isValid;
}

/**
 * Masks a phone number for privacy in logs and UI.
 * e.g. +8801712345678 -> +88017****5678
 */
export function maskPhoneNumber(phone: string | null | undefined): string {
  const res = normalizeBangladeshiPhone(phone);
  if (!res.isValid || !res.normalizedPhone) return phone || '';
  const p = res.normalizedPhone;
  return `${p.slice(0, 6)}****${p.slice(10)}`;
}

