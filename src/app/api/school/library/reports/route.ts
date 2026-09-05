import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'LIBRARY_REPORT_VIEW' });

    const stats = await withTenantContext(schoolId, async () => {
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
        prisma.libraryBook.count({ where: { schoolId } }),
        prisma.libraryBookCopy.count({ where: { schoolId } }),
        prisma.libraryBookCopy.count({ where: { schoolId, status: 'AVAILABLE' } }),
        prisma.libraryBookCopy.count({ where: { schoolId, status: 'ISSUED' } }),
        prisma.libraryBookCopy.count({ where: { schoolId, status: 'LOST' } }),
        prisma.libraryBookCopy.count({ where: { schoolId, status: 'DAMAGED' } }),
        prisma.libraryLoan.count({ where: { schoolId } }),
        prisma.libraryLoan.count({ where: { schoolId, status: { in: ['ISSUED', 'OVERDUE'] } } }),
        prisma.libraryLoan.count({
          where: {
            schoolId,
            status: { in: ['ISSUED', 'OVERDUE'] },
            dueDate: { lt: new Date() },
          },
        }),
        prisma.libraryReservation.count({ where: { schoolId, status: 'PENDING' } }),
        prisma.libraryFine.findMany({
          where: { schoolId },
          select: { fineAmount: true, paidAmount: true, waivedAmount: true, status: true },
        }),
      ]);

      const totalFineAssessed = fines.reduce((sum, f) => sum + Number(f.fineAmount), 0);
      const totalFinePaid = fines.reduce((sum, f) => sum + Number(f.paidAmount), 0);
      const totalFineWaived = fines.reduce((sum, f) => sum + Number(f.waivedAmount), 0);
      const totalFineUnpaid = Math.max(0, totalFineAssessed - totalFinePaid - totalFineWaived);

      // Top borrowed books
      const popularCopies = await prisma.libraryLoan.groupBy({
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
