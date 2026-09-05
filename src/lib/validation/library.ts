import { z } from 'zod';

export const BookConditionSchema = z.enum([
  'NEW',
  'GOOD',
  'FAIR',
  'POOR',
  'DAMAGED',
]);

export const BookCopyStatusSchema = z.enum([
  'AVAILABLE',
  'ISSUED',
  'RESERVED',
  'LOST',
  'DAMAGED',
  'WITHDRAWN',
  'MAINTENANCE',
]);

export const BorrowerTypeSchema = z.enum(['STUDENT', 'EMPLOYEE']);

export const LoanStatusSchema = z.enum([
  'ISSUED',
  'RETURNED',
  'OVERDUE',
  'LOST',
  'DAMAGED',
]);

export const ReservationStatusSchema = z.enum([
  'PENDING',
  'FULFILLED',
  'CANCELLED',
  'EXPIRED',
]);

export const LibraryFineTypeSchema = z.enum([
  'OVERDUE',
  'LOST_BOOK',
  'DAMAGE',
  'OTHER',
]);

export const LibraryFineStatusSchema = z.enum(['UNPAID', 'PAID', 'WAIVED']);

export const UpdateLibrarySettingsSchema = z.object({
  studentMaxBooks: z.number().int().min(1).optional(),
  studentLoanPeriodDays: z.number().int().min(1).optional(),
  studentMaxRenewals: z.number().int().min(0).optional(),
  employeeMaxBooks: z.number().int().min(1).optional(),
  employeeLoanPeriodDays: z.number().int().min(1).optional(),
  employeeMaxRenewals: z.number().int().min(0).optional(),
  dailyFineRate: z.number().min(0).optional(),
  lostBookChargeMultiplier: z.number().min(0).optional(),
  damageFineFlat: z.number().min(0).optional(),
  blockedThresholdFine: z.number().min(0).optional(),
  allowStudentReservations: z.boolean().optional(),
  allowEmployeeReservations: z.boolean().optional(),
  reservationValidityDays: z.number().int().min(1).optional(),
  autoBillToStudentAccount: z.boolean().optional(),
});

export const CreateLibraryCategorySchema = z.object({
  code: z.string().trim().min(1, 'Category code is required').max(50),
  nameEn: z.string().trim().min(1, 'English name is required').max(100),
  nameBn: z.string().trim().min(1, 'Bangla name is required').max(100),
  description: z.string().trim().optional().nullable(),
});

export const CreateLibraryAuthorSchema = z.object({
  nameEn: z.string().trim().min(1, 'Author name is required').max(150),
  nameBn: z.string().trim().optional().nullable(),
  bio: z.string().trim().optional().nullable(),
});

export const CreateLibraryPublisherSchema = z.object({
  nameEn: z.string().trim().min(1, 'Publisher name is required').max(150),
  nameBn: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  contactPhone: z.string().trim().optional().nullable(),
});

export const CreateLibraryBookSchema = z.object({
  categoryId: z.string().uuid('Valid category ID is required').optional().nullable(),
  authorId: z.string().uuid('Valid author ID is required').optional().nullable(),
  publisherId: z.string().uuid('Valid publisher ID is required').optional().nullable(),
  titleEn: z.string().trim().min(1, 'Book title is required').max(255),
  titleBn: z.string().trim().optional().nullable(),
  subtitle: z.string().trim().optional().nullable(),
  isbn10: z.string().trim().max(20).optional().nullable(),
  isbn13: z.string().trim().max(20).optional().nullable(),
  edition: z.string().trim().max(50).optional().nullable(),
  publicationYear: z.number().int().min(1000).max(2100).optional().nullable(),
  language: z.string().trim().default('English'),
  description: z.string().trim().optional().nullable(),
  coverUrl: z.string().trim().optional().nullable(),
});

export const UpdateLibraryBookSchema = CreateLibraryBookSchema.partial();

export const CreateLibraryBookCopySchema = z.object({
  bookId: z.string().uuid('Valid book ID is required'),
  campusId: z.string().uuid('Valid campus ID is required').optional().nullable(),
  accessionNumber: z.string().trim().min(1, 'Accession number is required').max(100),
  barcode: z.string().trim().min(1, 'Barcode is required').max(100),
  shelfRack: z.string().trim().max(100).optional().nullable(),
  acquisitionDate: z.string().optional().nullable(),
  acquisitionCost: z.number().min(0).default(0),
  condition: BookConditionSchema.default('NEW'),
  notes: z.string().trim().optional().nullable(),
});

export const UpdateLibraryBookCopySchema = z.object({
  campusId: z.string().uuid().optional().nullable(),
  shelfRack: z.string().trim().max(100).optional().nullable(),
  condition: BookConditionSchema.optional(),
  status: BookCopyStatusSchema.optional(),
  notes: z.string().trim().optional().nullable(),
});

export const IssueBookSchema = z.object({
  copyId: z.string().uuid('Valid copy ID is required'),
  borrowerType: BorrowerTypeSchema,
  studentId: z.string().uuid().optional().nullable(),
  enrollmentId: z.string().uuid().optional().nullable(),
  employeeId: z.string().uuid().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
}).refine(
  (data) => {
    if (data.borrowerType === 'STUDENT') return !!data.studentId;
    if (data.borrowerType === 'EMPLOYEE') return !!data.employeeId;
    return false;
  },
  {
    message: 'Must provide studentId for STUDENT borrower or employeeId for EMPLOYEE borrower',
    path: ['borrowerType'],
  }
);

export const ReturnBookSchema = z.object({
  condition: BookConditionSchema.optional(),
  damageCharge: z.number().min(0).optional(),
  notes: z.string().trim().optional().nullable(),
});

export const RenewBookSchema = z.object({
  notes: z.string().trim().optional().nullable(),
});

export const CreateReservationSchema = z.object({
  bookId: z.string().uuid('Valid book ID is required'),
  borrowerType: BorrowerTypeSchema,
  studentId: z.string().uuid().optional().nullable(),
  employeeId: z.string().uuid().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
}).refine(
  (data) => {
    if (data.borrowerType === 'STUDENT') return !!data.studentId;
    if (data.borrowerType === 'EMPLOYEE') return !!data.employeeId;
    return false;
  },
  {
    message: 'Must provide studentId for STUDENT borrower or employeeId for EMPLOYEE borrower',
    path: ['borrowerType'],
  }
);

export const WaiveFineSchema = z.object({
  waivedReason: z.string().trim().min(3, 'Reason for waiver must be at least 3 characters').max(500),
});
