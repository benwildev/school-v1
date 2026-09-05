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

    // Check count of matching marks
    const count = await prisma.mark.count({ where });
    if (count === 0) {
      return NextResponse.json(
        { error: 'No marks found matching the criteria to approve' },
        { status: 404 }
      );
    }

    const updated = await withTenantContext(schoolId, async (tx) => {
      return await tx.mark.updateMany({
        where,
        data: {
          status,
          approvedById: status === MarkWorkflowStatus.APPROVED ? context.userId : null,
          approvedAt: status === MarkWorkflowStatus.APPROVED ? new Date() : null,
        },
      });
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
    if (error.message?.startsWith('UNAUTHORIZED') || error.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
