import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';

/**
 * POST /api/school/accounts/students/[studentId]/revoke
 * Revokes portal access for a student:
 * 1. Sets pending invitations to REVOKED.
 * 2. Deletes student_users join record (unlinks student from User).
 * 3. Sets associated User.status = INACTIVE.
 * 4. Permanently preserves Student profile, studentCode, enrollments, and academic history.
 * Required Permission: STUDENT_ACCOUNTS_REVOKE
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;

  try {
    const auth = await requirePermission(request, {
      permission: 'STUDENT_ACCOUNTS_REVOKE',
    });
    const schoolId = auth.schoolId;

    const result = await withTenantContext(schoolId, async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: studentId, schoolId },
        include: {
          studentUser: true,
        },
      });

      if (!student) {
        return { error: 'শিক্ষার্থী খুঁজে পাওয়া যায়নি।', status: 404 };
      }

      // Revoke pending invitations
      const revokedInvitations = await tx.accountInvitation.updateMany({
        where: {
          schoolId,
          studentId,
          status: 'PENDING',
        },
        data: {
          status: 'REVOKED',
        },
      });

      let userRevoked = false;
      if (student.studentUser) {
        const userId = student.studentUser.userId;

        // Delete student_users link
        await tx.studentUser.delete({
          where: { studentId: student.id },
        });

        // Deactivate User account
        await tx.user.update({
          where: { id: userId },
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
        entity: 'STUDENT_ACCOUNT',
        entityId: student.id,
        changeSummary: `Revoked portal access for student ${student.fullNameEn} [${student.studentCode}] (unlinked user=${userRevoked}, revoked invitations=${revokedInvitations.count})`,
      });

      return {
        data: {
          studentId: student.id,
          studentCode: student.studentCode,
          studentName: student.fullNameEn,
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
      message: 'শিক্ষার্থীর পোর্টাল অ্যাক্সেস সফলভাবে প্রত্যাহার করা হয়েছে।',
      details: result.data,
    });
  } catch (error: any) {
    if (error?.status === 401 || error?.status === 403) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Error revoking student account:', error);
    return NextResponse.json(
      { success: false, error: 'পোর্টাল অ্যাক্সেস প্রত্যাহার করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
