import { NextRequest } from 'next/server';
import { prisma } from '../db';
import { verifySessionToken, getSessionCookie } from '../auth/session';
import { validateSchoolMembership } from '../tenant/membership';
import { PermissionCode, PERMISSION_CATALOG } from './permissions';
import { evaluateScope, ResourceContext } from './scopes';

export interface AuthContext {
  userId: string;
  user: {
    id: string;
    email: string | null;
    phone: string;
    fullName: string;
    isSuperAdmin: boolean;
    schoolId: string | null;
  };
  activeSchoolId?: string | null;
  activeCampusId?: string | null;
  sessionId: string;
}

export interface AuthorizationResult {
  authorized: boolean;
  reason?: string;
  roles?: string[];
  evaluatedScope?: string;
}

/**
 * Authoritative server-side authorization engine.
 * Evaluates whether a user has permission to perform an action within a school.
 */
export async function authorize(params: {
  userId: string;
  schoolId: string;
  permission: PermissionCode;
  resourceContext?: ResourceContext;
}): Promise<AuthorizationResult> {
  const { userId, schoolId, permission, resourceContext } = params;

  if (!userId || !schoolId || !permission) {
    return { authorized: false, reason: 'Missing required authorization parameters.' };
  }

  // 1. Fetch user & check status
  const user = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
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

  if (!user || user.status !== 'ACTIVE') {
    return { authorized: false, reason: 'User account is inactive or not found.' };
  }

  // 2. SuperAdmin bypass for platform-level access, EXCEPT for tenant school reports
  // Special Rule: SuperAdmin must not accidentally inherit ordinary school tenant report access without active membership.
  const isReportPermission = permission.startsWith('REPORTS_') || PERMISSION_CATALOG[permission]?.module === 'REPORTS';
  if (user.isSuperAdmin && !isReportPermission) {
    return { authorized: true, roles: ['SUPER_ADMIN'], evaluatedScope: 'ENTIRE_SCHOOL' };
  }

  // 3. Verify user membership in requested school
  const membership = await validateSchoolMembership(userId, schoolId);
  if (!membership.isMember) {
    return { authorized: false, reason: 'User is not an active member of this school.' };
  }

  // If SuperAdmin is an active member of this school, they have full access
  if (user.isSuperAdmin) {
    return { authorized: true, roles: ['SUPER_ADMIN'], evaluatedScope: 'ENTIRE_SCHOOL' };
  }

  // 4. Special Business Rule: Discount Management Protection
  // Only Admin or School Owner can create/update/cancel discounts.
  // Accountants, Teachers, Students, Parents are explicitly barred.
  if (['DISCOUNTS_CREATE', 'DISCOUNTS_UPDATE', 'DISCOUNTS_CANCEL'].includes(permission)) {
    const isAdminOrOwner = user.userRoles.some(
      (ur: { role: { code: string } }) => ['SCHOOL_OWNER', 'ADMIN', 'PRINCIPAL'].includes(ur.role.code.toUpperCase())
    );
    if (!isAdminOrOwner) {
      return {
        authorized: false,
        reason: 'Unauthorized: Student discounts can only be authorized, modified, or cancelled by Admin or School Owner.',
      };
    }
  }

  // 4b. Special Business Rule: Separation of Duties for Payroll Finalization & Salary Approvals
  // Only School Owner, Principal, or Admin can finalize payroll or modify salary/advances.
  // Accountants, HR officers, Teachers, Students, and Parents are strictly barred from finalization/approvals.
  if (['PAYROLL_FINALIZE', 'SALARY_CREATE', 'SALARY_UPDATE', 'ADVANCE_APPROVE'].includes(permission)) {
    const isOwnerOrPrincipalOrAdmin = user.userRoles.some(
      (ur: { role: { code: string } }) => ['SCHOOL_OWNER', 'ADMIN', 'PRINCIPAL'].includes(ur.role.code.toUpperCase())
    );
    if (!isOwnerOrPrincipalOrAdmin) {
      return {
        authorized: false,
        reason: `Unauthorized: Permission '${permission}' requires School Owner, Principal, or Admin privileges.`,
      };
    }
  }

  // 5. Evaluate Roles and Permissions
  const permDef = PERMISSION_CATALOG[permission];
  if (!permDef) {
    return { authorized: false, reason: `Unknown permission code: ${permission}` };
  }

  const assignedRoles: string[] = [];
  let isAuthorized = false;
  let matchingScope = '';

  for (const ur of user.userRoles) {
    const role = ur.role;
    assignedRoles.push(role.code);

    // School Owner & Principal have full access to all school modules
    if (['SCHOOL_OWNER', 'PRINCIPAL'].includes(role.code.toUpperCase())) {
      return { authorized: true, roles: [role.code], evaluatedScope: 'ENTIRE_SCHOOL' };
    }

    for (const rp of role.rolePermissions) {
      const p = rp.permission;
      const isMatch =
        p.code === permission ||
        (p.module === permDef.module && p.action === permDef.action);

      if (isMatch) {
        // Evaluate Scope
        const scopePassed = await evaluateScope({
          userId,
          schoolId,
          scope: rp.scope,
          userRoleCampusId: ur.campusId,
          resourceContext,
        });

        if (scopePassed) {
          isAuthorized = true;
          matchingScope = rp.scope;
          break;
        }
      }
    }

    if (isAuthorized) break;
  }

  if (!isAuthorized) {
    return {
      authorized: false,
      roles: assignedRoles,
      reason: `User lacks required permission '${permission}' or failed scope evaluation for this resource.`,
    };
  }

  return { authorized: true, roles: assignedRoles, evaluatedScope: matchingScope };
}

