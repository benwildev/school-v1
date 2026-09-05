import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { AssignStudentTransportSchema } from '@/lib/validation/transport';
import { checkVehicleCapacity } from '@/lib/transport/assignment-engine';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'TRANSPORT_ASSIGNMENT_VIEW' });

    const { searchParams } = new URL(request.url);
    const routeId = searchParams.get('routeId');
    const vehicleId = searchParams.get('vehicleId');
    const status = searchParams.get('status');
    const enrollmentId = searchParams.get('enrollmentId');
    const studentId = searchParams.get('studentId');

    const assignments = await withTenantContext(schoolId, async () => {
      const where: any = { schoolId };
      if (routeId) where.routeId = routeId;
      if (vehicleId) where.vehicleId = vehicleId;
      if (status) where.status = status;
      if (enrollmentId) where.enrollmentId = enrollmentId;
      if (studentId) where.studentId = studentId;

      return prisma.studentTransportAssignment.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              studentCode: true,
              firstNameEn: true,
              lastNameEn: true,
              fullNameEn: true,
              fullNameBn: true,
              phone: true,
            },
          },
          enrollment: {
            select: {
              id: true,
              rollNo: true,
              academicSession: { select: { id: true, name: true } },
              class: { select: { id: true, nameEn: true, nameBn: true } },
              section: { select: { id: true, nameEn: true, nameBn: true } },
            },
          },
          route: {
            select: {
              id: true,
              routeCode: true,
              routeName: true,
            },
          },
          pickupStop: {
            select: {
              id: true,
              stopName: true,
              pickupTime: true,
              sequenceNumber: true,
            },
          },
          dropoffStop: {
            select: {
              id: true,
              stopName: true,
              dropoffTime: true,
              sequenceNumber: true,
            },
          },
          vehicle: {
            select: {
              id: true,
              vehicleCode: true,
              registrationNumber: true,
              seatingCapacity: true,
            },
          },
          feeStructure: {
            select: {
              id: true,
              amount: true,
              feeType: { select: { nameEn: true, nameBn: true } },
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
    const parsed = AssignStudentTransportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      enrollmentId,
      routeId,
      pickupStopId,
      dropoffStopId,
      vehicleId,
      feeStructureId,
      effectiveFrom,
      effectiveTo,
      notes,
    } = parsed.data;

    const assignment = await withTenantContext(schoolId, async () => {
      // 1. Verify Enrollment belongs to school & extract studentId
      const enrollment = await prisma.enrollment.findFirst({
        where: { id: enrollmentId, schoolId },
        select: { id: true, studentId: true, status: true },
      });
      if (!enrollment) {
        throw new Error('Student enrollment not found in this institution.');
      }

      // 2. Check for active existing assignment for this enrollment
      const existingActive = await prisma.studentTransportAssignment.findFirst({
        where: {
          schoolId,
          enrollmentId,
          status: 'ACTIVE',
        },
      });
      if (existingActive) {
        throw new Error('This student already has an active transport assignment for this enrollment. Deactivate or end it before creating a new one.');
      }

      // 3. Verify Route belongs to school
      const route = await prisma.transportRoute.findFirst({
        where: { id: routeId, schoolId },
      });
      if (!route) {
        throw new Error('Transport route not found in this institution.');
      }

      // 4. Verify Stops belong to Route and School
      const [pickupStop, dropoffStop] = await Promise.all([
        prisma.routeStop.findFirst({
          where: { id: pickupStopId, routeId, schoolId },
        }),
        prisma.routeStop.findFirst({
          where: { id: dropoffStopId, routeId, schoolId },
        }),
      ]);

      if (!pickupStop) {
        throw new Error('Pickup stop does not belong to the selected route.');
      }
      if (!dropoffStop) {
        throw new Error('Dropoff stop does not belong to the selected route.');
      }

      // 5. If vehicle specified, verify capacity under transaction / lock
      if (vehicleId) {
        const capacityCheck = await checkVehicleCapacity(vehicleId, schoolId);
        if (!capacityCheck.hasCapacity) {
          throw new Error(capacityCheck.error || 'Vehicle has reached full capacity.');
        }
      }

      // 6. If feeStructureId specified, verify it belongs to school
      if (feeStructureId) {
        const feeStruct = await prisma.feeStructure.findFirst({
          where: { id: feeStructureId, schoolId },
        });
        if (!feeStruct) {
          throw new Error('Fee structure not found in this institution.');
        }
      }

      // 7. Create assignment record
      return prisma.studentTransportAssignment.create({
        data: {
          schoolId,
          studentId: enrollment.studentId,
          enrollmentId,
          routeId,
          pickupStopId,
          dropoffStopId,
          vehicleId: vehicleId || null,
          feeStructureId: feeStructureId || null,
          effectiveFrom: new Date(effectiveFrom),
          effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
          status: 'ACTIVE',
          notes: notes || null,
        },
        include: {
          student: {
            select: {
              id: true,
              studentCode: true,
              firstNameEn: true,
              lastNameEn: true,
            },
          },
          route: { select: { id: true, routeCode: true, routeName: true } },
          pickupStop: { select: { id: true, stopName: true } },
          dropoffStop: { select: { id: true, stopName: true } },
          vehicle: { select: { id: true, vehicleCode: true, seatingCapacity: true } },
        },
      });
    });

    return NextResponse.json({ success: true, data: assignment }, { status: 201 });
  } catch (error: any) {
    const isConflict = error.message?.includes('already has an active') || error.message?.includes('capacity');
    const status = error.message?.includes('Unauthorized')
      ? 403
      : isConflict
      ? 409
      : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
