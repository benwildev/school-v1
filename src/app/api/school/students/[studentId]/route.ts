import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { StudentUpdateSchema } from '@/lib/validation/student';

interface RouteContext {
  params: Promise<{ studentId: string }>;
}

/**
 * GET /api/school/students/[studentId]
 * Retrieve detailed permanent student profile with read-only academic history.
 * Required Permission: STUDENTS_VIEW
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { studentId } = await params;
    const { schoolId } = await requirePermission(request, {
      permission: 'STUDENTS_VIEW',
    });

    const student = await withTenantContext(schoolId, async (tx) => {
      return tx.student.findFirst({
        where: {
          id: studentId,
          schoolId,
          deletedAt: null,
        },
        include: {
          emergencyContacts: true,
          enrollments: {
            orderBy: { createdAt: 'desc' },
            include: {
              academicSession: {
                select: { id: true, name: true, isCurrent: true },
              },
              campus: {
                select: { id: true, nameEn: true, nameBn: true },
              },
              class: {
                select: { id: true, nameEn: true, nameBn: true, numericLevel: true },
              },
              section: {
                select: { id: true, nameEn: true, nameBn: true },
              },
              group: {
                select: { id: true, nameEn: true, nameBn: true },
              },
            },
          },
        },
      });
    });

    if (!student) {
      return NextResponse.json(
        { success: false, error: 'শিক্ষার্থী পাওয়া যায়নি।' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: student,
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: 'অননুমোদিত এক্সেস।' }, { status: 401 });
    }
    if (err.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json(
        { success: false, error: err.message.replace('FORBIDDEN: ', '') },
        { status: 403 }
      );
    }

    console.error('GET /api/school/students/[studentId] error:', error);
    return NextResponse.json(
      { success: false, error: 'শিক্ষার্থীর তথ্য লোড করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/school/students/[studentId]
 * Update permanent demographics or lifecycle status of student.
 * Required Permission: STUDENTS_UPDATE
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { studentId } = await params;
    const { context, schoolId } = await requirePermission(request, {
      permission: 'STUDENTS_UPDATE',
    });

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, error: 'রিকোয়েস্ট বডি প্রয়োজন।' },
        { status: 400 }
      );
    }

    // Check if client maliciously attempted to mutate studentCode
    if (body.studentCode !== undefined) {
      return NextResponse.json(
        { success: false, error: 'স্টুডেন্ট কোড / আইডি অপরিবর্তনযোগ্য।' },
        { status: 400 }
      );
    }

    const validation = StudentUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'প্রদত্ত তথ্যে ভুল রয়েছে।',
          details: validation.error.flatten(),
        },
        { status: 422 }
      );
    }

    const data = validation.data;

    const { updatedStudent, beforeState } = await withTenantContext(schoolId, async (tx) => {
      const existing = await tx.student.findFirst({
        where: {
          id: studentId,
          schoolId,
          deletedAt: null,
        },
      });

      if (!existing) {
        throw new Error('NOT_FOUND: শিক্ষার্থী পাওয়া যায়নি।');
      }

      // Recompute fullNameEn if firstName or lastName changed
      let fullNameEn = data.fullNameEn;
      if (!fullNameEn && (data.firstNameEn || data.lastNameEn)) {
        const first = data.firstNameEn || existing.firstNameEn;
        const last = data.lastNameEn || existing.lastNameEn;
        fullNameEn = `${first} ${last}`.trim();
      }

      const updated = await tx.student.update({
        where: { id: studentId },
        data: {
          permanentAdmissionNo: data.permanentAdmissionNo,
          admissionDate: data.admissionDate,
          firstNameEn: data.firstNameEn,
          lastNameEn: data.lastNameEn,
          fullNameEn,
          fullNameBn: data.fullNameBn,
          dateOfBirth: data.dateOfBirth,
          gender: data.gender,
          bloodGroup: data.bloodGroup,
          religion: data.religion,
          nationality: data.nationality,
          birthRegistrationNo: data.birthRegistrationNo,
          nationalId: data.nationalId,
          photoUrl: data.photoUrl,
          phone: data.phone,
          email: data.email,
          permanentAddressLine: data.permanentAddressLine,
          permanentVillage: data.permanentVillage,
          permanentPostOffice: data.permanentPostOffice,
          permanentPostCode: data.permanentPostCode,
          permanentThana: data.permanentThana,
          permanentDistrict: data.permanentDistrict,
          permanentDivision: data.permanentDivision,
          presentAddressLine: data.presentAddressLine,
          presentThana: data.presentThana,
          presentDistrict: data.presentDistrict,
          presentDivision: data.presentDivision,
          isPhysicallyChallenged: data.isPhysicallyChallenged,
          disabilityDetails: data.disabilityDetails,
          status: data.status,
        },
        include: {
          emergencyContacts: true,
        },
      });

      return {
        updatedStudent: updated,
        beforeState: {
          status: existing.status,
          fullNameEn: existing.fullNameEn,
          phone: existing.phone,
        },
      };
    });

    // Forensic audit log
    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || context.user.phone || 'User',
      actorRole: 'ADMIN',
      action: 'UPDATE',
      entity: 'Student',
      entityId: updatedStudent.id,
      beforeState,
      afterState: {
        status: updatedStudent.status,
        fullNameEn: updatedStudent.fullNameEn,
        phone: updatedStudent.phone,
      },
      changeSummary: `Updated student ${updatedStudent.fullNameEn} (${updatedStudent.studentCode})`,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      data: updatedStudent,
      message: 'শিক্ষার্থীর তথ্য সফলভাবে আপডেট করা হয়েছে।',
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: 'অননুমোদিত এক্সেস।' }, { status: 401 });
    }
    if (err.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json(
        { success: false, error: err.message.replace('FORBIDDEN: ', '') },
        { status: 403 }
      );
    }
    if (err.message?.startsWith('NOT_FOUND')) {
      return NextResponse.json(
        { success: false, error: err.message.replace('NOT_FOUND: ', '') },
        { status: 404 }
      );
    }

    console.error('PATCH /api/school/students/[studentId] error:', error);
    return NextResponse.json(
      { success: false, error: 'শিক্ষার্থীর তথ্য আপডেট করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/school/students/[studentId]
 * Safe deletion / deactivation with historical record protection.
 * Required Permission: STUDENTS_DELETE
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { studentId } = await params;
    const { context, schoolId } = await requirePermission(request, {
      permission: 'STUDENTS_DELETE',
    });

    const result = await withTenantContext(schoolId, async (tx) => {
      const student = await tx.student.findFirst({
        where: {
          id: studentId,
          schoolId,
          deletedAt: null,
        },
      });

      if (!student) {
        throw new Error('NOT_FOUND: শিক্ষার্থী পাওয়া যায়নি।');
      }

      // Check dependent historical records
      const [enrollmentCount, markCount, attendanceCount, paymentCount] = await Promise.all([
        tx.enrollment.count({ where: { studentId, schoolId } }),
        tx.mark.count({ where: { studentId, schoolId } }),
        tx.studentAttendance.count({ where: { studentId, schoolId } }),
        tx.payment.count({ where: { studentId, schoolId } }),
      ]);

      const totalDependencies = enrollmentCount + markCount + attendanceCount + paymentCount;

      if (totalDependencies > 0) {
        // Strict historical protection: reject hard delete
        return {
          blocked: true,
          student,
          reason: `ঐতিহাসিক রেকর্ড বিদ্যমান (${enrollmentCount} এনরোলমেন্ট, ${attendanceCount} হাজিরা, ${markCount} নম্বর, ${paymentCount} পেমেন্ট)। স্থায়ীভাবে মুছে ফেলা নিষিদ্ধ। শিক্ষার্থীকে নিষ্ক্রিয় করুন।`,
        };
      }

      // Soft delete safely if no dependencies exist
      await tx.student.update({
        where: { id: studentId },
        data: {
          deletedAt: new Date(),
          status: 'INACTIVE',
        },
      });

      return {
        blocked: false,
        student,
      };
    });

    if (result.blocked) {
      await logAuditEvent({
        schoolId,
        actorUserId: context.userId,
        actorName: context.user.fullName || context.user.phone || 'User',
        actorRole: 'ADMIN',
        action: 'DELETE',
        entity: 'Student',
        entityId: result.student.id,
        changeSummary: `Attempted delete blocked for student ${result.student.studentCode} due to historical records`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      });

      return NextResponse.json(
        {
          success: false,
          error: result.reason,
        },
        { status: 409 }
      );
    }

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || context.user.phone || 'User',
      actorRole: 'ADMIN',
      action: 'DELETE',
      entity: 'Student',
      entityId: result.student.id,
      changeSummary: `Soft deleted student ${result.student.fullNameEn} (${result.student.studentCode})`,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'শিক্ষার্থী সফলভাবে মুছে ফেলা হয়েছে।',
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: 'অননুমোদিত এক্সেস।' }, { status: 401 });
    }
    if (err.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json(
        { success: false, error: err.message.replace('FORBIDDEN: ', '') },
        { status: 403 }
      );
    }
    if (err.message?.startsWith('NOT_FOUND')) {
      return NextResponse.json(
        { success: false, error: err.message.replace('NOT_FOUND: ', '') },
        { status: 404 }
      );
    }

    console.error('DELETE /api/school/students/[studentId] error:', error);
    return NextResponse.json(
      { success: false, error: 'শিক্ষার্থী মুছে ফেলতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
