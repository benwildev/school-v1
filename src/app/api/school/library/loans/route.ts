import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { IssueBookSchema } from '@/lib/validation/library';
import {
  validateBorrowerEligibility,
  calculateDueDate,
} from '@/lib/library/circulation-engine';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'LIBRARY_VIEW' });

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;
    const borrowerType = searchParams.get('borrowerType') || undefined;
    const studentId = searchParams.get('studentId') || undefined;
    const employeeId = searchParams.get('employeeId') || undefined;
    const copyId = searchParams.get('copyId') || undefined;

    const loans = await withTenantContext(schoolId, async () => {
      const whereClause: any = { schoolId };
      if (status) whereClause.status = status;
      if (borrowerType) whereClause.borrowerType = borrowerType;
      if (studentId) whereClause.studentId = studentId;
      if (employeeId) whereClause.employeeId = employeeId;
      if (copyId) whereClause.copyId = copyId;

      return prisma.libraryLoan.findMany({
        where: whereClause,
        include: {
          copy: {
            include: {
              book: { select: { id: true, titleEn: true, titleBn: true, isbn10: true, isbn13: true } },
            },
          },
          student: { select: { id: true, studentCode: true, firstNameEn: true, lastNameEn: true } },
          employee: { select: { id: true, employeeCode: true, firstNameEn: true, lastNameEn: true } },
          fines: true,
          issuedBy: { select: { id: true, fullName: true } },
        },
        orderBy: { issueDate: 'desc' },
      });
    });

    return NextResponse.json({ success: true, data: loans });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { schoolId, context } = await requirePermission(request, { permission: 'LIBRARY_ISSUE' });

    const body = await request.json();
    const parsed = IssueBookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { copyId, borrowerType, studentId, enrollmentId, employeeId, dueDate, notes } = parsed.data;

    const newLoan = await withTenantContext(schoolId, async () => {
      return prisma.$transaction(async (tx) => {
        // 1. Fetch library settings
        let settings = await tx.librarySetting.findUnique({ where: { schoolId } });
        if (!settings) {
          settings = await tx.librarySetting.create({ data: { schoolId } });
        }

        // 2. Fetch copy and verify availability
        const copy = await tx.libraryBookCopy.findFirst({
          where: { id: copyId, schoolId },
          include: { book: true },
        });
        if (!copy) {
          throw new Error('Book copy not found');
        }

        if (copy.status !== 'AVAILABLE' && copy.status !== 'RESERVED') {
          throw new Error(`Book copy is not available for issue (current status: ${copy.status}).`);
        }

        // 3. Check borrower quota and unpaid fines
        const borrowerFilter =
          borrowerType === 'STUDENT'
            ? { studentId, schoolId }
            : { employeeId, schoolId };

        const activeLoans = await tx.libraryLoan.findMany({
          where: {
            ...borrowerFilter,
            status: { in: ['ISSUED', 'OVERDUE'] },
          },
        });

        const hasOverdue = activeLoans.some((l) => {
          if (l.status === 'OVERDUE') return true;
          return l.dueDate < new Date();
        });

        // Unpaid fines
        const unpaidFines = await tx.libraryFine.findMany({
          where: {
            schoolId,
            ...(borrowerType === 'STUDENT' ? { studentId } : { employeeId }),
            status: 'UNPAID',
          },
        });
        const totalUnpaid = unpaidFines.reduce(
          (sum, f) => sum + (Number(f.fineAmount) - Number(f.waivedAmount) - Number(f.paidAmount)),
          0
        );

        const maxAllowed =
          borrowerType === 'STUDENT'
            ? settings.studentMaxBooks
            : settings.employeeMaxBooks;
        const loanPeriod =
          borrowerType === 'STUDENT'
            ? settings.studentLoanPeriodDays
            : settings.employeeLoanPeriodDays;

        const eligibility = validateBorrowerEligibility({
          borrowerType,
          currentActiveLoans: activeLoans.length,
          maxAllowedLoans: maxAllowed,
          totalUnpaidFines: Math.max(0, totalUnpaid),
          blockedFineThreshold: Number(settings.blockedThresholdFine),
          hasOverdueLoans: hasOverdue,
        });

        if (!eligibility.eligible) {
          throw new Error(eligibility.reason || 'Borrower is not eligible to borrow books.');
        }

        // 4. Calculate due date
        const issueDate = new Date();
        const calculatedDue = dueDate
          ? new Date(dueDate)
          : calculateDueDate(issueDate, loanPeriod);

        // 5. Create loan
        const loan = await tx.libraryLoan.create({
          data: {
            schoolId,
            copyId,
            borrowerType,
            studentId: borrowerType === 'STUDENT' ? studentId : null,
            enrollmentId: borrowerType === 'STUDENT' ? enrollmentId || null : null,
            employeeId: borrowerType === 'EMPLOYEE' ? employeeId : null,
            issueDate,
            dueDate: calculatedDue,
            status: 'ISSUED',
            notes: notes || null,
            issuedById: context.userId,
          },
          include: {
            copy: { include: { book: true } },
            student: true,
            employee: true,
          },
        });

        // 6. Update physical copy status to ISSUED
        await tx.libraryBookCopy.update({
          where: { id: copyId },
          data: { status: 'ISSUED' },
        });

        // 7. If this borrower had a pending reservation for this book, fulfill it
        const pendingReservation = await tx.libraryReservation.findFirst({
          where: {
            schoolId,
            bookId: copy.bookId,
            status: 'PENDING',
            ...(borrowerType === 'STUDENT' ? { studentId } : { employeeId }),
          },
        });

        if (pendingReservation) {
          await tx.libraryReservation.update({
            where: { id: pendingReservation.id },
            data: {
              status: 'FULFILLED',
              fulfilledDate: issueDate,
            },
          });
        }

        return loan;
      });
    });

    return NextResponse.json({ success: true, data: newLoan }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
