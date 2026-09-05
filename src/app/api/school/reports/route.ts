import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSchool } from '@/lib/authorization/engine';
import { REPORT_REGISTRY } from '@/lib/reports/report-registry';
import { prisma } from '@/lib/db';


/**
 * GET /api/school/reports
 * Discovers available reports filtered by the authenticated user's permissions.
 */
export async function GET(request: NextRequest) {
  try {
    const { context, schoolId } = await requireActiveSchool(request);

    // Fetch user permissions for the active school
    const user = await prisma.user.findUnique({
      where: { id: context.userId, deletedAt: null },
      include: {
        userRoles: {
          where: {
            role: {
              OR: [
                { schoolId: schoolId },
                { schoolId: null, isSystemRole: true },
              ],
            },
          },
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const isOwnerOrAdmin = user?.userRoles.some((ur) =>
      ['SCHOOL_OWNER', 'PRINCIPAL', 'ADMIN'].includes(ur.role.code.toUpperCase())
    );

    const userPermissionCodes = new Set<string>();
    if (user) {
      for (const ur of user.userRoles) {
        for (const rp of ur.role.rolePermissions) {
          userPermissionCodes.add(rp.permission.code);
        }
      }
    }

    // Filter available reports based on user permissions
    const accessibleReports = Object.values(REPORT_REGISTRY).filter((report) => {
      if (isOwnerOrAdmin) return true;
      return userPermissionCodes.has(report.requiredPermission);
    });

    return NextResponse.json({
      success: true,
      data: accessibleReports.map((r) => ({
        reportId: r.reportId,
        name: r.name,
        nameBn: r.nameBn,
        module: r.module,
        description: r.description,
        descriptionBn: r.descriptionBn,
        supportedFilters: r.supportedFilters,
        supportedExports: r.supportedExports,
      })),
    });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
