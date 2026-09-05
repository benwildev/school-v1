import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/authorization/engine';

/**
 * GET /api/student/attendance
 * Student portal endpoint to view own attendance history
 */
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth(request);

    // Find student identity for the authenticated student user
    const studentUser = await prisma.studentUser.findUnique({
      where: { userId: context.userId },
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

    if (!studentUser) {
      return NextResponse.json(
        { error: 'No student profile linked to this account.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const academicSessionId = searchParams.get('academicSessionId');

    const where: any = {
      studentId: studentUser.studentId,
      schoolId: studentUser.student.schoolId,
    };

    if (academicSessionId) where.academicSessionId = academicSessionId;

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
      take: 100,
    });

    const totalDays = attendances.length;
    const presentDays = attendances.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
    const absentDays = attendances.filter((a) => a.status === 'ABSENT').length;
    const lateDays = attendances.filter((a) => a.status === 'LATE').length;
    const attendancePercentage = totalDays > 0 ? Number(((presentDays / totalDays) * 100).toFixed(1)) : 0;

    return NextResponse.json({
      student: studentUser.student,
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
    console.error('Error fetching student attendance:', error);
    if (error.message?.startsWith('UNAUTHORIZED') || error.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
