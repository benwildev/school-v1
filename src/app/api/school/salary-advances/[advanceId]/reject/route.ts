import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
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
      return NextResponse.json({ error: `Cannot reject advance with status '${existing.status}'.` }, { status: 400 });
    }

    let remarks = 'Advance request rejected.';
    try {
      const body = await request.json();
      if (body.remarks) remarks = body.remarks;
    } catch {
      // Body is optional
    }

    const rejected = await withTenantContext(schoolId, async (tx) => {
      return tx.salaryAdvance.update({
        where: { id: advanceId },
        data: {
          status: AdvanceStatus.REJECTED,
          reason: remarks,
        },
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName,
      action: AuditAction.REJECT,
      entity: 'SalaryAdvance',
      entityId: advanceId,
      beforeState: existing as any,
      afterState: rejected as any,
      changeSummary: `Rejected salary advance for '${existing.employee.fullNameEn}' (${existing.advanceNumber})`,
    });

    return NextResponse.json({ success: true, data: rejected });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
