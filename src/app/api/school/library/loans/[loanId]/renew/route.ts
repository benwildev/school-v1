import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { RenewBookSchema } from '@/lib/validation/library';
import {
  validateRenewalEligibility,
  calculateDueDate,
} from '@/lib/library/circulation-engine';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ loanId: string }> }
) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'LIBRARY_RENEW' });
    const { loanId } = await params;

    const body = await request.json().catch(() => ({}));
    const parsed = RenewBookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { notes } = parsed.data;

    const renewed = await withTenantContext(schoolId, async () => {
      return prisma.$transaction(async (tx) => {
        const loan = await tx.libraryLoan.findFirst({
          where: { id: loanId, schoolId },
          include: {
            copy: { include: { book: true } },
          },
        });
        if (!loan) {
          throw new Error('Loan not found');
        }

        if (loan.status !== 'ISSUED') {
          throw new Error(`Cannot renew loan with status ${loan.status}.`);
        }

        let settings = await tx.librarySetting.findUnique({ where: { schoolId } });
        if (!settings) {
          settings = await tx.librarySetting.create({ data: { schoolId } });
        }

        const maxRenewals =
          loan.borrowerType === 'STUDENT'
            ? settings.studentMaxRenewals
            : settings.employeeMaxRenewals;
        const loanPeriod =
          loan.borrowerType === 'STUDENT'
            ? settings.studentLoanPeriodDays
            : settings.employeeLoanPeriodDays;

        const isOverdue = new Date() > loan.dueDate;

        // Check if reserved by someone else
        const otherReservation = await tx.libraryReservation.findFirst({
          where: {
            bookId: loan.copy.bookId,
            schoolId,
            status: 'PENDING',
            NOT: {
              ...(loan.borrowerType === 'STUDENT'
                ? { studentId: loan.studentId }
                : { employeeId: loan.employeeId }),
            },
          },
        });

        // Check unpaid fines
        const unpaidFines = await tx.libraryFine.findMany({
          where: {
            schoolId,
            ...(loan.borrowerType === 'STUDENT'
              ? { studentId: loan.studentId }
              : { employeeId: loan.employeeId }),
            status: 'UNPAID',
          },
        });
        const totalUnpaid = unpaidFines.reduce(
          (sum, f) => sum + (Number(f.fineAmount) - Number(f.waivedAmount) - Number(f.paidAmount)),
          0
        );

        const eligibility = validateRenewalEligibility({
          currentRenewalCount: loan.renewalCount,
          maxAllowedRenewals: maxRenewals,
          isOverdue,
          isReservedByOther: !!otherReservation,
          totalUnpaidFines: Math.max(0, totalUnpaid),
          blockedFineThreshold: Number(settings.blockedThresholdFine),
        });

        if (!eligibility.eligible) {
          throw new Error(eligibility.reason || 'Loan is not eligible for renewal.');
        }

        const newDueDate = calculateDueDate(loan.dueDate, loanPeriod);

        return tx.libraryLoan.update({
          where: { id: loan.id },
          data: {
            dueDate: newDueDate,
            renewalCount: loan.renewalCount + 1,
            notes: notes ? `${loan.notes ? loan.notes + '\n' : ''}[Renewal #${loan.renewalCount + 1}] ${notes}` : loan.notes,
          },
          include: {
            copy: { include: { book: true } },
            student: true,
            employee: true,
          },
        });
      });
    });

    return NextResponse.json({ success: true, data: renewed });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
