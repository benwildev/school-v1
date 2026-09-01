-- ============================================================================
-- Migration 0007: Admissions, Forensics, Certificates & Communications
-- ============================================================================

CREATE TABLE admission_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  application_number VARCHAR(50) NOT NULL,
  tracking_code VARCHAR(20) NOT NULL,
  academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT,
  applied_class_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  applied_group_id UUID REFERENCES academic_groups(id) ON DELETE SET NULL,
  applied_campus_id UUID REFERENCES campuses(id) ON DELETE SET NULL,
  curriculum_version "CurriculumVersion" NOT NULL DEFAULT 'BANGLA_VERSION',
  applied_shift "AcademicShift" NOT NULL DEFAULT 'DAY',
  applicant_name_en VARCHAR(200) NOT NULL,
  applicant_name_bn VARCHAR(200) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender "Gender" NOT NULL,
  blood_group "BloodGroup",
  religion "Religion" NOT NULL,
  birth_registration_no VARCHAR(50),
  father_name_en VARCHAR(150) NOT NULL,
  father_name_bn VARCHAR(150) NOT NULL,
  father_nid VARCHAR(50),
  father_phone VARCHAR(30) NOT NULL,
  father_occupation VARCHAR(100),
  mother_name_en VARCHAR(150) NOT NULL,
  mother_name_bn VARCHAR(150) NOT NULL,
  mother_phone VARCHAR(30),
  present_address TEXT NOT NULL,
  permanent_address TEXT NOT NULL,
  previous_school_name VARCHAR(255),
  previous_class VARCHAR(50),
  previous_gpa DECIMAL(3, 2),
  application_fee_paid BOOLEAN NOT NULL DEFAULT FALSE,
  application_fee_trx_id VARCHAR(100),
  application_source "ApplicationSource" NOT NULL DEFAULT 'PUBLIC_ONLINE',
  status "AdmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
  converted_student_id UUID UNIQUE REFERENCES students(id) ON DELETE SET NULL,
  reviewed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_admission_app_number UNIQUE (school_id, application_number),
  CONSTRAINT uq_admission_tracking_code UNIQUE (school_id, tracking_code)
);

CREATE TABLE application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES admission_applications(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  certificate_number VARCHAR(50) NOT NULL,
  certificate_type "CertificateType" NOT NULL,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE RESTRICT,
  issue_date DATE NOT NULL,
  leaving_reason TEXT,
  conduct_remarks VARCHAR(100) NOT NULL DEFAULT 'Satisfactory',
  template_data JSONB NOT NULL DEFAULT '{}',
  verification_token VARCHAR(100) UNIQUE NOT NULL,
  issued_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status "CertificateStatus" NOT NULL DEFAULT 'ISSUED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_certificate_number UNIQUE (school_id, certificate_number)
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  request_id VARCHAR(100),
  session_id VARCHAR(100),
  trace_id VARCHAR(100),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_name VARCHAR(150) NOT NULL,
  actor_role VARCHAR(50) NOT NULL,
  actor_type VARCHAR(50) NOT NULL DEFAULT 'USER',
  action "AuditAction" NOT NULL,
  entity VARCHAR(100) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  resource_urn VARCHAR(255),
  before_state JSONB,
  after_state JSONB,
  change_summary TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  link_url VARCHAR(500),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  channel "MessageChannel" NOT NULL,
  recipient_phone VARCHAR(30),
  recipient_email VARCHAR(255),
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  guardian_id UUID REFERENCES guardians(id) ON DELETE SET NULL,
  message_body TEXT NOT NULL,
  message_type "MessageType" NOT NULL,
  sms_count INT NOT NULL DEFAULT 1,
  provider VARCHAR(50) NOT NULL,
  provider_message_id VARCHAR(100),
  delivery_status "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
  failure_reason TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL,
  channel "MessageChannel" NOT NULL,
  template_en TEXT NOT NULL,
  template_bn TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]',
  status "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT uq_notification_template_code UNIQUE (school_id, code)
);

CREATE TABLE automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  trigger_event "MessageType" NOT NULL,
  channel "MessageChannel" NOT NULL,
  template_id UUID NOT NULL REFERENCES notification_templates(id) ON DELETE RESTRICT,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  execution_time VARCHAR(10)
);

CREATE TABLE integration_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  provider_type "IntegrationType" NOT NULL,
  provider_name VARCHAR(50) NOT NULL,
  credentials_encrypted TEXT NOT NULL,
  is_live BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  settings JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_integration_provider UNIQUE (school_id, provider_type, provider_name)
);

CREATE TABLE biometric_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  campus_id UUID REFERENCES campuses(id) ON DELETE SET NULL,
  device_name VARCHAR(100) NOT NULL,
  device_serial VARCHAR(100) NOT NULL,
  device_ip VARCHAR(50),
  device_model VARCHAR(100),
  device_type "BiometricDeviceType" NOT NULL,
  last_heartbeat_at TIMESTAMPTZ,
  status "DeviceStatus" NOT NULL DEFAULT 'ONLINE',
  CONSTRAINT uq_biometric_device_serial UNIQUE (school_id, device_serial)
);
