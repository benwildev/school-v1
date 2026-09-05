import { Prisma } from '@prisma/client';

export interface LeaveBalanceState {
  allocatedDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
}

/**
 * Calculates calendar days between two dates inclusive (e.g. 2026-01-01 to 2026-01-03 = 3 days)
 */
export function calculateDaysBetween(startDateStr: string, endDateStr: string): number {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diffDays);
}

/**
 * Validates whether an employee has sufficient leave balance.
 */
export async function validateLeaveBalance(
  db: any,
  schoolId: string,
  employeeId: string,
  leaveTypeId: string,
  requestedDays: number,
  allowNegative = false
): Promise<{ valid: boolean; reason?: string }> {
  if (requestedDays <= 0) {
    throw new Error('Requested leave days must be greater than zero.');
  }

  const leaveType = await db.leaveType.findFirst({
    where: { id: leaveTypeId, schoolId },
  });

  if (!leaveType) {
    throw new Error('Leave type not found.');
  }

  // If unpaid leave, balance check is skipped
  if (!leaveType.isPaid) {
    return { valid: true };
  }

  const currentYear = new Date().getFullYear();
  const balance = await db.leaveBalance.findFirst({
    where: {
      schoolId,
      employeeId,
      leaveTypeId,
      year: currentYear,
    },
  });

  if (!balance) {
    throw new Error('No leave balance allocated for this leave type.');
  }

  const remaining = Number(balance.remainingDays);
  if (!allowNegative && requestedDays > remaining) {
    throw new Error(`Insufficient leave balance: requested ${requestedDays} days but only ${remaining} days available.`);
  }

  return { valid: true };
}

/**
 * Enforces separation of duties: prevents an employee from approving their own leave.
 */
export function assertNotSelfApproval(approverUserId: string, applicantUserId: string | null | undefined): void {
  if (applicantUserId && applicantUserId === approverUserId) {
    throw new Error('FORBIDDEN: Separation of duties violation: An employee cannot approve their own leave request.');
  }
}

/**
 * Atomically deducts leave balance upon approval.
 */
export async function deductLeaveBalance(
  tx: any,
  schoolId: string,
  employeeId: string,
  leaveTypeId: string,
  daysToDeduct: number
): Promise<void> {
  const leaveType = await tx.leaveType.findFirst({
    where: { id: leaveTypeId, schoolId },
  });

  if (!leaveType || !leaveType.isPaid) {
    // Unpaid leave does not consume paid balance
    return;
  }

  const currentYear = new Date().getFullYear();
  const balance = await tx.leaveBalance.findFirst({
    where: {
      schoolId,
      employeeId,
      leaveTypeId,
      year: currentYear,
    },
  });

  if (!balance) {
    throw new Error('Leave balance record not found.');
  }

  const newUsed = Number(balance.usedDays) + daysToDeduct;
  const newRemaining = Math.max(0, Number(balance.remainingDays) - daysToDeduct);

  await tx.leaveBalance.update({
    where: { id: balance.id },
    data: {
      usedDays: new Prisma.Decimal(newUsed),
      remainingDays: new Prisma.Decimal(newRemaining),
    },
  });
}

/**
 * Initializes default leave balances for a newly registered employee.
 */
export async function initializeEmployeeLeaveBalances(
  tx: any,
  schoolId: string,
  employeeId: string
): Promise<void> {
  const currentYear = new Date().getFullYear();
  const activeLeaveTypes = await tx.leaveType.findMany({
    where: { schoolId, status: 'ACTIVE' },
  });

  for (const lt of activeLeaveTypes) {
    await tx.leaveBalance.upsert({
      where: {
        schoolId_employeeId_leaveTypeId_year: {
          schoolId,
          employeeId,
          leaveTypeId: lt.id,
          year: currentYear,
        },
      },
      create: {
        schoolId,
        employeeId,
        leaveTypeId: lt.id,
        year: currentYear,
        allocatedDays: new Prisma.Decimal(lt.annualDays),
        usedDays: new Prisma.Decimal(0),
        pendingDays: new Prisma.Decimal(0),
        remainingDays: new Prisma.Decimal(lt.annualDays),
      },
      update: {},
    });
  }
}
