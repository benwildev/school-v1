import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction, LeaveRequestStatus } from '@prisma/client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leaveRequestId: string }> }
) {
  try {
    const { leaveRequestId } = await params;
    const { context, schoolId } = await requirePermission(request, { permission: 'LEAVE_REJECT' });

    const leaveRequest = await prisma.leaveRequest.findFirst({
      where: { id: leaveRequestId, schoolId },
      include: { employee: true },
    });

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Leave request not found.' }, { status: 404 });
    }

    if (leaveRequest.status !== LeaveRequestStatus.PENDING) {
      return NextResponse.json({ error: `Cannot reject request with status '${leaveRequest.status}'.` }, { status: 400 });
    }

    let rejectionReason = 'Leave request rejected.';
    try {
      const body = await request.json();
      if (body.rejectionReason) rejectionReason = body.rejectionReason;
    } catch {
      // Body is optional
    }

    const rejected = await withTenantContext(schoolId, async (tx) => {
      return tx.leaveRequest.update({
        where: { id: leaveRequestId },
        data: {
          status: LeaveRequestStatus.REJECTED,
          actionedById: context.userId,
          actionedAt: new Date(),
          actionReason: rejectionReason,
        },
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName,
      action: AuditAction.REJECT,
      entity: 'LeaveRequest',
      entityId: leaveRequestId,
      beforeState: leaveRequest as any,
      afterState: rejected as any,
      changeSummary: `Rejected leave request for '${leaveRequest.employee.fullNameEn}'`,
    });

    return NextResponse.json({ success: true, data: rejected });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
