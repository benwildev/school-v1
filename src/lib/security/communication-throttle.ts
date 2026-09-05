/**
 * Communication Engine Rate Limiting & Throttling Store.
 *
 * Protects communication endpoints from:
 * 1. Bulk spam / SMS credit drain attacks
 * 2. Rapid-fire webhook replay abuse
 * 3. Unauthorized mass outbound blasts
 *
 * Backed by Redis (in production multi-instance) with Memory store fallback.
 */

export interface RateLimitResult {
  isAllowed: boolean;
  remaining: number;
  resetSeconds: number;
}

interface MemoryBucket {
  count: number;
  resetEpoch: number;
}

const memoryBuckets = new Map<string, MemoryBucket>();

async function checkRateLimitGeneric(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = Date.now();

  // 1. Try Redis client if configured
  try {
    const globalRedis = (globalThis as any).__redisClient;
    if (globalRedis && typeof globalRedis.incr === 'function') {
      const current = await globalRedis.incr(key);
      if (current === 1) {
        await globalRedis.expire(key, windowSeconds);
      }
      const ttl = await globalRedis.ttl(key);
      const isAllowed = current <= maxRequests;
      return {
        isAllowed,
        remaining: Math.max(0, maxRequests - current),
        resetSeconds: Math.max(0, ttl),
      };
    }
  } catch {
    // Fall back to memory store on redis failure
  }

  // 2. Memory bucket fallback
  let bucket = memoryBuckets.get(key);
  if (!bucket || now >= bucket.resetEpoch) {
    bucket = {
      count: 1,
      resetEpoch: now + windowSeconds * 1000,
    };
    memoryBuckets.set(key, bucket);
    return {
      isAllowed: true,
      remaining: maxRequests - 1,
      resetSeconds: windowSeconds,
    };
  }

  bucket.count++;
  const isAllowed = bucket.count <= maxRequests;
  const resetSeconds = Math.ceil((bucket.resetEpoch - now) / 1000);

  return {
    isAllowed,
    remaining: Math.max(0, maxRequests - bucket.count),
    resetSeconds,
  };
}

/**
 * Throttles outbound single message requests per school (e.g. max 500 per minute).
 */
export async function checkMessageSendThrottle(
  schoolId: string,
  channel: string
): Promise<RateLimitResult> {
  const key = `ratelimit:comm:send:${schoolId}:${channel.toLowerCase()}`;
  return checkRateLimitGeneric(key, 500, 60);
}

/**
 * Throttles bulk campaign submissions per school (e.g. max 10 campaigns per 10 minutes).
 */
export async function checkBulkCampaignThrottle(schoolId: string): Promise<RateLimitResult> {
  const key = `ratelimit:comm:bulk:${schoolId}`;
  return checkRateLimitGeneric(key, 10, 600);
}

/**
 * Throttles incoming webhook callbacks per remote IP (e.g. max 120 calls per minute).
 */
export async function checkWebhookThrottle(ip: string): Promise<RateLimitResult> {
  const key = `ratelimit:comm:webhook:${ip}`;
  return checkRateLimitGeneric(key, 120, 60);
}

/**
 * Generic rate limit checker for tests and endpoints.
 */
export async function checkCommunicationRateLimit(
  key: string,
  type: 'SEND_MESSAGE' | 'BULK_CAMPAIGN' | 'WEBHOOK'
): Promise<{ allowed: boolean; remaining: number; resetInSeconds: number }> {
  let result: RateLimitResult;
  if (type === 'SEND_MESSAGE') {
    result = await checkMessageSendThrottle(key, 'SMS');
  } else if (type === 'BULK_CAMPAIGN') {
    result = await checkBulkCampaignThrottle(key);
  } else {
    result = await checkWebhookThrottle(key);
  }
  return {
    allowed: result.isAllowed,
    remaining: result.remaining,
    resetInSeconds: result.resetSeconds,
  };
}

/**
 * Reset helper for testing.
 */
export function resetCommunicationThrottleState(): void {
  memoryBuckets.clear();
}

