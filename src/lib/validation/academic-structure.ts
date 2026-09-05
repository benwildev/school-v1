import { z } from 'zod';

/**
 * Zod validation schemas for Academic Structure Management (Phase 3.3).
 * Covers Class, Section, Shift, and Academic Group according to existing Prisma models.
 */

// ============================================================================
// ENUMS & COMMON TYPES
// ============================================================================

export const ClassCategoryEnum = z.enum([
  'PRE_PRIMARY',
  'PRIMARY',
  'JUNIOR_SECONDARY',
  'SECONDARY',
  'HIGHER_SECONDARY',
]);
export type ClassCategoryType = z.infer<typeof ClassCategoryEnum>;

export const RecordStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']);
export type RecordStatusType = z.infer<typeof RecordStatusEnum>;

export const AcademicShiftEnum = z.enum(['MORNING', 'DAY', 'EVENING']);
export type AcademicShiftType = z.infer<typeof AcademicShiftEnum>;

export const GenderRestrictionEnum = z.enum(['BOYS', 'GIRLS', 'CO_ED']);
export type GenderRestrictionType = z.infer<typeof GenderRestrictionEnum>;

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const timeStringRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

// ============================================================================
// CLASS SCHEMAS
// ============================================================================

export const ClassCreateSchema = z.object({
  nameEn: z
    .string()
    .trim()
    .min(1, 'ইংরেজি নাম অবশ্যই লিখতে হবে।')
    .max(100, 'ইংরেজি নাম ১০০ অক্ষরের বেশি হতে পারবে না।'),
  nameBn: z
    .string()
    .trim()
    .min(1, 'বাংলা নাম অবশ্যই লিখতে হবে।')
    .max(100, 'বাংলা নাম ১০০ অক্ষরের বেশি হতে পারবে না।'),
  numericLevel: z
    .number()
    .int('ক্রমিক নম্বর পূর্ণসংখ্যা হতে হবে।')
    .min(-5, 'ক্রমিক নম্বর -৫ এর নিচে হতে পারবে না।')
    .max(50, 'ক্রমিক নম্বর ৫০ এর বেশি হতে পারবে না।'),
  category: ClassCategoryEnum,
  status: RecordStatusEnum.optional().default('ACTIVE'),
});

export const ClassUpdateSchema = z.object({
  nameEn: z
    .string()
    .trim()
    .min(1, 'ইংরেজি নাম অবশ্যই লিখতে হবে।')
    .max(100, 'ইংরেজি নাম ১০০ অক্ষরের বেশি হতে পারবে না।')
    .optional(),
  nameBn: z
    .string()
    .trim()
    .min(1, 'বাংলা নাম অবশ্যই লিখতে হবে।')
    .max(100, 'বাংলা নাম ১০০ অক্ষরের বেশি হতে পারবে না।')
    .optional(),
  numericLevel: z
    .number()
    .int('ক্রমিক নম্বর পূর্ণসংখ্যা হতে হবে।')
    .min(-5, 'ক্রমিক নম্বর -৫ এর নিচে হতে পারবে না।')
    .max(50, 'ক্রমিক নম্বর ৫০ এর বেশি হতে পারবে না।')
    .optional(),
  category: ClassCategoryEnum.optional(),
  status: RecordStatusEnum.optional(),
});

export type ClassCreateInput = z.infer<typeof ClassCreateSchema>;
export type ClassUpdateInput = z.infer<typeof ClassUpdateSchema>;

// ============================================================================
// SECTION SCHEMAS
// ============================================================================

export const SectionCreateSchema = z.object({
  classId: z
    .string()
    .min(1, 'শ্রেণি (Class) নির্বাচন করা আবশ্যক।')
    .regex(uuidRegex, 'সঠিক শ্রেণি আইডি প্রদান করুন।'),
  campusId: z
    .string()
    .regex(uuidRegex, 'সঠিক ক্যাম্পাস আইডি প্রদান করুন।')
    .optional()
    .nullable()
    .or(z.literal('')),
  groupId: z
    .string()
    .regex(uuidRegex, 'সঠিক গ্রুপ আইডি প্রদান করুন।')
    .optional()
    .nullable()
    .or(z.literal('')),
  nameEn: z
    .string()
    .trim()
    .min(1, 'শাখার ইংরেজি নাম অবশ্যই লিখতে হবে।')
    .max(100, 'শাখার ইংরেজি নাম ১০০ অক্ষরের বেশি হতে পারবে না।'),
  nameBn: z
    .string()
    .trim()
    .min(1, 'শাখার বাংলা নাম অবশ্যই লিখতে হবে।')
    .max(100, 'শাখার বাংলা নাম ১০০ অক্ষরের বেশি হতে পারবে না।'),
  shift: AcademicShiftEnum.optional().default('DAY'),
  genderType: GenderRestrictionEnum.optional().default('CO_ED'),
  maxCapacity: z
    .number()
    .int('ধারণক্ষমতা অবশ্যই পূর্ণসংখ্যা হতে হবে।')
    .min(1, 'সর্বনিম্ন ধারণক্ষমতা ১ হতে হবে।')
    .max(500, 'সর্বোচ্চ ধারণক্ষমতা ৫০০ এর বেশি হতে পারবে না।')
    .optional()
    .default(50),
  status: RecordStatusEnum.optional().default('ACTIVE'),
});

