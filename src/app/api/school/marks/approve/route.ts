import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { MarksApproveSchema } from '@/lib/validation/exam';
import { MarkWorkflowStatus } from '@prisma/client';

/**
 * POST /api/school/marks/approve
 * Approves submitted marks or reverts to draft for revision
 * Required Permission: MARKS_APPROVE
 */
export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, {
      permission: 'MARKS_APPROVE',
    });

    const body = await request.json();
    const parseResult = MarksApproveSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { examId, classId, sectionId, subjectId, status, rejectionReason } = parseResult.data;

    // Find target marks
    const where: any = {
      schoolId,
      examId,
      subjectId,
      enrollment: { classId },
    };

    if (sectionId) {
      where.enrollment.sectionId = sectionId;
    }

    // Enforce state machine transitions:
    // Only SUBMITTED_BY_TEACHER marks can transition to APPROVED
    // DRAFT (unlock/revert) is allowed from SUBMITTED_BY_TEACHER or APPROVED
    if (status === MarkWorkflowStatus.APPROVED) {
      where.status = MarkWorkflowStatus.SUBMITTED_BY_TEACHER;
    } else if (status === MarkWorkflowStatus.DRAFT) {
      where.status = { in: [MarkWorkflowStatus.SUBMITTED_BY_TEACHER, MarkWorkflowStatus.APPROVED] };
    }

    const updated = await withTenantContext(schoolId, async (tx) => {
      // Check count of matching marks under tenant context
      const count = await tx.mark.count({ where });
      if (count === 0) {
        throw {
          status: 400,
          message: status === MarkWorkflowStatus.APPROVED
            ? 'No submitted marks found to approve. Marks must be submitted by the teacher (SUBMITTED_BY_TEACHER) before approval.'
            : 'No marks in submitted or approved state found to revert/unlock to draft.',
        };
      }

      const res = await tx.mark.updateMany({
        where,
        data: {
          status,
          approvedById: status === MarkWorkflowStatus.APPROVED ? context.userId : null,
          approvedAt: status === MarkWorkflowStatus.APPROVED ? new Date() : null,
        },
      });

      return { count: res.count };
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || 'Admin',
      actorRole: 'ADMIN',
      action: status === MarkWorkflowStatus.APPROVED ? 'APPROVE' as any : 'UPDATE',
      entity: 'Mark',
      entityId: `${examId}_${classId}_${subjectId}`,
      afterState: {
        examId,
        classId,
        subjectId,
        sectionId,
        status,
        affectedCount: updated.count,
        rejectionReason: rejectionReason || null,
      },
      changeSummary: `${status === MarkWorkflowStatus.APPROVED ? 'Approved' : 'Reverted to draft'} marks for ${updated.count} students. ${rejectionReason ? 'Reason: ' + rejectionReason : ''}`,
    });

    return NextResponse.json({
      success: true,
      message: status === MarkWorkflowStatus.APPROVED ? 'Marks approved successfully' : 'Marks reverted to draft for revision',
      data: {
        affectedCount: updated.count,
        status,
      },
    });
  } catch (error: any) {
    console.error('Error approving marks:', error);
    if (error?.status && error?.message) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error.message?.startsWith('UNAUTHORIZED') || error.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
