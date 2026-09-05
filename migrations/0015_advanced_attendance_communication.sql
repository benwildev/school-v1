-- ============================================================================
-- Migration 0015: Phase 8 — Advanced Attendance, Biometric/RFID & Communication Engine
-- ============================================================================

-- 1. Extend Existing Enums with Idempotent Statements
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'HOLIDAY';
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'WEEKEND';
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'OFF_DAY';

ALTER TYPE "MessageChannel" ADD VALUE IF NOT EXISTS 'IN_APP';

ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'SENDING';
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'ATTENDANCE_LATE';
ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'LEAVE_UPDATE';
ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'PAYROLL_NOTICE';
ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'EXAM_SCHEDULE';
ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'ANNOUNCEMENT';

-- 2. Create Phase 8 Domain Enums
DO $$ BEGIN
  CREATE TYPE "EventProcessingStatus" AS ENUM (
    'PENDING',
    'PROCESSED',
    'DUPLICATE',
    'FAILED',
    'NEEDS_REVIEW'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "VerificationStatus" AS ENUM (
    'UNVERIFIED',
    'VERIFIED',
    'REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Extend biometric_devices table
ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS provider VARCHAR(50) NOT NULL DEFAULT 'ZKTECO';
ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS credentials_encrypted TEXT;
ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS api_key_hash VARCHAR(128);
ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS port INT;
ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS location VARCHAR(255);
ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}';
ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS sync_mode VARCHAR(50) NOT NULL DEFAULT 'REALTIME';
ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;
ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$ BEGIN
  ALTER TABLE biometric_devices ADD CONSTRAINT uq_biometric_device_tenant UNIQUE (id, school_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

-- 4. Raw Attendance Events (Permanent Audit Log & Deduplication Layer)
CREATE TABLE IF NOT EXISTS raw_attendance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  device_id UUID REFERENCES biometric_devices(id) ON DELETE SET NULL,
  external_event_id VARCHAR(150),
  device_timestamp TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  identifier_type VARCHAR(50) NOT NULL,
  identifier_value VARCHAR(100) NOT NULL,
  event_type VARCHAR(50) NOT NULL DEFAULT 'CHECK_IN',
  processing_status "EventProcessingStatus" NOT NULL DEFAULT 'PENDING',
  resolved_user_type VARCHAR(50),
  resolved_student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  resolved_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  attendance_record_id UUID,
  raw_payload JSONB NOT NULL DEFAULT '{}',
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  CONSTRAINT uq_raw_attendance_event UNIQUE (school_id, device_id, external_event_id),
  CONSTRAINT uq_raw_attendance_event_tenant UNIQUE (id, school_id)
);

CREATE INDEX IF NOT EXISTS idx_raw_events_school_date ON raw_attendance_events (school_id, device_timestamp);
CREATE INDEX IF NOT EXISTS idx_raw_events_identifier ON raw_attendance_events (school_id, identifier_type, identifier_value);
CREATE INDEX IF NOT EXISTS idx_raw_events_status ON raw_attendance_events (school_id, processing_status);

-- 5. Attendance Rules (Configurable Institutional Policies)
CREATE TABLE IF NOT EXISTS attendance_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  campus_id UUID REFERENCES campuses(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NOT NULL DEFAULT 'STUDENT',
  shift "AcademicShift",
  start_time TIME NOT NULL DEFAULT '08:00:00',
  late_threshold_minutes INT NOT NULL DEFAULT 15,
  half_day_threshold_minutes INT NOT NULL DEFAULT 120,
  end_time TIME NOT NULL DEFAULT '14:00:00',
  early_checkout_minutes INT NOT NULL DEFAULT 30,
  working_days JSONB NOT NULL DEFAULT '["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY"]'::JSONB,
  grace_period_minutes INT NOT NULL DEFAULT 5,
  checkout_required BOOLEAN NOT NULL DEFAULT FALSE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_attendance_rule_tenant UNIQUE (id, school_id)
);

-- 6. Employee Shifts (HR Staff Work Shifts)
CREATE TABLE IF NOT EXISTS employee_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name_en VARCHAR(100) NOT NULL,
  name_bn VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  late_grace_minutes INT NOT NULL DEFAULT 15,
  half_day_late_minutes INT NOT NULL DEFAULT 120,
  working_days JSONB NOT NULL DEFAULT '["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY"]'::JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_employee_shift_code UNIQUE (school_id, code),
  CONSTRAINT uq_employee_shift_tenant UNIQUE (id, school_id)
);

