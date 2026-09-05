import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { AccountQuerySchema } from '@/lib/validation/account';
import { Prisma } from '@prisma/client';

/**
 * GET /api/school/accounts/guardians
 * List guardians with their portal account status, linked children, and active invitations.
 * Required Permission: PARENT_ACCOUNTS_VIEW
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, {
      permission: 'PARENT_ACCOUNTS_VIEW',
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
      const where: Prisma.GuardianWhereInput = {
        schoolId,
      };

      if (search && search.trim() !== '') {
        const query = search.trim();
        where.OR = [
          { fullNameEn: { contains: query, mode: 'insensitive' } },
          { fullNameBn: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
          { nationalId: { contains: query } },
          { email: { contains: query, mode: 'insensitive' } },
        ];
      }

      if (status === 'ACTIVE') {
        where.userId = { not: null };
        where.user = { status: 'ACTIVE' };
      } else if (status === 'INVITED') {
        where.userId = null;
        where.invitations = {
          some: {
            status: 'PENDING',
            expiresAt: { gt: new Date() },
          },
        };
      } else if (status === 'NO_ACCOUNT') {
        where.userId = null;
        where.invitations = {
          none: {
            status: 'PENDING',
            expiresAt: { gt: new Date() },
          },
        };
      }

      const [totalCount, guardians] = await Promise.all([
        tx.guardian.count({ where }),
        tx.guardian.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
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
            students: {
              include: {
                student: {
                  select: {
                    id: true,
                    studentCode: true,
                    fullNameEn: true,
                    fullNameBn: true,
                    enrollments: {
                      where: { status: 'ACTIVE' },
                      take: 1,
                      include: {
                        class: { select: { nameEn: true, nameBn: true } },
                        section: { select: { nameEn: true, nameBn: true } },
                      },
                    },
                  },
                },
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

      const items = guardians.map((g) => {
        let accountStatus: 'ACTIVE' | 'INVITED' | 'NO_ACCOUNT' | 'SUSPENDED' = 'NO_ACCOUNT';
        if (g.user) {
          accountStatus = g.user.status === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED';
        } else if (g.invitations.length > 0) {
          accountStatus = 'INVITED';
        }

        return {
          id: g.id,
          fullNameEn: g.fullNameEn,
          fullNameBn: g.fullNameBn,
          phone: g.phone,
          email: g.email,
          nationalId: g.nationalId,
          relationType: g.relationType,
          accountStatus,
          user: g.user,
          activeInvitation: g.invitations[0] || null,
          linkedChildrenCount: g.students.length,
          children: g.students.map((s) => ({
            studentId: s.student.id,
            studentCode: s.student.studentCode,
            fullNameEn: s.student.fullNameEn,
            fullNameBn: s.student.fullNameBn,
            isPrimary: s.isPrimary,
            activeEnrollment: s.student.enrollments[0]
              ? {
                  className: s.student.enrollments[0].class.nameEn,
                  sectionName: s.student.enrollments[0].section.nameEn,
                }
              : null,
          })),
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
    console.error('Error fetching guardian accounts:', error);
    return NextResponse.json(
      { success: false, error: 'অভিভাবক অ্যাকাউন্ট তালিকা লোড করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
