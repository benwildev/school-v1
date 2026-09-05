import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
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

function maskPhone(phone: string): string {
  if (phone.length < 6) return phone;
  return `${phone.slice(0, 3)}*****${phone.slice(-3)}`;
}

/**
 * GET /api/public/schools/[schoolSlug]/invitations/verify?token=...
 * Validates an invitation token for a school and returns minimal safe verification info.
 * Multi-dimensional rate-limited by IP + School Slug.
 */
export async function GET(
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
        error: 'অতিরিক্ত ব্যর্থ চেষ্টার কারণে আমন্ত্রণ যাচাই সাময়িকভাবে বন্ধ আছে। ১৫ মিনিট পর আবার চেষ্টা করুন।',
      },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token || token.trim().length < 8) {
    await recordInvitationFailure(clientIp, schoolSlug);
    return NextResponse.json(
      { success: false, error: 'আমন্ত্রণ কোডটি আবশ্যক।' },
      { status: 400 }
    );
  }

  try {
    const school = await prisma.school.findUnique({
      where: { slug: schoolSlug, status: 'ACTIVE', deletedAt: null },
      select: { id: true, nameEn: true, nameBn: true, slug: true },
    });

    if (!school) {
      await recordInvitationFailure(clientIp, schoolSlug);
      return NextResponse.json(
        { success: false, error: 'আমন্ত্রণ কোডটি সঠিক নয় বা মেয়াদ শেষ হয়ে গেছে।' },
        { status: 404 }
      );
    }

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const invitation = await prisma.accountInvitation.findFirst({
      where: {
        schoolId: school.id,
        tokenHash,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      include: {
        guardian: {
          select: {
            fullNameEn: true,
            fullNameBn: true,
            relationType: true,
          },
        },
        student: {
          select: {
            fullNameEn: true,
            fullNameBn: true,
            studentCode: true,
          },
        },
      },
    });

    if (!invitation) {
      await recordInvitationFailure(clientIp, schoolSlug);
      return NextResponse.json(
        { success: false, error: 'আমন্ত্রণ কোডটি সঠিক নয় বা মেয়াদ শেষ হয়ে গেছে।' },
        { status: 404 }
      );
    }

    // Reset throttle on valid token check
    await clearInvitationThrottle(clientIp, schoolSlug);

    const targetName =
      invitation.targetType === 'GUARDIAN'
        ? invitation.guardian?.fullNameBn || invitation.guardian?.fullNameEn || 'অভিভাবক'
        : invitation.student?.fullNameBn || invitation.student?.fullNameEn || 'শিক্ষার্থী';

    return NextResponse.json({
      success: true,
      data: {
        targetType: invitation.targetType,
        targetName,
        recipientPhone: maskPhone(invitation.recipientPhone),
        expiresAt: invitation.expiresAt,
        schoolNameEn: school.nameEn,
        schoolNameBn: school.nameBn,
      },
    });
  } catch (error) {
    console.error('Error verifying invitation token:', error);
    return NextResponse.json(
      { success: false, error: 'আমন্ত্রণ যাচাই করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
