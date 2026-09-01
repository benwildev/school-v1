/**
 * Distributed Login Throttling Store Abstraction
 * 
 * Provides rate-limiting and brute-force protection across multiple server instances.
 * Implements 5 failed attempts -> 15-minute temporary lockout.
 */

export interface ThrottleStatus {
  count: number;
  blocked: boolean;
  blockedUntil?: Date;
}

export interface LoginThrottleStore {
  /**
   * Records a failed login attempt for the identifier + IP combination.
   */
  recordFailure(identifier: string, ip: string): Promise<ThrottleStatus>;

  /**
   * Retrieves the current failed attempt count.
   */
  getFailureCount(identifier: string, ip: string): Promise<number>;

  /**
   * Checks whether the identifier + IP combination is currently locked out.
   */
  isBlocked(identifier: string, ip: string): Promise<{ blocked: boolean; blockedUntil?: Date }>;

  /**
   * Clears failure records upon successful authentication.
   */
  clearFailures(identifier: string, ip: string): Promise<void>;
}

export const THROTTLE_MAX_ATTEMPTS = 5;
export const THROTTLE_LOCKOUT_SECONDS = 15 * 60; // 15 Minutes

interface ThrottleRecord {
  count: number;
  lastAttemptEpoch: number;
  blockedUntilEpoch?: number;
}

/**
 * In-Memory Login Throttle Store (for local development and isolated testing).
 */
export class MemoryLoginThrottleStore implements LoginThrottleStore {
  private records = new Map<string, ThrottleRecord>();

  private getKey(identifier: string, ip: string): string {
    return `${identifier.toLowerCase().trim()}:${ip.trim()}`;
  }

  async recordFailure(identifier: string, ip: string): Promise<ThrottleStatus> {
    const key = this.getKey(identifier, ip);
    const now = Math.floor(Date.now() / 1000);
    const existing = this.records.get(key);

    let count = 1;
    let blockedUntilEpoch: number | undefined;

    if (existing) {
      // If previous lockout expired, reset count
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

    this.records.set(key, {
      count,
      lastAttemptEpoch: now,
      blockedUntilEpoch,
    });

    return {
      count,
      blocked,
      blockedUntil: blockedUntilEpoch ? new Date(blockedUntilEpoch * 1000) : undefined,
    };
  }

  async getFailureCount(identifier: string, ip: string): Promise<number> {
    const key = this.getKey(identifier, ip);
    const record = this.records.get(key);
    if (!record) return 0;

    const now = Math.floor(Date.now() / 1000);
    if (record.blockedUntilEpoch && now > record.blockedUntilEpoch) {
      this.records.delete(key);
      return 0;
    }

    return record.count;
  }

  async isBlocked(identifier: string, ip: string): Promise<{ blocked: boolean; blockedUntil?: Date }> {
    const key = this.getKey(identifier, ip);
    const record = this.records.get(key);
    if (!record || !record.blockedUntilEpoch) {
      return { blocked: false };
    }

    const now = Math.floor(Date.now() / 1000);
    if (now < record.blockedUntilEpoch) {
      return {
        blocked: true,
        blockedUntil: new Date(record.blockedUntilEpoch * 1000),
      };
    }

    // Lockout expired
    this.records.delete(key);
    return { blocked: false };
  }

  async clearFailures(identifier: string, ip: string): Promise<void> {
    const key = this.getKey(identifier, ip);
    this.records.delete(key);
  }
}

/**
 * Redis-Compatible Login Throttle Store (for production multi-instance deployments).
 */
export class RedisLoginThrottleStore implements LoginThrottleStore {
  private memoryFallback = new MemoryLoginThrottleStore();

  private getKey(identifier: string, ip: string): string {
    return `throttle:login:${identifier.toLowerCase().trim()}:${ip.trim()}`;
  }

  async recordFailure(identifier: string, ip: string): Promise<ThrottleStatus> {
    const key = this.getKey(identifier, ip);
    try {
      if (typeof globalThis !== 'undefined' && (globalThis as unknown as { __redisClient?: { incr: (k: string) => Promise<number>; expire: (k: string, s: number) => Promise<unknown> } }).__redisClient) {
        const client = (globalThis as unknown as { __redisClient: { incr: (k: string) => Promise<number>; expire: (k: string, s: number) => Promise<unknown> } }).__redisClient;
        const count = await client.incr(key);
        if (count === 1) {
          await client.expire(key, THROTTLE_LOCKOUT_SECONDS);
        }

        const blocked = count >= THROTTLE_MAX_ATTEMPTS;
        const blockedUntil = blocked ? new Date(Date.now() + THROTTLE_LOCKOUT_SECONDS * 1000) : undefined;
        return { count, blocked, blockedUntil };
      }
    } catch (err) {
      console.warn('Redis throttle recordFailure failed, using fallback:', err);
    }

    return this.memoryFallback.recordFailure(identifier, ip);
  }

  async getFailureCount(identifier: string, ip: string): Promise<number> {
    const key = this.getKey(identifier, ip);
    try {
      if (typeof globalThis !== 'undefined' && (globalThis as unknown as { __redisClient?: { get: (k: string) => Promise<string | null> } }).__redisClient) {
        const val = await (globalThis as unknown as { __redisClient: { get: (k: string) => Promise<string | null> } }).__redisClient.get(key);
        return val ? parseInt(val, 10) : 0;
      }
    } catch (err) {
      console.warn('Redis throttle getFailureCount failed, using fallback:', err);
    }

    return this.memoryFallback.getFailureCount(identifier, ip);
  }

  async isBlocked(identifier: string, ip: string): Promise<{ blocked: boolean; blockedUntil?: Date }> {
    const count = await this.getFailureCount(identifier, ip);
    if (count >= THROTTLE_MAX_ATTEMPTS) {
      return {
        blocked: true,
        blockedUntil: new Date(Date.now() + THROTTLE_LOCKOUT_SECONDS * 1000),
      };
    }
    return { blocked: false };
  }

  async clearFailures(identifier: string, ip: string): Promise<void> {
    const key = this.getKey(identifier, ip);
    try {
      if (typeof globalThis !== 'undefined' && (globalThis as unknown as { __redisClient?: { del: (k: string) => Promise<unknown> } }).__redisClient) {
        await (globalThis as unknown as { __redisClient: { del: (k: string) => Promise<unknown> } }).__redisClient.del(key);
        return;
      }
    } catch (err) {
      console.warn('Redis throttle clearFailures failed, using fallback:', err);
    }

    await this.memoryFallback.clearFailures(identifier, ip);
  }
}

// Global singleton instance
let throttleStoreInstance: LoginThrottleStore | null = null;

export function getLoginThrottleStore(): LoginThrottleStore {
  if (!throttleStoreInstance) {
    if (process.env.REDIS_URL) {
      throttleStoreInstance = new RedisLoginThrottleStore();
    } else {
      throttleStoreInstance = new MemoryLoginThrottleStore();
    }
  }
  return throttleStoreInstance;
}

export function setLoginThrottleStoreForTesting(store: LoginThrottleStore): void {
  throttleStoreInstance = store;
}
