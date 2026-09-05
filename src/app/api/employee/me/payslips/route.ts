import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/authorization/engine';

export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth(request);

    const employee = await prisma.employee.findFirst({
      where: {
        userId: context.userId,
        ...(context.activeSchoolId ? { schoolId: context.activeSchoolId } : {}),
      },
    });

    if (!employee) {
      return NextResponse.json({ error: 'No employee record linked to current user session.' }, { status: 404 });
    }

    const payslips = await prisma.payrollRecord.findMany({
      where: {
        schoolId: employee.schoolId,
        employeeId: employee.id,
      },
      include: {
        period: true,
        items: true,
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: payslips });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
