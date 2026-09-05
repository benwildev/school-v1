import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { SalaryComponentSchema } from '@/lib/validation/payroll';
import { AuditAction, RecordStatus } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ componentId: string }> }
) {
  try {
    const { componentId } = await params;
    const { schoolId } = await requirePermission(request, { permission: 'SALARY_VIEW' });

    const component = await prisma.salaryComponent.findFirst({
      where: { id: componentId, schoolId },
    });

    if (!component) {
      return NextResponse.json({ error: 'Salary component not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: component });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ componentId: string }> }
) {
  try {
    const { componentId } = await params;
    const { context, schoolId } = await requirePermission(request, { permission: 'SALARY_UPDATE' });

    const existing = await prisma.salaryComponent.findFirst({
      where: { id: componentId, schoolId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Salary component not found.' }, { status: 404 });
    }

    const body = await request.json();
    const parseResult = SalaryComponentSchema.partial().safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validation Error', details: parseResult.error.format() }, { status: 400 });
    }

    const data = parseResult.data;
    const updateData: any = {};
    if (data.code !== undefined) updateData.code = data.code;
    if (data.name !== undefined) updateData.nameEn = data.name;
    if (data.nameBn !== undefined) updateData.nameBn = data.nameBn || data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.calculationMethod !== undefined) updateData.calculationMethod = data.calculationMethod;
    if (data.defaultAmount !== undefined) updateData.defaultAmount = data.defaultAmount;
    if (data.formula !== undefined) updateData.formulaExpression = data.formula;
    if (data.isTaxable !== undefined) updateData.isTaxable = data.isTaxable;
    if (data.isMandatory !== undefined) updateData.isMandatory = data.isMandatory;
    if (data.isActive !== undefined) updateData.status = data.isActive ? RecordStatus.ACTIVE : RecordStatus.INACTIVE;

    const updated = await withTenantContext(schoolId, async (tx) => {
      return tx.salaryComponent.update({
        where: { id: componentId },
        data: updateData,
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName,
      action: AuditAction.UPDATE,
      entity: 'SalaryComponent',
      entityId: componentId,
      beforeState: existing as any,
      afterState: updated as any,
      changeSummary: `Updated salary component '${updated.nameEn}'`,
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
  { params }: { params: Promise<{ componentId: string }> }
) {
  try {
    const { componentId } = await params;
    const { context, schoolId } = await requirePermission(request, { permission: 'SALARY_UPDATE' });

    const existing = await prisma.salaryComponent.findFirst({
      where: { id: componentId, schoolId },
      include: {
        _count: {
          select: { structureItems: true, salaryItems: true, payrollItems: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Salary component not found.' }, { status: 404 });
    }

    const hasUsage =
      existing._count.structureItems > 0 ||
      existing._count.salaryItems > 0 ||
      existing._count.payrollItems > 0;

    if (hasUsage) {
      const deactivated = await withTenantContext(schoolId, async (tx) => {
        return tx.salaryComponent.update({
          where: { id: componentId },
          data: { status: RecordStatus.INACTIVE },
        });
      });

      return NextResponse.json({
        success: true,
        message: 'Component is referenced by structures or payroll records and was safely deactivated.',
        data: deactivated,
      });
    }

    await withTenantContext(schoolId, async (tx) => {
      return tx.salaryComponent.delete({ where: { id: componentId } });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName,
      action: AuditAction.DELETE,
      entity: 'SalaryComponent',
      entityId: componentId,
      beforeState: existing as any,
      changeSummary: `Deleted salary component '${existing.nameEn}'`,
    });

    return NextResponse.json({ success: true, message: 'Salary component deleted successfully.' });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
