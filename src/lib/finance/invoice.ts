import crypto from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';
import { DiscountCalculationType } from '@prisma/client';
import { toDecimal, addMoney, subMoney, mulMoney } from './money';

/**
 * Generates an auditable, human-readable, non-colliding invoice number.
 * Format: INV-YYYYMM-XXXXXX
 */
export function generateInvoiceNumber(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `INV-${yyyy}${mm}-${random}`;
}

/**
 * Generates an auditable, non-colliding payment reference number.
 * Format: PAY-YYYYMM-XXXXXX
 */
export function generatePaymentNumber(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `PAY-${yyyy}${mm}-${random}`;
}

/**
 * Generates an official money receipt number.
 * Format: RCT-YYYYMM-XXXXXX
 */
export function generateReceiptNumber(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `RCT-${yyyy}${mm}-${random}`;
}

/**
 * Generates a refund reference number.
 * Format: REF-YYYYMM-XXXXXX
 */
export function generateRefundNumber(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `REF-${yyyy}${mm}-${random}`;
}

export interface DiscountCalculationInput {
  baseAmount: number | Decimal;
  discountType: DiscountCalculationType;
  discountValue: number | Decimal;
  fineAmount?: number | Decimal;
}

export interface DiscountCalculationOutput {
  baseAmount: Decimal;
  discountAmount: Decimal;
  fineAmount: Decimal;
  netAmount: Decimal;
}

/**
 * Evaluates and computes the effective discount amount and net payable amount.
 * Invariants:
 * 1. discountAmount >= 0
 * 2. discountAmount <= baseAmount (Never allow discount to exceed base amount)
 * 3. netAmount = baseAmount + fineAmount - discountAmount >= 0
 */
export function calculateEffectiveDiscount(
  input: DiscountCalculationInput
): DiscountCalculationOutput {
  const base = toDecimal(input.baseAmount);
  const fine = toDecimal(input.fineAmount || 0);
  const val = toDecimal(input.discountValue);

  if (base.isNegative()) {
    throw new Error('Base amount cannot be negative');
  }
  if (fine.isNegative()) {
    throw new Error('Fine amount cannot be negative');
  }
  if (val.isNegative()) {
    throw new Error('Discount value cannot be negative');
  }

  let calculatedDiscount: Decimal;

  if (input.discountType === DiscountCalculationType.PERCENTAGE) {
    if (val.greaterThan(100)) {
      throw new Error('Percentage discount cannot exceed 100%');
    }
    // base * (val / 100)
    calculatedDiscount = mulMoney(base, val.dividedBy(100));
  } else {
    // Fixed amount
    calculatedDiscount = val;
  }

  // Cap discount at baseAmount so netAmount never drops below fineAmount
  if (calculatedDiscount.greaterThan(base)) {
    calculatedDiscount = base;
  }

  const net = subMoney(addMoney(base, fine), calculatedDiscount);

  return {
    baseAmount: base,
    discountAmount: calculatedDiscount,
    fineAmount: fine,
    netAmount: net,
  };
}
