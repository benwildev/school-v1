import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { EnrollmentCreateSchema, EnrollmentFilterSchema } from '@/lib/validation/enrollment';
import { Prisma } from '@prisma/client';

/**
 * GET /api/school/enrollments
 * Paginated enrollment directory with filters and safe relational projection.
 * Required Permission: ENROLLMENTS_VIEW
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, {
      permission: 'ENROLLMENTS_VIEW',
    });

    const { searchParams } = new URL(request.url);
    const filterResult = EnrollmentFilterSchema.safeParse({
      page: searchParams.get('page') || 1,
      pageSize: searchParams.get('pageSize') || 20,
      academicSessionId: searchParams.get('academicSessionId') || undefined,
      classId: searchParams.get('classId') || undefined,
      sectionId: searchParams.get('sectionId') || undefined,
      campusId: searchParams.get('campusId') || undefined,
      groupId: searchParams.get('groupId') || undefined,
      status: searchParams.get('status') || undefined,
      enrollmentType: searchParams.get('enrollmentType') || undefined,
      studentId: searchParams.get('studentId') || undefined,
      search: searchParams.get('search') || undefined,
    });

    if (!filterResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'অবৈধ ফিল্টার বা পেজিনেশন প্যারামিটার।',
          details: filterResult.error.flatten(),
        },
        { status: 422 }
      );
    }

    const {
      page,
      pageSize,
      academicSessionId,
      classId,
      sectionId,
      campusId,
      groupId,
      status,
      enrollmentType,
      studentId,
      search,
    } = filterResult.data;

    const result = await withTenantContext(schoolId, async (tx) => {
      const where: Prisma.EnrollmentWhereInput = {
        schoolId,
      };

      if (academicSessionId) where.academicSessionId = academicSessionId;
      if (classId) where.classId = classId;
      if (sectionId) where.sectionId = sectionId;
      if (campusId) where.campusId = campusId;
      if (groupId) where.groupId = groupId;
      if (studentId) where.studentId = studentId;

      if (status && status !== 'ALL') {
        where.status = status as Prisma.EnumEnrollmentStatusFilter['equals'];
      }

      if (enrollmentType && enrollmentType !== 'ALL') {
        where.enrollmentType = enrollmentType as Prisma.EnumEnrollmentTypeFilter['equals'];
      }

      if (search && search.trim() !== '') {
        const query = search.trim();
        where.student = {
          schoolId,
          deletedAt: null,
          OR: [
            { studentCode: { contains: query, mode: 'insensitive' } },
            { fullNameEn: { contains: query, mode: 'insensitive' } },
            { fullNameBn: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query, mode: 'insensitive' } },
          ],
        };
      }

      const total = await tx.enrollment.count({ where });

      const enrollments = await tx.enrollment.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [
          { academicSession: { startDate: 'desc' } },
          { class: { numericLevel: 'asc' } },
          { section: { nameEn: 'asc' } },
          { rollNo: 'asc' },
        ],
        select: {
          id: true,
          schoolId: true,
          studentId: true,
          academicSessionId: true,
          classId: true,
          sectionId: true,
          campusId: true,
          groupId: true,
          rollNo: true,
          curriculumVersion: true,
          enrollmentDate: true,
          enrollmentType: true,
          status: true,
          remarks: true,
          createdAt: true,
          updatedAt: true,
          student: {
            select: {
              id: true,
              studentCode: true,
              fullNameEn: true,
              fullNameBn: true,
              gender: true,
              phone: true,
              photoUrl: true,
            },
          },
          academicSession: {
            select: {
              id: true,
              name: true,
              isCurrent: true,
              startDate: true,
              endDate: true,
            },
          },
          class: {
            select: {
              id: true,
              nameEn: true,
              nameBn: true,
              numericLevel: true,
            },
          },
          section: {
            select: {
              id: true,
              nameEn: true,
              nameBn: true,
            },
          },
          campus: {
            select: {
              id: true,
              nameEn: true,
              nameBn: true,
            },
          },
          group: {
            select: {
              id: true,
              nameEn: true,
              nameBn: true,
            },
          },
        },
      });

      return {
        total,
        enrollments,
      };
    });

    return NextResponse.json({
      success: true,
      data: result.enrollments,
      pagination: {
        page,
        pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / pageSize),
      },
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err.status) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error('Error fetching enrollments:', error);
    return NextResponse.json(
      { success: false, error: 'এনরোলমেন্ট তালিকা লোড করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/school/enrollments
 * Create a new student enrollment placement.
 * Required Permission: ENROLLMENTS_CREATE
 */
