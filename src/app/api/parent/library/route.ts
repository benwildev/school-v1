import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSchool } from '@/lib/authorization/engine';
import { prisma } from '@/lib/db';
import { calculateOverdueDays } from '@/lib/library/circulation-engine';

/**
 * GET /api/parent/library
 * Lists library loans, reservations, and fines for all children linked to the authenticated guardian.
 * IDOR safe: queries strictly through student_guardians relation.
 */
export async function GET(request: NextRequest) {
  try {
    const { context, schoolId } = await requireActiveSchool(request);

    // Find all children linked to this guardian
    const studentGuardians = await prisma.studentGuardian.findMany({
      where: {
        schoolId,
        guardian: {
          userId: context.userId,
          schoolId,
        },
      },
      select: {
        studentId: true,
        student: {
          select: {
            id: true,
            studentCode: true,
            firstNameEn: true,
            lastNameEn: true,
            fullNameEn: true,
            fullNameBn: true,
          },
        },
      },
    });

    if (!studentGuardians || studentGuardians.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const studentIds = studentGuardians.map((sg) => sg.studentId);

    const [loans, reservations, fines] = await Promise.all([
      prisma.libraryLoan.findMany({
        where: {
          schoolId,
          studentId: { in: studentIds },
          status: { in: ['ISSUED', 'OVERDUE'] },
        },
        include: {
          student: { select: { id: true, studentCode: true, firstNameEn: true, lastNameEn: true } },
          copy: {
            include: {
              book: { select: { id: true, titleEn: true, titleBn: true, author: true } },
            },
          },
        },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.libraryReservation.findMany({
        where: {
          schoolId,
          studentId: { in: studentIds },
          status: 'PENDING',
        },
        include: {
          student: { select: { id: true, studentCode: true, firstNameEn: true, lastNameEn: true } },
          book: { select: { id: true, titleEn: true, titleBn: true } },
        },
        orderBy: { reservationDate: 'asc' },
      }),
      prisma.libraryFine.findMany({
        where: {
          schoolId,
          studentId: { in: studentIds },
          status: 'UNPAID',
        },
        include: {
          student: { select: { id: true, studentCode: true, firstNameEn: true, lastNameEn: true } },
          loan: {
            include: {
              copy: {
                include: { book: { select: { id: true, titleEn: true } } },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const enrichedLoans = loans.map((l) => ({
      ...l,
      isOverdue: l.dueDate < new Date(),
      overdueDays: calculateOverdueDays(l.dueDate),
    }));

    return NextResponse.json({
      success: true,
      data: {
        children: studentGuardians.map((sg) => sg.student),
        loans: enrichedLoans,
        reservations,
        fines,
      },
    });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
