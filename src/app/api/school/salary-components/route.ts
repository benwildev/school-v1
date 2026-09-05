import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { SalaryComponentSchema } from '@/lib/validation/payroll';
import { AuditAction, RecordStatus, SalaryComponentType } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'SALARY_VIEW' });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as SalaryComponentType | null;
    const status = searchParams.get('status') as RecordStatus | null;

    const where: any = { schoolId };
    if (type) where.type = type;
    if (status) where.status = status;

    const components = await prisma.salaryComponent.findMany({
      where,
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
    });

    return NextResponse.json({ success: true, data: components });
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
    const parseResult = SalaryComponentSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validation Error', details: parseResult.error.format() }, { status: 400 });
    }

    const { code, name, nameBn, type, calculationMethod, defaultAmount, formula, isTaxable, isMandatory, isActive } =
      parseResult.data;

    const existing = await prisma.salaryComponent.findUnique({
      where: {
        schoolId_code: { schoolId, code },
      },
    });

    if (existing) {
      return NextResponse.json({ error: `Salary component code '${code}' already exists.` }, { status: 409 });
    }

    const component = await withTenantContext(schoolId, async (tx) => {
      return tx.salaryComponent.create({
        data: {
          schoolId,
          code,
          nameEn: name,
          nameBn: nameBn || name,
          type,
          calculationMethod,
          defaultAmount,
          formulaExpression: formula ?? null,
          isTaxable: isTaxable ?? false,
          isMandatory: isMandatory ?? false,
          status: isActive ? RecordStatus.ACTIVE : RecordStatus.INACTIVE,
        },
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName,
      action: AuditAction.INSERT,
      entity: 'SalaryComponent',
      entityId: component.id,
      afterState: component as any,
      changeSummary: `Created salary component '${component.nameEn}' (${component.code})`,
    });

    return NextResponse.json({ success: true, data: component }, { status: 201 });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
