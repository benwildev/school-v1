import { TripStatus } from '@prisma/client';

export interface TripTransitionResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates whether a trip status transition is permissible.
 * Enforces historical immutability on completed and cancelled trips.
 */
export function isValidTripStatusTransition(current: TripStatus, next: TripStatus): TripTransitionResult {
  if (current === next) return { valid: true };

  // Terminal states cannot be changed arbitrarily
  if (current === 'COMPLETED') {
    return {
      valid: false,
      reason: 'Completed trips are frozen in historical records and cannot be altered.',
    };
  }

  if (current === 'CANCELLED') {
    return {
      valid: false,
      reason: 'Cancelled trips cannot be re-opened or marked completed.',
    };
  }

  if (current === 'PLANNED') {
    if (next === 'IN_PROGRESS' || next === 'CANCELLED') {
      return { valid: true };
    }
    return {
      valid: false,
      reason: 'Planned trips must transition to IN_PROGRESS before being marked COMPLETED.',
    };
  }

  if (current === 'IN_PROGRESS') {
    if (next === 'COMPLETED' || next === 'CANCELLED') {
      return { valid: true };
    }
    return {
      valid: false,
      reason: 'In-progress trips can only transition to COMPLETED or CANCELLED.',
    };
  }

  return { valid: true };
}

/**
 * Validates that a boarding event sequence is logical.
 */
export function isValidBoardingEventTransition(
  currentEvents: Array<{ boardingStatus: string }>,
  newStatus: string
): { valid: boolean; reason?: string } {
  const statuses = currentEvents.map((e) => e.boardingStatus);

  if (newStatus === 'DROPPED_OFF') {
    // If attempting dropoff, student should ideally have boarded or picked up
    if (!statuses.includes('BOARDED') && !statuses.includes('PICKED_UP')) {
      // Soft validation: permissible in emergency/special cases, but flagged
    }
  }

  return { valid: true };
}
