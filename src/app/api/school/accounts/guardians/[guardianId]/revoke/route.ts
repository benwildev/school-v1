import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';

/**
 * POST /api/school/accounts/guardians/[guardianId]/revoke
 * Revokes portal access for a guardian:
 * 1. Sets pending invitations to REVOKED.
 * 2. Unlinks guardian.userId = null.
 * 3. Sets associated User.status = INACTIVE.
 * 4. Permanently preserves Guardian profile, Student records, and StudentGuardian links.
 * Required Permission: PARENT_ACCOUNTS_REVOKE
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guardianId: string }> }
) {
  const { guardianId } = await params;

  try {
    const auth = await requirePermission(request, {
      permission: 'PARENT_ACCOUNTS_REVOKE',
    });
    const schoolId = auth.schoolId;

    const result = await withTenantContext(schoolId, async (tx) => {
      const guardian = await tx.guardian.findFirst({
        where: { id: guardianId, schoolId },
      });

      if (!guardian) {
        return { error: 'অভিভাবক খুঁজে পাওয়া যায়নি।', status: 404 };
      }

      // Revoke pending invitations
      const revokedInvitations = await tx.accountInvitation.updateMany({
        where: {
          schoolId,
          guardianId,
          status: 'PENDING',
        },
        data: {
          status: 'REVOKED',
        },
      });

      let userRevoked = false;
      if (guardian.userId) {
        // Disconnect guardian from User
        await tx.guardian.update({
          where: { id: guardian.id },
          data: { userId: null },
        });

        // Deactivate User account
        await tx.user.update({
          where: { id: guardian.userId },
          data: { status: 'INACTIVE' },
        });

        userRevoked = true;
      }

      // Forensic audit log
      await logAuditEvent({
        schoolId,
        actorUserId: auth.context.userId,
        actorName: auth.context.user.fullName || 'Staff User',
        actorRole: auth.context.user.isSuperAdmin ? 'SUPERADMIN' : 'ADMIN',
        action: 'UPDATE',
        entity: 'GUARDIAN_ACCOUNT',
        entityId: guardian.id,
        changeSummary: `Revoked portal access for guardian ${guardian.fullNameEn} (unlinked user=${userRevoked}, revoked invitations=${revokedInvitations.count})`,
      });

      return {
        data: {
          guardianId: guardian.id,
          guardianName: guardian.fullNameEn,
          revokedInvitationsCount: revokedInvitations.count,
          accountUnlinked: userRevoked,
        },
        status: 200,
      };
    });

    if ('error' in result) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'অভিভাবকের পোর্টাল অ্যাক্সেস সফলভাবে প্রত্যাহার করা হয়েছে।',
      details: result.data,
    });
  } catch (error: any) {
    if (error?.status === 401 || error?.status === 403) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Error revoking guardian account:', error);
    return NextResponse.json(
      { success: false, error: 'পোর্টাল অ্যাক্সেস প্রত্যাহার করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
