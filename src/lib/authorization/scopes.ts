import { PermissionScope } from '@prisma/client';
import { prisma } from '../db';

export interface ResourceContext {
  targetUserId?: string;
  targetStudentId?: string;
  targetTeacherId?: string;
  targetCampusId?: string;
  targetClassId?: string;
  targetSectionId?: string;
  targetSubjectId?: string;
  targetAcademicSessionId?: string;
}

/**
 * Evaluates whether a user satisfies the scope constraints for a given resource and school.
 */
export async function evaluateScope(params: {
  userId: string;
  schoolId: string;
  scope: PermissionScope;
  userRoleCampusId?: string | null;
  resourceContext?: ResourceContext;
}): Promise<boolean> {
  const { userId, schoolId, scope, userRoleCampusId, resourceContext } = params;

  // 1. ENTIRE_SCHOOL: Unrestricted access across the school
  if (scope === 'ENTIRE_SCHOOL') {
    return true;
  }

  // If no resource context is specified for a restricted scope, we cannot authorize specific mutation
  if (!resourceContext) {
    // For listing / global view, scopes filter returned data
    return true;
  }

  // 2. OWN_CAMPUS
  if (scope === 'OWN_CAMPUS') {
    if (!userRoleCampusId) return false;
    if (resourceContext.targetCampusId && resourceContext.targetCampusId !== userRoleCampusId) {
      return false;
    }
    return true;
  }

  // 3. ASSIGNED_CLASSES (Teacher Class-Level Scope)
  if (scope === 'ASSIGNED_CLASSES') {
    if (!resourceContext.targetSectionId && !resourceContext.targetClassId) {
      return true;
    }

    const teacher = await prisma.teacher.findFirst({
      where: { userId, schoolId, status: 'ACTIVE', deletedAt: null },
    });
    if (!teacher) return false;

    const assignment = await prisma.teacherAssignment.findFirst({
      where: {
        teacherId: teacher.id,
        schoolId,
        status: 'ACTIVE',
        ...(resourceContext.targetClassId ? { classId: resourceContext.targetClassId } : {}),
        ...(resourceContext.targetSectionId ? { sectionId: resourceContext.targetSectionId } : {}),
      },
    });

    return Boolean(assignment);
  }

  // 4. ASSIGNED_SUBJECTS (Teacher Subject-Level Scope)
  if (scope === 'ASSIGNED_SUBJECTS') {
    if (!resourceContext.targetSubjectId) {
      return true;
    }

    const teacher = await prisma.teacher.findFirst({
      where: { userId, schoolId, status: 'ACTIVE', deletedAt: null },
    });
    if (!teacher) return false;

    const assignment = await prisma.teacherAssignment.findFirst({
      where: {
        teacherId: teacher.id,
        schoolId,
        subjectId: resourceContext.targetSubjectId,
        status: 'ACTIVE',
        ...(resourceContext.targetSectionId ? { sectionId: resourceContext.targetSectionId } : {}),
        ...(resourceContext.targetClassId ? { classId: resourceContext.targetClassId } : {}),
      },
    });

    return Boolean(assignment);
  }

  // 5. OWN_STUDENTS (Teacher Student-Level Scope)
  if (scope === 'OWN_STUDENTS') {
    if (!resourceContext.targetStudentId) return true;

    const teacher = await prisma.teacher.findFirst({
      where: { userId, schoolId, status: 'ACTIVE', deletedAt: null },
    });
    if (!teacher) return false;

    // Find if student is currently enrolled in any section taught by teacher
    const studentEnrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: resourceContext.targetStudentId,
        schoolId,
        status: 'ACTIVE',
      },
    });
    if (!studentEnrollment) return false;

    const assignment = await prisma.teacherAssignment.findFirst({
      where: {
        teacherId: teacher.id,
        schoolId,
        sectionId: studentEnrollment.sectionId,
        status: 'ACTIVE',
      },
    });

    return Boolean(assignment);
  }

  // 6. OWN_CHILDREN (Parent Scope)
  if (scope === 'OWN_CHILDREN') {
    if (!resourceContext.targetStudentId) return true;

    const guardian = await prisma.guardian.findFirst({
      where: { userId, schoolId },
    });
    if (!guardian) return false;

    const linkage = await prisma.studentGuardian.findFirst({
      where: {
        guardianId: guardian.id,
        studentId: resourceContext.targetStudentId,
        schoolId,
      },
    });

    return Boolean(linkage);
  }

  // 7. OWN_DATA (Student / Self Scope)
  if (scope === 'OWN_DATA') {
    // Check if target user is self
    if (resourceContext.targetUserId && resourceContext.targetUserId === userId) {
      return true;
    }

    // Check if user is linked to target student
    if (resourceContext.targetStudentId) {
      // Find if student profile exists for this user email/phone
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) return false;

      const student = await prisma.student.findFirst({
        where: {
          id: resourceContext.targetStudentId,
          schoolId,
          OR: [
            ...(user.email ? [{ email: user.email }] : []),
            { phone: user.phone },
          ],
        },
      });

      return Boolean(student);
    }

    return true;
  }

  return false;
}
