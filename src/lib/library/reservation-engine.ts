import { ReservationStatus, BookCopyStatus } from '@prisma/client';

export interface CanPlaceReservationParams {
  availableCopiesCount: number;
  existingActiveReservation: boolean;
  isBorrowerTypeAllowed: boolean;
}

/**
 * Calculates expiration timestamp for a title reservation.
 */
export function calculateReservationExpiryDate(
  reservationDate: Date,
  validityDays: number = 7
): Date {
  const expiry = new Date(reservationDate.getTime());
  expiry.setDate(expiry.getDate() + validityDays);
  return expiry;
}

/**
 * Checks if a reservation has passed its expiration window.
 */
export function isReservationExpired(expiryDate: Date, now: Date = new Date()): boolean {
  return now.getTime() > expiryDate.getTime();
}

/**
 * Validates whether a reservation can be placed on a book title.
 */
export function canPlaceReservation(params: CanPlaceReservationParams): {
  allowed: boolean;
  reason?: string;
} {
  if (!params.isBorrowerTypeAllowed) {
    return {
      allowed: false,
      reason: 'Reservations are not permitted for this borrower type under current library settings.',
    };
  }

  if (params.existingActiveReservation) {
    return {
      allowed: false,
      reason: 'You already have an active pending reservation on this book title.',
    };
  }

  if (params.availableCopiesCount > 0) {
    return {
      allowed: false,
      reason: `There are currently ${params.availableCopiesCount} available physical copy/copies in the library. Please borrow an available copy directly rather than placing a reservation.`,
    };
  }

  return { allowed: true };
}

/**
 * Determines whether a reservation can be fulfilled with an available book copy.
 */
export function canFulfillReservation(
  reservationStatus: ReservationStatus,
  copyStatus: BookCopyStatus
): { canFulfill: boolean; reason?: string } {
  if (reservationStatus !== 'PENDING') {
    return {
      canFulfill: false,
      reason: `Reservation is in ${reservationStatus} status and cannot be fulfilled.`,
    };
  }

  if (copyStatus !== 'AVAILABLE' && copyStatus !== 'RESERVED') {
    return {
      canFulfill: false,
      reason: `Physical book copy is in ${copyStatus} status and cannot be allocated.`,
    };
  }

  return { canFulfill: true };
}
