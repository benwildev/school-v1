import { z } from 'zod';
import { InvitationTargetType, InvitationStatus } from '@prisma/client';

const phoneRegex = /^(?:\+88|88)?(01[3-9]\d{8})$/;

export function normalizePhone(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.startsWith('880')) {
    return '0' + digitsOnly.slice(3);
  }
  return digitsOnly;
}

export const CreateInvitationSchema = z.object({
  recipientPhone: z
    .string()
    .trim()
    .min(1, 'মোবাইল নম্বর আবশ্যক')
    .regex(phoneRegex, 'সঠিক বাংলাদেশী মোবাইল নম্বর দিন (যেমন: 017xxxxxxxx)')
    .transform(normalizePhone),
  recipientEmail: z
    .string()
    .trim()
    .email('সঠিক ইমেইল ঠিকানা দিন')
    .max(255)
    .optional()
    .nullable()
    .or(z.literal('')),
  expiresInHours: z
    .number()
    .int()
    .min(1, 'মেয়াদ কমপক্ষে ১ ঘণ্টা হতে হবে')
    .max(168, 'মেয়াদ সর্বোচ্চ ৭ দিন (১৬৮ ঘণ্টা) হতে পারে')
    .default(72),
});

export type CreateInvitationInput = z.infer<typeof CreateInvitationSchema>;

export const AcceptInvitationSchema = z.object({
  token: z
    .string()
    .trim()
    .min(8, 'আমন্ত্রণ টোকেন আবশ্যক'),
  password: z
    .string()
    .min(8, 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষর হতে হবে')
    .max(100, 'পাসওয়ার্ড সর্বোচ্চ ১০০ অক্ষর হতে পারে'),
  fullName: z
    .string()
    .trim()
    .max(150, 'নাম সর্বোচ্চ ১৫০ অক্ষর হতে পারে')
    .optional()
    .nullable(),
  email: z
    .string()
    .trim()
    .email('সঠিক ইমেইল দিন')
    .max(255)
    .optional()
    .nullable()
    .or(z.literal('')),
});

export type AcceptInvitationInput = z.infer<typeof AcceptInvitationSchema>;

export const AccountQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  status: z.enum(['ALL', 'ACTIVE', 'INVITED', 'NO_ACCOUNT']).default('ALL'),
});

export type AccountQueryInput = z.infer<typeof AccountQuerySchema>;

export { InvitationTargetType, InvitationStatus };
