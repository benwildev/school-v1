import { StockMovementType } from '@prisma/client';

export const STOCK_IN_TYPES: StockMovementType[] = [
  'PURCHASE_IN',
  'TRANSFER_IN',
  'RETURN_IN',
  'ADJUSTMENT_IN',
];

export const STOCK_OUT_TYPES: StockMovementType[] = [
  'TRANSFER_OUT',
  'ISSUE_OUT',
  'ADJUSTMENT_OUT',
  'DAMAGE',
  'LOSS',
  'DISPOSAL',
];

/**
 * Returns true if the movement type increases stock.
 */
export function isStockInMovement(type: StockMovementType): boolean {
  return STOCK_IN_TYPES.includes(type);
}

/**
 * Returns true if the movement type decreases stock.
 */
export function isStockOutMovement(type: StockMovementType): boolean {
  return STOCK_OUT_TYPES.includes(type);
}

/**
 * Calculates net available stock quantity from authoritative ledger movements.
 * Net Stock = sum(STOCK_IN) - sum(STOCK_OUT)
 */
export function calculateCurrentStock(
  movements: Array<{ movementType: StockMovementType; quantity: number }>
): number {
  let stock = 0;
  for (const m of movements) {
    if (isStockInMovement(m.movementType)) {
      stock += m.quantity;
    } else if (isStockOutMovement(m.movementType)) {
      stock -= m.quantity;
    }
  }
  return stock;
}

/**
 * Validates whether sufficient stock exists for an outbound movement.
 * Prevents negative stock balances under all circumstances.
 */
export function validateStockAvailability(
  currentStock: number,
  requestedQuantity: number
): {
  available: boolean;
  remaining: number;
  error?: string;
} {
  if (requestedQuantity <= 0) {
    return {
      available: false,
      remaining: currentStock,
      error: 'Requested quantity must be greater than zero.',
    };
  }

  if (currentStock < requestedQuantity) {
    return {
      available: false,
      remaining: currentStock,
      error: `Insufficient stock. Current available quantity is ${currentStock}, but ${requestedQuantity} was requested.`,
    };
  }

  return {
    available: true,
    remaining: currentStock - requestedQuantity,
  };
}

/**
 * Evaluates whether stock level triggers low-stock or reorder warnings.
 */
export function evaluateStockThresholds(
  currentStock: number,
  minStockLevel: number = 0,
  reorderLevel: number = 0
): {
  isLowStock: boolean;
  isCriticallyLow: boolean;
  isOutOfStock: boolean;
} {
  const isOutOfStock = currentStock <= 0;
  const isCriticallyLow = !isOutOfStock && currentStock <= minStockLevel;
  const isLowStock = !isOutOfStock && currentStock <= reorderLevel;

  return { isLowStock, isCriticallyLow, isOutOfStock };
}
