import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { ExamStatus } from '@prisma/client';

/**
 * DELETE /api/school/exams/[examId]/schedules/[scheduleId]
 * Remove an exam schedule entry
 * Required Permission: ACADEMICS_DELETE
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string; scheduleId: string }> }
) {
  try {
    const { context, schoolId } = await requirePermission(request, {
      permission: 'ACADEMICS_DELETE',
    });
    const { examId, scheduleId } = await params;

    const schedule = await prisma.examSchedule.findFirst({
      where: { id: scheduleId, examId, schoolId },
      include: {
        exam: true,
        subject: true,
        class: true,
      },
    });

    if (!schedule) {
      return NextResponse.json({ error: 'Exam schedule entry not found' }, { status: 404 });
    }

    if (schedule.exam.status === ExamStatus.RESULTS_PUBLISHED || schedule.exam.status === ExamStatus.LOCKED) {
      return NextResponse.json(
        { error: 'Cannot delete schedule from an exam whose results have already been published or locked' },
        { status: 400 }
      );
    }

    await withTenantContext(schoolId, async (tx) => {
      await tx.examSchedule.delete({
        where: { id: scheduleId },
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || 'Admin',
      actorRole: 'ADMIN',
      action: 'DELETE',
      entity: 'ExamSchedule',
      entityId: scheduleId,
      beforeState: {
        examId,
        subjectId: schedule.subjectId,
        classId: schedule.classId,
      },
      changeSummary: `Removed ${schedule.subject.nameEn} schedule entry for ${schedule.class.nameEn}`,
    });

    return NextResponse.json({ success: true, message: 'Exam schedule deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting exam schedule:', error);
    if (error.message?.startsWith('UNAUTHORIZED') || error.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
