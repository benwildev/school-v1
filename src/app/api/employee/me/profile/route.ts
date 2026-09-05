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
      include: {
        department: true,
        designation: true,
        campus: true,
        leaveBalances: {
          include: { leaveType: true },
        },
        salaryAssignments: {
          where: { status: 'ACTIVE' },
          include: {
            items: {
              include: { component: true },
            },
          },
        },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: 'No employee record linked to current user session.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: employee });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
