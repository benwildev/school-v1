import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { EnrollmentReadmissionSchema } from '@/lib/validation/enrollment';
import { Prisma, EnrollmentType, EnrollmentStatus } from '@prisma/client';

/**
 * POST /api/school/enrollments/readmission
 * Readmits a returning student (who was previously dropped or transferred out) into an academic session.
 * Preserves all historical enrollments and records intact while creating or activating their new placement.
 * Required Permission: ENROLLMENTS_CREATE
 */
export async function POST(request: NextRequest) {
  try {
    const { schoolId, context } = await requirePermission(request, {
      permission: 'ENROLLMENTS_CREATE',
    });

    const body = await request.json();
    const validation = EnrollmentReadmissionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'পুনঃভর্তি তথ্যে ত্রুটি রয়েছে।',
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
      rollNo,
      campusId,
      groupId,
      curriculumVersion,
      remarks,
    } = validation.data;

    const result = await withTenantContext(schoolId, async (tx) => {
      // 1. Verify Student belongs to active school
      const student = await tx.student.findFirst({
        where: { id: studentId, schoolId, deletedAt: null },
      });
      if (!student) {
        throw { status: 404, message: 'শিক্ষার্থী খুঁজে পাওয়া যায়নি বা এই বিদ্যালয়ের অন্তর্ভুক্ত নয়।' };
      }

      // 2. Verify Session, Class, Section
      const [session, cls, section] = await Promise.all([
        tx.academicSession.findFirst({ where: { id: academicSessionId, schoolId } }),
        tx.class.findFirst({ where: { id: classId, schoolId } }),
        tx.section.findFirst({ where: { id: sectionId, schoolId, classId } }),
      ]);

      if (!session) throw { status: 404, message: 'শিক্ষাবর্ষ খুঁজে পাওয়া যায়নি।' };
      if (!cls) throw { status: 404, message: 'শ্রেণী খুঁজে পাওয়া যায়নি।' };
      if (!section) throw { status: 400, message: 'শাখাটি নির্বাচিত শ্রেণীর অন্তর্ভুক্ত নয়।' };

      // 3. Verify Campus / Group if provided
      if (campusId) {
        const campus = await tx.campus.findFirst({ where: { id: campusId, schoolId } });
        if (!campus) throw { status: 400, message: 'নির্বাচিত ক্যাম্পাসটি এই বিদ্যালয়ের অন্তর্ভুক্ত নয়।' };
      }
      if (groupId) {
        const group = await tx.academicGroup.findFirst({ where: { id: groupId, schoolId } });
        if (!group) throw { status: 400, message: 'নির্বাচিত গ্রুপটি এই বিদ্যালয়ের অন্তর্ভুক্ত নয়।' };
      }

      // 4. Check if student already has an enrollment in this session
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
        if (existingEnrollment.status === EnrollmentStatus.ACTIVE) {
          throw {
            status: 409,
            message: 'এই শিক্ষাবর্ষে শিক্ষার্থীর একটি সক্রিয় এনরোলমেন্ট ইতিমধ্যে বিদ্যমান রয়েছে।',
          };
        }

        // Student was previously dropped/transferred in the SAME session; reactivate them
        const rollConflict = await tx.enrollment.findUnique({
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

        if (rollConflict && rollConflict.id !== existingEnrollment.id) {
          throw {
            status: 409,
            message: `নির্বাচিত শিক্ষাবর্ষ, শ্রেণী ও শাখায় রোল ${rollNo} ইতিমধ্যে ব্যবহৃত হয়েছে।`,
          };
        }

        const readmitNote = `[${new Date().toISOString()}] Readmitted from previous status (${existingEnrollment.status})${remarks ? `: ${remarks}` : ''}`;
        const updatedRemarks = existingEnrollment.remarks
          ? `${existingEnrollment.remarks}\n${readmitNote}`
          : readmitNote;

        const reactivated = await tx.enrollment.update({
          where: { id: existingEnrollment.id },
          data: {
            classId,
            sectionId,
            rollNo,
            campusId: campusId || null,
            groupId: groupId || null,
            curriculumVersion,
            status: EnrollmentStatus.ACTIVE,
            enrollmentType: EnrollmentType.LATERAL_ENTRY,
            remarks: updatedRemarks,
          },
          select: {
            id: true,
            schoolId: true,
            studentId: true,
            academicSessionId: true,
            classId: true,
            sectionId: true,
            rollNo: true,
            status: true,
            enrollmentType: true,
            remarks: true,
          },
        });

        return { enrollment: reactivated, isReactivation: true };
      }

      // 5. Check roll availability in target class/section
      const rollConflict = await tx.enrollment.findUnique({
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

      if (rollConflict) {
        throw {
          status: 409,
          message: `নির্বাচিত শিক্ষাবর্ষ, শ্রেণী ও শাখায় রোল ${rollNo} ইতিমধ্যে ব্যবহৃত হয়েছে।`,
        };
      }

      // 6. Create brand new enrollment in this session
      const readmitNote = `[${new Date().toISOString()}] Readmission recorded${remarks ? `: ${remarks}` : ''}`;
      const newEnrollment = await tx.enrollment.create({
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
          enrollmentDate: new Date(),
          enrollmentType: EnrollmentType.LATERAL_ENTRY,
          status: EnrollmentStatus.ACTIVE,
          remarks: readmitNote,
        },
        select: {
          id: true,
          schoolId: true,
          studentId: true,
          academicSessionId: true,
          classId: true,
          sectionId: true,
          rollNo: true,
          status: true,
          enrollmentType: true,
          remarks: true,
        },
      });

      return { enrollment: newEnrollment, isReactivation: false };
    });

    // 7. Audit Logging
    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || context.user.phone || 'Admin',
      actorRole: context.user.isSuperAdmin ? 'SUPER_ADMIN' : 'ADMIN',
      action: result.isReactivation ? 'UPDATE' : 'INSERT',
      entity: 'Enrollment',
      entityId: result.enrollment.id,
      changeSummary: 'STUDENT_READMITTED',
      afterState: {
        studentId,
        academicSessionId,
        classId,
        sectionId,
        rollNo,
        enrollmentType: result.enrollment.enrollmentType,
        status: result.enrollment.status,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'শিক্ষার্থীর পুনঃভর্তি সফলভাবে সম্পন্ন হয়েছে।',
      data: result.enrollment,
    });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { success: false, error: 'এনরোলমেন্ট বা রোল নম্বরে দ্বৈততা বিদ্যমান রয়েছে।' },
          { status: 409 }
        );
      }
    }
    const err = error as { status?: number; message?: string };
    if (err.status) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error('Error readmitting student:', error);
    return NextResponse.json(
      { success: false, error: 'শিক্ষার্থীর পুনঃভর্তি প্রক্রিয়া সম্পন্ন করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
