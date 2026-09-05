import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { RawEventBatchIngestSchema, RawEventIngestItemSchema } from '@/lib/validation/attendance-advanced';
import { sortEventsByOccurrence } from '@/lib/attendance/device-engine';
import {
  getDhakaDateString,
  getDhakaTimeString,
  evaluateAttendanceStatus,
  AttendanceRuleConfig,
} from '@/lib/attendance/rules-engine';
import { AttendanceSource } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'ATTENDANCE_VIEW' });

    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');
    const status = searchParams.get('status');
    const identifierValue = searchParams.get('identifierValue');
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10));
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    return await withTenantContext(schoolId, async () => {
      const where: any = { schoolId };
      if (deviceId) where.deviceId = deviceId;
      if (status) where.processingStatus = status;
      if (identifierValue) where.identifierValue = { contains: identifierValue, mode: 'insensitive' };

      const [total, events] = await Promise.all([
        prisma.rawAttendanceEvent.count({ where }),
        prisma.rawAttendanceEvent.findMany({
          where,
          include: {
            device: { select: { id: true, deviceName: true, deviceSerial: true } },
            resolvedStudent: { select: { id: true, studentCode: true, fullNameEn: true } },
            resolvedEmployee: { select: { id: true, employeeCode: true, fullNameEn: true } },
          },
          orderBy: { deviceTimestamp: 'desc' },
          take: limit,
          skip: offset,
        }),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          total,
          limit,
          offset,
          events,
        },
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
    const { context, schoolId } = await requirePermission(request, { permission: 'ATTENDANCE_CREATE' });

    const body = await request.json();
    let eventsInput: any[] = [];
    let deviceId: string | null | undefined = null;

    if (body.events && Array.isArray(body.events)) {
      const parsedBatch = RawEventBatchIngestSchema.parse(body);
      eventsInput = parsedBatch.events;
      deviceId = parsedBatch.deviceId;
    } else {
      const parsedItem = RawEventIngestItemSchema.parse(body);
      eventsInput = [parsedItem];
      deviceId = parsedItem.deviceId;
    }

    // Sort events deterministically by device occurrence timestamp (offline sync guarantee)
    const sortedEvents = sortEventsByOccurrence(eventsInput);

    return await withTenantContext(schoolId, async () => {
      // Fetch default attendance rule for the school
      const defaultRuleRecord = await prisma.attendanceRule.findFirst({
        where: { schoolId, isDefault: true, isActive: true },
      });

      const ruleConfig: AttendanceRuleConfig = {
        startTime: defaultRuleRecord ? (defaultRuleRecord.startTime as any).toISOString().slice(11, 19) : '08:00:00',
        lateThresholdMinutes: defaultRuleRecord?.lateThresholdMinutes ?? 15,
        halfDayThresholdMinutes: defaultRuleRecord?.halfDayThresholdMinutes ?? 120,
        gracePeriodMinutes: defaultRuleRecord?.gracePeriodMinutes ?? 5,
      };

      let processedCount = 0;
      let duplicateCount = 0;
      let needsReviewCount = 0;
      let failedCount = 0;
      const results: any[] = [];

      for (const ev of sortedEvents) {
        const targetDeviceId = ev.deviceId || deviceId || null;
        const deviceTime = new Date(ev.deviceTimestamp);
        const dhakaDateStr = getDhakaDateString(deviceTime);
        const dhakaTimeStr = getDhakaTimeString(deviceTime);
        const attendanceDate = new Date(dhakaDateStr);

        // 1. Check duplicate external event ID
        const existingEvent = await prisma.rawAttendanceEvent.findFirst({
          where: {
            schoolId,
            deviceId: targetDeviceId,
            externalEventId: ev.externalEventId,
          },
        });

        if (existingEvent) {
          duplicateCount++;
          results.push({
            externalEventId: ev.externalEventId,
            status: 'DUPLICATE',
            message: 'Event with same externalEventId already exists for this device',
          });
          continue;
        }

        // 2. Insert raw event into raw_attendance_events (permanent forensic retention)
        const rawEvent = await prisma.rawAttendanceEvent.create({
          data: {
            schoolId,
            deviceId: targetDeviceId,
            externalEventId: ev.externalEventId,
            deviceTimestamp: deviceTime,
            identifierType: ev.identifierType,
            identifierValue: ev.identifierValue,
            eventType: ev.eventType || 'CHECK_IN',
            processingStatus: 'PENDING',
            rawPayload: ev.rawPayload || {},
          },
        });

        // 3. Identity Resolution
        // A. Check Student
        const student = await prisma.student.findFirst({
          where: {
            schoolId,
            OR: [
              { studentCode: ev.identifierValue },
              { id: ev.identifierType === 'STUDENT_ID' && /^[0-9a-fA-F-]{36}$/.test(ev.identifierValue) ? ev.identifierValue : undefined },
            ],
            deletedAt: null,
          },
          include: {
            enrollments: {
              where: { status: 'ACTIVE' },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        });

        if (student && student.enrollments.length > 0) {
          const enrollment = student.enrollments[0];
          const evaluation = evaluateAttendanceStatus(dhakaTimeStr, ruleConfig);

          // Check if student attendance already recorded for this date
          let studentAttendance = await prisma.studentAttendance.findFirst({
            where: {
              schoolId,
              studentId: student.id,
              date: attendanceDate,
              periodId: null,
            },
          });

          if (!studentAttendance) {
            studentAttendance = await prisma.studentAttendance.create({
              data: {
                schoolId,
                studentId: student.id,
                enrollmentId: enrollment.id,
                academicSessionId: enrollment.academicSessionId,
                classId: enrollment.classId,
                sectionId: enrollment.sectionId,
                date: attendanceDate,
                status: evaluation.status,
                source: ev.identifierType === 'CARD_NO' ? AttendanceSource.RFID_CARD : AttendanceSource.BIOMETRIC_DEVICE,
                checkInTime: new Date(`1970-01-01T${dhakaTimeStr}Z`),
                lateMinutes: evaluation.lateMinutes,
                markedById: context.userId,
                deviceId: targetDeviceId,
                rawEventId: rawEvent.id,
                verificationStatus: 'UNVERIFIED',
              },
            });
          } else if (ev.eventType === 'CHECK_OUT') {
            studentAttendance = await prisma.studentAttendance.update({
              where: { id: studentAttendance.id },
              data: {
                checkOutTime: new Date(`1970-01-01T${dhakaTimeStr}Z`),
              },
            });
          }

          await prisma.rawAttendanceEvent.update({
            where: { id: rawEvent.id },
            data: {
              processingStatus: 'PROCESSED',
              resolvedUserType: 'STUDENT',
              resolvedStudentId: student.id,
              attendanceRecordId: studentAttendance.id,
              processedAt: new Date(),
            },
          });

          processedCount++;
          results.push({
            externalEventId: ev.externalEventId,
            status: 'PROCESSED',
            userType: 'STUDENT',
            resolvedId: student.id,
            attendanceId: studentAttendance.id,
          });
          continue;
        }

        // B. Check Employee
        const employee = await prisma.employee.findFirst({
          where: {
            schoolId,
            OR: [
              { employeeCode: ev.identifierValue },
              { id: ev.identifierType === 'EMPLOYEE_CODE' && /^[0-9a-fA-F-]{36}$/.test(ev.identifierValue) ? ev.identifierValue : undefined },
            ],
            deletedAt: null,
          },
        });

        if (employee) {
          const evaluation = evaluateAttendanceStatus(dhakaTimeStr, ruleConfig);

          let empAttendance = await prisma.employeeAttendance.findFirst({
            where: {
              schoolId,
              employeeId: employee.id,
              date: attendanceDate,
            },
          });

          if (!empAttendance) {
            empAttendance = await prisma.employeeAttendance.create({
              data: {
                schoolId,
                userId: employee.userId || context.userId,
                employeeId: employee.id,
                teacherId: employee.teacherId,
                date: attendanceDate,
                status: evaluation.status,
                source: ev.identifierType === 'CARD_NO' ? AttendanceSource.RFID_CARD : AttendanceSource.BIOMETRIC_DEVICE,
                checkInTime: new Date(`1970-01-01T${dhakaTimeStr}Z`),
                lateMinutes: evaluation.lateMinutes,
                markedById: context.userId,
                deviceId: targetDeviceId,
                rawEventId: rawEvent.id,
                verificationStatus: 'UNVERIFIED',
              },
            });
          } else if (ev.eventType === 'CHECK_OUT') {
            empAttendance = await prisma.employeeAttendance.update({
              where: { id: empAttendance.id },
              data: {
                checkOutTime: new Date(`1970-01-01T${dhakaTimeStr}Z`),
              },
            });
          }

          await prisma.rawAttendanceEvent.update({
            where: { id: rawEvent.id },
            data: {
              processingStatus: 'PROCESSED',
              resolvedUserType: 'EMPLOYEE',
              resolvedEmployeeId: employee.id,
              attendanceRecordId: empAttendance.id,
              processedAt: new Date(),
            },
          });

          processedCount++;
          results.push({
            externalEventId: ev.externalEventId,
            status: 'PROCESSED',
            userType: 'EMPLOYEE',
            resolvedId: employee.id,
            attendanceId: empAttendance.id,
          });
          continue;
        }

        // C. Neither Student nor Employee resolved
        await prisma.rawAttendanceEvent.update({
          where: { id: rawEvent.id },
          data: {
            processingStatus: 'NEEDS_REVIEW',
            resolvedUserType: 'UNKNOWN',
            errorMessage: `No active student or staff found with identifier ${ev.identifierType}:${ev.identifierValue}`,
            processedAt: new Date(),
          },
        });

        needsReviewCount++;
        results.push({
          externalEventId: ev.externalEventId,
          status: 'NEEDS_REVIEW',
          userType: 'UNKNOWN',
          errorMessage: `Unrecognized identifier ${ev.identifierValue}`,
        });
      }

      return NextResponse.json({
        success: true,
        summary: {
          totalReceived: sortedEvents.length,
          processed: processedCount,
          duplicates: duplicateCount,
          needsReview: needsReviewCount,
          failed: failedCount,
        },
        results,
      }, { status: 200 });
    });
  } catch (error: any) {
    if (error.name === 'ZodError') return NextResponse.json({ error: 'Validation Error', details: error.errors }, { status: 400 });
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
