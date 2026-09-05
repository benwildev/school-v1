import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { generateAdvanceNumber } from '@/lib/payroll/payslip';
import { SalaryAdvanceSchema } from '@/lib/validation/payroll';
import { AdvanceStatus, AuditAction } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'ADVANCE_VIEW' });

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status') as AdvanceStatus | null;

    const where: any = { schoolId };
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;

    const advances = await prisma.salaryAdvance.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            fullNameEn: true,
            designation: true,
            department: true,
          },
        },
        repaymentLogs: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: advances });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, { permission: 'ADVANCE_CREATE' });

    const body = await request.json();
    const parseResult = SalaryAdvanceSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validation Error', details: parseResult.error.format() }, { status: 400 });
    }

    const { employeeId, amount, monthlyDeduction, purpose } = parseResult.data;

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, schoolId },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found in this school.' }, { status: 404 });
    }

    if (monthlyDeduction > amount) {
      return NextResponse.json({ error: 'Monthly deduction cannot be greater than total advance amount.' }, { status: 400 });
    }

    const advance = await withTenantContext(schoolId, async (tx) => {
      const advanceNumber = generateAdvanceNumber(new Date());

      return tx.salaryAdvance.create({
        data: {
          schoolId,
          employeeId,
          advanceNumber,
          requestedAmount: amount,
          approvedAmount: amount,
          monthlyDeduction,
          totalRecovered: 0,
          balanceRemaining: amount,
          reason: purpose,
          status: AdvanceStatus.PENDING,
        },
        include: { employee: true },
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName,
      action: AuditAction.INSERT,
      entity: 'SalaryAdvance',
      entityId: advance.id,
      afterState: advance as any,
      changeSummary: `Requested salary advance of ৳${amount} for employee '${employee.fullNameEn}' (${advance.advanceNumber})`,
    });

    return NextResponse.json({ success: true, data: advance }, { status: 201 });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
