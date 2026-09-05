-- ============================================================================
-- Migration 0016: Phase 9 — School Operations & Transport Management Subsystem
-- Database Engine: PostgreSQL 15+ (Row-Level Security Enforced)
-- Target Locale: Bangladesh (Asia/Dhaka), Currency: BDT (৳)
-- ============================================================================

-- 1. Create Phase 9 Domain Enums
DO $$ BEGIN
  CREATE TYPE "VehicleType" AS ENUM (
    'BUS',
    'MINIBUS',
    'MICROBUS',
    'VAN',
    'AUTO_RICKSHAW',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "VehicleStatus" AS ENUM (
    'ACTIVE',
    'IN_SERVICE',
    'MAINTENANCE',
    'OUT_OF_SERVICE',
    'RETIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TripType" AS ENUM (
    'MORNING_PICKUP',
    'AFTERNOON_DROPOFF',
    'SPECIAL_TRIP'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TripStatus" AS ENUM (
    'PLANNED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TransportBoardingStatus" AS ENUM (
    'BOARDED',
    'NOT_BOARDED',
    'PICKED_UP',
    'DROPPED_OFF',
    'ABSENT',
    'UNKNOWN'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BoardingEventSource" AS ENUM (
    'MANUAL',
    'MOBILE',
    'RFID',
    'GPS_DEVICE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TransportAssignmentStatus" AS ENUM (
    'ACTIVE',
    'SUSPENDED',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Vehicles Table
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  campus_id UUID REFERENCES campuses(id) ON DELETE SET NULL,
  vehicle_code VARCHAR(50) NOT NULL,
  registration_number VARCHAR(100) NOT NULL,
  vehicle_type "VehicleType" NOT NULL DEFAULT 'BUS',
  make_model VARCHAR(100),
  year INT,
  seating_capacity INT NOT NULL DEFAULT 40,
  status "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
  insurance_expiry DATE,
  fitness_expiry DATE,
  registration_expiry DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_vehicle_school_code UNIQUE (school_id, vehicle_code),
  CONSTRAINT uq_vehicle_school_reg UNIQUE (school_id, registration_number),
  CONSTRAINT uq_vehicle_tenant UNIQUE (id, school_id),
  CONSTRAINT chk_vehicle_capacity CHECK (seating_capacity > 0)
);

CREATE INDEX IF NOT EXISTS idx_vehicles_school_status ON vehicles (school_id, status);
CREATE INDEX IF NOT EXISTS idx_vehicles_campus ON vehicles (school_id, campus_id);

-- 3. Transport Routes Table
CREATE TABLE IF NOT EXISTS transport_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  campus_id UUID REFERENCES campuses(id) ON DELETE SET NULL,
  route_code VARCHAR(50) NOT NULL,
  route_name VARCHAR(150) NOT NULL,
  description TEXT,
  status "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_route_school_code UNIQUE (school_id, route_code),
  CONSTRAINT uq_route_tenant UNIQUE (id, school_id)
);

CREATE INDEX IF NOT EXISTS idx_transport_routes_school_status ON transport_routes (school_id, status);
CREATE INDEX IF NOT EXISTS idx_transport_routes_campus ON transport_routes (school_id, campus_id);

-- 4. Route Stops Table (Ordered Sequence)
CREATE TABLE IF NOT EXISTS route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES transport_routes(id) ON DELETE CASCADE,
  stop_name VARCHAR(150) NOT NULL,
  address TEXT,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  sequence_number INT NOT NULL,
  pickup_time TIME,
  dropoff_time TIME,
  fare_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  status "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_route_stop_sequence UNIQUE (route_id, sequence_number),
  CONSTRAINT uq_route_stop_tenant UNIQUE (id, school_id),
  CONSTRAINT chk_stop_sequence CHECK (sequence_number > 0)
);

