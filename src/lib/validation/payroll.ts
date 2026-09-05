import { z } from 'zod';
import {
  SalaryComponentType,
  SalaryCalculationMethod,
} from '@prisma/client';

export const SalaryComponentSchema = z.object({
  code: z.string().min(2).max(50).regex(/^[A-Z0-9_]+$/, 'Code must be uppercase alphanumeric and underscores'),
  name: z.string().min(2).max(100),
  nameBn: z.string().max(100).optional().nullable(),
  type: z.nativeEnum(SalaryComponentType),
  calculationMethod: z.nativeEnum(SalaryCalculationMethod).default(SalaryCalculationMethod.FIXED),
  defaultAmount: z.number().min(0).default(0),
  formula: z.string().max(255).optional().nullable(),
  isTaxable: z.boolean().default(false),
  isMandatory: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const SalaryStructureItemInputSchema = z.object({
  componentId: z.string().uuid(),
  calculationMethod: z.nativeEnum(SalaryCalculationMethod),
  amount: z.number().min(0),
  formula: z.string().max(255).optional().nullable(),
  isOptional: z.boolean().default(false),
});

export const SalaryStructureSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
  items: z.array(SalaryStructureItemInputSchema).min(1, 'At least one salary component is required'),
});

export const SalaryAssignmentItemInputSchema = z.object({
  componentId: z.string().uuid(),
  calculationMethod: z.nativeEnum(SalaryCalculationMethod),
  amount: z.number().min(0),
  formula: z.string().max(255).optional().nullable(),
  isOverridden: z.boolean().default(false),
});

export const SalaryAssignmentSchema = z.object({
  employeeId: z.string().uuid(),
  structureId: z.string().uuid().optional().nullable(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional().nullable(),
  baseGrossSalary: z.number().min(0),
  basicSalary: z.number().min(0),
  paymentMethod: z.string().default('BANK_TRANSFER'),
  bankAccountNumber: z.string().max(50).optional().nullable(),
  bankName: z.string().max(100).optional().nullable(),
  bankBranch: z.string().max(100).optional().nullable(),
  mobileBankingNumber: z.string().max(20).optional().nullable(),
  remarks: z.string().max(500).optional().nullable(),
  items: z.array(SalaryAssignmentItemInputSchema).default([]),
});

export const SalaryAdvanceSchema = z.object({
  employeeId: z.string().uuid(),
  amount: z.number().positive('Advance amount must be greater than zero'),
  monthlyDeduction: z.number().positive('Monthly deduction must be greater than zero'),
  repaymentStartPeriod: z.string().regex(/^\d{4}-\d{2}$/, 'Start period must be YYYY-MM'),
  purpose: z.string().min(2).max(255),
  remarks: z.string().max(500).optional().nullable(),
});

export const SalaryAdvanceApproveSchema = z.object({
  approvedAmount: z.number().positive().optional(),
  monthlyDeduction: z.number().positive().optional(),
  remarks: z.string().max(500).optional().nullable(),
});

export const PayrollPeriodSchema = z.object({
  campusId: z.string().uuid().optional().nullable(),
  periodName: z.string().min(2).max(100),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  cutOffDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional().nullable(),
  workingDays: z.number().int().min(1).max(31).default(30),
});

export const PayrollGenerateSchema = z.object({
  periodId: z.string().uuid(),
  campusId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  employeeIds: z.array(z.string().uuid()).optional(),
});

export const PayrollFinalizeSchema = z.object({
  remarks: z.string().max(500).optional().nullable(),
});

export const PayrollPaymentSchema = z.object({
  payrollRecordId: z.string().uuid(),
  paymentMethod: z.string().min(2).max(50),
  amount: z.number().positive('Payment amount must be greater than zero'),
  referenceNumber: z.string().max(100).optional().nullable(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  remarks: z.string().max(500).optional().nullable(),
});

export const PayrollRecordAdjustSchema = z.object({
  reason: z.string().min(3).max(255),
  adjustmentType: z.enum(['ADD_EARNING', 'ADD_DEDUCTION']),
  amount: z.number().positive(),
  name: z.string().min(2).max(100),
});
