export interface FineCalculationParams {
  overdueDays: number;
  dailyRate: number;
  acquisitionCost?: number;
  multiplier?: number;
  replacementFee?: number;
  damageFlat?: number;
  assessedDamage?: number;
}

/**
 * Calculates overdue book fine: overdueDays * dailyRate.
 */
export function calculateOverdueFine(overdueDays: number, dailyRate: number): number {
  if (overdueDays <= 0 || dailyRate <= 0) return 0;
  const amount = overdueDays * dailyRate;
  return Number(amount.toFixed(2));
}

/**
 * Calculates lost book charge: (acquisitionCost * multiplier) + replacementFee.
 */
export function calculateLostBookCharge(
  acquisitionCost: number = 0,
  multiplier: number = 1.0,
  replacementFee: number = 0
): number {
  const base = Math.max(0, acquisitionCost) * Math.max(0, multiplier);
  const total = base + Math.max(0, replacementFee);
  return Number(total.toFixed(2));
}

/**
 * Calculates damage fine based on assessed or flat fee.
 */
export function calculateDamageCharge(
  damageFlat: number = 0,
  assessedDamage?: number | null
): number {
  if (assessedDamage != null && assessedDamage >= 0) {
    return Number(assessedDamage.toFixed(2));
  }
  return Number(Math.max(0, damageFlat).toFixed(2));
}

/**
 * Computes net balance on a fine record.
 */
export function calculateFineBalance(
  fineAmount: number,
  waivedAmount: number = 0,
  paidAmount: number = 0
): {
  balance: number;
  isSettled: boolean;
  isFullyWaived: boolean;
} {
  const safeFine = Math.max(0, fineAmount);
  const safeWaived = Math.max(0, waivedAmount);
  const safePaid = Math.max(0, paidAmount);

  const balance = Math.max(0, Number((safeFine - safeWaived - safePaid).toFixed(2)));
  const isFullyWaived = safeWaived >= safeFine && safeFine > 0;
  const isSettled = balance === 0;

  return { balance, isSettled, isFullyWaived };
}

/**
 * Formats historical calculation parameters for permanent audit reproducibility.
 */
export function createFineSnapshot(params: {
  fineType: string;
  overdueDays?: number;
  dailyRate?: number;
  acquisitionCost?: number;
  multiplier?: number;
  calculatedAmount: number;
  assessedByUserId?: string;
}) {
  return {
    ...params,
    calculatedAt: new Date().toISOString(),
    engineVersion: '1.0.0',
  };
}
