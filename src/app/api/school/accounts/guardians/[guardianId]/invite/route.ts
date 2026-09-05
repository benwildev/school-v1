import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { CreateInvitationSchema } from '@/lib/validation/account';

/**
 * POST /api/school/accounts/guardians/[guardianId]/invite
 * Creates and issues a cryptographically random, high-entropy invitation token for a guardian.
 * Required Permission: PARENT_ACCOUNTS_INVITE
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guardianId: string }> }
) {
  const { guardianId } = await params;

  try {
    const auth = await requirePermission(request, {
      permission: 'PARENT_ACCOUNTS_INVITE',
    });
    const schoolId = auth.schoolId;

    let body = {};
    try {
      body = await request.json();
    } catch {
      // Body is optional
    }

    const result = await withTenantContext(schoolId, async (tx) => {
      const guardian = await tx.guardian.findFirst({
        where: { id: guardianId, schoolId },
        include: { user: true },
      });

      if (!guardian) {
        return { error: 'অভিভাবক খুঁজে পাওয়া যায়নি।', status: 404 };
      }

      if (guardian.userId && guardian.user?.status === 'ACTIVE') {
        return {
          error: 'এই অভিভাবকের ইতিমধ্যে সক্রিয় পোর্টাল অ্যাকাউন্ট রয়েছে।',
          status: 400,
        };
      }

      const inputPayload = {
        recipientPhone: (body as any).recipientPhone || guardian.phone,
        recipientEmail: (body as any).recipientEmail || guardian.email || undefined,
        expiresInHours: (body as any).expiresInHours || 72,
      };

      const validation = CreateInvitationSchema.safeParse(inputPayload);
      if (!validation.success) {
        return {
          error: 'অবৈধ আমন্ত্রণ তথ্য।',
          details: validation.error.flatten(),
          status: 422,
        };
      }

      const { recipientPhone, recipientEmail, expiresInHours } = validation.data;

      // Invalidate existing pending invitations for this guardian
      await tx.accountInvitation.updateMany({
        where: {
          schoolId,
          guardianId,
          status: 'PENDING',
        },
        data: {
          status: 'REVOKED',
        },
      });

      // Generate cryptographically secure token (48 hex chars = 192 bits of entropy)
      const rawToken = `INV-${crypto.randomBytes(24).toString('hex').toUpperCase()}`;
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

      const invitation = await tx.accountInvitation.create({
        data: {
          schoolId,
          targetType: 'GUARDIAN',
          guardianId,
          tokenHash,
          recipientPhone,
          recipientEmail: recipientEmail || null,
          status: 'PENDING',
          expiresAt,
          createdById: auth.context.userId,
        },
      });

      // Forensic audit log
      await logAuditEvent({
        schoolId,
        actorUserId: auth.context.userId,
        actorName: auth.context.user.fullName || 'Staff User',
        actorRole: auth.context.user.isSuperAdmin ? 'SUPERADMIN' : 'ADMIN',
        action: 'INSERT',
        entity: 'ACCOUNT_INVITATION',
        entityId: invitation.id,
        changeSummary: `Created guardian account invitation for ${guardian.fullNameEn} (${guardian.phone})`,
      });

      return {
        data: {
          id: invitation.id,
          targetType: invitation.targetType,
          guardianId: guardian.id,
          guardianName: guardian.fullNameEn,
          recipientPhone,
          recipientEmail,
          token: rawToken, // Provided once to staff for distribution / copy-link
          expiresAt: invitation.expiresAt,
          createdAt: invitation.createdAt,
        },
        status: 201,
      };
    });

    if ('error' in result) {
      return NextResponse.json(
        { success: false, error: result.error, details: result.details },
        { status: result.status }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'অভিভাবক আমন্ত্রণ সফলভাবে তৈরি হয়েছে।',
        invitation: result.data,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error?.status === 401 || error?.status === 403) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Error inviting guardian:', error);
    return NextResponse.json(
      { success: false, error: 'আমন্ত্রণ তৈরিতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
