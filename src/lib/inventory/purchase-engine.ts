import crypto from 'crypto';
import { PurchaseStatus } from '@prisma/client';

/**
 * Calculates total purchase order cost from line items.
 */
export function calculatePurchaseTotal(
  items: Array<{ quantity: number; unitCost: number }>
): number {
  const sum = items.reduce((acc, item) => {
    const itemTotal = Math.max(0, item.quantity) * Math.max(0, item.unitCost);
    return acc + itemTotal;
  }, 0);
  return Number(sum.toFixed(2));
}

/**
 * Generates a standard purchase order number.
 * Format: PO-<YYMM>-<RAND>
 */
export function generatePurchaseNumber(prefix: string = 'PO'): string {
  const date = new Date();
  const yearMonth = `${date.getFullYear().toString().slice(-2)}${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-${yearMonth}-${rand}`;
}

/**
 * State machine transition rules for procurement purchases.
 */
export function isValidPurchaseStatusTransition(
  current: PurchaseStatus,
  next: PurchaseStatus
): { valid: boolean; reason?: string } {
  if (current === next) return { valid: true };

  const transitions: Record<PurchaseStatus, PurchaseStatus[]> = {
    ORDERED: ['RECEIVED', 'PARTIAL', 'CANCELLED'],
    PARTIAL: ['RECEIVED', 'CANCELLED'],
    RECEIVED: [], // Received goods are finalized
    CANCELLED: [], // Cancelled orders cannot be revived
  };

  const allowed = transitions[current] || [];
  if (!allowed.includes(next)) {
    return {
      valid: false,
      reason: `Cannot transition purchase order from ${current} to ${next}.`,
    };
  }

  return { valid: true };
}
