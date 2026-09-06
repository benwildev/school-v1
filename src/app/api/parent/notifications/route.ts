import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requireAuth } from '@/lib/authorization/engine';

export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth(request);

    // 1. Find guardian record for this user
    const guardian = await prisma.guardian.findFirst({
      where: { userId: context.userId },
      include: {
        students: {
          include: {
            student: {
              select: {
                id: true,
                studentCode: true,
                fullNameEn: true,
                fullNameBn: true,
                schoolId: true,
              },
            },
          },
        },
      },
    });

    if (!guardian) {
      return NextResponse.json({ error: 'Guardian profile not found for this account' }, { status: 403 });
    }

    const schoolId = guardian.schoolId;
    const linkedStudentIds = guardian.students.map((s: any) => s.student.id);

    return await withTenantContext(schoolId, async (tx) => {
      // Fetch notifications and message logs for linked children and guardian
      const [notifications, messages] = await Promise.all([
        tx.notification.findMany({
          where: {
            schoolId,
            userId: context.userId,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        tx.messageLog.findMany({
          where: {
            schoolId,
            OR: [
              { guardianId: guardian.id },
              { studentId: { in: linkedStudentIds } },
            ],
          },
          include: {
            student: { select: { id: true, studentCode: true, fullNameEn: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          linkedStudents: guardian.students.map((s: any) => s.student),
          notifications,
          messageLogs: messages,
        },
      });
    });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