CREATE INDEX IF NOT EXISTS idx_route_stops_route_seq ON route_stops (route_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_route_stops_school ON route_stops (school_id);

-- 5. Vehicle Driver Assignments Table (Effective-dated, Reusing Employee)
CREATE TABLE IF NOT EXISTS vehicle_driver_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  driver_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  conductor_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  route_id UUID REFERENCES transport_routes(id) ON DELETE SET NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_vda_tenant UNIQUE (id, school_id),
  CONSTRAINT fk_vda_driver_tenant FOREIGN KEY (driver_employee_id, school_id) REFERENCES employees(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT fk_vda_vehicle_tenant FOREIGN KEY (vehicle_id, school_id) REFERENCES vehicles(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT chk_vda_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_vda_vehicle ON vehicle_driver_assignments (school_id, vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vda_driver ON vehicle_driver_assignments (school_id, driver_employee_id);
CREATE INDEX IF NOT EXISTS idx_vda_active ON vehicle_driver_assignments (school_id, is_active);

-- 6. Student Transport Assignments Table (Enrollment-anchored)
CREATE TABLE IF NOT EXISTS student_transport_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  route_id UUID NOT NULL REFERENCES transport_routes(id) ON DELETE RESTRICT,
  pickup_stop_id UUID NOT NULL REFERENCES route_stops(id) ON DELETE RESTRICT,
  dropoff_stop_id UUID NOT NULL REFERENCES route_stops(id) ON DELETE RESTRICT,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE RESTRICT,
  fee_structure_id UUID REFERENCES fee_structures(id) ON DELETE SET NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  status "TransportAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_student_transport_tenant UNIQUE (id, school_id),
  CONSTRAINT chk_sta_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_sta_enrollment ON student_transport_assignments (school_id, enrollment_id);
CREATE INDEX IF NOT EXISTS idx_sta_student ON student_transport_assignments (school_id, student_id);
CREATE INDEX IF NOT EXISTS idx_sta_route ON student_transport_assignments (school_id, route_id);
CREATE INDEX IF NOT EXISTS idx_sta_vehicle ON student_transport_assignments (school_id, vehicle_id, status);

-- 7. Transport Daily Trips Table (Historical Immutability)
CREATE TABLE IF NOT EXISTS transport_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES transport_routes(id) ON DELETE RESTRICT,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  driver_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  conductor_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  trip_date DATE NOT NULL,
  trip_type "TripType" NOT NULL,
  status "TripStatus" NOT NULL DEFAULT 'PLANNED',
  scheduled_start_time TIME,
  scheduled_end_time TIME,
  actual_start_time TIMESTAMPTZ,
  actual_end_time TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_trip_unique UNIQUE (school_id, route_id, vehicle_id, trip_date, trip_type),
  CONSTRAINT uq_trip_tenant UNIQUE (id, school_id)
);

CREATE INDEX IF NOT EXISTS idx_trips_school_date ON transport_trips (school_id, trip_date);
CREATE INDEX IF NOT EXISTS idx_trips_driver ON transport_trips (school_id, driver_employee_id);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle ON transport_trips (school_id, vehicle_id);

-- 8. Transport Boarding Events Table (Boarding Attendance)
CREATE TABLE IF NOT EXISTS transport_boarding_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES transport_trips(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE RESTRICT,
  stop_id UUID NOT NULL REFERENCES route_stops(id) ON DELETE RESTRICT,
  boarding_status "TransportBoardingStatus" NOT NULL,
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source "BoardingEventSource" NOT NULL DEFAULT 'MANUAL',
  recorded_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_transport_boarding_daily UNIQUE (trip_id, student_id, boarding_status),
  CONSTRAINT uq_transport_boarding_tenant UNIQUE (id, school_id)
);

CREATE INDEX IF NOT EXISTS idx_tbe_trip ON transport_boarding_events (school_id, trip_id);
CREATE INDEX IF NOT EXISTS idx_tbe_student ON transport_boarding_events (school_id, student_id);
CREATE INDEX IF NOT EXISTS idx_tbe_timestamp ON transport_boarding_events (school_id, event_timestamp);

-- 9. Vehicle Maintenance Logs Table
CREATE TABLE IF NOT EXISTS vehicle_maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  maintenance_type VARCHAR(100) NOT NULL,
  service_date DATE NOT NULL,
  odometer_reading INT,
  cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  vendor_name VARCHAR(150),
  invoice_ref VARCHAR(100),
  next_service_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_maintenance_tenant UNIQUE (id, school_id),
  CONSTRAINT fk_maintenance_vehicle_tenant FOREIGN KEY (vehicle_id, school_id) REFERENCES vehicles(id, school_id) ON DELETE CASCADE,
  CONSTRAINT chk_maintenance_cost CHECK (cost >= 0)
);

CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle ON vehicle_maintenance_logs (school_id, vehicle_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_date ON vehicle_maintenance_logs (school_id, service_date);

-- 10. Enable & Force Row-Level Security (RLS) on all Phase 9 Tables
DO $$
DECLARE
  tbl TEXT;
  phase9_tables TEXT[] := ARRAY[
    'vehicles',
    'transport_routes',
    'route_stops',
    'vehicle_driver_assignments',
    'student_transport_assignments',
    'transport_trips',
    'transport_boarding_events',
    'vehicle_maintenance_logs'
  ];
BEGIN
  FOREACH tbl IN ARRAY phase9_tables LOOP
    EXECUTE format('ALTER TABLE IF EXISTS %I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('ALTER TABLE IF EXISTS %I FORCE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I;', tbl);
    EXECUTE format('
      CREATE POLICY tenant_isolation_policy ON %I
      FOR ALL
      USING (school_id = NULLIF(current_setting(''app.current_school_id'', true), '''')::UUID)
      WITH CHECK (school_id = NULLIF(current_setting(''app.current_school_id'', true), '''')::UUID);
    ', tbl);
  END LOOP;
END $$;

-- 11. Grant Permissions to Unprivileged edusmart_app_user
DO $$
BEGIN
  BEGIN
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO edusmart_app_user;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO edusmart_app_user;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
