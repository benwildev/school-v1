import { z } from 'zod';
import {
  AttendanceStatus,
  BiometricDeviceType,
  DeviceStatus,
  AcademicShift,
  VerificationStatus,
} from '@prisma/client';

export const DeviceCreateSchema = z.object({
  deviceName: z.string().min(2, 'Device name must be at least 2 characters').max(100),
  deviceSerial: z.string().min(3, 'Device serial number is required').max(100),
  campusId: z.string().uuid().optional().nullable(),
  deviceIp: z.string().max(50).optional().nullable(),
  port: z.number().int().min(1).max(65535).optional().nullable(),
  deviceModel: z.string().max(100).optional().nullable(),
  deviceType: z.nativeEnum(BiometricDeviceType),
  provider: z.string().min(2).max(50).default('ZKTECO'),
  credentials: z.string().optional().nullable(), // Will be encrypted at rest
  apiKey: z.string().optional().nullable(),
  location: z.string().max(255).optional().nullable(),
  status: z.nativeEnum(DeviceStatus).default(DeviceStatus.ONLINE),
  settings: z.record(z.string(), z.any()).default({}),
  syncMode: z.enum(['REALTIME', 'BATCH', 'MANUAL']).default('REALTIME'),
});

export const DeviceUpdateSchema = DeviceCreateSchema.partial();

export const RawEventIngestItemSchema = z.object({
  deviceId: z.string().uuid().optional().nullable(),
  externalEventId: z.string().min(1, 'External event ID is required').max(150),
  deviceTimestamp: z.union([z.string(), z.date()]),
  identifierType: z.enum(['CARD_NO', 'STUDENT_ID', 'EMPLOYEE_CODE', 'BIOMETRIC_USER_ID']),
  identifierValue: z.string().min(1, 'Identifier value is required').max(100),
  eventType: z.enum(['CHECK_IN', 'CHECK_OUT', 'LOG']).default('CHECK_IN'),
  rawPayload: z.record(z.string(), z.any()).default({}),
});

export const RawEventBatchIngestSchema = z.object({
  deviceId: z.string().uuid().optional().nullable(),
  events: z.array(RawEventIngestItemSchema).min(1, 'At least one event is required'),
});

export const AttendanceCorrectionSchema = z.object({
  attendanceType: z.enum(['STUDENT', 'EMPLOYEE']),
  studentAttendanceId: z.string().uuid().optional().nullable(),
  employeeAttendanceId: z.string().uuid().optional().nullable(),
  originalStatus: z.nativeEnum(AttendanceStatus),
  correctedStatus: z.nativeEnum(AttendanceStatus),
  originalCheckIn: z.string().optional().nullable(),
  correctedCheckIn: z.string().optional().nullable(),
  originalCheckOut: z.string().optional().nullable(),
  correctedCheckOut: z.string().optional().nullable(),
  actionReason: z.string().min(5, 'A justification reason of at least 5 characters is mandatory'),
});

export const AttendanceVerificationSchema = z.object({
  attendanceType: z.enum(['STUDENT', 'EMPLOYEE']),
  attendanceIds: z.array(z.string().uuid()).min(1, 'At least one attendance ID required'),
  status: z.nativeEnum(VerificationStatus),
  remarks: z.string().optional().nullable(),
});

export const AttendanceRuleCreateSchema = z.object({
  name: z.string().min(2).max(100),
  campusId: z.string().uuid().optional().nullable(),
  targetType: z.enum(['STUDENT', 'EMPLOYEE', 'ALL']).default('STUDENT'),
  shift: z.nativeEnum(AcademicShift).optional().nullable(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, 'Invalid time format (HH:MM:SS)'),
  lateThresholdMinutes: z.number().int().min(0).default(15),
  halfDayThresholdMinutes: z.number().int().min(0).default(120),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, 'Invalid time format (HH:MM:SS)').default('14:00:00'),
  earlyCheckoutMinutes: z.number().int().min(0).default(30),
  workingDays: z.array(z.string()).default(['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY']),
  gracePeriodMinutes: z.number().int().min(0).default(5),
  checkoutRequired: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const AttendanceRuleUpdateSchema = AttendanceRuleCreateSchema.partial();

export const EmployeeShiftCreateSchema = z.object({
  nameEn: z.string().min(2).max(100),
  nameBn: z.string().min(2).max(100),
  code: z.string().min(2).max(50),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, 'Invalid time format (HH:MM:SS)'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, 'Invalid time format (HH:MM:SS)'),
  lateGraceMinutes: z.number().int().min(0).default(15),
  halfDayLateMinutes: z.number().int().min(0).default(120),
  workingDays: z.array(z.string()).default(['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY']),
  isActive: z.boolean().default(true),
});

export const EmployeeShiftUpdateSchema = EmployeeShiftCreateSchema.partial();
