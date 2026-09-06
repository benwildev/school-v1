import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { EnrollmentTransferSchema } from '@/lib/validation/enrollment';
import { Prisma, EnrollmentStatus } from '@prisma/client';

/**
 * POST /api/school/enrollments/transfer
 * Controlled student transfer across sections or campuses within the current academic session.
 * Preserves historical enrollment ID and dependent records (attendance, marks, etc.) intact.
 * Required Permission: ENROLLMENTS_TRANSFER
 */
export async function POST(request: NextRequest) {
  try {
    const { schoolId, context } = await requirePermission(request, {
      permission: 'ENROLLMENTS_TRANSFER',
    });

    const body = await request.json();
    const validation = EnrollmentTransferSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'স্থানান্তর তথ্যে ত্রুটি রয়েছে।',
          details: validation.error.flatten(),
        },
        { status: 422 }
      );
    }

    const {
      enrollmentId,
      type,
      targetClassId,
      targetSectionId,
      targetRollNo,
      targetCampusId,
      reason,
    } = validation.data;

    const result = await withTenantContext(schoolId, async (tx) => {
      // 1. Row-level lock on current enrollment
      await tx.$queryRaw`
        SELECT id FROM enrollments 
        WHERE id = ${enrollmentId}::uuid AND school_id = ${schoolId}::uuid
        FOR UPDATE
      `;

      const current = await tx.enrollment.findFirst({
        where: { id: enrollmentId, schoolId },
        include: {
          class: true,
          section: true,
          campus: true,
        },
      });

      if (!current) {
        throw { status: 404, message: 'এনরোলমেন্ট পাওয়া যায়নি।' };
      }

      if (current.status !== EnrollmentStatus.ACTIVE) {
        throw {
          status: 400,
          message: `শুধুমাত্র সক্রিয় (ACTIVE) এনরোলমেন্ট স্থানান্তর করা সম্ভব। বর্তমান স্ট্যাটাস: ${current.status}।`,
        };
      }

      const effectiveClassId = targetClassId || current.classId;

      // 2. Verify target section belongs to active school and target class
      const targetSection = await tx.section.findFirst({
        where: {
          id: targetSectionId,
          schoolId,
          classId: effectiveClassId,
        },
      });

      if (!targetSection) {
        throw {
          status: 400,
          message: 'নির্বাচিত লক্ষ্য শাখাটি এই বিদ্যালয় বা সংশ্লিষ্ট শ্রেণীর অন্তর্ভুক্ত নয়।',
        };
      }

      // 3. Verify target campus if type is CAMPUS or targetCampusId provided
      let effectiveCampusId = current.campusId;
      if (type === 'CAMPUS' || targetCampusId) {
        if (targetCampusId) {
          const targetCampus = await tx.campus.findFirst({
            where: { id: targetCampusId, schoolId },
          });
          if (!targetCampus) {
            throw { status: 400, message: 'নির্বাচিত লক্ষ্য ক্যাম্পাসটি এই বিদ্যালয়ের অন্তর্ভুক্ত নয়।' };
          }
          effectiveCampusId = targetCampus.id;
        }
      }

      // 4. Check target roll availability among ACTIVE enrollments
      const activeRollConflict = await tx.enrollment.findFirst({
        where: {
          schoolId,
          academicSessionId: current.academicSessionId,
          classId: effectiveClassId,
          sectionId: targetSectionId,
          rollNo: targetRollNo,
          status: EnrollmentStatus.ACTIVE,
        },
      });

      if (activeRollConflict && activeRollConflict.id !== current.id) {
        throw {
          status: 409,
          message: `লক্ষ্য শাখা ও শ্রেণীতে রোল ${targetRollNo} ইতিমধ্যে সক্রিয় শিক্ষার্থীর জন্য ব্যবহৃত হয়েছে।`,
        };
      }

      // 5. Preserve historical enrollment and create new ACTIVE enrollment
      const transferNote = `[${new Date().toISOString()}] Transferred to Section ${targetSection.nameEn} (Roll ${targetRollNo})${reason ? `: ${reason}` : ''}`;
      const historicalRemarks = current.remarks
        ? `${current.remarks}\n${transferNote}`
        : transferNote;

      // Mark old enrollment as TRANSFERRED_OUT to keep historical attendance/marks intact
      await tx.enrollment.update({
        where: { id: current.id },
        data: {
          status: EnrollmentStatus.TRANSFERRED_OUT,
          remarks: historicalRemarks,
        },
      });

      // Create new ACTIVE enrollment record with target placement
      const newRemarks = `Transferred from Section ${current.section.nameEn} (Roll ${current.rollNo})${reason ? `: ${reason}` : ''}`;
      const updated = await tx.enrollment.create({
        data: {
          schoolId,
          studentId: current.studentId,
          academicSessionId: current.academicSessionId,
          classId: effectiveClassId,
          sectionId: targetSectionId,
          rollNo: targetRollNo,
          campusId: effectiveCampusId,
          enrollmentType: current.enrollmentType,
          curriculumVersion: current.curriculumVersion,
          enrollmentDate: new Date(),
          status: EnrollmentStatus.ACTIVE,
          remarks: newRemarks,
        },
        select: {
          id: true,
          schoolId: true,
          studentId: true,
          academicSessionId: true,
          classId: true,
          sectionId: true,
          campusId: true,
          rollNo: true,
          status: true,
          remarks: true,
          updatedAt: true,
        },
      });

      return {
        current,
        updated,
        type,
      };
    });

    // 6. Audit Logging
    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || context.user.phone || 'Admin',
      actorRole: context.user.isSuperAdmin ? 'SUPER_ADMIN' : 'ADMIN',
      action: 'UPDATE',
      entity: 'Enrollment',
      entityId: enrollmentId,
      changeSummary:
        result.type === 'CAMPUS' ? 'CAMPUS_TRANSFERRED' : 'STUDENT_TRANSFERRED',
      beforeState: {
        classId: result.current.classId,
        sectionId: result.current.sectionId,
        rollNo: result.current.rollNo,
        campusId: result.current.campusId,
      },
      afterState: {
        classId: result.updated.classId,
        sectionId: result.updated.sectionId,
        rollNo: result.updated.rollNo,
        campusId: result.updated.campusId,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'শিক্ষার্থীর স্থানান্তর সফলভাবে সম্পন্ন হয়েছে।',
      data: result.updated,
    });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { success: false, error: 'লক্ষ্য শাখায় রোল নম্বর ইতিমধ্যে ব্যবহৃত হয়েছে।' },
          { status: 409 }
        );
      }
    }
    const err = error as { status?: number; message?: string };
    if (err.status) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error('Error transferring enrollment:', error);
    return NextResponse.json(
      { success: false, error: 'শিক্ষার্থী স্থানান্তর করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
