import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { MarksBulkSaveSchema } from '@/lib/validation/exam';
import { verifyTeacherMarksScope, isAdministrativeStaff } from '@/lib/academic/teacher-scope';
import { calculateSubjectGrade } from '@/lib/academic/grading';
import { MarkWorkflowStatus, ExamStatus } from '@prisma/client';

/**
 * POST /api/school/marks/bulk
 * Bulk save draft or submit student marks with teacher scoping, component boundary checks, and NCTB grading
 * Required Permission: MARKS_CREATE or MARKS_UPDATE
 */
export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, {
      permission: 'MARKS_CREATE',
    });

    const body = await request.json();
    const parseResult = MarksBulkSaveSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { examId, classId, sectionId, subjectId, academicSessionId, isSubmission, marks } = parseResult.data;

    // 1. Authoritative Teacher Scope Check
    const scopeCheck = await verifyTeacherMarksScope({
      userId: context.userId,
      schoolId,
      academicSessionId,
      classId,
      sectionId,
      subjectId,
    });

    if (!scopeCheck.isAuthorized) {
      return NextResponse.json(
        { error: scopeCheck.reason || 'Forbidden: You are not assigned to enter marks for this subject and section.' },
        { status: 403 }
      );
    }

    // 2. Validate Exam status (cannot enter marks for LOCKED exams)
    const exam = await prisma.exam.findFirst({
      where: { id: examId, schoolId },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found in this school' }, { status: 404 });
    }

    if (exam.status === ExamStatus.LOCKED) {
      return NextResponse.json({ error: 'This exam is locked. Marks entry is disabled.' }, { status: 400 });
    }

    // 3. Fetch Subject & ExamSchedule (to get full marks and component limits)
    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, classId, schoolId },
    });

    if (!subject) {
      return NextResponse.json({ error: 'Subject not found for this class and school' }, { status: 404 });
    }

    const schedule = await prisma.examSchedule.findFirst({
      where: { examId, classId, subjectId, schoolId },
    });

    const fullMarks = schedule ? Number(schedule.fullMarks) : Number(subject.totalFullMarks);
    const passMarks = schedule ? Number(schedule.passMarks) : Number(subject.passMarks);
    const theoryMax = Number(subject.theoryMarks);
    const mcqMax = Number(subject.mcqMarks);
    const practicalMax = Number(subject.practicalMarks);

    // 4. Validate Enrollments
    const enrollmentIds = marks.map((m) => m.enrollmentId);
    const validEnrollments = await prisma.enrollment.findMany({
      where: {
        id: { in: enrollmentIds },
        schoolId,
        academicSessionId,
        classId,
        sectionId,
        status: 'ACTIVE',
      },
      select: { id: true, studentId: true },
    });

    if (validEnrollments.length !== marks.length) {
      return NextResponse.json(
        { error: 'One or more students do not have active enrollments in this section' },
        { status: 400 }
      );
    }

    // 5. Prevent teachers from editing APPROVED or PUBLISHED marks
    const isAdmin = await isAdministrativeStaff(context.userId, schoolId);
    if (!isAdmin) {
      const existingLockedMarks = await prisma.mark.findMany({
        where: {
          schoolId,
          examId,
          subjectId,
          enrollmentId: { in: enrollmentIds },
          status: { in: [MarkWorkflowStatus.APPROVED, MarkWorkflowStatus.PUBLISHED] },
        },
      });

      if (existingLockedMarks.length > 0) {
        return NextResponse.json(
          {
            error: 'Cannot edit marks that have already been approved or published. Contact administrative staff for revisions.',
          },
          { status: 403 }
        );
      }
    }

    const targetWorkflowStatus = isSubmission
      ? MarkWorkflowStatus.SUBMITTED_BY_TEACHER
      : MarkWorkflowStatus.DRAFT;

    // 6. Validate each mark component bounds and calculate grade
    const processedMarks: any[] = [];
    for (const m of marks) {
      if (m.isAbsent) {
        processedMarks.push({
          ...m,
          theoryObtained: 0,
          mcqObtained: 0,
          practicalObtained: 0,
          vivaObtained: 0,
          caObtained: 0,
          totalObtained: 0,
          gradePoint: 0.00,
          letterGrade: 'F',
        });
        continue;
      }

      // Check component bounds if subject defines them
      if (m.theoryObtained > theoryMax) {
        return NextResponse.json(
          { error: `Theory marks (${m.theoryObtained}) cannot exceed max theory marks (${theoryMax})` },
          { status: 400 }
        );
      }
      if (m.mcqObtained > mcqMax) {
        return NextResponse.json(
          { error: `MCQ marks (${m.mcqObtained}) cannot exceed max MCQ marks (${mcqMax})` },
          { status: 400 }
        );
      }
      if (m.practicalObtained > practicalMax) {
        return NextResponse.json(
          { error: `Practical marks (${m.practicalObtained}) cannot exceed max practical marks (${practicalMax})` },
          { status: 400 }
        );
      }

      const totalObtained = Number((
        m.theoryObtained +
        m.mcqObtained +
        m.practicalObtained +
        m.vivaObtained +
        m.caObtained
      ).toFixed(2));

      if (totalObtained > fullMarks) {
        return NextResponse.json(
          { error: `Total obtained marks (${totalObtained}) cannot exceed full marks (${fullMarks})` },
          { status: 400 }
        );
      }

      const gradeInfo = calculateSubjectGrade(totalObtained, fullMarks, passMarks, false);

      processedMarks.push({
        ...m,
        totalObtained,
        gradePoint: gradeInfo.gradePoint,
        letterGrade: gradeInfo.letterGrade,
      });
    }

    // 7. Atomic transaction for upserting marks
    const results = await withTenantContext(schoolId, async (tx) => {
      const saved = [];
      for (const item of processedMarks) {
        const record = await tx.mark.upsert({
          where: {
            schoolId_examId_subjectId_enrollmentId: {
              schoolId,
              examId,
              subjectId,
              enrollmentId: item.enrollmentId,
            },
          },
          update: {
            studentId: item.studentId,
            theoryObtained: item.theoryObtained,
            mcqObtained: item.mcqObtained,
            practicalObtained: item.practicalObtained,
            vivaObtained: item.vivaObtained,
            caObtained: item.caObtained,
            totalObtained: item.totalObtained,
            gradePoint: item.gradePoint,
            letterGrade: item.letterGrade,
            isAbsent: item.isAbsent,
            status: targetWorkflowStatus,
            enteredById: context.userId,
            enteredAt: new Date(),
          },
          create: {
            schoolId,
            examId,
            subjectId,
            enrollmentId: item.enrollmentId,
            studentId: item.studentId,
            theoryObtained: item.theoryObtained,
            mcqObtained: item.mcqObtained,
            practicalObtained: item.practicalObtained,
            vivaObtained: item.vivaObtained,
            caObtained: item.caObtained,
            totalObtained: item.totalObtained,
            gradePoint: item.gradePoint,
            letterGrade: item.letterGrade,
            isAbsent: item.isAbsent,
            status: targetWorkflowStatus,
            enteredById: context.userId,
          },
        });
        saved.push(record);
      }
      return saved;
    });

    // 8. Forensic Audit Log
    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || 'Teacher',
      actorRole: scopeCheck.isPrivilegedAdmin ? 'ADMIN' : 'TEACHER',
      action: isSubmission ? 'SUBMIT' as any : 'UPDATE',
      entity: 'Mark',
      entityId: `${examId}_${subjectId}_${sectionId}`,
      afterState: {
        examId,
        subjectId,
        sectionId,
        count: results.length,
        status: targetWorkflowStatus,
      },
      changeSummary: `${isSubmission ? 'Submitted' : 'Saved draft'} marks for ${results.length} students in ${subject.nameEn}`,
    });

    return NextResponse.json({
      success: true,
      message: isSubmission ? 'Marks submitted successfully' : 'Draft marks saved successfully',
      data: {
        savedCount: results.length,
        workflowStatus: targetWorkflowStatus,
      },
    });
  } catch (error: any) {
    console.error('Error saving bulk marks:', error);
    if (error.message?.startsWith('UNAUTHORIZED') || error.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
