import { NextRequest, NextResponse } from 'next/server';
import { SwitchSchoolInputSchema } from '@/lib/validation/auth';
import { getAuthContext } from '@/lib/authorization/engine';
import { validateSchoolMembership } from '@/lib/tenant/membership';
import { createSessionToken, setSessionCookie } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';

export async function POST(req: NextRequest) {
  try {
    const authContext = await getAuthContext(req);
    if (!authContext) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await req.json();
    const parseResult = SwitchSchoolInputSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid school ID format', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const targetSchoolId = parseResult.data.schoolId;

    // Verify membership in target school
    const membership = await validateSchoolMembership(authContext.userId, targetSchoolId);
    if (!membership.isMember && !authContext.user.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: You do not have membership in this school.' },
        { status: 403 }
      );
    }

    // Issue updated session token
    const { token, expiresAt } = await createSessionToken({
      userId: authContext.userId,
      activeSchoolId: targetSchoolId,
      isSuperAdmin: authContext.user.isSuperAdmin,
    });

    await setSessionCookie(token, expiresAt);

    await logAuditEvent({
      schoolId: targetSchoolId,
      actorUserId: authContext.userId,
      actorName: authContext.user.fullName,
      actorRole: 'USER',
      action: 'LOGIN',
      entity: 'Session',
      entityId: targetSchoolId,
      changeSummary: `User switched active tenant context to school ${targetSchoolId}.`,
    });

    return NextResponse.json({
      success: true,
      message: 'Active school switched successfully',
      activeSchoolId: targetSchoolId,
      school: membership.school,
    });
  } catch (error) {
    console.error('Unhandled switch-school error:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred while switching active school.' },
      { status: 500 }
    );
  }
}
