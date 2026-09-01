import { prisma } from '../db';

export interface AccessibleSchool {
  id: string;
  slug: string;
  nameEn: string;
  nameBn: string;
  roleCodes: string[];
  isMainTenant: boolean;
}

/**
 * Returns all active schools a user has legitimate membership or platform access to.
 */
export async function getUserAccessibleSchools(userId: string): Promise<AccessibleSchool[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      school: true,
      userRoles: {
        include: {
          role: true,
        },
      },
      teacherProfile: {
        include: {
          school: true,
        },
      },
      guardians: {
        include: {
          students: {
            include: {
              student: {
                include: {
                  school: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) return [];

  const schoolMap = new Map<string, AccessibleSchool>();

  // 1. Direct school on user model
  if (user.school && user.school.status === 'ACTIVE' && !user.school.deletedAt) {
    schoolMap.set(user.school.id, {
      id: user.school.id,
      slug: user.school.slug,
      nameEn: user.school.nameEn,
      nameBn: user.school.nameBn,
      roleCodes: [],
      isMainTenant: true,
    });
  }

  // 2. Roles in user_roles
  if (user.userRoles) {
    for (const ur of user.userRoles) {
      const role = ur.role;
      if (role.schoolId) {
        const existing = schoolMap.get(role.schoolId);
        if (existing) {
          if (!existing.roleCodes.includes(role.code)) {
            existing.roleCodes.push(role.code);
          }
        } else {
          const s = await prisma.school.findUnique({
            where: { id: role.schoolId, status: 'ACTIVE', deletedAt: null },
          });
          if (s) {
            schoolMap.set(s.id, {
              id: s.id,
              slug: s.slug,
              nameEn: s.nameEn,
              nameBn: s.nameBn,
              roleCodes: [role.code],
              isMainTenant: user.schoolId === s.id,
            });
          }
        }
      }
    }
  }

  // 3. Teacher profile
  if (user.teacherProfile?.school && user.teacherProfile.school.status === 'ACTIVE' && !user.teacherProfile.school.deletedAt) {
    const s = user.teacherProfile.school;
    const existing = schoolMap.get(s.id);
    if (existing) {
      if (!existing.roleCodes.includes('TEACHER')) existing.roleCodes.push('TEACHER');
    } else {
      schoolMap.set(s.id, {
        id: s.id,
        slug: s.slug,
        nameEn: s.nameEn,
        nameBn: s.nameBn,
        roleCodes: ['TEACHER'],
        isMainTenant: user.schoolId === s.id,
      });
    }
  }

  // 4. Guardian profile -> linked children schools
  if (user.guardians) {
    for (const g of user.guardians) {
      if (g.students) {
        for (const sg of g.students) {
          const s = sg.student?.school;
          if (s && s.status === 'ACTIVE' && !s.deletedAt) {
            const existing = schoolMap.get(s.id);
            if (existing) {
              if (!existing.roleCodes.includes('PARENT')) existing.roleCodes.push('PARENT');
            } else {
              schoolMap.set(s.id, {
                id: s.id,
                slug: s.slug,
                nameEn: s.nameEn,
                nameBn: s.nameBn,
                roleCodes: ['PARENT'],
                isMainTenant: user.schoolId === s.id,
              });
            }
          }
        }
      }
    }
  }

  // 5. Super Admin Platform Access (can access all active schools)
  if (user.isSuperAdmin) {
    const allSchools = await prisma.school.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { id: true, slug: true, nameEn: true, nameBn: true },
    });
    for (const s of allSchools) {
      if (!schoolMap.has(s.id)) {
        schoolMap.set(s.id, {
          id: s.id,
          slug: s.slug,
          nameEn: s.nameEn,
          nameBn: s.nameBn,
          roleCodes: ['SUPER_ADMIN'],
          isMainTenant: false,
        });
      }
    }
  }

  return Array.from(schoolMap.values());
}

/**
 * Validates that a user has active membership in a requested schoolId.
 * NEVER trusts client-supplied schoolId without this server validation!
 */
export async function validateSchoolMembership(
  userId: string,
  targetSchoolId: string
): Promise<{ isMember: boolean; school?: AccessibleSchool }> {
  if (!userId || !targetSchoolId) {
    return { isMember: false };
  }

  const accessibleSchools = await getUserAccessibleSchools(userId);
  const matched = accessibleSchools.find((s) => s.id === targetSchoolId);

  if (!matched) {
    return { isMember: false };
  }

  return {
    isMember: true,
    school: matched,
  };
}
