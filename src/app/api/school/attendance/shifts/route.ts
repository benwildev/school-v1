import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { EmployeeShiftCreateSchema } from '@/lib/validation/attendance-advanced';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'ATTENDANCE_VIEW' });

    return await withTenantContext(schoolId, async (tx) => {
      const shifts = await tx.employeeShift.findMany({
        where: { schoolId },
        orderBy: { code: 'asc' },
      });

      return NextResponse.json({ success: true, data: shifts });
    });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'ATTENDANCE_CREATE' });

    const body = await request.json();
    const validated = EmployeeShiftCreateSchema.parse(body);

    return await withTenantContext(schoolId, async (tx) => {
      const existing = await tx.employeeShift.findUnique({
        where: {
          schoolId_code: {
            schoolId,
            code: validated.code,
          },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: `Shift with code '${validated.code}' already exists in this school.` },
          { status: 409 }
        );
      }

      const shift = await tx.employeeShift.create({
        data: {
          schoolId,
          nameEn: validated.nameEn,
          nameBn: validated.nameBn,
          code: validated.code,
          startTime: new Date(`1970-01-01T${validated.startTime}Z`),
          endTime: new Date(`1970-01-01T${validated.endTime}Z`),
          lateGraceMinutes: validated.lateGraceMinutes,
          halfDayLateMinutes: validated.halfDayLateMinutes,
          workingDays: validated.workingDays,
          isActive: validated.isActive,
        },
      });

      return NextResponse.json({ success: true, data: shift }, { status: 201 });
    });
  } catch (error: any) {
    if (error.name === 'ZodError') return NextResponse.json({ error: 'Validation Error', details: error.errors }, { status: 400 });
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
