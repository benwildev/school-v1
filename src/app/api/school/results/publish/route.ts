import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { ResultPublishSchema } from '@/lib/validation/exam';
import { ExamStatus, MarkWorkflowStatus } from '@prisma/client';

/**
 * POST /api/school/results/publish
 * Publishes academic examination results, making them visible to students and parents
 * Required Permission: MARKS_PUBLISH
 */
export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, {
      permission: 'MARKS_PUBLISH',
    });

    const body = await request.json();
    const parseResult = ResultPublishSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { examId, classId } = parseResult.data;

    // Verify Exam belongs to this school
    const exam = await prisma.exam.findFirst({
      where: { id: examId, schoolId },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found in this school' }, { status: 404 });
    }

    const resultWhere: any = { schoolId, examId };
    const markWhere: any = { schoolId, examId };
    if (classId) {
      resultWhere.classId = classId;
      markWhere.enrollment = { classId };
    }

    const resultCount = await prisma.studentExamResult.count({ where: resultWhere });
    if (resultCount === 0) {
      return NextResponse.json(
        { error: 'No generated results found for this exam. Generate results before publishing.' },
        { status: 400 }
      );
    }

    const publishDate = new Date();

    await withTenantContext(schoolId, async (tx) => {
      // 1. Update results with publishedAt timestamp
      await tx.studentExamResult.updateMany({
        where: resultWhere,
        data: {
          publishedAt: publishDate,
        },
      });

      // 2. Mark corresponding marks as PUBLISHED
      await tx.mark.updateMany({
        where: markWhere,
        data: {
          status: MarkWorkflowStatus.PUBLISHED,
        },
      });

      // 3. Update Exam status to RESULTS_PUBLISHED
      await tx.exam.update({
        where: { id: examId },
        data: {
          status: ExamStatus.RESULTS_PUBLISHED,
        },
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || 'Admin',
      actorRole: 'ADMIN',
      action: 'PUBLISH' as any,
      entity: 'StudentExamResult',
      entityId: examId,
      afterState: {
        examId,
        publishedCount: resultCount,
        publishedAt: publishDate,
      },
      changeSummary: `Officially published ${resultCount} student exam results for "${exam.nameEn}"`,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully published results for ${resultCount} students. Results are now visible to parents and students.`,
      data: {
        publishedCount: resultCount,
        publishedAt: publishDate,
        examStatus: ExamStatus.RESULTS_PUBLISHED,
      },
    });
  } catch (error: any) {
    console.error('Error publishing results:', error);
    if (error.message?.startsWith('UNAUTHORIZED') || error.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
