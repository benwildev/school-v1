import { SignJWT, jwtVerify } from 'jose';
import { generateSecureId } from './crypto';
import { getSessionRevocationStore } from './revocation-store';

export const SESSION_COOKIE_NAME = '__edusmart_session';
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 Days

// In production, AUTH_SECRET must be defined in environment
const AUTH_SECRET = process.env.AUTH_SECRET || 'edusmart-bd-dev-secret-key-at-least-32-chars-long!';
const encodedKey = new TextEncoder().encode(AUTH_SECRET);

export interface SessionPayload {
  userId: string;
  sessionId: string;
  activeSchoolId?: string | null;
  activeCampusId?: string | null;
  isSuperAdmin?: boolean;
  issuedAt: number;
  expiresAt: number;
}

/**
 * Marks a specific session ID as revoked in the distributed store.
 */
export async function revokeSession(sessionId: string, expiresAt?: Date | number): Promise<void> {
  if (!sessionId) return;
  const store = getSessionRevocationStore();
  const exp = expiresAt || Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  await store.revoke(sessionId, exp);
}

/**
 * Revokes all active sessions for a user (e.g. password reset or account suspension).
 */
export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  if (!userId) return;
  const store = getSessionRevocationStore();
  await store.revokeAllForUser(userId);
}

/**
 * Checks if a session ID has been revoked in the distributed store.
 */
export async function isSessionRevoked(sessionId: string): Promise<boolean> {
  if (!sessionId) return true;
  const store = getSessionRevocationStore();
  return store.isRevoked(sessionId);
}

/**
 * Creates a signed JWT session token containing identity and active tenant context.
 */
export async function createSessionToken(params: {
  userId: string;
  activeSchoolId?: string | null;
  activeCampusId?: string | null;
  isSuperAdmin?: boolean;
}): Promise<{ token: string; sessionId: string; expiresAt: Date }> {
  const sessionId = generateSecureId();
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAtEpoch = issuedAt + SESSION_MAX_AGE_SECONDS;
  const expiresAt = new Date(expiresAtEpoch * 1000);

  const payload: SessionPayload = {
    userId: params.userId,
    sessionId,
    activeSchoolId: params.activeSchoolId || null,
    activeCampusId: params.activeCampusId || null,
    isSuperAdmin: Boolean(params.isSuperAdmin),
    issuedAt,
    expiresAt: expiresAtEpoch,
  };

  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAtEpoch)
    .sign(encodedKey);

  return { token, sessionId, expiresAt };
}

/**
 * Verifies a signed session token. Checks signature, expiration, and distributed revocation status.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ['HS256'],
    });

    const sessionPayload = payload as unknown as SessionPayload;

    if (!sessionPayload.sessionId || !sessionPayload.userId) {
      return null;
    }

    const store = getSessionRevocationStore();

    // 1. Check if specific session ID is revoked
    const revoked = await store.isRevoked(sessionPayload.sessionId);
    if (revoked) {
      return null;
    }

    // 2. Check if all sessions for user were revoked after token issuance
    if (sessionPayload.issuedAt) {
      const userRevoked = await store.isUserRevoked(sessionPayload.userId, sessionPayload.issuedAt);
      if (userRevoked) {
        return null;
      }
    }

    return sessionPayload;
  } catch {
    return null;
  }
}

/**
 * Sets the secure session cookie on Next.js Server Response.
 */
export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });
  } catch {
    // Non-Next.js or test environment fallback
  }
}

/**
 * Clears the session cookie on logout.
 */
export async function clearSessionCookie(): Promise<void> {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  } catch {
    // Non-Next.js or test environment fallback
  }
}

/**
 * Retrieves the raw session token from incoming cookies.
 */
export async function getSessionCookie(): Promise<string | undefined> {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    return cookieStore.get(SESSION_COOKIE_NAME)?.value;
  } catch {
    return undefined;
  }
}
