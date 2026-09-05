import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import {
  AdmissionStatusUpdateSchema,
  isValidAdmissionStatusTransition,
} from '@/lib/validation/admission';
import { AdmissionStatus } from '@prisma/client';

/**
 * GET /api/school/admissions/[applicationId]
 * Fetches comprehensive application dossier.
 * Required Permission: ADMISSIONS_VIEW
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const { applicationId } = await params;
    const { schoolId } = await requirePermission(request, {
      permission: 'ADMISSIONS_VIEW',
    });

    const application = await withTenantContext(schoolId, async (tx) => {
      const app = await tx.admissionApplication.findFirst({
        where: { id: applicationId, schoolId },
        include: {
          academicSession: { select: { id: true, name: true } },
          appliedClass: { select: { id: true, nameEn: true, nameBn: true } },
          appliedCampus: { select: { id: true, nameEn: true, nameBn: true } },
          appliedGroup: { select: { id: true, nameEn: true, nameBn: true } },
          convertedStudent: { select: { id: true, studentCode: true, fullNameBn: true, fullNameEn: true } },
          reviewedBy: { select: { id: true, fullName: true } },
          documents: true,
        },
      });

      if (!app) return null;

      const { detectDuplicateApplications } = await import('@/lib/validation/admission-duplicate');
      const potentialDuplicates = await detectDuplicateApplications(
        schoolId,
        {
          id: app.id,
          birthRegistrationNo: app.birthRegistrationNo,
          dateOfBirth: app.dateOfBirth,
          applicantNameEn: app.applicantNameEn,
          applicantNameBn: app.applicantNameBn,
          fatherPhone: app.fatherPhone,
        },
        tx
      );

      return {
        ...app,
        potentialDuplicates,
      };
    });

    if (!application) {
      return NextResponse.json(
        { success: false, error: 'ভর্তি আবেদনটি খুঁজে পাওয়া যায়নি।' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: application });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: 'অননুমোদিত অ্যাক্সেস।' }, { status: 401 });
    }
    if (err.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json(
        { success: false, error: 'ভর্তি আবেদন দেখার অনুমতি আপনার নেই।' },
        { status: 403 }
      );
    }
    console.error('Admission Detail Error:', error);
    return NextResponse.json(
      { success: false, error: 'আবেদনের তথ্য লোড করার সময় ত্রুটি ঘটেছে।' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/school/admissions/[applicationId]
 * Updates review status or marks application as rejected / shortlisted / scheduled.
 * Note: Conversion to official Student & Enrollment is executed via POST /approve.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const { applicationId } = await params;
    const body = await request.json();
    const validation = AdmissionStatusUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'স্ট্যাটাস আপডেট তথ্যে ত্রুটি রয়েছে।',
          details: validation.error.flatten(),
        },
        { status: 422 }
      );
    }

    const { status: targetStatus, rejectionReason } = validation.data;

    // Check permission based on target status
    const requiredPerm =
      targetStatus === AdmissionStatus.REJECTED ? 'ADMISSIONS_REJECT' : 'ADMISSIONS_APPROVE';

    const { schoolId, context } = await requirePermission(request, {
      permission: requiredPerm,
    });

    // Disallow setting ENROLLED via generic PATCH (must go through transactional /approve)
    if (targetStatus === AdmissionStatus.ENROLLED) {
      return NextResponse.json(
        {
          success: false,
          error: 'ভর্তি চূড়ান্তকরণ (ENROLLED) শুধুমাত্র অনুমোদন ও ভর্তি ইন্টারফেসের মাধ্যমে সম্পন্ন করা সম্ভব।',
        },
        { status: 400 }
      );
    }

    const result = await withTenantContext(schoolId, async (tx) => {
      // Row lock
      await tx.$queryRaw`
        SELECT id FROM admission_applications 
        WHERE id = ${applicationId}::uuid AND school_id = ${schoolId}::uuid 
        FOR UPDATE
      `;

      const app = await tx.admissionApplication.findFirst({
        where: { id: applicationId, schoolId },
      });

      if (!app) {
        throw { status: 404, message: 'ভর্তি আবেদনটি খুঁজে পাওয়া যায়নি।' };
      }

      if (!isValidAdmissionStatusTransition(app.status, targetStatus)) {
        throw {
          status: 400,
          message: `বর্তমান স্ট্যাটাস (${app.status}) থেকে ${targetStatus} স্ট্যাটাসে পরিবর্তন অনুমোদিত নয়।`,
        };
      }

      const updated = await tx.admissionApplication.update({
        where: { id: applicationId },
        data: {
          status: targetStatus,
          reviewedById: context.userId,
          reviewedAt: new Date(),
          rejectionReason: targetStatus === AdmissionStatus.REJECTED ? rejectionReason : app.rejectionReason,
        },
      });

      return { previousStatus: app.status, updated };
    });

    // Forensic audit
    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || 'Admin',
      actorRole: context.user.isSuperAdmin ? 'SUPER_ADMIN' : 'ADMIN',
      action: targetStatus === AdmissionStatus.REJECTED ? 'REJECT' : 'UPDATE',
      entity: 'ADMISSION_APPLICATION',
      entityId: applicationId,
      changeSummary: `Admission status changed from ${result.previousStatus} to ${targetStatus}${rejectionReason ? ` (Reason: ${rejectionReason})` : ''}`,
      beforeState: { status: result.previousStatus },
      afterState: { status: targetStatus, rejectionReason },
    });

    return NextResponse.json({
      success: true,
      message: 'আবেদনের স্ট্যাটাস সফলভাবে আপডেট করা হয়েছে।',
      data: result.updated,
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err.status) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    const e = error as Error;
    if (e.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: 'অননুমোদিত অ্যাক্সেস।' }, { status: 401 });
    }
    if (e.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json(
        { success: false, error: 'স্ট্যাটাস পরিবর্তনের অনুমতি আপনার নেই।' },
        { status: 403 }
      );
    }
    console.error('Admission Status Update Error:', error);
    return NextResponse.json(
      { success: false, error: 'স্ট্যাটাস আপডেট করার সময় ত্রুটি ঘটেছে।' },
      { status: 500 }
    );
  }
}
