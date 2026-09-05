import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authorization/engine';
import { prisma } from '@/lib/db';

/**
 * GET /api/parent/reports
 * Parent/Guardian portal reports for linked children with strict IDOR barriers.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth(request);

    // Find all children linked to this guardian
    const studentGuardians = await prisma.studentGuardian.findMany({
      where: {
        guardian: {
          userId: context.userId,
        },
      },
      include: {
        student: {
          include: {
            enrollments: {
              where: { status: 'ACTIVE' },
              include: {
                class: { select: { nameEn: true } },
                section: { select: { nameEn: true } },
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!studentGuardians || studentGuardians.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const linkedStudentIds = studentGuardians.map((sg: any) => sg.studentId);
    const { searchParams } = new URL(request.url);
    const requestedStudentId = searchParams.get('studentId');

    // IDOR Protection: If parent requested a specific studentId, ensure it belongs to linked children
    if (requestedStudentId && !linkedStudentIds.includes(requestedStudentId)) {
      return NextResponse.json(
        { error: 'FORBIDDEN: You do not have permission to view reports for this student.' },
        { status: 403 }
      );
    }

    const targetStudentIds = requestedStudentId ? [requestedStudentId] : linkedStudentIds;

    const childrenReports = await Promise.all(
      targetStudentIds.map(async (studentId: string) => {
        const student = studentGuardians.find((sg: any) => sg.studentId === studentId)?.student;
        if (!student) return null;


        const schoolId = student.schoolId;
        const currentEnrollment = student.enrollments[0];

        // Fetch Exam Results
        const examResults = await prisma.studentExamResult.findMany({
          where: { schoolId, studentId },
          include: { exam: { select: { nameEn: true } } },
          orderBy: { createdAt: 'desc' },
          take: 3,
        });

        // Attendance stats
        const attendances = await prisma.studentAttendance.findMany({
          where: { schoolId, studentId },
          select: { status: true },
        });
        const total = attendances.length;
        const present = attendances.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
        const rate = total > 0 ? Number(((present / total) * 100).toFixed(1)) : 0;

        // Fees
        const dueAggregate = await prisma.studentFee.aggregate({
          where: { schoolId, studentId, status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] } },
          _sum: { dueAmount: true },
        });

        return {
          studentId: student.id,
          studentCode: student.studentCode,
          name: student.fullNameEn,
          className: currentEnrollment?.class?.nameEn || '-',
          sectionName: currentEnrollment?.section?.nameEn || '-',
          attendanceRate: rate,
          totalDue: Number(dueAggregate._sum.dueAmount || 0),
          recentResults: examResults.map((r) => ({
            examName: r.exam.nameEn,
            gpa: Number(r.calculatedGpa),
            grade: r.finalGrade,
            isPassed: r.isPassed,
          })),
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: childrenReports.filter(Boolean),
    });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
