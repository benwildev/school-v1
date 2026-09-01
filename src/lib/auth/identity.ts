import { prisma } from '../db';
import { verifyPassword } from './crypto';
import { checkLoginThrottle, recordFailedLogin, clearLoginThrottle } from './throttle';
import { createSessionToken, setSessionCookie, clearSessionCookie, revokeSession } from './session';
import { getUserAccessibleSchools } from '../tenant/membership';
import { logAuditEvent } from '../audit/logger';

export interface AuthResult {
  success: boolean;
  error?: string;
  statusCode?: number;
  user?: {
    id: string;
    email: string | null;
    phone: string;
    fullName: string;
    isSuperAdmin: boolean;
    activeSchoolId: string | null;
  };
  availableSchools?: Array<{
    id: string;
    slug: string;
    nameEn: string;
    nameBn: string;
    roleCodes: string[];
  }>;
}

/**
 * Standardizes a Bangladesh phone number string into standard format.
 */
export function normalizePhone(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.startsWith('880')) {
    return '0' + digitsOnly.slice(3);
  }
  return digitsOnly;
}

/**
 * Authenticates a user by email or phone and password, enforcing distributed throttling and account state checks.
 * 
 * NOTE ON User.schoolId SEMANTICS:
 * User.schoolId represents the user's primary/default school preference for landing screens.
 * It is NOT treated as the sole source of tenant membership. Authoritative multi-school
 * access is evaluated dynamically from UserRole, Teacher, and Guardian/StudentGuardian linkages.
 */
export async function authenticateUser(params: {
  identifier: string;
  password: string;
  requestedSchoolId?: string | null;
  ipAddress?: string;
  userAgent?: string;
}): Promise<AuthResult> {
  const { identifier, password, requestedSchoolId, ipAddress = '127.0.0.1', userAgent } = params;

  if (!identifier || !password) {
    return { success: false, error: 'Identifier and password are required.', statusCode: 400 };
  }

  // 1. Check distributed login throttle
  const throttle = await checkLoginThrottle(identifier, ipAddress);
  if (throttle.isBlocked) {
    return {
      success: false,
      error: `Too many failed login attempts. Account temporarily locked for 15 minutes. Please try again later.`,
      statusCode: 429,
    };
  }

  // 2. Search by email or normalized phone
  const isEmail = identifier.includes('@');
  const normalizedIdentifier = isEmail ? identifier.toLowerCase().trim() : normalizePhone(identifier);

  const user = await prisma.user.findFirst({
    where: isEmail
      ? { email: { equals: normalizedIdentifier, mode: 'insensitive' }, deletedAt: null }
      : { phone: normalizedIdentifier, deletedAt: null },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!user) {
    await recordFailedLogin(identifier, ipAddress);
    // Generic message to prevent account enumeration
    return { success: false, error: 'Invalid identifier or password.', statusCode: 401 };
  }

  // 3. Verify password with bcrypt
  const isValidPassword = await verifyPassword(password, user.passwordHash);
  if (!isValidPassword) {
    const failureStatus = await recordFailedLogin(identifier, ipAddress);
    if (failureStatus.isBlocked) {
      return {
        success: false,
        error: 'Too many failed login attempts. Account temporarily locked for 15 minutes.',
        statusCode: 429,
      };
    }
    return { success: false, error: 'Invalid identifier or password.', statusCode: 401 };
  }

  // 4. Validate Account Status
  if (user.status === 'LOCKED') {
    return { success: false, error: 'Your account is locked. Please contact your school administrator.', statusCode: 403 };
  }
  if (user.status === 'SUSPENDED') {
    return { success: false, error: 'Your account is suspended. Please contact platform support.', statusCode: 403 };
  }
  if (user.status === 'INACTIVE') {
    return { success: false, error: 'Your account is inactive.', statusCode: 403 };
  }

  // Clear throttle on successful authentication
  await clearLoginThrottle(identifier, ipAddress);

  // 5. Resolve Accessible Schools
  const accessibleSchools = await getUserAccessibleSchools(user.id);

  // Determine active school:
  // - If requestedSchoolId specified, verify membership
  // - Else fallback to user.schoolId (primary default school)
  // - Else fallback to first accessible school
  let activeSchoolId: string | null = null;

  if (requestedSchoolId) {
    const isMember = accessibleSchools.some((s) => s.id === requestedSchoolId) || user.isSuperAdmin;
    if (!isMember) {
      return { success: false, error: 'User does not have access to the requested school.', statusCode: 403 };
    }
    activeSchoolId = requestedSchoolId;
  } else if (user.schoolId) {
    activeSchoolId = user.schoolId;
  } else if (accessibleSchools.length > 0) {
    activeSchoolId = accessibleSchools[0].id;
  }

  // 6. Generate Session Token & Set Cookie
  const { token, sessionId, expiresAt } = await createSessionToken({
    userId: user.id,
    activeSchoolId,
    isSuperAdmin: user.isSuperAdmin,
  });

  await setSessionCookie(token, expiresAt);

  // 7. Update User Last Login
  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      lastLoginIp: ipAddress || null,
    },
  });

  // 8. Log Audit Event
  if (activeSchoolId) {
    await logAuditEvent({
      schoolId: activeSchoolId,
      actorUserId: user.id,
      actorName: user.fullName,
      actorRole: user.isSuperAdmin ? 'SUPER_ADMIN' : 'USER',
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      sessionId,
      ipAddress,
      userAgent,
      changeSummary: `User ${user.fullName} logged in successfully.`,
    });
  }

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      isSuperAdmin: user.isSuperAdmin,
      activeSchoolId,
    },
    availableSchools: accessibleSchools,
  };
}

/**
 * Logs out the user by revoking session in distributed store, clearing session cookie, and recording audit event.
 */
export async function logoutUser(params?: {
  userId?: string;
  schoolId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  if (params?.sessionId) {
    await revokeSession(params.sessionId);
  }

  await clearSessionCookie();

  if (params?.schoolId && params?.userId) {
    await logAuditEvent({
      schoolId: params.schoolId,
      actorUserId: params.userId,
      actorName: 'User',
      actorRole: 'USER',
      action: 'LOGIN',
      entity: 'Session',
      entityId: params.sessionId || 'session',
      sessionId: params.sessionId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      changeSummary: `User logged out.`,
    });
  }
}
