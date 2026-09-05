import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { DailyAttendanceBatchSchema } from '@/lib/validation/attendance';
import { verifyTeacherAttendanceScope } from '@/lib/academic/teacher-scope';
import { AuditAction } from '@prisma/client';

/**
 * POST /api/school/attendance/batch
 * Bulk records daily attendance for a class/section roster with teacher scoping & duplicate prevention
 * Required Permission: ATTENDANCE_CREATE
 */
export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, {
      permission: 'ATTENDANCE_CREATE',
    });

    const body = await request.json();
    const parseResult = DailyAttendanceBatchSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { academicSessionId, classId, sectionId, date, source, records } = parseResult.data;
    const targetDate = new Date(date);

    // 1. Authoritative Teacher Scope Check
    const scopeCheck = await verifyTeacherAttendanceScope({
      userId: context.userId,
      schoolId,
      academicSessionId,
      classId,
      sectionId,
    });

    if (!scopeCheck.isAuthorized) {
      return NextResponse.json(
        { error: scopeCheck.reason || 'Forbidden: You do not have permission to take attendance for this class/section.' },
        { status: 403 }
      );
    }

    // 2. Validate Session, Class, and Section tenant ownership
    const [session, classObj, section] = await Promise.all([
      prisma.academicSession.findFirst({ where: { id: academicSessionId, schoolId } }),
      prisma.class.findFirst({ where: { id: classId, schoolId } }),
      prisma.section.findFirst({ where: { id: sectionId, classId, schoolId } }),
    ]);

    if (!session) return NextResponse.json({ error: 'Academic session not found in this school' }, { status: 404 });
    if (!classObj) return NextResponse.json({ error: 'Class not found in this school' }, { status: 404 });
    if (!section) return NextResponse.json({ error: 'Section not found in this class/school' }, { status: 404 });

    // 3. Validate that enrollments exist and belong to this section/session
    const enrollmentIds = records.map((r) => r.enrollmentId);
    const validEnrollments = await prisma.enrollment.findMany({
      where: {
        id: { in: enrollmentIds },
        schoolId,
        academicSessionId,
        classId,
        sectionId,
        status: 'ACTIVE',
      },
      select: { id: true, studentId: true },
    });

    if (validEnrollments.length !== records.length) {
      return NextResponse.json(
        { error: 'One or more students do not have active enrollments in this class and section' },
        { status: 400 }
      );
    }

    const enrollmentMap = new Map(validEnrollments.map((e) => [e.id, e.studentId]));
    for (const record of records) {
      if (enrollmentMap.get(record.enrollmentId) !== record.studentId) {
        return NextResponse.json(
          { error: `Enrollment ID ${record.enrollmentId} does not match student ID ${record.studentId}` },
          { status: 400 }
        );
      }
    }

    // 4. Atomic transaction with duplicate prevention
    const createdRecords = await withTenantContext(schoolId, async (tx) => {
      // Check if attendance already exists for any of these enrollments on target date
      const existing = await tx.studentAttendance.findMany({
        where: {
          schoolId,
          enrollmentId: { in: enrollmentIds },
          date: targetDate,
          periodId: null,
        },
        select: { enrollmentId: true },
      });

      if (existing.length > 0) {
        throw new Error(`DUPLICATE_ATTENDANCE: Attendance has already been submitted for one or more students on ${date}.`);
      }

      // Bulk create
      const created = [];
      for (const rec of records) {
        const item = await tx.studentAttendance.create({
          data: {
            schoolId,
            academicSessionId,
            classId,
            sectionId,
            enrollmentId: rec.enrollmentId,
            studentId: rec.studentId,
            date: targetDate,
            periodId: null,
            status: rec.status,
            source,
            lateMinutes: rec.lateMinutes,
            leaveReason: rec.leaveReason,
            markedById: context.userId,
          },
        });
        created.push(item);
      }

      return created;
    });

    // 5. Forensic Audit Log
    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || 'Staff',
      actorRole: scopeCheck.isPrivilegedAdmin ? 'ADMIN' : 'TEACHER',
      action: AuditAction.INSERT,
      entity: 'StudentAttendance',
      entityId: `${classId}_${sectionId}_${date}`,
      afterState: {
        classId,
        sectionId,
        date,
        count: records.length,
      },
      changeSummary: `Submitted daily attendance for ${records.length} students in ${classObj.nameEn} - ${section.nameEn} on ${date}`,
    });

    return NextResponse.json({
      success: true,
      message: 'Attendance recorded successfully',
      data: {
        recordedCount: createdRecords.length,
        date,
        classId,
        sectionId,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error submitting batch attendance:', error);
    if (error.message?.includes('DUPLICATE_ATTENDANCE') || error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Attendance has already been recorded for this class/section on this date. Duplicate submission prevented.' },
        { status: 409 }
      );
    }
    if (error.message?.startsWith('UNAUTHORIZED') || error.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