-- 7. Attendance Corrections (Audit Trail of All Manual Overrides)
CREATE TABLE IF NOT EXISTS attendance_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  attendance_type VARCHAR(50) NOT NULL,
  student_attendance_id UUID REFERENCES student_attendances(id) ON DELETE CASCADE,
  employee_attendance_id UUID REFERENCES employee_attendances(id) ON DELETE CASCADE,
  original_status "AttendanceStatus" NOT NULL,
  corrected_status "AttendanceStatus" NOT NULL,
  original_check_in TIME,
  corrected_check_in TIME,
  original_check_out TIME,
  corrected_check_out TIME,
  action_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action_reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_attendance_correction_tenant UNIQUE (id, school_id)
);

-- 8. Extend student_attendances
ALTER TABLE student_attendances ADD COLUMN IF NOT EXISTS device_id UUID REFERENCES biometric_devices(id) ON DELETE SET NULL;
ALTER TABLE student_attendances ADD COLUMN IF NOT EXISTS raw_event_id UUID REFERENCES raw_attendance_events(id) ON DELETE SET NULL;
ALTER TABLE student_attendances ADD COLUMN IF NOT EXISTS verification_status "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED';
ALTER TABLE student_attendances ADD COLUMN IF NOT EXISTS verified_by_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE student_attendances ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- 9. Extend employee_attendances
ALTER TABLE employee_attendances ADD COLUMN IF NOT EXISTS device_id UUID REFERENCES biometric_devices(id) ON DELETE SET NULL;
ALTER TABLE employee_attendances ADD COLUMN IF NOT EXISTS raw_event_id UUID REFERENCES raw_attendance_events(id) ON DELETE SET NULL;
ALTER TABLE employee_attendances ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES employee_shifts(id) ON DELETE SET NULL;
ALTER TABLE employee_attendances ADD COLUMN IF NOT EXISTS verification_status "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED';
ALTER TABLE employee_attendances ADD COLUMN IF NOT EXISTS verified_by_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE employee_attendances ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- 10. Communication Campaigns (Bulk Messaging)
CREATE TABLE IF NOT EXISTS communication_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  channel "MessageChannel" NOT NULL,
  target_audience VARCHAR(50) NOT NULL,
  target_filter JSONB NOT NULL DEFAULT '{}',
  template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
  custom_body TEXT,
  total_recipients INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'QUEUED',
  idempotency_key VARCHAR(100),
  created_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT uq_campaign_idempotency UNIQUE (school_id, idempotency_key),
  CONSTRAINT uq_campaign_tenant UNIQUE (id, school_id)
);

-- 11. Notification Preferences (User Opt-in/Opt-out Controls)
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sms_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  attendance_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  fee_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  exam_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  general_notices BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_notification_pref UNIQUE (school_id, user_id),
  CONSTRAINT uq_notification_pref_tenant UNIQUE (id, school_id)
);

-- 12. Extend notifications table
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type "MessageType" DEFAULT 'GENERAL_NOTICE';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 13. Extend message_logs table
ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES communication_campaigns(id) ON DELETE SET NULL;
ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL;
ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(120);
ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0;
ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE message_logs ADD CONSTRAINT uq_message_log_idempotency UNIQUE (school_id, idempotency_key);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

-- 14. Row-Level Security (RLS) on all Phase 8 Tables
DO $$
DECLARE
  tbl TEXT;
  phase8_tables TEXT[] := ARRAY[
    'raw_attendance_events', 'attendance_rules', 'employee_shifts',
    'attendance_corrections', 'communication_campaigns', 'notification_preferences'
  ];
BEGIN
  FOREACH tbl IN ARRAY phase8_tables LOOP
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

DO $$
BEGIN
  BEGIN
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO edusmart_app_user;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO edusmart_app_user;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

