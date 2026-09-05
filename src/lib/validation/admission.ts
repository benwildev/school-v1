import { z } from 'zod';
import {
  AdmissionStatus,
  ApplicationSource,
  Gender,
  BloodGroup,
  Religion,
  CurriculumVersion,
  AcademicShift,
} from '@prisma/client';

const phoneRegex = /^(?:\+88|88)?(01[3-9]\d{8})$/;

export const PublicAdmissionApplicationSchema = z.object({
  academicSessionId: z.string().uuid({ message: 'বৈধ শিক্ষাবর্ষ নির্বাচন করুন।' }),
  appliedClassId: z.string().uuid({ message: 'বৈধ শ্রেণী নির্বাচন করুন।' }),
  appliedGroupId: z.string().uuid({ message: 'বৈধ গ্রুপ নির্বাচন করুন।' }).optional().nullable(),
  appliedCampusId: z.string().uuid({ message: 'বৈধ ক্যাম্পাস নির্বাচন করুন।' }).optional().nullable(),
  curriculumVersion: z.nativeEnum(CurriculumVersion).default(CurriculumVersion.BANGLA_VERSION),
  appliedShift: z.nativeEnum(AcademicShift).default(AcademicShift.DAY),

  // Applicant info
  applicantNameEn: z.string().trim().min(2, { message: 'শিক্ষার্থীর ইংরেজি নাম আবশ্যক।' }).max(200),
  applicantNameBn: z.string().trim().min(2, { message: 'শিক্ষার্থীর বাংলা নাম আবশ্যক।' }).max(200),
  dateOfBirth: z
    .string()
    .or(z.date())
    .transform((val) => (val ? new Date(val) : new Date()))
    .refine(
      (dob) => {
        const now = new Date();
        if (dob > now) return false;
        const ageInYears = (now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        return ageInYears >= 2 && ageInYears <= 30;
      },
      { message: 'শিক্ষার্থীর বয়স গ্রহণযোগ্য সীমার মধ্যে হতে হবে (২ থেকে ৩০ বছর)।' }
    ),
  gender: z.nativeEnum(Gender, { message: 'বৈধ লিঙ্গ নির্বাচন করুন।' }),
  bloodGroup: z.nativeEnum(BloodGroup).optional().nullable(),
  religion: z.nativeEnum(Religion, { message: 'ধর্ম নির্বাচন করুন।' }),
  birthRegistrationNo: z.string().trim().max(50).optional().nullable(),

  // Father info
  fatherNameEn: z.string().trim().min(2, { message: 'পিতার ইংরেজি নাম আবশ্যক।' }).max(150),
  fatherNameBn: z.string().trim().min(2, { message: 'পিতার বাংলা নাম আবশ্যক।' }).max(150),
  fatherNid: z.string().trim().max(50).optional().nullable(),
  fatherPhone: z
    .string()
    .trim()
    .regex(phoneRegex, { message: 'পিতার সঠিক ১১ ডিজিটের বাংলাদেশী মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।' })
    .max(30),
  fatherOccupation: z.string().trim().max(100).optional().nullable(),

  // Mother info
  motherNameEn: z.string().trim().min(2, { message: 'মাতার ইংরেজি নাম আবশ্যক।' }).max(150),
  motherNameBn: z.string().trim().min(2, { message: 'মাতার বাংলা নাম আবশ্যক।' }).max(150),
  motherPhone: z
    .string()
    .trim()
    .regex(phoneRegex, { message: 'মাতার সঠিক ১১ ডিজিটের বাংলাদেশী মোবাইল নম্বর দিন।' })
    .optional()
    .nullable()
    .or(z.literal('')),

  // Address
  presentAddress: z.string().trim().min(5, { message: 'বর্তমান ঠিকানা আবশ্যক (কমপক্ষে ৫ অক্ষর)।' }).max(500),
  permanentAddress: z.string().trim().min(5, { message: 'স্থায়ী ঠিকানা আবশ্যক (কমপক্ষে ৫ অক্ষর)।' }).max(500),

  // Previous School
  previousSchoolName: z.string().trim().max(255).optional().nullable(),
  previousClass: z.string().trim().max(50).optional().nullable(),
  previousGpa: z.coerce.number().min(0).max(5).optional().nullable(),

  // Payment info
  applicationFeePaid: z.boolean().default(false),
  applicationFeeTrxId: z.string().trim().max(100).optional().nullable(),

  // Documents
  documents: z
    .array(
      z.object({
        title: z.string().trim().min(2, 'নথির শিরোনাম আবশ্যক।').max(150),
        fileUrl: z
          .string()
          .url({ message: 'বৈধ ফাইলের লিংক প্রদান করুন।' })
          .max(1000)
          .refine(
            (url) => {
              try {
                const parsed = new URL(url);
                if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
                const host = parsed.hostname.toLowerCase();
                if (host === 'localhost' || host === '127.0.0.1' || host === '169.254.169.254') return false;
                if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false;
                return true;
              } catch {
                return false;
              }
            },
            { message: 'নিরাপদ এবং গ্রহণযোগ্য ওয়েব ফাইল ইউআরএল প্রদান করুন।' }
          ),
      })
    )
    .max(10, { message: 'সর্বোচ্চ ১০টি নথি সংযুক্ত করা যাবে।' })
    .optional()
    .default([]),
});

export type PublicAdmissionApplicationInput = z.infer<typeof PublicAdmissionApplicationSchema>;

export const AdminAdmissionApplicationSchema = PublicAdmissionApplicationSchema.extend({
  applicationSource: z.nativeEnum(ApplicationSource).default(ApplicationSource.ADMIN_MANUAL),
  status: z.nativeEnum(AdmissionStatus).default(AdmissionStatus.SUBMITTED),
});

export type AdminAdmissionApplicationInput = z.infer<typeof AdminAdmissionApplicationSchema>;

export const AdmissionStatusUpdateSchema = z
  .object({
    status: z.nativeEnum(AdmissionStatus, { message: 'বৈধ স্ট্যাটাস নির্বাচন করুন।' }),
    rejectionReason: z.string().trim().max(1000).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.status === AdmissionStatus.REJECTED && (!data.rejectionReason || data.rejectionReason.length < 3)) {
        return false;
      }
      return true;
    },
    {
      message: 'আবেদন প্রত্যাখ্যানের কারণ (কমপক্ষে ৩ অক্ষর) উল্লেখ করা আবশ্যক।',
      path: ['rejectionReason'],
    }
  )
  .refine(
    (data) => {
      return data.status !== AdmissionStatus.ENROLLED;
    },
    {
      message: 'ভর্তি সম্পন্ন স্ট্যাটাস (ENROLLED) শুধুমাত্র ভর্তি অনুমোদন ও রূপান্তরের মাধ্যমে সম্পন্ন করা সম্ভব।',
      path: ['status'],
    }
  );

