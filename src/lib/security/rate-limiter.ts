/**
 * Distributed Rate Limiter & Redis Connection Manager with Graceful In-Memory Failover.
 * 
 * When REDIS_URL is configured and accessible, distributed rate limiting and token
 * bucket/fixed window checks run on Redis.
 * If Redis is not configured, unreachable, or throws an error, the system automatically
 * and gracefully degrades to high-performance local in-memory tracking without crashing requests.
 */

export interface RateLimitResult {
  isAllowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  usingRedis: boolean;
}

interface MemoryBucket {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, MemoryBucket>();

// Periodic memory store cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of memoryStore.entries()) {
    if (bucket.resetAt <= now) {
      memoryStore.delete(key);
    }
  }
}, 60000).unref();

/**
 * Returns the active Redis client if configured and available, or null.
 */
export function getRedisClient(): any {
  if (typeof globalThis === 'undefined') return null;
  return (globalThis as any).__redisClient || null;
}

/**
 * Registers an active Redis client for distributed rate limiting, throttling, and session revocation.
 */
export function setRedisClient(client: any): void {
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).__redisClient = client;
  }
}

/**
 * High-performance rate limit check with graceful degradation.
 * 
 * @param key Unique rate limiting key (e.g. `rate:ip:127.0.0.1`, `rate:user:uuid`)
 * @param limit Maximum allowed requests within window
 * @param windowSeconds Duration of window in seconds
 */
export async function checkRateLimit(
  key: string,
  limit: number = 60,
  windowSeconds: number = 60
): Promise<RateLimitResult> {
  const redis = getRedisClient();

  if (redis && typeof redis.incr === 'function') {
    try {
      const current = await redis.incr(key);
      if (current === 1 && typeof redis.expire === 'function') {
        await redis.expire(key, windowSeconds);
      }
      const ttl = typeof redis.ttl === 'function' ? await redis.ttl(key) : windowSeconds;
      const resetSeconds = ttl > 0 ? ttl : windowSeconds;

      return {
        isAllowed: current <= limit,
        limit,
        remaining: Math.max(0, limit - current),
        resetSeconds,
        usingRedis: true,
      };
    } catch (err) {
      console.warn(`Redis rate limiter error for key '${key}', falling back to memory store:`, err);
    }
  }

  // Graceful In-Memory Fallback
  const now = Date.now();
  let bucket = memoryStore.get(key);

  if (!bucket || bucket.resetAt <= now) {
    bucket = {
      count: 1,
      resetAt: now + windowSeconds * 1000,
    };
    memoryStore.set(key, bucket);
  } else {
    bucket.count += 1;
  }

  const remaining = Math.max(0, limit - bucket.count);
  const resetSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

  return {
    isAllowed: bucket.count <= limit,
    limit,
    remaining,
    resetSeconds,
    usingRedis: false,
  };
}

/**
 * Resets or clears a rate limit key.
 */
export async function resetRateLimit(key: string): Promise<void> {
  const redis = getRedisClient();
  if (redis && typeof redis.del === 'function') {
    try {
      await redis.del(key);
    } catch (err) {
      console.warn(`Redis rate limit reset error for key '${key}':`, err);
    }
  }
  memoryStore.delete(key);
}
