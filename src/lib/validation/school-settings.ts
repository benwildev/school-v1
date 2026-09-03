import { z } from 'zod';

export const DivisionEnum = z.enum([
  'DHAKA',
  'CHITTAGONG',
  'RAJSHAHI',
  'KHULNA',
  'BARISAL',
  'SYLHET',
  'RANGPUR',
  'MYMENSINGH',
]);

export type DivisionType = z.infer<typeof DivisionEnum>;

const hexColorRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const eiinRegex = /^\d{5,8}$/;

/**
 * Zod validation schema for School Profile updates.
 */
export const SchoolProfileUpdateSchema = z.object({
  nameBn: z
    .string()
    .min(2, 'বিদ্যালয়ের বাংলা নাম কমপক্ষে ২ অক্ষরের হতে হবে।')
    .max(255, 'বিদ্যালয়ের বাংলা নাম ২৫৫ অক্ষরের বেশি হতে পারবে না।')
    .trim(),
  nameEn: z
    .string()
    .min(2, 'English school name must be at least 2 characters.')
    .max(255, 'English school name cannot exceed 255 characters.')
    .trim(),
  eiin: z
    .string()
    .regex(eiinRegex, 'সঠিক EIIN নম্বর লিখুন (৫ থেকে ৮ অঙ্কের সংখ্যা)।')
    .optional()
    .nullable()
    .or(z.literal('')),
  boardCode: z
    .string()
    .max(20, 'বোর্ড কোড ২০ অক্ষরের বেশি হতে পারবে না।')
    .optional()
    .nullable()
    .or(z.literal('')),
  registrationNo: z
    .string()
    .max(50, 'রেজিস্ট্রেশন নম্বর ৫০ অক্ষরের বেশি হতে পারবে না।')
    .optional()
    .nullable()
    .or(z.literal('')),
  establishedYear: z
    .number()
    .int('প্রতিষ্ঠার সাল পূর্ণসংখ্যা হতে হবে।')
    .min(1800, 'প্রতিষ্ঠার সাল ১৮০০ বা তার পরবর্তী হতে হবে।')
    .max(new Date().getFullYear() + 1, 'প্রতিষ্ঠার সাল ভবিষ্যতের হতে পারে না।')
    .optional()
    .nullable(),
  phone: z
    .string()
    .min(6, 'সঠিক ফোন বা মোবাইল নম্বর লিখুন।')
    .max(30, 'ফোন নম্বর ৩০ অক্ষরের বেশি হতে পারবে না।')
    .trim(),
  alternatePhone: z
    .string()
    .max(30, 'বিকল্প ফোন নম্বর ৩০ অক্ষরের বেশি হতে পারবে না।')
    .optional()
    .nullable()
    .or(z.literal('')),
  email: z
    .string()
    .email('সঠিক ই-মেইল ঠিকানা লিখুন।')
    .max(255, 'ই-মেইল ২৫৫ অক্ষরের বেশি হতে পারবে না।')
    .trim(),
  website: z
    .string()
    .url('সঠিক ওয়েবসাইট লিংক লিখুন (যেমন: https://school.edu.bd)।')
    .max(255, 'ওয়েবসাইট ২৫৫ অক্ষরের বেশি হতে পারবে না।')
    .optional()
    .nullable()
    .or(z.literal('')),
});

/**
 * Zod validation schema for School Institutional Address.
 */
