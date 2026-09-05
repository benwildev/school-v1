import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requirePermission } from '@/lib/authorization/engine';
import { withTenantContext } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';
import { SubjectUpdateSchema } from '@/lib/validation/subject';

/**
 * GET /api/school/subjects/[subjectId]
 * Fetches specific subject details.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ subjectId: string }> }
) {
  try {
    const { subjectId } = await params;
    const { schoolId } = await requirePermission(req, {
      permission: 'ACADEMICS_VIEW',
    });

    const subject = await withTenantContext(schoolId, async (tx) => {
      return tx.subject.findUnique({
        where: {
          id: subjectId,
          schoolId,
        },
        include: {
          class: { select: { id: true, nameEn: true, nameBn: true, numericLevel: true } },
          group: { select: { id: true, nameEn: true, nameBn: true } },
        },
      });
    });

    if (!subject) {
      return NextResponse.json({ success: false, error: 'বিষয় পাওয়া যায়নি।' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: subject });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (err.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ success: false, error: err.message.replace('FORBIDDEN: ', '') }, { status: 403 });
    }

    console.error('GET /api/school/subjects/[subjectId] error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * PATCH /api/school/subjects/[subjectId]
 * Updates a specific subject.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ subjectId: string }> }
) {
  try {
    const { context, schoolId } = await requirePermission(req, {
      permission: 'ACADEMICS_UPDATE',
    });

    const bodyJson = await req.json();
    const parseResult = SubjectUpdateSchema.safeParse(bodyJson);

    if (!parseResult.success) {
      const issueMessages = parseResult.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(
        { success: false, error: 'Validation failed: ' + issueMessages },
        { status: 400 }
      );
    }

    const input = parseResult.data;
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    try {
      const updated = await withTenantContext(schoolId, async (tx) => {
        const existing = await tx.subject.findUnique({
          where: { id: (await params).subjectId, schoolId },
        });

        if (!existing) {
          throw new Error('NOT_FOUND: বিষয় পাওয়া যায়নি।');
        }

        // Duplicate check if classId or code changes
        if ((input.classId && input.classId !== existing.classId) || (input.code && input.code !== existing.code)) {
          const checkClassId = input.classId || existing.classId;
          const checkCode = input.code || existing.code;
          
          const conflict = await tx.subject.findFirst({
            where: {
              schoolId,
              classId: checkClassId,
              code: checkCode,
              id: { not: existing.id }
            }
          });

          if (conflict) {
            throw new Error('DUPLICATE_SUBJECT: এই শ্রেণিতে এই কোড সহ একটি বিষয় ইতিমধ্যে বিদ্যমান রয়েছে।');
          }
        }
        
        // Verify relationships
        if (input.classId && input.classId !== existing.classId) {
          const cls = await tx.class.findUnique({ where: { id: input.classId } });
          if (!cls || cls.schoolId !== schoolId) {
            throw new Error('INVALID_RELATION: নির্বাচিত শ্রেণি সঠিক নয়।');
          }
        }
        if (input.groupId && input.groupId !== existing.groupId) {
          const grp = await tx.academicGroup.findUnique({ where: { id: input.groupId } });
          if (!grp || grp.schoolId !== schoolId) {
            throw new Error('INVALID_RELATION: নির্বাচিত গ্রুপ সঠিক নয়।');
          }
        }

        const dataToUpdate: Prisma.SubjectUpdateInput = {
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
          status: input.status,
        };

        if (input.classId !== undefined) {
           dataToUpdate.class = { connect: { id: input.classId } };
        }
        if (input.groupId !== undefined) {
           if (input.groupId === null || input.groupId === '') {
             dataToUpdate.group = { disconnect: true };
           } else {
             dataToUpdate.group = { connect: { id: input.groupId } };
           }
        }
        if (input.combinedWithSubjectId !== undefined) {
           if (input.combinedWithSubjectId === null || input.combinedWithSubjectId === '') {
             dataToUpdate.combinedWith = { disconnect: true };
           } else {
             dataToUpdate.combinedWith = { connect: { id: input.combinedWithSubjectId } };
           }
        }

        return tx.subject.update({
          where: { id: existing.id },
          data: dataToUpdate,
        });
      });

      await logAuditEvent({
        schoolId,
        actorUserId: context.userId,
        actorName: context.user.phone || context.user.fullName || 'User',
        actorRole: 'ADMIN',
        action: 'UPDATE',
        entity: 'Subject',
        entityId: updated.id,
        beforeState: {}, // Truncated for simplicity
        afterState: updated as unknown as Record<string, unknown>,
        changeSummary: `Updated subject ${updated.nameEn}`,
        ipAddress: clientIp,
        userAgent,
      });

      return NextResponse.json({ success: true, data: updated });
    } catch (dbErr: unknown) {
      const e = dbErr as Error;
      if (e.message?.startsWith('NOT_FOUND:')) {
         return NextResponse.json({ success: false, error: e.message.replace('NOT_FOUND: ', '') }, { status: 404 });
      }
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

    console.error('PATCH /api/school/subjects/[subjectId] error:', error);
    return NextResponse.json(
      { success: false, error: 'বিষয় সম্পাদনা করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/school/subjects/[subjectId]
 * Attempts to safely delete a subject. Falls back to deactivation if referenced.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ subjectId: string }> }
) {
  try {
    const { context, schoolId } = await requirePermission(req, {
      permission: 'ACADEMICS_DELETE',
    });

    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    try {
      const result = await withTenantContext(schoolId, async (tx) => {
        const existing = await tx.subject.findUnique({
          where: { id: (await params).subjectId, schoolId },
          include: {
            _count: {
              select: {
                routines: true,
                teacherAssignments: true,
                examSchedules: true,
                marks: true,
                assessmentConfigs: true,
              }
            }
          }
        });

        if (!existing) {
          throw new Error('NOT_FOUND: বিষয় পাওয়া যায়নি।');
        }

        const totalReferences = existing._count.routines + 
                                existing._count.teacherAssignments + 
                                existing._count.examSchedules + 
                                existing._count.marks + 
                                existing._count.assessmentConfigs;

        if (totalReferences > 0) {
           // Prevent deletion due to historical data, deactivate instead
           const deactivated = await tx.subject.update({
             where: { id: existing.id },
             data: { status: 'INACTIVE' }
           });
           return { action: 'DEACTIVATED', subject: deactivated, message: 'বিষয়টি বিভিন্ন রেকর্ডে ব্যবহৃত হচ্ছে, তাই মুছে ফেলার পরিবর্তে নিষ্ক্রিয় করা হয়েছে।' };
        }

        // Safe to delete
        const deleted = await tx.subject.delete({
          where: { id: existing.id }
        });
        return { action: 'DELETED', subject: deleted, message: 'বিষয় সফলভাবে মুছে ফেলা হয়েছে।' };
      });

      await logAuditEvent({
        schoolId,
        actorUserId: context.userId,
        actorName: context.user.phone || context.user.fullName || 'User',
        actorRole: 'ADMIN',
        action: result.action === 'DELETED' ? 'DELETE' : 'UPDATE',
        entity: 'Subject',
        entityId: result.subject.id,
        afterState: result.action === 'DEACTIVATED' ? { status: 'INACTIVE' } : undefined,
        changeSummary: `${result.action === 'DELETED' ? 'Deleted' : 'Deactivated'} subject ${result.subject.nameEn}`,
        ipAddress: clientIp,
        userAgent,
      });

      return NextResponse.json({ success: true, message: result.message, action: result.action });
    } catch (dbErr: unknown) {
      const e = dbErr as Error;
      if (e.message?.startsWith('NOT_FOUND:')) {
         return NextResponse.json({ success: false, error: e.message.replace('NOT_FOUND: ', '') }, { status: 404 });
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

    console.error('DELETE /api/school/subjects/[subjectId] error:', error);
    return NextResponse.json(
      { success: false, error: 'বিষয় মুছে ফেলতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
