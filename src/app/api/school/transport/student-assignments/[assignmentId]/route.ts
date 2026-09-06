import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { UpdateStudentTransportSchema } from '@/lib/validation/transport';
import { checkVehicleCapacity } from '@/lib/transport/assignment-engine';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { assignmentId } = await context.params;
    const { schoolId } = await requirePermission(request, { permission: 'TRANSPORT_ASSIGNMENT_VIEW' });

    const assignmentData = await withTenantContext(schoolId, async (tx) => {
      const assignment = await tx.studentTransportAssignment.findFirst({
        where: { id: assignmentId, schoolId },
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
              stops: { orderBy: { sequenceNumber: 'asc' } },
            },
          },
          pickupStop: true,
          dropoffStop: true,
          vehicle: true,
          feeStructure: true,
        },
      });

      if (!assignment) return null;

      const boardingEvents = await tx.transportBoardingEvent.findMany({
        where: { studentId: assignment.studentId, schoolId },
        take: 20,
        orderBy: { eventTimestamp: 'desc' },
        include: {
          trip: {
            select: {
              id: true,
              tripDate: true,
              tripType: true,
              status: true,
            },
          },
        },
      });

      return { ...assignment, boardingEvents };
    });

    const assignment = assignmentData;

    if (!assignment) {
      return NextResponse.json(
        { success: false, error: 'Student transport assignment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: assignment });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { assignmentId } = await context.params;
    const { schoolId } = await requirePermission(request, { permission: 'TRANSPORT_ASSIGNMENT_UPDATE' });

    const body = await request.json();
    const parsed = UpdateStudentTransportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await withTenantContext(schoolId, async (tx) => {
      const existing = await tx.studentTransportAssignment.findFirst({
        where: { id: assignmentId, schoolId },
      });
      if (!existing) {
        throw new Error('Assignment not found');
      }

      const updateData: any = {};

      if (parsed.data.status) {
        updateData.status = parsed.data.status;
      }

      if (parsed.data.effectiveTo !== undefined) {
        updateData.effectiveTo = parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null;
      }

      if (parsed.data.notes !== undefined) {
        updateData.notes = parsed.data.notes;
      }

      // Check vehicle capacity if vehicle changed to a new vehicle
      if (parsed.data.vehicleId !== undefined && parsed.data.vehicleId !== existing.vehicleId) {
        if (parsed.data.vehicleId) {
          const cap = await checkVehicleCapacity(parsed.data.vehicleId, schoolId);
          if (!cap.hasCapacity) {
            throw new Error(cap.error || 'Selected vehicle has reached maximum capacity');
          }
          updateData.vehicleId = parsed.data.vehicleId;
        } else {
          updateData.vehicleId = null;
        }
      }

      // If stops are being updated, verify they belong to existing.routeId
      if (parsed.data.pickupStopId) {
        const stop = await tx.routeStop.findFirst({
          where: { id: parsed.data.pickupStopId, routeId: existing.routeId, schoolId },
        });
        if (!stop) throw new Error('Pickup stop is invalid for this route');
        updateData.pickupStopId = parsed.data.pickupStopId;
      }

      if (parsed.data.dropoffStopId) {
        const stop = await tx.routeStop.findFirst({
          where: { id: parsed.data.dropoffStopId, routeId: existing.routeId, schoolId },
        });
        if (!stop) throw new Error('Dropoff stop is invalid for this route');
        updateData.dropoffStopId = parsed.data.dropoffStopId;
      }

      return tx.studentTransportAssignment.update({
        where: { id: assignmentId },
        data: updateData,
        include: {
          student: true,
          route: true,
          vehicle: true,
        },
      });
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error.message?.includes('not found')
      ? 404
      : error.message?.includes('capacity')
      ? 409
      : error.message?.includes('Unauthorized')
      ? 403
      : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { assignmentId } = await context.params;
    const { schoolId } = await requirePermission(request, { permission: 'TRANSPORT_ASSIGNMENT_REMOVE' });

    const result = await withTenantContext(schoolId, async (tx) => {
      const existing = await tx.studentTransportAssignment.findFirst({
        where: { id: assignmentId, schoolId },
      });

      if (!existing) {
        throw new Error('Assignment not found');
      }

      // If there are recorded boarding events, do NOT hard delete. Transition status to CANCELLED
      const boardingEventsCount = await tx.transportBoardingEvent.count({
        where: {
          studentId: existing.studentId,
          enrollmentId: existing.enrollmentId,
          schoolId,
        },
      });

      if (boardingEventsCount > 0) {
        return tx.studentTransportAssignment.update({
          where: { id: assignmentId },
          data: {
            status: 'CANCELLED',
            effectiveTo: new Date(),
          },
        });
      }

      return tx.studentTransportAssignment.delete({
        where: { id: assignmentId },
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Transport assignment removed or cancelled successfully',
      data: result,
    });
  } catch (error: any) {
    const status = error.message?.includes('not found')
      ? 404
      : error.message?.includes('Unauthorized')
      ? 403
      : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
