import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { AttendanceQuerySchema } from '@/lib/validation/attendance';
import { isAdministrativeStaff } from '@/lib/academic/teacher-scope';

/**
 * GET /api/school/attendance
 * List attendance records with filtering and teacher scope enforcement
 * Required Permission: ATTENDANCE_VIEW
 */
export async function GET(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, {
      permission: 'ATTENDANCE_VIEW',
    });

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const parseResult = AttendanceQuerySchema.safeParse(queryParams);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const filters = parseResult.data;
    const where: any = { schoolId };

    // Teacher Scoping Enforcement
    const isAdmin = await isAdministrativeStaff(context.userId, schoolId);
    if (!isAdmin) {
      // Find teacher profile
      const teacher = await prisma.teacher.findFirst({
        where: { userId: context.userId, schoolId, status: 'ACTIVE' },
      });

      if (!teacher) {
        return NextResponse.json(
          { error: 'No active teacher profile linked to this user' },
          { status: 403 }
        );
      }

      // Fetch teacher's permitted classes/sections
      const assignments = await prisma.teacherAssignment.findMany({
        where: {
          schoolId,
          teacherId: teacher.id,
          status: 'ACTIVE',
        },
        select: { classId: true, sectionId: true },
      });

      if (assignments.length === 0) {
        return NextResponse.json({ data: [], meta: { total: 0 } });
      }

      const assignedSectionIds = assignments.map((a) => a.sectionId);
      where.sectionId = { in: assignedSectionIds };
    }

    if (filters.academicSessionId) where.academicSessionId = filters.academicSessionId;
    if (filters.classId) where.classId = filters.classId;
    if (filters.sectionId) where.sectionId = filters.sectionId;
    if (filters.studentId) where.studentId = filters.studentId;
    if (filters.status) where.status = filters.status;

    if (filters.date) {
      where.date = new Date(filters.date);
    } else if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) where.date.lte = new Date(filters.endDate);
    }

    const attendances = await prisma.studentAttendance.findMany({
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
        markedBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: [
        { date: 'desc' },
        { enrollment: { rollNo: 'asc' } },
      ],
      take: 200,
    });

    return NextResponse.json({
      data: attendances,
      meta: { count: attendances.length },
    });
  } catch (error: any) {
    console.error('Error fetching attendance:', error);
    if (error.message?.startsWith('UNAUTHORIZED') || error.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
