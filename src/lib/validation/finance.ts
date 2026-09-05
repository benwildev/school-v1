import { z } from 'zod';
import {
  BillingFrequency,
  BillingPeriodType,
  DiscountCategory,
  DiscountCalculationType,
  DiscountFrequency,
  PaymentMethod,
  RecordStatus,
} from '@prisma/client';

export const FeeTypeCreateSchema = z.object({
  code: z
    .string()
    .min(2, 'Code must be at least 2 characters')
    .max(50)
    .regex(/^[A-Z0-9_]+$/, 'Code must be uppercase alphanumeric with underscores (e.g. TUITION_FEE)'),
  nameEn: z.string().min(2, 'English name is required').max(150),
  nameBn: z.string().min(2, 'Bangla name is required').max(150),
  description: z.string().max(500).optional().nullable(),
  isRecurring: z.boolean().default(true),
  isRefundable: z.boolean().default(false),
  status: z.nativeEnum(RecordStatus, { message: 'Invalid status' }).default(RecordStatus.ACTIVE),
});

export const FeeTypeUpdateSchema = FeeTypeCreateSchema.partial();

export const FeeStructureCreateSchema = z.object({
  academicSessionId: z.string().uuid('Invalid Academic Session ID'),
  feeTypeId: z.string().uuid('Invalid Fee Type ID'),
  classId: z.string().uuid('Invalid Class ID'),
  groupId: z.string().uuid('Invalid Group ID').optional().nullable(),
  amount: z.number().positive('Fee amount must be greater than 0').max(1000000),
  frequency: z.nativeEnum(BillingFrequency, { message: 'Invalid Billing Frequency' }).default(BillingFrequency.MONTHLY),
  dueDayOfMonth: z.number().int().min(1).max(31).default(10),
  lateFineAmount: z.number().min(0, 'Late fine cannot be negative').default(0),
  status: z.nativeEnum(RecordStatus, { message: 'Invalid status' }).default(RecordStatus.ACTIVE),
});

export const FeeStructureUpdateSchema = FeeStructureCreateSchema.partial();

export const InvoiceGenerateBatchSchema = z.object({
  academicSessionId: z.string().uuid('Invalid Academic Session ID'),
  classId: z.string().uuid('Invalid Class ID'),
  sectionId: z.string().uuid('Invalid Section ID').optional().nullable(),
  feeTypeId: z.string().uuid('Invalid Fee Type ID'),
  feeStructureId: z.string().uuid('Invalid Fee Structure ID').optional().nullable(),
  billingPeriodType: z.nativeEnum(BillingPeriodType, { message: 'Invalid Billing Period Type' }).default(BillingPeriodType.MONTHLY),
  billingPeriodKey: z.string().min(4, 'Billing period key is required (e.g. 2026-01)').max(50),
  periodStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  periodEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD'),
  baseAmount: z.number().min(0, 'Base amount cannot be negative'),
  fineAmount: z.number().min(0, 'Fine amount cannot be negative').default(0),
});

export const InvoiceCancelSchema = z.object({
  reason: z.string().min(3, 'Cancellation reason must be at least 3 characters').max(500),
});

export const StudentDiscountCreateSchema = z.object({
  studentId: z.string().uuid('Invalid Student ID'),
  enrollmentId: z.string().uuid('Invalid Enrollment ID'),
  feeTypeId: z.string().uuid('Invalid Fee Type ID').optional().nullable(),
  discountCategory: z.nativeEnum(DiscountCategory, { message: 'Invalid Discount Category' }),
  discountType: z.nativeEnum(DiscountCalculationType, { message: 'Invalid Discount Type' }),
  discountValue: z.number().positive('Discount value must be greater than 0'),
  frequency: z.nativeEnum(DiscountFrequency, { message: 'Invalid Frequency' }).default(DiscountFrequency.RECURRING_MONTHLY),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional().nullable(),
  reason: z.string().min(2, 'Reason is required').max(255),
  notes: z.string().max(500).optional().nullable(),
});

export const StudentDiscountUpdateSchema = StudentDiscountCreateSchema.partial();

export const PaymentRecordSchema = z.object({
  studentId: z.string().uuid('Invalid Student ID'),
  enrollmentId: z.string().uuid('Invalid Enrollment ID'),
  totalAmount: z.number().positive('Payment amount must be greater than zero'),
  paymentMethod: z.nativeEnum(PaymentMethod, { message: 'Invalid Payment Method' }),
  transactionId: z.string().max(100).optional().nullable(),
  bankName: z.string().max(100).optional().nullable(),
  bankBranch: z.string().max(100).optional().nullable(),
  chequeNumber: z.string().max(50).optional().nullable(),
  chequeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Cheque date must be YYYY-MM-DD').optional().nullable(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Payment date must be YYYY-MM-DD').optional(),
  notes: z.string().max(500).optional().nullable(),
  allocations: z
    .array(
      z.object({
        studentFeeId: z.string().uuid('Invalid Student Fee ID'),
        amount: z.number().positive('Allocation amount must be greater than zero'),
      })
    )
    .optional(),
  autoAllocateOldest: z.boolean().default(true),
});

export const PaymentAllocateSchema = z.object({
  allocations: z
    .array(
      z.object({
        studentFeeId: z.string().uuid('Invalid Student Fee ID'),
        amount: z.number().positive('Allocation amount must be greater than zero'),
      })
    )
    .min(1, 'At least one allocation item is required'),
});

export const RefundCreateSchema = z.object({
  paymentId: z.string().uuid('Invalid Payment ID'),
  studentId: z.string().uuid('Invalid Student ID'),
  amount: z.number().positive('Refund amount must be greater than zero'),
  reason: z.string().min(5, 'Refund reason must be at least 5 characters').max(500),
  refundMethod: z.nativeEnum(PaymentMethod, { message: 'Invalid Refund Payment Method' }),
  transactionRef: z.string().max(100).optional().nullable(),
});
