import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requirePermission, authorize } from '@/lib/authorization/engine';
import { withTenantContext } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';
import { SubjectCreateSchema } from '@/lib/validation/subject';

/**
 * GET /api/school/subjects
 * Lists all subjects belonging to the authenticated user's active school.
 *
 * Required Permission: ACADEMICS_VIEW
 */
export async function GET(req: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(req, {
      permission: 'ACADEMICS_VIEW',
    });

    const { searchParams } = new URL(req.url);
    const classIdFilter = searchParams.get('classId');
    const statusFilter = searchParams.get('status');

    const subjects = await withTenantContext(schoolId, async (tx) => {
      const whereClause: Prisma.SubjectWhereInput = { schoolId };
      
      if (classIdFilter) {
        whereClause.classId = classIdFilter;
      }

      if (statusFilter && statusFilter !== 'ALL') {
        whereClause.status = statusFilter as Prisma.EnumRecordStatusFilter['equals'];
      }

      return tx.subject.findMany({
        where: whereClause,
        include: {
          class: { select: { id: true, nameEn: true, nameBn: true, numericLevel: true } },
          group: { select: { id: true, nameEn: true, nameBn: true } },
        },
        orderBy: [
          { class: { numericLevel: 'asc' } },
          { nameEn: 'asc' }
        ],
      });
    });

    const [createCheck, updateCheck, deleteCheck] = await Promise.all([
      authorize({ userId: context.userId, schoolId, permission: 'ACADEMICS_CREATE' }),
      authorize({ userId: context.userId, schoolId, permission: 'ACADEMICS_UPDATE' }),
      authorize({ userId: context.userId, schoolId, permission: 'ACADEMICS_DELETE' }),
    ]);

    return NextResponse.json({
      success: true,
      data: subjects,
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

    console.error('GET /api/school/subjects error:', error);
    return NextResponse.json(
      { success: false, error: 'বিষয়ের তালিকা লোড করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/school/subjects
 * Creates a new subject under the authenticated user's active school.
 *
 * Required Permission: ACADEMICS_CREATE
 */
export async function POST(req: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(req, {
      permission: 'ACADEMICS_CREATE',
    });

    const bodyJson = await req.json();
    const parseResult = SubjectCreateSchema.safeParse(bodyJson);

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
        // Enforce duplicate check: classId + code per school
        const existing = await tx.subject.findFirst({
          where: {
            schoolId,
            classId: input.classId,
            code: input.code,
          },
        });

        if (existing) {
          throw new Error('DUPLICATE_SUBJECT: এই শ্রেণিতে এই কোড সহ একটি বিষয় ইতিমধ্যে বিদ্যমান রয়েছে।');
        }

        // Verify class belongs to the school
        const cls = await tx.class.findUnique({ where: { id: input.classId } });
        if (!cls || cls.schoolId !== schoolId) {
          throw new Error('INVALID_RELATION: নির্বাচিত শ্রেণি সঠিক নয়।');
        }

        // Verify group belongs to the school if provided
        if (input.groupId) {
          const grp = await tx.academicGroup.findUnique({ where: { id: input.groupId } });
          if (!grp || grp.schoolId !== schoolId) {
            throw new Error('INVALID_RELATION: নির্বাচিত গ্রুপ সঠিক নয়।');
          }
        }

        return tx.subject.create({
          data: {
            schoolId,
            classId: input.classId,
            groupId: input.groupId || null,
            code: input.code,
            nameEn: input.nameEn,
            nameBn: input.nameBn,
            subjectType: input.subjectType,
            theoryMarks: input.theoryMarks,
            practicalMarks: input.practicalMarks,
            mcqMarks: input.mcqMarks,
            vivaMarks: input.vivaMarks,
            totalFullMarks: input.totalFullMarks,
            passMarks: input.passMarks,
            isCombinedSubject: input.isCombinedSubject,
            combinedWithSubjectId: input.combinedWithSubjectId || null,
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
        entity: 'Subject',
        entityId: created.id,
        afterState: created as unknown as Record<string, unknown>,
        changeSummary: `Created subject ${created.nameEn} (Code: ${created.code})`,
        ipAddress: clientIp,
        userAgent,
      });

      return NextResponse.json({ success: true, data: created }, { status: 201 });
    } catch (dbErr: unknown) {
      const e = dbErr as Error;
      if (e.message?.startsWith('DUPLICATE_SUBJECT:')) {
        return NextResponse.json(
          { success: false, error: e.message.replace('DUPLICATE_SUBJECT: ', '') },
          { status: 409 }
        );
      }
      if (e.message?.startsWith('INVALID_RELATION:')) {
        return NextResponse.json(
          { success: false, error: e.message.replace('INVALID_RELATION: ', '') },
          { status: 400 }
        );
      }
      if (dbErr instanceof Prisma.PrismaClientKnownRequestError && dbErr.code === 'P2002') {
        return NextResponse.json(
          { success: false, error: 'এই শ্রেণিতে এই কোড সহ একটি বিষয় ইতিমধ্যে বিদ্যমান রয়েছে।' },
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

    console.error('POST /api/school/subjects error:', error);
    return NextResponse.json(
      { success: false, error: 'নতুন বিষয় তৈরি করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
