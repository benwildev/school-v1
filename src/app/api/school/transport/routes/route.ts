import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { CreateRouteSchema } from '@/lib/validation/transport';
import { handleApiError } from '@/lib/api/handle-api-error';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'ROUTES_VIEW' });

    const { searchParams } = new URL(request.url);
    const campusId = searchParams.get('campusId');
    const status = searchParams.get('status');

    const routes = await withTenantContext(schoolId, async (tx) => {
      const where: any = { schoolId };
      if (campusId) where.campusId = campusId;
      if (status) where.status = status;

      return tx.transportRoute.findMany({
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
  } catch (error) {
    return handleApiError(error);
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

    const route = await withTenantContext(schoolId, async (tx) => {
      if (campusId) {
        const campus = await tx.campus.findFirst({
          where: { id: campusId, schoolId },
        });
        if (!campus) {
          throw new Error('Campus not found or does not belong to this school.');
        }
      }

      const existingCode = await tx.transportRoute.findFirst({
        where: { schoolId, routeCode },
      });
      if (existingCode) {
        throw new Error(`Route code "${routeCode}" already exists in this school.`);
      }

      return tx.transportRoute.create({
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
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }
    return handleApiError(error);
  }
}
