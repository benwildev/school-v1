import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/authorization/engine';
import { resolveActiveDriverForDate } from '@/lib/transport/assignment-engine';

/**
 * GET /api/student/transport
 * Student self-service endpoint to view own transport assignment, vehicle, route, stops, and boarding history.
 * Explicitly guards against studentId spoofing by resolving exclusively from the authenticated session.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth(request);

    // Resolve student identity exclusively from authenticated user
    const studentUser = await prisma.studentUser.findUnique({
      where: { userId: context.userId },
      include: {
        student: {
          select: {
            id: true,
            schoolId: true,
            studentCode: true,
            firstNameEn: true,
            lastNameEn: true,
            fullNameEn: true,
            fullNameBn: true,
          },
        },
      },
    });

    if (!studentUser || !studentUser.student) {
      return NextResponse.json(
        { success: false, error: 'No student profile linked to this account.' },
        { status: 403 }
      );
    }

    const { id: studentId, schoolId } = studentUser.student;

    // Fetch active transport assignment
    const assignment = await prisma.studentTransportAssignment.findFirst({
      where: {
        schoolId,
        studentId,
        status: 'ACTIVE',
      },
      include: {
        route: {
          select: {
            id: true,
            routeCode: true,
            routeName: true,
            stops: {
              where: { status: 'ACTIVE' },
              orderBy: { sequenceNumber: 'asc' },
              select: {
                id: true,
                stopName: true,
                sequenceNumber: true,
                pickupTime: true,
                dropoffTime: true,
              },
            },
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
            status: true,
          },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json({
        success: true,
        hasTransport: false,
        message: 'No active transport service assigned.',
      });
    }

    // Fetch boarding events
    const boardingEvents = await prisma.transportBoardingEvent.findMany({
      where: {
        studentId,
        schoolId,
      },
      take: 20,
      orderBy: { eventTimestamp: 'desc' },
      include: {
        stop: { select: { stopName: true } },
        trip: {
          select: {
            tripType: true,
            tripDate: true,
            status: true,
            actualStartTime: true,
            actualEndTime: true,
          },
        },
      },
    });

    // Driver contact info (safe, non-sensitive)
    let driverInfo = null;
    if (assignment.vehicleId) {
      const activeDriver = await resolveActiveDriverForDate(
        assignment.vehicleId,
        schoolId,
        new Date()
      );
      if (activeDriver) {
        driverInfo = {
          driverName: activeDriver.driver.fullNameEn,
          driverNameBn: activeDriver.driver.fullNameBn,
          driverPhone: activeDriver.driver.phone,
          conductorName: activeDriver.conductor?.fullNameEn || null,
          conductorPhone: activeDriver.conductor?.phone || null,
        };
      }
    }

    return NextResponse.json({
      success: true,
      hasTransport: true,
      assignment: { ...assignment, boardingEvents },
      driverInfo,
    });
  } catch (error: any) {
    const status = error.message?.includes('UNAUTHORIZED') ? 401 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
