import { z } from 'zod';

/**
 * Zod validation schemas for Campus / Branch management.
 * Mirrors the field set and conventions already established in
 * src/lib/validation/school-settings.ts.
 */

export const CampusStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']);
export type CampusStatusType = z.infer<typeof CampusStatusEnum>;

const campusCodeRegex = /^[A-Z0-9][A-Z0-9-]{1,19}$/;
const phoneRegex = /^[0-9+\s()-]{6,30}$/;

/**
 * Zod validation schema for creating a new Campus.
 */
export const CampusCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(campusCodeRegex, 'ক্যাম্পাস কোড শুধুমাত্র বড় হাতের ইংরেজি অক্ষর, সংখ্যা ও হাইফেন দিয়ে ২-২০ অক্ষরের হতে হবে।'),
  nameEn: z
    .string()
    .min(2, 'English campus name must be at least 2 characters.')
    .max(255, 'English campus name cannot exceed 255 characters.')
    .trim(),
  nameBn: z
    .string()
    .min(2, 'ক্যাম্পাসের বাংলা নাম কমপক্ষে ২ অক্ষরের হতে হবে।')
    .max(255, 'ক্যাম্পাসের বাংলা নাম ২৫৫ অক্ষরের বেশি হতে পারবে না।')
    .trim(),
  phone: z
    .string()
    .regex(phoneRegex, 'সঠিক ফোন বা মোবাইল নম্বর লিখুন।')
    .max(30, 'ফোন নম্বর ৩০ অক্ষরের বেশি হতে পারবে না।')
    .optional()
    .nullable()
    .or(z.literal('')),
  email: z
    .string()
    .email('সঠিক ই-মেইল ঠিকানা লিখুন।')
    .max(255, 'ই-মেইল ২৫৫ অক্ষরের বেশি হতে পারবে না।')
    .trim()
    .optional()
    .nullable()
    .or(z.literal('')),
  principalName: z
    .string()
    .max(150, 'প্রধানের নাম ১৫০ অক্ষরের বেশি হতে পারবে না।')
    .trim()
    .optional()
    .nullable()
    .or(z.literal('')),
  isMainBranch: z.boolean().optional(),
  status: CampusStatusEnum.optional(),
});

/**
 * Zod validation schema for partial Campus updates (PATCH).
 */
export const CampusUpdateSchema = CampusCreateSchema.partial();

export type CampusCreateInput = z.infer<typeof CampusCreateSchema>;
export type CampusUpdateInput = z.infer<typeof CampusUpdateSchema>;
