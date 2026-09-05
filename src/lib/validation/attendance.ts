import { z } from 'zod';
import { AttendanceStatus, AttendanceSource } from '@prisma/client';

export const AttendanceRecordItemSchema = z.object({
  enrollmentId: z.string().uuid('Invalid Enrollment ID'),
  studentId: z.string().uuid('Invalid Student ID'),
  status: z.nativeEnum(AttendanceStatus, {
    message: 'Invalid Attendance Status',
  }),
  checkInTime: z.string().optional().nullable(),
  checkOutTime: z.string().optional().nullable(),
  lateMinutes: z.number().int().min(0).max(480).default(0),
  leaveReason: z.string().max(255).optional().nullable(),
});

export const DailyAttendanceBatchSchema = z.object({
  academicSessionId: z.string().uuid('Invalid Academic Session ID'),
  classId: z.string().uuid('Invalid Class ID'),
  sectionId: z.string().uuid('Invalid Section ID'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
  source: z.nativeEnum(AttendanceSource).default(AttendanceSource.MANUAL),
  records: z.array(AttendanceRecordItemSchema).min(1, 'At least one student attendance record is required'),
});

export const AttendanceUpdateSchema = z.object({
  status: z.nativeEnum(AttendanceStatus, {
    message: 'Invalid Attendance Status',
  }),
  reason: z.string().min(3, 'Audit reason is required for attendance modification').max(500),
  lateMinutes: z.number().int().min(0).max(480).optional(),
  leaveReason: z.string().max(255).optional().nullable(),
});

export const AttendanceQuerySchema = z.object({
  academicSessionId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.nativeEnum(AttendanceStatus).optional(),
});
