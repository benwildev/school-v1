import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/authorization/engine';
import { MarkWorkflowStatus } from '@prisma/client';

/**
 * GET /api/student/results
 * Student portal endpoint to view own published academic results
 */
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth(request);

    // Find student identity for the authenticated student user
    const studentUser = await prisma.studentUser.findUnique({
      where: { userId: context.userId },
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

    if (!studentUser) {
      return NextResponse.json(
        { error: 'No student profile linked to this account.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('examId');

    // Publication Gate: Only fetch results that have been officially published
    const where: any = {
      studentId: studentUser.studentId,
      schoolId: studentUser.student.schoolId,
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

    // Fetch published subject breakdown
    const detailedResults = await Promise.all(
      results.map(async (res) => {
        const marks = await prisma.mark.findMany({
          where: {
            schoolId: studentUser.student.schoolId,
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
      student: studentUser.student,
      data: detailedResults,
    });
  } catch (error: any) {
    console.error('Error fetching student results:', error);
    if (error.message?.startsWith('UNAUTHORIZED') || error.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
