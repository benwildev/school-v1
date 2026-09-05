import { z } from 'zod';

export const VehicleTypeSchema = z.enum([
  'BUS',
  'MINIBUS',
  'MICROBUS',
  'VAN',
  'AUTO_RICKSHAW',
  'OTHER',
]);

export const VehicleStatusSchema = z.enum([
  'ACTIVE',
  'IN_SERVICE',
  'MAINTENANCE',
  'OUT_OF_SERVICE',
  'RETIRED',
]);

export const TripTypeSchema = z.enum([
  'MORNING_PICKUP',
  'AFTERNOON_DROPOFF',
  'SPECIAL_TRIP',
]);

export const TripStatusSchema = z.enum([
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);

export const TransportBoardingStatusSchema = z.enum([
  'BOARDED',
  'NOT_BOARDED',
  'PICKED_UP',
  'DROPPED_OFF',
  'ABSENT',
  'UNKNOWN',
]);

export const BoardingEventSourceSchema = z.enum([
  'MANUAL',
  'MOBILE',
  'RFID',
  'GPS_DEVICE',
]);

export const TransportAssignmentStatusSchema = z.enum([
  'ACTIVE',
  'SUSPENDED',
  'CANCELLED',
]);

export const CreateVehicleSchema = z.object({
  campusId: z.string().uuid().optional().nullable(),
  vehicleCode: z
    .string()
    .trim()
    .min(2, 'Vehicle code must be at least 2 characters')
    .max(50)
    .toUpperCase(),
  registrationNumber: z
    .string()
    .trim()
    .min(3, 'Registration number must be at least 3 characters')
    .max(100),
  vehicleType: VehicleTypeSchema.default('BUS'),
  makeModel: z.string().max(100).optional().nullable(),
  year: z
    .number()
    .int()
    .min(1980)
    .max(new Date().getFullYear() + 2)
    .optional()
    .nullable(),
  seatingCapacity: z
    .number()
    .int()
    .min(1, 'Capacity must be at least 1')
    .max(200, 'Capacity cannot exceed 200')
    .default(40),
  status: VehicleStatusSchema.default('ACTIVE'),
  insuranceExpiry: z.string().optional().nullable(),
  fitnessExpiry: z.string().optional().nullable(),
  registrationExpiry: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const UpdateVehicleSchema = CreateVehicleSchema.partial();

export const VehicleStatusTransitionSchema = z.object({
  status: VehicleStatusSchema,
  reason: z.string().max(500).optional().nullable(),
});

export const CreateRouteSchema = z.object({
  campusId: z.string().uuid().optional().nullable(),
  routeCode: z
    .string()
    .trim()
    .min(2, 'Route code must be at least 2 characters')
    .max(50)
    .toUpperCase(),
  routeName: z.string().trim().min(2, 'Route name must be at least 2 characters').max(150),
  description: z.string().max(1000).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).default('ACTIVE'),
});

export const UpdateRouteSchema = CreateRouteSchema.partial();

export const CreateRouteStopSchema = z.object({
  stopName: z.string().trim().min(2, 'Stop name must be at least 2 characters').max(150),
  address: z.string().max(500).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  sequenceNumber: z.number().int().min(1, 'Sequence must be at least 1'),
  pickupTime: z.string().max(20).optional().nullable(),
  dropoffTime: z.string().max(20).optional().nullable(),
  fareAmount: z.number().min(0, 'Fare cannot be negative').default(0),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).default('ACTIVE'),
});

export const UpdateRouteStopSchema = CreateRouteStopSchema.partial();

export const AssignDriverSchema = z.object({
  vehicleId: z.string().uuid('Invalid vehicle ID'),
  driverEmployeeId: z.string().uuid('Invalid driver employee ID'),
  conductorEmployeeId: z.string().uuid('Invalid conductor employee ID').optional().nullable(),
  routeId: z.string().uuid('Invalid route ID').optional().nullable(),
  effectiveFrom: z.string().min(1, 'Effective from date is required'),
  effectiveTo: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const AssignStudentTransportSchema = z.object({
  enrollmentId: z.string().uuid('Invalid enrollment ID'),
  routeId: z.string().uuid('Invalid route ID'),
  pickupStopId: z.string().uuid('Invalid pickup stop ID'),
  dropoffStopId: z.string().uuid('Invalid dropoff stop ID'),
  vehicleId: z.string().uuid('Invalid vehicle ID').optional().nullable(),
  feeStructureId: z.string().uuid('Invalid fee structure ID').optional().nullable(),
  effectiveFrom: z.string().min(1, 'Effective from date is required'),
  effectiveTo: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const UpdateStudentTransportSchema = z.object({
  pickupStopId: z.string().uuid().optional(),
  dropoffStopId: z.string().uuid().optional(),
  vehicleId: z.string().uuid().optional().nullable(),
  status: TransportAssignmentStatusSchema.optional(),
  effectiveTo: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const CreateTripSchema = z.object({
  routeId: z.string().uuid('Invalid route ID'),
  vehicleId: z.string().uuid('Invalid vehicle ID'),
  driverEmployeeId: z.string().uuid('Invalid driver employee ID'),
  conductorEmployeeId: z.string().uuid('Invalid conductor employee ID').optional().nullable(),
  tripDate: z.string().min(1, 'Trip date is required'),
  tripType: TripTypeSchema,
  scheduledStartTime: z.string().max(20).optional().nullable(),
  scheduledEndTime: z.string().max(20).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const UpdateTripStatusSchema = z.object({
  status: TripStatusSchema,
  cancellationReason: z.string().max(500).optional().nullable(),
});

export const RecordBoardingEventSchema = z.object({
  tripId: z.string().uuid('Invalid trip ID'),
  studentId: z.string().uuid('Invalid student ID'),
  enrollmentId: z.string().uuid('Invalid enrollment ID'),
  stopId: z.string().uuid('Invalid stop ID'),
  boardingStatus: TransportBoardingStatusSchema,
  source: BoardingEventSourceSchema.default('MANUAL'),
  notes: z.string().max(500).optional().nullable(),
});

export const BatchBoardingEventsSchema = z.object({
  tripId: z.string().uuid('Invalid trip ID'),
  events: z.array(
    z.object({
      studentId: z.string().uuid(),
      enrollmentId: z.string().uuid(),
      stopId: z.string().uuid(),
      boardingStatus: TransportBoardingStatusSchema,
      source: BoardingEventSourceSchema.default('MANUAL'),
      notes: z.string().max(500).optional().nullable(),
    })
  ),
});

export const CreateMaintenanceLogSchema = z.object({
  vehicleId: z.string().uuid('Invalid vehicle ID'),
  maintenanceType: z.string().min(2, 'Maintenance type is required').max(100),
  serviceDate: z.string().min(1, 'Service date is required'),
  odometerReading: z.number().int().min(0).optional().nullable(),
  cost: z.number().min(0, 'Cost cannot be negative').default(0),
  vendorName: z.string().max(150).optional().nullable(),
  invoiceRef: z.string().max(100).optional().nullable(),
  nextServiceDate: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});
