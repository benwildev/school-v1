import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction } from '@prisma/client';
import { AttendanceVerificationSchema } from '@/lib/validation/attendance-advanced';

export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, { permission: 'ATTENDANCE_VERIFY' });

    const body = await request.json();
    const validated = AttendanceVerificationSchema.parse(body);

    return await withTenantContext(schoolId, async (tx) => {
      let updatedCount = 0;

      if (validated.attendanceType === 'STUDENT') {
        const updateResult = await tx.studentAttendance.updateMany({
          where: {
            schoolId,
            id: { in: validated.attendanceIds },
          },
          data: {
            verificationStatus: validated.status,
            verifiedById: context.userId,
            verifiedAt: new Date(),
          },
        });
        updatedCount = updateResult.count;
      } else {
        const updateResult = await tx.employeeAttendance.updateMany({
          where: {
            schoolId,
            id: { in: validated.attendanceIds },
          },
          data: {
            verificationStatus: validated.status,
            verifiedById: context.userId,
            verifiedAt: new Date(),
          },
        });
        updatedCount = updateResult.count;
      }

      await logAuditEvent({
        schoolId,
        actorUserId: context.userId,
        actorName: context.user.fullName,
        actorRole: 'SUPERVISOR',
        action: AuditAction.UPDATE,
        entity: validated.attendanceType === 'STUDENT' ? 'StudentAttendance' : 'EmployeeAttendance',
        entityId: validated.attendanceIds[0] || 'BATCH',
        changeSummary: `Verified ${updatedCount} ${validated.attendanceType.toLowerCase()} attendance records as ${validated.status}`,
      });

      return NextResponse.json({
        success: true,
        data: {
          updatedCount,
          verificationStatus: validated.status,
          verifiedAt: new Date(),
        },
      });
    });
  } catch (error: any) {
    if (error.name === 'ZodError') return NextResponse.json({ error: 'Validation Error', details: error.errors }, { status: 400 });
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
