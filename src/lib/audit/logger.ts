import { AuditAction, Prisma } from '@prisma/client';
import { prisma } from '../db';

export interface LogAuditParams {
  schoolId: string;
  actorUserId?: string | null;
  actorName?: string;
  actorRole?: string;
  actorType?: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  resourceUrn?: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  changeSummary?: string;
  requestId?: string;
  sessionId?: string;
  traceId?: string;
  ipAddress?: string;
  userAgent?: string;
  client?: any;
}

const SENSITIVE_KEY_STRINGS = new Set([
  'password',
  'passwordhash',
  'passwd',
  'secret',
  'token',
  'accesstoken',
  'refreshtoken',
  'jwt',
  'authorization',
  'bearer',
  'credentials',
  'credentialsencrypted',
  'trackingcode',
  'trackingpin',
  'pin',
  'cvv',
  'cvc',
  'creditcard',
  'cardnumber',
  'apikey',
  'webhooksecret',
  'privatekey',
  'passphrase',
  'cookie',
  'sessionid',
  'salt',
  'hash',
  'secretkey',
]);

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-_\s]/g, '');
  if (SENSITIVE_KEY_STRINGS.has(normalized)) return true;
  for (const sensitive of SENSITIVE_KEY_STRINGS) {
    if (normalized.includes(sensitive)) {
      return true;
    }
  }
  return false;
}

/**
 * Recursively sanitizes data to prevent accidental logging of passwords, tokens, pins, or secrets.
 */
export function sanitizeState(value: unknown, seen = new WeakSet(), depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (depth > 10) return '[MAX_DEPTH_EXCEEDED]';

  if (seen.has(value as object)) {
    return '[CIRCULAR]';
  }
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeState(item, seen, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveKey(k)) {
      result[k] = '[REDACTED]';
    } else {
      result[k] = sanitizeState(v, seen, depth + 1);
    }
  }

  return result;
}

/**
 * Persists an immutable forensic event log into the PostgreSQL audit_logs table.
 */
export async function logAuditEvent(params: LogAuditParams): Promise<void> {
  try {
    const dbClient = params.client || prisma;
    await dbClient.auditLog.create({
      data: {
        schoolId: params.schoolId,
        actorUserId: params.actorUserId || null,
        actorName: params.actorName || 'System',
        actorRole: params.actorRole || 'SYSTEM',
        actorType: params.actorType || 'USER',
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        resourceUrn: params.resourceUrn || null,
        beforeState: (sanitizeState(params.beforeState) ?? undefined) as Prisma.InputJsonValue | undefined,
        afterState: (sanitizeState(params.afterState) ?? undefined) as Prisma.InputJsonValue | undefined,
        changeSummary: params.changeSummary || null,
        requestId: params.requestId || null,
        sessionId: params.sessionId || null,
        traceId: params.traceId || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      },
    });
  } catch (error) {
    // Failure to write an audit log should be reported to server console but not crash the user request
    console.error('Failed to record audit log event:', error);
  }
}
