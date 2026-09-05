/**
 * Admission Tracking Rate Limiting & Throttling Store.
 * 
 * Protects public tracking endpoints from:
 * 1. Brute-force tracking code guessing
 * 2. Automated enumeration
 * 3. Application-number probing
 * 4. Distributed denial-of-service abuse
 * 
 * Threshold: 5 failed attempts per IP + schoolSlug -> 15-minute temporary lockout.
 * Backed by Redis (in production multi-instance) with Memory store fallback.
 */

export const THROTTLE_MAX_ATTEMPTS = 5;
export const THROTTLE_LOCKOUT_SECONDS = 15 * 60; // 15 Minutes

export interface ThrottleStatus {
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
  return `throttle:track:${schoolSlug.toLowerCase().trim()}:${ip.trim()}`;
}

/**
 * Checks whether tracking requests for this IP + schoolSlug are currently locked out.
 */
export async function checkTrackingThrottle(
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
      const blocked = count >= THROTTLE_MAX_ATTEMPTS;
      return {
        isBlocked: blocked,
        blockedUntil: blocked ? new Date(Date.now() + THROTTLE_LOCKOUT_SECONDS * 1000) : undefined,
        remainingAttempts: Math.max(0, THROTTLE_MAX_ATTEMPTS - count),
      };
    }
  } catch (err) {
    console.warn('Redis tracking check failed, using fallback:', err);
  }

  // 2. In-Memory fallback
  const record = memoryRecords.get(key);
  if (!record) {
    return { isBlocked: false, remainingAttempts: THROTTLE_MAX_ATTEMPTS };
  }

  const now = Math.floor(Date.now() / 1000);
  if (record.blockedUntilEpoch && now > record.blockedUntilEpoch) {
    memoryRecords.delete(key);
    return { isBlocked: false, remainingAttempts: THROTTLE_MAX_ATTEMPTS };
  }

  const blocked = record.count >= THROTTLE_MAX_ATTEMPTS;
  return {
    isBlocked: blocked,
    blockedUntil: record.blockedUntilEpoch ? new Date(record.blockedUntilEpoch * 1000) : undefined,
    remainingAttempts: Math.max(0, THROTTLE_MAX_ATTEMPTS - record.count),
  };
}

/**
 * Records a failed tracking attempt for this IP + schoolSlug.
 */
export async function recordTrackingFailure(
  ip: string,
  schoolSlug: string
): Promise<ThrottleStatus> {
  const key = getThrottleKey(ip, schoolSlug);

  // 1. Record in Redis if available
  try {
    if (
      typeof globalThis !== 'undefined' &&
      (globalThis as unknown as { __redisClient?: { incr: (k: string) => Promise<number>; expire: (k: string, s: number) => Promise<unknown> } }).__redisClient
    ) {
      const client = (globalThis as unknown as { __redisClient: { incr: (k: string) => Promise<number>; expire: (k: string, s: number) => Promise<unknown> } }).__redisClient;
      const count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, THROTTLE_LOCKOUT_SECONDS);
      }
      const blocked = count >= THROTTLE_MAX_ATTEMPTS;
      const blockedUntil = blocked ? new Date(Date.now() + THROTTLE_LOCKOUT_SECONDS * 1000) : undefined;
      return { count, failureCount: count, blocked, isBlocked: blocked, blockedUntil };
    }
  } catch (err) {
    console.warn('Redis tracking record failure failed, using fallback:', err);
  }

  // 2. In-Memory fallback
  const now = Math.floor(Date.now() / 1000);
  const existing = memoryRecords.get(key);

  let count = 1;
  let blockedUntilEpoch: number | undefined;

  if (existing) {
    if (existing.blockedUntilEpoch && now > existing.blockedUntilEpoch) {
      count = 1;
    } else {
      count = existing.count + 1;
    }
  }

  const blocked = count >= THROTTLE_MAX_ATTEMPTS;
  if (blocked) {
    blockedUntilEpoch = now + THROTTLE_LOCKOUT_SECONDS;
  }

  memoryRecords.set(key, {
    count,
    lastAttemptEpoch: now,
    blockedUntilEpoch,
  });

  return {
    count,
    failureCount: count,
    blocked,
    isBlocked: blocked,
    blockedUntil: blockedUntilEpoch ? new Date(blockedUntilEpoch * 1000) : undefined,
  };
}

/**
 * Clears failures for this IP + schoolSlug upon successful tracking lookup.
 */
export async function clearTrackingThrottle(ip: string, schoolSlug: string): Promise<void> {
  const key = getThrottleKey(ip, schoolSlug);

  try {
    if (
      typeof globalThis !== 'undefined' &&
      (globalThis as unknown as { __redisClient?: { del: (k: string) => Promise<unknown> } }).__redisClient
    ) {
      await (globalThis as unknown as { __redisClient: { del: (k: string) => Promise<unknown> } }).__redisClient.del(key);
      return;
    }
  } catch (err) {
    console.warn('Redis tracking clear failure failed, using fallback:', err);
  }

  memoryRecords.delete(key);
}
