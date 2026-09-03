import { z } from 'zod';

/**
 * Zod validation schemas for Academic Session management.
 * Mirrors the field set and conventions already established in
 * src/lib/validation/school-settings.ts and src/lib/validation/campus.ts.
 *
 * The underlying `AcademicSession` model has no persisted `status` enum —
 * only `isCurrent` and `isLocked` booleans. Rather than inventing a new
 * schema column, the four-state lifecycle (UPCOMING / ACTIVE / COMPLETED /
 * ARCHIVED) is derived at the application layer from those two existing
 * flags plus the session's date range. See `computeSessionStatus()` below.
 */

const dateStringRegex = /^\d{4}-\d{2}-\d{2}$/;

const dateStringSchema = z
  .string()
  .trim()
  .regex(dateStringRegex, 'সঠিক তারিখ ফরম্যাট লিখুন (YYYY-MM-DD)।')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'সঠিক তারিখ লিখুন।');

/**
 * Full display status, computed from `isCurrent` + `isLocked` + dates.
 * Never persisted, never accepted directly as create/update input.
 */
export const AcademicSessionDisplayStatusEnum = z.enum([
  'UPCOMING',
  'ACTIVE',
  'COMPLETED',
  'ARCHIVED',
]);
export type AcademicSessionDisplayStatus = z.infer<typeof AcademicSessionDisplayStatusEnum>;

/**
 * Status values a client may explicitly request as a lifecycle transition.
 * COMPLETED is intentionally excluded — it is a date-derived state, not an
 * assignable one (there is no dedicated "completed" flag in the schema).
 */
export const AcademicSessionSettableStatusEnum = z.enum(['UPCOMING', 'ACTIVE', 'ARCHIVED']);
export type AcademicSessionSettableStatus = z.infer<typeof AcademicSessionSettableStatusEnum>;

/**
 * Zod validation schema for creating a new Academic Session.
 */
export const AcademicSessionCreateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'শিক্ষাবর্ষের নাম কমপক্ষে ২ অক্ষরের হতে হবে।')
      .max(100, 'শিক্ষাবর্ষের নাম ১০০ অক্ষরের বেশি হতে পারবে না।'),
    startDate: dateStringSchema,
    endDate: dateStringSchema,
    status: AcademicSessionSettableStatusEnum.optional(),
  })
  .refine((data) => new Date(data.startDate).getTime() < new Date(data.endDate).getTime(), {
    message: 'শুরুর তারিখ অবশ্যই শেষের তারিখের আগে হতে হবে।',
    path: ['endDate'],
  });

/**
 * Zod validation schema for partial Academic Session updates (PATCH).
 * Cross-field startDate < endDate validation (when only one of the two is
 * supplied) is performed in the route handler after merging with the
 * existing persisted row, since Zod alone cannot see the unchanged field.
 */
export const AcademicSessionUpdateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'শিক্ষাবর্ষের নাম কমপক্ষে ২ অক্ষরের হতে হবে।')
      .max(100, 'শিক্ষাবর্ষের নাম ১০০ অক্ষরের বেশি হতে পারবে না।')
      .optional(),
    startDate: dateStringSchema.optional(),
    endDate: dateStringSchema.optional(),
    status: AcademicSessionSettableStatusEnum.optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate).getTime() < new Date(data.endDate).getTime();
      }
      return true;
    },
    { message: 'শুরুর তারিখ অবশ্যই শেষের তারিখের আগে হতে হবে।', path: ['endDate'] }
  );

export type AcademicSessionCreateInput = z.infer<typeof AcademicSessionCreateSchema>;
export type AcademicSessionUpdateInput = z.infer<typeof AcademicSessionUpdateSchema>;

/**
 * Derives the display lifecycle status of a session from its persisted
 * `isCurrent` / `isLocked` flags and date range. Pure function, no DB access.
 */
export function computeSessionStatus(session: {
  isCurrent: boolean;
  isLocked: boolean;
  startDate: Date | string;
  endDate: Date | string;
}): AcademicSessionDisplayStatus {
  if (session.isCurrent) return 'ACTIVE';
  if (session.isLocked) return 'ARCHIVED';

  const now = new Date();
  const endDate = new Date(session.endDate);
  return endDate.getTime() < now.getTime() ? 'COMPLETED' : 'UPCOMING';
}
