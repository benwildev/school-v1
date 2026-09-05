import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { ExamScheduleCreateSchema } from '@/lib/validation/exam';
import { AuditAction } from '@prisma/client';

/**
 * GET /api/school/exams/[examId]/schedules
 * List schedules for an exam
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

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');

    const where: any = { schoolId, examId };
    if (classId) where.classId = classId;

    const schedules = await prisma.examSchedule.findMany({
      where,
      include: {
        class: true,
        subject: true,
        classroom: true,
      },
      orderBy: [
        { examDate: 'asc' },
        { startTime: 'asc' },
      ],
    });

    return NextResponse.json({ data: schedules });
  } catch (error: any) {
    console.error('Error fetching exam schedules:', error);
    if (error.message?.startsWith('UNAUTHORIZED') || error.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/school/exams/[examId]/schedules
 * Add subject to exam schedule with class/subject integrity verification
 * Required Permission: ACADEMICS_CREATE
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { context, schoolId } = await requirePermission(request, {
      permission: 'ACADEMICS_CREATE',
    });
    const { examId } = await params;

    const body = await request.json();
    const parseResult = ExamScheduleCreateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // 1. Verify Exam belongs to this school
    const exam = await prisma.exam.findFirst({
      where: { id: examId, schoolId },
    });
    if (!exam) {
      return NextResponse.json({ error: 'Exam not found in this school' }, { status: 404 });
    }

    // 2. Verify Class belongs to this school
    const classObj = await prisma.class.findFirst({
      where: { id: data.classId, schoolId },
    });
    if (!classObj) {
      return NextResponse.json({ error: 'Class not found in this school' }, { status: 404 });
    }

    // 3. Verify Subject belongs to THIS class and school
    const subject = await prisma.subject.findFirst({
      where: {
        id: data.subjectId,
        classId: data.classId,
        schoolId,
      },
    });
    if (!subject) {
      return NextResponse.json(
        { error: `Subject does not belong to ${classObj.nameEn} in this school.` },
        { status: 400 }
      );
    }

    // 4. Verify Classroom belongs to school if provided
    if (data.classroomId) {
      const room = await prisma.classroom.findFirst({
        where: { id: data.classroomId, schoolId },
      });
      if (!room) {
        return NextResponse.json({ error: 'Classroom not found in this school' }, { status: 400 });
      }
    }

    // 5. Uniqueness check for (examId, classId, subjectId)
    const existing = await prisma.examSchedule.findFirst({
      where: {
        schoolId,
        examId,
        classId: data.classId,
        subjectId: data.subjectId,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `A schedule entry for ${subject.nameEn} already exists in this exam for ${classObj.nameEn}` },
        { status: 409 }
      );
    }

    // Time parsing (stored as dummy date with time or parsed Date)
    const startTimeDate = new Date(`1970-01-01T${data.startTime.length === 5 ? data.startTime + ':00' : data.startTime}Z`);
    const endTimeDate = new Date(`1970-01-01T${data.endTime.length === 5 ? data.endTime + ':00' : data.endTime}Z`);

    const schedule = await withTenantContext(schoolId, async (tx) => {
      return await tx.examSchedule.create({
        data: {
          schoolId,
          examId,
          classId: data.classId,
          subjectId: data.subjectId,
          examDate: new Date(data.examDate),
          startTime: startTimeDate,
          endTime: endTimeDate,
          fullMarks: data.fullMarks,
          passMarks: data.passMarks,
          classroomId: data.classroomId || null,
        },
        include: {
          class: true,
          subject: true,
        },
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || 'Admin',
      actorRole: 'ADMIN',
      action: AuditAction.INSERT,
      entity: 'ExamSchedule',
      entityId: schedule.id,
      afterState: {
        examId,
        classId: data.classId,
        subjectId: data.subjectId,
        examDate: data.examDate,
      },
      changeSummary: `Scheduled ${subject.nameEn} for ${classObj.nameEn} on ${data.examDate}`,
    });

    return NextResponse.json({ success: true, data: schedule }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating exam schedule:', error);
    if (error.message?.startsWith('UNAUTHORIZED') || error.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
