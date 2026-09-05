import crypto from 'crypto';

/**
 * Generates an auditable, human-readable, collision-resistant payslip number.
 * Format: PAY-YYYYMM-XXXXXX (e.g. PAY-202601-A1B2C3)
 */
export function generatePayslipNumber(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `PAY-${year}${month}-${randomSuffix}`;
}

/**
 * Generates an auditable salary payment transaction number.
 * Format: PAYMT-YYYYMM-XXXXXX
 */
export function generatePayrollPaymentNumber(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `PAYMT-${year}${month}-${randomSuffix}`;
}

/**
 * Generates an advance requisition number.
 * Format: ADV-YYYYMM-XXXXXX
 */
export function generateAdvanceNumber(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `ADV-${year}${month}-${randomSuffix}`;
}

/**
 * Localized BDT currency formatter
 */
export function formatBDT(amount: number): string {
  return `৳ ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
