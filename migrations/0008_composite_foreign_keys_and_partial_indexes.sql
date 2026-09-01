-- ============================================================================
-- Migration 0008: Composite Foreign Keys & Partial Unique Indexes
-- ============================================================================

-- 1. Partial Unique Indexes for Single-State Invariants
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_current_session_per_school 
ON academic_sessions (school_id) WHERE is_current = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_one_main_campus_per_school 
ON campuses (school_id) WHERE is_main_branch = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_one_default_grading_scale_per_school 
ON grading_scales (school_id) WHERE is_default = TRUE;

-- 2. Dual Partial Unique Indexes for FeeStructure Nullable Group Handling
CREATE UNIQUE INDEX IF NOT EXISTS uq_fee_structure_all_groups 
ON fee_structures (school_id, academic_session_id, fee_type_id, class_id) 
WHERE group_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_fee_structure_specific_group 
ON fee_structures (school_id, academic_session_id, fee_type_id, class_id, group_id) 
WHERE group_id IS NOT NULL;

-- 3. Grade Range Overlap Exclusion Constraint (btree_gist if supported)
DO $$
BEGIN
  BEGIN
    ALTER TABLE grade_rules DROP CONSTRAINT IF EXISTS exclude_overlapping_grade_ranges;
    ALTER TABLE grade_rules 
    ADD CONSTRAINT exclude_overlapping_grade_ranges 
    EXCLUDE USING gist (
      grading_scale_id WITH =, 
      numrange(min_percentage, max_percentage, '[]') WITH &&
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'btree_gist exclusion constraint skipped (falling back to database trigger).';
  END;
END $$;

-- 4. Composite Foreign Keys for Tenant & Student Isolation
ALTER TABLE student_fees
  DROP CONSTRAINT IF EXISTS fk_fee_structure_tenant;
ALTER TABLE student_fees
  ADD CONSTRAINT fk_fee_structure_tenant
    FOREIGN KEY (fee_structure_id, school_id)
    REFERENCES fee_structures(id, school_id) ON DELETE SET NULL;

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS fk_payment_enrollment_tenant;
ALTER TABLE payments
  ADD CONSTRAINT fk_payment_enrollment_tenant
    FOREIGN KEY (enrollment_id, school_id, student_id)
    REFERENCES enrollments(id, school_id, student_id) ON DELETE RESTRICT;

ALTER TABLE payment_allocations
  DROP CONSTRAINT IF EXISTS fk_alloc_payment_tenant,
  DROP CONSTRAINT IF EXISTS fk_alloc_fee_tenant;
ALTER TABLE payment_allocations
  ADD CONSTRAINT fk_alloc_payment_tenant
    FOREIGN KEY (payment_id, school_id, student_id)
    REFERENCES payments(id, school_id, student_id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_alloc_fee_tenant
    FOREIGN KEY (student_fee_id, school_id, student_id)
    REFERENCES student_fees(id, school_id, student_id) ON DELETE RESTRICT;

ALTER TABLE student_credit_transactions
  DROP CONSTRAINT IF EXISTS fk_credit_tx_account_tenant;
ALTER TABLE student_credit_transactions
  ADD CONSTRAINT fk_credit_tx_account_tenant
    FOREIGN KEY (account_id, school_id, student_id)
    REFERENCES student_credit_accounts(id, school_id, student_id) ON DELETE RESTRICT;

ALTER TABLE marks
  DROP CONSTRAINT IF EXISTS fk_mark_enrollment_tenant,
  DROP CONSTRAINT IF EXISTS fk_mark_exam_tenant,
  DROP CONSTRAINT IF EXISTS fk_mark_subject_tenant;
ALTER TABLE marks
  ADD CONSTRAINT fk_mark_enrollment_tenant
    FOREIGN KEY (enrollment_id, school_id, student_id)
    REFERENCES enrollments(id, school_id, student_id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_mark_exam_tenant
    FOREIGN KEY (exam_id, school_id)
    REFERENCES exams(id, school_id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_mark_subject_tenant
    FOREIGN KEY (subject_id, school_id)
    REFERENCES subjects(id, school_id) ON DELETE RESTRICT;

ALTER TABLE student_exam_results
  DROP CONSTRAINT IF EXISTS fk_result_enrollment_tenant,
  DROP CONSTRAINT IF EXISTS fk_result_exam_tenant;
ALTER TABLE student_exam_results
  ADD CONSTRAINT fk_result_enrollment_tenant
    FOREIGN KEY (enrollment_id, school_id, student_id)
    REFERENCES enrollments(id, school_id, student_id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_result_exam_tenant
    FOREIGN KEY (exam_id, school_id)
    REFERENCES exams(id, school_id) ON DELETE RESTRICT;

ALTER TABLE student_attendances
  DROP CONSTRAINT IF EXISTS fk_attendance_enrollment_tenant;
ALTER TABLE student_attendances
  ADD CONSTRAINT fk_attendance_enrollment_tenant
    FOREIGN KEY (enrollment_id, school_id, student_id)
    REFERENCES enrollments(id, school_id, student_id) ON DELETE CASCADE;

ALTER TABLE teacher_assignments
  DROP CONSTRAINT IF EXISTS fk_assignment_teacher_tenant,
  DROP CONSTRAINT IF EXISTS fk_assignment_session_tenant,
  DROP CONSTRAINT IF EXISTS fk_assignment_class_tenant,
  DROP CONSTRAINT IF EXISTS fk_assignment_section_tenant;
ALTER TABLE teacher_assignments
  ADD CONSTRAINT fk_assignment_teacher_tenant
    FOREIGN KEY (teacher_id, school_id)
    REFERENCES teachers(id, school_id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_assignment_session_tenant
    FOREIGN KEY (academic_session_id, school_id)
    REFERENCES academic_sessions(id, school_id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_assignment_class_tenant
    FOREIGN KEY (class_id, school_id)
    REFERENCES classes(id, school_id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_assignment_section_tenant
    FOREIGN KEY (section_id, school_id)
    REFERENCES sections(id, school_id) ON DELETE CASCADE;

ALTER TABLE student_discounts
  DROP CONSTRAINT IF EXISTS fk_discount_enrollment_tenant;
ALTER TABLE student_discounts
  ADD CONSTRAINT fk_discount_enrollment_tenant
    FOREIGN KEY (enrollment_id, school_id, student_id)
    REFERENCES enrollments(id, school_id, student_id) ON DELETE RESTRICT;

ALTER TABLE refunds
  DROP CONSTRAINT IF EXISTS fk_refund_payment_tenant;
ALTER TABLE refunds
  ADD CONSTRAINT fk_refund_payment_tenant
    FOREIGN KEY (payment_id, school_id, student_id)
    REFERENCES payments(id, school_id, student_id) ON DELETE RESTRICT;

ALTER TABLE certificates
  DROP CONSTRAINT IF EXISTS fk_cert_enrollment_tenant;
ALTER TABLE certificates
  ADD CONSTRAINT fk_cert_enrollment_tenant
    FOREIGN KEY (enrollment_id, school_id, student_id)
    REFERENCES enrollments(id, school_id, student_id) ON DELETE RESTRICT;

ALTER TABLE promotion_items
  DROP CONSTRAINT IF EXISTS fk_promo_source_enrollment_tenant,
  DROP CONSTRAINT IF EXISTS fk_promo_target_enrollment_tenant;
ALTER TABLE promotion_items
  ADD CONSTRAINT fk_promo_source_enrollment_tenant
    FOREIGN KEY (source_enrollment_id, school_id, student_id)
    REFERENCES enrollments(id, school_id, student_id) ON DELETE RESTRICT;
