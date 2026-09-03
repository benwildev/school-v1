import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requirePermission } from '@/lib/authorization/engine';
import { withTenantContext } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';
import { CampusUpdateSchema } from '@/lib/validation/campus';

const CAMPUS_SELECT = {
  id: true,
  schoolId: true,
  code: true,
  nameEn: true,
  nameBn: true,
  phone: true,
  email: true,
  principalName: true,
  isMainBranch: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * GET /api/school/campuses/[campusId]
 * Retrieves a single campus belonging to the authenticated user's active school.
 *
 * Required Permission: SETTINGS_VIEW
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ campusId: string }> }
) {
  try {
    const { campusId } = await params;
    const { schoolId } = await requirePermission(req, {
      permission: 'SETTINGS_VIEW',
      resourceContext: { targetCampusId: campusId },
    });

    const campus = await withTenantContext(schoolId, async (tx) => {
      return tx.campus.findFirst({
        where: { id: campusId, schoolId, deletedAt: null },
        select: CAMPUS_SELECT,
      });
    });

    if (!campus) {
      return NextResponse.json(
        { success: false, error: 'ক্যাম্পাস খুঁজে পাওয়া যায়নি।' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: campus });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (err.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ success: false, error: err.message.replace('FORBIDDEN: ', '') }, { status: 403 });
    }

    console.error('GET /api/school/campuses/[campusId] error:', error);
    return NextResponse.json(
      { success: false, error: 'ক্যাম্পাসের তথ্য লোড করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/school/campuses/[campusId]
 * Performs a partial update (including activate/deactivate) on a campus
 * belonging to the authenticated user's active school.
 *
 * Required Permission: SETTINGS_UPDATE
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ campusId: string }> }
) {
  try {
    const { campusId } = await params;
    const { context, schoolId } = await requirePermission(req, {
      permission: 'SETTINGS_UPDATE',
      resourceContext: { targetCampusId: campusId },
    });

    const bodyJson = await req.json();
    const parseResult = CampusUpdateSchema.safeParse(bodyJson);

    if (!parseResult.success) {
      const issueMessages = parseResult.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed: ' + issueMessages,
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const input = parseResult.data;
    if (Object.keys(input).length === 0) {
      return NextResponse.json(
        { success: false, error: 'হালনাগাদ করার জন্য কোনো তথ্য দেওয়া হয়নি।' },
        { status: 400 }
      );
    }

    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    try {
      const result = await withTenantContext(schoolId, async (tx) => {
        const beforeState = await tx.campus.findFirst({
          where: { id: campusId, schoolId, deletedAt: null },
        });

        if (!beforeState) {
          return null;
        }

        const updatePayload: Prisma.CampusUpdateInput = {};
        if (input.code !== undefined) updatePayload.code = input.code;
        if (input.nameEn !== undefined) updatePayload.nameEn = input.nameEn;
        if (input.nameBn !== undefined) updatePayload.nameBn = input.nameBn;
        if (input.phone !== undefined) updatePayload.phone = input.phone || null;
        if (input.email !== undefined) updatePayload.email = input.email || null;
        if (input.principalName !== undefined) updatePayload.principalName = input.principalName || null;
        if (input.isMainBranch !== undefined) updatePayload.isMainBranch = input.isMainBranch;
        if (input.status !== undefined) updatePayload.status = input.status;

        const afterState = await tx.campus.update({
          where: { id: campusId, schoolId },
          data: updatePayload,
          select: CAMPUS_SELECT,
        });

        await logAuditEvent({
          schoolId,
          actorUserId: context.userId,
          actorName: context.user.fullName,
          actorRole: 'ADMIN',
          action: 'UPDATE',
          entity: 'Campus',
          entityId: campusId,
          beforeState,
          afterState,
          changeSummary: `Updated campus fields: ${Object.keys(updatePayload).join(', ')}`,
          ipAddress: clientIp,
          userAgent,
        });

        return afterState;
      });

      if (!result) {
        return NextResponse.json(
          { success: false, error: 'ক্যাম্পাস খুঁজে পাওয়া যায়নি।' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'ক্যাম্পাসের তথ্য সফলভাবে হালনাগাদ করা হয়েছে।',
        data: result,
      });
    } catch (dbError: unknown) {
      if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2002') {
        return NextResponse.json(
          { success: false, error: 'এই ক্যাম্পাস কোড ইতিমধ্যে ব্যবহৃত হয়েছে। ভিন্ন কোড ব্যবহার করুন।' },
          { status: 409 }
        );
      }
      throw dbError;
    }
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (err.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ success: false, error: err.message.replace('FORBIDDEN: ', '') }, { status: 403 });
    }

    console.error('PATCH /api/school/campuses/[campusId] error:', error);
    return NextResponse.json(
      { success: false, error: 'ক্যাম্পাসের তথ্য হালনাগাদ করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
