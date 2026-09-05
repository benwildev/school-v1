import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { AttendanceUpdateSchema } from '@/lib/validation/attendance';
import { verifyTeacherAttendanceScope } from '@/lib/academic/teacher-scope';

/**
 * GET /api/school/attendance/[attendanceId]
 * Retrieve single attendance record
 * Required Permission: ATTENDANCE_VIEW
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attendanceId: string }> }
) {
  try {
    const { schoolId } = await requirePermission(request, {
      permission: 'ATTENDANCE_VIEW',
    });
    const { attendanceId } = await params;

    const record = await prisma.studentAttendance.findFirst({
      where: { id: attendanceId, schoolId },
      include: {
        student: true,
        enrollment: {
          include: {
            class: true,
            section: true,
          },
        },
        markedBy: { select: { id: true, fullName: true } },
        updatedBy: { select: { id: true, fullName: true } },
      },
    });

    if (!record) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
    }

    return NextResponse.json({ data: record });
  } catch (error: any) {
    console.error('Error fetching attendance record:', error);
    if (error.message?.startsWith('UNAUTHORIZED') || error.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * PUT /api/school/attendance/[attendanceId]
 * Update / correct an attendance record with mandatory audit trail
 * Required Permission: ATTENDANCE_UPDATE
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ attendanceId: string }> }
) {
  try {
    const { context, schoolId } = await requirePermission(request, {
      permission: 'ATTENDANCE_UPDATE',
    });
    const { attendanceId } = await params;

    const body = await request.json();
    const parseResult = AttendanceUpdateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { status, reason, lateMinutes, leaveReason } = parseResult.data;

    // 1. Fetch existing attendance record
    const existing = await prisma.studentAttendance.findFirst({
      where: { id: attendanceId, schoolId },
      include: {
        student: true,
        enrollment: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
    }

    // 2. Authoritative Teacher Scope Check
    const academicSessionId = existing.academicSessionId || existing.enrollment.academicSessionId;
    const classId = existing.classId || existing.enrollment.classId;
    const sectionId = existing.sectionId || existing.enrollment.sectionId;

    const scopeCheck = await verifyTeacherAttendanceScope({
      userId: context.userId,
      schoolId,
      academicSessionId,
      classId,
      sectionId,
    });

    if (!scopeCheck.isAuthorized) {
      return NextResponse.json(
        { error: scopeCheck.reason || 'Forbidden: You do not have permission to modify attendance for this class/section.' },
        { status: 403 }
      );
    }

    const beforeState = {
      status: existing.status,
      lateMinutes: existing.lateMinutes,
      leaveReason: existing.leaveReason,
    };

    // 3. Update record in tenant transaction
    const updated = await withTenantContext(schoolId, async (tx) => {
      return await tx.studentAttendance.update({
        where: { id: attendanceId },
        data: {
          status,
          lateMinutes: lateMinutes !== undefined ? lateMinutes : existing.lateMinutes,
          leaveReason: leaveReason !== undefined ? leaveReason : existing.leaveReason,
          updatedById: context.userId,
          updatedAt: new Date(),
        },
      });
    });

    // 4. Forensic Audit Log
    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || 'Staff',
      actorRole: scopeCheck.isPrivilegedAdmin ? 'ADMIN' : 'TEACHER',
      action: 'UPDATE',
      entity: 'StudentAttendance',
      entityId: attendanceId,
      beforeState,
      afterState: {
        status: updated.status,
        lateMinutes: updated.lateMinutes,
        leaveReason: updated.leaveReason,
      },
      changeSummary: `Attendance status changed from ${existing.status} to ${status}. Reason: ${reason}`,
    });

    return NextResponse.json({
      success: true,
      message: 'Attendance corrected successfully',
      data: updated,
    });
  } catch (error: any) {
    console.error('Error updating attendance record:', error);
    if (error.message?.startsWith('UNAUTHORIZED') || error.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
