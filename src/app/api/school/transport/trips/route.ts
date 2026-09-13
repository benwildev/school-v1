import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { CreateTripSchema } from '@/lib/validation/transport';
import { handleApiError } from '@/lib/api/handle-api-error';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'TRIP_VIEW' });

    const { searchParams } = new URL(request.url);
    const tripDate = searchParams.get('tripDate');
    const routeId = searchParams.get('routeId');
    const vehicleId = searchParams.get('vehicleId');
    const status = searchParams.get('status');
    const tripType = searchParams.get('tripType');

    const trips = await withTenantContext(schoolId, async (tx) => {
      const where: any = { schoolId };
      if (tripDate) {
        const start = new Date(tripDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(tripDate);
        end.setHours(23, 59, 59, 999);
        where.tripDate = { gte: start, lte: end };
      }
      if (routeId) where.routeId = routeId;
      if (vehicleId) where.vehicleId = vehicleId;
      if (status) where.status = status;
      if (tripType) where.tripType = tripType;

      return tx.transportTrip.findMany({
        where,
        include: {
          route: { select: { id: true, routeCode: true, routeName: true } },
          vehicle: { select: { id: true, vehicleCode: true, registrationNumber: true, seatingCapacity: true } },
          driver: { select: { id: true, employeeCode: true, fullNameEn: true, fullNameBn: true, phone: true } },
          conductor: { select: { id: true, employeeCode: true, fullNameEn: true, fullNameBn: true, phone: true } },
          _count: {
            select: { boardingEvents: true },
          },
        },
        orderBy: [{ tripDate: 'desc' }, { scheduledStartTime: 'asc' }],
      });
    });

    return NextResponse.json({ success: true, data: trips });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'TRIP_CREATE' });

    const body = await request.json();
    const parsed = CreateTripSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      routeId,
      vehicleId,
      driverEmployeeId,
      conductorEmployeeId,
      tripDate,
      tripType,
      scheduledStartTime,
      scheduledEndTime,
      notes,
    } = parsed.data;

    const trip = await withTenantContext(schoolId, async (tx) => {
      // 1. Verify Route
      const route = await tx.transportRoute.findFirst({
        where: { id: routeId, schoolId },
      });
      if (!route) {
        throw new Error('Transport route not found in this institution.');
      }

      // 2. Verify Vehicle
      const vehicle = await tx.vehicle.findFirst({
        where: { id: vehicleId, schoolId },
      });
      if (!vehicle) {
        throw new Error('Vehicle not found in this institution.');
      }

      // 3. Verify Driver Employee
      const driver = await tx.employee.findFirst({
        where: { id: driverEmployeeId, schoolId, status: 'ACTIVE' },
      });
      if (!driver) {
        throw new Error('Driver employee not found or inactive in this institution.');
      }

      // 4. Verify Conductor Employee if provided
      if (conductorEmployeeId) {
        const conductor = await tx.employee.findFirst({
          where: { id: conductorEmployeeId, schoolId, status: 'ACTIVE' },
        });
        if (!conductor) {
          throw new Error('Conductor employee not found or inactive in this institution.');
        }
      }

      return tx.transportTrip.create({
        data: {
          schoolId,
          routeId,
          vehicleId,
          driverEmployeeId,
          conductorEmployeeId: conductorEmployeeId || null,
          tripDate: new Date(tripDate),
          tripType,
          status: 'PLANNED',
          scheduledStartTime: scheduledStartTime || null,
          scheduledEndTime: scheduledEndTime || null,
          notes: notes || null,
        },
        include: {
          route: { select: { id: true, routeCode: true, routeName: true } },
          vehicle: { select: { id: true, vehicleCode: true, registrationNumber: true } },
          driver: { select: { id: true, employeeCode: true, fullNameEn: true } },
          conductor: { select: { id: true, employeeCode: true, fullNameEn: true } },
        },
      });
    });

    return NextResponse.json({ success: true, data: trip }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    return handleApiError(error);
  }
}
