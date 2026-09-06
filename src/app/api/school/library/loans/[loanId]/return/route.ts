import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { ReturnBookSchema } from '@/lib/validation/library';
import { calculateOverdueDays } from '@/lib/library/circulation-engine';
import {
  calculateOverdueFine,
  calculateDamageCharge,
} from '@/lib/library/fine-engine';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ loanId: string }> }
) {
  try {
    const { schoolId, context } = await requirePermission(request, { permission: 'LIBRARY_RETURN' });
    const { loanId } = await params;

    const body = await request.json().catch(() => ({}));
    const parsed = ReturnBookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { condition, damageCharge, notes } = parsed.data;

    const result = await withTenantContext(schoolId, async (tx) => {
      return tx.$transaction(async (tx) => {
        // 1. Fetch loan
        const loan = await tx.libraryLoan.findFirst({
          where: { id: loanId, schoolId },
          include: {
            copy: { include: { book: true } },
          },
        });
        if (!loan) {
          throw new Error('Loan not found');
        }

        if (loan.status === 'RETURNED') {
          throw new Error('This loan has already been marked as returned.');
        }

        const returnDate = new Date();

        // 2. Fetch settings
        let settings = await tx.librarySetting.findUnique({ where: { schoolId } });
        if (!settings) {
          settings = await tx.librarySetting.create({ data: { schoolId } });
        }

        // 3. Calculate overdue fine
        const overdueDays = calculateOverdueDays(loan.dueDate, returnDate);
        const dailyRate = Number(settings.dailyFineRate);
        const overdueFineAmount = calculateOverdueFine(overdueDays, dailyRate);

        // 4. Calculate damage fine
        const assessedDamage = damageCharge !== undefined ? damageCharge : null;
        const isDamaged = condition === 'DAMAGED';
        const damageFineAmount = isDamaged
          ? calculateDamageCharge(Number(settings.damageFineFlat), assessedDamage)
          : (assessedDamage && assessedDamage > 0 ? assessedDamage : 0);

        const assessedFines = [];

        // Record overdue fine
        if (overdueFineAmount > 0) {
          const fine = await tx.libraryFine.create({
            data: {
              schoolId,
              loanId: loan.id,
              borrowerType: loan.borrowerType,
              studentId: loan.studentId,
              employeeId: loan.employeeId,
              fineType: 'OVERDUE',
              overdueDays,
              dailyRate,
              calculatedAmount: overdueFineAmount,
              fineAmount: overdueFineAmount,
              status: 'UNPAID',
              notes: `Overdue fine for ${overdueDays} day(s) at ৳${dailyRate}/day`,
              assessedById: context.userId,
            },
          });
          assessedFines.push(fine);
        }

        // Record damage fine
        if (damageFineAmount > 0) {
          const fine = await tx.libraryFine.create({
            data: {
              schoolId,
              loanId: loan.id,
              borrowerType: loan.borrowerType,
              studentId: loan.studentId,
              employeeId: loan.employeeId,
              fineType: 'DAMAGE',
              calculatedAmount: damageFineAmount,
              fineAmount: damageFineAmount,
              status: 'UNPAID',
              notes: `Damage fine assessed on return`,
              assessedById: context.userId,
            },
          });
          assessedFines.push(fine);
        }

        // 4b. Canonical Finance synchronization: Create StudentFee for student borrower whenever fines assessed
        if (loan.studentId && assessedFines.length > 0) {
          const totalFineToBill = overdueFineAmount + damageFineAmount;
          if (totalFineToBill > 0) {
            // Find active (or most recent) enrollment for student
            let enrollment = await tx.enrollment.findFirst({
              where: {
                studentId: loan.studentId,
                schoolId,
                status: 'ACTIVE',
              },
              orderBy: { createdAt: 'desc' },
            });
            if (!enrollment) {
              enrollment = await tx.enrollment.findFirst({
                where: {
                  studentId: loan.studentId,
                  schoolId,
                },
                orderBy: { createdAt: 'desc' },
              });
            }

            if (enrollment) {
              // Find library-specific fee type, any fee type, or auto-create canonical library fine type
              let feeType = await tx.feeType.findFirst({
                where: {
                  schoolId,
                  code: { in: ['LIBRARY_FINE', 'FINE', 'LIBRARY'] },
                },
              });

              if (!feeType) {
                feeType = await tx.feeType.findFirst({
                  where: { schoolId },
                });
              }

              if (!feeType) {
                feeType = await tx.feeType.create({
                  data: {
                    schoolId,
                    code: 'LIBRARY_FINE',
                    nameEn: 'Library Fine',
                    nameBn: 'লাইব্রেরি জরিমানা',
                    description: 'Automated library overdue and damage fines',
                    isRecurring: false,
                    isRefundable: false,
                    status: 'ACTIVE',
                  },
                });
              }

              const now = new Date();
              const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
              const uniqueSuffix = Date.now().toString(36).toUpperCase();
              const periodKey = `LIB-${loan.id.replace(/-/g, '').slice(0, 8)}-${uniqueSuffix}`;
              const invoiceNumber = `INV-LIB-${uniqueSuffix}`;

              const studentFee = await tx.studentFee.create({
                data: {
                  schoolId,
                  studentId: loan.studentId,
                  enrollmentId: enrollment.id,
                  feeTypeId: feeType.id,
                  invoiceNumber,
                  billingPeriodType: 'MONTHLY',
                  billingPeriodKey: periodKey,
                  periodStartDate: now,
                  periodEndDate: dueDate,
                  dueDate,
                  baseAmount: totalFineToBill,
                  discountAmount: 0,
                  fineAmount: 0,
                  netAmount: totalFineToBill,
                  paidAmount: 0,
                  dueAmount: totalFineToBill,
                  status: 'UNPAID',
                },
              });

              for (const fine of assessedFines) {
                await tx.libraryFine.update({
                  where: { id: fine.id },
                  data: { studentFeeId: studentFee.id },
                });
              }
            }
          }
        }

        // 5. Update loan status
        const updatedLoan = await tx.libraryLoan.update({
          where: { id: loan.id },
          data: {
            returnDate,
            status: 'RETURNED',
            returnedById: context.userId,
            notes: notes ? `${loan.notes ? loan.notes + '\n' : ''}${notes}` : loan.notes,
          },
        });

        // 6. Check for pending reservations for this book
        const pendingReservation = await tx.libraryReservation.findFirst({
          where: {
            bookId: loan.copy.bookId,
            schoolId,
            status: 'PENDING',
          },
          orderBy: { reservationDate: 'asc' },
        });

        let nextCopyStatus: any = 'AVAILABLE';
        if (isDamaged) {
          nextCopyStatus = 'DAMAGED';
        } else if (pendingReservation) {
          nextCopyStatus = 'RESERVED';
        }

        await tx.libraryBookCopy.update({
          where: { id: loan.copyId },
          data: {
            status: nextCopyStatus,
            condition: condition || loan.copy.condition,
          },
        });

        return {
          loan: updatedLoan,
          fines: assessedFines,
          overdueDays,
          overdueFineAmount,
          damageFineAmount,
          copyStatus: nextCopyStatus,
        };
      });
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
