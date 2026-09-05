import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requirePermission, authorize } from '@/lib/authorization/engine';
import { withTenantContext } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';
import { AcademicGroupCreateSchema } from '@/lib/validation/academic-structure';

/**
 * GET /api/school/academic-structure/groups
 * Lists all academic groups (e.g. Science, Commerce, Humanities) for the school.
 *
 * Required Permission: ACADEMICS_VIEW
 */
export async function GET(req: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(req, {
      permission: 'ACADEMICS_VIEW',
    });

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status');

    const groups = await withTenantContext(schoolId, async (tx) => {
      const whereClause: Prisma.AcademicGroupWhereInput = { schoolId };
      if (statusFilter && statusFilter !== 'ALL') {
        whereClause.status = statusFilter as Prisma.EnumRecordStatusFilter['equals'];
      }

      return tx.academicGroup.findMany({
        where: whereClause,
        include: {
          _count: {
            select: {
              sections: true,
              subjects: true,
              enrollments: true,
            },
          },
        },
        orderBy: [{ code: 'asc' }],
      });
    });

    const [createCheck, updateCheck, deleteCheck] = await Promise.all([
      authorize({ userId: context.userId, schoolId, permission: 'ACADEMICS_CREATE' }),
      authorize({ userId: context.userId, schoolId, permission: 'ACADEMICS_UPDATE' }),
      authorize({ userId: context.userId, schoolId, permission: 'ACADEMICS_DELETE' }),
    ]);

    return NextResponse.json({
      success: true,
      data: groups,
      canCreate: createCheck.authorized,
      canUpdate: updateCheck.authorized,
      canDelete: deleteCheck.authorized,
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (err.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ success: false, error: err.message.replace('FORBIDDEN: ', '') }, { status: 403 });
    }

    console.error('GET /api/school/academic-structure/groups error:', error);
    return NextResponse.json(
      { success: false, error: 'গ্রুপের তালিকা লোড করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/school/academic-structure/groups
 * Creates a new academic group under the authenticated school.
 *
 * Required Permission: ACADEMICS_CREATE
 */
export async function POST(req: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(req, {
      permission: 'ACADEMICS_CREATE',
    });

    const bodyJson = await req.json();
    const parseResult = AcademicGroupCreateSchema.safeParse(bodyJson);

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
        // Enforce duplicate check: (schoolId, code)
        const duplicate = await tx.academicGroup.findFirst({
          where: { schoolId, code: input.code },
        });

        if (duplicate) {
          throw new Error('DUPLICATE_GROUP: এই কোডের গ্রুপ ইতিমধ্যে বিদ্যমান রয়েছে।');
        }

        return tx.academicGroup.create({
          data: {
            schoolId,
            code: input.code,
            nameEn: input.nameEn,
            nameBn: input.nameBn,
            status: input.status,
          },
        });
      });

      await logAuditEvent({
        schoolId,
        actorUserId: context.userId,
        actorName: context.user.phone || context.user.fullName || 'User',
        actorRole: 'ADMIN',
        action: 'INSERT',
        entity: 'AcademicGroup',
        entityId: created.id,
        afterState: created as unknown as Record<string, unknown>,
        changeSummary: `Created academic group ${created.nameEn} (${created.code})`,
        ipAddress: clientIp,
        userAgent,
      });

      return NextResponse.json({ success: true, data: created }, { status: 201 });
    } catch (dbErr: unknown) {
      const e = dbErr as Error;
      if (e.message?.startsWith('DUPLICATE_GROUP:')) {
        return NextResponse.json(
          { success: false, error: e.message.replace('DUPLICATE_GROUP: ', '') },
          { status: 409 }
        );
      }
      if (dbErr instanceof Prisma.PrismaClientKnownRequestError && dbErr.code === 'P2002') {
        return NextResponse.json(
          { success: false, error: 'এই কোডের গ্রুপ ইতিমধ্যে বিদ্যমান রয়েছে।' },
          { status: 409 }
        );
      }
      throw dbErr;
    }
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (err.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ success: false, error: err.message.replace('FORBIDDEN: ', '') }, { status: 403 });
    }

    console.error('POST /api/school/academic-structure/groups error:', error);
    return NextResponse.json(
      { success: false, error: 'নতুন গ্রুপ তৈরি করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
