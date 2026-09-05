import crypto from 'crypto';

/**
 * Generates an immutable, collision-resistant, human-readable employee code.
 * Format: EMP-YYYY-XXXXXX (e.g. EMP-2026-000001 or EMP-2026-A1B2C3)
 * Never based on phone numbers. Cannot be forged by client input.
 */
export function generateEmployeeCode(prefix = 'EMP', date = new Date()): string {
  const year = date.getFullYear();
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${year}-${randomSuffix}`;
}

/**
 * Sequential/padded formatting helper for employee code numbers.
 * E.g. (1) -> EMP-000001
 */
export function formatSequentialEmployeeCode(seqNumber: number, prefix = 'EMP'): string {
  const padded = String(seqNumber).padStart(6, '0');
  return `${prefix}-${padded}`;
}
