import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { SalaryAdvanceApproveSchema } from '@/lib/validation/payroll';
import { AdvanceStatus, AuditAction } from '@prisma/client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ advanceId: string }> }
) {
  try {
    const { advanceId } = await params;
    const { context, schoolId } = await requirePermission(request, { permission: 'ADVANCE_APPROVE' });

    const existing = await prisma.salaryAdvance.findFirst({
      where: { id: advanceId, schoolId },
      include: { employee: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Salary advance not found.' }, { status: 404 });
    }

    if (existing.status !== AdvanceStatus.PENDING) {
      return NextResponse.json({ error: `Cannot approve advance with status '${existing.status}'.` }, { status: 400 });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body is optional
    }

    const parseResult = SalaryAdvanceApproveSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validation Error', details: parseResult.error.format() }, { status: 400 });
    }

    const approvedAmount = parseResult.data.approvedAmount ?? Number(existing.requestedAmount);
    const monthlyDeduction = parseResult.data.monthlyDeduction ?? Number(existing.monthlyDeduction);
    const remarks = parseResult.data.remarks ?? existing.reason;

    const approved = await withTenantContext(schoolId, async (tx) => {
      return tx.salaryAdvance.update({
        where: { id: advanceId },
        data: {
          approvedAmount,
          monthlyDeduction,
          balanceRemaining: approvedAmount,
          status: AdvanceStatus.APPROVED,
          approvedById: context.userId,
          approvedAt: new Date(),
          reason: remarks,
        },
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName,
      action: AuditAction.APPROVE,
      entity: 'SalaryAdvance',
      entityId: advanceId,
      beforeState: existing as any,
      afterState: approved as any,
      changeSummary: `Approved salary advance of ৳${approvedAmount} for '${existing.employee.fullNameEn}' (${existing.advanceNumber})`,
    });

    return NextResponse.json({ success: true, data: approved });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
