import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authorization/engine';
import { prisma, withTenantContext } from '@/lib/db';

/**
 * GET /api/student/reports
 * Student self-service reports: own academic results, attendance rate, and fee balance.
 * Strictly protected against IDOR and cross-tenant leakage.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth(request);

    // 1. Resolve student identity via canonical StudentUser link
    const studentUser = await prisma.studentUser.findUnique({
      where: { userId: context.userId },
      include: {
        student: {
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
        },
      },
    });

    if (!studentUser || !studentUser.student || studentUser.student.deletedAt) {
      return NextResponse.json(
        { success: false, error: 'Student profile not linked to this account.' },
        { status: 404 }
      );
    }

    const student = studentUser.student;
    const schoolId = student.schoolId;

    // Optional studentId param validation: if supplied, must strictly match own student ID
    const url = new URL(request.url);
    const requestedStudentId = url.searchParams.get('studentId');
    if (requestedStudentId && requestedStudentId !== student.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: You are not authorized to view another student\'s report.' },
        { status: 403 }
      );
    }

    // 2. Fetch all student metrics inside strictly isolated tenant context
    return await withTenantContext(schoolId, async (tx) => {
      const currentEnrollment = student.enrollments[0];

      // Fetch Academic Exam Results
      const examResults = await tx.studentExamResult.findMany({
        where: { schoolId, studentId: student.id },
        include: { exam: { select: { nameEn: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      // Fetch Attendance Stats
      const attendances = await tx.studentAttendance.findMany({
        where: { schoolId, studentId: student.id },
        select: { status: true },
      });

      const totalDays = attendances.length;
      const presentDays = attendances.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
      const attendanceRate = totalDays > 0 ? Number(((presentDays / totalDays) * 100).toFixed(1)) : 0;

      // Fetch Outstanding Fees
      const feesAggregate = await tx.studentFee.aggregate({
        where: {
          schoolId,
          studentId: student.id,
          status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
        _sum: { dueAmount: true },
      });

      // Fetch Active Library Loans
      const activeLoans = await tx.libraryLoan.findMany({
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
    });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
