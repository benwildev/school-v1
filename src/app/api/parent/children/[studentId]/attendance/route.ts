import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/authorization/engine';

/**
 * GET /api/parent/children/[studentId]/attendance
 * Parent portal endpoint to view child's historical attendance records with strict IDOR verification
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const context = await requireAuth(request);
    const { studentId } = await params;

    // Strict IDOR Protection: Verify caller is an active guardian of this child
    const guardianRelation = await prisma.studentGuardian.findFirst({
      where: {
        studentId,
        guardian: {
          userId: context.userId,
        },
      },
      include: {
        student: {
          select: {
            id: true,
            schoolId: true,
            studentCode: true,
            fullNameEn: true,
            fullNameBn: true,
          },
        },
      },
    });

    if (!guardianRelation) {
      return NextResponse.json(
        { error: 'Forbidden: You are not authorized to view attendance for this student.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const academicSessionId = searchParams.get('academicSessionId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {
      studentId,
      schoolId: guardianRelation.student.schoolId,
    };

    if (academicSessionId) where.academicSessionId = academicSessionId;

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const attendances = await prisma.studentAttendance.findMany({
      where,
      include: {
        enrollment: {
          select: {
            rollNo: true,
            academicSession: { select: { id: true, name: true } },
            class: { select: { id: true, nameEn: true, nameBn: true } },
            section: { select: { id: true, nameEn: true, nameBn: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
      take: 120,
    });

    const totalDays = attendances.length;
    const presentDays = attendances.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
    const absentDays = attendances.filter((a) => a.status === 'ABSENT').length;
    const lateDays = attendances.filter((a) => a.status === 'LATE').length;
    const attendancePercentage = totalDays > 0 ? Number(((presentDays / totalDays) * 100).toFixed(1)) : 0;

    return NextResponse.json({
      student: guardianRelation.student,
      summary: {
        totalDays,
        presentDays,
        absentDays,
        lateDays,
        attendancePercentage,
      },
      data: attendances,
    });
  } catch (error: any) {
    console.error('Error fetching parent child attendance:', error);
    if (error.message?.startsWith('UNAUTHORIZED') || error.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
