-- ============================================================================
-- Migration 0003: Academic Structure & Timetable
-- ============================================================================

CREATE TABLE academic_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_academic_session_id_school UNIQUE (id, school_id),
  CONSTRAINT uq_academic_session_school_name UNIQUE (school_id, name)
);

CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  name_en VARCHAR(100) NOT NULL,
  name_bn VARCHAR(100) NOT NULL,
  numeric_level INT NOT NULL,
  category "ClassCategory" NOT NULL,
  status "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_class_id_school UNIQUE (id, school_id),
  CONSTRAINT uq_class_school_level_name UNIQUE (school_id, numeric_level, name_en)
);

CREATE TABLE academic_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  code VARCHAR(50) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  name_bn VARCHAR(100) NOT NULL,
  status "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_group_id_school UNIQUE (id, school_id),
  CONSTRAINT uq_group_school_code UNIQUE (school_id, code)
);

CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  campus_id UUID REFERENCES campuses(id) ON DELETE SET NULL,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  group_id UUID REFERENCES academic_groups(id) ON DELETE SET NULL,
  name_en VARCHAR(100) NOT NULL,
  name_bn VARCHAR(100) NOT NULL,
  shift "AcademicShift" NOT NULL DEFAULT 'DAY',
  gender_type "GenderRestriction" NOT NULL DEFAULT 'CO_ED',
  max_capacity INT NOT NULL DEFAULT 50,
  status "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_section_id_school UNIQUE (id, school_id),
  CONSTRAINT uq_section_school_class_shift UNIQUE (school_id, class_id, name_en, shift)
);

CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  group_id UUID REFERENCES academic_groups(id) ON DELETE SET NULL,
  code VARCHAR(30) NOT NULL,
  name_en VARCHAR(150) NOT NULL,
  name_bn VARCHAR(150) NOT NULL,
  subject_type "SubjectType" NOT NULL DEFAULT 'COMPULSORY',
  theory_marks DECIMAL(5, 2) NOT NULL DEFAULT 70.00,
  practical_marks DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  mcq_marks DECIMAL(5, 2) NOT NULL DEFAULT 30.00,
  viva_marks DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  total_full_marks DECIMAL(5, 2) NOT NULL DEFAULT 100.00,
  pass_marks DECIMAL(5, 2) NOT NULL DEFAULT 33.00,
  is_combined_subject BOOLEAN NOT NULL DEFAULT FALSE,
  combined_with_subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  status "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_subject_id_school UNIQUE (id, school_id),
  CONSTRAINT uq_subject_school_class_code UNIQUE (school_id, class_id, code)
);

CREATE TABLE subject_assessment_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  component_name VARCHAR(50) NOT NULL,
  full_marks DECIMAL(5, 2) NOT NULL,
  pass_marks DECIMAL(5, 2) NOT NULL,
  is_mandatory_to_pass BOOLEAN NOT NULL DEFAULT TRUE,
  weight_percentage DECIMAL(5, 2) NOT NULL DEFAULT 100.00,
  CONSTRAINT uq_subject_assessment_config UNIQUE (school_id, subject_id, academic_session_id, component_name)
);

CREATE TABLE classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  campus_id UUID REFERENCES campuses(id) ON DELETE SET NULL,
  room_no VARCHAR(50) NOT NULL,
  building VARCHAR(100),
  floor VARCHAR(50),
  seating_capacity INT NOT NULL DEFAULT 40,
  room_type "RoomType" NOT NULL DEFAULT 'GENERAL_CLASSROOM',
  status "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT uq_classroom_room UNIQUE (school_id, campus_id, room_no)
);

CREATE TABLE academic_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  title_en VARCHAR(255) NOT NULL,
  title_bn VARCHAR(255) NOT NULL,
  description TEXT,
  event_type "CalendarEventType" NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_holiday BOOLEAN NOT NULL DEFAULT TRUE,
  target_audience "TargetAudience" NOT NULL DEFAULT 'ALL'
);
