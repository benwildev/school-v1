import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requireAuth } from '@/lib/authorization/engine';

export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth(request);

    // 1. Find employee profile for this user
    const employee = await prisma.employee.findFirst({
      where: { userId: context.userId, deletedAt: null },
      include: {
        department: { select: { id: true, nameEn: true, nameBn: true } },
        designation: { select: { id: true, titleEn: true, titleBn: true } },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee profile not found for this account' }, { status: 403 });
    }

    const schoolId = employee.schoolId;

    return await withTenantContext(schoolId, async (tx) => {
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
            recipientPhone: employee.phone,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          employee: {
            id: employee.id,
            employeeCode: employee.employeeCode,
            fullNameEn: employee.fullNameEn,
            department: employee.department?.nameEn,
            designation: employee.designation?.titleEn,
          },
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
