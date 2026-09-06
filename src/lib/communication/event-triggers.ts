import { Prisma, MessageChannel, MessageType, DeliveryStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { STANDARD_NOTIFICATION_TEMPLATES, renderTemplate } from './template-engine';
import { TransportBoardingStatus, formatTransportBoardingStatus } from '@/lib/transport/attendance';

export interface AttendanceNotificationRecord {
  id: string;
  studentId: string;
  status: string;
  date: Date;
}

export interface TransportAlertRecord {
  id: string;
  studentId: string;
  boardingStatus: string;
  tripId?: string;
  notes?: string | null;
}

export interface FeeInvoiceNotificationRecord {
  id: string;
  studentId: string;
  invoiceNumber: string;
  netAmount: number | Prisma.Decimal;
  dueDate: Date;
}

/**
 * Enqueue attendance absence notifications to message_logs under school tenant scoping.
 */
export async function enqueueAttendanceAbsenceNotifications(
  schoolId: string,
  absentRecords: AttendanceNotificationRecord[],
  tx?: Prisma.TransactionClient
): Promise<number> {
  if (absentRecords.length === 0) return 0;

  const db = tx || prisma;
  const studentIds = Array.from(new Set(absentRecords.map((r) => r.studentId)));

  // Resolve student names, primary guardian phone numbers, school info
  const [students, school] = await Promise.all([
    db.student.findMany({
      where: { id: { in: studentIds }, schoolId },
      select: {
        id: true,
        studentCode: true,
        fullNameEn: true,
        fullNameBn: true,
        guardians: {
          where: { isPrimary: true },
          select: {
            guardianId: true,
            guardian: {
              select: {
                id: true,
                fullNameEn: true,
                phone: true,
              },
            },
          },
          take: 1,
        },
        enrollments: {
          where: { status: 'ACTIVE' },
          select: {
            rollNo: true,
            class: { select: { nameEn: true, nameBn: true } },
          },
          take: 1,
        },
      },
    }),
    db.school.findUnique({
      where: { id: schoolId },
      select: { nameEn: true, nameBn: true },
    }),
  ]);

  const studentMap = new Map(students.map((s) => [s.id, s]));
  const schoolName = school?.nameBn || school?.nameEn || 'বিদ্যালয়';
  const template = STANDARD_NOTIFICATION_TEMPLATES.ATTENDANCE_ABSENT;

  const logsToCreate: Prisma.MessageLogCreateManyInput[] = [];

  for (const rec of absentRecords) {
    if (rec.status !== 'ABSENT') continue;

    const student = studentMap.get(rec.studentId);
    if (!student) continue;

    const primaryGuardian = student.guardians[0]?.guardian;
    const phone = primaryGuardian?.phone;
    if (!phone) continue;

    const activeEnrollment = student.enrollments[0];
    const dateStr = new Date(rec.date).toISOString().split('T')[0];

    const messageBody = renderTemplate(template.templateBn, {
      studentName: student.fullNameBn || student.fullNameEn,
      rollNo: String(activeEnrollment?.rollNo || student.studentCode),
      className: activeEnrollment?.class?.nameBn || activeEnrollment?.class?.nameEn || 'সাধারণ',
      date: dateStr,
      schoolName,
    });

    logsToCreate.push({
      schoolId,
      channel: MessageChannel.SMS,
      recipientPhone: phone,
      studentId: student.id,
      guardianId: primaryGuardian?.id || null,
      messageBody,
      messageType: MessageType.ATTENDANCE_ABSENT,
      smsCount: 1,
      provider: 'GATEWAY_ROUTER',
      deliveryStatus: DeliveryStatus.QUEUED,
      idempotencyKey: `ATT_ABSENT_${rec.id}`,
      metadata: {
        attendanceId: rec.id,
        date: dateStr,
        rollNo: activeEnrollment?.rollNo,
      },
    });
  }

  if (logsToCreate.length === 0) return 0;

  const result = await db.messageLog.createMany({
    data: logsToCreate,
    skipDuplicates: true,
  });

  return result.count;
}

/**
 * Enqueue transport alerts (e.g. NO_SHOW or boarding alerts) to message_logs under school tenant scoping.
 */
export async function enqueueTransportAlertNotifications(
  schoolId: string,
  events: TransportAlertRecord[],
  tx?: Prisma.TransactionClient
): Promise<number> {
  if (events.length === 0) return 0;

  const db = tx || prisma;
  const studentIds = Array.from(new Set(events.map((e) => e.studentId)));

  const [students, school] = await Promise.all([
    db.student.findMany({
      where: { id: { in: studentIds }, schoolId },
      select: {
        id: true,
        studentCode: true,
        fullNameEn: true,
        fullNameBn: true,
        guardians: {
          where: { isPrimary: true },
          select: {
            guardianId: true,
            guardian: {
              select: {
                id: true,
                fullNameEn: true,
                phone: true,
              },
            },
          },
          take: 1,
        },
      },
    }),
    db.school.findUnique({
      where: { id: schoolId },
      select: { nameEn: true, nameBn: true },
    }),
  ]);

  const studentMap = new Map(students.map((s) => [s.id, s]));
  const schoolName = school?.nameBn || school?.nameEn || 'EduSmart Transport';
  const logsToCreate: Prisma.MessageLogCreateManyInput[] = [];

  for (const ev of events) {
    const student = studentMap.get(ev.studentId);
    if (!student) continue;

    const primaryGuardian = student.guardians[0]?.guardian;
    const phone = primaryGuardian?.phone;
    if (!phone) continue;

    const studentName = student.fullNameBn || student.fullNameEn;
    const statusText = ev.boardingStatus in TransportBoardingStatus
      ? formatTransportBoardingStatus(ev.boardingStatus as TransportBoardingStatus, 'bn')
      : ev.boardingStatus;
    const messageBody = `জরুরি পরিবহন সতর্কতা: আপনার সন্তান ${studentName} বিদ্যালয় বাসে ${statusText} হিসেবে চিহ্নিত হয়েছে। ${schoolName}।`;

    logsToCreate.push({
      schoolId,
      channel: MessageChannel.SMS,
      recipientPhone: phone,
      studentId: student.id,
      guardianId: primaryGuardian?.id || null,
      messageBody,
      messageType: MessageType.TRANSPORT_ALERT,
      smsCount: 1,
      provider: 'GATEWAY_ROUTER',
      deliveryStatus: DeliveryStatus.QUEUED,
      idempotencyKey: `TRANS_ALERT_${ev.id}`,
      metadata: {
        transportEventId: ev.id,
        boardingStatus: ev.boardingStatus,
        tripId: ev.tripId,
      },
    });
  }

  if (logsToCreate.length === 0) return 0;

  const result = await db.messageLog.createMany({
    data: logsToCreate,
    skipDuplicates: true,
  });

  return result.count;
}

/**
 * Enqueue fee notice / due reminder notifications to message_logs under school tenant scoping.
 */
export async function enqueueFeeNoticeNotifications(
  schoolId: string,
  invoices: FeeInvoiceNotificationRecord[],
  tx?: Prisma.TransactionClient
): Promise<number> {
  if (invoices.length === 0) return 0;

  const db = tx || prisma;
  const studentIds = Array.from(new Set(invoices.map((inv) => inv.studentId)));

  const [students, school] = await Promise.all([
    db.student.findMany({
      where: { id: { in: studentIds }, schoolId },
      select: {
        id: true,
        studentCode: true,
        fullNameEn: true,
        fullNameBn: true,
        guardians: {
          where: { isPrimary: true },
          select: {
            guardianId: true,
            guardian: {
              select: {
                id: true,
                fullNameEn: true,
                phone: true,
              },
            },
          },
          take: 1,
        },
      },
    }),
    db.school.findUnique({
      where: { id: schoolId },
      select: { nameEn: true, nameBn: true },
    }),
  ]);

  const studentMap = new Map(students.map((s) => [s.id, s]));
  const schoolName = school?.nameBn || school?.nameEn || 'বিদ্যালয়';
  const template = STANDARD_NOTIFICATION_TEMPLATES.FEE_DUE_REMINDER;
  const logsToCreate: Prisma.MessageLogCreateManyInput[] = [];

  for (const inv of invoices) {
    const student = studentMap.get(inv.studentId);
    if (!student) continue;

    const primaryGuardian = student.guardians[0]?.guardian;
    const phone = primaryGuardian?.phone;
    if (!phone) continue;

    const dueDateStr = new Date(inv.dueDate).toISOString().split('T')[0];
    const messageBody = renderTemplate(template.templateBn, {
      studentName: student.fullNameBn || student.fullNameEn,
      amount: String(inv.netAmount),
      dueDate: dueDateStr,
      schoolName,
    });

    logsToCreate.push({
      schoolId,
      channel: MessageChannel.SMS,
      recipientPhone: phone,
      studentId: student.id,
      guardianId: primaryGuardian?.id || null,
      messageBody,
      messageType: MessageType.FEE_DUE_REMINDER,
      smsCount: 1,
      provider: 'GATEWAY_ROUTER',
      deliveryStatus: DeliveryStatus.QUEUED,
      idempotencyKey: `FEE_INV_${inv.id}`,
      metadata: {
        studentFeeId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        amount: Number(inv.netAmount),
      },
    });
  }

  if (logsToCreate.length === 0) return 0;

  const result = await db.messageLog.createMany({
    data: logsToCreate,
    skipDuplicates: true,
  });

  return result.count;
}
