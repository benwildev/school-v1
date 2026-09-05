import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import {
  EnrollmentUpdateSchema,
  isValidEnrollmentStatusTransition,
} from '@/lib/validation/enrollment';
import { Prisma } from '@prisma/client';

/**
 * GET /api/school/enrollments/[enrollmentId]
 * Retrieve detailed placement information for an enrollment.
 * Required Permission: ENROLLMENTS_VIEW
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ enrollmentId: string }> }
) {
  try {
    const { schoolId } = await requirePermission(request, {
      permission: 'ENROLLMENTS_VIEW',
    });

    const { enrollmentId } = await context.params;

    const enrollment = await withTenantContext(schoolId, async (tx) => {
      return await tx.enrollment.findFirst({
        where: { id: enrollmentId, schoolId },
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
              email: true,
              photoUrl: true,
              status: true,
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
    });

    if (!enrollment) {
      return NextResponse.json(
        { success: false, error: 'এনরোলমেন্ট পাওয়া যায়নি।' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: enrollment });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err.status) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error('Error fetching enrollment details:', error);
    return NextResponse.json(
      { success: false, error: 'এনরোলমেন্ট তথ্য লোড করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/school/enrollments/[enrollmentId]
 * Controlled update for an enrollment record.
 * Required Permission: ENROLLMENTS_UPDATE
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ enrollmentId: string }> }
) {
  try {
    const { schoolId, context: authContext } = await requirePermission(request, {
      permission: 'ENROLLMENTS_UPDATE',
    });

    const { enrollmentId } = await context.params;
    const body = await request.json();

    // Check if client attempts to silently rewrite class/section/campus
    if (body.classId || body.sectionId || body.campusId) {
      return NextResponse.json(
        {
          success: false,
          error:
            'শ্রেণী, শাখা বা ক্যাম্পাস সরাসরি পরিবর্তন করা যাবে না। স্থানান্তর মডিউল (/transfer) ব্যবহার করুন।',
        },
        { status: 400 }
      );
    }

    const validation = EnrollmentUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'অবৈধ আপডেট তথ্য।',
          details: validation.error.flatten(),
        },
        { status: 422 }
      );
    }

    const { rollNo, curriculumVersion, status, remarks } = validation.data;

    const updated = await withTenantContext(schoolId, async (tx) => {
      const current = await tx.enrollment.findFirst({
        where: { id: enrollmentId, schoolId },
      });

      if (!current) {
        throw { status: 404, message: 'এনরোলমেন্ট পাওয়া যায়নি।' };
      }

      // 1. Validate status transition lifecycle if status is changing
      if (status && status !== current.status) {
        if (!isValidEnrollmentStatusTransition(current.status, status)) {
          throw {
            status: 400,
            message: `স্ট্যাটাস পরিবর্তন অবৈধ: ${current.status} থেকে ${status} রূপান্তর গ্রহণযোগ্য নয়।`,
          };
        }
      }

      // 2. Validate roll number uniqueness if roll is changing
      if (rollNo && rollNo !== current.rollNo) {
        const rollConflict = await tx.enrollment.findUnique({
          where: {
            schoolId_academicSessionId_classId_sectionId_rollNo: {
              schoolId,
              academicSessionId: current.academicSessionId,
              classId: current.classId,
              sectionId: current.sectionId,
              rollNo,
            },
          },
        });
        if (rollConflict && rollConflict.id !== current.id) {
          throw {
            status: 409,
            message: `নির্বাচিত শিক্ষাবর্ষ ও শাখায় রোল ${rollNo} ইতিমধ্যে ব্যবহৃত হয়েছে।`,
          };
        }
      }

      const updateData: Prisma.EnrollmentUpdateInput = {};
      if (rollNo !== undefined) updateData.rollNo = rollNo;
      if (curriculumVersion !== undefined) updateData.curriculumVersion = curriculumVersion;
      if (status !== undefined) updateData.status = status;
      if (remarks !== undefined) updateData.remarks = remarks;

      const result = await tx.enrollment.update({
        where: { id: enrollmentId },
        data: updateData,
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
          updatedAt: true,
        },
      });

      return { current, result };
    });

    // 3. Audit Logging
    await logAuditEvent({
      schoolId,
      actorUserId: authContext.userId,
      actorName: authContext.user.fullName || authContext.user.phone || 'Admin',
      actorRole: authContext.user.isSuperAdmin ? 'SUPER_ADMIN' : 'ADMIN',
      action: 'UPDATE',
      entity: 'Enrollment',
      entityId: enrollmentId,
      changeSummary: 'ENROLLMENT_UPDATED',
      beforeState: {
        rollNo: updated.current.rollNo,
        status: updated.current.status,
        remarks: updated.current.remarks,
      },
      afterState: {
        rollNo: updated.result.rollNo,
        status: updated.result.status,
        remarks: updated.result.remarks,
      },
    });

    return NextResponse.json({ success: true, data: updated.result });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { success: false, error: 'রোল নম্বর বা এনরোলমেন্ট তথ্যে দ্বৈততা দেখা দিয়েছে।' },
          { status: 409 }
        );
      }
    }
    const err = error as { status?: number; message?: string };
    if (err.status) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error('Error updating enrollment:', error);
    return NextResponse.json(
      { success: false, error: 'এনরোলমেন্ট তথ্য আপডেট করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/school/enrollments/[enrollmentId]
 * Safe deletion guard: prevents hard delete if dependent academic history exists.
 * Required Permission: ENROLLMENTS_DELETE
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ enrollmentId: string }> }
) {
  try {
    const { schoolId, context: authContext } = await requirePermission(request, {
      permission: 'ENROLLMENTS_DELETE',
    });

    const { enrollmentId } = await context.params;

    const deleted = await withTenantContext(schoolId, async (tx) => {
      const enrollment = await tx.enrollment.findFirst({
        where: { id: enrollmentId, schoolId },
      });

      if (!enrollment) {
        throw { status: 404, message: 'এনরোলমেন্ট পাওয়া যায়নি।' };
      }

      // Check dependent activity across all academic subsystems
      const [
        attendanceCount,
        markCount,
        resultCount,
        feeCount,
        paymentCount,
        sourcePromoCount,
        targetPromoCount,
      ] = await Promise.all([
        tx.studentAttendance.count({ where: { enrollmentId } }),
        tx.mark.count({ where: { enrollmentId } }),
        tx.studentExamResult.count({ where: { enrollmentId } }),
        tx.studentFee.count({ where: { enrollmentId } }),
        tx.payment.count({ where: { enrollmentId } }),
        tx.promotionItem.count({ where: { sourceEnrollmentId: enrollmentId } }),
        tx.promotionItem.count({ where: { targetEnrollmentId: enrollmentId } }),
      ]);

      const totalDependencies =
        attendanceCount +
        markCount +
        resultCount +
        feeCount +
        paymentCount +
        sourcePromoCount +
        targetPromoCount;

      if (totalDependencies > 0) {
        throw {
          status: 409,
          message:
            'ঐতিহাসিক একাডেমিক কার্যকলাপ (উপস্থিতি, মার্কস, ফি, ফলাফল বা প্রমোশন) বিদ্যমান থাকায় এই এনরোলমেন্ট মুছে ফেলা সম্ভব নয়। ড্রপড (DROPPED) বা নিষ্ক্রিয় করুন।',
        };
      }

      await tx.enrollment.delete({
        where: { id: enrollmentId },
      });

      return enrollment;
    });

    // Audit Logging
    await logAuditEvent({
      schoolId,
      actorUserId: authContext.userId,
      actorName: authContext.user.fullName || authContext.user.phone || 'Admin',
      actorRole: authContext.user.isSuperAdmin ? 'SUPER_ADMIN' : 'ADMIN',
      action: 'DELETE',
      entity: 'Enrollment',
      entityId: enrollmentId,
      changeSummary: 'ENROLLMENT_DELETED',
      beforeState: {
        studentId: deleted.studentId,
        academicSessionId: deleted.academicSessionId,
        classId: deleted.classId,
        sectionId: deleted.sectionId,
        rollNo: deleted.rollNo,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'এনরোলমেন্ট রেকর্ড সফলভাবে মুছে ফেলা হয়েছে।',
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err.status) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error('Error deleting enrollment:', error);
    return NextResponse.json(
      { success: false, error: 'এনরোলমেন্ট মুছে ফেলতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
