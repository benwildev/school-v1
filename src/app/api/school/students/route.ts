import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { StudentCreateSchema, StudentFilterSchema } from '@/lib/validation/student';
import { Prisma } from '@prisma/client';

/**
 * GET /api/school/students
 * Paginated student directory with search and demographic filters.
 * Required Permission: STUDENTS_VIEW
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, {
      permission: 'STUDENTS_VIEW',
    });

    const { searchParams } = new URL(request.url);
    const filterResult = StudentFilterSchema.safeParse({
      page: searchParams.get('page') || 1,
      pageSize: searchParams.get('pageSize') || 20,
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      gender: searchParams.get('gender') || undefined,
    });

    if (!filterResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'অবৈধ ফিল্টার বা পেজিনেশন প্যারামিটার।',
          details: filterResult.error.flatten(),
        },
        { status: 422 }
      );
    }

    const { page, pageSize, search, status, gender } = filterResult.data;

    const result = await withTenantContext(schoolId, async (tx) => {
      const where: Prisma.StudentWhereInput = {
        schoolId,
        deletedAt: null,
      };

      if (status && status !== 'ALL') {
        where.status = status;
      }

      if (gender && gender !== 'ALL') {
        where.gender = gender;
      }

      if (search && search.trim() !== '') {
        const query = search.trim();
        where.OR = [
          { studentCode: { contains: query, mode: 'insensitive' } },
          { fullNameEn: { contains: query, mode: 'insensitive' } },
          { fullNameBn: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
          { birthRegistrationNo: { contains: query } },
          { nationalId: { contains: query } },
        ];
      }

      const total = await tx.student.count({ where });

      const students = await tx.student.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [
          { createdAt: 'desc' },
          { studentCode: 'asc' },
        ],
        include: {
          emergencyContacts: {
            take: 1,
            select: {
              id: true,
              name: true,
              relation: true,
              phone: true,
            },
          },
        },
      });

      return {
        students,
        total,
      };
    });

    return NextResponse.json({
      success: true,
      data: result.students,
      pagination: {
        page,
        pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / pageSize) || 1,
      },
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

    console.error('GET /api/school/students error:', error);
    return NextResponse.json(
      { success: false, error: 'শিক্ষার্থী তালিকা লোড করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/school/students
 * Register a new permanent student profile.
 * Required Permission: STUDENTS_CREATE
 */
export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, {
      permission: 'STUDENTS_CREATE',
    });

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, error: 'রিকোয়েস্ট বডি প্রয়োজন।' },
        { status: 400 }
      );
    }

    const validation = StudentCreateSchema.safeParse(body);
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
    const fullNameEn = data.fullNameEn || `${data.firstNameEn} ${data.lastNameEn}`.trim();
    const emergencyContact = data.emergencyContact;

    // Execute insertion inside tenant transaction
    const newStudent = await withTenantContext(schoolId, async (tx) => {
      // Pre-check for duplicate studentCode
      const existing = await tx.student.findFirst({
        where: {
          schoolId,
          studentCode: data.studentCode,
        },
      });

      if (existing) {
        throw new Error('DUPLICATE_CODE: এই স্টুডেন্ট আইডি / কোড ইতিমধ্যে নিবন্ধিত রয়েছে।');
      }

      const created = await tx.student.create({
        data: {
          schoolId,
          studentCode: data.studentCode,
          permanentAdmissionNo: data.permanentAdmissionNo || null,
          admissionDate: data.admissionDate,
          firstNameEn: data.firstNameEn,
          lastNameEn: data.lastNameEn,
          fullNameEn,
          fullNameBn: data.fullNameBn,
          dateOfBirth: data.dateOfBirth,
          gender: data.gender,
          bloodGroup: data.bloodGroup || null,
          religion: data.religion,
          nationality: data.nationality || 'Bangladeshi',
          birthRegistrationNo: data.birthRegistrationNo || null,
          nationalId: data.nationalId || null,
          photoUrl: data.photoUrl || null,
          phone: data.phone || null,
          email: data.email || null,
          permanentAddressLine: data.permanentAddressLine || 'N/A',
          permanentVillage: data.permanentVillage || null,
          permanentPostOffice: data.permanentPostOffice || 'N/A',
          permanentPostCode: data.permanentPostCode || 'N/A',
          permanentThana: data.permanentThana || 'N/A',
          permanentDistrict: data.permanentDistrict || 'Dhaka',
          permanentDivision: data.permanentDivision,
          presentAddressLine: data.presentAddressLine || 'N/A',
          presentThana: data.presentThana || 'N/A',
          presentDistrict: data.presentDistrict || 'Dhaka',
          presentDivision: data.presentDivision,
          isPhysicallyChallenged: data.isPhysicallyChallenged,
          disabilityDetails: data.disabilityDetails || null,
          status: data.status,
          emergencyContacts: emergencyContact
            ? {
                create: {
                  name: emergencyContact.name,
                  relation: emergencyContact.relation,
                  phone: emergencyContact.phone,
                  address: emergencyContact.address || null,
                },
              }
            : undefined,
        },
        include: {
          emergencyContacts: true,
        },
      });

      return created;
    });

    // Write forensic audit log
    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || context.user.phone || 'User',
      actorRole: 'ADMIN',
      action: 'INSERT',
      entity: 'Student',
      entityId: newStudent.id,
      afterState: {
        studentCode: newStudent.studentCode,
        fullNameEn: newStudent.fullNameEn,
        status: newStudent.status,
      },
      changeSummary: `Created student ${newStudent.fullNameEn} (${newStudent.studentCode})`,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json(
      {
        success: true,
        data: newStudent,
        message: 'শিক্ষার্থী সফলভাবে নিবন্ধিত হয়েছে।',
      },
      { status: 201 }
    );
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
    if (err.message?.startsWith('DUPLICATE_CODE')) {
      return NextResponse.json(
        { success: false, error: err.message.replace('DUPLICATE_CODE: ', '') },
        { status: 409 }
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'এই স্টুডেন্ট আইডি / কোড ইতিমধ্যে নিবন্ধিত রয়েছে।' },
        { status: 409 }
      );
    }

    console.error('POST /api/school/students error:', error);
    return NextResponse.json(
      { success: false, error: 'শিক্ষার্থী নিবন্ধন করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
