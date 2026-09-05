import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requirePermission } from '@/lib/authorization/engine';
import { withTenantContext } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';
import { SectionUpdateSchema } from '@/lib/validation/academic-structure';

interface RouteParams {
  params: Promise<{ sectionId: string }>;
}

/**
 * GET /api/school/academic-structure/sections/[sectionId]
 * Fetches a single section by ID.
 *
 * Required Permission: ACADEMICS_VIEW
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { schoolId } = await requirePermission(req, {
      permission: 'ACADEMICS_VIEW',
    });

    const { sectionId } = await params;

    const section = await withTenantContext(schoolId, async (tx) => {
      return tx.section.findFirst({
        where: { id: sectionId, schoolId },
        include: {
          class: {
            select: { id: true, nameEn: true, nameBn: true, numericLevel: true },
          },
          campus: {
            select: { id: true, code: true, nameEn: true, nameBn: true },
          },
          group: {
            select: { id: true, code: true, nameEn: true, nameBn: true },
          },
          _count: {
            select: {
              enrollments: true,
              routines: true,
              teacherAssignments: true,
            },
          },
        },
      });
    });

    if (!section) {
      return NextResponse.json({ success: false, error: 'শাখা পাওয়া যায়নি।' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: section });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (err.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ success: false, error: err.message.replace('FORBIDDEN: ', '') }, { status: 403 });
    }

    console.error('GET /api/school/academic-structure/sections/[sectionId] error:', error);
    return NextResponse.json(
      { success: false, error: 'শাখার তথ্য লোড করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/school/academic-structure/sections/[sectionId]
 * Updates section details.
 *
 * Required Permission: ACADEMICS_UPDATE
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { context, schoolId } = await requirePermission(req, {
      permission: 'ACADEMICS_UPDATE',
    });

    const { sectionId } = await params;
    const bodyJson = await req.json();
    const parseResult = SectionUpdateSchema.safeParse(bodyJson);

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
        const existing = await tx.section.findFirst({
          where: { id: sectionId, schoolId },
        });

        if (!existing) {
          throw new Error('NOT_FOUND: শাখা পাওয়া যায়নি।');
        }

        // Validate foreign key changes within tenant boundaries
        if (input.classId && input.classId !== existing.classId) {
          const classExists = await tx.class.findFirst({
            where: { id: input.classId, schoolId },
          });
          if (!classExists) {
            throw new Error('TENANT_VIOLATION: নির্বাচিত শ্রেণি এই বিদ্যালয়ে বিদ্যমান নেই।');
          }
        }

        let cleanCampusId: string | null | undefined = undefined;
        if (input.campusId !== undefined) {
          cleanCampusId = input.campusId && input.campusId.trim() !== '' ? input.campusId : null;
          if (cleanCampusId && cleanCampusId !== existing.campusId) {
            const campusExists = await tx.campus.findFirst({
              where: { id: cleanCampusId, schoolId, deletedAt: null },
            });
            if (!campusExists) {
              throw new Error('TENANT_VIOLATION: নির্বাচিত ক্যাম্পাস এই বিদ্যালয়ে বিদ্যমান নেই।');
            }
          }
        }

        let cleanGroupId: string | null | undefined = undefined;
        if (input.groupId !== undefined) {
          cleanGroupId = input.groupId && input.groupId.trim() !== '' ? input.groupId : null;
          if (cleanGroupId && cleanGroupId !== existing.groupId) {
            const groupExists = await tx.academicGroup.findFirst({
              where: { id: cleanGroupId, schoolId },
            });
            if (!groupExists) {
              throw new Error('TENANT_VIOLATION: নির্বাচিত গ্রুপ এই বিদ্যালয়ে বিদ্যমান নেই।');
            }
          }
        }

        const targetClassId = input.classId || existing.classId;
        const targetNameEn = input.nameEn !== undefined ? input.nameEn : existing.nameEn;
        const targetShift = input.shift !== undefined ? input.shift : existing.shift;

        if (
          targetClassId !== existing.classId ||
          targetNameEn !== existing.nameEn ||
          targetShift !== existing.shift
        ) {
          const duplicate = await tx.section.findFirst({
            where: {
              schoolId,
              classId: targetClassId,
              nameEn: targetNameEn,
              shift: targetShift,
              id: { not: sectionId },
            },
          });

          if (duplicate) {
            throw new Error('DUPLICATE_SECTION: এই শ্রেণিতে একই শিফটে এই নামের শাখা ইতিমধ্যে বিদ্যমান রয়েছে।');
          }
        }

        const updated = await tx.section.update({
          where: { id: sectionId },
          data: {
            classId: input.classId,
            campusId: cleanCampusId !== undefined ? cleanCampusId : undefined,
            groupId: cleanGroupId !== undefined ? cleanGroupId : undefined,
            nameEn: input.nameEn,
            nameBn: input.nameBn,
            shift: input.shift,
            genderType: input.genderType,
            maxCapacity: input.maxCapacity,
            status: input.status,
          },
          include: {
            class: { select: { id: true, nameEn: true, nameBn: true, numericLevel: true } },
            campus: { select: { id: true, code: true, nameEn: true, nameBn: true } },
            group: { select: { id: true, code: true, nameEn: true, nameBn: true } },
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
        entity: 'Section',
        entityId: sectionId,
        beforeState: result.before as unknown as Record<string, unknown>,
        afterState: result.after as unknown as Record<string, unknown>,
        changeSummary: `Updated section ${result.after.nameEn} (${result.after.nameBn})`,
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
      if (e.message?.startsWith('TENANT_VIOLATION:')) {
        return NextResponse.json(
          { success: false, error: e.message.replace('TENANT_VIOLATION: ', '') },
          { status: 400 }
        );
      }
      if (e.message?.startsWith('DUPLICATE_SECTION:')) {
        return NextResponse.json(
          { success: false, error: e.message.replace('DUPLICATE_SECTION: ', '') },
          { status: 409 }
        );
      }
      if (dbErr instanceof Prisma.PrismaClientKnownRequestError && dbErr.code === 'P2002') {
        return NextResponse.json(
          { success: false, error: 'এই শ্রেণিতে একই শিফটে এই নামের শাখা ইতিমধ্যে বিদ্যমান রয়েছে।' },
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

    console.error('PATCH /api/school/academic-structure/sections/[sectionId] error:', error);
    return NextResponse.json(
      { success: false, error: 'শাখার তথ্য আপডেট করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/school/academic-structure/sections/[sectionId]
 * Safely removes a section if no operational records depend on it.
 *
 * Required Permission: ACADEMICS_DELETE
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { context, schoolId } = await requirePermission(req, {
      permission: 'ACADEMICS_DELETE',
    });

    const { sectionId } = await params;
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    try {
      const deleted = await withTenantContext(schoolId, async (tx) => {
        const existing = await tx.section.findFirst({
          where: { id: sectionId, schoolId },
          include: {
            _count: {
              select: {
                enrollments: true,
                routines: true,
                teacherAssignments: true,
                studentExamResults: true,
              },
            },
          },
        });

        if (!existing) {
          throw new Error('NOT_FOUND: শাখা পাওয়া যায়নি।');
        }

        const counts = existing._count;
        const totalReferences =
          counts.enrollments +
          counts.routines +
          counts.teacherAssignments +
          counts.studentExamResults;

        if (totalReferences > 0) {
          throw new Error(
            'HISTORICAL_SAFETY_VIOLATION: এই শাখার অধীনে শিক্ষার্থী, রুটিন বা অন্যান্য তথ্য বিদ্যমান থাকায় এটি মুছে ফেলা সম্ভব নয়। অনুগ্রহ করে শাখাকে নিষ্ক্রিয় (INACTIVE) করুন।'
          );
        }

        return tx.section.delete({
          where: { id: sectionId },
        });
      });

      await logAuditEvent({
        schoolId,
        actorUserId: context.userId,
        actorName: context.user.phone || context.user.fullName || 'User',
        actorRole: 'ADMIN',
        action: 'DELETE',
        entity: 'Section',
        entityId: sectionId,
        beforeState: deleted as unknown as Record<string, unknown>,
        changeSummary: `Deleted section ${deleted.nameEn} (${deleted.nameBn})`,
        ipAddress: clientIp,
        userAgent,
      });

      return NextResponse.json({
        success: true,
        message: 'শাখা সফলভাবে মুছে ফেলা হয়েছে।',
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

    console.error('DELETE /api/school/academic-structure/sections/[sectionId] error:', error);
    return NextResponse.json(
      { success: false, error: 'শাখা মুছে ফেলতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
