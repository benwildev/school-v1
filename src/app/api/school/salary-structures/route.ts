import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { SalaryStructureSchema } from '@/lib/validation/payroll';
import { AuditAction, RecordStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'SALARY_VIEW' });

    const structures = await prisma.salaryStructure.findMany({
      where: { schoolId },
      include: {
        items: {
          include: { component: true },
        },
        _count: {
          select: { salaryAssignments: true },
        },
      },
      orderBy: { nameEn: 'asc' },
    });

    return NextResponse.json({ success: true, data: structures });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, { permission: 'SALARY_CREATE' });

    const body = await request.json();
    const parseResult = SalaryStructureSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validation Error', details: parseResult.error.format() }, { status: 400 });
    }

    const { name, description, isActive, items } = parseResult.data;
    const code = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 30);

    const componentIds = items.map((i) => i.componentId);
    const validComponents = await prisma.salaryComponent.findMany({
      where: { id: { in: componentIds }, schoolId },
    });

    if (validComponents.length !== componentIds.length) {
      return NextResponse.json({ error: 'One or more salary components do not belong to this school.' }, { status: 400 });
    }

    const structure = await withTenantContext(schoolId, async (tx) => {
      const created = await tx.salaryStructure.create({
        data: {
          schoolId,
          code: `${code}_${Date.now().toString().slice(-4)}`,
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
            structureId: created.id,
            componentId: item.componentId,
            amount: item.amount,
          },
        });
      }

      return tx.salaryStructure.findUnique({
        where: { id: created.id },
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
      action: AuditAction.INSERT,
      entity: 'SalaryStructure',
      entityId: structure!.id,
      afterState: structure as any,
      changeSummary: `Created salary structure '${structure!.nameEn}' with ${items.length} items`,
    });

    return NextResponse.json({ success: true, data: structure }, { status: 201 });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
