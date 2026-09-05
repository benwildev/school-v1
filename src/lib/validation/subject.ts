import { z } from 'zod';
import { SubjectType, RecordStatus } from '@prisma/client';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SubjectCreateSchema = z.object({
  classId: z
    .string()
    .min(1, 'শ্রেণি (Class) নির্বাচন করা আবশ্যক।')
    .regex(uuidRegex, 'সঠিক শ্রেণি আইডি প্রদান করুন।'),
  groupId: z
    .string()
    .regex(uuidRegex, 'সঠিক গ্রুপ আইডি প্রদান করুন।')
    .optional()
    .nullable()
    .or(z.literal('')),
  code: z
    .string()
    .trim()
    .min(1, 'বিষয় কোড আবশ্যক।')
    .max(30, 'বিষয় কোড ৩০ অক্ষরের বেশি হতে পারবে না।'),
  nameEn: z
    .string()
    .trim()
    .min(1, 'বিষয়ের ইংরেজি নাম আবশ্যক।')
    .max(150, 'ইংরেজি নাম ১৫০ অক্ষরের বেশি হতে পারবে না।'),
  nameBn: z
    .string()
    .trim()
    .min(1, 'বিষয়ের বাংলা নাম আবশ্যক।')
    .max(150, 'বাংলা নাম ১৫০ অক্ষরের বেশি হতে পারবে না।'),
  subjectType: z.nativeEnum(SubjectType).default('COMPULSORY'),
  theoryMarks: z.coerce.number().min(0).max(1000).default(70),
  practicalMarks: z.coerce.number().min(0).max(1000).default(0),
  mcqMarks: z.coerce.number().min(0).max(1000).default(30),
  vivaMarks: z.coerce.number().min(0).max(1000).default(0),
  totalFullMarks: z.coerce.number().min(0).max(1000).default(100),
  passMarks: z.coerce.number().min(0).max(1000).default(33),
  isCombinedSubject: z.boolean().default(false),
  combinedWithSubjectId: z
    .string()
    .regex(uuidRegex, 'সঠিক বিষয় আইডি প্রদান করুন।')
    .optional()
    .nullable()
    .or(z.literal('')),
  status: z.nativeEnum(RecordStatus).default('ACTIVE'),
});

export const SubjectUpdateSchema = SubjectCreateSchema.partial();

export type SubjectCreateInput = z.infer<typeof SubjectCreateSchema>;
export type SubjectUpdateInput = z.infer<typeof SubjectUpdateSchema>;
