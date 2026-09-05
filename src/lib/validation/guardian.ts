import { z } from 'zod';
import { GuardianRelation } from '@prisma/client';

const phoneRegex = /^(?:\+88|88)?(01[3-9]\d{8})$/;

function normalizePhone(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.startsWith('880')) {
    return '0' + digitsOnly.slice(3);
  }
  return digitsOnly;
}

export const GuardianCreateSchema = z.object({
  fullNameEn: z
    .string()
    .trim()
    .min(1, 'ইংরেজি নাম আবশ্যক')
    .max(150, 'নাম সর্বোচ্চ ১৫০ অক্ষর হতে পারে'),
  fullNameBn: z
    .string()
    .trim()
    .min(1, 'বাংলা নাম আবশ্যক')
    .max(150, 'নাম সর্বোচ্চ ১৫০ অক্ষর হতে পারে'),
  relationType: z.nativeEnum(GuardianRelation, {
    message: 'সঠিক সম্পর্ক নির্বাচন করুন',
  }),
  nationalId: z
    .string()
    .trim()
    .max(50, 'জাতীয় পরিচয়পত্র সর্বোচ্চ ৫০ অক্ষর হতে পারে')
    .optional()
    .nullable(),
  phone: z
    .string()
    .trim()
    .min(1, 'ফোন নম্বর আবশ্যক')
    .regex(phoneRegex, 'সঠিক বাংলাদেশী ফোন নম্বর দিন (যেমন: 017xxxxxxxx)')
    .transform((val) => normalizePhone(val)),
  alternatePhone: z
    .string()
    .trim()
    .max(30)
    .refine((val) => !val || phoneRegex.test(val), {
      message: 'সঠিক বিকল্প ফোন নম্বর দিন',
    })
    .transform((val) => (val ? normalizePhone(val) : null))
    .optional()
    .nullable(),
  email: z
    .string()
    .trim()
    .email('সঠিক ইমেইল এড্রেস দিন')
    .max(255)
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((val) => (val && val.length > 0 ? val.toLowerCase() : null)),
  occupation: z
    .string()
    .trim()
    .max(100, 'পেশা সর্বোচ্চ ১০০ অক্ষর হতে পারে')
    .optional()
    .nullable(),
  monthlyIncome: z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((val) => {
      if (val === undefined || val === null || val === '') return null;
      const num = typeof val === 'number' ? val : parseFloat(val);
      if (isNaN(num) || num < 0) return null;
      return num;
    }),
  educationLevel: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable(),
  photoUrl: z
    .string()
    .trim()
    .url('সঠিক ফটো ইউআরএল দিন')
    .optional()
    .nullable()
    .or(z.literal('')),
  address: z
    .string()
    .trim()
    .optional()
    .nullable(),
});

export const GuardianUpdateSchema = GuardianCreateSchema.partial();

export const GuardianFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

export type GuardianCreateInput = z.infer<typeof GuardianCreateSchema>;
export type GuardianUpdateInput = z.infer<typeof GuardianUpdateSchema>;
export type GuardianFilterInput = z.infer<typeof GuardianFilterSchema>;
