import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma, withTenantContext } from '@/lib/db';
import { hashPassword } from '@/lib/auth/crypto';
import { logAuditEvent } from '@/lib/audit/logger';
import { AcceptInvitationSchema } from '@/lib/validation/account';
import {
  checkInvitationThrottle,
  recordInvitationFailure,
  clearInvitationThrottle,
} from '@/lib/security/invitation-throttle';

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

/**
 * POST /api/public/schools/[schoolSlug]/invitations/accept
 * Public endpoint to accept an invitation, set a password, and link/create the portal User account.
 * Multi-dimensional rate-limited by IP + School Slug.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ schoolSlug: string }> }
) {
  const { schoolSlug } = await params;
  const clientIp = getClientIp(request);

  // 1. Check Rate Limiter
  const throttle = await checkInvitationThrottle(clientIp, schoolSlug);
  if (throttle.isBlocked) {
    return NextResponse.json(
      {
        success: false,
        error: 'অতিরিক্ত ব্যর্থ চেষ্টার কারণে আমন্ত্রণ গ্রহণ সাময়িকভাবে বন্ধ আছে। ১৫ মিনিট পর আবার চেষ্টা করুন।',
      },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'অবৈধ JSON বডি পাঠানো হয়েছে।' },
      { status: 400 }
    );
  }

  const validation = AcceptInvitationSchema.safeParse(body);
  if (!validation.success) {
    await recordInvitationFailure(clientIp, schoolSlug);
    return NextResponse.json(
      {
        success: false,
        error: 'ফর্ম ইনপুট সঠিক নয়। পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।',
        details: validation.error.flatten(),
      },
      { status: 422 }
    );
  }

  const { token, password, fullName, email } = validation.data;

  try {
    const school = await prisma.school.findUnique({
      where: { slug: schoolSlug, status: 'ACTIVE', deletedAt: null },
      select: { id: true, slug: true, nameEn: true },
    });

    if (!school) {
      await recordInvitationFailure(clientIp, schoolSlug);
      return NextResponse.json(
        { success: false, error: 'আমন্ত্রণ কোডটি সঠিক নয় বা মেয়াদ শেষ হয়ে গেছে।' },
        { status: 404 }
      );
    }

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const result = await withTenantContext(school.id, async (tx) => {
      // Find invitation inside tenant
      const invitation = await tx.accountInvitation.findFirst({
        where: {
          schoolId: school.id,
          tokenHash,
        },
        include: {
          guardian: true,
          student: true,
        },
      });

      if (!invitation) {
        return { error: 'আমন্ত্রণ কোডটি সঠিক নয়।', status: 404 };
      }

      if (invitation.status === 'ACCEPTED') {
        return { error: 'এই আমন্ত্রণ কোডটি ইতিমধ্যে ব্যবহার করা হয়েছে।', status: 409 };
      }

      if (invitation.status === 'REVOKED') {
        return { error: 'এই আমন্ত্রণ কোডটি বাতিল করা হয়েছে। বিদ্যালয় কর্তৃপক্ষের সাথে যোগাযোগ করুন।', status: 410 };
      }

      if (invitation.expiresAt < new Date()) {
        return { error: 'আমন্ত্রণ কোডের মেয়াদ শেষ হয়ে গেছে।', status: 410 };
      }

      // Hash password using 12 salt rounds bcrypt
      const passwordHash = await hashPassword(password);

      // Determine default name
      let accountName = fullName?.trim();
      if (!accountName) {
        if (invitation.targetType === 'GUARDIAN' && invitation.guardian) {
          accountName = invitation.guardian.fullNameEn;
        } else if (invitation.targetType === 'STUDENT' && invitation.student) {
          accountName = invitation.student.fullNameEn;
        } else {
          accountName = 'Portal User';
        }
      }

      // Check if User already exists for this phone in this school
      let user = await tx.user.findFirst({
        where: {
          schoolId: school.id,
          phone: invitation.recipientPhone,
        },
      });

      if (user) {
        // Update existing user password and activate
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            passwordHash,
            status: 'ACTIVE',
            email: email || user.email || invitation.recipientEmail,
            fullName: accountName || user.fullName,
          },
        });
      } else {
        // Create new user
        user = await tx.user.create({
          data: {
            schoolId: school.id,
            phone: invitation.recipientPhone,
            email: email || invitation.recipientEmail || null,
            passwordHash,
            fullName: accountName,
            status: 'ACTIVE',
          },
        });
      }

      // Assign system role (PARENT or STUDENT)
      const targetRoleCode = invitation.targetType === 'GUARDIAN' ? 'PARENT' : 'STUDENT';
      const role = await tx.role.findFirst({
        where: {
          code: targetRoleCode,
          OR: [{ schoolId: school.id }, { schoolId: null }],
        },
      });

      if (role) {
        const existingUserRole = await tx.userRole.findFirst({
          where: {
            userId: user.id,
            roleId: role.id,
          },
        });

        if (!existingUserRole) {
          await tx.userRole.create({
            data: {
              userId: user.id,
              roleId: role.id,
            },
          });
        }
      }

      // Link domain identity
      if (invitation.targetType === 'GUARDIAN' && invitation.guardianId) {
        await tx.guardian.update({
          where: { id: invitation.guardianId },
          data: { userId: user.id },
        });
      } else if (invitation.targetType === 'STUDENT' && invitation.studentId) {
        await tx.studentUser.upsert({
          where: { studentId: invitation.studentId },
          create: {
            schoolId: school.id,
            studentId: invitation.studentId,
            userId: user.id,
          },
          update: {
            userId: user.id,
          },
        });
      }

      // Mark invitation as ACCEPTED
      await tx.accountInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          acceptedByUserId: user.id,
        },
      });

      // Forensic audit log
      await logAuditEvent({
        schoolId: school.id,
        actorUserId: user.id,
        actorName: user.fullName,
        actorRole: targetRoleCode,
        actorType: 'USER',
        action: 'UPDATE',
        entity: 'ACCOUNT_INVITATION',
        entityId: invitation.id,
        changeSummary: `Portal invitation accepted for ${invitation.targetType}: ${user.fullName} (${user.phone})`,
      });

      return {
        data: {
          userId: user.id,
          targetType: invitation.targetType,
          fullName: user.fullName,
          phone: user.phone,
        },
        status: 200,
      };
    });

    if ('error' in result) {
      await recordInvitationFailure(clientIp, schoolSlug);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      );
    }

    // Clear throttle on success
    await clearInvitationThrottle(clientIp, schoolSlug);

    return NextResponse.json({
      success: true,
      message: 'পোর্টাল অ্যাকাউন্ট সফলভাবে তৈরি ও সক্রিয় হয়েছে! আপনি এখন লগইন করতে পারেন।',
      user: result.data,
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json(
      { success: false, error: 'আমন্ত্রণ গ্রহণে ত্রুটি হয়েছে। পুনরায় চেষ্টা করুন।' },
      { status: 500 }
    );
  }
}
