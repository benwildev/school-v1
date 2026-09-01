import { z } from 'zod';

export const LoginInputSchema = z.object({
  identifier: z
    .string()
    .min(3, 'Identifier must be at least 3 characters.')
    .max(255, 'Identifier cannot exceed 255 characters.')
    .trim(),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters.')
    .max(100, 'Password cannot exceed 100 characters.'),
  requestedSchoolId: z.string().uuid('Invalid school UUID format.').optional().nullable(),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;

export const SwitchSchoolInputSchema = z.object({
  schoolId: z.string().uuid('Invalid school UUID format.'),
});

export type SwitchSchoolInput = z.infer<typeof SwitchSchoolInputSchema>;

export const AssignRoleInputSchema = z.object({
  userId: z.string().uuid('Invalid user UUID format.'),
  roleId: z.string().uuid('Invalid role UUID format.'),
  campusId: z.string().uuid('Invalid campus UUID format.').optional().nullable(),
});

export type AssignRoleInput = z.infer<typeof AssignRoleInputSchema>;

export const CreateCustomRoleInputSchema = z.object({
  code: z
    .string()
    .min(2, 'Role code must be at least 2 characters.')
    .max(50, 'Role code cannot exceed 50 characters.')
    .regex(/^[A-Z0-9_]+$/, 'Role code must contain only uppercase letters, numbers, and underscores.')
    .trim(),
  name: z.string().min(2).max(100).trim(),
  description: z.string().max(500).optional().nullable(),
  permissions: z.array(
    z.object({
      permissionCode: z.string(),
      scope: z.enum([
        'ENTIRE_SCHOOL',
        'OWN_CAMPUS',
        'ASSIGNED_CLASSES',
        'ASSIGNED_SUBJECTS',
        'OWN_STUDENTS',
        'OWN_CHILDREN',
        'OWN_DATA',
      ]),
    })
  ),
});

export type CreateCustomRoleInput = z.infer<typeof CreateCustomRoleInputSchema>;
