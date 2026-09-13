import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { CreateMaintenanceLogSchema } from '@/lib/validation/transport';
import { handleApiError } from '@/lib/api/handle-api-error';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'VEHICLES_VIEW' });

    const { searchParams } = new URL(request.url);
    const vehicleId = searchParams.get('vehicleId');

    const logs = await withTenantContext(schoolId, async (tx) => {
      const where: any = { schoolId };
      if (vehicleId) where.vehicleId = vehicleId;

      return tx.vehicleMaintenanceLog.findMany({
        where,
        include: {
          vehicle: {
            select: {
              id: true,
              vehicleCode: true,
              registrationNumber: true,
              makeModel: true,
              status: true,
            },
          },
        },
        orderBy: { serviceDate: 'desc' },
      });
    });

    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'VEHICLES_UPDATE' });

    const body = await request.json();
    const parsed = CreateMaintenanceLogSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      vehicleId,
      maintenanceType,
      serviceDate,
      odometerReading,
      cost,
      vendorName,
      invoiceRef,
      nextServiceDate,
      notes,
    } = parsed.data;

    const log = await withTenantContext(schoolId, async (tx) => {
      // 1. Verify vehicle belongs to school
      const vehicle = await tx.vehicle.findFirst({
        where: { id: vehicleId, schoolId },
      });
      if (!vehicle) {
        throw new Error('Vehicle not found in this institution.');
      }

      // 2. Create maintenance record
      const maintenanceRecord = await tx.vehicleMaintenanceLog.create({
        data: {
          schoolId,
          vehicleId,
          maintenanceType,
          serviceDate: new Date(serviceDate),
          odometerReading: odometerReading || null,
          cost,
          vendorName: vendorName || null,
          invoiceRef: invoiceRef || null,
          nextServiceDate: nextServiceDate ? new Date(nextServiceDate) : null,
          notes: notes || null,
        },
        include: {
          vehicle: { select: { vehicleCode: true, registrationNumber: true } },
        },
      });

      return maintenanceRecord;
    });

    return NextResponse.json({ success: true, data: log }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    return handleApiError(error);
  }
}
