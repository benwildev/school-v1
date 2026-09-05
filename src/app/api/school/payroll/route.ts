import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { PayrollRecordStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'PAYROLL_VIEW' });

    const { searchParams } = new URL(request.url);
    const periodId = searchParams.get('periodId');
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status') as PayrollRecordStatus | null;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const skip = (page - 1) * limit;

    const where: any = { schoolId };
    if (periodId) where.periodId = periodId;
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;

    const [total, records] = await Promise.all([
      prisma.payrollRecord.count({ where }),
      prisma.payrollRecord.findMany({
        where,
        include: {
          period: true,
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
          payments: true,
        },
        orderBy: [{ period: { startDate: 'desc' } }, { employee: { employeeCode: 'asc' } }],
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: records,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
