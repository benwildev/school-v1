import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { DesignationUpdateSchema } from '@/lib/validation/hr';
import { AuditAction, RecordStatus } from '@prisma/client';

export async function GET(request: NextRequest, { params }: { params: Promise<{ designationId: string }> }) {
  try {
    const { designationId } = await params;
    const { schoolId } = await requirePermission(request, { permission: 'STAFF_VIEW' });

    const designation = await prisma.designation.findFirst({
      where: { id: designationId, schoolId },
      include: {
        department: true,
        employees: {
          select: {
            id: true,
            employeeCode: true,
            fullNameEn: true,
            status: true,
          },
        },
      },
    });

    if (!designation) {
      return NextResponse.json({ error: 'Designation not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: designation });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ designationId: string }> }) {
  try {
    const { designationId } = await params;
    const { context, schoolId } = await requirePermission(request, { permission: 'HR_UPDATE' });

    const existing = await prisma.designation.findFirst({
      where: { id: designationId, schoolId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Designation not found.' }, { status: 404 });
    }

    const body = await request.json();
    const parseResult = DesignationUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validation Error', details: parseResult.error.format() }, { status: 400 });
    }

    const updated = await withTenantContext(schoolId, async (tx) => {
      return tx.designation.update({
        where: { id: designationId },
        data: parseResult.data as any,
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName,
      action: AuditAction.UPDATE,
      entity: 'Designation',
      entityId: designationId,
      beforeState: existing as any,
      afterState: updated as any,
      changeSummary: `Updated designation '${updated.titleEn}'`,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ designationId: string }> }) {
  try {
    const { designationId } = await params;
    const { context, schoolId } = await requirePermission(request, { permission: 'HR_DELETE' });

    const existing = await prisma.designation.findFirst({
      where: { id: designationId, schoolId },
      include: { _count: { select: { employees: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Designation not found.' }, { status: 404 });
    }

    if (existing._count.employees > 0) {
      // Historical preservation: soft deactivation when employees depend on it
      const deactivated = await withTenantContext(schoolId, async (tx) => {
        return tx.designation.update({
          where: { id: designationId },
          data: { status: RecordStatus.INACTIVE },
        });
      });

      return NextResponse.json({
        success: true,
        message: 'Designation has active employees and was safely deactivated instead of deleted.',
        data: deactivated,
      });
    }

    await withTenantContext(schoolId, async (tx) => {
      return tx.designation.delete({ where: { id: designationId } });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName,
      action: AuditAction.DELETE,
      entity: 'Designation',
      entityId: designationId,
      beforeState: existing as any,
      changeSummary: `Deleted designation '${existing.titleEn}'`,
    });

    return NextResponse.json({ success: true, message: 'Designation deleted successfully.' });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
