import { z } from 'zod';

export const DepartmentCreateSchema = z.object({
  code: z
    .string()
    .min(2, 'Department code must be at least 2 characters')
    .max(50, 'Department code cannot exceed 50 characters')
    .regex(/^[A-Z0-9_-]+$/, 'Department code must be uppercase alphanumeric, dashes, or underscores'),
  nameEn: z.string().min(2, 'English name is required').max(100),
  nameBn: z.string().min(2, 'Bangla name is required').max(100),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).default('ACTIVE'),
});

export const DepartmentUpdateSchema = DepartmentCreateSchema.partial();
export const DepartmentSchema = DepartmentCreateSchema;

export const DesignationCreateSchema = z.object({
  departmentId: z.string().uuid('Valid department ID is required').optional().nullable(),
  code: z
    .string()
    .min(2, 'Designation code must be at least 2 characters')
    .max(50)
    .regex(/^[A-Z0-9_-]+$/, 'Designation code must be uppercase alphanumeric, dashes, or underscores'),
  titleEn: z.string().min(2, 'English title is required').max(100),
  titleBn: z.string().min(2, 'Bangla title is required').max(100),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).default('ACTIVE'),
});

export const DesignationUpdateSchema = DesignationCreateSchema.partial();
export const DesignationSchema = DesignationCreateSchema;

export const EmployeeCreateSchema = z.object({
  campusId: z.string().uuid().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
  teacherId: z.string().uuid().optional().nullable(),
  firstNameEn: z.string().max(100).optional(),
  lastNameEn: z.string().max(100).optional(),
  fullNameEn: z.string().min(2, 'Full name (English) is required').max(200),
  fullNameBn: z.string().max(200).optional().nullable(),
  departmentId: z.string().uuid('Department is required'),
  designationId: z.string().uuid('Designation is required'),
  employmentType: z.enum([
    'PERMANENT',
    'PROBATIONARY',
    'CONTRACTUAL',
    'PART_TIME',
    'TEMPORARY',
    'INTERN',
    'DAILY_WAGE',
  ]).default('PERMANENT'),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).default('MALE'),
  bloodGroup: z.enum(['A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE']).optional().nullable(),
  nationalId: z.string().min(2, 'National ID is required').max(50).default('N/A'),
  birthRegistrationNo: z.string().max(50).optional().nullable(),
  phone: z.string().min(10, 'Phone must be at least 10 digits').max(30),
  email: z.string().email('Invalid email address').max(255).optional().nullable(),
  presentAddress: z.string().max(500).optional().nullable(),
  permanentAddress: z.string().max(500).optional().nullable(),
  emergencyContactName: z.string().max(150).optional().nullable(),
  emergencyContactPhone: z.string().max(30).optional().nullable(),
  emergencyContactRelation: z.string().max(50).optional().nullable(),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  confirmationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  bankName: z.string().max(100).optional().nullable(),
  bankAccountNo: z.string().max(100).optional().nullable(),
  bankRoutingNo: z.string().max(50).optional().nullable(),
  mfsProvider: z.string().max(50).optional().nullable(),
  mfsNumber: z.string().max(30).optional().nullable(),
  status: z.enum([
    'DRAFT',
    'ACTIVE',
    'ON_LEAVE',
    'SUSPENDED',
    'RESIGNED',
    'TERMINATED',
    'RETIRED',
    'INACTIVE',
  ]).default('ACTIVE'),
  terminationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  terminationReason: z.string().max(500).optional().nullable(),
});

export const EmployeeUpdateSchema = EmployeeCreateSchema.partial();
export const EmployeeSchema = EmployeeCreateSchema;

export const LeaveTypeCreateSchema = z.object({
  code: z.string().min(2).max(50).regex(/^[A-Z0-9_-]+$/),
  nameEn: z.string().min(2).max(100),
  nameBn: z.string().min(2).max(100),
  annualDays: z.number().int().min(0, 'Annual days cannot be negative').default(10),
  isPaid: z.boolean().default(true),
  allowCarryForward: z.boolean().default(false),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).default('ACTIVE'),
});

export const LeaveTypeUpdateSchema = LeaveTypeCreateSchema.partial();
export const LeaveTypeSchema = LeaveTypeCreateSchema;

export const LeaveRequestCreateSchema = z.object({
  employeeId: z.string().uuid().optional(),
  leaveTypeId: z.string().uuid('Leave type is required'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date format: YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date format: YYYY-MM-DD'),
  totalDays: z.number().positive('Total days must be positive').optional(),
  reason: z.string().min(3, 'Reason is required').max(1000),
});

export const LeaveRequestSchema = LeaveRequestCreateSchema;

export const LeaveActionSchema = z.object({
  actionReason: z.string().max(500).optional().nullable(),
});
