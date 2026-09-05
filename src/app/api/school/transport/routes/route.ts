import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { CreateRouteSchema } from '@/lib/validation/transport';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'ROUTES_VIEW' });

    const { searchParams } = new URL(request.url);
    const campusId = searchParams.get('campusId');
    const status = searchParams.get('status');

    const routes = await withTenantContext(schoolId, async () => {
      const where: any = { schoolId };
      if (campusId) where.campusId = campusId;
      if (status) where.status = status;

      return prisma.transportRoute.findMany({
        where,
        include: {
          campus: { select: { id: true, nameEn: true, nameBn: true } },
          stops: {
            orderBy: { sequenceNumber: 'asc' },
          },
          _count: {
            select: {
              studentAssignments: { where: { status: 'ACTIVE' } },
              trips: true,
            },
          },
        },
        orderBy: { routeCode: 'asc' },
      });
    });

    return NextResponse.json({ success: true, data: routes });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'ROUTES_CREATE' });

    const body = await request.json();
    const parsed = CreateRouteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { campusId, routeCode, routeName, description, status } = parsed.data;

    const route = await withTenantContext(schoolId, async () => {
      if (campusId) {
        const campus = await prisma.campus.findFirst({
          where: { id: campusId, schoolId },
        });
        if (!campus) {
          throw new Error('Campus not found or does not belong to this school.');
        }
      }

      const existingCode = await prisma.transportRoute.findFirst({
        where: { schoolId, routeCode },
      });
      if (existingCode) {
        throw new Error(`Route code "${routeCode}" already exists in this school.`);
      }

      return prisma.transportRoute.create({
        data: {
          schoolId,
          campusId: campusId || null,
          routeCode,
          routeName,
          description: description || null,
          status,
        },
      });
    });

    return NextResponse.json({ success: true, data: route }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.includes('already exists')
      ? 409
      : error.message?.includes('Unauthorized')
      ? 403
      : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
