import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { CreateRouteStopSchema } from '@/lib/validation/transport';
import { handleApiError } from '@/lib/api/handle-api-error';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ routeId: string }> }
) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'ROUTES_VIEW' });
    const { routeId } = await params;

    const stops = await withTenantContext(schoolId, async (tx) => {
      // Validate route belongs to school
      const route = await tx.transportRoute.findFirst({
        where: { id: routeId, schoolId },
      });
      if (!route) {
        throw new Error('Route not found in this school.');
      }

      return tx.routeStop.findMany({
        where: { routeId, schoolId },
        orderBy: { sequenceNumber: 'asc' },
      });
    });

    return NextResponse.json({ success: true, data: stops });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ routeId: string }> }
) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'ROUTES_UPDATE' });
    const { routeId } = await params;

    const body = await request.json();
    const parsed = CreateRouteStopSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      stopName,
      address,
      latitude,
      longitude,
      sequenceNumber,
      pickupTime,
      dropoffTime,
      fareAmount,
      status,
    } = parsed.data;

    const stop = await withTenantContext(schoolId, async (tx) => {
      const route = await tx.transportRoute.findFirst({
        where: { id: routeId, schoolId },
      });
      if (!route) {
        throw new Error('Route not found in this school.');
      }

      // Check unique sequence number within route
      const existingSeq = await tx.routeStop.findFirst({
        where: { routeId, sequenceNumber },
      });
      if (existingSeq) {
        throw new Error(`Stop sequence #${sequenceNumber} already exists in this route.`);
      }

      return tx.routeStop.create({
        data: {
          schoolId,
          routeId,
          stopName,
          address: address || null,
          latitude: latitude !== undefined && latitude !== null ? latitude : null,
          longitude: longitude !== undefined && longitude !== null ? longitude : null,
          sequenceNumber,
          pickupTime: pickupTime || null,
          dropoffTime: dropoffTime || null,
          fareAmount,
          status,
        },
      });
    });

    return NextResponse.json({ success: true, data: stop }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        return NextResponse.json({ success: false, error: error.message }, { status: 409 });
      }
      if (error.message.includes('not found')) {
        return NextResponse.json({ success: false, error: error.message }, { status: 404 });
      }
    }
    return handleApiError(error);
  }
}
