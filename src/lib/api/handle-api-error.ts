import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

const PREFIX_STATUS: Record<string, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  DUPLICATE_CODE: 409,
  CONFLICT: 409,
  VALIDATION: 400,
};

/**
 * Centralized API error -> HTTP response mapping.
 *
 * Authorization guards (requireAuth/requireActiveSchool/requirePermission in
 * src/lib/authorization/engine.ts) and route handlers throw plain `Error`s
 * using a `PREFIX: message` convention (UNAUTHORIZED/FORBIDDEN/NOT_FOUND/
 * DUPLICATE_CODE/CONFLICT/VALIDATION). This maps each known prefix to the
 * correct HTTP status and returns only the message after the prefix to the
 * client. Anything unrecognized (a bug, a DB error, etc.) is logged in full
 * server-side and returns a generic 500 message, so internal error details
 * (stack traces, raw exception text) are never leaked to the client.
 *
 * Use this in every route handler's catch block instead of a bespoke
 * error.message.includes(...)/error.status check.
 */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { success: false, error: 'Invalid request data.', issues: error.issues },
      { status: 400 }
    );
  }

  if (error instanceof Error) {
    const match = /^([A-Z_]+):\s*([\s\S]*)$/.exec(error.message);
    if (match) {
      const [, prefix, rest] = match;
      const status = PREFIX_STATUS[prefix];
      if (status) {
        return NextResponse.json({ success: false, error: rest || error.message }, { status });
      }
    }
  }

  console.error('Unhandled API error:', error);
  return NextResponse.json(
    { success: false, error: 'An unexpected error occurred. Please try again later.' },
    { status: 500 }
  );
}