export type AdmissionStatusUpdateInput = z.infer<typeof AdmissionStatusUpdateSchema>;

export const AdmissionApprovalConversionSchema = z.object({
  sectionId: z.string().uuid({ message: 'ভর্তির জন্য শাখা নির্বাচন করুন।' }),
  rollNo: z.coerce.number().int().positive({ message: 'রোল নম্বর অবশ্যই ধনাত্মক পূর্ণসংখ্যা হতে হবে।' }),
  campusId: z.string().uuid().optional().nullable(),
  groupId: z.string().uuid().optional().nullable(),
  fatherGuardianId: z.string().uuid().optional().nullable(),
  motherGuardianId: z.string().uuid().optional().nullable(),
  admissionDate: z.string().or(z.date()).optional().transform((val) => (val ? new Date(val) : new Date())),
  notes: z.string().trim().max(500).optional().nullable(),
});

export type AdmissionApprovalConversionInput = z.infer<typeof AdmissionApprovalConversionSchema>;

export const AdmissionFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  academicSessionId: z.string().uuid().optional(),
  appliedClassId: z.string().uuid().optional(),
  appliedCampusId: z.string().uuid().optional(),
  status: z.nativeEnum(AdmissionStatus).optional(),
  applicationSource: z.nativeEnum(ApplicationSource).optional(),
  search: z.string().optional(),
});

export type AdmissionFilterInput = z.infer<typeof AdmissionFilterSchema>;

/**
 * Validates allowed state transitions for admission applications.
 */
const ALLOWED_TRANSITIONS: Partial<Record<AdmissionStatus, AdmissionStatus[]>> = {
  [AdmissionStatus.SUBMITTED]: [
    AdmissionStatus.UNDER_REVIEW,
    AdmissionStatus.NEED_CORRECTION,
    AdmissionStatus.SHORTLISTED,
    AdmissionStatus.REJECTED,
    AdmissionStatus.CANCELLED,
  ],
  [AdmissionStatus.UNDER_REVIEW]: [
    AdmissionStatus.NEED_CORRECTION,
    AdmissionStatus.SHORTLISTED,
    AdmissionStatus.INTERVIEW_SCHEDULED,
    AdmissionStatus.ASSESSMENT_SCHEDULED,
    AdmissionStatus.APPROVED,
    AdmissionStatus.REJECTED,
    AdmissionStatus.CANCELLED,
  ],
  [AdmissionStatus.NEED_CORRECTION]: [
    AdmissionStatus.SUBMITTED,
    AdmissionStatus.UNDER_REVIEW,
    AdmissionStatus.CANCELLED,
  ],
  [AdmissionStatus.SHORTLISTED]: [
    AdmissionStatus.INTERVIEW_SCHEDULED,
    AdmissionStatus.ASSESSMENT_SCHEDULED,
    AdmissionStatus.APPROVED,
    AdmissionStatus.REJECTED,
    AdmissionStatus.CANCELLED,
  ],
  [AdmissionStatus.INTERVIEW_SCHEDULED]: [
    AdmissionStatus.APPROVED,
    AdmissionStatus.REJECTED,
    AdmissionStatus.CANCELLED,
  ],
  [AdmissionStatus.ASSESSMENT_SCHEDULED]: [
    AdmissionStatus.APPROVED,
    AdmissionStatus.REJECTED,
    AdmissionStatus.CANCELLED,
  ],
  [AdmissionStatus.APPROVED]: [
    AdmissionStatus.ENROLLED,
    AdmissionStatus.CANCELLED,
  ],
  [AdmissionStatus.REJECTED]: [
    AdmissionStatus.UNDER_REVIEW,
  ],
};

export function isValidAdmissionStatusTransition(
  currentStatus: AdmissionStatus,
  newStatus: AdmissionStatus
): boolean {
  if (currentStatus === newStatus) return true;

  // ENROLLED and CANCELLED are terminal states
  if (currentStatus === AdmissionStatus.ENROLLED || currentStatus === AdmissionStatus.CANCELLED) {
    return false;
  }

  const allowed = ALLOWED_TRANSITIONS[currentStatus];
  return allowed ? allowed.includes(newStatus) : false;
}
