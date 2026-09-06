import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { UpdateRouteSchema } from '@/lib/validation/transport';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ routeId: string }> }
) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'ROUTES_VIEW' });
    const { routeId } = await params;

    const route = await withTenantContext(schoolId, async (tx) => {
      return tx.transportRoute.findFirst({
        where: { id: routeId, schoolId },
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
      });
    });

    if (!route) {
      return NextResponse.json({ success: false, error: 'Route not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: route });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ routeId: string }> }
) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'ROUTES_UPDATE' });
    const { routeId } = await params;

    const body = await request.json();
    const parsed = UpdateRouteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await withTenantContext(schoolId, async (tx) => {
      const existing = await tx.transportRoute.findFirst({
        where: { id: routeId, schoolId },
      });
      if (!existing) {
        throw new Error('Route not found in this school.');
      }

      return tx.transportRoute.update({
        where: { id: routeId },
        data: parsed.data,
      });
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error.message?.includes('not found')
      ? 404
      : error.message?.includes('Unauthorized')
      ? 403
      : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ routeId: string }> }
) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'ROUTES_UPDATE' });
    const { routeId } = await params;

    const result = await withTenantContext(schoolId, async (tx) => {
      const route = await tx.transportRoute.findFirst({
        where: { id: routeId, schoolId },
        include: {
          _count: {
            select: { trips: true, studentAssignments: true },
          },
        },
      });

      if (!route) {
        throw new Error('Route not found.');
      }

      if (route._count.trips > 0 || route._count.studentAssignments > 0) {
        await tx.transportRoute.update({
          where: { id: routeId },
          data: { status: 'ARCHIVED' },
        });
        return {
          archived: true,
          message: 'Route has historical trips or student assignments. Archived to preserve operational integrity.',
        };
      }

      await tx.transportRoute.delete({
        where: { id: routeId },
      });

      return {
        deleted: true,
        message: 'Route deleted successfully.',
      };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    const status = error.message?.includes('not found')
      ? 404
      : error.message?.includes('Unauthorized')
      ? 403
      : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
