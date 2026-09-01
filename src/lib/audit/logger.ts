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
}

/**
 * Sanitizes object keys to prevent accidental logging of passwords, tokens, or sensitive hashes.
 */
function sanitizeState(state?: Record<string, unknown> | null): Prisma.InputJsonValue | undefined {
  if (!state) return undefined;
  const sanitized = { ...state };
  const sensitiveKeys = ['password', 'passwordhash', 'password_hash', 'token', 'secret', 'credentialsencrypted', 'credentials_encrypted'];

  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    }
  }

  return sanitized as Prisma.InputJsonValue;
}

/**
 * Persists an immutable forensic event log into the PostgreSQL audit_logs table.
 */
export async function logAuditEvent(params: LogAuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
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
        beforeState: sanitizeState(params.beforeState),
        afterState: sanitizeState(params.afterState),
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
