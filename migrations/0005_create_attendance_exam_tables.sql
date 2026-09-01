-- ============================================================================
-- Migration 0005: Attendance, Exams & Marks Ledger Tables
-- ============================================================================

CREATE TABLE student_attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  period_id UUID REFERENCES routines(id) ON DELETE SET NULL,
  status "AttendanceStatus" NOT NULL,
  source "AttendanceSource" NOT NULL DEFAULT 'MANUAL',
  check_in_time TIME,
  check_out_time TIME,
  late_minutes INT NOT NULL DEFAULT 0,
  leave_reason TEXT,
  marked_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_student_attendance UNIQUE (school_id, student_id, date, period_id)
);

CREATE TABLE employee_attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  status "AttendanceStatus" NOT NULL,
  source "AttendanceSource" NOT NULL DEFAULT 'MANUAL',
  check_in_time TIME,
  check_out_time TIME,
  working_hours DECIMAL(4, 2),
  late_minutes INT NOT NULL DEFAULT 0,
  is_overtime BOOLEAN NOT NULL DEFAULT FALSE,
  marked_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_employee_attendance UNIQUE (school_id, user_id, date)
);

CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  name_en VARCHAR(150) NOT NULL,
  name_bn VARCHAR(150) NOT NULL,
  exam_type "ExamType" NOT NULL,
  term "ExamTerm" NOT NULL,
  weightage_percentage DECIMAL(5, 2) NOT NULL DEFAULT 100.00,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status "ExamStatus" NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_exam_id_school UNIQUE (id, school_id),
  CONSTRAINT uq_exam_session_name UNIQUE (school_id, academic_session_id, name_en)
);

CREATE TABLE exam_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  exam_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  full_marks DECIMAL(5, 2) NOT NULL,
  pass_marks DECIMAL(5, 2) NOT NULL,
  classroom_id UUID REFERENCES classrooms(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_exam_schedule UNIQUE (school_id, exam_id, class_id, subject_id)
);

CREATE TABLE grading_scales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT TRUE,
  status "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_grading_scale_id_school UNIQUE (id, school_id)
);

CREATE TABLE grade_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grading_scale_id UUID NOT NULL REFERENCES grading_scales(id) ON DELETE CASCADE,
  letter_grade VARCHAR(10) NOT NULL,
  grade_point DECIMAL(3, 2) NOT NULL,
  min_percentage DECIMAL(5, 2) NOT NULL,
  max_percentage DECIMAL(5, 2) NOT NULL,
  remarks_en VARCHAR(50) NOT NULL,
  remarks_bn VARCHAR(50) NOT NULL,
  is_passing_grade BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT uq_grade_scale_letter UNIQUE (grading_scale_id, letter_grade)
);

CREATE TABLE marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE RESTRICT,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE RESTRICT,
  theory_obtained DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  mcq_obtained DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  practical_obtained DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  viva_obtained DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  ca_obtained DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  total_obtained DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  grade_point DECIMAL(3, 2) NOT NULL DEFAULT 0.00,
  letter_grade VARCHAR(10) NOT NULL DEFAULT 'F',
  is_absent BOOLEAN NOT NULL DEFAULT FALSE,
  status "MarkWorkflowStatus" NOT NULL DEFAULT 'DRAFT',
  entered_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  CONSTRAINT uq_mark_entry UNIQUE (school_id, exam_id, subject_id, enrollment_id)
);

CREATE TABLE student_exam_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE RESTRICT,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE RESTRICT,
  total_marks_obtained DECIMAL(7, 2) NOT NULL,
  total_full_marks DECIMAL(7, 2) NOT NULL,
  calculated_gpa DECIMAL(3, 2) NOT NULL,
  final_grade VARCHAR(10) NOT NULL,
  is_passed BOOLEAN NOT NULL,
  failed_subjects_count INT NOT NULL DEFAULT 0,
  class_position INT,
  section_position INT,
  remarks TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_student_exam_result UNIQUE (school_id, exam_id, enrollment_id)
);
