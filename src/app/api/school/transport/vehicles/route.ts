import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { CreateVehicleSchema } from '@/lib/validation/transport';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'VEHICLES_VIEW' });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const campusId = searchParams.get('campusId');

    const vehicles = await withTenantContext(schoolId, async (tx) => {
      const where: any = { schoolId };
      if (status) where.status = status;
      if (campusId) where.campusId = campusId;

      return tx.vehicle.findMany({
        where,
        include: {
          campus: { select: { id: true, nameEn: true, nameBn: true } },
          _count: {
            select: {
              studentAssignments: { where: { status: 'ACTIVE' } },
              trips: true,
            },
          },
        },
        orderBy: { vehicleCode: 'asc' },
      });
    });

    return NextResponse.json({ success: true, data: vehicles });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'VEHICLES_CREATE' });

    const body = await request.json();
    const parsed = CreateVehicleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      campusId,
      vehicleCode,
      registrationNumber,
      vehicleType,
      makeModel,
      year,
      seatingCapacity,
      status,
      insuranceExpiry,
      fitnessExpiry,
      registrationExpiry,
      notes,
    } = parsed.data;

    const vehicle = await withTenantContext(schoolId, async (tx) => {
      // Validate campus if provided
      if (campusId) {
        const campus = await tx.campus.findFirst({
          where: { id: campusId, schoolId },
        });
        if (!campus) {
          throw new Error('Campus not found or does not belong to this school.');
        }
      }

      // Check unique registrationNumber within school
      const existingReg = await tx.vehicle.findFirst({
        where: { schoolId, registrationNumber },
      });
      if (existingReg) {
        throw new Error(`Registration number "${registrationNumber}" already exists in this school.`);
      }

      // Check unique vehicleCode within school
      const existingCode = await tx.vehicle.findFirst({
        where: { schoolId, vehicleCode },
      });
      if (existingCode) {
        throw new Error(`Vehicle code "${vehicleCode}" already exists in this school.`);
      }

      return tx.vehicle.create({
        data: {
          schoolId,
          campusId: campusId || null,
          vehicleCode,
          registrationNumber,
          vehicleType,
          makeModel: makeModel || null,
          year: year || null,
          seatingCapacity,
          status,
          insuranceExpiry: insuranceExpiry ? new Date(insuranceExpiry) : null,
          fitnessExpiry: fitnessExpiry ? new Date(fitnessExpiry) : null,
          registrationExpiry: registrationExpiry ? new Date(registrationExpiry) : null,
          notes: notes || null,
        },
      });
    });

    return NextResponse.json({ success: true, data: vehicle }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.includes('already exists')
      ? 409
      : error.message?.includes('Unauthorized')
      ? 403
      : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
