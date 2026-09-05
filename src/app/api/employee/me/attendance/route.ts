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

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {
      schoolId: employee.schoolId,
      employeeId: employee.id,
    };

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (startDate) {
      where.date = { gte: new Date(startDate) };
    }

    const attendance = await prisma.employeeAttendance.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ success: true, data: attendance });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
