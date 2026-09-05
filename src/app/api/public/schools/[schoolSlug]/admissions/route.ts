import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { PublicAdmissionApplicationSchema } from '@/lib/validation/admission';
import { ApplicationSource, AdmissionStatus, AuditAction } from '@prisma/client';
import { logAuditEvent } from '@/lib/audit/logger';
import crypto from 'crypto';

/**
 * POST /api/public/schools/[schoolSlug]/admissions
 * Public portal endpoint for prospective students/parents to submit admission applications.
 * Strictly creates ONLY an AdmissionApplication (NEVER a Student or Enrollment).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ schoolSlug: string }> }
) {
  try {
    const { schoolSlug } = await params;

    // 1. Resolve school by verified slug
    const school = await prisma.school.findFirst({
      where: {
        slug: schoolSlug,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: {
        id: true,
        nameEn: true,
        nameBn: true,
      },
    });

    if (!school) {
      return NextResponse.json(
        { success: false, error: 'বিদ্যালয়টি খুঁজে পাওয়া যায়নি অথবা সক্রিয় নয়।' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = PublicAdmissionApplicationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'ভর্তি আবেদন তথ্যে ত্রুটি রয়েছে। অনুগ্রহ করে সঠিক তথ্য প্রদান করুন।',
          details: validation.error.flatten(),
        },
        { status: 422 }
      );
    }

    const data = validation.data;

    // 2. Validate Session, Class, Campus belong to this school and are active
    const [session, cls] = await Promise.all([
      prisma.academicSession.findFirst({
        where: { id: data.academicSessionId, schoolId: school.id },
      }),
      prisma.class.findFirst({
        where: { id: data.appliedClassId, schoolId: school.id },
      }),
    ]);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'নির্বাচিত শিক্ষাবর্ষটি এই বিদ্যালয়ের অন্তর্ভুক্ত নয়।' },
        { status: 400 }
      );
    }

    if (session.isLocked) {
      return NextResponse.json(
        { success: false, error: 'নির্বাচিত শিক্ষাবর্ষে ভর্তি কার্যক্রম বর্তমানে বন্ধ রয়েছে।' },
        { status: 400 }
      );
    }

    if (!cls || cls.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'নির্বাচিত শ্রেণীটি এই বিদ্যালয়ের সক্রিয় শ্রেণী নয়।' },
        { status: 400 }
      );
    }

    if (data.appliedCampusId) {
      const campus = await prisma.campus.findFirst({
        where: { id: data.appliedCampusId, schoolId: school.id, status: 'ACTIVE' },
      });
      if (!campus) {
        return NextResponse.json(
          { success: false, error: 'নির্বাচিত ক্যাম্পাসটি এই বিদ্যালয়ের অন্তর্ভুক্ত বা সক্রিয় নয়।' },
          { status: 400 }
        );
      }
    }

    if (data.appliedGroupId) {
      const group = await prisma.academicGroup.findFirst({
        where: { id: data.appliedGroupId, schoolId: school.id },
      });
      if (!group) {
        return NextResponse.json(
          { success: false, error: 'নির্বাচিত বিভাগ/গ্রুপটি এই বিদ্যালয়ের অন্তর্ভুক্ত নয়।' },
          { status: 400 }
        );
      }
    }

    // 3. Generate unique applicationNumber and high-entropy trackingCode
    const year = new Date().getFullYear();
    let applicationNumber = '';
    let trackingCode = '';

    for (let attempt = 0; attempt < 5; attempt++) {
      const randomSeq = crypto.randomInt(10000, 99999);
      const candidateAppNum = `ADM-${year}-${randomSeq}`;
      const candidateTrk = `TRK-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

      const existing = await prisma.admissionApplication.findFirst({
        where: {
          schoolId: school.id,
          OR: [{ applicationNumber: candidateAppNum }, { trackingCode: candidateTrk }],
        },
      });

      if (!existing) {
        applicationNumber = candidateAppNum;
        trackingCode = candidateTrk;
        break;
      }
    }

    if (!applicationNumber || !trackingCode) {
      applicationNumber = `ADM-${year}-${crypto.randomInt(10000, 99999)}`;
      trackingCode = `TRK-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    }

    // 4. Create Admission Application (transactional with documents)
    const application = await prisma.$transaction(async (tx) => {
      const created = await tx.admissionApplication.create({
        data: {
          schoolId: school.id,
          applicationNumber,
          trackingCode,
          academicSessionId: data.academicSessionId,
          appliedClassId: data.appliedClassId,
          appliedGroupId: data.appliedGroupId || null,
          appliedCampusId: data.appliedCampusId || null,
          curriculumVersion: data.curriculumVersion,
          appliedShift: data.appliedShift,
          applicantNameEn: data.applicantNameEn.trim(),
          applicantNameBn: data.applicantNameBn.trim(),
          dateOfBirth: data.dateOfBirth,
          gender: data.gender,
          bloodGroup: data.bloodGroup || null,
          religion: data.religion,
          birthRegistrationNo: data.birthRegistrationNo || null,
          fatherNameEn: data.fatherNameEn.trim(),
          fatherNameBn: data.fatherNameBn.trim(),
          fatherNid: data.fatherNid || null,
          fatherPhone: data.fatherPhone.trim(),
          fatherOccupation: data.fatherOccupation || null,
          motherNameEn: data.motherNameEn.trim(),
          motherNameBn: data.motherNameBn.trim(),
          motherPhone: data.motherPhone || null,
          presentAddress: data.presentAddress.trim(),
          permanentAddress: data.permanentAddress.trim(),
          previousSchoolName: data.previousSchoolName || null,
          previousClass: data.previousClass || null,
          previousGpa: data.previousGpa || null,
          applicationFeePaid: data.applicationFeePaid,
          applicationFeeTrxId: data.applicationFeeTrxId || null,
          applicationSource: ApplicationSource.PUBLIC_ONLINE,
          status: AdmissionStatus.SUBMITTED,
          documents: data.documents && data.documents.length > 0
            ? {
                create: data.documents.map((doc) => ({
                  title: doc.title,
                  fileUrl: doc.fileUrl,
                })),
              }
            : undefined,
        },
        select: {
          id: true,
          applicationNumber: true,
          trackingCode: true,
          status: true,
          applicantNameBn: true,
          applicantNameEn: true,
          createdAt: true,
        },
      });

      return created;
    });

    // 5. Forensic audit log for online submission
    await logAuditEvent({
      schoolId: school.id,
      actorName: 'Public Online Applicant',
      actorRole: 'ANONYMOUS',
      action: AuditAction.INSERT,
      entity: 'ADMISSION_APPLICATION',
      entityId: application.id,
      changeSummary: `Online admission application ${application.applicationNumber} submitted by public applicant`,
      afterState: {
        applicationNumber: application.applicationNumber,
        status: application.status,
        applicantNameEn: data.applicantNameEn,
        appliedClassId: data.appliedClassId,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'ভর্তি আবেদন সফলভাবে জমা দেওয়া হয়েছে।',
        data: {
          id: application.id,
          applicationNumber: application.applicationNumber,
          trackingCode: application.trackingCode,
          status: application.status,
          applicantName: application.applicantNameBn || application.applicantNameEn,
          createdAt: application.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('Public Admission Submission Error:', error);
    return NextResponse.json(
      { success: false, error: 'ভর্তি আবেদন জমা দেওয়ার সময় সার্ভার ত্রুটি ঘটেছে।' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/public/schools/[schoolSlug]/admissions
 * Fetches public school information, active academic sessions, and classes
 * for prospective applicants filling out the admission form.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ schoolSlug: string }> }
) {
  try {
    const { schoolSlug } = await params;
    const school = await prisma.school.findFirst({
      where: { slug: schoolSlug, status: 'ACTIVE', deletedAt: null },
      select: {
        id: true,
        slug: true,
        nameEn: true,
        nameBn: true,
        phone: true,
        email: true,
        website: true,
      },
    });

    if (!school) {
      return NextResponse.json(
        { success: false, error: 'বিদ্যালয়টি খুঁজে পাওয়া যায়নি অথবা সক্রিয় নয়।' },
        { status: 404 }
      );
    }

    const [sessions, classes, campuses] = await Promise.all([
      prisma.academicSession.findMany({
        where: { schoolId: school.id, isLocked: false },
        select: { id: true, name: true, isCurrent: true },
        orderBy: { startDate: 'desc' },
      }),
      prisma.class.findMany({
        where: { schoolId: school.id, status: 'ACTIVE' },
        select: { id: true, nameEn: true, nameBn: true, numericLevel: true },
        orderBy: { numericLevel: 'asc' },
      }),
      prisma.campus.findMany({
        where: { schoolId: school.id, status: 'ACTIVE' },
        select: { id: true, nameEn: true, nameBn: true },
        orderBy: { nameEn: 'asc' },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        school,
        sessions,
        classes,
        campuses,
      },
    });
  } catch (error: unknown) {
    console.error('Public School Info Error:', error);
    return NextResponse.json(
      { success: false, error: 'বিদ্যালয়ের তথ্য লোড করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}

