import { getLoginThrottleStore, THROTTLE_MAX_ATTEMPTS, THROTTLE_LOCKOUT_SECONDS } from './throttle-store.ts';

export { THROTTLE_MAX_ATTEMPTS, THROTTLE_LOCKOUT_SECONDS };

/**
 * Checks whether login attempts for identifier + IP are currently throttled/locked.
 */
export async function checkLoginThrottle(identifier: string, ipAddress: string): Promise<{ isBlocked: boolean; blockedUntil?: Date; remainingAttempts: number }> {
  const store = getLoginThrottleStore();
  const blockedStatus = await store.isBlocked(identifier, ipAddress);

  if (blockedStatus.blocked) {
    return {
      isBlocked: true,
      blockedUntil: blockedStatus.blockedUntil,
      remainingAttempts: 0,
    };
  }

  const failureCount = await store.getFailureCount(identifier, ipAddress);
  const remainingAttempts = Math.max(0, THROTTLE_MAX_ATTEMPTS - failureCount);

  return {
    isBlocked: false,
    remainingAttempts,
  };
}

/**
 * Records a failed login attempt in the distributed throttle store.
 */
export async function recordFailedLogin(identifier: string, ipAddress: string): Promise<{ isBlocked: boolean; blockedUntil?: Date; failureCount: number }> {
  const store = getLoginThrottleStore();
  const result = await store.recordFailure(identifier, ipAddress);

  return {
    isBlocked: result.blocked,
    blockedUntil: result.blockedUntil,
    failureCount: result.count,
  };
}

/**
 * Clears failed login attempts in the distributed throttle store on successful authentication.
 */
export async function clearLoginThrottle(identifier: string, ipAddress: string): Promise<void> {
  const store = getLoginThrottleStore();
  await store.clearFailures(identifier, ipAddress);
}
