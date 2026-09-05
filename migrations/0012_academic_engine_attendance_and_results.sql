-- ============================================================================
-- Migration 0012: Academic Engine Enhancements (Attendance, Exams & Grading)
-- ============================================================================

-- 1. Enhance student_attendances with direct academic placement relations
ALTER TABLE student_attendances
  ADD COLUMN IF NOT EXISTS academic_session_id UUID REFERENCES academic_sessions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES sections(id) ON DELETE RESTRICT;

-- 2. Tenant-scoped composite foreign keys for student_attendances
ALTER TABLE student_attendances
  DROP CONSTRAINT IF EXISTS fk_attendance_session_tenant,
  DROP CONSTRAINT IF EXISTS fk_attendance_class_tenant,
  DROP CONSTRAINT IF EXISTS fk_attendance_section_tenant;

ALTER TABLE student_attendances
  ADD CONSTRAINT fk_attendance_session_tenant
    FOREIGN KEY (academic_session_id, school_id)
    REFERENCES academic_sessions(id, school_id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_attendance_class_tenant
    FOREIGN KEY (class_id, school_id)
    REFERENCES classes(id, school_id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_attendance_section_tenant
    FOREIGN KEY (section_id, school_id)
    REFERENCES sections(id, school_id) ON DELETE RESTRICT;

-- 3. Database-Level Partial Unique Indexes for Daily Attendance Uniqueness
-- Prevents duplicate daily attendance (where period_id IS NULL) for the same enrollment or student on the same date
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_attendance_enrollment
ON student_attendances (school_id, enrollment_id, date) WHERE period_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_attendance_student
ON student_attendances (school_id, student_id, date) WHERE period_id IS NULL;

-- 4. Fast Query Indexes for Class/Section Roster Retrieval
CREATE INDEX IF NOT EXISTS idx_student_attendances_class_section_date
ON student_attendances (school_id, class_id, section_id, date);

CREATE INDEX IF NOT EXISTS idx_student_attendances_session
ON student_attendances (school_id, academic_session_id);

CREATE INDEX IF NOT EXISTS idx_marks_exam_class_section
ON marks (school_id, exam_id, subject_id, status);

CREATE INDEX IF NOT EXISTS idx_student_exam_results_exam_class
ON student_exam_results (school_id, exam_id, class_id, section_id);
