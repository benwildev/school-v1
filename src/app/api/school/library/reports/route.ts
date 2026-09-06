import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'LIBRARY_REPORT_VIEW' });

    const stats = await withTenantContext(schoolId, async (tx) => {
      const [
        totalBooks,
        totalCopies,
        availableCopies,
        issuedCopies,
        lostCopies,
        damagedCopies,
        totalLoans,
        activeLoans,
        overdueLoans,
        pendingReservations,
        fines,
      ] = await Promise.all([
        tx.libraryBook.count({ where: { schoolId } }),
        tx.libraryBookCopy.count({ where: { schoolId } }),
        tx.libraryBookCopy.count({ where: { schoolId, status: 'AVAILABLE' } }),
        tx.libraryBookCopy.count({ where: { schoolId, status: 'ISSUED' } }),
        tx.libraryBookCopy.count({ where: { schoolId, status: 'LOST' } }),
        tx.libraryBookCopy.count({ where: { schoolId, status: 'DAMAGED' } }),
        tx.libraryLoan.count({ where: { schoolId } }),
        tx.libraryLoan.count({ where: { schoolId, status: { in: ['ISSUED', 'OVERDUE'] } } }),
        tx.libraryLoan.count({
          where: {
            schoolId,
            status: { in: ['ISSUED', 'OVERDUE'] },
            dueDate: { lt: new Date() },
          },
        }),
        tx.libraryReservation.count({ where: { schoolId, status: 'PENDING' } }),
        tx.libraryFine.findMany({
          where: { schoolId },
          select: { fineAmount: true, paidAmount: true, waivedAmount: true, status: true },
        }),
      ]);

      const totalFineAssessed = fines.reduce((sum, f) => sum + Number(f.fineAmount), 0);
      const totalFinePaid = fines.reduce((sum, f) => sum + Number(f.paidAmount), 0);
      const totalFineWaived = fines.reduce((sum, f) => sum + Number(f.waivedAmount), 0);
      const totalFineUnpaid = Math.max(0, totalFineAssessed - totalFinePaid - totalFineWaived);

      // Top borrowed books
      const popularCopies = await tx.libraryLoan.groupBy({
        by: ['copyId'],
        where: { schoolId },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      });

      return {
        catalog: {
          totalBooks,
          totalCopies,
          availableCopies,
          issuedCopies,
          lostCopies,
          damagedCopies,
        },
        circulation: {
          totalLoans,
          activeLoans,
          overdueLoans,
          pendingReservations,
        },
        financials: {
          totalFineAssessed,
          totalFinePaid,
          totalFineWaived,
          totalFineUnpaid,
        },
        topBorrowedCount: popularCopies.length,
      };
    });

    return NextResponse.json({ success: true, data: stats });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