export const SchoolAddressUpdateSchema = z.object({
  addressLine1: z
    .string()
    .min(3, 'বিস্তারিত ঠিকানা কমপক্ষে ৩ অক্ষরের হতে হবে।')
    .max(500, 'ঠিকানা ৫০০ অক্ষরের বেশি হতে পারবে না।')
    .trim(),
  addressLine2: z
    .string()
    .max(500, 'অতিরিক্ত ঠিকানা ৫০০ অক্ষরের বেশি হতে পারবে না।')
    .optional()
    .nullable()
    .or(z.literal('')),
  postOffice: z
    .string()
    .min(2, 'ডাকঘর কমপক্ষে ২ অক্ষরের হতে হবে।')
    .max(100, 'ডাকঘর ১০০ অক্ষরের বেশি হতে পারবে না।')
    .trim(),
  postCode: z
    .string()
    .min(2, 'পোস্ট কোড লিখুন।')
    .max(20, 'পোস্ট কোড ২০ অক্ষরের বেশি হতে পারবে না।')
    .trim(),
  thana: z
    .string()
    .min(2, 'থানা / উপজেলা কমপক্ষে ২ অক্ষরের হতে হবে।')
    .max(100, 'থানা / উপজেলা ১০০ অক্ষরের বেশি হতে পারবে না।')
    .trim(),
  district: z
    .string()
    .min(2, 'জেলা কমপক্ষে ২ অক্ষরের হতে হবে।')
    .max(100, 'জেলা ১০০ অক্ষরের বেশি হতে পারবে না।')
    .trim(),
  division: DivisionEnum,
  country: z
    .string()
    .max(100)
    .default('Bangladesh'),
});

/**
 * Zod validation schema for School Branding & Assets.
 */
export const SchoolBrandingUpdateSchema = z.object({
  logoUrl: z
    .string()
    .url('সঠিক লোগো URL লিখুন।')
    .max(1000, 'URL ১০০০ অক্ষরের বেশি হতে পারবে না।')
    .optional()
    .nullable()
    .or(z.literal('')),
  faviconUrl: z
    .string()
    .url('সঠিক ফেভিকন URL লিখুন।')
    .max(1000, 'URL ১০০০ অক্ষরের বেশি হতে পারবে না।')
    .optional()
    .nullable()
    .or(z.literal('')),
  monogramUrl: z
    .string()
    .url('সঠিক মনোগ্রাম URL লিখুন।')
    .max(1000, 'URL ১০০০ অক্ষরের বেশি হতে পারবে না।')
    .optional()
    .nullable()
    .or(z.literal('')),
  principalSignatureUrl: z
    .string()
    .url('সঠিক অধ্যক্ষের স্বাক্ষর URL লিখুন।')
    .max(1000, 'URL ১০০০ অক্ষরের বেশি হতে পারবে না।')
    .optional()
    .nullable()
    .or(z.literal('')),
  headmasterSignatureUrl: z
    .string()
    .url('সঠিক প্রধান শিক্ষকের স্বাক্ষর URL লিখুন।')
    .max(1000, 'URL ১০০০ অক্ষরের বেশি হতে পারবে না।')
    .optional()
    .nullable()
    .or(z.literal('')),
  officialSealUrl: z
    .string()
    .url('সঠিক অফিসিয়াল সিল URL লিখুন।')
    .max(1000, 'URL ১০০০ অক্ষরের বেশি হতে পারবে না।')
    .optional()
    .nullable()
    .or(z.literal('')),
  primaryColor: z
    .string()
    .regex(hexColorRegex, 'সঠিক হেক্স কালার কোড লিখুন (যেমন: #166534)।')
    .default('#166534'),
  secondaryColor: z
    .string()
    .regex(hexColorRegex, 'সঠিক হেক্স কালার কোড লিখুন (যেমন: #0f172a)।')
    .default('#0f172a'),
  accentColor: z
    .string()
    .regex(hexColorRegex, 'সঠিক হেক্স কালার কোড লিখুন (যেমন: #eab308)।')
    .default('#eab308'),
  idCardTemplate: z
    .string()
    .max(50)
    .default('CLASSIC_CLEAN'),
  reportCardTemplate: z
    .string()
    .max(50)
    .default('BANGLADESH_STANDARD'),
});

/**
 * Combined Schema for Full and Partial School Settings Updates.
 */
export const SchoolSettingsUpdateSchema = z.object({
  profile: SchoolProfileUpdateSchema.partial().optional(),
  address: SchoolAddressUpdateSchema.partial().optional(),
  branding: SchoolBrandingUpdateSchema.partial().optional(),
});

export type SchoolProfileUpdateInput = z.infer<typeof SchoolProfileUpdateSchema>;
export type SchoolAddressUpdateInput = z.infer<typeof SchoolAddressUpdateSchema>;
export type SchoolBrandingUpdateInput = z.infer<typeof SchoolBrandingUpdateSchema>;
export type SchoolSettingsUpdateInput = z.infer<typeof SchoolSettingsUpdateSchema>;
