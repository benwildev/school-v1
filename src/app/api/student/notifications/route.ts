import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requireAuth } from '@/lib/authorization/engine';

export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth(request);

    // 1. Find StudentUser mapping
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
      return NextResponse.json({ error: 'Student profile not found for this account' }, { status: 403 });
    }

    const schoolId = studentUser.student.schoolId;
    const studentId = studentUser.student.id;

    return await withTenantContext(schoolId, async () => {
      const [notifications, messages] = await Promise.all([
        prisma.notification.findMany({
          where: {
            schoolId,
            userId: context.userId,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        prisma.messageLog.findMany({
          where: {
            schoolId,
            studentId,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          student: studentUser.student,
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
