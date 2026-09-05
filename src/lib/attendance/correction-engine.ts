import { AttendanceStatus, VerificationStatus } from '@prisma/client';

export interface AttendanceCorrectionPayload {
  schoolId: string;
  attendanceType: 'STUDENT' | 'EMPLOYEE';
  attendanceId: string;
  originalStatus: AttendanceStatus;
  correctedStatus: AttendanceStatus;
  originalCheckIn?: string | null;
  correctedCheckIn?: string | null;
  originalCheckOut?: string | null;
  correctedCheckOut?: string | null;
  actionById: string;
  actionReason: string;
}

export interface VerificationPayload {
  schoolId: string;
  attendanceType: 'STUDENT' | 'EMPLOYEE';
  attendanceId: string;
  status: VerificationStatus; // 'VERIFIED' | 'REJECTED'
  verifiedById: string;
  remarks?: string;
}

/**
 * Validates mandatory correction reasons to satisfy audit compliance.
 */
export function validateCorrectionReason(reason: string | null | undefined): { isValid: boolean; error?: string } {
  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    return {
      isValid: false,
      error: 'A detailed mandatory justification reason (at least 5 characters) is required for all attendance corrections.',
    };
  }
  return { isValid: true };
}

/**
 * Ensures attendance status transitions are valid and explainable.
 */
export function validateStatusTransition(
  originalStatus: AttendanceStatus,
  correctedStatus: AttendanceStatus
): { isValid: boolean; error?: string } {
  if (originalStatus === correctedStatus) {
    return {
      isValid: false,
      error: `Corrected status (${correctedStatus}) must be different from current status (${originalStatus}).`,
    };
  }

  return { isValid: true };
}

export function isValidStatusTransition(
  originalStatus: AttendanceStatus | string,
  correctedStatus: AttendanceStatus | string
): boolean {
  return validateStatusTransition(originalStatus as any, correctedStatus as any).isValid;
}

export function isValidCorrectionReason(reason: string | null | undefined): boolean {
  return validateCorrectionReason(reason).isValid;
}

