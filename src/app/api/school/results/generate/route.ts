import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { ResultGenerateSchema } from '@/lib/validation/exam';
import { calculateOverallGpa, rankStudentResults, SubjectScoreInput, StudentRankCandidate } from '@/lib/academic/grading';
import { ExamStatus, AuditAction } from '@prisma/client';

interface CandidateResult extends StudentRankCandidate {
  studentId: string;
  classId: string;
  totalFullMarks: number;
  finalGrade: string;
  isPassed: boolean;
  failedSubjectsCount: number;
}

/**
 * POST /api/school/results/generate
 * Generates official NCTB GPA, grades, and merit positions from marks for an exam and class
 * Required Permission: MARKS_APPROVE or MARKS_PUBLISH
 */
export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, {
      permission: 'MARKS_APPROVE',
    });

    const body = await request.json();
    const parseResult = ResultGenerateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { examId, classId, sectionId } = parseResult.data;

    // 1. Verify Exam and Class exist in this school
    const [exam, classObj] = await Promise.all([
      prisma.exam.findFirst({ where: { id: examId, schoolId } }),
      prisma.class.findFirst({ where: { id: classId, schoolId } }),
    ]);

    if (!exam) return NextResponse.json({ error: 'Exam not found in this school' }, { status: 404 });
    if (!classObj) return NextResponse.json({ error: 'Class not found in this school' }, { status: 404 });

    // 2. Fetch all scheduled subjects for this exam and class
    const schedules = await prisma.examSchedule.findMany({
      where: { examId, classId, schoolId },
      include: { subject: true },
    });

    if (schedules.length === 0) {
      return NextResponse.json(
        { error: 'No subjects have been scheduled for this exam and class' },
        { status: 400 }
      );
    }

    // 3. Fetch all active enrollments for this class (and section if specified)
    const enrollmentWhere: any = {
      schoolId,
      academicSessionId: exam.academicSessionId,
      classId,
      status: 'ACTIVE',
    };
    if (sectionId) {
      enrollmentWhere.sectionId = sectionId;
    }

    const enrollments = await prisma.enrollment.findMany({
      where: enrollmentWhere,
      select: {
        id: true,
        studentId: true,
        classId: true,
        sectionId: true,
        rollNo: true,
      },
    });

    if (enrollments.length === 0) {
      return NextResponse.json(
        { error: 'No active enrollments found for this class and session' },
        { status: 404 }
      );
    }

    const enrollmentIds = enrollments.map((e) => e.id);

    // 4. Fetch all marks recorded for this exam and these enrollments
    const marks = await prisma.mark.findMany({
      where: {
        schoolId,
        examId,
        enrollmentId: { in: enrollmentIds },
      },
      include: {
        subject: true,
      },
    });

    // Group marks by enrollmentId
    const marksByEnrollment = new Map<string, typeof marks>();
    for (const m of marks) {
      const list = marksByEnrollment.get(m.enrollmentId) || [];
      list.push(m);
      marksByEnrollment.set(m.enrollmentId, list);
    }

    // 5. Calculate GPA and Grades for each enrollment
    const candidateResults: CandidateResult[] = [];
    let totalFullMarksForExam = 0;
    for (const sched of schedules) {
      totalFullMarksForExam += Number(sched.fullMarks);
    }

    for (const enroll of enrollments) {
      const studentMarks = marksByEnrollment.get(enroll.id) || [];

      const subjectScoreInputs: SubjectScoreInput[] = [];
      let totalObtained = 0;

      for (const sched of schedules) {
        const markRecord = studentMarks.find((m) => m.subjectId === sched.subjectId);
        const obtained = markRecord ? Number(markRecord.totalObtained) : 0;
        const isAbsent = markRecord ? markRecord.isAbsent : true;
        const fullMarks = Number(sched.fullMarks);
        const passMarks = Number(sched.passMarks);
        const isOptionalFourth = sched.subject.subjectType === 'OPTIONAL_FOURTH';

        totalObtained += obtained;

        subjectScoreInputs.push({
          subjectId: sched.subjectId,
          subjectCode: sched.subject.code,
          subjectName: sched.subject.nameEn,
          fullMarks,
          passMarks,
          obtainedMarks: obtained,
          isAbsent,
          isOptionalFourth,
        });
      }

      const gpaResult = calculateOverallGpa(subjectScoreInputs);

      candidateResults.push({
        enrollmentId: enroll.id,
        studentId: enroll.studentId,
        classId: enroll.classId,
        sectionId: enroll.sectionId,
        totalMarksObtained: totalObtained,
        totalFullMarks: totalFullMarksForExam,
        calculatedGpa: gpaResult.gpa,
        finalGrade: gpaResult.finalGrade,
        isPassed: gpaResult.isPassed,
        failedSubjectsCount: gpaResult.failedSubjectsCount,
      });
    }

    // 6. Calculate Merit Positions (Class rank and Section rank)
    const rankedResults = rankStudentResults(candidateResults);

    // 7. Persist generated results in atomic transaction
    const savedResults = await withTenantContext(schoolId, async (tx) => {
      const records = [];
      for (const res of rankedResults) {
        const record = await tx.studentExamResult.upsert({
          where: {
            schoolId_examId_enrollmentId: {
              schoolId,
              examId,
              enrollmentId: res.enrollmentId,
            },
          },
          update: {
            studentId: res.studentId,
            classId: res.classId,
            sectionId: res.sectionId,
            totalMarksObtained: res.totalMarksObtained,
            totalFullMarks: res.totalFullMarks,
            calculatedGpa: res.calculatedGpa,
            finalGrade: res.finalGrade,
            isPassed: res.isPassed,
            failedSubjectsCount: res.failedSubjectsCount,
            classPosition: res.classPosition || null,
            sectionPosition: res.sectionPosition || null,
          },
          create: {
            schoolId,
            examId,
            studentId: res.studentId,
            enrollmentId: res.enrollmentId,
            classId: res.classId,
            sectionId: res.sectionId,
            totalMarksObtained: res.totalMarksObtained,
            totalFullMarks: res.totalFullMarks,
            calculatedGpa: res.calculatedGpa,
            finalGrade: res.finalGrade,
            isPassed: res.isPassed,
            failedSubjectsCount: res.failedSubjectsCount,
            classPosition: res.classPosition || null,
            sectionPosition: res.sectionPosition || null,
          },
        });
        records.push(record);
      }

      // Update exam status to VALUATION if in ONGOING/DRAFT
      if (exam.status !== ExamStatus.RESULTS_PUBLISHED && exam.status !== ExamStatus.LOCKED) {
        await tx.exam.update({
          where: { id: examId },
          data: { status: ExamStatus.VALUATION },
        });
      }

      return records;
    });

    // 8. Forensic Audit Log
    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || 'Admin',
      actorRole: 'ADMIN',
      action: AuditAction.INSERT,
      entity: 'StudentExamResult',
      entityId: `${examId}_${classId}`,
      afterState: {
        examId,
        classId,
        sectionId,
        generatedCount: savedResults.length,
      },
      changeSummary: `Generated academic results and merit ranks for ${savedResults.length} students in ${classObj.nameEn}`,
    });

    return NextResponse.json({
      success: true,
      message: `Generated academic results for ${savedResults.length} students`,
      data: {
        generatedCount: savedResults.length,
        examId,
        classId,
      },
    });
  } catch (error: any) {
    console.error('Error generating results:', error);
    if (error.message?.startsWith('UNAUTHORIZED') || error.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
