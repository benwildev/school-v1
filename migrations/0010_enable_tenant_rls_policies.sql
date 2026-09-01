-- ============================================================================
-- Migration 0010: Enable Tenant Row-Level Security (RLS) Policies
-- ============================================================================

-- Grant table & schema permissions to runtime application role if present
DO $$
BEGIN
  BEGIN
    GRANT USAGE ON SCHEMA public, app TO edusmart_app_user;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO edusmart_app_user;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO edusmart_app_user;
    GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public, app TO edusmart_app_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO edusmart_app_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO edusmart_app_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON ROUTINES TO edusmart_app_user;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipping grant to edusmart_app_user: %', SQLERRM;
  END;
END $$;

DO $$
DECLARE
  tbl TEXT;
  direct_tenant_tables TEXT[] := ARRAY[
    'campuses', 'school_settings', 'school_branding', 'school_addresses',
    'academic_sessions', 'classes', 'academic_groups', 'sections', 'subjects',
    'subject_assessment_configs', 'classrooms', 'academic_calendars',
    'students', 'guardians', 'student_guardians', 'enrollments', 'promotion_batches',
    'promotion_items', 'student_documents', 'teachers', 'teacher_assignments',
    'routines', 'student_attendances', 'employee_attendances', 'exams',
    'exam_schedules', 'grading_scales', 'marks', 'student_exam_results',
    'fee_types', 'fee_structures', 'student_fees', 'student_discounts',
    'payments', 'payment_allocations', 'student_credit_accounts',
    'student_credit_transactions', 'receipts', 'refunds', 'expenses',
    'expense_categories', 'admission_applications', 'users', 'roles',
    'audit_logs', 'file_attachments', 'certificates', 'notifications',
    'message_logs', 'notification_templates', 'automation_rules',
    'integration_configs', 'biometric_devices', 'school_subscriptions',
    'subscription_periods', 'platform_usage_metrics', 'usage_events'
  ];
BEGIN
  FOREACH tbl IN ARRAY direct_tenant_tables LOOP
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

-- 1. grade_rules (Scoped via grading_scales.school_id)
ALTER TABLE IF EXISTS grade_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS grade_rules FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON grade_rules;
CREATE POLICY tenant_isolation_policy ON grade_rules
FOR ALL
USING (EXISTS (
  SELECT 1 FROM grading_scales g 
  WHERE g.id = grade_rules.grading_scale_id 
    AND g.school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID
))
WITH CHECK (EXISTS (
  SELECT 1 FROM grading_scales g 
  WHERE g.id = grade_rules.grading_scale_id 
    AND g.school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID
));

-- 2. emergency_contacts (Scoped via students.school_id)
ALTER TABLE IF EXISTS emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS emergency_contacts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON emergency_contacts;
CREATE POLICY tenant_isolation_policy ON emergency_contacts
FOR ALL
USING (EXISTS (
  SELECT 1 FROM students s 
  WHERE s.id = emergency_contacts.student_id 
    AND s.school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID
))
WITH CHECK (EXISTS (
  SELECT 1 FROM students s 
  WHERE s.id = emergency_contacts.student_id 
    AND s.school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID
));

-- 3. application_documents (Scoped via admission_applications.school_id)
ALTER TABLE IF EXISTS application_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS application_documents FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON application_documents;
CREATE POLICY tenant_isolation_policy ON application_documents
FOR ALL
USING (EXISTS (
  SELECT 1 FROM admission_applications a 
  WHERE a.id = application_documents.application_id 
    AND a.school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID
))
WITH CHECK (EXISTS (
  SELECT 1 FROM admission_applications a 
  WHERE a.id = application_documents.application_id 
    AND a.school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID
));

-- 4. role_permissions (Scoped via roles.school_id)
ALTER TABLE IF EXISTS role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS role_permissions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON role_permissions;
CREATE POLICY tenant_isolation_policy ON role_permissions
FOR ALL
USING (EXISTS (
  SELECT 1 FROM roles r 
  WHERE r.id = role_permissions.role_id 
    AND (r.school_id IS NULL OR r.school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM roles r 
  WHERE r.id = role_permissions.role_id 
    AND (r.school_id IS NULL OR r.school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID)
));
