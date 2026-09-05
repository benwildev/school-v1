import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { generateEmployeeCode } from '@/lib/hr/employee-code';
import { initializeEmployeeLeaveBalances } from '@/lib/hr/leave-engine';
import { EmployeeSchema } from '@/lib/validation/hr';
import { AuditAction, EmployeeStatus, EmploymentType, Gender, BloodGroup } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, { permission: 'STAFF_VIEW' });

    const { searchParams } = new URL(request.url);
    const campusId = searchParams.get('campusId');
    const departmentId = searchParams.get('departmentId');
    const designationId = searchParams.get('designationId');
    const status = searchParams.get('status') as EmployeeStatus | null;
    const employmentType = searchParams.get('employmentType') as EmploymentType | null;
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const skip = (page - 1) * limit;

    const where: any = { schoolId };
    if (campusId) where.campusId = campusId;
    if (departmentId) where.departmentId = departmentId;
    if (designationId) where.designationId = designationId;
    if (status) where.status = status;
    if (employmentType) where.employmentType = employmentType;

    if (search) {
      where.OR = [
        { fullNameEn: { contains: search, mode: 'insensitive' } },
        { fullNameBn: { contains: search, mode: 'insensitive' } },
        { employeeCode: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, employees] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where,
        include: {
          department: true,
          designation: true,
          campus: { select: { id: true, nameEn: true, nameBn: true } },
          teacher: { select: { id: true, teacherCode: true, fullNameEn: true } },
          salaryAssignments: {
            where: { status: 'ACTIVE' },
            take: 1,
            select: { id: true, baseSalary: true, grossSalary: true, effectiveFrom: true },
          },
        },
        orderBy: [{ employeeCode: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    const isPrivileged =
      context.user.isSuperAdmin ||
      (context as any).roles?.some((r: string) =>
        ['SCHOOL_OWNER', 'PRINCIPAL', 'ADMIN', 'HR', 'ACCOUNTANT'].includes(r.toUpperCase())
      );

    const safeEmployees = employees.map((emp) => {
      if (!isPrivileged) {
        return {
          ...emp,
          nationalId: emp.nationalId ? 'REDACTED' : null,
          birthRegistrationNo: emp.birthRegistrationNo ? 'REDACTED' : null,
          bankAccountNo: emp.bankAccountNo ? 'REDACTED' : null,
          salaryAssignments: [],
        };
      }
      return emp;
    });

    return NextResponse.json({
      success: true,
      data: safeEmployees,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, { permission: 'EMPLOYEES_CREATE' });

    const body = await request.json();
    const parseResult = EmployeeSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validation Error', details: parseResult.error.format() }, { status: 400 });
    }

    const data = parseResult.data;

    // Validate foreign keys in school scope
    if (data.departmentId) {
      const dept = await prisma.department.findFirst({
        where: { id: data.departmentId, schoolId },
      });
      if (!dept) return NextResponse.json({ error: 'Department does not belong to this school.' }, { status: 400 });
    }

    if (data.designationId) {
      const desig = await prisma.designation.findFirst({
        where: { id: data.designationId, schoolId },
      });
      if (!desig) return NextResponse.json({ error: 'Designation does not belong to this school.' }, { status: 400 });
    }

    if (data.campusId) {
      const campus = await prisma.campus.findFirst({
        where: { id: data.campusId, schoolId },
      });
      if (!campus) return NextResponse.json({ error: 'Campus does not belong to this school.' }, { status: 400 });
    }

    if (data.teacherId) {
      const teacher = await prisma.teacher.findFirst({
        where: { id: data.teacherId, schoolId },
      });
      if (!teacher) return NextResponse.json({ error: 'Teacher does not belong to this school.' }, { status: 400 });

      const existingLink = await prisma.employee.findFirst({
        where: { teacherId: data.teacherId, schoolId },
      });
      if (existingLink) {
        return NextResponse.json({ error: 'This teacher record is already linked to an employee.' }, { status: 409 });
      }
    }

    if (data.userId) {
      const user = await prisma.user.findFirst({
        where: { id: data.userId },
      });
      if (!user) return NextResponse.json({ error: 'Linked user not found.' }, { status: 400 });

      const existingUser = await prisma.employee.findFirst({
        where: { userId: data.userId, schoolId },
      });
      if (existingUser) {
        return NextResponse.json({ error: 'This user identity is already linked to an employee in this school.' }, { status: 409 });
      }
    }

    const names = data.fullNameEn.trim().split(' ');
    const firstNameEn = data.firstNameEn || names[0] || data.fullNameEn;
    const lastNameEn = data.lastNameEn || (names.length > 1 ? names.slice(1).join(' ') : firstNameEn);

    const employee = await withTenantContext(schoolId, async (tx) => {
      const employeeCode = generateEmployeeCode('EMP', new Date());

      const created = await tx.employee.create({
        data: {
          schoolId,
          campusId: data.campusId ?? null,
          userId: data.userId ?? null,
          teacherId: data.teacherId ?? null,
          employeeCode,
          firstNameEn,
          lastNameEn,
          fullNameEn: data.fullNameEn,
          fullNameBn: data.fullNameBn || data.fullNameEn,
          phone: data.phone,
          email: data.email ?? null,
          dateOfBirth: new Date(data.dateOfBirth),
          gender: (data.gender as Gender) || Gender.MALE,
          bloodGroup: (data.bloodGroup as BloodGroup) ?? null,
          nationalId: data.nationalId || 'N/A',
          birthRegistrationNo: data.birthRegistrationNo ?? null,
          presentAddress: data.presentAddress ?? null,
          permanentAddress: data.permanentAddress ?? null,
          emergencyContactName: data.emergencyContactName ?? null,
          emergencyContactPhone: data.emergencyContactPhone ?? null,
          emergencyContactRelation: data.emergencyContactRelation ?? null,
          joiningDate: new Date(data.joiningDate),
          confirmationDate: data.confirmationDate ? new Date(data.confirmationDate) : null,
          employmentType: (data.employmentType as EmploymentType) || EmploymentType.PERMANENT,
          status: (data.status as EmployeeStatus) || EmployeeStatus.ACTIVE,
          departmentId: data.departmentId,
          designationId: data.designationId,
          bankName: data.bankName ?? null,
          bankAccountNo: data.bankAccountNo ?? null,
          bankRoutingNo: data.bankRoutingNo ?? null,
          mfsProvider: data.mfsProvider ?? null,
          mfsNumber: data.mfsNumber ?? null,
        },
        include: {
          department: true,
          designation: true,
          campus: { select: { id: true, nameEn: true, nameBn: true } },
          teacher: { select: { id: true, teacherCode: true, fullNameEn: true } },
        },
      });

      await initializeEmployeeLeaveBalances(tx, schoolId, created.id);

      return created;
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName,
      action: AuditAction.INSERT,
      entity: 'Employee',
      entityId: employee.id,
      afterState: employee as any,
      changeSummary: `Created employee record '${employee.fullNameEn}' (${employee.employeeCode})`,
    });

    return NextResponse.json({ success: true, data: employee }, { status: 201 });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
