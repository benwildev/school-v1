import { z } from 'zod';
import { MessageChannel, MessageType, RecordStatus, DeliveryStatus } from '@prisma/client';

export const NotificationTemplateCreateSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(50),
  channel: z.nativeEnum(MessageChannel),
  templateEn: z.string().min(5, 'English template must be at least 5 characters'),
  templateBn: z.string().min(5, 'Bangla template must be at least 5 characters'),
  variables: z.array(z.string()).default([]),
  status: z.nativeEnum(RecordStatus).default(RecordStatus.ACTIVE),
});

export const NotificationTemplateUpdateSchema = NotificationTemplateCreateSchema.partial();

export const CommunicationSendSchema = z.object({
  channel: z.nativeEnum(MessageChannel),
  recipientPhone: z.string().optional().nullable(),
  recipientEmail: z.string().email().optional().nullable(),
  studentId: z.string().uuid().optional().nullable(),
  guardianId: z.string().uuid().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
  messageBody: z.string().min(1, 'Message body is required'),
  messageType: z.nativeEnum(MessageType).default(MessageType.GENERAL_NOTICE),
  templateId: z.string().uuid().optional().nullable(),
  idempotencyKey: z.string().max(120).optional().nullable(),
  metadata: z.record(z.string(), z.any()).default({}),
});

export const CommunicationBulkSendSchema = z.object({
  name: z.string().min(2, 'Campaign name is required').max(150),
  channel: z.nativeEnum(MessageChannel),
  targetAudience: z.enum(['ALL_STUDENTS', 'ALL_GUARDIANS', 'ALL_STAFF', 'CLASS', 'SECTION', 'CUSTOM']),
  targetFilter: z.object({
    classId: z.string().uuid().optional(),
    sectionId: z.string().uuid().optional(),
    campusId: z.string().uuid().optional(),
    recipientIds: z.array(z.string().uuid()).optional(),
  }).default({}),
  templateId: z.string().uuid().optional().nullable(),
  customBody: z.string().optional().nullable(),
  idempotencyKey: z.string().min(5, 'Idempotency key is required for bulk campaigns').max(100),
});

export const NotificationPreferenceUpdateSchema = z.object({
  inAppEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  whatsappEnabled: z.boolean().optional(),
  attendanceAlerts: z.boolean().optional(),
  feeAlerts: z.boolean().optional(),
  examAlerts: z.boolean().optional(),
  generalNotices: z.boolean().optional(),
});

export const WebhookCallbackSchema = z.object({
  providerMessageId: z.string().min(1),
  deliveryStatus: z.nativeEnum(DeliveryStatus),
  failureReason: z.string().optional().nullable(),
  eventTimestamp: z.string().optional().nullable(),
  rawEvent: z.record(z.string(), z.any()).optional().nullable(),
});