/**
 * Extracts and verifies the current session from Request cookies or Authorization Bearer header.
 * 
 * SECURITY ZERO-TRUST RULE:
 * Route handlers and Server Actions MUST NEVER trust raw incoming headers such as 'x-user-id',
 * 'x-active-school-id', or 'x-is-super-admin' directly from client requests. Identity is derived
 * exclusively from the cryptographically verified JWT token and live PostgreSQL database records.
 */
export async function getAuthContext(req?: NextRequest): Promise<AuthContext | null> {
  let token: string | undefined;

  if (req) {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      token = req.cookies.get('__edusmart_session')?.value;
    }
  } else {
    token = await getSessionCookie();
  }

  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload || !payload.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      phone: true,
      fullName: true,
      isSuperAdmin: true,
      status: true,
      schoolId: true,
    },
  });

  if (!user || user.status !== 'ACTIVE') {
    return null;
  }

  return {
    userId: user.id,
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      isSuperAdmin: user.isSuperAdmin,
      schoolId: user.schoolId,
    },
    activeSchoolId: payload.activeSchoolId || user.schoolId,
    activeCampusId: payload.activeCampusId || null,
    sessionId: payload.sessionId,
  };
}

/**
 * Server Guard: Requires a valid authenticated session.
 */
export async function requireAuth(req?: NextRequest): Promise<AuthContext> {
  const context = await getAuthContext(req);
  if (!context) {
    throw new Error('UNAUTHORIZED: Valid authentication session is required.');
  }
  return context;
}

/**
 * Server Guard: Requires authenticated session with valid membership in specified schoolId.
 */
export async function requireActiveSchool(req?: NextRequest, schoolId?: string): Promise<{ context: AuthContext; schoolId: string }> {
  const context = await requireAuth(req);
  const targetSchoolId = schoolId || context.activeSchoolId;

  if (!targetSchoolId) {
    throw new Error('FORBIDDEN: No active school selected.');
  }

  const membership = await validateSchoolMembership(context.userId, targetSchoolId);
  if (!membership.isMember && !context.user.isSuperAdmin) {
    throw new Error('FORBIDDEN: You do not have permission to access this school.');
  }

  return { context, schoolId: targetSchoolId };
}

/**
 * Server Guard: Requires authenticated session with verified permission & scope.
 */
export async function requirePermission(
  req: NextRequest | undefined,
  params: {
    permission: PermissionCode;
    schoolId?: string;
    resourceContext?: ResourceContext;
  }
): Promise<{ context: AuthContext; schoolId: string }> {
  const { context, schoolId } = await requireActiveSchool(req, params.schoolId);

  const authz = await authorize({
    userId: context.userId,
    schoolId,
    permission: params.permission,
    resourceContext: params.resourceContext,
  });

  if (!authz.authorized) {
    throw new Error(`FORBIDDEN: ${authz.reason || 'Insufficient permissions.'}`);
  }

  return { context, schoolId };
}

/**
 * Server Guard: Requires Platform SuperAdmin privileges.
 */
export async function requireSuperAdmin(req?: NextRequest): Promise<AuthContext> {
  const context = await requireAuth(req);
  if (!context.user.isSuperAdmin) {
    throw new Error('FORBIDDEN: SuperAdmin platform privileges required.');
  }
  return context;
}
