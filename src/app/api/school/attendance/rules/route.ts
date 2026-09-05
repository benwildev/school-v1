import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { AttendanceRuleCreateSchema } from '@/lib/validation/attendance-advanced';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'ATTENDANCE_VIEW' });

    return await withTenantContext(schoolId, async () => {
      const rules = await prisma.attendanceRule.findMany({
        where: { schoolId },
        include: {
          campus: { select: { id: true, nameEn: true, nameBn: true } },
        },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      });

      return NextResponse.json({ success: true, data: rules });
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
    const validated = AttendanceRuleCreateSchema.parse(body);

    return await withTenantContext(schoolId, async () => {
      if (validated.isDefault) {
        // Reset any existing default rule for the school
        await prisma.attendanceRule.updateMany({
          where: { schoolId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const rule = await prisma.attendanceRule.create({
        data: {
          schoolId,
          campusId: validated.campusId,
          name: validated.name,
          targetType: validated.targetType,
          shift: validated.shift,
          startTime: new Date(`1970-01-01T${validated.startTime}Z`),
          lateThresholdMinutes: validated.lateThresholdMinutes,
          halfDayThresholdMinutes: validated.halfDayThresholdMinutes,
          endTime: new Date(`1970-01-01T${validated.endTime}Z`),
          earlyCheckoutMinutes: validated.earlyCheckoutMinutes,
          workingDays: validated.workingDays,
          gracePeriodMinutes: validated.gracePeriodMinutes,
          checkoutRequired: validated.checkoutRequired,
          isDefault: validated.isDefault,
          isActive: validated.isActive,
        },
      });

      return NextResponse.json({ success: true, data: rule }, { status: 201 });
    });
  } catch (error: any) {
    if (error.name === 'ZodError') return NextResponse.json({ error: 'Validation Error', details: error.errors }, { status: 400 });
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
