import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { EmployeeUpdateSchema } from '@/lib/validation/hr';
import { AuditAction, EmployeeStatus } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const { employeeId } = await params;
    const { context, schoolId } = await requirePermission(request, { permission: 'STAFF_VIEW' });

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, schoolId },
      include: {
        department: true,
        designation: true,
        campus: true,
        teacher: true,
        salaryAssignments: {
          orderBy: { effectiveFrom: 'desc' },
          include: {
            items: {
              include: { component: true },
            },
          },
        },
        leaveBalances: {
          include: { leaveType: true },
        },
        advances: {
          orderBy: { createdAt: 'desc' },
        },
        documents: true,
      },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
    }

    const isPrivileged =
      context.user.isSuperAdmin ||
      (context as any).roles?.some((r: string) =>
        ['SCHOOL_OWNER', 'PRINCIPAL', 'ADMIN', 'HR', 'ACCOUNTANT'].includes(r.toUpperCase())
      );

    const safeEmployee = isPrivileged
      ? employee
      : {
          ...employee,
          nationalId: employee.nationalId ? 'REDACTED' : null,
          birthRegistrationNo: employee.birthRegistrationNo ? 'REDACTED' : null,
          bankAccountNo: employee.bankAccountNo ? 'REDACTED' : null,
          salaryAssignments: [],
          advances: [],
        };

    return NextResponse.json({ success: true, data: safeEmployee });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const { employeeId } = await params;
    const { context, schoolId } = await requirePermission(request, { permission: 'EMPLOYEES_UPDATE' });

    const existing = await prisma.employee.findFirst({
      where: { id: employeeId, schoolId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
    }

    const body = await request.json();
    const parseResult = EmployeeUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validation Error', details: parseResult.error.format() }, { status: 400 });
    }

    const data = parseResult.data;

    // Validate relationships if changed
    if (data.departmentId && data.departmentId !== existing.departmentId) {
      const dept = await prisma.department.findFirst({
        where: { id: data.departmentId, schoolId },
      });
      if (!dept) return NextResponse.json({ error: 'Department not found in school.' }, { status: 400 });
    }

    if (data.designationId && data.designationId !== existing.designationId) {
      const desig = await prisma.designation.findFirst({
        where: { id: data.designationId, schoolId },
      });
      if (!desig) return NextResponse.json({ error: 'Designation not found in school.' }, { status: 400 });
    }

    if (data.campusId && data.campusId !== existing.campusId) {
      const campus = await prisma.campus.findFirst({
        where: { id: data.campusId, schoolId },
      });
      if (!campus) return NextResponse.json({ error: 'Campus not found in school.' }, { status: 400 });
    }

    const updatePayload: any = { ...data };
    if (data.dateOfBirth) updatePayload.dateOfBirth = new Date(data.dateOfBirth);
    if (data.joiningDate) updatePayload.joiningDate = new Date(data.joiningDate);
    if (data.confirmationDate) updatePayload.confirmationDate = new Date(data.confirmationDate);
    if (data.terminationDate) updatePayload.terminationDate = new Date(data.terminationDate);

    // If status changed to TERMINATED or RESIGNED, record termination date if not set
    if (
      (data.status === EmployeeStatus.TERMINATED || data.status === EmployeeStatus.RESIGNED) &&
      !data.terminationDate &&
      !existing.terminationDate
    ) {
      updatePayload.terminationDate = new Date();
    }

    const updated = await withTenantContext(schoolId, async (tx) => {
      return tx.employee.update({
        where: { id: employeeId },
        data: updatePayload,
        include: {
          department: true,
          designation: true,
          campus: true,
        },
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName,
      action: AuditAction.UPDATE,
      entity: 'Employee',
      entityId: employeeId,
      beforeState: existing as any,
      afterState: updated as any,
      changeSummary: `Updated employee record '${updated.fullNameEn}' (${updated.employeeCode})`,
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
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const { employeeId } = await params;
    const { context, schoolId } = await requirePermission(request, { permission: 'EMPLOYEES_DEACTIVATE' });

    const existing = await prisma.employee.findFirst({
      where: { id: employeeId, schoolId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
    }

    // Safe deactivation: soft update status to INACTIVE, retaining historical salary & payroll
    const deactivated = await withTenantContext(schoolId, async (tx) => {
      return tx.employee.update({
        where: { id: employeeId },
        data: {
          status: EmployeeStatus.INACTIVE,
          terminationDate: new Date(),
        },
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName,
      action: AuditAction.DELETE,
      entity: 'Employee',
      entityId: employeeId,
      beforeState: existing as any,
      afterState: deactivated as any,
      changeSummary: `Deactivated employee '${existing.fullNameEn}' (${existing.employeeCode})`,
    });

    return NextResponse.json({
      success: true,
      message: 'Employee deactivated successfully. Historical payroll records preserved.',
      data: deactivated,
    });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
