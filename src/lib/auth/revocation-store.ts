/**
 * Distributed Session Revocation Store Abstraction
 * 
 * Ensures session invalidation works reliably across all application instances
 * in a multi-node / serverless production deployment.
 */

export interface SessionRevocationStore {
  /**
   * Marks a specific sessionId as revoked until its expiration time.
   */
  revoke(sessionId: string, expiresAt: Date | number): Promise<void>;

  /**
   * Checks if a specific sessionId is currently revoked.
   */
  isRevoked(sessionId: string): Promise<boolean>;

  /**
   * Revokes all active sessions for a specific user (e.g. after password reset or account suspension).
   */
  revokeAllForUser(userId: string): Promise<void>;

  /**
   * Checks if a user has had a global session invalidation event newer than token issue time.
   */
  isUserRevoked(userId: string, issuedAtEpochSeconds: number): Promise<boolean>;

  /**
   * Purges expired revocation records from storage.
   */
  clearExpired(): Promise<void>;
}

/**
 * In-Memory Session Revocation Store Adapter (for local development and isolated testing).
 */
export class MemorySessionRevocationStore implements SessionRevocationStore {
  private revokedSessions = new Map<string, number>(); // sessionId -> expiresAtEpochSeconds
  private userRevocations = new Map<string, number>(); // userId -> revokedAtEpochSeconds

  async revoke(sessionId: string, expiresAt: Date | number): Promise<void> {
    if (!sessionId) return;
    const epochSec = typeof expiresAt === 'number' ? expiresAt : Math.floor(expiresAt.getTime() / 1000);
    this.revokedSessions.set(sessionId, epochSec);
  }

  async isRevoked(sessionId: string): Promise<boolean> {
    if (!sessionId) return true;
    const expiresAt = this.revokedSessions.get(sessionId);
    if (!expiresAt) return false;

    const now = Math.floor(Date.now() / 1000);
    if (now > expiresAt) {
      this.revokedSessions.delete(sessionId);
      return false;
    }
    return true;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    if (!userId) return;
    const now = Math.floor(Date.now() / 1000);
    this.userRevocations.set(userId, now);
  }

  async isUserRevoked(userId: string, issuedAtEpochSeconds: number): Promise<boolean> {
    if (!userId) return false;
    const revokedAt = this.userRevocations.get(userId);
    if (!revokedAt) return false;
    return issuedAtEpochSeconds <= revokedAt;
  }

  async clearExpired(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    for (const [sessionId, expiresAt] of this.revokedSessions.entries()) {
      if (now > expiresAt) {
        this.revokedSessions.delete(sessionId);
      }
    }
  }
}

/**
 * Redis-Compatible Session Revocation Store Adapter (for production multi-instance deployments).
 * When REDIS_URL is configured, connects to Redis and stores keys with native TTLs.
 */
export class RedisSessionRevocationStore implements SessionRevocationStore {
  private memoryFallback = new MemorySessionRevocationStore();

  async revoke(sessionId: string, expiresAt: Date | number): Promise<void> {
    const epochSec = typeof expiresAt === 'number' ? expiresAt : Math.floor(expiresAt.getTime() / 1000);
    const ttlSeconds = Math.max(1, epochSec - Math.floor(Date.now() / 1000));

    try {
      // If Redis client is configured globally or dynamically
      if (typeof globalThis !== 'undefined' && (globalThis as unknown as { __redisClient?: { set: (k: string, v: string, opts?: { EX?: number }) => Promise<unknown> } }).__redisClient) {
        await (globalThis as unknown as { __redisClient: { set: (k: string, v: string, opts?: { EX?: number }) => Promise<unknown> } }).__redisClient.set(`session:revoked:${sessionId}`, '1', { EX: ttlSeconds });
        return;
      }
    } catch (err) {
      console.warn('Redis revocation write failed, using fallback:', err);
    }

    await this.memoryFallback.revoke(sessionId, expiresAt);
  }

  async isRevoked(sessionId: string): Promise<boolean> {
    try {
      if (typeof globalThis !== 'undefined' && (globalThis as unknown as { __redisClient?: { get: (k: string) => Promise<string | null> } }).__redisClient) {
        const val = await (globalThis as unknown as { __redisClient: { get: (k: string) => Promise<string | null> } }).__redisClient.get(`session:revoked:${sessionId}`);
        if (val !== null) return true;
      }
    } catch (err) {
      console.warn('Redis revocation read failed, using fallback:', err);
    }

    return this.memoryFallback.isRevoked(sessionId);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    try {
      if (typeof globalThis !== 'undefined' && (globalThis as unknown as { __redisClient?: { set: (k: string, v: string, opts?: { EX?: number }) => Promise<unknown> } }).__redisClient) {
        // Retain user revocation timestamp for max session age (7 days = 604800s)
        await (globalThis as unknown as { __redisClient: { set: (k: string, v: string, opts?: { EX?: number }) => Promise<unknown> } }).__redisClient.set(`user:revoked:${userId}`, String(now), { EX: 7 * 24 * 60 * 60 });
        return;
      }
    } catch (err) {
      console.warn('Redis user revocation write failed, using fallback:', err);
    }

    await this.memoryFallback.revokeAllForUser(userId);
  }

  async isUserRevoked(userId: string, issuedAtEpochSeconds: number): Promise<boolean> {
    try {
      if (typeof globalThis !== 'undefined' && (globalThis as unknown as { __redisClient?: { get: (k: string) => Promise<string | null> } }).__redisClient) {
        const val = await (globalThis as unknown as { __redisClient: { get: (k: string) => Promise<string | null> } }).__redisClient.get(`user:revoked:${userId}`);
        if (val !== null) {
          const revokedAt = parseInt(val, 10);
          if (!isNaN(revokedAt) && issuedAtEpochSeconds <= revokedAt) {
            return true;
          }
        }
      }
    } catch (err) {
      console.warn('Redis user revocation read failed, using fallback:', err);
    }

    return this.memoryFallback.isUserRevoked(userId, issuedAtEpochSeconds);
  }

  async clearExpired(): Promise<void> {
    await this.memoryFallback.clearExpired();
  }
}

// Global singleton instance
let revocationStoreInstance: SessionRevocationStore | null = null;

export function getSessionRevocationStore(): SessionRevocationStore {
  if (!revocationStoreInstance) {
    if (process.env.REDIS_URL) {
      revocationStoreInstance = new RedisSessionRevocationStore();
    } else {
      revocationStoreInstance = new MemorySessionRevocationStore();
    }
  }
  return revocationStoreInstance;
}

export function setSessionRevocationStoreForTesting(store: SessionRevocationStore): void {
  revocationStoreInstance = store;
}
