import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSchool } from '@/lib/authorization/engine';
import { prisma } from '@/lib/db';

/**
 * GET /api/student/me
 * Returns authenticated student profile and active academic placement.
 * Identity is derived strictly from server-side session and student_users join model.
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
      include: {
        student: {
          include: {
            enrollments: {
              where: { status: 'ACTIVE' },
              take: 1,
              include: {
                class: { select: { id: true, nameEn: true, nameBn: true } },
                section: { select: { id: true, nameEn: true, nameBn: true } },
                academicSession: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!link || !link.student) {
      return NextResponse.json(
        { success: false, error: 'এই বিদ্যালয়ে আপনার কোনো শিক্ষার্থী প্রোফাইল সংযুক্ত নেই।' },
        { status: 403 }
      );
    }

    const student = link.student;
    const activeEnrollment = student.enrollments[0];

    return NextResponse.json({
      success: true,
      data: {
        student: {
          id: student.id,
          studentCode: student.studentCode,
          firstNameEn: student.firstNameEn,
          lastNameEn: student.lastNameEn,
          fullNameEn: student.fullNameEn,
          fullNameBn: student.fullNameBn,
          dateOfBirth: student.dateOfBirth,
          gender: student.gender,
          bloodGroup: student.bloodGroup,
          religion: student.religion,
          phone: student.phone,
          email: student.email,
          photoUrl: student.photoUrl,
          status: student.status,
          currentPlacement: activeEnrollment
            ? {
                sessionName: activeEnrollment.academicSession.name,
                classNameEn: activeEnrollment.class.nameEn,
                classNameBn: activeEnrollment.class.nameBn,
                sectionNameEn: activeEnrollment.section.nameEn,
                sectionNameBn: activeEnrollment.section.nameBn,
                rollNo: activeEnrollment.rollNo,
                enrollmentDate: activeEnrollment.enrollmentDate,
                enrollmentType: activeEnrollment.enrollmentType,
              }
            : null,
        },
      },
    });
  } catch (error: any) {
    if (error?.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error?.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    console.error('Error fetching student portal profile:', error);
    return NextResponse.json(
      { success: false, error: 'শিক্ষার্থী প্রোফাইল লোড করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
