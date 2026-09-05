import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSchool } from '@/lib/authorization/engine';
import { getManagementOverviewAnalytics } from '@/lib/reports/overview-analytics';
import { prisma } from '@/lib/db';

/**
 * GET /api/school/analytics/overview
 * Executive Management Overview KPIs and Trend Graphs.
 */
export async function GET(request: NextRequest) {
  try {
    const { context, schoolId } = await requireActiveSchool(request);

    // Fetch user roles for the current school
    const userRoles = await prisma.userRole.findMany({
      where: {
        userId: context.userId,
        role: {
          OR: [
            { schoolId },
            { schoolId: null, isSystemRole: true },
          ],
        },
      },
      include: { role: { select: { code: true } } },
    });

    const roleCodes = userRoles.map((ur: any) => ur.role?.code).filter(Boolean);
    if (context.user.isSuperAdmin) roleCodes.push('SUPER_ADMIN');


    const analytics = await getManagementOverviewAnalytics(schoolId, roleCodes);

    return NextResponse.json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
