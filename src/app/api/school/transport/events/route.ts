import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { RecordBoardingEventSchema, BatchBoardingEventsSchema } from '@/lib/validation/transport';
import { enqueueTransportAlertNotifications } from '@/lib/communication/event-triggers';
import { isTransportAlertStatus } from '@/lib/transport/attendance';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'TRANSPORT_ATTENDANCE_VIEW' });

    const { searchParams } = new URL(request.url);
    const tripId = searchParams.get('tripId');
    const studentId = searchParams.get('studentId');
    const boardingStatus = searchParams.get('boardingStatus');
    const date = searchParams.get('date');

    const events = await withTenantContext(schoolId, async (tx) => {
      const where: any = { schoolId };
      if (tripId) where.tripId = tripId;
      if (studentId) where.studentId = studentId;
      if (boardingStatus) where.boardingStatus = boardingStatus;
      if (date) {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        where.eventTimestamp = { gte: start, lte: end };
      }

      return tx.transportBoardingEvent.findMany({
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
          stop: {
            select: {
              id: true,
              stopName: true,
              sequenceNumber: true,
            },
          },
          trip: {
            select: {
              id: true,
              tripDate: true,
              tripType: true,
              status: true,
              route: { select: { routeCode: true, routeName: true } },
              vehicle: { select: { vehicleCode: true } },
            },
          },
          recordedBy: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
        orderBy: { eventTimestamp: 'desc' },
      });
    });

    return NextResponse.json({ success: true, data: events });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { schoolId, context } = await requirePermission(request, { permission: 'TRANSPORT_ATTENDANCE_CREATE' });

    const body = await request.json();

    // Check if single or batch
    const isBatch = Array.isArray(body.events);

    if (isBatch) {
      const parsed = BatchBoardingEventsSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: 'Validation failed', details: parsed.error.format() },
          { status: 400 }
        );
      }

      const { tripId, events } = parsed.data;

      const createdEvents = await withTenantContext(schoolId, async (tx) => {
        // Verify trip belongs to school
        const trip = await tx.transportTrip.findFirst({
          where: { id: tripId, schoolId },
        });
        if (!trip) {
          throw new Error('Trip not found in this institution.');
        }
        if (trip.status === 'CANCELLED') {
          throw new Error('Cannot record boarding events on a cancelled trip.');
        }

        const now = new Date();
        const records = await Promise.all(
          events.map(async (ev) => {
            // Verify student & enrollment
            const enrollment = await tx.enrollment.findFirst({
              where: { id: ev.enrollmentId, studentId: ev.studentId, schoolId },
            });
            if (!enrollment) {
              throw new Error(`Enrollment not found for student ${ev.studentId}`);
            }

            // Verify stop
            const stop = await tx.routeStop.findFirst({
              where: { id: ev.stopId, routeId: trip.routeId, schoolId },
            });
            if (!stop) {
              throw new Error(`Stop ${ev.stopId} is not valid for trip route ${trip.routeId}`);
            }

            return tx.transportBoardingEvent.create({
              data: {
                schoolId,
                tripId,
                studentId: ev.studentId,
                enrollmentId: ev.enrollmentId,
                stopId: ev.stopId,
                eventTimestamp: now,
                boardingStatus: ev.boardingStatus,
                source: ev.source || 'MANUAL',
                recordedById: context.userId,
                notes: ev.notes || null,
              },
            });
          })
        );

        return records;
      });

      // Enqueue transport alert notifications for alert boarding statuses (NOT_BOARDED, ABSENT)
      const alertEvents = createdEvents
        .filter((e) => isTransportAlertStatus(e.boardingStatus))
        .map((e) => ({
          id: e.id,
          studentId: e.studentId,
          boardingStatus: e.boardingStatus,
          tripId: e.tripId,
          notes: e.notes,
        }));

      if (alertEvents.length > 0) {
        enqueueTransportAlertNotifications(schoolId, alertEvents).catch((err) => {
          console.error('Failed to enqueue transport alert notifications:', err);
        });
      }

      return NextResponse.json({ success: true, count: createdEvents.length, data: createdEvents }, { status: 201 });
    } else {
      const parsed = RecordBoardingEventSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: 'Validation failed', details: parsed.error.format() },
          { status: 400 }
        );
      }

      const { tripId, studentId, enrollmentId, stopId, boardingStatus, source, notes } = parsed.data;

      const createdEvent = await withTenantContext(schoolId, async (tx) => {
        const trip = await tx.transportTrip.findFirst({
          where: { id: tripId, schoolId },
        });
        if (!trip) {
          throw new Error('Trip not found in this institution.');
        }
        if (trip.status === 'CANCELLED') {
          throw new Error('Cannot record boarding events on a cancelled trip.');
        }

        const enrollment = await tx.enrollment.findFirst({
          where: { id: enrollmentId, studentId, schoolId },
        });
        if (!enrollment) {
          throw new Error('Student enrollment not found in this institution.');
        }

        const stop = await tx.routeStop.findFirst({
          where: { id: stopId, routeId: trip.routeId, schoolId },
        });
        if (!stop) {
          throw new Error('Stop is not valid for the trip route.');
        }

        return tx.transportBoardingEvent.create({
          data: {
            schoolId,
            tripId,
            studentId,
            enrollmentId,
            stopId,
            eventTimestamp: new Date(),
            boardingStatus,
            source: source || 'MANUAL',
            recordedById: context.userId,
            notes: notes || null,
          },
          include: {
            student: { select: { firstNameEn: true, lastNameEn: true } },
            stop: { select: { stopName: true } },
          },
        });
      });

      if (isTransportAlertStatus(createdEvent.boardingStatus)) {
        enqueueTransportAlertNotifications(schoolId, [{
          id: createdEvent.id,
          studentId: createdEvent.studentId,
          boardingStatus: createdEvent.boardingStatus,
          tripId: createdEvent.tripId,
          notes: createdEvent.notes,
        }]).catch((err) => {
          console.error('Failed to enqueue transport alert notification:', err);
        });
      }

      return NextResponse.json({ success: true, data: createdEvent }, { status: 201 });
    }
  } catch (error: any) {
    const status = error.message?.includes('not found')
      ? 404
      : error.message?.includes('cancelled')
      ? 409
      : error.message?.includes('Unauthorized')
      ? 403
      : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
