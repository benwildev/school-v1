import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { calculateDocumentExpiryStatus } from '@/lib/transport/vehicle-engine';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'TRANSPORT_REPORT_VIEW' });

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'summary';
    const routeId = searchParams.get('routeId');
    const vehicleId = searchParams.get('vehicleId');

    const reportData = await withTenantContext(schoolId, async () => {
      if (reportType === 'expiry-alerts') {
        const vehicles = await prisma.vehicle.findMany({
          where: { schoolId, status: { not: 'RETIRED' } },
          select: {
            id: true,
            vehicleCode: true,
            registrationNumber: true,
            insuranceExpiry: true,
            fitnessExpiry: true,
            registrationExpiry: true,
            status: true,
          },
        });

        const alerts = vehicles.map((v) => ({
          ...v,
          documentCompliance: calculateDocumentExpiryStatus(v),
        })).filter(
          (v) =>
            v.documentCompliance.insurance.isExpiringSoon ||
            v.documentCompliance.insurance.isExpired ||
            v.documentCompliance.fitness.isExpiringSoon ||
            v.documentCompliance.fitness.isExpired ||
            v.documentCompliance.registration.isExpiringSoon ||
            v.documentCompliance.registration.isExpired
        );

        return { alerts, totalAlerts: alerts.length };
      }

      if (reportType === 'capacity-utilization') {
        const vehicles = await prisma.vehicle.findMany({
          where: { schoolId, status: { in: ['ACTIVE', 'IN_SERVICE'] } },
          include: {
            _count: {
              select: {
                studentAssignments: { where: { status: 'ACTIVE' } },
              },
            },
          },
        });

        const utilization = vehicles.map((v) => {
          const assigned = v._count.studentAssignments;
          const capacity = v.seatingCapacity;
          const percentage = capacity > 0 ? Math.round((assigned / capacity) * 100) : 0;
          return {
            vehicleId: v.id,
            vehicleCode: v.vehicleCode,
            registrationNumber: v.registrationNumber,
            seatingCapacity: capacity,
            activeAssignedStudents: assigned,
            utilizationPercentage: percentage,
            isOverCapacity: assigned > capacity,
            availableSeats: Math.max(0, capacity - assigned),
          };
        });

        return { utilization };
      }

      if (reportType === 'passenger-manifest') {
        const where: any = { schoolId, status: 'ACTIVE' };
        if (routeId) where.routeId = routeId;
        if (vehicleId) where.vehicleId = vehicleId;

        const manifest = await prisma.studentTransportAssignment.findMany({
          where,
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
            enrollment: {
              select: {
                rollNo: true,
                class: { select: { nameEn: true } },
                section: { select: { nameEn: true } },
              },
            },
            route: { select: { routeCode: true, routeName: true } },
            pickupStop: { select: { stopName: true, pickupTime: true, sequenceNumber: true } },
            dropoffStop: { select: { stopName: true, dropoffTime: true, sequenceNumber: true } },
            vehicle: { select: { vehicleCode: true } },
          },
          orderBy: [
            { pickupStop: { sequenceNumber: 'asc' } },
            { student: { firstNameEn: 'asc' } },
          ],
        });

        return { manifest, totalCount: manifest.length };
      }

      // Default: Summary KPI
      const [
        totalVehicles,
        activeVehicles,
        totalRoutes,
        assignedStudents,
        totalTripsToday,
        activeDrivers,
      ] = await Promise.all([
        prisma.vehicle.count({ where: { schoolId } }),
        prisma.vehicle.count({ where: { schoolId, status: 'ACTIVE' } }),
        prisma.transportRoute.count({ where: { schoolId, status: 'ACTIVE' } }),
        prisma.studentTransportAssignment.count({ where: { schoolId, status: 'ACTIVE' } }),
        prisma.transportTrip.count({
          where: {
            schoolId,
            tripDate: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
              lte: new Date(new Date().setHours(23, 59, 59, 999)),
            },
          },
        }),
        prisma.vehicleDriverAssignment.count({ where: { schoolId, isActive: true } }),
      ]);

      return {
        totalVehicles,
        activeVehicles,
        totalRoutes,
        assignedStudents,
        totalTripsToday,
        activeDrivers,
      };
    });

    return NextResponse.json({ success: true, data: reportData });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
