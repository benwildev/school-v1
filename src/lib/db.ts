import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Execute a callback within an isolated PostgreSQL Row-Level Security (RLS) tenant session.
 * Uses interactive transaction and parameterized set_config to prevent SQL injection.
 */
export async function withTenantContext<T>(
  schoolId: string,
  callback: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_school_id', ${schoolId}, true)`;
    return callback(tx as unknown as PrismaClient);
  });
}

/**
 * Execute a callback in a dedicated session context for cross-tenant IDENTITY
 * resolution only: login, session verification, and multi-school role/membership
 * lookups on `users`/`roles`/`user_roles`, which must be readable by user id
 * before any single school's tenant scope is known (a person can hold roles at
 * more than one school).
 *
 * This sets an explicit sentinel (`app.identity_lookup`) that the RLS policies
 * on those tables require verbatim (see migrations/0020_auth_identity_rls_policies.sql).
 * It is intentionally NOT the same as an absent/empty `app.current_school_id` —
 * a query that forgets to call withTenantContext/withIdentityContext still fails
 * closed (returns no rows) instead of silently gaining cross-tenant access.
 *
 * Do NOT use this for `teachers`, `guardians`, or `student_users` — those are
 * single-school-per-row and must go through withTenantContext instead.
 */
export async function withIdentityContext<T>(
  callback: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.identity_lookup', 'true', true)`;
    return callback(tx as unknown as PrismaClient);
  });
}
