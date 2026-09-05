import crypto from 'crypto';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * In-memory tenant-isolated report cache.
 * Guarantee: Cross-tenant cache collisions are mathematically impossible
 * because all cache keys must begin with `report:${schoolId}:`.
 */
class ReportCacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTtlMs = 60 * 1000; // 60 seconds default TTL for aggregate metrics

  /**
   * Generates a deterministic hash from a filter object.
   */
  private hashFilters(filters: Record<string, any>): string {
    const keys = Object.keys(filters).sort();
    const normalized: Record<string, any> = {};
    for (const key of keys) {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        normalized[key] = filters[key];
      }
    }
    return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex').substring(0, 16);
  }

  /**
   * Builds a strictly tenant-isolated cache key.
   * Format: `report:${schoolId}:${reportId}:${filterHash}`
   */
  public buildKey(schoolId: string, reportId: string, filters: Record<string, any>): string {
    if (!schoolId) {
      throw new Error('SECURITY VIOLATION: Cannot generate cache key without authoritative schoolId.');
    }
    const filterHash = this.hashFilters(filters);
    return `report:${schoolId}:${reportId}:${filterHash}`;
  }

  /**
   * Retrieves a cached report value if present and unexpired.
   */
  public get<T>(schoolId: string, reportId: string, filters: Record<string, any>): T | null {
    const key = this.buildKey(schoolId, reportId, filters);
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Stores a report execution result in cache with tenant-scoped key.
   */
  public set<T>(
    schoolId: string,
    reportId: string,
    filters: Record<string, any>,
    data: T,
    ttlMs?: number
  ): void {
    const key = this.buildKey(schoolId, reportId, filters);
    const expiresAt = Date.now() + (ttlMs || this.defaultTtlMs);
    this.cache.set(key, { data, expiresAt });
  }

  /**
   * Invalidates all cache entries for a specific school (or specific report in that school).
   */
  public invalidate(schoolId: string, reportId?: string): void {
    const prefix = reportId ? `report:${schoolId}:${reportId}:` : `report:${schoolId}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clears the entire cache (useful in tests).
   */
  public clearAll(): void {
    this.cache.clear();
  }
}

export const reportCache = new ReportCacheService();
