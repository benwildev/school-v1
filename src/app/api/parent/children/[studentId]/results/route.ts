import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/authorization/engine';
import { MarkWorkflowStatus } from '@prisma/client';

/**
 * GET /api/parent/children/[studentId]/results
 * Parent portal endpoint to view child's published academic results with strict IDOR verification & publication gate
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const context = await requireAuth(request);
    const { studentId } = await params;

    // 1. Strict IDOR Protection: Verify caller is an active guardian of this child
    const guardianRelation = await prisma.studentGuardian.findFirst({
      where: {
        studentId,
        guardian: {
          userId: context.userId,
        },
      },
      include: {
        student: {
          select: {
            id: true,
            schoolId: true,
            studentCode: true,
            fullNameEn: true,
            fullNameBn: true,
          },
        },
      },
    });

    if (!guardianRelation) {
      return NextResponse.json(
        { error: 'Forbidden: You are not authorized to view results for this student.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('examId');

    // 2. Publication Gate: Only fetch results that have been officially published
    const where: any = {
      studentId,
      schoolId: guardianRelation.student.schoolId,
      publishedAt: { not: null },
    };

    if (examId) where.examId = examId;

    const results = await prisma.studentExamResult.findMany({
      where,
      include: {
        exam: {
          select: {
            id: true,
            nameEn: true,
            nameBn: true,
            examType: true,
            term: true,
          },
        },
        enrollment: {
          select: {
            rollNo: true,
            academicSession: { select: { id: true, name: true } },
            class: { select: { id: true, nameEn: true, nameBn: true } },
            section: { select: { id: true, nameEn: true, nameBn: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Also fetch published subject breakdown for each result
    const detailedResults = await Promise.all(
      results.map(async (res) => {
        const marks = await prisma.mark.findMany({
          where: {
            schoolId: guardianRelation.student.schoolId,
            examId: res.examId,
            enrollmentId: res.enrollmentId,
            status: MarkWorkflowStatus.PUBLISHED,
          },
          include: {
            subject: {
              select: {
                id: true,
                code: true,
                nameEn: true,
                nameBn: true,
                subjectType: true,
              },
            },
          },
          orderBy: { subject: { code: 'asc' } },
        });

        return {
          ...res,
          subjectMarks: marks,
        };
      })
    );

    return NextResponse.json({
      student: guardianRelation.student,
      data: detailedResults,
    });
  } catch (error: any) {
    console.error('Error fetching parent child results:', error);
    if (error.message?.startsWith('UNAUTHORIZED') || error.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
