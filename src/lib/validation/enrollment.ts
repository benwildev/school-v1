import { z } from 'zod';
import { EnrollmentStatus, EnrollmentType, CurriculumVersion } from '@prisma/client';

export const EnrollmentCreateSchema = z.object({
  studentId: z.string().uuid({ message: 'বৈধ শিক্ষার্থী আইডি (UUID) প্রদান করুন।' }),
  academicSessionId: z.string().uuid({ message: 'বৈধ শিক্ষাবর্ষ আইডি (UUID) প্রদান করুন।' }),
  classId: z.string().uuid({ message: 'বৈধ শ্রেণী আইডি (UUID) প্রদান করুন।' }),
  sectionId: z.string().uuid({ message: 'বৈধ শাখা আইডি (UUID) প্রদান করুন।' }),
  campusId: z.string().uuid({ message: 'বৈধ ক্যাম্পাস আইডি প্রদান করুন।' }).optional().nullable(),
  groupId: z.string().uuid({ message: 'বৈধ গ্রুপ আইডি প্রদান করুন।' }).optional().nullable(),
  rollNo: z.coerce.number().int().positive({ message: 'রোল নম্বর অবশ্যই ধনাত্মক পূর্ণসংখ্যা হতে হবে।' }),
  curriculumVersion: z.nativeEnum(CurriculumVersion).default(CurriculumVersion.BANGLA_VERSION),
  enrollmentDate: z.string().or(z.date()).optional().transform((val) => (val ? new Date(val) : new Date())),
  enrollmentType: z.nativeEnum(EnrollmentType).default(EnrollmentType.REGULAR),
  status: z.nativeEnum(EnrollmentStatus).default(EnrollmentStatus.ACTIVE),
  remarks: z.string().max(1000, { message: 'মন্তব্য সর্বোচ্চ ১০০০ অক্ষরের মধ্যে হতে হবে।' }).optional().nullable(),
});

export type EnrollmentCreateInput = z.infer<typeof EnrollmentCreateSchema>;

export const EnrollmentUpdateSchema = z.object({
  rollNo: z.coerce.number().int().positive({ message: 'রোল নম্বর অবশ্যই ধনাত্মক পূর্ণসংখ্যা হতে হবে।' }).optional(),
  curriculumVersion: z.nativeEnum(CurriculumVersion).optional(),
  status: z.nativeEnum(EnrollmentStatus).optional(),
  remarks: z.string().max(1000, { message: 'মন্তব্য সর্বোচ্চ ১০০০ অক্ষরের মধ্যে হতে হবে।' }).optional().nullable(),
});

export type EnrollmentUpdateInput = z.infer<typeof EnrollmentUpdateSchema>;

export const EnrollmentFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  academicSessionId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  campusId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  status: z.string().optional(),
  enrollmentType: z.string().optional(),
  studentId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export type EnrollmentFilterInput = z.infer<typeof EnrollmentFilterSchema>;

export const EnrollmentTransferSchema = z.object({
  enrollmentId: z.string().uuid({ message: 'বৈধ এনরোলমেন্ট আইডি প্রদান করুন।' }),
  type: z.enum(['SECTION', 'CAMPUS'], { message: 'স্থানান্তরের ধরণ শাখা (SECTION) অথবা ক্যাম্পাস (CAMPUS) হতে হবে।' }),
  targetClassId: z.string().uuid().optional(),
  targetSectionId: z.string().uuid({ message: 'বৈধ লক্ষ্য শাখা আইডি প্রদান করুন।' }),
  targetRollNo: z.coerce.number().int().positive({ message: 'লক্ষ্য রোল নম্বর অবশ্যই ধনাত্মক পূর্ণসংখ্যা হতে হবে।' }),
  targetCampusId: z.string().uuid().optional().nullable(),
  reason: z.string().max(500, { message: 'স্থানান্তরের কারণ সর্বোচ্চ ৫০০ অক্ষরের মধ্যে হতে হবে।' }).optional(),
});

export type EnrollmentTransferInput = z.infer<typeof EnrollmentTransferSchema>;

export const EnrollmentWithdrawSchema = z.object({
  enrollmentId: z.string().uuid({ message: 'বৈধ এনরোলমেন্ট আইডি প্রদান করুন।' }),
  status: z.enum([EnrollmentStatus.DROPPED, EnrollmentStatus.TRANSFERRED_OUT], {
    message: 'স্ট্যাটাস অবশ্যই DROPPED অথবা TRANSFERRED_OUT হতে হবে।',
  }),
  reason: z.string().min(3, { message: 'প্রত্যাহার বা স্থানান্তরের কারণ উল্লেখ করুন।' }).max(500),
  date: z.string().or(z.date()).optional().transform((val) => (val ? new Date(val) : new Date())),
});

export type EnrollmentWithdrawInput = z.infer<typeof EnrollmentWithdrawSchema>;

export const EnrollmentReadmissionSchema = z.object({
  studentId: z.string().uuid({ message: 'বৈধ শিক্ষার্থী আইডি প্রদান করুন।' }),
  academicSessionId: z.string().uuid({ message: 'বৈধ শিক্ষাবর্ষ আইডি প্রদান করুন।' }),
  classId: z.string().uuid({ message: 'বৈধ শ্রেণী আইডি প্রদান করুন।' }),
  sectionId: z.string().uuid({ message: 'বৈধ শাখা আইডি প্রদান করুন।' }),
  rollNo: z.coerce.number().int().positive({ message: 'রোল নম্বর অবশ্যই ধনাত্মক পূর্ণসংখ্যা হতে হবে।' }),
  campusId: z.string().uuid().optional().nullable(),
  groupId: z.string().uuid().optional().nullable(),
  curriculumVersion: z.nativeEnum(CurriculumVersion).default(CurriculumVersion.BANGLA_VERSION),
  remarks: z.string().max(1000).optional().nullable(),
});

export type EnrollmentReadmissionInput = z.infer<typeof EnrollmentReadmissionSchema>;

/**
 * Validates whether an EnrollmentStatus state transition is allowed.
 */
export function isValidEnrollmentStatusTransition(
  currentStatus: EnrollmentStatus,
  newStatus: EnrollmentStatus
): boolean {
  if (currentStatus === newStatus) return true;

  switch (currentStatus) {
    case EnrollmentStatus.ACTIVE:
      return (
        [
          EnrollmentStatus.PROMOTED,
          EnrollmentStatus.REPEATED,
          EnrollmentStatus.TRANSFERRED_OUT,
          EnrollmentStatus.PASSED_OUT,
          EnrollmentStatus.DROPPED,
        ] as EnrollmentStatus[]
      ).includes(newStatus);

    case EnrollmentStatus.DROPPED:
      // Can only be reactivated via readmission/explicit reactivation if no session conflict
      return newStatus === EnrollmentStatus.ACTIVE;

    case EnrollmentStatus.TRANSFERRED_OUT:
      return newStatus === EnrollmentStatus.ACTIVE;

    case EnrollmentStatus.PROMOTED:
    case EnrollmentStatus.REPEATED:
    case EnrollmentStatus.PASSED_OUT:
      // Terminal states for the academic session
      return false;

    default:
      return false;
  }
}
