import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { isAdministrativeStaff } from '@/lib/academic/teacher-scope';

/**
 * GET /api/school/marks
 * List marks with filtering and teacher scope enforcement
 * Required Permission: MARKS_VIEW
 */
export async function GET(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, {
      permission: 'MARKS_VIEW',
    });

    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('examId');
    const classId = searchParams.get('classId');
    const sectionId = searchParams.get('sectionId');
    const subjectId = searchParams.get('subjectId');
    const studentId = searchParams.get('studentId');

    const where: any = { schoolId };

    // Teacher Scoping Enforcement
    const isAdmin = await isAdministrativeStaff(context.userId, schoolId);
    if (!isAdmin) {
      const teacher = await prisma.teacher.findFirst({
        where: { userId: context.userId, schoolId, status: 'ACTIVE' },
      });

      if (!teacher) {
        return NextResponse.json(
          { error: 'No active teacher profile linked to this user' },
          { status: 403 }
        );
      }

      // Check assignments
      const assignments = await prisma.teacherAssignment.findMany({
        where: {
          schoolId,
          teacherId: teacher.id,
          status: 'ACTIVE',
        },
      });

      if (assignments.length === 0) {
        return NextResponse.json({ data: [] });
      }

      // If specific subject/section requested, verify teacher assignment
      if (subjectId && sectionId) {
        const hasAssignment = assignments.some(
          (a) => a.sectionId === sectionId && (a.subjectId === subjectId || a.subjectId === null)
        );
        if (!hasAssignment) {
          return NextResponse.json(
            { error: 'Forbidden: You are not assigned to view marks for this subject/section.' },
            { status: 403 }
          );
        }
      }
    }

    if (examId) where.examId = examId;
    if (subjectId) where.subjectId = subjectId;
    if (studentId) where.studentId = studentId;

    if (classId || sectionId) {
      where.enrollment = {};
      if (classId) where.enrollment.classId = classId;
      if (sectionId) where.enrollment.sectionId = sectionId;
    }

    const marks = await prisma.mark.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            studentCode: true,
            fullNameEn: true,
            fullNameBn: true,
          },
        },
        enrollment: {
          select: {
            id: true,
            rollNo: true,
            class: { select: { id: true, nameEn: true } },
            section: { select: { id: true, nameEn: true } },
          },
        },
        subject: {
          select: {
            id: true,
            code: true,
            nameEn: true,
            nameBn: true,
            subjectType: true,
          },
        },
        enteredBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: [
        { enrollment: { rollNo: 'asc' } },
      ],
    });

    return NextResponse.json({ data: marks });
  } catch (error: any) {
    console.error('Error fetching marks:', error);
    if (error.message?.startsWith('UNAUTHORIZED') || error.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
