import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requirePermission } from '@/lib/authorization/engine';
import { withTenantContext } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';
import { AcademicSessionUpdateSchema, computeSessionStatus } from '@/lib/validation/academic-session';
import { resolveSessionStatusPatch } from '@/lib/academic-session';

const SESSION_SELECT = {
  id: true,
  schoolId: true,
  name: true,
  startDate: true,
  endDate: true,
  isCurrent: true,
  isLocked: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * GET /api/school/academic-sessions/[sessionId]
 * Retrieves a single academic session belonging to the authenticated user's active school.
 *
 * Required Permission: ACADEMICS_VIEW
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { schoolId } = await requirePermission(req, {
      permission: 'ACADEMICS_VIEW',
    });

    const session = await withTenantContext(schoolId, async (tx) => {
      return tx.academicSession.findFirst({
        where: { id: sessionId, schoolId },
        select: SESSION_SELECT,
      });
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'শিক্ষাবর্ষ খুঁজে পাওয়া যায়নি।' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: { ...session, status: computeSessionStatus(session) } });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (err.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ success: false, error: err.message.replace('FORBIDDEN: ', '') }, { status: 403 });
    }

    console.error('GET /api/school/academic-sessions/[sessionId] error:', error);
    return NextResponse.json(
      { success: false, error: 'শিক্ষাবর্ষের তথ্য লোড করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/school/academic-sessions/[sessionId]
 * Performs a partial update on an academic session belonging to the
 * authenticated user's active school, including lifecycle transitions:
 *   status: "ACTIVE"   -> activates this session, transactionally deactivating
 *                         any other currently active session for the school.
 *   status: "ARCHIVED" -> locks and deactivates the session (historical data
 *                         referencing it is never deleted).
 *   status: "UPCOMING" -> reverts to the un-activated, un-locked default state.
 *
 * Required Permission: ACADEMICS_UPDATE
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { context, schoolId } = await requirePermission(req, {
      permission: 'ACADEMICS_UPDATE',
    });

    const bodyJson = await req.json();
    const parseResult = AcademicSessionUpdateSchema.safeParse(bodyJson);

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
        const beforeState = await tx.academicSession.findFirst({
          where: { id: sessionId, schoolId },
        });

        if (!beforeState) {
          return null;
        }

        // Cross-field date-range validation against the merged (existing + incoming) state.
        const nextStartDate = input.startDate ? new Date(input.startDate) : beforeState.startDate;
        const nextEndDate = input.endDate ? new Date(input.endDate) : beforeState.endDate;
        if (nextStartDate.getTime() >= nextEndDate.getTime()) {
          return 'INVALID_RANGE' as const;
        }

        const updatePayload: Prisma.AcademicSessionUpdateInput = {};
        if (input.name !== undefined) updatePayload.name = input.name;
        if (input.startDate !== undefined) updatePayload.startDate = nextStartDate;
        if (input.endDate !== undefined) updatePayload.endDate = nextEndDate;

        let changeSummary = `Updated academic session fields: ${Object.keys(updatePayload).join(', ') || 'none'}`;

        if (input.status !== undefined) {
          const patch = await resolveSessionStatusPatch(tx, schoolId, sessionId, input.status);
          updatePayload.isCurrent = patch.isCurrent;
          updatePayload.isLocked = patch.isLocked;
          changeSummary =
            input.status === 'ACTIVE'
              ? `Activated academic session "${beforeState.name}"`
              : input.status === 'ARCHIVED'
                ? `Archived academic session "${beforeState.name}"`
                : `Reverted academic session "${beforeState.name}" to upcoming/inactive state`;
        }

        const afterState = await tx.academicSession.update({
          where: { id: sessionId, schoolId },
          data: updatePayload,
          select: SESSION_SELECT,
        });

        await logAuditEvent({
          schoolId,
          actorUserId: context.userId,
          actorName: context.user.fullName,
          actorRole: 'ADMIN',
          action: 'UPDATE',
          entity: 'AcademicSession',
          entityId: sessionId,
          beforeState,
          afterState,
          changeSummary,
          ipAddress: clientIp,
          userAgent,
        });

        return afterState;
      });

      if (result === null) {
        return NextResponse.json(
          { success: false, error: 'শিক্ষাবর্ষ খুঁজে পাওয়া যায়নি।' },
          { status: 404 }
        );
      }

      if (result === 'INVALID_RANGE') {
        return NextResponse.json(
          { success: false, error: 'শুরুর তারিখ অবশ্যই শেষের তারিখের আগে হতে হবে।' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'শিক্ষাবর্ষের তথ্য সফলভাবে হালনাগাদ করা হয়েছে।',
        data: { ...result, status: computeSessionStatus(result) },
      });
    } catch (dbError: unknown) {
      if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2002') {
        return NextResponse.json(
          {
            success: false,
            error:
              'এই পরিবর্তন সাংঘর্ষিক একটি ইউনিক শর্ত লঙ্ঘন করে (যেমন নাম পুনরাবৃত্তি অথবা একাধিক সক্রিয় শিক্ষাবর্ষ)। আবার চেষ্টা করুন।',
          },
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

    console.error('PATCH /api/school/academic-sessions/[sessionId] error:', error);
    return NextResponse.json(
      { success: false, error: 'শিক্ষাবর্ষের তথ্য হালনাগাদ করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
