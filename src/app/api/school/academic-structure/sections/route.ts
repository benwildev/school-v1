import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requirePermission, authorize } from '@/lib/authorization/engine';
import { withTenantContext } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';
import { SectionCreateSchema } from '@/lib/validation/academic-structure';

/**
 * GET /api/school/academic-structure/sections
 * Lists all sections for the authenticated school, with optional classId and campusId filtering.
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
    const campusIdFilter = searchParams.get('campusId');
    const statusFilter = searchParams.get('status');

    const sections = await withTenantContext(schoolId, async (tx) => {
      const whereClause: Prisma.SectionWhereInput = { schoolId };
      if (classIdFilter) {
        whereClause.classId = classIdFilter;
      }
      if (campusIdFilter) {
        whereClause.campusId = campusIdFilter;
      }
      if (statusFilter && statusFilter !== 'ALL') {
        whereClause.status = statusFilter as Prisma.EnumRecordStatusFilter['equals'];
      }

      return tx.section.findMany({
        where: whereClause,
        include: {
          class: {
            select: {
              id: true,
              nameEn: true,
              nameBn: true,
              numericLevel: true,
              category: true,
            },
          },
          campus: {
            select: {
              id: true,
              code: true,
              nameEn: true,
              nameBn: true,
            },
          },
          group: {
            select: {
              id: true,
              code: true,
              nameEn: true,
              nameBn: true,
            },
          },
          _count: {
            select: {
              enrollments: true,
            },
          },
        },
        orderBy: [
          { class: { numericLevel: 'asc' } },
          { nameEn: 'asc' },
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
      data: sections,
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

    console.error('GET /api/school/academic-structure/sections error:', error);
    return NextResponse.json(
      { success: false, error: 'শাখার তালিকা লোড করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/school/academic-structure/sections
 * Creates a new section under the authenticated school.
 *
 * Required Permission: ACADEMICS_CREATE
 */
export async function POST(req: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(req, {
      permission: 'ACADEMICS_CREATE',
    });

    const bodyJson = await req.json();
    const parseResult = SectionCreateSchema.safeParse(bodyJson);

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
        // 1. Verify Class belongs to this school
        const classExists = await tx.class.findFirst({
          where: { id: input.classId, schoolId },
        });
        if (!classExists) {
          throw new Error('TENANT_VIOLATION: নির্বাচিত শ্রেণি এই বিদ্যালয়ে বিদ্যমান নেই।');
        }

        // 2. Verify Campus if provided
        const cleanCampusId = input.campusId && input.campusId.trim() !== '' ? input.campusId : null;
        if (cleanCampusId) {
          const campusExists = await tx.campus.findFirst({
            where: { id: cleanCampusId, schoolId, deletedAt: null },
          });
          if (!campusExists) {
            throw new Error('TENANT_VIOLATION: নির্বাচিত ক্যাম্পাস এই বিদ্যালয়ে বিদ্যমান নেই।');
          }
        }

        // 3. Verify Group if provided
        const cleanGroupId = input.groupId && input.groupId.trim() !== '' ? input.groupId : null;
        if (cleanGroupId) {
          const groupExists = await tx.academicGroup.findFirst({
            where: { id: cleanGroupId, schoolId },
          });
          if (!groupExists) {
            throw new Error('TENANT_VIOLATION: নির্বাচিত গ্রুপ এই বিদ্যালয়ে বিদ্যমান নেই।');
          }
        }

        // 4. Enforce unique constraint: (schoolId, classId, nameEn, shift)
        const duplicate = await tx.section.findFirst({
          where: {
            schoolId,
            classId: input.classId,
            nameEn: input.nameEn,
            shift: input.shift,
          },
        });
        if (duplicate) {
          throw new Error('DUPLICATE_SECTION: এই শ্রেণিতে একই শিফটে এই নামের শাখা ইতিমধ্যে বিদ্যমান রয়েছে।');
        }

        return tx.section.create({
          data: {
            schoolId,
            classId: input.classId,
            campusId: cleanCampusId,
            groupId: cleanGroupId,
            nameEn: input.nameEn,
            nameBn: input.nameBn,
            shift: input.shift,
            genderType: input.genderType,
            maxCapacity: input.maxCapacity,
            status: input.status,
          },
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
          },
        });
      });

      await logAuditEvent({
        schoolId,
        actorUserId: context.userId,
        actorName: context.user.phone || context.user.fullName || 'User',
        actorRole: 'ADMIN',
        action: 'INSERT',
        entity: 'Section',
        entityId: created.id,
        afterState: created as unknown as Record<string, unknown>,
        changeSummary: `Created section ${created.nameEn} (${created.nameBn}) for class ${created.class.nameEn}`,
        ipAddress: clientIp,
        userAgent,
      });

      return NextResponse.json({ success: true, data: created }, { status: 201 });
    } catch (dbErr: unknown) {
      const e = dbErr as Error;
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

    console.error('POST /api/school/academic-structure/sections error:', error);
    return NextResponse.json(
      { success: false, error: 'নতুন শাখা তৈরি করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
