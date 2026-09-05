import { prisma } from '../db';

export interface ScopeCheckResult {
  isAuthorized: boolean;
  isPrivilegedAdmin: boolean;
  teacherId?: string;
  reason?: string;
}

/**
 * Checks if a user has elevated administrative privileges (Owner, Principal, Admin, SuperAdmin)
 * that bypass granular teacher assignment scope constraints.
 */
export async function isAdministrativeStaff(userId: string, schoolId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
    include: {
      userRoles: {
        where: {
          role: {
            OR: [
              { schoolId },
              { schoolId: null, isSystemRole: true },
            ],
          },
        },
        include: {
          role: true,
        },
      },
    },
  });

  if (!user || user.status !== 'ACTIVE') {
    return false;
  }

  if (user.isSuperAdmin) {
    return true;
  }

  return user.userRoles.some((ur) =>
    ['SCHOOL_OWNER', 'PRINCIPAL', 'ADMIN'].includes(ur.role.code.toUpperCase())
  );
}

/**
 * Validates whether the authenticated user has authoritative permission to manage attendance
 * for the given academic session, class, and section.
 */
export async function verifyTeacherAttendanceScope(params: {
  userId: string;
  schoolId: string;
  academicSessionId: string;
  classId: string;
  sectionId: string;
}): Promise<ScopeCheckResult> {
  const { userId, schoolId, academicSessionId, classId, sectionId } = params;

  // 1. Privileged institutional staff bypass class-specific assignment checks
  const isAdmin = await isAdministrativeStaff(userId, schoolId);
  if (isAdmin) {
    return { isAuthorized: true, isPrivilegedAdmin: true };
  }

  // 2. Fetch linked Teacher identity
  const teacher = await prisma.teacher.findFirst({
    where: {
      userId,
      schoolId,
      status: 'ACTIVE',
    },
  });

  if (!teacher) {
    return {
      isAuthorized: false,
      isPrivilegedAdmin: false,
      reason: 'No active teacher profile found linked to this account.',
    };
  }

  // 3. Query authoritative TeacherAssignment
  const assignment = await prisma.teacherAssignment.findFirst({
    where: {
      schoolId,
      teacherId: teacher.id,
      academicSessionId,
      classId,
      sectionId,
      canTakeAttendance: true,
      status: 'ACTIVE',
    },
  });

  if (!assignment) {
    return {
      isAuthorized: false,
      isPrivilegedAdmin: false,
      teacherId: teacher.id,
      reason: 'Teacher is not authorized or assigned to record attendance for this class and section.',
    };
  }

  return {
    isAuthorized: true,
    isPrivilegedAdmin: false,
    teacherId: teacher.id,
  };
}

/**
 * Validates whether the authenticated user has authoritative permission to enter or edit marks
 * for the given academic session, class, section, and subject.
 */
export async function verifyTeacherMarksScope(params: {
  userId: string;
  schoolId: string;
  academicSessionId: string;
  classId: string;
  sectionId: string;
  subjectId: string;
}): Promise<ScopeCheckResult> {
  const { userId, schoolId, academicSessionId, classId, sectionId, subjectId } = params;

  // 1. Privileged institutional staff bypass
  const isAdmin = await isAdministrativeStaff(userId, schoolId);
  if (isAdmin) {
    return { isAuthorized: true, isPrivilegedAdmin: true };
  }

  // 2. Fetch linked Teacher identity
  const teacher = await prisma.teacher.findFirst({
    where: {
      userId,
      schoolId,
      status: 'ACTIVE',
    },
  });

  if (!teacher) {
    return {
      isAuthorized: false,
      isPrivilegedAdmin: false,
      reason: 'No active teacher profile found linked to this account.',
    };
  }

  // 3. Query authoritative TeacherAssignment
  // Can match either direct subject teacher assignment OR class coordinator with subject wildcard
  const assignment = await prisma.teacherAssignment.findFirst({
    where: {
      schoolId,
      teacherId: teacher.id,
      academicSessionId,
      classId,
      sectionId,
      canEnterMarks: true,
      status: 'ACTIVE',
      OR: [
        { subjectId },
        { subjectId: null }, // Exam coordinator / Head class teacher with enter marks rights
      ],
    },
  });

  if (!assignment) {
    return {
      isAuthorized: false,
      isPrivilegedAdmin: false,
      teacherId: teacher.id,
      reason: 'Teacher is not assigned or authorized to enter marks for this subject in this section.',
    };
  }

  return {
    isAuthorized: true,
    isPrivilegedAdmin: false,
    teacherId: teacher.id,
  };
}
