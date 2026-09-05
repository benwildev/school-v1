import crypto from 'crypto';
import { BookCopyStatus } from '@prisma/client';

/**
 * Generates a scanner-compatible barcode string.
 * Format: BC-<prefix>-<timestamp>-<rand>
 */
export function generateBarcode(prefix: string = 'LIB'): string {
  const cleanPrefix = prefix.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'LIB';
  const timestamp = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${cleanPrefix}-${timestamp}-${rand}`;
}

/**
 * Generates an accession number string for a physical book copy.
 * Format: ACC-<timestamp>-<rand>
 */
export function generateAccessionNumber(prefix: string = 'ACC'): string {
  const cleanPrefix = prefix.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'ACC';
  const timestamp = Date.now().toString().slice(-6);
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${cleanPrefix}-${timestamp}-${rand}`;
}

/**
 * Validates and normalizes ISBN-10 and ISBN-13 strings.
 * Optional: Returns valid=true for null/undefined/empty string.
 */
export function validateIsbn(isbn?: string | null): { valid: boolean; normalized?: string; error?: string } {
  if (!isbn || isbn.trim() === '') {
    return { valid: true };
  }

  const clean = isbn.replace(/[-\s]/g, '').toUpperCase();

  if (clean.length === 10) {
    // ISBN-10 validation
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      const digit = parseInt(clean[i], 10);
      if (isNaN(digit)) return { valid: false, error: 'Invalid character in ISBN-10' };
      sum += digit * (10 - i);
    }
    const lastChar = clean[9];
    const checkDigit = lastChar === 'X' ? 10 : parseInt(lastChar, 10);
    if (isNaN(checkDigit)) return { valid: false, error: 'Invalid check digit in ISBN-10' };
    sum += checkDigit;

    if (sum % 11 !== 0) {
      return { valid: false, error: 'Checksum mismatch for ISBN-10' };
    }
    return { valid: true, normalized: clean };
  }

  if (clean.length === 13) {
    // ISBN-13 validation
    if (!clean.startsWith('978') && !clean.startsWith('979')) {
      return { valid: false, error: 'ISBN-13 must begin with 978 or 979' };
    }
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(clean[i], 10);
      if (isNaN(digit)) return { valid: false, error: 'Invalid character in ISBN-13' };
      sum += digit * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = parseInt(clean[12], 10);
    if (isNaN(checkDigit)) return { valid: false, error: 'Invalid check digit in ISBN-13' };
    const calculatedCheck = (10 - (sum % 10)) % 10;

    if (checkDigit !== calculatedCheck) {
      return { valid: false, error: 'Checksum mismatch for ISBN-13' };
    }
    return { valid: true, normalized: clean };
  }

  return { valid: false, error: 'ISBN must be 10 or 13 characters long' };
}

/**
 * Validates physical book copy status lifecycle transitions.
 */
export function isValidCopyStatusTransition(
  currentStatus: BookCopyStatus,
  nextStatus: BookCopyStatus
): { valid: boolean; reason?: string } {
  if (currentStatus === nextStatus) {
    return { valid: true };
  }

  const validTransitions: Record<BookCopyStatus, BookCopyStatus[]> = {
    AVAILABLE: ['ISSUED', 'RESERVED', 'DAMAGED', 'LOST', 'WITHDRAWN', 'MAINTENANCE'],
    ISSUED: ['AVAILABLE', 'DAMAGED', 'LOST'],
    RESERVED: ['AVAILABLE', 'ISSUED', 'WITHDRAWN'],
    MAINTENANCE: ['AVAILABLE', 'DAMAGED', 'WITHDRAWN'],
    DAMAGED: ['AVAILABLE', 'MAINTENANCE', 'WITHDRAWN'],
    LOST: ['AVAILABLE', 'WITHDRAWN'], // Found book can return to AVAILABLE or be written off
    WITHDRAWN: [], // Terminal status
  };

  const allowed = validTransitions[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    return {
      valid: false,
      reason: `Cannot transition book copy from ${currentStatus} to ${nextStatus}.`,
    };
  }

  return { valid: true };
}

/**
 * Aggregates copy quantities by status and condition.
 */
export function calculateBookInventorySummary(
  copies: Array<{ status: string; condition: string }>
) {
  const summary = {
    totalCopies: copies.length,
    available: 0,
    issued: 0,
    reserved: 0,
    lost: 0,
    damaged: 0,
    maintenance: 0,
    withdrawn: 0,
  };

  for (const copy of copies) {
    switch (copy.status) {
      case 'AVAILABLE':
        summary.available++;
        break;
      case 'ISSUED':
        summary.issued++;
        break;
      case 'RESERVED':
        summary.reserved++;
        break;
      case 'LOST':
        summary.lost++;
        break;
      case 'DAMAGED':
        summary.damaged++;
        break;
      case 'MAINTENANCE':
        summary.maintenance++;
        break;
      case 'WITHDRAWN':
        summary.withdrawn++;
        break;
      default:
        break;
    }
  }

  return summary;
}
