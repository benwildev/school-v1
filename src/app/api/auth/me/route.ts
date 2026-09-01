import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/authorization/engine';
import { getUserAccessibleSchools } from '@/lib/tenant/membership';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const authContext = await getAuthContext(req);
    if (!authContext) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const accessibleSchools = await getUserAccessibleSchools(authContext.userId);

    // Fetch roles & permissions in active school
    const activeSchoolId = authContext.activeSchoolId;
    let rolesInSchool: Array<{ id: string; code: string; name: string }> = [];
    let permissionCodes: string[] = [];

    if (activeSchoolId) {
      const userWithRoles = await prisma.user.findUnique({
        where: { id: authContext.userId },
        include: {
          userRoles: {
            where: {
              role: {
                OR: [{ schoolId: activeSchoolId }, { schoolId: null, isSystemRole: true }],
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

      if (userWithRoles) {
        rolesInSchool = userWithRoles.userRoles.map((ur) => ({
          id: ur.role.id,
          code: ur.role.code,
          name: ur.role.name,
        }));

        const permSet = new Set<string>();
        for (const ur of userWithRoles.userRoles) {
          for (const rp of ur.role.rolePermissions) {
            permSet.add(rp.permission.code);
          }
        }
        permissionCodes = Array.from(permSet);
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authContext.user.id,
        email: authContext.user.email,
        phone: authContext.user.phone,
        fullName: authContext.user.fullName,
        isSuperAdmin: authContext.user.isSuperAdmin,
      },
      activeSchoolId,
      availableSchools: accessibleSchools,
      roles: rolesInSchool,
      permissions: permissionCodes,
    });
  } catch (error) {
    console.error('Unhandled /api/auth/me error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve authenticated profile.' },
      { status: 500 }
    );
  }
}
