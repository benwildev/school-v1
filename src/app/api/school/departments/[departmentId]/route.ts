import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { DepartmentUpdateSchema } from '@/lib/validation/hr';
import { AuditAction, RecordStatus } from '@prisma/client';

export async function GET(request: NextRequest, { params }: { params: Promise<{ departmentId: string }> }) {
  try {
    const { departmentId } = await params;
    const { schoolId } = await requirePermission(request, { permission: 'STAFF_VIEW' });

    const department = await prisma.department.findFirst({
      where: { id: departmentId, schoolId },
      include: {
        employees: {
          select: {
            id: true,
            employeeCode: true,
            fullNameEn: true,
            designation: true,
            status: true,
          },
        },
      },
    });

    if (!department) {
      return NextResponse.json({ error: 'Department not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: department });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ departmentId: string }> }) {
  try {
    const { departmentId } = await params;
    const { context, schoolId } = await requirePermission(request, { permission: 'HR_UPDATE' });

    const existing = await prisma.department.findFirst({
      where: { id: departmentId, schoolId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Department not found.' }, { status: 404 });
    }

    const body = await request.json();
    const parseResult = DepartmentUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validation Error', details: parseResult.error.format() }, { status: 400 });
    }

    const updated = await withTenantContext(schoolId, async (tx) => {
      return tx.department.update({
        where: { id: departmentId },
        data: parseResult.data as any,
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName,
      action: AuditAction.UPDATE,
      entity: 'Department',
      entityId: departmentId,
      beforeState: existing as any,
      afterState: updated as any,
      changeSummary: `Updated department '${updated.nameEn}'`,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ departmentId: string }> }) {
  try {
    const { departmentId } = await params;
    const { context, schoolId } = await requirePermission(request, { permission: 'HR_DELETE' });

    const existing = await prisma.department.findFirst({
      where: { id: departmentId, schoolId },
      include: { _count: { select: { employees: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Department not found.' }, { status: 404 });
    }

    if (existing._count.employees > 0) {
      // Historical safety: soft deactivation instead of hard deletion when employees depend on it
      const deactivated = await withTenantContext(schoolId, async (tx) => {
        return tx.department.update({
          where: { id: departmentId },
          data: { status: RecordStatus.INACTIVE },
        });
      });

      return NextResponse.json({
        success: true,
        message: 'Department has active employees and was safely deactivated instead of deleted.',
        data: deactivated,
      });
    }

    await withTenantContext(schoolId, async (tx) => {
      return tx.department.delete({ where: { id: departmentId } });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName,
      action: AuditAction.DELETE,
      entity: 'Department',
      entityId: departmentId,
      beforeState: existing as any,
      changeSummary: `Deleted department '${existing.nameEn}'`,
    });

    return NextResponse.json({ success: true, message: 'Department deleted successfully.' });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
