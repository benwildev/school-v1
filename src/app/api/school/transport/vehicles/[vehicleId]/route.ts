import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { UpdateVehicleSchema } from '@/lib/validation/transport';
import { checkVehicleDocuments, isValidVehicleStatusTransition } from '@/lib/transport/vehicle-engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ vehicleId: string }> }
) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'VEHICLES_VIEW' });
    const { vehicleId } = await params;

    const vehicle = await withTenantContext(schoolId, async (tx) => {
      return tx.vehicle.findFirst({
        where: { id: vehicleId, schoolId },
        include: {
          campus: { select: { id: true, nameEn: true, nameBn: true } },
          driverAssignments: {
            where: { isActive: true },
            include: {
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
            },
          },
          maintenanceLogs: {
            orderBy: { serviceDate: 'desc' },
            take: 5,
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

    if (!vehicle) {
      return NextResponse.json({ success: false, error: 'Vehicle not found' }, { status: 404 });
    }

    const documentCompliance = checkVehicleDocuments(vehicle);

    return NextResponse.json({
      success: true,
      data: {
        ...vehicle,
        documentCompliance,
      },
    });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ vehicleId: string }> }
) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'VEHICLES_UPDATE' });
    const { vehicleId } = await params;

    const body = await request.json();
    const parsed = UpdateVehicleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await withTenantContext(schoolId, async (tx) => {
      const existing = await tx.vehicle.findFirst({
        where: { id: vehicleId, schoolId },
      });
      if (!existing) {
        throw new Error('Vehicle not found in this school.');
      }

      if (parsed.data.status) {
        const transition = isValidVehicleStatusTransition(existing.status, parsed.data.status);
        if (!transition.valid) {
          throw new Error(transition.reason || 'Invalid status transition.');
        }
      }

      const updateData: any = { ...parsed.data };
      if (parsed.data.insuranceExpiry !== undefined) {
        updateData.insuranceExpiry = parsed.data.insuranceExpiry ? new Date(parsed.data.insuranceExpiry) : null;
      }
      if (parsed.data.fitnessExpiry !== undefined) {
        updateData.fitnessExpiry = parsed.data.fitnessExpiry ? new Date(parsed.data.fitnessExpiry) : null;
      }
      if (parsed.data.registrationExpiry !== undefined) {
        updateData.registrationExpiry = parsed.data.registrationExpiry ? new Date(parsed.data.registrationExpiry) : null;
      }

      return tx.vehicle.update({
        where: { id: vehicleId },
        data: updateData,
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
  { params }: { params: Promise<{ vehicleId: string }> }
) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'VEHICLES_RETIRE' });
    const { vehicleId } = await params;

    const result = await withTenantContext(schoolId, async (tx) => {
      const vehicle = await tx.vehicle.findFirst({
        where: { id: vehicleId, schoolId },
        include: {
          _count: {
            select: { trips: true, studentAssignments: true },
          },
        },
      });

      if (!vehicle) {
        throw new Error('Vehicle not found.');
      }

      // If vehicle has trip history or assignments, preserve historical integrity by retiring
      if (vehicle._count.trips > 0 || vehicle._count.studentAssignments > 0) {
        await tx.vehicle.update({
          where: { id: vehicleId },
          data: { status: 'RETIRED' },
        });
        return {
          decommissioned: true,
          status: 'RETIRED',
          message: 'Vehicle has historical trips or student assignments. Deactivated and marked RETIRED to preserve audit history.',
        };
      }

      // If purely unreferenced test record, safe to remove
      await tx.vehicle.delete({
        where: { id: vehicleId },
      });

      return {
        deleted: true,
        message: 'Vehicle removed successfully.',
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
