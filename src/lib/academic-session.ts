import { PrismaClient } from '@prisma/client';
import { AcademicSessionSettableStatus } from './validation/academic-session';

/**
 * Resolves the `isCurrent` / `isLocked` field patch for a requested lifecycle
 * status transition, and — when activating — deactivates any other currently
 * active session for the school within the same transaction.
 *
 * Must always be called from inside the interactive transaction supplied by
 * withTenantContext(), so the deactivation of the previous active session and
 * the activation of the target session are atomic. The database-level
 * partial unique index `uq_one_current_session_per_school`
 * (ON academic_sessions (school_id) WHERE is_current = TRUE) is the final,
 * authoritative guard: even if two concurrent requests both attempt to
 * activate different sessions, only one transaction can successfully commit
 * an `isCurrent = true` row per school — the other fails with a unique
 * constraint violation and its entire transaction rolls back.
 */
export async function resolveSessionStatusPatch(
  tx: PrismaClient,
  schoolId: string,
  sessionId: string,
  status: AcademicSessionSettableStatus
): Promise<{ isCurrent: boolean; isLocked: boolean }> {
  if (status === 'ACTIVE') {
    await tx.academicSession.updateMany({
      where: { schoolId, isCurrent: true, NOT: { id: sessionId } },
      data: { isCurrent: false },
    });
    return { isCurrent: true, isLocked: false };
  }

  if (status === 'ARCHIVED') {
    return { isCurrent: false, isLocked: true };
  }

  // UPCOMING: explicit revert to the un-activated, un-locked default state.
  return { isCurrent: false, isLocked: false };
}
