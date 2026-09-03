import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requirePermission, authorize } from '@/lib/authorization/engine';
import { withTenantContext } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';
import { AcademicSessionCreateSchema, computeSessionStatus } from '@/lib/validation/academic-session';
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
 * GET /api/school/academic-sessions
 * Lists all academic sessions belonging to the authenticated user's active school.
 *
 * Required Permission: ACADEMICS_VIEW
 */
export async function GET(req: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(req, {
      permission: 'ACADEMICS_VIEW',
    });

    const sessions = await withTenantContext(schoolId, async (tx) => {
      return tx.academicSession.findMany({
        where: { schoolId },
        select: SESSION_SELECT,
        orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
      });
    });

    const [createCheck, updateCheck] = await Promise.all([
      authorize({ userId: context.userId, schoolId, permission: 'ACADEMICS_CREATE' }),
      authorize({ userId: context.userId, schoolId, permission: 'ACADEMICS_UPDATE' }),
    ]);

    const data = sessions.map((s) => ({ ...s, status: computeSessionStatus(s) }));

    return NextResponse.json({
      success: true,
      data,
      canCreate: createCheck.authorized,
      canUpdate: updateCheck.authorized,
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (err.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ success: false, error: err.message.replace('FORBIDDEN: ', '') }, { status: 403 });
    }

    console.error('GET /api/school/academic-sessions error:', error);
    return NextResponse.json(
      { success: false, error: 'শিক্ষাবর্ষের তালিকা লোড করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/school/academic-sessions
 * Creates a new academic session under the authenticated user's active school.
 * Optionally activates it immediately (status: "ACTIVE"), which transactionally
 * deactivates any previously active session for the school.
 *
 * Required Permission: ACADEMICS_CREATE
 */
export async function POST(req: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(req, {
      permission: 'ACADEMICS_CREATE',
    });

    const bodyJson = await req.json();
    const parseResult = AcademicSessionCreateSchema.safeParse(bodyJson);

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
        // Create first (without activation flags) so we have a stable ID to
        // exclude from the "deactivate other current sessions" step.
        const session = await tx.academicSession.create({
          data: {
            schoolId,
            name: input.name,
            startDate: new Date(input.startDate),
            endDate: new Date(input.endDate),
            isCurrent: false,
            isLocked: input.status === 'ARCHIVED',
          },
          select: SESSION_SELECT,
        });

        let finalSession = session;
        if (input.status === 'ACTIVE') {
          const patch = await resolveSessionStatusPatch(tx, schoolId, session.id, 'ACTIVE');
          finalSession = await tx.academicSession.update({
            where: { id: session.id, schoolId },
            data: patch,
            select: SESSION_SELECT,
          });
        }

        await logAuditEvent({
          schoolId,
          actorUserId: context.userId,
          actorName: context.user.fullName,
          actorRole: 'ADMIN',
          action: 'INSERT',
          entity: 'AcademicSession',
          entityId: finalSession.id,
          beforeState: null,
          afterState: finalSession,
          changeSummary: `Created academic session "${finalSession.name}"${input.status === 'ACTIVE' ? ' and activated it' : ''}`,
          ipAddress: clientIp,
          userAgent,
        });

        return finalSession;
      });

      return NextResponse.json(
        {
          success: true,
          message: 'নতুন শিক্ষাবর্ষ সফলভাবে যোগ করা হয়েছে।',
          data: { ...created, status: computeSessionStatus(created) },
        },
        { status: 201 }
      );
    } catch (dbError: unknown) {
      if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2002') {
        return NextResponse.json(
          { success: false, error: 'এই নামে একটি শিক্ষাবর্ষ ইতিমধ্যে বিদ্যমান। ভিন্ন নাম ব্যবহার করুন।' },
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

    console.error('POST /api/school/academic-sessions error:', error);
    return NextResponse.json(
      { success: false, error: 'শিক্ষাবর্ষ তৈরি করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
