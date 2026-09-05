import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { AssignDriverSchema } from '@/lib/validation/transport';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'TRANSPORT_ASSIGNMENT_VIEW' });

    const { searchParams } = new URL(request.url);
    const vehicleId = searchParams.get('vehicleId');
    const driverEmployeeId = searchParams.get('driverEmployeeId');
    const activeOnly = searchParams.get('active') !== 'false';

    const assignments = await withTenantContext(schoolId, async () => {
      const where: any = { schoolId };
      if (vehicleId) where.vehicleId = vehicleId;
      if (driverEmployeeId) where.driverEmployeeId = driverEmployeeId;
      if (activeOnly) where.isActive = true;

      return prisma.vehicleDriverAssignment.findMany({
        where,
        include: {
          vehicle: {
            select: {
              id: true,
              vehicleCode: true,
              registrationNumber: true,
              seatingCapacity: true,
              status: true,
            },
          },
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
          route: {
            select: {
              id: true,
              routeCode: true,
              routeName: true,
            },
          },
        },
        orderBy: { effectiveFrom: 'desc' },
      });
    });

    return NextResponse.json({ success: true, data: assignments });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'TRANSPORT_ASSIGNMENT_CREATE' });

    const body = await request.json();
    const parsed = AssignDriverSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      vehicleId,
      driverEmployeeId,
      conductorEmployeeId,
      routeId,
      effectiveFrom,
      effectiveTo,
      notes,
    } = parsed.data;

    const assignment = await withTenantContext(schoolId, async () => {
      // 1. Validate vehicle
      const vehicle = await prisma.vehicle.findFirst({
        where: { id: vehicleId, schoolId },
      });
      if (!vehicle) {
        throw new Error('Vehicle not found or does not belong to this school.');
      }

      // 2. Validate driver (must reuse Phase 7 Employee)
      const driver = await prisma.employee.findFirst({
        where: { id: driverEmployeeId, schoolId },
      });
      if (!driver) {
        throw new Error('Driver employee not found or does not belong to this school.');
      }
      if (driver.status !== 'ACTIVE') {
        throw new Error(`Driver employee is currently ${driver.status} and cannot be assigned.`);
      }

      // 3. Validate conductor if provided
      if (conductorEmployeeId) {
        const conductor = await prisma.employee.findFirst({
          where: { id: conductorEmployeeId, schoolId },
        });
        if (!conductor) {
          throw new Error('Conductor employee not found or does not belong to this school.');
        }
        if (conductor.status !== 'ACTIVE') {
          throw new Error(`Conductor employee is currently ${conductor.status} and cannot be assigned.`);
        }
      }

      // 4. Validate route if provided
      if (routeId) {
        const route = await prisma.transportRoute.findFirst({
          where: { id: routeId, schoolId },
        });
        if (!route) {
          throw new Error('Route not found or does not belong to this school.');
        }
      }

      // 5. Deactivate previous active assignment for this vehicle if effectiveFrom matches or supersedes
      await prisma.vehicleDriverAssignment.updateMany({
        where: {
          schoolId,
          vehicleId,
          isActive: true,
          effectiveTo: null,
        },
        data: {
          isActive: false,
          effectiveTo: new Date(effectiveFrom),
        },
      });

      // 6. Create effective-dated assignment
      return prisma.vehicleDriverAssignment.create({
        data: {
          schoolId,
          vehicleId,
          driverEmployeeId,
          conductorEmployeeId: conductorEmployeeId || null,
          routeId: routeId || null,
          effectiveFrom: new Date(effectiveFrom),
          effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
          isActive: true,
          notes: notes || null,
        },
        include: {
          driver: { select: { id: true, fullNameEn: true, employeeCode: true } },
          vehicle: { select: { id: true, vehicleCode: true, registrationNumber: true } },
        },
      });
    });

    return NextResponse.json({ success: true, data: assignment }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.includes('not found')
      ? 404
      : error.message?.includes('Unauthorized')
      ? 403
      : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
