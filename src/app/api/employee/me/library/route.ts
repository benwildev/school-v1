import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/authorization/engine';
import { calculateOverdueDays } from '@/lib/library/circulation-engine';

/**
 * GET /api/employee/me/library
 * Employee self-service endpoint to view own active library loans, loan history, reservations, and fines.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth(request);

    // Resolve employee linked to the authenticated user
    const employee = await prisma.employee.findFirst({
      where: {
        userId: context.userId,
        ...(context.activeSchoolId ? { schoolId: context.activeSchoolId } : {}),
      },
      select: {
        id: true,
        schoolId: true,
        employeeCode: true,
        fullNameEn: true,
        fullNameBn: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { success: false, error: 'No employee record linked to current user session.' },
        { status: 404 }
      );
    }

    const { id: employeeId, schoolId } = employee;

    const [activeLoans, loanHistory, reservations, fines, settings] = await Promise.all([
      prisma.libraryLoan.findMany({
        where: {
          schoolId,
          employeeId,
          status: { in: ['ISSUED', 'OVERDUE'] },
        },
        include: {
          copy: {
            include: {
              book: {
                select: { id: true, titleEn: true, titleBn: true, author: true, coverUrl: true },
              },
            },
          },
        },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.libraryLoan.findMany({
        where: {
          schoolId,
          employeeId,
          status: 'RETURNED',
        },
        include: {
          copy: {
            include: {
              book: {
                select: { id: true, titleEn: true, titleBn: true, author: true },
              },
            },
          },
        },
        orderBy: { returnDate: 'desc' },
        take: 20,
      }),
      prisma.libraryReservation.findMany({
        where: {
          schoolId,
          employeeId,
          status: { in: ['PENDING', 'FULFILLED'] },
        },
        include: {
          book: {
            select: { id: true, titleEn: true, titleBn: true, author: true },
          },
        },
        orderBy: { reservationDate: 'desc' },
      }),
      prisma.libraryFine.findMany({
        where: {
          schoolId,
          employeeId,
        },
        include: {
          loan: {
            include: {
              copy: {
                include: {
                  book: { select: { id: true, titleEn: true, titleBn: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.librarySetting.findUnique({
        where: { schoolId },
      }),
    ]);

    const enrichedActive = activeLoans.map((loan) => {
      const isOverdue = loan.dueDate < new Date();
      const overdueDays = calculateOverdueDays(loan.dueDate);
      return {
        ...loan,
        isOverdue,
        overdueDays,
      };
    });

    const totalUnpaidFines = fines
      .filter((f) => f.status === 'UNPAID')
      .reduce((sum, f) => sum + (Number(f.fineAmount) - Number(f.paidAmount) - Number(f.waivedAmount)), 0);

    return NextResponse.json({
      success: true,
      data: {
        employee,
        activeLoans: enrichedActive,
        loanHistory,
        reservations,
        fines,
        summary: {
          activeLoanCount: enrichedActive.length,
          maxAllowedLoans: settings?.employeeMaxBooks || 5,
          totalUnpaidFines: Math.max(0, totalUnpaidFines),
        },
      },
    });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
