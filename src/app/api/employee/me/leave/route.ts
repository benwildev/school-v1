import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requireAuth } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { calculateDaysBetween, validateLeaveBalance } from '@/lib/hr/leave-engine';
import { AuditAction, LeaveRequestStatus } from '@prisma/client';
import { z } from 'zod';

const SelfLeaveRequestSchema = z.object({
  leaveTypeId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  reason: z.string().min(3).max(500),
});

export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth(request);

    const employee = await prisma.employee.findFirst({
      where: {
        userId: context.userId,
        ...(context.activeSchoolId ? { schoolId: context.activeSchoolId } : {}),
      },
    });

    if (!employee) {
      return NextResponse.json({ error: 'No employee record linked to current user session.' }, { status: 404 });
    }

    const [balances, requests] = await Promise.all([
      prisma.leaveBalance.findMany({
        where: { schoolId: employee.schoolId, employeeId: employee.id },
        include: { leaveType: true },
        orderBy: { year: 'desc' },
      }),
      prisma.leaveRequest.findMany({
        where: { schoolId: employee.schoolId, employeeId: employee.id },
        include: { leaveType: true },
        orderBy: { appliedAt: 'desc' },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        balances,
        requests,
      },
    });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireAuth(request);

    const employee = await prisma.employee.findFirst({
      where: {
        userId: context.userId,
        ...(context.activeSchoolId ? { schoolId: context.activeSchoolId } : {}),
      },
    });

    if (!employee) {
      return NextResponse.json({ error: 'No employee record linked to current user session.' }, { status: 404 });
    }

    const body = await request.json();
    const parseResult = SelfLeaveRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validation Error', details: parseResult.error.format() }, { status: 400 });
    }

    const { leaveTypeId, startDate, endDate, reason } = parseResult.data;

    const leaveType = await prisma.leaveType.findFirst({
      where: { id: leaveTypeId, schoolId: employee.schoolId },
    });

    if (!leaveType) {
      return NextResponse.json({ error: 'Leave type not found.' }, { status: 404 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      return NextResponse.json({ error: 'End date cannot be earlier than start date.' }, { status: 400 });
    }

    const totalDays = calculateDaysBetween(startDate, endDate);

    await validateLeaveBalance(prisma, employee.schoolId, employee.id, leaveTypeId, totalDays);

    const leaveRequest = await withTenantContext(employee.schoolId, async (tx) => {
      return tx.leaveRequest.create({
        data: {
          schoolId: employee.schoolId,
          employeeId: employee.id,
          leaveTypeId,
          startDate: start,
          endDate: end,
          totalDays,
          reason,
          status: LeaveRequestStatus.PENDING,
          appliedAt: new Date(),
        },
        include: { leaveType: true },
      });
    });

    await logAuditEvent({
      schoolId: employee.schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName,
      action: AuditAction.INSERT,
      entity: 'LeaveRequest',
      entityId: leaveRequest.id,
      afterState: leaveRequest as any,
      changeSummary: `Employee self-service leave request submitted for ${totalDays} days`,
    });

    return NextResponse.json({ success: true, data: leaveRequest }, { status: 201 });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 400 });
  }
}
