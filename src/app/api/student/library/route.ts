import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/authorization/engine';
import { calculateOverdueDays } from '@/lib/library/circulation-engine';

/**
 * GET /api/student/library
 * Student self-service endpoint to view own active loans, loan history, reservations, and fines.
 * Strictly guards against studentId spoofing by resolving exclusively from the authenticated session.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth(request);

    // Resolve student profile
    const studentUser = await prisma.studentUser.findUnique({
      where: { userId: context.userId },
      include: {
        student: {
          select: {
            id: true,
            schoolId: true,
            studentCode: true,
            firstNameEn: true,
            lastNameEn: true,
            fullNameEn: true,
            fullNameBn: true,
          },
        },
      },
    });

    if (!studentUser || !studentUser.student) {
      return NextResponse.json(
        { success: false, error: 'No student profile linked to this account.' },
        { status: 403 }
      );
    }

    const { id: studentId, schoolId } = studentUser.student;

    const [activeLoans, loanHistory, reservations, fines, settings] = await Promise.all([
      prisma.libraryLoan.findMany({
        where: {
          schoolId,
          studentId,
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
          studentId,
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
          studentId,
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
          studentId,
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
        student: studentUser.student,
        activeLoans: enrichedActive,
        loanHistory,
        reservations,
        fines,
        summary: {
          activeLoanCount: enrichedActive.length,
          maxAllowedLoans: settings?.studentMaxBooks || 3,
          totalUnpaidFines: Math.max(0, totalUnpaidFines),
        },
      },
    });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
