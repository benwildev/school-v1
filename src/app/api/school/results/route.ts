import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';

/**
 * GET /api/school/results
 * List academic examination results with privacy-safe ranking information
 * Required Permission: MARKS_VIEW
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, {
      permission: 'MARKS_VIEW',
    });

    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('examId');
    const classId = searchParams.get('classId');
    const sectionId = searchParams.get('sectionId');
    const studentId = searchParams.get('studentId');

    const where: any = { schoolId };
    if (examId) where.examId = examId;
    if (classId) where.classId = classId;
    if (sectionId) where.sectionId = sectionId;
    if (studentId) where.studentId = studentId;

    const results = await prisma.studentExamResult.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            studentCode: true,
            fullNameEn: true,
            fullNameBn: true,
            photoUrl: true,
          },
        },
        enrollment: {
          select: {
            id: true,
            rollNo: true,
            class: { select: { id: true, nameEn: true, numericLevel: true } },
            section: { select: { id: true, nameEn: true } },
          },
        },
        exam: {
          select: {
            id: true,
            nameEn: true,
            nameBn: true,
            examType: true,
            status: true,
          },
        },
      },
      orderBy: [
        { classPosition: 'asc' },
        { enrollment: { rollNo: 'asc' } },
      ],
    });

    // Compute summary analytics
    const totalStudents = results.length;
    const passedCount = results.filter((r) => r.isPassed).length;
    const failedCount = totalStudents - passedCount;
    const passPercentage = totalStudents > 0 ? Number(((passedCount / totalStudents) * 100).toFixed(2)) : 0;

    return NextResponse.json({
      data: results,
      meta: {
        totalStudents,
        passedCount,
        failedCount,
        passPercentage,
      },
    });
  } catch (error: any) {
    console.error('Error fetching exam results:', error);
    if (error.message?.startsWith('UNAUTHORIZED') || error.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
