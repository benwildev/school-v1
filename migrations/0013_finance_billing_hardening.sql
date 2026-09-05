-- ============================================================================
-- Migration 0013: Finance & Billing Hardening, Composite Foreign Keys & Indexes
-- ============================================================================

-- 1. Composite Foreign Keys to ensure Enrollment-Student-School Tenant Consistency
ALTER TABLE student_fees
  DROP CONSTRAINT IF EXISTS fk_fee_enrollment_tenant;
ALTER TABLE student_fees
  ADD CONSTRAINT fk_fee_enrollment_tenant
    FOREIGN KEY (enrollment_id, school_id, student_id)
    REFERENCES enrollments(id, school_id, student_id) ON DELETE RESTRICT;

ALTER TABLE student_discounts
  DROP CONSTRAINT IF EXISTS fk_discount_enrollment_tenant;
ALTER TABLE student_discounts
  ADD CONSTRAINT fk_discount_enrollment_tenant
    FOREIGN KEY (enrollment_id, school_id, student_id)
    REFERENCES enrollments(id, school_id, student_id) ON DELETE RESTRICT;

-- 2. Student Credit Account Tenant Uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_credit_account_tenant
ON student_credit_accounts (school_id, student_id);

-- 3. High-Performance Financial Indexes for Reporting and Aggregation
CREATE INDEX IF NOT EXISTS idx_student_fees_class_status
ON student_fees (school_id, enrollment_id, status);

CREATE INDEX IF NOT EXISTS idx_student_fees_period_status
ON student_fees (school_id, billing_period_key, status);

CREATE INDEX IF NOT EXISTS idx_payments_date_method
ON payments (school_id, payment_date, payment_method);

CREATE INDEX IF NOT EXISTS idx_allocations_payment
ON payment_allocations (school_id, payment_id);

CREATE INDEX IF NOT EXISTS idx_receipts_payment
ON receipts (school_id, payment_id);

CREATE INDEX IF NOT EXISTS idx_refunds_payment
ON refunds (school_id, payment_id);
