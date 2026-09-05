import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { assertNotSelfApproval, deductLeaveBalance } from '@/lib/hr/leave-engine';
import { AuditAction, LeaveRequestStatus } from '@prisma/client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leaveRequestId: string }> }
) {
  try {
    const { leaveRequestId } = await params;
    const { context, schoolId } = await requirePermission(request, { permission: 'LEAVE_APPROVE' });

    const leaveRequest = await prisma.leaveRequest.findFirst({
      where: { id: leaveRequestId, schoolId },
      include: { employee: true, leaveType: true },
    });

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Leave request not found.' }, { status: 404 });
    }

    if (leaveRequest.status !== LeaveRequestStatus.PENDING) {
      return NextResponse.json({ error: `Cannot approve request with status '${leaveRequest.status}'.` }, { status: 400 });
    }

    assertNotSelfApproval(context.userId, leaveRequest.employee.userId);

    const approved = await withTenantContext(schoolId, async (tx) => {
      await tx.$executeRaw`SELECT id FROM leave_requests WHERE id = ${leaveRequestId}::uuid FOR UPDATE`;

      await deductLeaveBalance(
        tx,
        schoolId,
        leaveRequest.employeeId,
        leaveRequest.leaveTypeId,
        Number(leaveRequest.totalDays)
      );

      return tx.leaveRequest.update({
        where: { id: leaveRequestId },
        data: {
          status: LeaveRequestStatus.APPROVED,
          actionedById: context.userId,
          actionedAt: new Date(),
        },
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName,
      action: AuditAction.APPROVE,
      entity: 'LeaveRequest',
      entityId: leaveRequestId,
      beforeState: leaveRequest as any,
      afterState: approved as any,
      changeSummary: `Approved leave request for '${leaveRequest.employee.fullNameEn}' (${leaveRequest.totalDays} days)`,
    });

    return NextResponse.json({ success: true, data: approved });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 400 });
  }
}
