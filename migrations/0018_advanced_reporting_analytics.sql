-- ============================================================================
-- Migration 0018: Phase 11 — Advanced Reporting, Analytics & Management Intelligence
-- Database Engine: PostgreSQL 15+ (Row-Level Security Enforced, Composite FKs)
-- Target Locale: Bangladesh (Asia/Dhaka), Currency: BDT (৳)
-- ============================================================================

-- 1. Saved Reports Table (User-customized filter presets and pinned views)
CREATE TABLE IF NOT EXISTS saved_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_id VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  name_bn VARCHAR(200),
  description TEXT,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  columns JSONB,
  sort_by VARCHAR(100),
  sort_order VARCHAR(10) DEFAULT 'ASC',
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_saved_reports_tenant UNIQUE (id, school_id)
);

-- 2. Report Export Logs (Forensic audit trail for report data exports)
CREATE TABLE IF NOT EXISTS report_export_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_id VARCHAR(100) NOT NULL,
  format VARCHAR(20) NOT NULL, -- 'CSV', 'XLSX', 'PDF', 'PRINT'
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_count INT NOT NULL DEFAULT 0,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_report_export_logs_tenant UNIQUE (id, school_id),
  CONSTRAINT chk_report_export_count CHECK (result_count >= 0)
);

-- ============================================================================
-- 3. ANALYTICS & REPORTING COMPOUND INDEXES
-- ============================================================================

-- Saved Reports Indexes
CREATE INDEX IF NOT EXISTS idx_saved_reports_user ON saved_reports (school_id, user_id, report_id);
CREATE INDEX IF NOT EXISTS idx_saved_reports_pinned ON saved_reports (school_id, is_pinned) WHERE is_pinned = true;

-- Report Export Logs Indexes
CREATE INDEX IF NOT EXISTS idx_report_export_logs_report ON report_export_logs (school_id, report_id, created_at);
CREATE INDEX IF NOT EXISTS idx_report_export_logs_user ON report_export_logs (school_id, user_id, created_at);

-- Core Analytics Indexes on Canonical Tables
CREATE INDEX IF NOT EXISTS idx_enrollments_analytics ON enrollments (school_id, academic_session_id, status);
CREATE INDEX IF NOT EXISTS idx_enrollments_class_analytics ON enrollments (school_id, class_id, section_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_analytics ON payments (school_id, payment_date, status);
CREATE INDEX IF NOT EXISTS idx_student_fees_analytics ON student_fees (school_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_student_attendance_analytics ON student_attendances (school_id, date, status);
CREATE INDEX IF NOT EXISTS idx_employee_attendance_analytics ON employee_attendances (school_id, date, status);
CREATE INDEX IF NOT EXISTS idx_stock_movements_analytics ON stock_movements (school_id, created_at, item_id);
CREATE INDEX IF NOT EXISTS idx_library_loans_analytics ON library_loans (school_id, issue_date, status);
CREATE INDEX IF NOT EXISTS idx_transport_trips_analytics ON transport_trips (school_id, trip_date, status);
CREATE INDEX IF NOT EXISTS idx_admissions_analytics ON admission_applications (school_id, academic_session_id, status);

-- ============================================================================
-- 4. ROW-LEVEL SECURITY POLICIES
-- ============================================================================

ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_reports FORCE ROW LEVEL SECURITY;

ALTER TABLE report_export_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_export_logs FORCE ROW LEVEL SECURITY;

-- Policy for saved_reports: Users only see/manage reports for their active school
DROP POLICY IF EXISTS saved_reports_tenant_isolation ON saved_reports;
CREATE POLICY saved_reports_tenant_isolation ON saved_reports
  FOR ALL
  USING (
    school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
  )
  WITH CHECK (
    school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
  );

-- Policy for report_export_logs: Tenant isolated export logs
DROP POLICY IF EXISTS report_export_logs_tenant_isolation ON report_export_logs;
CREATE POLICY report_export_logs_tenant_isolation ON report_export_logs
  FOR ALL
  USING (
    school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
  )
  WITH CHECK (
    school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
  );

-- 5. Grant Permissions to Unprivileged edusmart_app_user
DO $$
BEGIN
  BEGIN
    GRANT ALL PRIVILEGES ON TABLE saved_reports TO edusmart_app_user;
    GRANT ALL PRIVILEGES ON TABLE report_export_logs TO edusmart_app_user;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
