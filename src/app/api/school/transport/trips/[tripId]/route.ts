import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { UpdateTripStatusSchema } from '@/lib/validation/transport';
import { isValidTripStatusTransition } from '@/lib/transport/trip-engine';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await context.params;
    const { schoolId } = await requirePermission(request, { permission: 'TRIP_VIEW' });

    const trip = await withTenantContext(schoolId, async (tx) => {
      return tx.transportTrip.findFirst({
        where: { id: tripId, schoolId },
        include: {
          route: {
            include: {
              stops: { orderBy: { sequenceNumber: 'asc' } },
            },
          },
          vehicle: true,
          driver: {
            select: {
              id: true,
              employeeCode: true,
              fullNameEn: true,
              fullNameBn: true,
              phone: true,
            },
          },
          conductor: {
            select: {
              id: true,
              employeeCode: true,
              fullNameEn: true,
              fullNameBn: true,
              phone: true,
            },
          },
          boardingEvents: {
            include: {
              student: {
                select: {
                  id: true,
                  studentCode: true,
                  firstNameEn: true,
                  lastNameEn: true,
                  fullNameEn: true,
                  fullNameBn: true,
                },
              },
              stop: {
                select: {
                  id: true,
                  stopName: true,
                  sequenceNumber: true,
                },
              },
              recordedBy: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
            },
            orderBy: { eventTimestamp: 'asc' },
          },
        },
      });
    });

    if (!trip) {
      return NextResponse.json({ success: false, error: 'Trip not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: trip });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await context.params;
    const { schoolId } = await requirePermission(request, { permission: 'TRIP_UPDATE' });

    const body = await request.json();
    const parsed = UpdateTripStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { status: nextStatus, cancellationReason } = parsed.data;

    const updatedTrip = await withTenantContext(schoolId, async (tx) => {
      const trip = await tx.transportTrip.findFirst({
        where: { id: tripId, schoolId },
      });

      if (!trip) {
        throw new Error('Trip not found');
      }

      // Check transition validity and historical immutability
      const check = isValidTripStatusTransition(trip.status, nextStatus);
      if (!check.valid) {
        throw new Error(check.reason || `Invalid status transition from ${trip.status} to ${nextStatus}`);
      }

      const updateData: any = {
        status: nextStatus,
      };

      if (nextStatus === 'IN_PROGRESS' && !trip.actualStartTime) {
        const now = new Date();
        updateData.actualStartTime = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
      }

      if (nextStatus === 'COMPLETED' && !trip.actualEndTime) {
        const now = new Date();
        updateData.actualEndTime = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
      }

      if (nextStatus === 'CANCELLED' && cancellationReason) {
        updateData.notes = trip.notes
          ? `${trip.notes}\n[Cancelled]: ${cancellationReason}`
          : `[Cancelled]: ${cancellationReason}`;
      }

      return tx.transportTrip.update({
        where: { id: tripId },
        data: updateData,
        include: {
          route: { select: { routeCode: true, routeName: true } },
          vehicle: { select: { vehicleCode: true } },
        },
      });
    });

    return NextResponse.json({ success: true, data: updatedTrip });
  } catch (error: any) {
    const status = error.message?.includes('not found')
      ? 404
      : error.message?.includes('frozen') || error.message?.includes('cannot be altered')
      ? 409
      : error.message?.includes('Unauthorized')
      ? 403
      : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await context.params;
    const { schoolId } = await requirePermission(request, { permission: 'TRIP_CANCEL' });

    const result = await withTenantContext(schoolId, async (tx) => {
      const trip = await tx.transportTrip.findFirst({
        where: { id: tripId, schoolId },
        include: {
          _count: { select: { boardingEvents: true } },
        },
      });

      if (!trip) {
        throw new Error('Trip not found');
      }

      if (trip.status === 'COMPLETED') {
        throw new Error('Completed trips cannot be deleted due to historical audit requirements.');
      }

      if (trip._count.boardingEvents > 0) {
        // Soft cancel instead of deleting to preserve boarding logs
        return tx.transportTrip.update({
          where: { id: tripId },
          data: { status: 'CANCELLED' },
        });
      }

      return tx.transportTrip.delete({
        where: { id: tripId },
      });
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    const status = error.message?.includes('not found')
      ? 404
      : error.message?.includes('historical')
      ? 409
      : error.message?.includes('Unauthorized')
      ? 403
      : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
