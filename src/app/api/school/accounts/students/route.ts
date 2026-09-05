import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { AccountQuerySchema } from '@/lib/validation/account';
import { Prisma } from '@prisma/client';

/**
 * GET /api/school/accounts/students
 * List students with their portal account status, active enrollment, and active invitations.
 * Required Permission: STUDENT_ACCOUNTS_VIEW
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, {
      permission: 'STUDENT_ACCOUNTS_VIEW',
    });

    const { searchParams } = new URL(request.url);
    const validation = AccountQuerySchema.safeParse({
      page: searchParams.get('page') || 1,
      limit: searchParams.get('limit') || 20,
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || 'ALL',
    });

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'অবৈধ ফিল্টার বা পেজিনেশন প্যারামিটার।',
          details: validation.error.flatten(),
        },
        { status: 422 }
      );
    }

    const { page, limit, search, status } = validation.data;
    const skip = (page - 1) * limit;

    const result = await withTenantContext(schoolId, async (tx) => {
      const where: Prisma.StudentWhereInput = {
        schoolId,
      };

      if (search && search.trim() !== '') {
        const query = search.trim();
        where.OR = [
          { studentCode: { contains: query, mode: 'insensitive' } },
          { fullNameEn: { contains: query, mode: 'insensitive' } },
          { fullNameBn: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
          { birthRegistrationNo: { contains: query } },
        ];
      }

      if (status === 'ACTIVE') {
        where.studentUser = { is: { user: { status: 'ACTIVE' } } };
      } else if (status === 'INVITED') {
        where.studentUser = null;
        where.invitations = {
          some: {
            status: 'PENDING',
            expiresAt: { gt: new Date() },
          },
        };
      } else if (status === 'NO_ACCOUNT') {
        where.studentUser = null;
        where.invitations = {
          none: {
            status: 'PENDING',
            expiresAt: { gt: new Date() },
          },
        };
      }

      const [totalCount, students] = await Promise.all([
        tx.student.count({ where }),
        tx.student.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            studentUser: {
              include: {
                user: {
                  select: {
                    id: true,
                    status: true,
                    lastLoginAt: true,
                    email: true,
                    phone: true,
                  },
                },
              },
            },
            enrollments: {
              where: { status: 'ACTIVE' },
              take: 1,
              include: {
                class: { select: { nameEn: true, nameBn: true } },
                section: { select: { nameEn: true, nameBn: true } },
                academicSession: { select: { name: true } },
              },
            },
            invitations: {
              where: {
                status: 'PENDING',
                expiresAt: { gt: new Date() },
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                id: true,
                recipientPhone: true,
                recipientEmail: true,
                status: true,
                expiresAt: true,
                createdAt: true,
              },
            },
          },
        }),
      ]);

      const items = students.map((s) => {
        let accountStatus: 'ACTIVE' | 'INVITED' | 'NO_ACCOUNT' | 'SUSPENDED' = 'NO_ACCOUNT';
        if (s.studentUser?.user) {
          accountStatus = s.studentUser.user.status === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED';
        } else if (s.invitations.length > 0) {
          accountStatus = 'INVITED';
        }

        const activeEnrollment = s.enrollments[0]
          ? {
              className: s.enrollments[0].class.nameEn,
              sectionName: s.enrollments[0].section.nameEn,
              rollNo: s.enrollments[0].rollNo,
              sessionName: s.enrollments[0].academicSession.name,
            }
          : null;

        return {
          id: s.id,
          studentCode: s.studentCode,
          fullNameEn: s.fullNameEn,
          fullNameBn: s.fullNameBn,
          phone: s.phone,
          email: s.email,
          gender: s.gender,
          dateOfBirth: s.dateOfBirth,
          accountStatus,
          user: s.studentUser?.user || null,
          activeInvitation: s.invitations[0] || null,
          activeEnrollment,
        };
      });

      return {
        data: items,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    if (error?.status === 401 || error?.status === 403) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Error fetching student accounts:', error);
    return NextResponse.json(
      { success: false, error: 'শিক্ষার্থী অ্যাকাউন্ট তালিকা লোড করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
