import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { SalaryStructureSchema } from '@/lib/validation/payroll';
import { AuditAction, RecordStatus } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ structureId: string }> }
) {
  try {
    const { structureId } = await params;
    const { schoolId } = await requirePermission(request, { permission: 'SALARY_VIEW' });

    const structure = await prisma.salaryStructure.findFirst({
      where: { id: structureId, schoolId },
      include: {
        items: {
          include: { component: true },
        },
      },
    });

    if (!structure) {
      return NextResponse.json({ error: 'Salary structure not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: structure });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ structureId: string }> }
) {
  try {
    const { structureId } = await params;
    const { context, schoolId } = await requirePermission(request, { permission: 'SALARY_UPDATE' });

    const existing = await prisma.salaryStructure.findFirst({
      where: { id: structureId, schoolId },
      include: { items: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Salary structure not found.' }, { status: 404 });
    }

    const body = await request.json();
    const parseResult = SalaryStructureSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validation Error', details: parseResult.error.format() }, { status: 400 });
    }

    const { name, description, isActive, items } = parseResult.data;

    const componentIds = items.map((i) => i.componentId);
    const validComponents = await prisma.salaryComponent.findMany({
      where: { id: { in: componentIds }, schoolId },
    });

    if (validComponents.length !== componentIds.length) {
      return NextResponse.json({ error: 'One or more salary components do not belong to this school.' }, { status: 400 });
    }

    const updated = await withTenantContext(schoolId, async (tx) => {
      await tx.salaryStructureItem.deleteMany({ where: { structureId } });

      await tx.salaryStructure.update({
        where: { id: structureId },
        data: {
          nameEn: name,
          nameBn: name,
          description: description ?? null,
          status: isActive ? RecordStatus.ACTIVE : RecordStatus.INACTIVE,
        },
      });

      for (const item of items) {
        await tx.salaryStructureItem.create({
          data: {
            schoolId,
            structureId,
            componentId: item.componentId,
            amount: item.amount,
          },
        });
      }

      return tx.salaryStructure.findUnique({
        where: { id: structureId },
        include: {
          items: {
            include: { component: true },
          },
        },
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName,
      action: AuditAction.UPDATE,
      entity: 'SalaryStructure',
      entityId: structureId,
      beforeState: existing as any,
      afterState: updated as any,
      changeSummary: `Updated salary structure '${updated!.nameEn}'`,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ structureId: string }> }
) {
  try {
    const { structureId } = await params;
    const { context, schoolId } = await requirePermission(request, { permission: 'SALARY_UPDATE' });

    const existing = await prisma.salaryStructure.findFirst({
      where: { id: structureId, schoolId },
      include: { _count: { select: { salaryAssignments: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Salary structure not found.' }, { status: 404 });
    }

    if (existing._count.salaryAssignments > 0) {
      const deactivated = await withTenantContext(schoolId, async (tx) => {
        return tx.salaryStructure.update({
          where: { id: structureId },
          data: { status: RecordStatus.INACTIVE },
        });
      });

      return NextResponse.json({
        success: true,
        message: 'Structure has active employee assignments and was safely deactivated.',
        data: deactivated,
      });
    }

    await withTenantContext(schoolId, async (tx) => {
      await tx.salaryStructureItem.deleteMany({ where: { structureId } });
      return tx.salaryStructure.delete({ where: { id: structureId } });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName,
      action: AuditAction.DELETE,
      entity: 'SalaryStructure',
      entityId: structureId,
      beforeState: existing as any,
      changeSummary: `Deleted salary structure '${existing.nameEn}'`,
    });

    return NextResponse.json({ success: true, message: 'Salary structure deleted successfully.' });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
