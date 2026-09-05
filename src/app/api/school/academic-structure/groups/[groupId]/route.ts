import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requirePermission } from '@/lib/authorization/engine';
import { withTenantContext } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';
import { AcademicGroupUpdateSchema } from '@/lib/validation/academic-structure';

interface RouteParams {
  params: Promise<{ groupId: string }>;
}

/**
 * GET /api/school/academic-structure/groups/[groupId]
 * Fetches a single academic group by ID.
 *
 * Required Permission: ACADEMICS_VIEW
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { schoolId } = await requirePermission(req, {
      permission: 'ACADEMICS_VIEW',
    });

    const { groupId } = await params;

    const group = await withTenantContext(schoolId, async (tx) => {
      return tx.academicGroup.findFirst({
        where: { id: groupId, schoolId },
        include: {
          sections: {
            where: { schoolId },
            include: {
              class: { select: { id: true, nameEn: true, nameBn: true } },
            },
          },
          _count: {
            select: {
              sections: true,
              subjects: true,
              enrollments: true,
            },
          },
        },
      });
    });

    if (!group) {
      return NextResponse.json({ success: false, error: 'গ্রুপ পাওয়া যায়নি।' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: group });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (err.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ success: false, error: err.message.replace('FORBIDDEN: ', '') }, { status: 403 });
    }

    console.error('GET /api/school/academic-structure/groups/[groupId] error:', error);
    return NextResponse.json(
      { success: false, error: 'গ্রুপের তথ্য লোড করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/school/academic-structure/groups/[groupId]
 * Updates academic group details.
 *
 * Required Permission: ACADEMICS_UPDATE
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { context, schoolId } = await requirePermission(req, {
      permission: 'ACADEMICS_UPDATE',
    });

    const { groupId } = await params;
    const bodyJson = await req.json();
    const parseResult = AcademicGroupUpdateSchema.safeParse(bodyJson);

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
      const result = await withTenantContext(schoolId, async (tx) => {
        const existing = await tx.academicGroup.findFirst({
          where: { id: groupId, schoolId },
        });

        if (!existing) {
          throw new Error('NOT_FOUND: গ্রুপ পাওয়া যায়নি।');
        }

        if (input.code && input.code !== existing.code) {
          const duplicate = await tx.academicGroup.findFirst({
            where: {
              schoolId,
              code: input.code,
              id: { not: groupId },
            },
          });

          if (duplicate) {
            throw new Error('DUPLICATE_GROUP: এই কোডের গ্রুপ ইতিমধ্যে বিদ্যমান রয়েছে।');
          }
        }

        const updated = await tx.academicGroup.update({
          where: { id: groupId },
          data: {
            code: input.code,
            nameEn: input.nameEn,
            nameBn: input.nameBn,
            status: input.status,
          },
        });

        return { before: existing, after: updated };
      });

      await logAuditEvent({
        schoolId,
        actorUserId: context.userId,
        actorName: context.user.phone || context.user.fullName || 'User',
        actorRole: 'ADMIN',
        action: 'UPDATE',
        entity: 'AcademicGroup',
        entityId: groupId,
        beforeState: result.before as unknown as Record<string, unknown>,
        afterState: result.after as unknown as Record<string, unknown>,
        changeSummary: `Updated academic group ${result.after.nameEn} (${result.after.code})`,
        ipAddress: clientIp,
        userAgent,
      });

      return NextResponse.json({ success: true, data: result.after });
    } catch (dbErr: unknown) {
      const e = dbErr as Error;
      if (e.message?.startsWith('NOT_FOUND:')) {
        return NextResponse.json(
          { success: false, error: e.message.replace('NOT_FOUND: ', '') },
          { status: 404 }
        );
      }
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

    console.error('PATCH /api/school/academic-structure/groups/[groupId] error:', error);
    return NextResponse.json(
      { success: false, error: 'গ্রুপের তথ্য আপডেট করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/school/academic-structure/groups/[groupId]
 * Safely removes an academic group if no operational records depend on it.
 *
 * Required Permission: ACADEMICS_DELETE
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { context, schoolId } = await requirePermission(req, {
      permission: 'ACADEMICS_DELETE',
    });

    const { groupId } = await params;
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    try {
      const deleted = await withTenantContext(schoolId, async (tx) => {
        const existing = await tx.academicGroup.findFirst({
          where: { id: groupId, schoolId },
          include: {
            _count: {
              select: {
                sections: true,
                subjects: true,
                enrollments: true,
                feeStructures: true,
                admissionApps: true,
              },
            },
          },
        });

        if (!existing) {
          throw new Error('NOT_FOUND: গ্রুপ পাওয়া যায়নি।');
        }

        const counts = existing._count;
        const totalReferences =
          counts.sections +
          counts.subjects +
          counts.enrollments +
          counts.feeStructures +
          counts.admissionApps;

        if (totalReferences > 0) {
          throw new Error(
            'HISTORICAL_SAFETY_VIOLATION: এই গ্রুপের অধীনে শাখা, শিক্ষার্থী বা বিষয় বিদ্যমান থাকায় এটি মুছে ফেলা সম্ভব নয়। অনুগ্রহ করে গ্রুপটিকে নিষ্ক্রিয় (INACTIVE) করুন।'
          );
        }

        return tx.academicGroup.delete({
          where: { id: groupId },
        });
      });

      await logAuditEvent({
        schoolId,
        actorUserId: context.userId,
        actorName: context.user.phone || context.user.fullName || 'User',
        actorRole: 'ADMIN',
        action: 'DELETE',
        entity: 'AcademicGroup',
        entityId: groupId,
        beforeState: deleted as unknown as Record<string, unknown>,
        changeSummary: `Deleted academic group ${deleted.nameEn} (${deleted.code})`,
        ipAddress: clientIp,
        userAgent,
      });

      return NextResponse.json({
        success: true,
        message: 'গ্রুপ সফলভাবে মুছে ফেলা হয়েছে।',
      });
    } catch (dbErr: unknown) {
      const e = dbErr as Error;
      if (e.message?.startsWith('NOT_FOUND:')) {
        return NextResponse.json(
          { success: false, error: e.message.replace('NOT_FOUND: ', '') },
          { status: 404 }
        );
      }
      if (e.message?.startsWith('HISTORICAL_SAFETY_VIOLATION:')) {
        return NextResponse.json(
          { success: false, error: e.message.replace('HISTORICAL_SAFETY_VIOLATION: ', '') },
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

    console.error('DELETE /api/school/academic-structure/groups/[groupId] error:', error);
    return NextResponse.json(
      { success: false, error: 'গ্রুপ মুছে ফেলতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
