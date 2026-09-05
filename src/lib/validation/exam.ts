import { z } from 'zod';
import { ExamType, ExamTerm, ExamStatus, MarkWorkflowStatus } from '@prisma/client';

export const ExamCreateSchema = z.object({
  academicSessionId: z.string().uuid('Invalid Academic Session ID'),
  nameEn: z.string().min(1, 'English Exam Name is required').max(150),
  nameBn: z.string().min(1, 'Bangla Exam Name is required').max(150),
  examType: z.nativeEnum(ExamType, {
    message: 'Invalid Exam Type',
  }),
  term: z.nativeEnum(ExamTerm, {
    message: 'Invalid Exam Term',
  }),
  weightagePercentage: z.number().min(0).max(100).default(100),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
  status: z.nativeEnum(ExamStatus).default(ExamStatus.DRAFT),
});

export const ExamUpdateSchema = ExamCreateSchema.partial();

export const ExamScheduleCreateSchema = z.object({
  classId: z.string().uuid('Invalid Class ID'),
  subjectId: z.string().uuid('Invalid Subject ID'),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Exam date must be YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Start time must be HH:MM or HH:MM:SS'),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'End time must be HH:MM or HH:MM:SS'),
  fullMarks: z.number().min(1, 'Full marks must be at least 1').max(200),
  passMarks: z.number().min(0, 'Pass marks cannot be negative').max(200),
  classroomId: z.string().uuid('Invalid Classroom ID').optional().nullable(),
});

export const MarkEntryItemSchema = z.object({
  studentId: z.string().uuid('Invalid Student ID'),
  enrollmentId: z.string().uuid('Invalid Enrollment ID'),
  theoryObtained: z.number().min(0, 'Obtained marks cannot be negative').max(100, 'Obtained marks cannot exceed 100').default(0),
  mcqObtained: z.number().min(0, 'Obtained marks cannot be negative').max(100, 'Obtained marks cannot exceed 100').default(0),
  practicalObtained: z.number().min(0, 'Obtained marks cannot be negative').max(100, 'Obtained marks cannot exceed 100').default(0),
  vivaObtained: z.number().min(0, 'Obtained marks cannot be negative').max(100, 'Obtained marks cannot exceed 100').default(0),
  caObtained: z.number().min(0, 'Obtained marks cannot be negative').max(100, 'Obtained marks cannot exceed 100').default(0),
  isAbsent: z.boolean().default(false),
});

export const MarksBulkSaveSchema = z.object({
  examId: z.string().uuid('Invalid Exam ID'),
  classId: z.string().uuid('Invalid Class ID'),
  sectionId: z.string().uuid('Invalid Section ID'),
  subjectId: z.string().uuid('Invalid Subject ID'),
  academicSessionId: z.string().uuid('Invalid Academic Session ID'),
  isSubmission: z.boolean().default(false), // true = SUBMITTED_BY_TEACHER; false = DRAFT
  marks: z.array(MarkEntryItemSchema).min(1, 'At least one student mark entry is required'),
});

export const MarksApproveSchema = z.object({
  examId: z.string().uuid('Invalid Exam ID'),
  classId: z.string().uuid('Invalid Class ID'),
  sectionId: z.string().uuid('Invalid Section ID').optional(),
  subjectId: z.string().uuid('Invalid Subject ID'),
  status: z.enum([MarkWorkflowStatus.APPROVED, MarkWorkflowStatus.DRAFT]),
  rejectionReason: z.string().max(500).optional(),
});

export const ResultGenerateSchema = z.object({
  examId: z.string().uuid('Invalid Exam ID'),
  classId: z.string().uuid('Invalid Class ID'),
  sectionId: z.string().uuid('Invalid Section ID').optional(),
});

export const ResultPublishSchema = z.object({
  examId: z.string().uuid('Invalid Exam ID'),
  classId: z.string().uuid('Invalid Class ID').optional(),
});
