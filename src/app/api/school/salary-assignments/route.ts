import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { SalaryAssignmentSchema } from '@/lib/validation/payroll';
import { AuditAction, RecordStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'SALARY_VIEW' });

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status') as RecordStatus | null;

    const where: any = { schoolId };
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;

    const assignments = await prisma.employeeSalaryAssignment.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            fullNameEn: true,
            designation: true,
            department: true,
          },
        },
        structure: true,
        items: {
          include: { component: true },
        },
      },
      orderBy: [{ employeeId: 'asc' }, { effectiveFrom: 'desc' }],
    });

    return NextResponse.json({ success: true, data: assignments });
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
    const parseResult = SalaryAssignmentSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validation Error', details: parseResult.error.format() }, { status: 400 });
    }

    const {
      employeeId,
      structureId,
      effectiveFrom,
      effectiveTo,
      baseGrossSalary,
      basicSalary,
      items,
    } = parseResult.data;

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, schoolId },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found in this school.' }, { status: 404 });
    }

    if (structureId) {
      const structure = await prisma.salaryStructure.findFirst({
        where: { id: structureId, schoolId },
      });
      if (!structure) {
        return NextResponse.json({ error: 'Salary structure not found in this school.' }, { status: 400 });
      }
    }

    const newEffectiveFromDate = new Date(effectiveFrom);
    const newEffectiveToDate = effectiveTo ? new Date(effectiveTo) : null;

    if (newEffectiveToDate && newEffectiveToDate < newEffectiveFromDate) {
      return NextResponse.json({ error: 'effectiveTo cannot be earlier than effectiveFrom.' }, { status: 400 });
    }

    const assignment = await withTenantContext(schoolId, async (tx) => {
      // 1. Lock employee record
      await tx.$executeRaw`SELECT id FROM employees WHERE id = ${employeeId}::uuid FOR UPDATE`;

      // 2. Fetch active assignments
      const activeAssignments = await tx.employeeSalaryAssignment.findMany({
        where: {
          employeeId,
          schoolId,
          status: RecordStatus.ACTIVE,
        },
        orderBy: { effectiveFrom: 'desc' },
      });

      // 3. Prevent overlapping dates and close prior active assignments
      for (const active of activeAssignments) {
        if (active.effectiveFrom > newEffectiveFromDate) {
          throw new Error('An active salary assignment already exists with a later effective date.');
        }

        const previousCloseDate = new Date(newEffectiveFromDate);
        previousCloseDate.setDate(previousCloseDate.getDate() - 1);

        await tx.employeeSalaryAssignment.update({
          where: { id: active.id },
          data: {
            effectiveTo: previousCloseDate,
            status: RecordStatus.INACTIVE,
          },
        });
      }

      // 4. Calculate latest version
      const maxVersionAssignment = await tx.employeeSalaryAssignment.findFirst({
        where: { schoolId, employeeId },
        orderBy: { version: 'desc' },
      });
      const version = (maxVersionAssignment?.version ?? 0) + 1;

      // 5. Create new salary assignment
      const created = await tx.employeeSalaryAssignment.create({
        data: {
          schoolId,
          employeeId,
          structureId: structureId ?? null,
          version,
          effectiveFrom: newEffectiveFromDate,
          effectiveTo: newEffectiveToDate,
          baseSalary: basicSalary,
          grossSalary: baseGrossSalary,
          netEstimatedSalary: baseGrossSalary,
          status: RecordStatus.ACTIVE,
          approvedById: context.userId,
          approvedAt: new Date(),
        },
      });

      // Create salary items
      for (const item of items) {
        await tx.employeeSalaryItem.create({
          data: {
            schoolId,
            assignmentId: created.id,
            componentId: item.componentId,
            amount: item.amount,
            calculationSnapshot: {
              calculationMethod: item.calculationMethod,
              formula: item.formula ?? null,
            },
          },
        });
      }

      return tx.employeeSalaryAssignment.findUnique({
        where: { id: created.id },
        include: {
          items: {
            include: { component: true },
          },
          employee: true,
        },
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName,
      action: AuditAction.INSERT,
      entity: 'EmployeeSalaryAssignment',
      entityId: assignment!.id,
      afterState: assignment as any,
      changeSummary: `Created salary assignment for employee '${employee.fullNameEn}' (${employee.employeeCode}) effective from ${effectiveFrom}`,
    });

    return NextResponse.json({ success: true, data: assignment }, { status: 201 });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 400 });
  }
}
