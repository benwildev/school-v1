import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { PayrollPeriodSchema } from '@/lib/validation/payroll';
import { AuditAction, PayrollPeriodStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'PAYROLL_VIEW' });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as PayrollPeriodStatus | null;

    const where: any = { schoolId };
    if (status) where.status = status;

    const periods = await prisma.payrollPeriod.findMany({
      where,
      include: {
        _count: {
          select: { payrollRecords: true },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    return NextResponse.json({ success: true, data: periods });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, { permission: 'PAYROLL_CREATE' });

    const body = await request.json();
    const parseResult = PayrollPeriodSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validation Error', details: parseResult.error.format() }, { status: 400 });
    }

    const { periodName, startDate, endDate, cutOffDate } = parseResult.data;

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      return NextResponse.json({ error: 'End date cannot be earlier than start date.' }, { status: 400 });
    }

    const periodKey = startDate.substring(0, 7); // e.g. "2026-01"

    const existing = await prisma.payrollPeriod.findUnique({
      where: {
        schoolId_periodKey: { schoolId, periodKey },
      },
    });

    if (existing) {
      return NextResponse.json({ error: `Payroll period for '${periodKey}' already exists.` }, { status: 409 });
    }

    const period = await withTenantContext(schoolId, async (tx) => {
      return tx.payrollPeriod.create({
        data: {
          schoolId,
          periodKey,
          nameEn: periodName,
          nameBn: periodName,
          startDate: start,
          endDate: end,
          paymentDueDate: cutOffDate ? new Date(cutOffDate) : null,
          status: PayrollPeriodStatus.DRAFT,
        },
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName,
      action: AuditAction.INSERT,
      entity: 'PayrollPeriod',
      entityId: period.id,
      afterState: period as any,
      changeSummary: `Created payroll period '${period.nameEn}' (${periodKey})`,
    });

    return NextResponse.json({ success: true, data: period }, { status: 201 });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
