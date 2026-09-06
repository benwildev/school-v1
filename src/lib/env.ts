/**
 * Centralized Environment & Secret Configuration
 *
 * Strict security rule: Under no circumstances should fallback hardcoded secrets
 * be permitted. Missing or weak secrets will immediately throw a fatal error.
 */

export function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.trim().length < 32) {
    throw new Error(
      'FATAL SECURITY CONFIGURATION: AUTH_SECRET is not configured or is shorter than 32 characters. ' +
      'Please set a cryptographically secure AUTH_SECRET in your environment.'
    );
  }
  return new TextEncoder().encode(secret.trim());
}

export function getDeviceCredentialSecret(): string {
  const secret = process.env.DEVICE_CREDENTIAL_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret || secret.trim().length < 32) {
    throw new Error(
      'FATAL SECURITY CONFIGURATION: DEVICE_CREDENTIAL_SECRET is not configured or is shorter than 32 characters. ' +
      'Please set a cryptographically secure DEVICE_CREDENTIAL_SECRET in your environment.'
    );
  }
  return secret.trim();
}

export function getCommunicationWebhookSecret(): string {
  const secret = process.env.COMMUNICATION_WEBHOOK_SECRET;
  if (!secret || secret.trim().length < 16) {
    throw new Error(
      'FATAL SECURITY CONFIGURATION: COMMUNICATION_WEBHOOK_SECRET is not configured or is shorter than 16 characters. ' +
      'Please set COMMUNICATION_WEBHOOK_SECRET in your environment.'
    );
  }
  return secret.trim();
}

export function validateEnvironment(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    getAuthSecret();
  } catch (err: any) {
    errors.push(err.message);
  }

  try {
    getDeviceCredentialSecret();
  } catch (err: any) {
    errors.push(err.message);
  }

  try {
    getCommunicationWebhookSecret();
  } catch (err: any) {
    errors.push(err.message);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
