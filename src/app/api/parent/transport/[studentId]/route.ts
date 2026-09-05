import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSchool } from '@/lib/authorization/engine';
import { prisma } from '@/lib/db';
import { resolveActiveDriverForDate } from '@/lib/transport/assignment-engine';

/**
 * GET /api/parent/transport/[studentId]
 * Returns transport status for a single linked child.
 * Strictly prevents horizontal IDOR across unrelated students.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ studentId: string }> }
) {
  try {
    const { studentId } = await context.params;
    const { context: authCtx, schoolId } = await requireActiveSchool(request);

    // Verify authorized guardian relationship
    const relationship = await prisma.studentGuardian.findFirst({
      where: {
        studentId,
        schoolId,
        guardian: {
          userId: authCtx.userId,
          schoolId,
        },
      },
    });

    if (!relationship) {
      return NextResponse.json(
        { success: false, error: 'এই শিক্ষার্থীর পরিবহন তথ্য দেখার অনুমতি আপনার নেই।' },
        { status: 403 }
      );
    }

    // Fetch active transport assignment for this student
    const assignment = await prisma.studentTransportAssignment.findFirst({
      where: {
        schoolId,
        studentId,
        status: 'ACTIVE',
      },
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
        pickupStop: true,
        dropoffStop: true,
        vehicle: {
          select: {
            id: true,
            vehicleCode: true,
            registrationNumber: true,
            status: true,
          },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json({
        success: true,
        hasTransport: false,
        message: 'শিক্ষার্থীটির কোনো সক্রিয় পরিবহন সেবা বরাদ্দ নেই।',
      });
    }

    const boardingEvents = await prisma.transportBoardingEvent.findMany({
      where: { studentId, schoolId },
      take: 15,
      orderBy: { eventTimestamp: 'desc' },
      include: {
        stop: { select: { stopName: true } },
        trip: {
          select: {
            id: true,
            tripType: true,
            tripDate: true,
            status: true,
            actualStartTime: true,
            actualEndTime: true,
          },
        },
      },
    });

    // Resolve active driver for vehicle without exposing private details (NID/salary)
    let driverInfo = null;
    if (assignment.vehicleId) {
      const activeDriverAssignment = await resolveActiveDriverForDate(
        assignment.vehicleId,
        schoolId,
        new Date()
      );
      if (activeDriverAssignment) {
        driverInfo = {
          driverName: activeDriverAssignment.driver.fullNameEn,
          driverNameBn: activeDriverAssignment.driver.fullNameBn,
          driverPhone: activeDriverAssignment.driver.phone,
          conductorName: activeDriverAssignment.conductor?.fullNameEn || null,
          conductorPhone: activeDriverAssignment.conductor?.phone || null,
        };
      }
    }

    // Today's trips for the vehicle or route
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const todayTrips = await prisma.transportTrip.findMany({
      where: {
        schoolId,
        routeId: assignment.routeId,
        tripDate: { gte: startOfDay, lte: endOfDay },
      },
      select: {
        id: true,
        tripType: true,
        status: true,
        scheduledStartTime: true,
        scheduledEndTime: true,
        actualStartTime: true,
        actualEndTime: true,
      },
    });

    return NextResponse.json({
      success: true,
      hasTransport: true,
      assignment: { ...assignment, boardingEvents },
      driverInfo,
      todayTrips,
    });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
