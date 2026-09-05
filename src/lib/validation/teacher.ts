import { z } from 'zod';
import { TeacherDesignation, Gender, BloodGroup, TeacherStatus, TeacherAssignmentRole, RecordStatus } from '@prisma/client';

const phoneRegex = /^(?:\+88|88)?(01[3-9]\d{8})$/;

// Common Teacher Schema
export const TeacherSchema = z.object({
  teacherCode: z.string().min(1, 'Teacher Code is required').max(50),
  firstNameEn: z.string().min(1, 'First Name (English) is required').max(100),
  lastNameEn: z.string().min(1, 'Last Name (English) is required').max(100),
  fullNameEn: z.string().min(1, 'Full Name (English) is required').max(200),
  fullNameBn: z.string().min(1, 'Full Name (Bangla) is required').max(200),
  designation: z.nativeEnum(TeacherDesignation, { message: "Invalid value" }),
  department: z.string().max(100).optional().nullable(),
  qualification: z.string().min(1, 'Qualification is required').max(255),
  dateOfBirth: z.coerce.date(),
  gender: z.nativeEnum(Gender, { message: "Invalid value" }),
  bloodGroup: z.nativeEnum(BloodGroup).optional().nullable(),
  nationalId: z.string().min(1, 'National ID is required').max(50),
  phone: z.string().regex(phoneRegex, 'Invalid Bangladeshi phone number'),
  email: z.string().email('Invalid email address').max(255),
  joiningDate: z.coerce.date(),
  signatureUrl: z.string().optional().nullable(),
  campusId: z.string().uuid('Invalid Campus ID').optional().nullable(),
  status: z.nativeEnum(TeacherStatus).default(TeacherStatus.ACTIVE),
});

export const TeacherCreateSchema = TeacherSchema;

export const TeacherUpdateSchema = TeacherSchema.partial();

// Common Teacher Assignment Schema
export const TeacherAssignmentSchema = z.object({
  academicSessionId: z.string().uuid('Invalid Academic Session ID'),
  teacherId: z.string().uuid('Invalid Teacher ID'),
  classId: z.string().uuid('Invalid Class ID'),
  sectionId: z.string().uuid('Invalid Section ID'),
  subjectId: z.string().uuid('Invalid Subject ID').optional().nullable(),
  role: z.nativeEnum(TeacherAssignmentRole).default(TeacherAssignmentRole.SUBJECT_TEACHER),
  canEnterMarks: z.boolean().default(true),
  canTakeAttendance: z.boolean().default(true),
  status: z.nativeEnum(RecordStatus).default(RecordStatus.ACTIVE),
});

export const TeacherAssignmentCreateSchema = TeacherAssignmentSchema;

export const TeacherAssignmentUpdateSchema = TeacherAssignmentSchema.partial();
