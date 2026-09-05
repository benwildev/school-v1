/**
 * Public Invitation Rate Limiting & Throttling Store.
 * 
 * Protects public invitation verification and acceptance endpoints from:
 * 1. Brute-force invitation token guessing
 * 2. Enumeration of parent/student accounts
 * 3. Denial-of-service probing
 * 
 * Threshold: 5 failed attempts per IP + schoolSlug -> 15-minute temporary lockout.
 * Backed by Redis with Memory store fallback.
 */

export const INVITATION_THROTTLE_MAX_ATTEMPTS = 5;
export const INVITATION_THROTTLE_LOCKOUT_SECONDS = 15 * 60; // 15 Minutes

export interface InvitationThrottleStatus {
  count: number;
  failureCount: number;
  blocked: boolean;
  isBlocked: boolean;
  blockedUntil?: Date;
}

interface ThrottleRecord {
  count: number;
  lastAttemptEpoch: number;
  blockedUntilEpoch?: number;
}

const memoryRecords = new Map<string, ThrottleRecord>();

function getThrottleKey(ip: string, schoolSlug: string): string {
  return `throttle:invitation:${schoolSlug.toLowerCase().trim()}:${ip.trim()}`;
}

/**
 * Checks whether invitation requests for this IP + schoolSlug are currently locked out.
 */
export async function checkInvitationThrottle(
  ip: string,
  schoolSlug: string
): Promise<{ isBlocked: boolean; blockedUntil?: Date; remainingAttempts: number }> {
  const key = getThrottleKey(ip, schoolSlug);

  // 1. Check Redis if available
  try {
    if (
      typeof globalThis !== 'undefined' &&
      (globalThis as unknown as { __redisClient?: { get: (k: string) => Promise<string | null> } }).__redisClient
    ) {
      const client = (globalThis as unknown as { __redisClient: { get: (k: string) => Promise<string | null> } }).__redisClient;
      const countVal = await client.get(key);
      const count = countVal ? parseInt(countVal, 10) : 0;
      const blocked = count >= INVITATION_THROTTLE_MAX_ATTEMPTS;
      return {
        isBlocked: blocked,
        blockedUntil: blocked ? new Date(Date.now() + INVITATION_THROTTLE_LOCKOUT_SECONDS * 1000) : undefined,
        remainingAttempts: Math.max(0, INVITATION_THROTTLE_MAX_ATTEMPTS - count),
      };
    }
  } catch (err) {
    console.warn('Redis invitation check failed, using fallback:', err);
  }

  // 2. In-Memory fallback
  const record = memoryRecords.get(key);
  if (!record) {
    return { isBlocked: false, remainingAttempts: INVITATION_THROTTLE_MAX_ATTEMPTS };
  }

  const now = Date.now();
  if (record.blockedUntilEpoch && record.blockedUntilEpoch > now) {
    return {
      isBlocked: true,
      blockedUntil: new Date(record.blockedUntilEpoch),
      remainingAttempts: 0,
    };
  }

  // Expired lockout reset
  if (record.blockedUntilEpoch && record.blockedUntilEpoch <= now) {
    memoryRecords.delete(key);
    return { isBlocked: false, remainingAttempts: INVITATION_THROTTLE_MAX_ATTEMPTS };
  }

  return {
    isBlocked: record.count >= INVITATION_THROTTLE_MAX_ATTEMPTS,
    blockedUntil: record.count >= INVITATION_THROTTLE_MAX_ATTEMPTS ? new Date(now + INVITATION_THROTTLE_LOCKOUT_SECONDS * 1000) : undefined,
    remainingAttempts: Math.max(0, INVITATION_THROTTLE_MAX_ATTEMPTS - record.count),
  };
}

/**
 * Records a failed invitation lookup/acceptance attempt.
 */
export async function recordInvitationFailure(
  ip: string,
  schoolSlug: string
): Promise<{ isBlocked: boolean; blockedUntil?: Date; failureCount: number }> {
  const key = getThrottleKey(ip, schoolSlug);
  const now = Date.now();

  try {
    if (
      typeof globalThis !== 'undefined' &&
      (globalThis as unknown as { __redisClient?: { incr: (k: string) => Promise<number>; expire: (k: string, s: number) => Promise<void> } }).__redisClient
    ) {
      const client = (globalThis as unknown as { __redisClient: { incr: (k: string) => Promise<number>; expire: (k: string, s: number) => Promise<void> } }).__redisClient;
      const count = await client.incr(key);
      await client.expire(key, INVITATION_THROTTLE_LOCKOUT_SECONDS);
      const isBlocked = count >= INVITATION_THROTTLE_MAX_ATTEMPTS;
      return {
        isBlocked,
        blockedUntil: isBlocked ? new Date(now + INVITATION_THROTTLE_LOCKOUT_SECONDS * 1000) : undefined,
        failureCount: count,
      };
    }
  } catch (err) {
    console.warn('Redis invitation record failed, using fallback:', err);
  }

  const current = memoryRecords.get(key) || { count: 0, lastAttemptEpoch: now };
  current.count += 1;
  current.lastAttemptEpoch = now;

  if (current.count >= INVITATION_THROTTLE_MAX_ATTEMPTS) {
    current.blockedUntilEpoch = now + INVITATION_THROTTLE_LOCKOUT_SECONDS * 1000;
  }

  memoryRecords.set(key, current);

  const isBlocked = current.count >= INVITATION_THROTTLE_MAX_ATTEMPTS;
  return {
    isBlocked,
    blockedUntil: isBlocked && current.blockedUntilEpoch ? new Date(current.blockedUntilEpoch) : undefined,
    failureCount: current.count,
  };
}

/**
 * Clears invitation failure counts upon a successful token acceptance/verification.
 */
export async function clearInvitationThrottle(ip: string, schoolSlug: string): Promise<void> {
  const key = getThrottleKey(ip, schoolSlug);
  try {
    if (
      typeof globalThis !== 'undefined' &&
      (globalThis as unknown as { __redisClient?: { del: (k: string) => Promise<void> } }).__redisClient
    ) {
      await (globalThis as unknown as { __redisClient: { del: (k: string) => Promise<void> } }).__redisClient.del(key);
    }
  } catch (err) {
    console.warn('Redis invitation clear failed:', err);
  }
  memoryRecords.delete(key);
}

/**
 * Status diagnostic helper
 */
export async function getInvitationThrottleStatus(
  ip: string,
  schoolSlug: string
): Promise<InvitationThrottleStatus> {
  const { isBlocked, blockedUntil, remainingAttempts } = await checkInvitationThrottle(ip, schoolSlug);
  const failureCount = INVITATION_THROTTLE_MAX_ATTEMPTS - remainingAttempts;
  return {
    count: failureCount,
    failureCount,
    blocked: isBlocked,
    isBlocked,
    blockedUntil,
  };
}
