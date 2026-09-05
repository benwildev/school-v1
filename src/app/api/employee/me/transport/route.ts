import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/authorization/engine';

/**
 * GET /api/employee/me/transport
 * Driver / Conductor portal endpoint to view own assigned vehicle, routes, stops, and daily trips.
 * Strictly scopes data to the authenticated employee.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth(request);

    // Resolve employee linked to the authenticated user
    const employee = await prisma.employee.findFirst({
      where: {
        userId: context.userId,
        ...(context.activeSchoolId ? { schoolId: context.activeSchoolId } : {}),
      },
      select: {
        id: true,
        schoolId: true,
        employeeCode: true,
        fullNameEn: true,
        fullNameBn: true,
        phone: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { success: false, error: 'No employee record linked to current user session.' },
        { status: 404 }
      );
    }

    const { id: employeeId, schoolId } = employee;

    // Active vehicle & route assignments for this driver / conductor
    const driverAssignments = await prisma.vehicleDriverAssignment.findMany({
      where: {
        schoolId,
        isActive: true,
        OR: [
          { driverEmployeeId: employeeId },
          { conductorEmployeeId: employeeId },
        ],
      },
      include: {
        vehicle: {
          select: {
            id: true,
            vehicleCode: true,
            registrationNumber: true,
            vehicleType: true,
            seatingCapacity: true,
            status: true,
          },
        },
        route: {
          include: {
            stops: {
              where: { status: 'ACTIVE' },
              orderBy: { sequenceNumber: 'asc' },
            },
          },
        },
      },
    });

    // Today's trips assigned to this driver or conductor
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const todayTrips = await prisma.transportTrip.findMany({
      where: {
        schoolId,
        tripDate: { gte: startOfDay, lte: endOfDay },
        OR: [
          { driverEmployeeId: employeeId },
          { conductorEmployeeId: employeeId },
        ],
      },
      include: {
        route: {
          include: {
            stops: {
              where: { status: 'ACTIVE' },
              orderBy: { sequenceNumber: 'asc' },
            },
          },
        },
        vehicle: true,
        boardingEvents: {
          include: {
            student: { select: { firstNameEn: true, lastNameEn: true, studentCode: true } },
            stop: { select: { stopName: true } },
          },
        },
      },
      orderBy: { scheduledStartTime: 'asc' },
    });

    // Active students assigned to this driver's assigned vehicles
    const assignedVehicleIds = driverAssignments.map((da) => da.vehicleId);
    const assignedPassengers = await prisma.studentTransportAssignment.findMany({
      where: {
        schoolId,
        status: 'ACTIVE',
        vehicleId: { in: assignedVehicleIds },
      },
      include: {
        student: {
          select: {
            id: true,
            studentCode: true,
            firstNameEn: true,
            lastNameEn: true,
            phone: true,
          },
        },
        pickupStop: { select: { id: true, stopName: true, pickupTime: true } },
        dropoffStop: { select: { id: true, stopName: true, dropoffTime: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        driverAssignments,
        todayTrips,
        assignedPassengers,
      },
    });
  } catch (error: any) {
    const status = error.message?.includes('UNAUTHORIZED') ? 401 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
