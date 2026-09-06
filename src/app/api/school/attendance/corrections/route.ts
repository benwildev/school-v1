import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction } from '@prisma/client';
import { AttendanceCorrectionSchema } from '@/lib/validation/attendance-advanced';
import { validateCorrectionReason, validateStatusTransition } from '@/lib/attendance/correction-engine';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'ATTENDANCE_VIEW' });

    const { searchParams } = new URL(request.url);
    const attendanceType = searchParams.get('attendanceType');
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10));
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    return await withTenantContext(schoolId, async (tx) => {
      const where: any = { schoolId };
      if (attendanceType) where.attendanceType = attendanceType;

      const [total, corrections] = await Promise.all([
        tx.attendanceCorrection.count({ where }),
        tx.attendanceCorrection.findMany({
          where,
          include: {
            actionBy: { select: { id: true, fullName: true, email: true } },
            studentAttendance: {
              select: {
                id: true,
                date: true,
                student: { select: { id: true, studentCode: true, fullNameEn: true } },
              },
            },
            employeeAttendance: {
              select: {
                id: true,
                date: true,
                employee: { select: { id: true, employeeCode: true, fullNameEn: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
      ]);

      return NextResponse.json({
        success: true,
        data: { total, limit, offset, corrections },
      });
    });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, { permission: 'ATTENDANCE_UPDATE' });

    const body = await request.json();
    const validated = AttendanceCorrectionSchema.parse(body);

    const reasonValidation = validateCorrectionReason(validated.actionReason);
    if (!reasonValidation.isValid) {
      return NextResponse.json({ error: reasonValidation.error }, { status: 400 });
    }

    const transitionValidation = validateStatusTransition(validated.originalStatus, validated.correctedStatus);
    if (!transitionValidation.isValid) {
      return NextResponse.json({ error: transitionValidation.error }, { status: 400 });
    }

    return await withTenantContext(schoolId, async (tx) => {
      if (validated.attendanceType === 'STUDENT') {
        if (!validated.studentAttendanceId) {
          return NextResponse.json({ error: 'studentAttendanceId is required for student corrections' }, { status: 400 });
        }

        const existing = await tx.studentAttendance.findFirst({
          where: { id: validated.studentAttendanceId, schoolId },
        });

        if (!existing) {
          return NextResponse.json({ error: 'Student attendance record not found' }, { status: 404 });
        }

        const [correction, updated] = await tx.$transaction([
          tx.attendanceCorrection.create({
            data: {
              schoolId,
              attendanceType: 'STUDENT',
              studentAttendanceId: existing.id,
              originalStatus: existing.status,
              correctedStatus: validated.correctedStatus,
              actionById: context.userId,
              actionReason: validated.actionReason,
            },
          }),
          tx.studentAttendance.update({
            where: { id: existing.id },
            data: {
              status: validated.correctedStatus,
              updatedById: context.userId,
              updatedAt: new Date(),
            },
          }),
        ]);

        await logAuditEvent({
          schoolId,
          actorUserId: context.userId,
          actorName: context.user.fullName,
          actorRole: 'ADMIN',
          action: AuditAction.UPDATE,
          entity: 'StudentAttendance',
          entityId: existing.id,
          changeSummary: `Corrected student attendance status from ${existing.status} to ${validated.correctedStatus}. Reason: ${validated.actionReason}`,
          beforeState: existing,
          afterState: updated,
        });

        return NextResponse.json({
          success: true,
          data: {
            correction,
            updatedAttendance: updated,
          },
        });
      } else {
        // Employee Attendance
        if (!validated.employeeAttendanceId) {
          return NextResponse.json({ error: 'employeeAttendanceId is required for employee corrections' }, { status: 400 });
        }

        const existing = await tx.employeeAttendance.findFirst({
          where: { id: validated.employeeAttendanceId, schoolId },
        });

        if (!existing) {
          return NextResponse.json({ error: 'Employee attendance record not found' }, { status: 404 });
        }

        const [correction, updated] = await tx.$transaction([
          tx.attendanceCorrection.create({
            data: {
              schoolId,
              attendanceType: 'EMPLOYEE',
              employeeAttendanceId: existing.id,
              originalStatus: existing.status,
              correctedStatus: validated.correctedStatus,
              actionById: context.userId,
              actionReason: validated.actionReason,
            },
          }),
          tx.employeeAttendance.update({
            where: { id: existing.id },
            data: {
              status: validated.correctedStatus,
            },
          }),
        ]);

        await logAuditEvent({
          schoolId,
          actorUserId: context.userId,
          actorName: context.user.fullName,
          actorRole: 'ADMIN',
          action: AuditAction.UPDATE,
          entity: 'EmployeeAttendance',
          entityId: existing.id,
          changeSummary: `Corrected employee attendance status from ${existing.status} to ${validated.correctedStatus}. Reason: ${validated.actionReason}`,
          beforeState: existing,
          afterState: updated,
        });

        return NextResponse.json({
          success: true,
          data: {
            correction,
            updatedAttendance: updated,
          },
        });
      }
    });
  } catch (error: any) {
    if (error.name === 'ZodError') return NextResponse.json({ error: 'Validation Error', details: error.errors }, { status: 400 });
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
