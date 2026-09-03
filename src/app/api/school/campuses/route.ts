import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requirePermission, authorize } from '@/lib/authorization/engine';
import { withTenantContext } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';
import { CampusCreateSchema } from '@/lib/validation/campus';

/**
 * GET /api/school/campuses
 * Lists all campuses/branches belonging to the authenticated user's active school.
 *
 * Required Permission: SETTINGS_VIEW
 */
export async function GET(req: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(req, {
      permission: 'SETTINGS_VIEW',
    });

    const campuses = await withTenantContext(schoolId, async (tx) => {
      return tx.campus.findMany({
        where: { schoolId, deletedAt: null },
        select: {
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
        },
        orderBy: [{ isMainBranch: 'desc' }, { createdAt: 'asc' }],
      });
    });

    const editCheck = await authorize({
      userId: context.userId,
      schoolId,
      permission: 'SETTINGS_UPDATE',
    });

    return NextResponse.json({ success: true, data: campuses, canEdit: editCheck.authorized });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (err.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ success: false, error: err.message.replace('FORBIDDEN: ', '') }, { status: 403 });
    }

    console.error('GET /api/school/campuses error:', error);
    return NextResponse.json(
      { success: false, error: 'ক্যাম্পাসের তালিকা লোড করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/school/campuses
 * Creates a new campus/branch under the authenticated user's active school.
 *
 * Required Permission: SETTINGS_UPDATE
 */
export async function POST(req: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(req, {
      permission: 'SETTINGS_UPDATE',
    });

    const bodyJson = await req.json();
    const parseResult = CampusCreateSchema.safeParse(bodyJson);

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
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    try {
      const created = await withTenantContext(schoolId, async (tx) => {
        const campus = await tx.campus.create({
          data: {
            schoolId,
            code: input.code,
            nameEn: input.nameEn,
            nameBn: input.nameBn,
            phone: input.phone || null,
            email: input.email || null,
            principalName: input.principalName || null,
            isMainBranch: input.isMainBranch ?? false,
            status: input.status ?? 'ACTIVE',
          },
        });

        await logAuditEvent({
          schoolId,
          actorUserId: context.userId,
          actorName: context.user.fullName,
          actorRole: 'ADMIN',
          action: 'INSERT',
          entity: 'Campus',
          entityId: campus.id,
          beforeState: null,
          afterState: campus,
          changeSummary: `Created campus "${campus.nameBn}" (${campus.code})`,
          ipAddress: clientIp,
          userAgent,
        });

        return campus;
      });

      return NextResponse.json(
        {
          success: true,
          message: 'নতুন ক্যাম্পাস সফলভাবে যোগ করা হয়েছে।',
          data: created,
        },
        { status: 201 }
      );
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

    console.error('POST /api/school/campuses error:', error);
    return NextResponse.json(
      { success: false, error: 'ক্যাম্পাস তৈরি করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
