import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { EnrollmentWithdrawSchema } from '@/lib/validation/enrollment';
import { EnrollmentStatus } from '@prisma/client';

/**
 * POST /api/school/enrollments/withdraw
 * Controlled student withdrawal or transfer-out.
 * Safely changes lifecycle status without deleting any student, enrollment, or academic history.
 * Required Permission: ENROLLMENTS_WITHDRAW
 */
export async function POST(request: NextRequest) {
  try {
    const { schoolId, context } = await requirePermission(request, {
      permission: 'ENROLLMENTS_WITHDRAW',
    });

    const body = await request.json();
    const validation = EnrollmentWithdrawSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'প্রত্যাহার তথ্যে ত্রুটি রয়েছে।',
          details: validation.error.flatten(),
        },
        { status: 422 }
      );
    }

    const { enrollmentId, status, reason, date } = validation.data;

    const result = await withTenantContext(schoolId, async (tx) => {
      const current = await tx.enrollment.findFirst({
        where: { id: enrollmentId, schoolId },
      });

      if (!current) {
        throw { status: 404, message: 'এনরোলমেন্ট পাওয়া যায়নি।' };
      }

      if (current.status !== EnrollmentStatus.ACTIVE) {
        throw {
          status: 400,
          message: `শুধুমাত্র সক্রিয় (ACTIVE) এনরোলমেন্ট প্রত্যাহার বা ট্রান্সফার-আউট করা সম্ভব। বর্তমান স্ট্যাটাস: ${current.status}।`,
        };
      }

      const withdrawNote = `[${date.toISOString()}] Status updated to ${status}. Reason: ${reason}`;
      const updatedRemarks = current.remarks
        ? `${current.remarks}\n${withdrawNote}`
        : withdrawNote;

      const updated = await tx.enrollment.update({
        where: { id: current.id },
        data: {
          status,
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
          remarks: true,
          updatedAt: true,
        },
      });

      return { current, updated };
    });

    // Forensic Audit Logging
    const auditSummary =
      status === EnrollmentStatus.DROPPED ? 'STUDENT_WITHDRAWN' : 'STUDENT_TRANSFERRED_OUT';

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || context.user.phone || 'Admin',
      actorRole: context.user.isSuperAdmin ? 'SUPER_ADMIN' : 'ADMIN',
      action: 'UPDATE',
      entity: 'Enrollment',
      entityId: enrollmentId,
      changeSummary: auditSummary,
      beforeState: {
        status: result.current.status,
      },
      afterState: {
        status: result.updated.status,
        reason,
        date: date.toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message:
        status === EnrollmentStatus.DROPPED
          ? 'শিক্ষার্থী সফলভাবে প্রত্যাহার (Withdrawn) হিসেবে চিহ্নিত হয়েছে।'
          : 'শিক্ষার্থী সফলভাবে ছাড়পত্রপ্রাপ্ত / স্থানান্তরিত (Transferred Out) হিসেবে চিহ্নিত হয়েছে।',
      data: result.updated,
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err.status) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error('Error withdrawing enrollment:', error);
    return NextResponse.json(
      { success: false, error: 'এনরোলমেন্ট প্রত্যাহার প্রক্রিয়া সম্পন্ন করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
