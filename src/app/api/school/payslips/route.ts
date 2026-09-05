import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'PAYSLIP_VIEW' });

    const { searchParams } = new URL(request.url);
    const periodId = searchParams.get('periodId');
    const employeeId = searchParams.get('employeeId');
    const payslipNumber = searchParams.get('payslipNumber');

    const where: any = { schoolId };
    if (periodId) where.periodId = periodId;
    if (employeeId) where.employeeId = employeeId;
    if (payslipNumber) where.payslipNumber = payslipNumber;

    const payslips = await prisma.payrollRecord.findMany({
      where,
      select: {
        id: true,
        payslipNumber: true,
        periodId: true,
        employeeId: true,
        basicSalary: true,
        grossEarnings: true,
        totalDeductions: true,
        advanceRecoveryAmount: true,
        netSalary: true,
        paidAmount: true,
        dueSalary: true,
        status: true,
        createdAt: true,
        finalizedAt: true,
        period: {
          select: {
            id: true,
            nameEn: true,
            nameBn: true,
            startDate: true,
            endDate: true,
          },
        },
        employee: {
          select: {
            id: true,
            employeeCode: true,
            fullNameEn: true,
            fullNameBn: true,
            department: { select: { nameEn: true, nameBn: true } },
            designation: { select: { titleEn: true, titleBn: true } },
            campus: { select: { nameEn: true, nameBn: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return NextResponse.json({ success: true, data: payslips });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
