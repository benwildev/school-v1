import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requirePermission, authorize } from '@/lib/authorization/engine';
import { withTenantContext } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';
import { ClassCreateSchema } from '@/lib/validation/academic-structure';

/**
 * GET /api/school/academic-structure/classes
 * Lists all classes belonging to the authenticated user's active school.
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

    const classes = await withTenantContext(schoolId, async (tx) => {
      const whereClause: Prisma.ClassWhereInput = { schoolId };
      if (statusFilter && statusFilter !== 'ALL') {
        whereClause.status = statusFilter as Prisma.EnumRecordStatusFilter['equals'];
      }

      return tx.class.findMany({
        where: whereClause,
        select: {
          id: true,
          schoolId: true,
          nameEn: true,
          nameBn: true,
          numericLevel: true,
          category: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              sections: true,
            },
          },
        },
        orderBy: [{ numericLevel: 'asc' }, { nameEn: 'asc' }],
      });
    });

    const [createCheck, updateCheck, deleteCheck] = await Promise.all([
      authorize({ userId: context.userId, schoolId, permission: 'ACADEMICS_CREATE' }),
      authorize({ userId: context.userId, schoolId, permission: 'ACADEMICS_UPDATE' }),
      authorize({ userId: context.userId, schoolId, permission: 'ACADEMICS_DELETE' }),
    ]);

    return NextResponse.json({
      success: true,
      data: classes,
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

    console.error('GET /api/school/academic-structure/classes error:', error);
    return NextResponse.json(
      { success: false, error: 'শ্রেণির তালিকা লোড করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/school/academic-structure/classes
 * Creates a new class under the authenticated user's active school.
 *
 * Required Permission: ACADEMICS_CREATE
 */
export async function POST(req: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(req, {
      permission: 'ACADEMICS_CREATE',
    });

    const bodyJson = await req.json();
    const parseResult = ClassCreateSchema.safeParse(bodyJson);

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
        // Enforce duplicate check: numericLevel + nameEn per school
        const existing = await tx.class.findFirst({
          where: {
            schoolId,
            numericLevel: input.numericLevel,
            nameEn: input.nameEn,
          },
        });

        if (existing) {
          throw new Error('DUPLICATE_CLASS: এই ক্রমিক নম্বর এবং নামের শ্রেণি ইতিমধ্যে বিদ্যমান রয়েছে।');
        }

        return tx.class.create({
          data: {
            schoolId,
            nameEn: input.nameEn,
            nameBn: input.nameBn,
            numericLevel: input.numericLevel,
            category: input.category,
            status: input.status,
          },
          select: {
            id: true,
            schoolId: true,
            nameEn: true,
            nameBn: true,
            numericLevel: true,
            category: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      });

      await logAuditEvent({
        schoolId,
        actorUserId: context.userId,
        actorName: context.user.phone || context.user.fullName || 'User',
        actorRole: 'ADMIN',
        action: 'INSERT',
        entity: 'Class',
        entityId: created.id,
        afterState: created as unknown as Record<string, unknown>,
        changeSummary: `Created class ${created.nameEn} (${created.nameBn}, Level: ${created.numericLevel})`,
        ipAddress: clientIp,
        userAgent,
      });

      return NextResponse.json({ success: true, data: created }, { status: 201 });
    } catch (dbErr: unknown) {
      const e = dbErr as Error;
      if (e.message?.startsWith('DUPLICATE_CLASS:')) {
        return NextResponse.json(
          { success: false, error: e.message.replace('DUPLICATE_CLASS: ', '') },
          { status: 409 }
        );
      }
      if (dbErr instanceof Prisma.PrismaClientKnownRequestError && dbErr.code === 'P2002') {
        return NextResponse.json(
          { success: false, error: 'এই ক্রমিক নম্বর এবং নামের শ্রেণি ইতিমধ্যে বিদ্যমান রয়েছে।' },
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

    console.error('POST /api/school/academic-structure/classes error:', error);
    return NextResponse.json(
      { success: false, error: 'নতুন শ্রেণি তৈরি করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
