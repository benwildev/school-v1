import { PermissionCode } from '../authorization/permissions';
import { PermissionScope } from '@prisma/client';
import { prisma } from '../db';
import { AuthContext, authorize } from '../authorization/engine';
import { ReportFilterParams } from './report-types';


export interface ReportAuthorizationResult {
  authorized: boolean;
  reason?: string;
  scope: PermissionScope;
  userCampusId?: string | null;
  teacherId?: string | null;
  studentId?: string | null;
  guardianId?: string | null;
}

/**
 * Evaluates whether an authenticated user is permitted to view or export the given report
 * within the specified school tenant context, and resolves their active scope.
 */
export async function authorizeReportAccess(params: {
  context: AuthContext;
  schoolId: string;
  requiredPermission: PermissionCode;
  filters: ReportFilterParams;
}): Promise<ReportAuthorizationResult> {
  const { context, schoolId, requiredPermission, filters } = params;

  // 1. Authorize base report permission
  const authResult = await authorize({
    userId: context.userId,
    schoolId,
    permission: requiredPermission,
    resourceContext: {
      targetCampusId: filters.campusId,
      targetClassId: filters.classId,
      targetSectionId: filters.sectionId,
      targetSubjectId: filters.subjectId,
      targetStudentId: filters.studentId,
    },
  });

  if (!authResult.authorized) {
    return {
      authorized: false,
      reason: authResult.reason || 'Insufficient report permissions.',
      scope: 'ENTIRE_SCHOOL',
    };
  }

  const scope = (authResult.evaluatedScope || 'ENTIRE_SCHOOL') as PermissionScope;

  // 2. Resolve additional domain-specific identity IDs for scoped roles
  let teacherId: string | null = null;
  let studentId: string | null = null;
  let guardianId: string | null = null;

  if (['ASSIGNED_CLASSES', 'ASSIGNED_SUBJECTS', 'OWN_STUDENTS'].includes(scope)) {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: context.userId, schoolId, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
    teacherId = teacher?.id || null;
  }

  if (scope === 'OWN_DATA') {
    const student = await prisma.student.findFirst({
      where: {
        schoolId,
        OR: [
          ...(context.user.email ? [{ email: context.user.email }] : []),
          { phone: context.user.phone },
        ],
        deletedAt: null,
      },
      select: { id: true },
    });
    studentId = student?.id || null;
  }

  if (scope === 'OWN_CHILDREN') {
    const guardian = await prisma.guardian.findFirst({
      where: { userId: context.userId, schoolId },
      select: { id: true },
    });
    guardianId = guardian?.id || null;
  }

  return {
    authorized: true,
    scope,
    userCampusId: context.activeCampusId || null,
    teacherId,
    studentId,
    guardianId,
  };
}
