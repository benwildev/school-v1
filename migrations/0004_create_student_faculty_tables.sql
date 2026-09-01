-- ============================================================================
-- Migration 0004: Students, Guardians, Enrollments & Faculty Tables
-- ============================================================================

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  student_code VARCHAR(50) NOT NULL,
  permanent_admission_no VARCHAR(50),
  admission_date DATE NOT NULL,
  first_name_en VARCHAR(100) NOT NULL,
  last_name_en VARCHAR(100) NOT NULL,
  full_name_en VARCHAR(200) NOT NULL,
  full_name_bn VARCHAR(200) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender "Gender" NOT NULL,
  blood_group "BloodGroup",
  religion "Religion" NOT NULL,
  nationality VARCHAR(50) NOT NULL DEFAULT 'Bangladeshi',
  birth_registration_no VARCHAR(50),
  national_id VARCHAR(50),
  photo_url TEXT,
  phone VARCHAR(30),
  email VARCHAR(255),
  permanent_address_line TEXT NOT NULL,
  permanent_village VARCHAR(100),
  permanent_post_office VARCHAR(100) NOT NULL,
  permanent_post_code VARCHAR(20) NOT NULL,
  permanent_thana VARCHAR(100) NOT NULL,
  permanent_district VARCHAR(100) NOT NULL,
  permanent_division "Division" NOT NULL,
  present_address_line TEXT NOT NULL,
  present_thana VARCHAR(100) NOT NULL,
  present_district VARCHAR(100) NOT NULL,
  present_division "Division" NOT NULL,
  is_physically_challenged BOOLEAN NOT NULL DEFAULT FALSE,
  disability_details TEXT,
  status "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_student_id_school UNIQUE (id, school_id),
  CONSTRAINT uq_student_school_code UNIQUE (school_id, student_code)
);

CREATE TABLE guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  full_name_en VARCHAR(150) NOT NULL,
  full_name_bn VARCHAR(150) NOT NULL,
  relation_type "GuardianRelation" NOT NULL,
  national_id VARCHAR(50),
  phone VARCHAR(30) NOT NULL,
  alternate_phone VARCHAR(30),
  email VARCHAR(255),
  occupation VARCHAR(100),
  monthly_income DECIMAL(12, 2),
  education_level VARCHAR(100),
  photo_url TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_guardian_id_school UNIQUE (id, school_id)
);

CREATE TABLE student_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_financial_payer BOOLEAN NOT NULL DEFAULT FALSE,
  can_pick_up BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_student_guardian UNIQUE (student_id, guardian_id)
);

CREATE TABLE emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  relation VARCHAR(100) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  campus_id UUID REFERENCES campuses(id) ON DELETE SET NULL,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE RESTRICT,
  group_id UUID REFERENCES academic_groups(id) ON DELETE SET NULL,
  roll_no INT NOT NULL,
  curriculum_version "CurriculumVersion" NOT NULL DEFAULT 'BANGLA_VERSION',
  enrollment_date DATE NOT NULL,
  enrollment_type "EnrollmentType" NOT NULL DEFAULT 'REGULAR',
  status "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_enrollment_id_school_student UNIQUE (id, school_id, student_id),
  CONSTRAINT uq_enrollment_id_school UNIQUE (id, school_id),
  CONSTRAINT uq_enrollment_session_student UNIQUE (school_id, academic_session_id, student_id),
  CONSTRAINT uq_enrollment_session_roll UNIQUE (school_id, academic_session_id, class_id, section_id, roll_no)
);

CREATE TABLE promotion_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  batch_number VARCHAR(50) NOT NULL,
  source_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT,
  target_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT,
  execution_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_students INT NOT NULL,
  executed_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status "PromotionBatchStatus" NOT NULL DEFAULT 'COMPLETED',
  notes TEXT,
  CONSTRAINT uq_promotion_batch_id_school UNIQUE (id, school_id),
  CONSTRAINT uq_promotion_batch_number UNIQUE (school_id, batch_number)
);

CREATE TABLE promotion_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES promotion_batches(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  source_enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE RESTRICT,
  target_enrollment_id UUID REFERENCES enrollments(id) ON DELETE SET NULL,
  source_class_id VARCHAR(50) NOT NULL,
  source_section_id VARCHAR(50) NOT NULL,
  source_roll_no INT NOT NULL,
  target_class_id VARCHAR(50) NOT NULL,
  target_section_id VARCHAR(50) NOT NULL,
  target_roll_no INT,
  promotion_action "PromotionAction" NOT NULL,
  merit_score DECIMAL(5, 2),
  remarks TEXT
);

CREATE TABLE file_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  bucket VARCHAR(100) NOT NULL,
  storage_key VARCHAR(500) NOT NULL,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  category "FileCategory" NOT NULL,
  uploaded_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_file_attachment_id_school UNIQUE (id, school_id)
);

CREATE TABLE student_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  document_type "StudentDocType" NOT NULL,
  title VARCHAR(200) NOT NULL,
  file_attachment_id UUID NOT NULL REFERENCES file_attachments(id) ON DELETE RESTRICT,
  verification_status "DocVerifyStatus" NOT NULL DEFAULT 'PENDING',
  verified_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  campus_id UUID REFERENCES campuses(id) ON DELETE SET NULL,
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  teacher_code VARCHAR(50) NOT NULL,
  first_name_en VARCHAR(100) NOT NULL,
  last_name_en VARCHAR(100) NOT NULL,
  full_name_en VARCHAR(200) NOT NULL,
  full_name_bn VARCHAR(200) NOT NULL,
  designation "TeacherDesignation" NOT NULL,
  department VARCHAR(100),
  qualification VARCHAR(255) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender "Gender" NOT NULL,
  blood_group "BloodGroup",
  national_id VARCHAR(50) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(255) NOT NULL,
  joining_date DATE NOT NULL,
  signature_url TEXT,
  status "TeacherStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_teacher_id_school UNIQUE (id, school_id),
  CONSTRAINT uq_teacher_school_code UNIQUE (school_id, teacher_code),
  CONSTRAINT uq_teacher_school_phone UNIQUE (school_id, phone)
);

CREATE TABLE teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  role "TeacherAssignmentRole" NOT NULL DEFAULT 'SUBJECT_TEACHER',
  can_enter_marks BOOLEAN NOT NULL DEFAULT TRUE,
  can_take_attendance BOOLEAN NOT NULL DEFAULT TRUE,
  status "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_teacher_assignment UNIQUE (school_id, academic_session_id, section_id, subject_id, role)
);

CREATE TABLE routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
  classroom_id UUID REFERENCES classrooms(id) ON DELETE SET NULL,
  day_of_week "DayOfWeek" NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  period_number INT NOT NULL,
  status "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
