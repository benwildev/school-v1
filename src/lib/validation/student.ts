import { z } from 'zod';
import { Gender, BloodGroup, Religion, Division, StudentStatus } from '@prisma/client';

const phoneRegex = /^(?:\+88|88)?(01[3-9]\d{8})$/;

export const EmergencyContactSchema = z.object({
  name: z.string().min(1, 'জরুরি যোগাযোগের নাম আবশ্যক').max(150),
  relation: z.string().min(1, 'সম্পর্ক আবশ্যক').max(100),
  phone: z.string().regex(phoneRegex, 'সঠিক বাংলাদেশী ফোন নম্বর দিন (যেমন: 017xxxxxxxx)'),
  address: z.string().optional().nullable(),
});

export const StudentCreateSchema = z.object({
  studentCode: z
    .string()
    .trim()
    .min(1, 'স্টুডেন্ট কোড / আইডি আবশ্যক')
    .max(50, 'স্টুডেন্ট কোড সর্বোচ্চ ৫০ অক্ষর হতে পারে'),
  permanentAdmissionNo: z.string().trim().max(50).optional().nullable(),
  admissionDate: z.coerce.date().default(() => new Date()),
  firstNameEn: z.string().trim().min(1, 'First Name (English) is required').max(100),
  lastNameEn: z.string().trim().min(1, 'Last Name (English) is required').max(100),
  fullNameEn: z.string().trim().max(200).optional(),
  fullNameBn: z.string().trim().min(1, 'শিক্ষার্থীর পুরো নাম (বাংলা) আবশ্যক').max(200),
  dateOfBirth: z.coerce.date({ message: 'সঠিক জন্মতারিখ দিন' }),
  gender: z.nativeEnum(Gender, { message: 'লিঙ্গ নির্বাচন করুন' }),
  bloodGroup: z.nativeEnum(BloodGroup).optional().nullable(),
  religion: z.nativeEnum(Religion, { message: 'ধর্ম নির্বাচন করুন' }),
  nationality: z.string().trim().max(50).default('Bangladeshi'),
  birthRegistrationNo: z.string().trim().max(50).optional().nullable(),
  nationalId: z.string().trim().max(50).optional().nullable(),
  photoUrl: z.string().url().optional().nullable(),
  phone: z
    .string()
    .trim()
    .refine((val) => !val || phoneRegex.test(val), {
      message: 'সঠিক বাংলাদেশী ফোন নম্বর দিন',
    })
    .optional()
    .nullable(),
  email: z.string().trim().email('সঠিক ইমেইল এড্রেস দিন').optional().nullable().or(z.literal('')),
  permanentAddressLine: z.string().trim().default('N/A'),
  permanentVillage: z.string().trim().max(100).optional().nullable(),
  permanentPostOffice: z.string().trim().max(100).default('N/A'),
  permanentPostCode: z.string().trim().max(20).default('N/A'),
  permanentThana: z.string().trim().max(100).default('N/A'),
  permanentDistrict: z.string().trim().max(100).default('Dhaka'),
  permanentDivision: z.nativeEnum(Division).default(Division.DHAKA),
  presentAddressLine: z.string().trim().default('N/A'),
  presentThana: z.string().trim().max(100).default('N/A'),
  presentDistrict: z.string().trim().max(100).default('Dhaka'),
  presentDivision: z.nativeEnum(Division).default(Division.DHAKA),
  isPhysicallyChallenged: z.boolean().default(false),
  disabilityDetails: z.string().trim().optional().nullable(),
  status: z.nativeEnum(StudentStatus).default(StudentStatus.ACTIVE),
  emergencyContact: EmergencyContactSchema.optional().nullable(),
});

export const StudentUpdateSchema = StudentCreateSchema.omit({
  studentCode: true,
}).partial();

export const StudentFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.nativeEnum(StudentStatus).optional().or(z.literal('ALL')),
  gender: z.nativeEnum(Gender).optional().or(z.literal('ALL')),
});

export type StudentCreateInput = z.infer<typeof StudentCreateSchema>;
export type StudentUpdateInput = z.infer<typeof StudentUpdateSchema>;
export type StudentFilterInput = z.infer<typeof StudentFilterSchema>;
