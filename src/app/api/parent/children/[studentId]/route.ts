import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSchool } from '@/lib/authorization/engine';
import { prisma } from '@/lib/db';

/**
 * GET /api/parent/children/[studentId]
 * Returns detailed records for a specific child ONLY if the authenticated parent is an authorized guardian.
 * Explicitly guards against ID tampering across unrelated students.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;

  try {
    const { context, schoolId } = await requireActiveSchool(request);

    // Live relationship verification: MUST have active StudentGuardian link in this school
    const relationship = await prisma.studentGuardian.findFirst({
      where: {
        studentId,
        schoolId,
        guardian: {
          userId: context.userId,
          schoolId,
        },
      },
      include: {
        student: {
          include: {
            enrollments: {
              where: { schoolId },
              orderBy: { createdAt: 'desc' },
              include: {
                class: { select: { id: true, nameEn: true, nameBn: true } },
                section: { select: { id: true, nameEn: true, nameBn: true } },
                academicSession: { select: { id: true, name: true } },
              },
            },
            emergencyContacts: true,
          },
        },
        guardian: {
          select: {
            id: true,
            fullNameEn: true,
            relationType: true,
          },
        },
      },
    });

    if (!relationship) {
      // Return 403 to prevent horizontal privilege escalation or studentId tampering
      return NextResponse.json(
        { success: false, error: 'এই শিক্ষার্থীর তথ্য দেখার অনুমতি আপনার নেই।' },
        { status: 403 }
      );
    }

    const student = relationship.student;
    const activeEnrollment = student.enrollments.find((e) => e.status === 'ACTIVE') || student.enrollments[0];

    return NextResponse.json({
      success: true,
      data: {
        child: {
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
          photoUrl: student.photoUrl,
          status: student.status,
          presentAddressLine: student.presentAddressLine,
          presentDistrict: student.presentDistrict,
          relationship: {
            relationType: relationship.guardian.relationType,
            isPrimary: relationship.isPrimary,
            canPickUp: relationship.canPickUp,
            isFinancialPayer: relationship.isFinancialPayer,
          },
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
          enrollmentHistory: student.enrollments.map((e) => ({
            id: e.id,
            sessionName: e.academicSession.name,
            className: e.class.nameEn,
            sectionName: e.section.nameEn,
            rollNo: e.rollNo,
            status: e.status,
          })),
          emergencyContacts: student.emergencyContacts.map((c) => ({
            name: c.name,
            relation: c.relation,
            phone: c.phone,
          })),
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
    console.error('Error fetching child details:', error);
    return NextResponse.json(
      { success: false, error: 'শিক্ষার্থীর তথ্য লোড করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