export async function POST(request: NextRequest) {
  try {
    const { schoolId, context } = await requirePermission(request, {
      permission: 'ENROLLMENTS_CREATE',
    });

    const body = await request.json();
    const validation = EnrollmentCreateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'এনরোলমেন্ট তথ্যে ত্রুটি রয়েছে।',
          details: validation.error.flatten(),
        },
        { status: 422 }
      );
    }

    const {
      studentId,
      academicSessionId,
      classId,
      sectionId,
      campusId,
      groupId,
      rollNo,
      curriculumVersion,
      enrollmentDate,
      enrollmentType,
      status,
      remarks,
    } = validation.data;

    const newEnrollment = await withTenantContext(schoolId, async (tx) => {
      // 1. Verify Student exists and belongs to active school
      const student = await tx.student.findFirst({
        where: { id: studentId, schoolId, deletedAt: null },
      });
      if (!student) {
        throw { status: 404, message: 'শিক্ষার্থী খুঁজে পাওয়া যায়নি বা এই বিদ্যালয়ের অন্তর্ভুক্ত নয়।' };
      }

      // 2. Verify AcademicSession belongs to active school
      const session = await tx.academicSession.findFirst({
        where: { id: academicSessionId, schoolId },
      });
      if (!session) {
        throw { status: 404, message: 'শিক্ষাবর্ষ খুঁজে পাওয়া যায়নি বা এই বিদ্যালয়ের অন্তর্ভুক্ত নয়।' };
      }

      // 3. Verify Class belongs to active school
      const cls = await tx.class.findFirst({
        where: { id: classId, schoolId },
      });
      if (!cls) {
        throw { status: 404, message: 'শ্রেণী খুঁজে পাওয়া যায়নি বা এই বিদ্যালয়ের অন্তর্ভুক্ত নয়।' };
      }

      // 4. Verify Section belongs to active school AND belongs to selected class
      const section = await tx.section.findFirst({
        where: { id: sectionId, schoolId, classId },
      });
      if (!section) {
        throw { status: 400, message: 'নির্বাচিত শাখাটি এই বিদ্যালয় বা শ্রেণীর অন্তর্ভুক্ত নয়।' };
      }

      // 5. Verify Campus if provided
      if (campusId) {
        const campus = await tx.campus.findFirst({
          where: { id: campusId, schoolId },
        });
        if (!campus) {
          throw { status: 400, message: 'নির্বাচিত ক্যাম্পাসটি এই বিদ্যালয়ের অন্তর্ভুক্ত নয়।' };
        }
      }

      // 6. Verify Group if provided
      if (groupId) {
        const group = await tx.academicGroup.findFirst({
          where: { id: groupId, schoolId },
        });
        if (!group) {
          throw { status: 400, message: 'নির্বাচিত গ্রুপটি এই বিদ্যালয়ের অন্তর্ভুক্ত নয়।' };
        }
      }

      // 7. Check Student Duplicate in Session
      const existingEnrollment = await tx.enrollment.findUnique({
        where: {
          schoolId_academicSessionId_studentId: {
            schoolId,
            academicSessionId,
            studentId,
          },
        },
      });
      if (existingEnrollment) {
        throw {
          status: 409,
          message: 'এই শিক্ষাবর্ষে শিক্ষার্থীর একটি সক্রিয় এনরোলমেন্ট ইতিমধ্যে বিদ্যমান রয়েছে।',
        };
      }

      // 8. Check Roll Number Uniqueness in Section
      const existingRoll = await tx.enrollment.findUnique({
        where: {
          schoolId_academicSessionId_classId_sectionId_rollNo: {
            schoolId,
            academicSessionId,
            classId,
            sectionId,
            rollNo,
          },
        },
      });
      if (existingRoll) {
        throw {
          status: 409,
          message: `নির্বাচিত শিক্ষাবর্ষ, শ্রেণী ও শাখায় রোল ${rollNo} ইতিমধ্যে ব্যবহৃত হয়েছে।`,
        };
      }

      // 9. Create Enrollment
      return await tx.enrollment.create({
        data: {
          schoolId,
          studentId,
          academicSessionId,
          classId,
          sectionId,
          campusId: campusId || null,
          groupId: groupId || null,
          rollNo,
          curriculumVersion,
          enrollmentDate,
          enrollmentType,
          status,
          remarks: remarks || null,
        },
        select: {
          id: true,
          schoolId: true,
          studentId: true,
          academicSessionId: true,
          classId: true,
          sectionId: true,
          campusId: true,
          groupId: true,
          rollNo: true,
          curriculumVersion: true,
          enrollmentDate: true,
          enrollmentType: true,
          status: true,
          remarks: true,
          createdAt: true,
        },
      });
    });

    // 10. Audit Logging
    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || context.user.phone || 'Admin',
      actorRole: context.user.isSuperAdmin ? 'SUPER_ADMIN' : 'ADMIN',
      action: 'INSERT',
      entity: 'Enrollment',
      entityId: newEnrollment.id,
      changeSummary: 'ENROLLMENT_CREATED',
      afterState: {
        studentId: newEnrollment.studentId,
        academicSessionId: newEnrollment.academicSessionId,
        classId: newEnrollment.classId,
        sectionId: newEnrollment.sectionId,
        rollNo: newEnrollment.rollNo,
        enrollmentType: newEnrollment.enrollmentType,
        status: newEnrollment.status,
      },
    });

    return NextResponse.json({ success: true, data: newEnrollment }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          {
            success: false,
            error: 'এনরোলমেন্ট বা রোল নম্বরের দ্বৈততা শনাক্ত হয়েছে (Duplicate constraint conflict)।',
          },
          { status: 409 }
        );
      }
    }
    const err = error as { status?: number; message?: string };
    if (err.status) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error('Error creating enrollment:', error);
    return NextResponse.json(
      { success: false, error: 'এনরোলমেন্ট তৈরি করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
