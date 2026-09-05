import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ payrollId: string }> }
) {
  try {
    const { payrollId } = await params;
    const { schoolId } = await requirePermission(request, { permission: 'PAYROLL_VIEW' });

    const record = await prisma.payrollRecord.findFirst({
      where: { id: payrollId, schoolId },
      include: {
        period: true,
        employee: {
          include: {
            department: true,
            designation: true,
            campus: true,
          },
        },
        salaryAssignment: true,
        items: {
          include: { component: true },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!record) {
      return NextResponse.json({ error: 'Payroll record not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: record });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
