import { NextRequest, NextResponse } from 'next/server';
import { LoginInputSchema } from '@/lib/validation/auth';
import { authenticateUser } from '@/lib/auth/identity';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parseResult = LoginInputSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const ipAddress =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || undefined;

    const result = await authenticateUser({
      identifier: parseResult.data.identifier,
      password: parseResult.data.password,
      requestedSchoolId: parseResult.data.requestedSchoolId,
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Authentication failed' },
        { status: result.statusCode || 401 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      user: result.user,
      availableSchools: result.availableSchools,
    });
  } catch (error) {
    console.error('Unhandled login error:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected authentication error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
