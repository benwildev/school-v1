import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { DesignationSchema } from '@/lib/validation/hr';
import { AuditAction, RecordStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'STAFF_VIEW' });

    const designations = await prisma.designation.findMany({
      where: { schoolId },
      include: {
        department: true,
        _count: { select: { employees: true } },
      },
      orderBy: { titleEn: 'asc' },
    });

    return NextResponse.json({ success: true, data: designations });
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
    const parseResult = DesignationSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validation Error', details: parseResult.error.format() }, { status: 400 });
    }

    const { titleEn, titleBn, code, departmentId, status } = parseResult.data;

    const existing = await prisma.designation.findUnique({
      where: {
        schoolId_code: { schoolId, code },
      },
    });

    if (existing) {
      return NextResponse.json({ error: `Designation code '${code}' already exists.` }, { status: 409 });
    }

    const designation = await withTenantContext(schoolId, async (tx) => {
      return tx.designation.create({
        data: {
          schoolId,
          titleEn,
          titleBn,
          code,
          departmentId: departmentId ?? null,
          status: (status as RecordStatus) || RecordStatus.ACTIVE,
        },
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName,
      action: AuditAction.INSERT,
      entity: 'Designation',
      entityId: designation.id,
      afterState: designation as any,
      changeSummary: `Created designation '${designation.titleEn}' (${designation.code})`,
    });

    return NextResponse.json({ success: true, data: designation }, { status: 201 });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
