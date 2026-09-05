import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authorization/engine';
import { prisma } from '@/lib/db';

/**
 * GET /api/student/reports
 * Student self-service reports: own academic results, attendance rate, and fee balance.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth(request);

    // Find student linked to user by email or phone
    const student = await prisma.student.findFirst({
      where: {
        OR: [
          ...(context.user.email ? [{ email: context.user.email }] : []),
          { phone: context.user.phone },
        ],
        deletedAt: null,
      },
      include: {
        enrollments: {
          where: { status: 'ACTIVE' },
          include: {
            class: { select: { nameEn: true, nameBn: true } },
            section: { select: { nameEn: true, nameBn: true } },
            academicSession: { select: { name: true } },
          },
          take: 1,
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student record not linked to this account.' }, { status: 404 });
    }

    const schoolId = student.schoolId;
    const currentEnrollment = student.enrollments[0];

    // Fetch Academic Exam Results
    const examResults = await prisma.studentExamResult.findMany({
      where: { schoolId, studentId: student.id },
      include: { exam: { select: { nameEn: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Fetch Attendance Stats
    const attendances = await prisma.studentAttendance.findMany({
      where: { schoolId, studentId: student.id },
      select: { status: true },
    });

    const totalDays = attendances.length;
    const presentDays = attendances.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
    const attendanceRate = totalDays > 0 ? Number(((presentDays / totalDays) * 100).toFixed(1)) : 0;

    // Fetch Outstanding Fees
    const feesAggregate = await prisma.studentFee.aggregate({
      where: {
        schoolId,
        studentId: student.id,
        status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      _sum: { dueAmount: true },
    });

    // Fetch Active Library Loans
    const activeLoans = await prisma.libraryLoan.findMany({
      where: {
        schoolId,
        studentId: student.id,
        status: { in: ['ISSUED', 'OVERDUE'] },
      },
      include: {
        copy: { include: { book: { select: { titleEn: true } } } },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        student: {
          id: student.id,
          studentCode: student.studentCode,
          fullNameEn: student.fullNameEn,
          className: currentEnrollment?.class?.nameEn || '-',
          sectionName: currentEnrollment?.section?.nameEn || '-',
          rollNumber: currentEnrollment?.rollNo ?? '-',
          sessionName: currentEnrollment?.academicSession?.name || '-',

        },
        academics: {
          recentResults: examResults.map((r) => ({
            examName: r.exam.nameEn,
            gpa: Number(r.calculatedGpa),
            grade: r.finalGrade,
            isPassed: r.isPassed,
            rank: r.classPosition ?? '-',
          })),
        },
        attendance: {
          workingDays: totalDays,
          presentDays,
          attendanceRate,
        },
        finance: {
          totalDue: Number(feesAggregate._sum.dueAmount || 0),
        },
        library: {
          borrowedBooksCount: activeLoans.length,
          borrowedBooks: activeLoans.map((l) => ({
            title: l.copy.book.titleEn,
            dueDate: l.dueDate.toISOString().split('T')[0],
            status: l.status,
          })),
        },
      },
    });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
