import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import {
  AdmissionFilterSchema,
  AdminAdmissionApplicationSchema,
} from '@/lib/validation/admission';
import { Prisma, ApplicationSource, AdmissionStatus } from '@prisma/client';
import crypto from 'crypto';

/**
 * GET /api/school/admissions
 * Fetches paginated list of admission applications for the active school.
 * Required Permission: ADMISSIONS_VIEW
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, {
      permission: 'ADMISSIONS_VIEW',
    });

    const { searchParams } = new URL(request.url);
    const filterInput = {
      page: searchParams.get('page') || '1',
      pageSize: searchParams.get('pageSize') || '20',
      academicSessionId: searchParams.get('academicSessionId') || undefined,
      appliedClassId: searchParams.get('appliedClassId') || undefined,
      appliedCampusId: searchParams.get('appliedCampusId') || undefined,
      status: searchParams.get('status') || undefined,
      applicationSource: searchParams.get('applicationSource') || undefined,
      search: searchParams.get('search') || undefined,
    };

    const validation = AdmissionFilterSchema.safeParse(filterInput);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'ফিল্টার তথ্যে ত্রুটি রয়েছে।',
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const {
      page,
      pageSize,
      academicSessionId,
      appliedClassId,
      appliedCampusId,
      status,
      applicationSource,
      search,
    } = validation.data;

    const skip = (page - 1) * pageSize;

    const where: Prisma.AdmissionApplicationWhereInput = {
      schoolId,
      ...(academicSessionId && { academicSessionId }),
      ...(appliedClassId && { appliedClassId }),
      ...(appliedCampusId && { appliedCampusId }),
      ...(status && { status }),
      ...(applicationSource && { applicationSource }),
      ...(search && {
        OR: [
          { applicationNumber: { contains: search, mode: 'insensitive' } },
          { trackingCode: { contains: search, mode: 'insensitive' } },
          { applicantNameEn: { contains: search, mode: 'insensitive' } },
          { applicantNameBn: { contains: search, mode: 'insensitive' } },
          { fatherPhone: { contains: search } },
          { motherPhone: { contains: search } },
        ],
      }),
    };

    const { applications, totalCount } = await withTenantContext(schoolId, async (tx) => {
      const [data, count] = await Promise.all([
        tx.admissionApplication.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
          include: {
            academicSession: { select: { id: true, name: true } },
            appliedClass: { select: { id: true, nameEn: true, nameBn: true } },
            appliedCampus: { select: { id: true, nameEn: true, nameBn: true } },
            appliedGroup: { select: { id: true, nameEn: true, nameBn: true } },
            convertedStudent: { select: { id: true, studentCode: true } },
          },
        }),
        tx.admissionApplication.count({ where }),
      ]);

      return { applications: data, totalCount: count };
    });

    return NextResponse.json({
      success: true,
      data: applications,
      meta: {
        total: totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    });
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
    console.error('Admission List Error:', error);
    return NextResponse.json(
      { success: false, error: 'ভর্তি আবেদন তালিকা লোড করার সময় ত্রুটি ঘটেছে।' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/school/admissions
 * Creates a manual/office admission application by administrative staff.
 * Required Permission: ADMISSIONS_CREATE
 */
export async function POST(request: NextRequest) {
  try {
    const { schoolId, context } = await requirePermission(request, {
      permission: 'ADMISSIONS_CREATE',
    });

    const body = await request.json();
    const validation = AdminAdmissionApplicationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'ভর্তি আবেদন তথ্যে ত্রুটি রয়েছে।',
          details: validation.error.flatten(),
        },
        { status: 422 }
      );
    }

    const data = validation.data;

    const result = await withTenantContext(schoolId, async (tx) => {
      // 1. Verify Session, Class, Campus
      const [session, cls] = await Promise.all([
        tx.academicSession.findFirst({ where: { id: data.academicSessionId, schoolId } }),
        tx.class.findFirst({ where: { id: data.appliedClassId, schoolId } }),
      ]);

      if (!session) throw { status: 400, message: 'নির্বাচিত শিক্ষাবর্ষটি পাওয়া যায়নি।' };
      if (!cls) throw { status: 400, message: 'নির্বাচিত শ্রেণীটি পাওয়া যায়নি।' };

      if (data.appliedCampusId) {
        const campus = await tx.campus.findFirst({ where: { id: data.appliedCampusId, schoolId } });
        if (!campus) throw { status: 400, message: 'নির্বাচিত ক্যাম্পাসটি এই বিদ্যালয়ের নয়।' };
      }

      // 2. Generate application numbers
      const year = new Date().getFullYear();
      const randomSeq = crypto.randomInt(10000, 99999);
      const applicationNumber = `ADM-${year}-${randomSeq}`;
      const trackingCode = `TRK-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

      // 3. Create application
      const created = await tx.admissionApplication.create({
        data: {
          schoolId,
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
          applicationSource: ApplicationSource.ADMIN_MANUAL,
          status: data.status || AdmissionStatus.SUBMITTED,
          documents: data.documents && data.documents.length > 0
            ? {
                create: data.documents.map((doc) => ({
                  title: doc.title,
                  fileUrl: doc.fileUrl,
                })),
              }
            : undefined,
        },
        include: {
          academicSession: { select: { name: true } },
          appliedClass: { select: { nameEn: true, nameBn: true } },
        },
      });

      return created;
    });

    // 4. Audit log
    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || 'Admin',
      actorRole: context.user.isSuperAdmin ? 'SUPER_ADMIN' : 'ADMIN',
      action: 'INSERT',
      entity: 'ADMISSION_APPLICATION',
      entityId: result.id,
      changeSummary: `Manual admission application ${result.applicationNumber} created for ${result.applicantNameBn || result.applicantNameEn}`,
      afterState: result,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'ভর্তি আবেদন সফলভাবে তৈরি করা হয়েছে।',
        data: result,
      },
      { status: 201 }
    );
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
        { success: false, error: 'ভর্তি আবেদন তৈরির অনুমতি আপনার নেই।' },
        { status: 403 }
      );
    }
    console.error('Admission Manual Create Error:', error);
    return NextResponse.json(
      { success: false, error: 'ভর্তি আবেদন সংরক্ষণের সময় ত্রুটি ঘটেছে।' },
      { status: 500 }
    );
  }
}
