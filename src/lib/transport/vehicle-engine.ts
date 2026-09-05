import { VehicleStatus } from '@prisma/client';

export interface ExpiryStatus {
  isExpired: boolean;
  isExpiringSoon: boolean; // within 30 days
  daysRemaining: number;
  expiryDate: string | null;
}

export interface VehicleExpiryReport {
  insurance: ExpiryStatus;
  fitness: ExpiryStatus;
  registration: ExpiryStatus;
  hasAnyAlert: boolean;
}

/**
 * Evaluates document expiry status relative to current Asia/Dhaka time.
 */
export function evaluateExpiry(dateInput: Date | string | null | undefined, alertDays = 30): ExpiryStatus {
  if (!dateInput) {
    return {
      isExpired: false,
      isExpiringSoon: false,
      daysRemaining: 9999,
      expiryDate: null,
    };
  }

  const expiry = new Date(dateInput);
  const now = new Date();
  // Normalize to UTC start of day for comparison
  const diffMs = expiry.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return {
    isExpired: daysRemaining < 0,
    isExpiringSoon: daysRemaining >= 0 && daysRemaining <= alertDays,
    daysRemaining,
    expiryDate: expiry.toISOString().split('T')[0],
  };
}

/**
 * Generates an aggregated compliance report for all documents of a vehicle.
 */
export function checkVehicleDocuments(vehicle: {
  insuranceExpiry?: Date | string | null;
  fitnessExpiry?: Date | string | null;
  registrationExpiry?: Date | string | null;
}): VehicleExpiryReport {
  const insurance = evaluateExpiry(vehicle.insuranceExpiry);
  const fitness = evaluateExpiry(vehicle.fitnessExpiry);
  const registration = evaluateExpiry(vehicle.registrationExpiry);

  const hasAnyAlert =
    insurance.isExpired ||
    insurance.isExpiringSoon ||
    fitness.isExpired ||
    fitness.isExpiringSoon ||
    registration.isExpired ||
    registration.isExpiringSoon;

  return {
    insurance,
    fitness,
    registration,
    hasAnyAlert,
  };
}

export const calculateDocumentExpiryStatus = checkVehicleDocuments;

/**
 * Validates whether a state transition for a vehicle is permissible.
 */
export function isValidVehicleStatusTransition(
  current: VehicleStatus,
  next: VehicleStatus,
  activeStudentCount = 0
): { valid: boolean; reason?: string } {
  if (current === next) return { valid: true };

  // Cannot retire a vehicle with active student assignments
  if (next === 'RETIRED' && activeStudentCount > 0) {
    return {
      valid: false,
      reason: `Cannot retire vehicle while ${activeStudentCount} active student assignments exist. Reassign students first.`,
    };
  }

  // Terminal state: Once RETIRED, cannot reactivate without re-commissioning audit
  if (current === 'RETIRED' && next !== 'RETIRED') {
    return {
      valid: false,
      reason: 'Retired vehicles cannot transition directly to active status without decommissioning review.',
    };
  }

  return { valid: true };
}
