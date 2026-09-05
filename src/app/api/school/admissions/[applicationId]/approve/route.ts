import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { AdmissionApprovalConversionSchema } from '@/lib/validation/admission';
import { AdmissionStatus, EnrollmentType, EnrollmentStatus, StudentStatus, Division, AuditAction } from '@prisma/client';

/**
 * POST /api/school/admissions/[applicationId]/approve
 * 
 * Atomically converts an approved admission application into:
 * 1. Permanent Student identity record (generates unique studentCode)
 * 2. Guardian identity records (Father & Mother) and StudentGuardian links
 * 3. Session-specific Enrollment placement (Class, Section, Roll No, NEW_ADMISSION)
 * 4. Links convertedStudentId and transitions application status to ENROLLED
 * 5. Logs forensic audit
 * 
 * INVARIANT: Public form submission never creates a Student or Enrollment directly.
 * Student & Enrollment creation happens strictly here inside an atomic database transaction.
 * 
 * Required Permission: ADMISSIONS_APPROVE
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  const { applicationId } = await params;
  let schoolId = '';
  let context: any;

  try {
    const auth = await requirePermission(request, {
      permission: 'ADMISSIONS_APPROVE',
    });
    schoolId = auth.schoolId;
    context = auth.context;

    const body = await request.json();
    const validation = AdmissionApprovalConversionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'ভর্তি অনুমোদন ও শিক্ষার্থী রূপান্তরের তথ্যে ভুল রয়েছে।',
          details: validation.error.flatten(),
        },
        { status: 422 }
      );
    }

    const { sectionId, rollNo, campusId, groupId, fatherGuardianId, motherGuardianId, admissionDate, notes } = validation.data;

    const conversionResult = await withTenantContext(schoolId, async (tx) => {
      // 1. Row-level exclusive lock on the application record
      await tx.$queryRaw`
        SELECT id FROM admission_applications 
        WHERE id = ${applicationId}::uuid AND school_id = ${schoolId}::uuid 
        FOR UPDATE
      `;

      const app = await tx.admissionApplication.findFirst({
        where: { id: applicationId, schoolId },
        include: {
          appliedClass: true,
          academicSession: true,
        },
      });

      if (!app) {
        throw { status: 404, message: 'ভর্তি আবেদনটি খুঁজে পাওয়া যায়নি।' };
      }

      // 2. Prevent duplicate conversion
      if (app.convertedStudentId || app.status === AdmissionStatus.ENROLLED) {
        throw {
          status: 409,
          code: 'DUPLICATE_CONVERSION',
          message: 'এই আবেদনটি ইতিমধ্যে অনুমোদিত এবং শিক্ষার্থী হিসেবে ভর্তি সম্পন্ন হয়েছে। পুনঃভর্তি করা যাবে না।',
        };
      }

      // 3. Reject conversion of rejected or cancelled applications
      if (app.status === AdmissionStatus.REJECTED || app.status === AdmissionStatus.CANCELLED) {
        throw {
          status: 400,
          message: `বাতিল বা প্রত্যাখ্যাত আবেদন শিক্ষার্থী হিসেবে রূপান্তর করা সম্ভব নয়। বর্তমান স্ট্যাটাস: ${app.status}`,
        };
      }

      // 4. Validate Section belongs to school and applied class
      const targetSection = await tx.section.findFirst({
        where: {
          id: sectionId,
          schoolId,
          classId: app.appliedClassId,
        },
      });

      if (!targetSection) {
        throw {
          status: 400,
          message: 'নির্বাচিত শাখাটি এই আবেদনকৃত শ্রেণীর অন্তর্ভুক্ত নয় বা বিদ্যালয়ে বিদ্যমান নেই।',
        };
      }

      // 5. Validate Campus if provided
      const resolvedCampusId = campusId || app.appliedCampusId || null;
      if (resolvedCampusId) {
        const campus = await tx.campus.findFirst({
          where: { id: resolvedCampusId, schoolId },
        });
        if (!campus) {
          throw { status: 400, message: 'নির্বাচিত ক্যাম্পাসটি এই বিদ্যালয়ের অন্তর্ভুক্ত নয়।' };
        }
      }

      // 6. Validate Group if provided
      const resolvedGroupId = groupId || app.appliedGroupId || null;
      if (resolvedGroupId) {
        const group = await tx.academicGroup.findFirst({
          where: { id: resolvedGroupId, schoolId },
        });
        if (!group) {
          throw { status: 400, message: 'নির্বাচিত গ্রুপটি এই বিদ্যালয়ের অন্তর্ভুক্ত নয়।' };
        }
      }

      // 7. Check roll number uniqueness in [school, session, class, section, roll]
      const existingRoll = await tx.enrollment.findUnique({
        where: {
          schoolId_academicSessionId_classId_sectionId_rollNo: {
            schoolId,
            academicSessionId: app.academicSessionId,
            classId: app.appliedClassId,
            sectionId,
            rollNo,
          },
        },
      });

      if (existingRoll) {
        throw {
          status: 409,
          message: `এই শিক্ষাবর্ষে নির্বাচিত শ্রেণী ও শাখায় রোল নম্বর ${rollNo} ইতিমধ্যে ব্যবহৃত হয়েছে। অনুগ্রহ করে অন্য রোল নম্বর দিন।`,
        };
      }

      // 8. Generate unique student code (STU-YYYY-XXXXX) under advisory transaction lock
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('student_code_' || ${schoolId}))`;

      const currentYear = new Date().getFullYear();
      let studentCode = '';
      let isCodeUnique = false;

      for (let attempt = 0; attempt < 10; attempt++) {
        const randomDigits = Math.floor(10000 + Math.random() * 90000);
        const candidate = `STU-${currentYear}-${randomDigits}`;
        const existingCode = await tx.student.findFirst({
          where: { schoolId, studentCode: candidate },
        });
        if (!existingCode) {
          studentCode = candidate;
          isCodeUnique = true;
          break;
        }
      }

      if (!isCodeUnique) {
        const count = await tx.student.count({ where: { schoolId } });
        studentCode = `STU-${currentYear}-${String(count + 10001).slice(-5)}`;
      }

      // 9. Split English name for required fields
      const nameTokens = app.applicantNameEn.trim().split(/\s+/);
      const firstNameEn = nameTokens[0] || app.applicantNameEn.trim();
      const lastNameEn = nameTokens.slice(1).join(' ') || nameTokens[0];

      // 10. Create permanent Student record
      const student = await tx.student.create({
        data: {
          schoolId,
          studentCode,
          permanentAdmissionNo: app.applicationNumber,
          admissionDate: admissionDate || new Date(),
          firstNameEn,
          lastNameEn,
          fullNameEn: app.applicantNameEn.trim(),
          fullNameBn: app.applicantNameBn.trim(),
          dateOfBirth: app.dateOfBirth,
          gender: app.gender,
          bloodGroup: app.bloodGroup || null,
          religion: app.religion,
          nationality: 'Bangladeshi',
          birthRegistrationNo: app.birthRegistrationNo || null,
          photoUrl: null,
          phone: app.fatherPhone || null,
          permanentAddressLine: app.permanentAddress,
          permanentPostOffice: 'N/A',
          permanentPostCode: 'N/A',
          permanentThana: 'N/A',
          permanentDistrict: 'Dhaka',
          permanentDivision: Division.DHAKA,
          presentAddressLine: app.presentAddress,
          presentThana: 'N/A',
          presentDistrict: 'Dhaka',
          presentDivision: Division.DHAKA,
          isPhysicallyChallenged: false,
          status: StudentStatus.ACTIVE,
        },
      });

      // 11. Create or safely link Father Guardian & StudentGuardian
      if (app.fatherNameEn && app.fatherPhone) {
        let fatherGuardian = null;

        // A. Explicit admin selection
        if (fatherGuardianId) {
          fatherGuardian = await tx.guardian.findFirst({
            where: { id: fatherGuardianId, schoolId },
          });
        }

        // B. Match by National ID if provided
        if (!fatherGuardian && app.fatherNid) {
          fatherGuardian = await tx.guardian.findFirst({
            where: { schoolId, nationalId: app.fatherNid.trim() },
          });
        }

        // C. Safe match: Phone AND Name must match (case-insensitive)
        if (!fatherGuardian) {
          fatherGuardian = await tx.guardian.findFirst({
            where: {
              schoolId,
              phone: app.fatherPhone.trim(),
              fullNameEn: { equals: app.fatherNameEn.trim(), mode: 'insensitive' },
            },
          });
        }

        // D. If no verified match, create new Guardian (never merge unrelated parents sharing a phone)
        if (!fatherGuardian) {
          fatherGuardian = await tx.guardian.create({
            data: {
              schoolId,
              fullNameEn: app.fatherNameEn.trim(),
              fullNameBn: app.fatherNameBn.trim(),
              relationType: 'FATHER',
              nationalId: app.fatherNid ? app.fatherNid.trim() : null,
              phone: app.fatherPhone.trim(),
              occupation: app.fatherOccupation ? app.fatherOccupation.trim() : null,
              address: app.permanentAddress.trim(),
            },
          });
        }

        await tx.studentGuardian.create({
          data: {
            schoolId,
            studentId: student.id,
            guardianId: fatherGuardian.id,
            isPrimary: true,
            isFinancialPayer: true,
            canPickUp: true,
          },
        });
      }

      // 12. Create or safely link Mother Guardian & StudentGuardian
      if (app.motherNameEn) {
        const motherPhone = (app.motherPhone || app.fatherPhone).trim();
        let motherGuardian = null;

        // A. Explicit admin selection
        if (motherGuardianId) {
          motherGuardian = await tx.guardian.findFirst({
            where: { id: motherGuardianId, schoolId },
          });
        }

        // B. Safe match: Phone AND Name must match (case-insensitive)
        if (!motherGuardian) {
          motherGuardian = await tx.guardian.findFirst({
            where: {
              schoolId,
              fullNameEn: { equals: app.motherNameEn.trim(), mode: 'insensitive' },
              phone: motherPhone,
            },
          });
        }

        // C. If no verified match, create new Guardian
        if (!motherGuardian) {
          motherGuardian = await tx.guardian.create({
            data: {
              schoolId,
              fullNameEn: app.motherNameEn.trim(),
              fullNameBn: app.motherNameBn.trim(),
              relationType: 'MOTHER',
              phone: motherPhone,
              address: app.permanentAddress.trim(),
            },
          });
        }

        await tx.studentGuardian.create({
          data: {
            schoolId,
            studentId: student.id,
            guardianId: motherGuardian.id,
            isPrimary: false,
            isFinancialPayer: false,
            canPickUp: true,
          },
        });
      }

      // 13. Create session-specific official Enrollment
      const enrollment = await tx.enrollment.create({
        data: {
          schoolId,
          studentId: student.id,
          academicSessionId: app.academicSessionId,
          classId: app.appliedClassId,
          sectionId,
          campusId: resolvedCampusId,
          groupId: resolvedGroupId,
          rollNo,
          curriculumVersion: app.curriculumVersion,
          enrollmentDate: admissionDate || new Date(),
          enrollmentType: EnrollmentType.NEW_ADMISSION,
          status: EnrollmentStatus.ACTIVE,
          remarks: notes || `ভর্তি আবেদন #${app.applicationNumber} হতে শিক্ষার্থী হিসেবে চূড়ান্ত অনুমোদন ও ভর্তি।`,
        },
      });

      // 14. Update AdmissionApplication status to ENROLLED and store convertedStudentId
      const updatedApplication = await tx.admissionApplication.update({
        where: { id: applicationId },
        data: {
          status: AdmissionStatus.ENROLLED,
          convertedStudentId: student.id,
          reviewedById: context.userId,
          reviewedAt: new Date(),
        },
      });

      return {
        student,
        enrollment,
        application: updatedApplication,
      };
    });

    // 15. Forensic audit logging
    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || 'Admin',
      actorRole: context.user.isSuperAdmin ? 'SUPER_ADMIN' : 'ADMIN',
      action: AuditAction.APPROVE,
      entity: 'ADMISSION_APPLICATION',
      entityId: applicationId,
      changeSummary: `Converted admission application ${conversionResult.application.applicationNumber} to Student ${conversionResult.student.studentCode} with Enrollment in section ${sectionId} roll ${rollNo}`,
      beforeState: { status: AdmissionStatus.APPROVED },
      afterState: {
        status: AdmissionStatus.ENROLLED,
        convertedStudentId: conversionResult.student.id,
        enrollmentId: conversionResult.enrollment.id,
        studentCode: conversionResult.student.studentCode,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'শিক্ষার্থী ও এনরোলমেন্ট সফলভাবে তৈরি এবং ভর্তি সম্পন্ন হয়েছে।',
        data: {
          applicationId,
          applicationNumber: conversionResult.application.applicationNumber,
          studentId: conversionResult.student.id,
          studentCode: conversionResult.student.studentCode,
          enrollmentId: conversionResult.enrollment.id,
          classId: conversionResult.enrollment.classId,
          sectionId: conversionResult.enrollment.sectionId,
          rollNo: conversionResult.enrollment.rollNo,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const err = error as { status?: number; code?: string; message?: string };
    if (err.status) {
      if (err.code === 'DUPLICATE_CONVERSION' && schoolId) {
        try {
          await logAuditEvent({
            schoolId,
            actorUserId: context?.userId || null,
            actorName: context?.user?.fullName || 'Admin',
            actorRole: context?.user?.isSuperAdmin ? 'SUPER_ADMIN' : 'ADMIN',
            action: AuditAction.APPROVE,
            entity: 'ADMISSION_APPLICATION',
            entityId: applicationId,
            changeSummary: `BLOCKED: Duplicate conversion attempt on already enrolled application #${applicationId}`,
          });
        } catch {
          // Ignore secondary audit log error in failure path
        }
      }
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    const e = error as Error;
    if (e.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: 'অননুমোদিত অ্যাক্সেস।' }, { status: 401 });
    }
    if (e.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json(
        { success: false, error: 'ভর্তি অনুমোদনের অনুমতি আপনার নেই।' },
        { status: 403 }
      );
    }
    console.error('Admission Conversion Error:', error);
    return NextResponse.json(
      { success: false, error: 'ভর্তি অনুমোদন ও রূপান্তরের সময় সার্ভার ত্রুটি ঘটেছে।' },
      { status: 500 }
    );
  }
}
