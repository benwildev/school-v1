import { prisma } from '@/lib/db';

export interface VehicleCapacityCheckResult {
  hasCapacity: boolean;
  seatingCapacity: number;
  currentActiveCount: number;
  remainingSeats: number;
  error?: string;
}

/**
 * Validates whether a vehicle has available seating capacity for a new active student assignment.
 * Supports transactional context to prevent race conditions during concurrent assignments.
 */
export async function checkVehicleCapacity(
  vehicleId: string,
  schoolId: string,
  tx: any = prisma
): Promise<VehicleCapacityCheckResult> {
  // If running inside a transaction, acquire row-level lock to prevent concurrent over-assignment races
  if (tx && tx.$queryRaw) {
    try {
      await tx.$queryRaw`
        SELECT id FROM transport_vehicles 
        WHERE id = ${vehicleId}::uuid AND school_id = ${schoolId}::uuid 
        FOR UPDATE
      `;
    } catch {
      // Fallback if not inside interactive transaction block
    }
  }

  const vehicle = await tx.vehicle.findFirst({
    where: { id: vehicleId, schoolId },
    select: { id: true, vehicleCode: true, seatingCapacity: true, status: true },
  });

  if (!vehicle) {
    return {
      hasCapacity: false,
      seatingCapacity: 0,
      currentActiveCount: 0,
      remainingSeats: 0,
      error: 'Vehicle not found in this institution.',
    };
  }

  if (vehicle.status !== 'ACTIVE' && vehicle.status !== 'IN_SERVICE') {
    return {
      hasCapacity: false,
      seatingCapacity: vehicle.seatingCapacity,
      currentActiveCount: 0,
      remainingSeats: 0,
      error: `Vehicle ${vehicle.vehicleCode} is currently ${vehicle.status} and cannot accept new student assignments.`,
    };
  }

  // Count active student assignments for this vehicle
  const currentActiveCount = await tx.studentTransportAssignment.count({
    where: {
      schoolId,
      vehicleId,
      status: 'ACTIVE',
    },
  });

  const remainingSeats = vehicle.seatingCapacity - currentActiveCount;
  const hasCapacity = remainingSeats > 0;

  return {
    hasCapacity,
    seatingCapacity: vehicle.seatingCapacity,
    currentActiveCount,
    remainingSeats,
    error: hasCapacity
      ? undefined
      : `Vehicle ${vehicle.vehicleCode} has reached maximum seating capacity (${vehicle.seatingCapacity} seats, ${currentActiveCount} assigned).`,
  };
}

/**
 * Resolves the active driver and conductor for a vehicle on a specific calendar date.
 */
export async function resolveActiveDriverForDate(
  vehicleId: string,
  schoolId: string,
  date: Date | string,
  tx: any = prisma
) {
  const queryDate = new Date(date);

  const assignment = await tx.vehicleDriverAssignment.findFirst({
    where: {
      schoolId,
      vehicleId,
      isActive: true,
      effectiveFrom: { lte: queryDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: queryDate } }],
    },
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
      route: {
        select: {
          id: true,
          routeCode: true,
          routeName: true,
        },
      },
    },
    orderBy: { effectiveFrom: 'desc' },
  });

  return assignment;
}
