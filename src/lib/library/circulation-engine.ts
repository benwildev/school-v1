import { LoanStatus } from '@prisma/client';

export interface BorrowerEligibilityCheck {
  borrowerType: 'STUDENT' | 'EMPLOYEE';
  currentActiveLoans: number;
  maxAllowedLoans: number;
  totalUnpaidFines: number;
  blockedFineThreshold: number;
  hasOverdueLoans: boolean;
}

export interface RenewalEligibilityCheck {
  currentRenewalCount: number;
  maxAllowedRenewals: number;
  isOverdue: boolean;
  isReservedByOther: boolean;
  totalUnpaidFines: number;
  blockedFineThreshold: number;
}

/**
 * Validates whether a student or employee is eligible to borrow a book.
 */
export function validateBorrowerEligibility(check: BorrowerEligibilityCheck): {
  eligible: boolean;
  reason?: string;
} {
  // 1. Quota limit check
  if (check.currentActiveLoans >= check.maxAllowedLoans) {
    return {
      eligible: false,
      reason: `Borrower has reached the maximum allowed limit of ${check.maxAllowedLoans} book(s). Currently holding ${check.currentActiveLoans}.`,
    };
  }

  // 2. Overdue loan block
  if (check.hasOverdueLoans) {
    return {
      eligible: false,
      reason: 'Borrower has one or more overdue books that must be returned before new books can be issued.',
    };
  }

  // 3. Unpaid fine threshold check
  if (check.totalUnpaidFines > check.blockedFineThreshold) {
    return {
      eligible: false,
      reason: `Borrower has unpaid fines of ৳${check.totalUnpaidFines.toFixed(2)}, which exceeds the account block threshold of ৳${check.blockedFineThreshold.toFixed(2)}.`,
    };
  }

  return { eligible: true };
}

/**
 * Calculates due date based on loan period in days.
 */
export function calculateDueDate(issueDate: Date, loanPeriodDays: number): Date {
  const due = new Date(issueDate.getTime());
  due.setDate(due.getDate() + loanPeriodDays);
  return due;
}

/**
 * Calculates number of overdue days between due date and return/current date.
 */
export function calculateOverdueDays(dueDate: Date, returnDate: Date = new Date()): number {
  const diffMs = returnDate.getTime() - dueDate.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Validates whether an active loan can be renewed.
 */
export function validateRenewalEligibility(check: RenewalEligibilityCheck): {
  eligible: boolean;
  reason?: string;
} {
  // 1. Max renewal count check
  if (check.currentRenewalCount >= check.maxAllowedRenewals) {
    return {
      eligible: false,
      reason: `Maximum renewal limit of ${check.maxAllowedRenewals} has been reached for this loan.`,
    };
  }

  // 2. Overdue book check
  if (check.isOverdue) {
    return {
      eligible: false,
      reason: 'Overdue books cannot be renewed. Please return the book and clear any assessed fines.',
    };
  }

  // 3. Title reservation conflict
  if (check.isReservedByOther) {
    return {
      eligible: false,
      reason: 'This book has a pending reservation placed by another library member and cannot be renewed.',
    };
  }

  // 4. Unpaid fine threshold check
  if (check.totalUnpaidFines > check.blockedFineThreshold) {
    return {
      eligible: false,
      reason: `Cannot renew while unpaid fines (৳${check.totalUnpaidFines.toFixed(2)}) exceed the block threshold.`,
    };
  }

  return { eligible: true };
}

/**
 * State machine transition rules for circulation loans.
 */
export function isValidLoanStatusTransition(
  currentStatus: LoanStatus,
  nextStatus: LoanStatus
): { valid: boolean; reason?: string } {
  if (currentStatus === nextStatus) return { valid: true };

  const validTransitions: Record<LoanStatus, LoanStatus[]> = {
    ISSUED: ['RETURNED', 'OVERDUE', 'LOST', 'DAMAGED'],
    OVERDUE: ['RETURNED', 'LOST', 'DAMAGED'],
    RETURNED: [], // Finalized
    LOST: ['RETURNED'], // Returned if found
    DAMAGED: ['RETURNED'],
  };

  const allowed = validTransitions[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    return {
      valid: false,
      reason: `Cannot transition loan from ${currentStatus} to ${nextStatus}.`,
    };
  }

  return { valid: true };
}
