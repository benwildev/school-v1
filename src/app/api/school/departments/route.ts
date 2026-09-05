import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { DepartmentSchema } from '@/lib/validation/hr';
import { AuditAction, RecordStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'STAFF_VIEW' });

    const departments = await prisma.department.findMany({
      where: { schoolId },
      include: {
        _count: {
          select: { employees: true },
        },
      },
      orderBy: { nameEn: 'asc' },
    });

    return NextResponse.json({ success: true, data: departments });
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
    const parseResult = DepartmentSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validation Error', details: parseResult.error.format() }, { status: 400 });
    }

    const { nameEn, nameBn, code, description, status } = parseResult.data;

    const existing = await prisma.department.findUnique({
      where: {
        schoolId_code: { schoolId, code },
      },
    });

    if (existing) {
      return NextResponse.json({ error: `Department code '${code}' already exists.` }, { status: 409 });
    }

    const department = await withTenantContext(schoolId, async (tx) => {
      return tx.department.create({
        data: {
          schoolId,
          nameEn,
          nameBn,
          code,
          description: description ?? null,
          status: (status as RecordStatus) || RecordStatus.ACTIVE,
        },
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName,
      action: AuditAction.INSERT,
      entity: 'Department',
      entityId: department.id,
      afterState: department as any,
      changeSummary: `Created department '${department.nameEn}' (${department.code})`,
    });

    return NextResponse.json({ success: true, data: department }, { status: 201 });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
