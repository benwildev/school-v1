import crypto from 'crypto';
import { AssetStatus } from '@prisma/client';

/**
 * Generates an asset code string.
 * Format: AST-<prefix>-<rand>
 */
export function generateAssetCode(prefix: string = 'AST'): string {
  const cleanPrefix = prefix.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'AST';
  const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${cleanPrefix}-${timestamp}-${rand}`;
}

/**
 * Validates whether an asset is currently covered under warranty.
 */
export function isAssetUnderWarranty(
  warrantyExpiry?: Date | null,
  now: Date = new Date()
): boolean {
  if (!warrantyExpiry) return false;
  return new Date(warrantyExpiry).getTime() >= now.getTime();
}

/**
 * State machine transition rules for capital assets.
 */
export function isValidAssetStatusTransition(
  current: AssetStatus,
  next: AssetStatus
): { valid: boolean; reason?: string } {
  if (current === next) return { valid: true };

  const validTransitions: Record<AssetStatus, AssetStatus[]> = {
    AVAILABLE: ['ASSIGNED', 'MAINTENANCE', 'LOST', 'DAMAGED', 'DISPOSED', 'RETIRED'],
    ASSIGNED: ['AVAILABLE', 'MAINTENANCE', 'LOST', 'DAMAGED', 'DISPOSED', 'RETIRED'],
    MAINTENANCE: ['AVAILABLE', 'ASSIGNED', 'DAMAGED', 'DISPOSED', 'RETIRED'],
    LOST: ['AVAILABLE', 'DISPOSED'], // Found or written off
    DAMAGED: ['MAINTENANCE', 'DISPOSED', 'RETIRED'],
    DISPOSED: [], // Terminal
    RETIRED: [],  // Terminal
  };

  const allowed = validTransitions[current] || [];
  if (!allowed.includes(next)) {
    return {
      valid: false,
      reason: `Cannot transition asset status from ${current} to ${next}.`,
    };
  }

  return { valid: true };
}

/**
 * Validates whether an asset can be processed for disposal.
 */
export function canDisposeAsset(status: AssetStatus): {
  canDispose: boolean;
  reason?: string;
} {
  if (status === 'DISPOSED') {
    return {
      canDispose: false,
      reason: 'Asset is already marked as disposed.',
    };
  }

  if (status === 'ASSIGNED') {
    return {
      canDispose: false,
      reason: 'Asset is currently assigned to an employee or room. It must be returned/unassigned before disposal.',
    };
  }

  return { canDispose: true };
}

export const validateAssetDisposal = (status: AssetStatus) => {
  const result = canDisposeAsset(status);
  return { valid: result.canDispose, reason: result.reason };
};
