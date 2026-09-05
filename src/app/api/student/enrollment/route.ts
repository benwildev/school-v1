import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSchool } from '@/lib/authorization/engine';
import { prisma } from '@/lib/db';

/**
 * GET /api/student/enrollment
 * Returns active and historical enrollments for the authenticated student.
 */
export async function GET(request: NextRequest) {
  try {
    const { context, schoolId } = await requireActiveSchool(request);

    // Live verification of studentUser link
    const link = await prisma.studentUser.findFirst({
      where: {
        userId: context.userId,
        schoolId,
      },
    });

    if (!link) {
      return NextResponse.json(
        { success: false, error: 'এই বিদ্যালয়ে আপনার কোনো শিক্ষার্থী প্রোফাইল সংযুক্ত নেই।' },
        { status: 403 }
      );
    }

    const enrollments = await prisma.enrollment.findMany({
      where: {
        studentId: link.studentId,
        schoolId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        class: { select: { id: true, nameEn: true, nameBn: true } },
        section: { select: { id: true, nameEn: true, nameBn: true } },
        academicSession: { select: { id: true, name: true, startDate: true, endDate: true } },
      },
    });

    const formatted = enrollments.map((e) => ({
      id: e.id,
      sessionName: e.academicSession.name,
      startDate: e.academicSession.startDate,
      endDate: e.academicSession.endDate,
      classNameEn: e.class.nameEn,
      classNameBn: e.class.nameBn,
      sectionNameEn: e.section.nameEn,
      sectionNameBn: e.section.nameBn,
      rollNo: e.rollNo,
      enrollmentType: e.enrollmentType,
      status: e.status,
      enrollmentDate: e.enrollmentDate,
    }));

    return NextResponse.json({
      success: true,
      data: formatted,
    });
  } catch (error: any) {
    if (error?.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error?.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    console.error('Error fetching student enrollments:', error);
    return NextResponse.json(
      { success: false, error: 'এনরোলমেন্ট তথ্য লোড করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
