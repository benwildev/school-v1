import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSchool } from '@/lib/authorization/engine';
import { prisma } from '@/lib/db';

/**
 * GET /api/parent/me
 * Returns authenticated parent profile and the list of verified linked children in the active school.
 */
export async function GET(request: NextRequest) {
  try {
    const { context, schoolId } = await requireActiveSchool(request);

    // Live verification of guardian identity
    const guardians = await prisma.guardian.findMany({
      where: {
        userId: context.userId,
        schoolId,
      },
      include: {
        students: {
          include: {
            student: {
              select: {
                id: true,
                studentCode: true,
                fullNameEn: true,
                fullNameBn: true,
                dateOfBirth: true,
                gender: true,
                bloodGroup: true,
                photoUrl: true,
                status: true,
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
        },
      },
    });

    if (guardians.length === 0) {
      return NextResponse.json(
        { success: false, error: 'এই বিদ্যালয়ে আপনার কোনো অভিভাবক প্রোফাইল সংযুক্ত নেই।' },
        { status: 403 }
      );
    }

    const primaryGuardian = guardians[0];

    // Collect all authorized children across this guardian's profile(s)
    const childrenMap = new Map();
    for (const g of guardians) {
      for (const rel of g.students) {
        if (!childrenMap.has(rel.student.id)) {
          const activeEnrollment = rel.student.enrollments[0]
            ? {
                classNameEn: rel.student.enrollments[0].class.nameEn,
                classNameBn: rel.student.enrollments[0].class.nameBn,
                sectionNameEn: rel.student.enrollments[0].section.nameEn,
                sectionNameBn: rel.student.enrollments[0].section.nameBn,
                rollNo: rel.student.enrollments[0].rollNo,
                sessionName: rel.student.enrollments[0].academicSession.name,
              }
            : null;

          childrenMap.set(rel.student.id, {
            studentId: rel.student.id,
            studentCode: rel.student.studentCode,
            fullNameEn: rel.student.fullNameEn,
            fullNameBn: rel.student.fullNameBn,
            dateOfBirth: rel.student.dateOfBirth,
            gender: rel.student.gender,
            bloodGroup: rel.student.bloodGroup,
            photoUrl: rel.student.photoUrl,
            relationType: rel.isPrimary ? primaryGuardian.relationType : g.relationType,
            isPrimary: rel.isPrimary,
            canPickUp: rel.canPickUp,
            isFinancialPayer: rel.isFinancialPayer,
            activeEnrollment,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        guardian: {
          id: primaryGuardian.id,
          fullNameEn: primaryGuardian.fullNameEn,
          fullNameBn: primaryGuardian.fullNameBn,
          phone: primaryGuardian.phone,
          email: primaryGuardian.email,
          relationType: primaryGuardian.relationType,
        },
        children: Array.from(childrenMap.values()),
      },
    });
  } catch (error: any) {
    if (error?.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error?.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    console.error('Error fetching parent portal profile:', error);
    return NextResponse.json(
      { success: false, error: 'অভিভাবক প্রোফাইল লোড করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
