import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { LeaveTypeSchema } from '@/lib/validation/hr';
import { AuditAction, Prisma, RecordStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'LEAVE_VIEW' });

    const leaveTypes = await prisma.leaveType.findMany({
      where: { schoolId },
      orderBy: { nameEn: 'asc' },
    });

    return NextResponse.json({ success: true, data: leaveTypes });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, { permission: 'HR_CREATE' });

    const body = await request.json();
    const parseResult = LeaveTypeSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validation Error', details: parseResult.error.format() }, { status: 400 });
    }

    const { code, nameEn, nameBn, annualDays, isPaid, allowCarryForward, status } = parseResult.data;

    const existing = await prisma.leaveType.findUnique({
      where: {
        schoolId_code: { schoolId, code },
      },
    });

    if (existing) {
      return NextResponse.json({ error: `Leave type code '${code}' already exists.` }, { status: 409 });
    }

    const leaveType = await withTenantContext(schoolId, async (tx) => {
      const created = await tx.leaveType.create({
        data: {
          schoolId,
          code,
          nameEn,
          nameBn,
          annualDays: annualDays ?? 10,
          isPaid: isPaid ?? true,
          allowCarryForward: allowCarryForward ?? false,
          status: (status as RecordStatus) || RecordStatus.ACTIVE,
        },
      });

      const activeEmployees = await tx.employee.findMany({
        where: { schoolId, status: 'ACTIVE' },
        select: { id: true },
      });

      const currentYear = new Date().getFullYear();
      for (const emp of activeEmployees) {
        await tx.leaveBalance.upsert({
          where: {
            schoolId_employeeId_leaveTypeId_year: {
              schoolId,
              employeeId: emp.id,
              leaveTypeId: created.id,
              year: currentYear,
            },
          },
          create: {
            schoolId,
            employeeId: emp.id,
            leaveTypeId: created.id,
            year: currentYear,
            allocatedDays: new Prisma.Decimal(created.annualDays),
            usedDays: new Prisma.Decimal(0),
            pendingDays: new Prisma.Decimal(0),
            remainingDays: new Prisma.Decimal(created.annualDays),
          },
          update: {},
        });
      }

      return created;
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName,
      action: AuditAction.INSERT,
      entity: 'LeaveType',
      entityId: leaveType.id,
      afterState: leaveType as any,
      changeSummary: `Created leave type '${leaveType.nameEn}' (${leaveType.code}) with ${leaveType.annualDays} annual days`,
    });

    return NextResponse.json({ success: true, data: leaveType }, { status: 201 });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
