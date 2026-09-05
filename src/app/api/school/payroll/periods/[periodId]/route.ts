import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ periodId: string }> }
) {
  try {
    const { periodId } = await params;
    const { schoolId } = await requirePermission(request, { permission: 'PAYROLL_VIEW' });

    const period = await prisma.payrollPeriod.findFirst({
      where: { id: periodId, schoolId },
      include: {
        payrollRecords: {
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                fullNameEn: true,
                department: true,
                designation: true,
              },
            },
            items: true,
          },
        },
      },
    });

    if (!period) {
      return NextResponse.json({ error: 'Payroll period not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: period });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
