import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { ExamUpdateSchema } from '@/lib/validation/exam';
import { ExamStatus } from '@prisma/client';

const ALLOWED_TRANSITIONS: Record<ExamStatus, ExamStatus[]> = {
  DRAFT: [ExamStatus.SCHEDULED, ExamStatus.DRAFT],
  SCHEDULED: [ExamStatus.ONGOING, ExamStatus.DRAFT, ExamStatus.SCHEDULED],
  ONGOING: [ExamStatus.VALUATION, ExamStatus.ONGOING],
  VALUATION: [ExamStatus.RESULTS_PUBLISHED, ExamStatus.VALUATION],
  RESULTS_PUBLISHED: [ExamStatus.LOCKED, ExamStatus.RESULTS_PUBLISHED],
  LOCKED: [],
};

/**
 * GET /api/school/exams/[examId]
 * Retrieve exam details with full schedule
 * Required Permission: ACADEMICS_VIEW or MARKS_VIEW
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { schoolId } = await requirePermission(request, {
      permission: 'ACADEMICS_VIEW',
    });
    const { examId } = await params;

    const exam = await prisma.exam.findFirst({
      where: { id: examId, schoolId },
      include: {
        academicSession: true,
        schedules: {
          include: {
            class: true,
            subject: true,
            classroom: true,
          },
          orderBy: [
            { examDate: 'asc' },
            { startTime: 'asc' },
          ],
        },
        _count: {
          select: {
            marks: true,
            results: true,
          },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    return NextResponse.json({ data: exam });
  } catch (error: any) {
    console.error('Error fetching exam:', error);
    if (error.message?.startsWith('UNAUTHORIZED') || error.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * PUT /api/school/exams/[examId]
 * Update exam details and lifecycle state machine
 * Required Permission: ACADEMICS_UPDATE
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { context, schoolId } = await requirePermission(request, {
      permission: 'ACADEMICS_UPDATE',
    });
    const { examId } = await params;

    const body = await request.json();
    const parseResult = ExamUpdateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    const existing = await prisma.exam.findFirst({
      where: { id: examId, schoolId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    // State machine check if status is changing
    if (data.status && data.status !== existing.status) {
      const allowedNextStates = ALLOWED_TRANSITIONS[existing.status] || [];
      if (!allowedNextStates.includes(data.status)) {
        return NextResponse.json(
          {
            error: `Invalid status transition from ${existing.status} to ${data.status}. Allowed transitions: ${allowedNextStates.join(', ') || 'None'}`,
          },
          { status: 400 }
        );
      }
    }

    const beforeState = {
      nameEn: existing.nameEn,
      status: existing.status,
      startDate: existing.startDate,
      endDate: existing.endDate,
    };

    const updateData: any = {};
    if (data.nameEn) updateData.nameEn = data.nameEn;
    if (data.nameBn) updateData.nameBn = data.nameBn;
    if (data.examType) updateData.examType = data.examType;
    if (data.term) updateData.term = data.term;
    if (data.weightagePercentage !== undefined) updateData.weightagePercentage = data.weightagePercentage;
    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.endDate) updateData.endDate = new Date(data.endDate);
    if (data.status) updateData.status = data.status;

    const updated = await withTenantContext(schoolId, async (tx) => {
      return await tx.exam.update({
        where: { id: examId },
        data: updateData,
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || 'Admin',
      actorRole: 'ADMIN',
      action: 'UPDATE',
      entity: 'Exam',
      entityId: examId,
      beforeState,
      afterState: {
        nameEn: updated.nameEn,
        status: updated.status,
      },
      changeSummary: `Updated exam "${updated.nameEn}" (Status: ${existing.status} -> ${updated.status})`,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error updating exam:', error);
    if (error.message?.startsWith('UNAUTHORIZED') || error.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
