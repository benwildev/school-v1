import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/authorization/engine';
import { logoutUser } from '@/lib/auth/identity';
import { revokeSession } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  try {
    const authContext = await getAuthContext(req);

    if (authContext?.sessionId) {
      revokeSession(authContext.sessionId);
    }

    const ipAddress =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || undefined;

    await logoutUser({
      userId: authContext?.userId,
      schoolId: authContext?.activeSchoolId || undefined,
      sessionId: authContext?.sessionId,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Unhandled logout error:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred during logout.' },
      { status: 500 }
    );
  }
}
