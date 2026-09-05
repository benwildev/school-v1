import { z } from 'zod';
import { GuardianRelation } from '@prisma/client';

export const StudentGuardianCreateSchema = z.object({
  studentId: z.string().uuid('অবৈধ শিক্ষার্থী আইডি (UUID প্রয়োজন)'),
  guardianId: z.string().uuid('অবৈধ অভিভাবক আইডি (UUID প্রয়োজন)'),
  relationshipType: z.nativeEnum(GuardianRelation).optional().nullable(),
  isPrimary: z.boolean().default(false),
  isFinancialPayer: z.boolean().default(false),
  canPickUp: z.boolean().default(true),
});

export const StudentGuardianUpdateSchema = z.object({
  relationshipType: z.nativeEnum(GuardianRelation).optional().nullable(),
  isPrimary: z.boolean().optional(),
  isFinancialPayer: z.boolean().optional(),
  canPickUp: z.boolean().optional(),
});

export type StudentGuardianCreateInput = z.infer<typeof StudentGuardianCreateSchema>;
export type StudentGuardianUpdateInput = z.infer<typeof StudentGuardianUpdateSchema>;
