import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { GuardianCreateSchema, GuardianFilterSchema } from '@/lib/validation/guardian';
import { Prisma } from '@prisma/client';

async function requireGuardianPermission(req: NextRequest, action: 'VIEW' | 'CREATE') {
  try {
    return await requirePermission(req, { permission: `GUARDIANS_${action}` });
  } catch {
    return await requirePermission(req, { permission: `STUDENTS_${action}` });
  }
}

/**
 * GET /api/school/guardians
 * Paginated guardian directory with search across name, phone, and email.
 * Required Permission: GUARDIANS_VIEW or STUDENTS_VIEW
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requireGuardianPermission(request, 'VIEW');

    const { searchParams } = new URL(request.url);
    const filterResult = GuardianFilterSchema.safeParse({
      page: searchParams.get('page') || 1,
      pageSize: searchParams.get('pageSize') || 20,
      search: searchParams.get('search') || undefined,
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

    const { page, pageSize, search } = filterResult.data;

    const result = await withTenantContext(schoolId, async (tx) => {
      const where: Prisma.GuardianWhereInput = {
        schoolId,
      };

      if (search && search.trim() !== '') {
        const query = search.trim();
        where.OR = [
          { fullNameEn: { contains: query, mode: 'insensitive' } },
          { fullNameBn: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
          { alternatePhone: { contains: query } },
          { email: { contains: query, mode: 'insensitive' } },
          { nationalId: { contains: query } },
        ];
      }

      const total = await tx.guardian.count({ where });

      const guardians = await tx.guardian.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [
          { createdAt: 'desc' },
          { fullNameEn: 'asc' },
        ],
        select: {
          id: true,
          schoolId: true,
          userId: true,
          fullNameEn: true,
          fullNameBn: true,
          relationType: true,
          nationalId: true,
          phone: true,
          alternatePhone: true,
          email: true,
          occupation: true,
          monthlyIncome: true,
          educationLevel: true,
          photoUrl: true,
          address: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              students: true,
            },
          },
        },
      });

      return {
        guardians,
        total,
      };
    });

    return NextResponse.json({
      success: true,
      data: result.guardians,
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

    console.error('GET /api/school/guardians error:', error);
    return NextResponse.json(
      { success: false, error: 'অভিভাবক তালিকা লোড করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/school/guardians
 * Register a new guardian profile.
 * Required Permission: GUARDIANS_CREATE or STUDENTS_CREATE
 */
export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requireGuardianPermission(request, 'CREATE');

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, error: 'রিকোয়েস্ট বডি প্রয়োজন।' },
        { status: 400 }
      );
    }

    const validation = GuardianCreateSchema.safeParse(body);
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

    const newGuardian = await withTenantContext(schoolId, async (tx) => {
      return tx.guardian.create({
        data: {
          schoolId,
          userId: null,
          fullNameEn: data.fullNameEn,
          fullNameBn: data.fullNameBn,
          relationType: data.relationType,
          nationalId: data.nationalId || null,
          phone: data.phone,
          alternatePhone: data.alternatePhone || null,
          email: data.email || null,
          occupation: data.occupation || null,
          monthlyIncome: data.monthlyIncome !== null && data.monthlyIncome !== undefined ? new Prisma.Decimal(data.monthlyIncome) : null,
          educationLevel: data.educationLevel || null,
          photoUrl: data.photoUrl || null,
          address: data.address || null,
        },
        select: {
          id: true,
          schoolId: true,
          userId: true,
          fullNameEn: true,
          fullNameBn: true,
          relationType: true,
          nationalId: true,
          phone: true,
          alternatePhone: true,
          email: true,
          occupation: true,
          monthlyIncome: true,
          educationLevel: true,
          photoUrl: true,
          address: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    // Write forensic audit log
    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || context.user.phone || 'User',
      actorRole: 'ADMIN',
      action: 'INSERT',
      entity: 'Guardian',
      entityId: newGuardian.id,
      afterState: {
        fullNameEn: newGuardian.fullNameEn,
        fullNameBn: newGuardian.fullNameBn,
        relationType: newGuardian.relationType,
        phone: newGuardian.phone,
      },
      changeSummary: `Created guardian ${newGuardian.fullNameEn} (${newGuardian.phone})`,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json(
      {
        success: true,
        data: newGuardian,
        message: 'অভিভাবক সফলভাবে নিবন্ধিত হয়েছে।',
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

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'এই অভিভাবকের তথ্য ইতিমধ্যে বিদ্যমান রয়েছে।' },
        { status: 409 }
      );
    }

    console.error('POST /api/school/guardians error:', error);
    return NextResponse.json(
      { success: false, error: 'অভিভাবক নিবন্ধন করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