export const SectionUpdateSchema = z.object({
  classId: z
    .string()
    .regex(uuidRegex, 'সঠিক শ্রেণি আইডি প্রদান করুন।')
    .optional(),
  campusId: z
    .string()
    .regex(uuidRegex, 'সঠিক ক্যাম্পাস আইডি প্রদান করুন।')
    .optional()
    .nullable()
    .or(z.literal('')),
  groupId: z
    .string()
    .regex(uuidRegex, 'সঠিক গ্রুপ আইডি প্রদান করুন।')
    .optional()
    .nullable()
    .or(z.literal('')),
  nameEn: z
    .string()
    .trim()
    .min(1, 'শাখার ইংরেজি নাম অবশ্যই লিখতে হবে।')
    .max(100, 'শাখার ইংরেজি নাম ১০০ অক্ষরের বেশি হতে পারবে না।')
    .optional(),
  nameBn: z
    .string()
    .trim()
    .min(1, 'শাখার বাংলা নাম অবশ্যই লিখতে হবে।')
    .max(100, 'শাখার বাংলা নাম ১০০ অক্ষরের বেশি হতে পারবে না।')
    .optional(),
  shift: AcademicShiftEnum.optional(),
  genderType: GenderRestrictionEnum.optional(),
  maxCapacity: z
    .number()
    .int('ধারণক্ষমতা অবশ্যই পূর্ণসংখ্যা হতে হবে।')
    .min(1, 'সর্বনিম্ন ধারণক্ষমতা ১ হতে হবে।')
    .max(500, 'সর্বোচ্চ ধারণক্ষমতা ৫০০ এর বেশি হতে পারবে না।')
    .optional(),
  status: RecordStatusEnum.optional(),
});

export type SectionCreateInput = z.infer<typeof SectionCreateSchema>;
export type SectionUpdateInput = z.infer<typeof SectionUpdateSchema>;

// ============================================================================
// ACADEMIC GROUP SCHEMAS
// ============================================================================

const groupCodeRegex = /^[A-Z0-9_]{2,50}$/;

export const AcademicGroupCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(groupCodeRegex, 'গ্রুপ কোড ২-৫০ অক্ষরের ইংরেজি বড় হাতের অক্ষর, সংখ্যা বা আন্ডারস্কোর হতে হবে (যেমন: SCIENCE, COMMERCE)।'),
  nameEn: z
    .string()
    .trim()
    .min(1, 'গ্রুপের ইংরেজি নাম আবশ্যক।')
    .max(100, 'গ্রুপের ইংরেজি নাম ১০০ অক্ষরের বেশি হতে পারবে না।'),
  nameBn: z
    .string()
    .trim()
    .min(1, 'গ্রুপের বাংলা নাম আবশ্যক।')
    .max(100, 'গ্রুপের বাংলা নাম ১০০ অক্ষরের বেশি হতে পারবে না।'),
  status: RecordStatusEnum.optional().default('ACTIVE'),
});

export const AcademicGroupUpdateSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(groupCodeRegex, 'গ্রুপ কোড ২-৫০ অক্ষরের ইংরেজি বড় হাতের অক্ষর, সংখ্যা বা আন্ডারস্কোর হতে হবে।')
    .optional(),
  nameEn: z
    .string()
    .trim()
    .min(1, 'গ্রুপের ইংরেজি নাম আবশ্যক।')
    .max(100, 'গ্রুপের ইংরেজি নাম ১০০ অক্ষরের বেশি হতে পারবে না।')
    .optional(),
  nameBn: z
    .string()
    .trim()
    .min(1, 'গ্রুপের বাংলা নাম আবশ্যক।')
    .max(100, 'গ্রুপের বাংলা নাম ১০০ অক্ষরের বেশি হতে পারবে না।')
    .optional(),
  status: RecordStatusEnum.optional(),
});

export type AcademicGroupCreateInput = z.infer<typeof AcademicGroupCreateSchema>;
export type AcademicGroupUpdateInput = z.infer<typeof AcademicGroupUpdateSchema>;

// ============================================================================
// SHIFT CONFIGURATION SCHEMA
// ============================================================================

export const ShiftItemConfigSchema = z.object({
  shift: AcademicShiftEnum,
  isEnabled: z.boolean().default(true),
  startTime: z.string().regex(timeStringRegex, 'সময় ফরম্যাট HH:MM হতে হবে।').optional().nullable().or(z.literal('')),
  endTime: z.string().regex(timeStringRegex, 'সময় ফরম্যাট HH:MM হতে হবে।').optional().nullable().or(z.literal('')),
  labelBn: z.string().trim().max(100).optional(),
});

export const ShiftConfigUpdateSchema = z.object({
  shifts: z.array(ShiftItemConfigSchema).min(1, 'কমপক্ষে একটি শিফট কনফিগারেশন থাকা আবশ্যক।'),
});

export type ShiftItemConfig = z.infer<typeof ShiftItemConfigSchema>;
export type ShiftConfigUpdateInput = z.infer<typeof ShiftConfigUpdateSchema>;
