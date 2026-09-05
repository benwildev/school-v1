import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requirePermission } from '@/lib/authorization/engine';
import { withTenantContext } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';
import { ClassUpdateSchema } from '@/lib/validation/academic-structure';

interface RouteParams {
  params: Promise<{ classId: string }>;
}

/**
 * GET /api/school/academic-structure/classes/[classId]
 * Fetches a single class by ID.
 *
 * Required Permission: ACADEMICS_VIEW
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { schoolId } = await requirePermission(req, {
      permission: 'ACADEMICS_VIEW',
    });

    const { classId } = await params;

    const classRecord = await withTenantContext(schoolId, async (tx) => {
      return tx.class.findFirst({
        where: { id: classId, schoolId },
        include: {
          sections: {
            where: { schoolId },
            include: {
              campus: { select: { id: true, nameEn: true, nameBn: true } },
              group: { select: { id: true, code: true, nameEn: true, nameBn: true } },
            },
            orderBy: [{ nameEn: 'asc' }],
          },
          _count: {
            select: {
              sections: true,
              enrollments: true,
              subjects: true,
            },
          },
        },
      });
    });

    if (!classRecord) {
      return NextResponse.json({ success: false, error: 'শ্রেণি পাওয়া যায়নি।' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: classRecord });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (err.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ success: false, error: err.message.replace('FORBIDDEN: ', '') }, { status: 403 });
    }

    console.error('GET /api/school/academic-structure/classes/[classId] error:', error);
    return NextResponse.json(
      { success: false, error: 'শ্রেণির তথ্য লোড করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/school/academic-structure/classes/[classId]
 * Updates class details.
 *
 * Required Permission: ACADEMICS_UPDATE
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { context, schoolId } = await requirePermission(req, {
      permission: 'ACADEMICS_UPDATE',
    });

    const { classId } = await params;
    const bodyJson = await req.json();
    const parseResult = ClassUpdateSchema.safeParse(bodyJson);

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
        const existing = await tx.class.findFirst({
          where: { id: classId, schoolId },
        });

        if (!existing) {
          throw new Error('NOT_FOUND: শ্রেণি পাওয়া যায়নি।');
        }

        const targetNumericLevel = input.numericLevel !== undefined ? input.numericLevel : existing.numericLevel;
        const targetNameEn = input.nameEn !== undefined ? input.nameEn : existing.nameEn;

        // If numericLevel or nameEn is changing, check uniqueness
        if (targetNumericLevel !== existing.numericLevel || targetNameEn !== existing.nameEn) {
          const duplicate = await tx.class.findFirst({
            where: {
              schoolId,
              numericLevel: targetNumericLevel,
              nameEn: targetNameEn,
              id: { not: classId },
            },
          });

          if (duplicate) {
            throw new Error('DUPLICATE_CLASS: এই ক্রমিক নম্বর এবং নামের শ্রেণি ইতিমধ্যে বিদ্যমান রয়েছে।');
          }
        }

        const updated = await tx.class.update({
          where: { id: classId },
          data: {
            nameEn: input.nameEn,
            nameBn: input.nameBn,
            numericLevel: input.numericLevel,
            category: input.category,
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
        entity: 'Class',
        entityId: classId,
        beforeState: result.before as unknown as Record<string, unknown>,
        afterState: result.after as unknown as Record<string, unknown>,
        changeSummary: `Updated class ${result.after.nameEn} (${result.after.nameBn})`,
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

    console.error('PATCH /api/school/academic-structure/classes/[classId] error:', error);
    return NextResponse.json(
      { success: false, error: 'শ্রেণির তথ্য আপডেট করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/school/academic-structure/classes/[classId]
 * Safely removes a class if no operational records or sections depend on it.
 *
 * Required Permission: ACADEMICS_DELETE
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { context, schoolId } = await requirePermission(req, {
      permission: 'ACADEMICS_DELETE',
    });

    const { classId } = await params;
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    try {
      const deleted = await withTenantContext(schoolId, async (tx) => {
        const existing = await tx.class.findFirst({
          where: { id: classId, schoolId },
          include: {
            _count: {
              select: {
                sections: true,
                enrollments: true,
                subjects: true,
                routines: true,
                teacherAssignments: true,
                examSchedules: true,
                feeStructures: true,
                studentExamResults: true,
                admissionApps: true,
              },
            },
          },
        });

        if (!existing) {
          throw new Error('NOT_FOUND: শ্রেণি পাওয়া যায়নি।');
        }

        const counts = existing._count;
        const totalReferences =
          counts.sections +
          counts.enrollments +
          counts.subjects +
          counts.routines +
          counts.teacherAssignments +
          counts.examSchedules +
          counts.feeStructures +
          counts.studentExamResults +
          counts.admissionApps;

        if (totalReferences > 0) {
          throw new Error(
            'HISTORICAL_SAFETY_VIOLATION: এই শ্রেণির অধীনে শাখা, শিক্ষার্থী বা একাডেমিক তথ্য বিদ্যমান থাকায় এটি মুছে ফেলা সম্ভব নয়। অনুগ্রহ করে শ্রেণিকে নিষ্ক্রিয় (INACTIVE) করুন।'
          );
        }

        return tx.class.delete({
          where: { id: classId },
        });
      });

      await logAuditEvent({
        schoolId,
        actorUserId: context.userId,
        actorName: context.user.phone || context.user.fullName || 'User',
        actorRole: 'ADMIN',
        action: 'DELETE',
        entity: 'Class',
        entityId: classId,
        beforeState: deleted as unknown as Record<string, unknown>,
        changeSummary: `Deleted class ${deleted.nameEn} (${deleted.nameBn})`,
        ipAddress: clientIp,
        userAgent,
      });

      return NextResponse.json({
        success: true,
        message: 'শ্রেণি সফলভাবে মুছে ফেলা হয়েছে।',
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

    console.error('DELETE /api/school/academic-structure/classes/[classId] error:', error);
    return NextResponse.json(
      { success: false, error: 'শ্রেণি মুছে ফেলতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
