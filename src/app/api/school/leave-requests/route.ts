import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { calculateDaysBetween, validateLeaveBalance } from '@/lib/hr/leave-engine';
import { LeaveRequestSchema } from '@/lib/validation/hr';
import { AuditAction, LeaveRequestStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'LEAVE_VIEW' });

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status') as LeaveRequestStatus | null;

    const where: any = { schoolId };
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;

    const leaveRequests = await prisma.leaveRequest.findMany({
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
        leaveType: true,
      },
      orderBy: { appliedAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: leaveRequests });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, { permission: 'LEAVE_CREATE' });

    const body = await request.json();
    const parseResult = LeaveRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validation Error', details: parseResult.error.format() }, { status: 400 });
    }

    const { employeeId, leaveTypeId, startDate, endDate, reason } = parseResult.data;

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required.' }, { status: 400 });
    }

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, schoolId },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found in school.' }, { status: 404 });
    }

    const leaveType = await prisma.leaveType.findFirst({
      where: { id: leaveTypeId, schoolId },
    });

    if (!leaveType) {
      return NextResponse.json({ error: 'Leave type not found in school.' }, { status: 404 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      return NextResponse.json({ error: 'End date cannot be earlier than start date.' }, { status: 400 });
    }

    const totalDays = calculateDaysBetween(startDate, endDate);

    await validateLeaveBalance(prisma, schoolId, employeeId, leaveTypeId, totalDays);

    const leaveRequest = await withTenantContext(schoolId, async (tx) => {
      return tx.leaveRequest.create({
        data: {
          schoolId,
          employeeId,
          leaveTypeId,
          startDate: start,
          endDate: end,
          totalDays,
          reason,
          status: LeaveRequestStatus.PENDING,
          appliedAt: new Date(),
        },
        include: {
          employee: true,
          leaveType: true,
        },
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName,
      action: AuditAction.INSERT,
      entity: 'LeaveRequest',
      entityId: leaveRequest.id,
      afterState: leaveRequest as any,
      changeSummary: `Submitted leave request for '${employee.fullNameEn}' (${totalDays} days)`,
    });

    return NextResponse.json({ success: true, data: leaveRequest }, { status: 201 });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
