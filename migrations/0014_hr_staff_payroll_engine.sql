-- ============================================================================
-- Migration 0014: Phase 7 — HR, Staff & Payroll Engine
-- ============================================================================

-- 1. Create Enums with idempotent blocks
DO $$ BEGIN
  CREATE TYPE "EmploymentType" AS ENUM (
    'PERMANENT',
    'PROBATIONARY',
    'CONTRACTUAL',
    'PART_TIME',
    'TEMPORARY',
    'INTERN',
    'DAILY_WAGE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EmployeeStatus" AS ENUM (
    'DRAFT',
    'ACTIVE',
    'ON_LEAVE',
    'SUSPENDED',
    'RESIGNED',
    'TERMINATED',
    'RETIRED',
    'INACTIVE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SalaryComponentType" AS ENUM (
    'EARNING',
    'DEDUCTION'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SalaryCalculationMethod" AS ENUM (
    'FIXED',
    'PERCENT_OF_BASIC',
    'PERCENT_OF_GROSS',
    'FORMULA'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LeaveRequestStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AdvanceStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'ACTIVE',
    'REPAID',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PayrollPeriodStatus" AS ENUM (
    'DRAFT',
    'CALCULATING',
    'REVIEW',
    'FINALIZED',
    'PAID',
    'CLOSED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PayrollRecordStatus" AS ENUM (
    'DRAFT',
    'CALCULATED',
    'FINALIZED',
    'PAID',
    'VOIDED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PayrollPaymentStatus" AS ENUM (
    'PENDING',
    'SUCCESS',
    'FAILED',
    'CANCELLED',
    'REFUNDED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Departments
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  code VARCHAR(50) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  name_bn VARCHAR(100) NOT NULL,
  description TEXT,
  status "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_dept_school_code UNIQUE (school_id, code),
  CONSTRAINT uq_dept_tenant UNIQUE (id, school_id)
);

-- 3. Designations
CREATE TABLE IF NOT EXISTS designations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  code VARCHAR(50) NOT NULL,
  title_en VARCHAR(100) NOT NULL,
  title_bn VARCHAR(100) NOT NULL,
  status "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_designation_school_code UNIQUE (school_id, code),
  CONSTRAINT uq_designation_tenant UNIQUE (id, school_id)
);

-- 4. Employees (Primary Generalized Staff Model)
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  campus_id UUID REFERENCES campuses(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  employee_code VARCHAR(50) NOT NULL,
  first_name_en VARCHAR(100) NOT NULL,
  last_name_en VARCHAR(100) NOT NULL,
  full_name_en VARCHAR(200) NOT NULL,
  full_name_bn VARCHAR(200) NOT NULL,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  designation_id UUID NOT NULL REFERENCES designations(id) ON DELETE RESTRICT,
  employment_type "EmploymentType" NOT NULL DEFAULT 'PERMANENT',
  status "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
  date_of_birth DATE NOT NULL,
  gender "Gender" NOT NULL,
  blood_group "BloodGroup",
  national_id VARCHAR(50) NOT NULL,
  birth_registration_no VARCHAR(50),
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(255),
  present_address TEXT,
  permanent_address TEXT,
  emergency_contact_name VARCHAR(150),
  emergency_contact_phone VARCHAR(30),
  emergency_contact_relation VARCHAR(50),
  joining_date DATE NOT NULL,
  confirmation_date DATE,
  termination_date DATE,
  termination_reason TEXT,
  bank_name VARCHAR(100),
  bank_account_no VARCHAR(100),
  bank_routing_no VARCHAR(50),
  mfs_provider VARCHAR(50),
  mfs_number VARCHAR(30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_employee_code UNIQUE (school_id, employee_code),
  CONSTRAINT uq_employee_tenant UNIQUE (id, school_id),
  CONSTRAINT uq_employee_teacher UNIQUE (school_id, teacher_id),
  CONSTRAINT uq_employee_user UNIQUE (school_id, user_id)
);

-- 5. Staff Documents
CREATE TABLE IF NOT EXISTS employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  doc_type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  file_url TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  mime_type VARCHAR(100) NOT NULL,
  verified_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_employee_doc_tenant UNIQUE (id, school_id)
);

-- 6. Extension on Existing employee_attendances table
ALTER TABLE employee_attendances
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_employee_attendance_emp_date
  ON employee_attendances(school_id, employee_id, date);

-- 7. Salary Components
CREATE TABLE IF NOT EXISTS salary_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  code VARCHAR(50) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  name_bn VARCHAR(100) NOT NULL,
  type "SalaryComponentType" NOT NULL,
  calculation_method "SalaryCalculationMethod" NOT NULL DEFAULT 'FIXED',
  default_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  percentage_value DECIMAL(5, 2),
  formula_expression TEXT,
  is_taxable BOOLEAN NOT NULL DEFAULT FALSE,
  is_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
  status "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_salary_component_code UNIQUE (school_id, code),
  CONSTRAINT uq_salary_component_tenant UNIQUE (id, school_id),
  CONSTRAINT chk_component_amount_non_negative CHECK (default_amount >= 0)
);

-- 8. Salary Structures
CREATE TABLE IF NOT EXISTS salary_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  code VARCHAR(50) NOT NULL,
  name_en VARCHAR(150) NOT NULL,
  name_bn VARCHAR(150) NOT NULL,
  description TEXT,
  status "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_salary_structure_code UNIQUE (school_id, code),
  CONSTRAINT uq_salary_structure_tenant UNIQUE (id, school_id)
);

CREATE TABLE IF NOT EXISTS salary_structure_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  structure_id UUID NOT NULL REFERENCES salary_structures(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES salary_components(id) ON DELETE RESTRICT,
  amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  percentage_value DECIMAL(5, 2),
  CONSTRAINT uq_structure_component UNIQUE (structure_id, component_id),
  CONSTRAINT chk_structure_item_amount CHECK (amount >= 0)
);

-- 9. Employee Salary Assignments (Versioned & Temporal)
CREATE TABLE IF NOT EXISTS employee_salary_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  structure_id UUID REFERENCES salary_structures(id) ON DELETE SET NULL,
  version INT NOT NULL DEFAULT 1,
  effective_from DATE NOT NULL,
  effective_to DATE,
  base_salary DECIMAL(12, 2) NOT NULL,
  gross_salary DECIMAL(12, 2) NOT NULL,
  net_estimated_salary DECIMAL(12, 2) NOT NULL,
  status "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  approved_by_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_salary_assignment_tenant UNIQUE (id, school_id),
  CONSTRAINT uq_salary_assignment_version UNIQUE (school_id, employee_id, version),
  CONSTRAINT chk_assignment_base_salary CHECK (base_salary >= 0),
  CONSTRAINT chk_assignment_gross_salary CHECK (gross_salary >= base_salary),
  CONSTRAINT chk_assignment_effective_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE IF NOT EXISTS employee_salary_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  assignment_id UUID NOT NULL REFERENCES employee_salary_assignments(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES salary_components(id) ON DELETE RESTRICT,
  amount DECIMAL(12, 2) NOT NULL,
  calculation_snapshot JSONB DEFAULT '{}',
  CONSTRAINT uq_assignment_component UNIQUE (assignment_id, component_id),
  CONSTRAINT chk_salary_item_amount CHECK (amount >= 0)
);

-- 10. Leave Types & Balances
CREATE TABLE IF NOT EXISTS leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  code VARCHAR(50) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  name_bn VARCHAR(100) NOT NULL,
  annual_days INT NOT NULL DEFAULT 10,
  is_paid BOOLEAN NOT NULL DEFAULT TRUE,
  allow_carry_forward BOOLEAN NOT NULL DEFAULT FALSE,
  status "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_leave_type_code UNIQUE (school_id, code),
  CONSTRAINT uq_leave_type_tenant UNIQUE (id, school_id),
  CONSTRAINT chk_leave_annual_days CHECK (annual_days >= 0)
);

CREATE TABLE IF NOT EXISTS leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT,
  year INT NOT NULL,
  allocated_days DECIMAL(5, 1) NOT NULL DEFAULT 0.0,
  used_days DECIMAL(5, 1) NOT NULL DEFAULT 0.0,
  pending_days DECIMAL(5, 1) NOT NULL DEFAULT 0.0,
  remaining_days DECIMAL(5, 1) NOT NULL DEFAULT 0.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_employee_leave_balance UNIQUE (school_id, employee_id, leave_type_id, year),
  CONSTRAINT uq_leave_balance_tenant UNIQUE (id, school_id),
  CONSTRAINT chk_leave_days_non_negative CHECK (allocated_days >= 0 AND used_days >= 0 AND pending_days >= 0)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days DECIMAL(5, 1) NOT NULL,
  reason TEXT NOT NULL,
  status "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actioned_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actioned_at TIMESTAMPTZ,
  action_reason TEXT,
  CONSTRAINT uq_leave_request_tenant UNIQUE (id, school_id),
  CONSTRAINT chk_leave_request_dates CHECK (end_date >= start_date),
  CONSTRAINT chk_leave_request_days CHECK (total_days > 0)
);

-- 11. Salary Advances & Loans
CREATE TABLE IF NOT EXISTS salary_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  advance_number VARCHAR(50) NOT NULL,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  requested_amount DECIMAL(12, 2) NOT NULL,
  approved_amount DECIMAL(12, 2) NOT NULL,
  monthly_deduction DECIMAL(12, 2) NOT NULL,
  total_recovered DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  balance_remaining DECIMAL(12, 2) NOT NULL,
  reason TEXT,
  status "AdvanceStatus" NOT NULL DEFAULT 'PENDING',
  disbursed_at TIMESTAMPTZ,
  disbursement_method "PaymentMethod",
  approved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_advance_number UNIQUE (school_id, advance_number),
  CONSTRAINT uq_advance_tenant UNIQUE (id, school_id),
  CONSTRAINT chk_advance_amounts CHECK (requested_amount > 0 AND approved_amount >= 0 AND monthly_deduction > 0),
  CONSTRAINT chk_advance_balance CHECK (balance_remaining >= 0 AND total_recovered >= 0)
);

CREATE TABLE IF NOT EXISTS advance_repayment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  advance_id UUID NOT NULL REFERENCES salary_advances(id) ON DELETE RESTRICT,
  payroll_record_id UUID,
  amount DECIMAL(12, 2) NOT NULL,
  repayment_date DATE NOT NULL,
  balance_after DECIMAL(12, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_repayment_amount CHECK (amount > 0),
  CONSTRAINT chk_repayment_balance CHECK (balance_after >= 0)
);

-- 12. Payroll Periods
CREATE TABLE IF NOT EXISTS payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  period_key VARCHAR(20) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  name_bn VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  payment_due_date DATE,
  status "PayrollPeriodStatus" NOT NULL DEFAULT 'DRAFT',
  total_gross DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  total_deductions DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  total_net DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  total_paid DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  employee_count INT NOT NULL DEFAULT 0,
  finalized_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  finalized_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_payroll_period_key UNIQUE (school_id, period_key),
  CONSTRAINT uq_payroll_period_tenant UNIQUE (id, school_id),
  CONSTRAINT chk_payroll_period_dates CHECK (end_date >= start_date)
);

-- 13. Payroll Records (Individual Employee Payroll Liabilities)
CREATE TABLE IF NOT EXISTS payroll_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  period_id UUID NOT NULL REFERENCES payroll_periods(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  salary_assignment_id UUID NOT NULL REFERENCES employee_salary_assignments(id) ON DELETE RESTRICT,
  payslip_number VARCHAR(50) NOT NULL,
  campus_id UUID REFERENCES campuses(id) ON DELETE SET NULL,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  designation_id UUID NOT NULL REFERENCES designations(id) ON DELETE RESTRICT,
  employment_type "EmploymentType" NOT NULL,
  basic_salary DECIMAL(12, 2) NOT NULL,
  gross_earnings DECIMAL(12, 2) NOT NULL,
  total_deductions DECIMAL(12, 2) NOT NULL,
  advance_recovery_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  net_salary DECIMAL(12, 2) NOT NULL,
  paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  due_salary DECIMAL(12, 2) NOT NULL,
  total_working_days INT NOT NULL DEFAULT 30,
  present_days INT NOT NULL DEFAULT 0,
  absent_days INT NOT NULL DEFAULT 0,
  late_days INT NOT NULL DEFAULT 0,
  leave_days INT NOT NULL DEFAULT 0,
  unpaid_leave_days INT NOT NULL DEFAULT 0,
  overtime_hours DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
  overtime_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  status "PayrollRecordStatus" NOT NULL DEFAULT 'DRAFT',
  calculation_snapshot JSONB NOT NULL DEFAULT '{}',
  notes TEXT,
  generated_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalized_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_payroll_period_employee UNIQUE (school_id, period_id, employee_id),
  CONSTRAINT uq_payslip_number UNIQUE (school_id, payslip_number),
  CONSTRAINT uq_payroll_record_tenant UNIQUE (id, school_id),
  CONSTRAINT chk_payroll_net_non_negative CHECK (net_salary >= 0),
  CONSTRAINT chk_payroll_paid_non_negative CHECK (paid_amount >= 0),
  CONSTRAINT chk_payroll_due_formula CHECK (due_salary = net_salary - paid_amount)
);

CREATE TABLE IF NOT EXISTS payroll_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  payroll_record_id UUID NOT NULL REFERENCES payroll_records(id) ON DELETE CASCADE,
  component_id UUID REFERENCES salary_components(id) ON DELETE SET NULL,
  code VARCHAR(50) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  name_bn VARCHAR(100) NOT NULL,
  type "SalaryComponentType" NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  is_taxable BOOLEAN NOT NULL DEFAULT FALSE,
  notes VARCHAR(255),
  CONSTRAINT uq_payroll_record_component UNIQUE (payroll_record_id, code),
  CONSTRAINT chk_payroll_item_amount CHECK (amount >= 0)
);

-- 14. Payroll Payments (Salary Disbursements)
CREATE TABLE IF NOT EXISTS payroll_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  payment_number VARCHAR(50) NOT NULL,
  payroll_record_id UUID NOT NULL REFERENCES payroll_records(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  amount DECIMAL(12, 2) NOT NULL,
  payment_method "PaymentMethod" NOT NULL,
  payment_date DATE NOT NULL,
  transaction_ref VARCHAR(100),
  bank_name VARCHAR(100),
  bank_account_no VARCHAR(100),
  status "PayrollPaymentStatus" NOT NULL DEFAULT 'SUCCESS',
  paid_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  approved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_payroll_payment_number UNIQUE (school_id, payment_number),
  CONSTRAINT uq_payroll_payment_tenant UNIQUE (id, school_id),
  CONSTRAINT chk_payroll_payment_amount CHECK (amount > 0)
);

-- 15. Composite Foreign Keys for Tenant Consistency
ALTER TABLE employees
  DROP CONSTRAINT IF EXISTS fk_employee_tenant;
ALTER TABLE employees
  ADD CONSTRAINT fk_employee_tenant
    FOREIGN KEY (department_id, school_id)
    REFERENCES departments(id, school_id) ON DELETE RESTRICT;

ALTER TABLE employee_salary_assignments
  DROP CONSTRAINT IF EXISTS fk_salary_assignment_employee_tenant;
ALTER TABLE employee_salary_assignments
  ADD CONSTRAINT fk_salary_assignment_employee_tenant
    FOREIGN KEY (employee_id, school_id)
    REFERENCES employees(id, school_id) ON DELETE RESTRICT;

ALTER TABLE payroll_records
  DROP CONSTRAINT IF EXISTS fk_payroll_employee_tenant;
ALTER TABLE payroll_records
  ADD CONSTRAINT fk_payroll_employee_tenant
    FOREIGN KEY (employee_id, school_id)
    REFERENCES employees(id, school_id) ON DELETE RESTRICT;

ALTER TABLE payroll_records
  DROP CONSTRAINT IF EXISTS fk_payroll_period_tenant;
ALTER TABLE payroll_records
  ADD CONSTRAINT fk_payroll_period_tenant
    FOREIGN KEY (period_id, school_id)
    REFERENCES payroll_periods(id, school_id) ON DELETE RESTRICT;

ALTER TABLE payroll_payments
  DROP CONSTRAINT IF EXISTS fk_payment_payroll_record_tenant;
ALTER TABLE payroll_payments
  ADD CONSTRAINT fk_payment_payroll_record_tenant
    FOREIGN KEY (payroll_record_id, school_id)
    REFERENCES payroll_records(id, school_id) ON DELETE RESTRICT;

-- 16. Automated Synchronization Triggers
-- Trigger A: Update Advance Balances on Repayment Log Insertion
CREATE OR REPLACE FUNCTION fn_sync_advance_repayment()
RETURNS TRIGGER AS $$
DECLARE
  v_total_rec DECIMAL(12, 2);
  v_app_amt DECIMAL(12, 2);
BEGIN
  SELECT approved_amount INTO v_app_amt
  FROM salary_advances
  WHERE id = NEW.advance_id;

  SELECT COALESCE(SUM(amount), 0.00) INTO v_total_rec
  FROM advance_repayment_logs
  WHERE advance_id = NEW.advance_id;

  UPDATE salary_advances
  SET total_recovered = v_total_rec,
      balance_remaining = GREATEST(0.00, v_app_amt - v_total_rec),
      status = CASE WHEN (v_app_amt - v_total_rec) <= 0.00 THEN 'REPAID'::"AdvanceStatus" ELSE 'ACTIVE'::"AdvanceStatus" END,
      updated_at = NOW()
  WHERE id = NEW.advance_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_advance_repayment ON advance_repayment_logs;
CREATE TRIGGER trg_sync_advance_repayment
AFTER INSERT OR UPDATE OR DELETE ON advance_repayment_logs
FOR EACH ROW
EXECUTE FUNCTION fn_sync_advance_repayment();

-- Trigger B: Update Payroll Record Paid/Due Amount on Payment Completion
CREATE OR REPLACE FUNCTION fn_sync_payroll_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_rec_id UUID;
  v_period_id UUID;
  v_net DECIMAL(12, 2);
  v_paid DECIMAL(12, 2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_rec_id := OLD.payroll_record_id;
  ELSE
    v_rec_id := NEW.payroll_record_id;
  END IF;

  SELECT net_salary, period_id INTO v_net, v_period_id
  FROM payroll_records
  WHERE id = v_rec_id;

  SELECT COALESCE(SUM(amount), 0.00) INTO v_paid
  FROM payroll_payments
  WHERE payroll_record_id = v_rec_id AND status = 'SUCCESS';

  UPDATE payroll_records
  SET paid_amount = v_paid,
      due_salary = GREATEST(0.00, v_net - v_paid),
      status = CASE
        WHEN v_paid >= v_net AND v_net > 0 THEN 'PAID'::"PayrollRecordStatus"
        WHEN status = 'FINALIZED' THEN 'FINALIZED'::"PayrollRecordStatus"
        ELSE status
      END,
      updated_at = NOW()
  WHERE id = v_rec_id;

  -- Update Period Total Paid
  UPDATE payroll_periods
  SET total_paid = (
    SELECT COALESCE(SUM(paid_amount), 0.00)
    FROM payroll_records
    WHERE period_id = v_period_id
  ),
  updated_at = NOW()
  WHERE id = v_period_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_payroll_payment ON payroll_payments;
CREATE TRIGGER trg_sync_payroll_payment
AFTER INSERT OR UPDATE OR DELETE ON payroll_payments
FOR EACH ROW
EXECUTE FUNCTION fn_sync_payroll_payment();

-- 17. Row-Level Security (RLS) on all HR & Payroll Tables
DO $$
DECLARE
  tbl TEXT;
  hr_payroll_tables TEXT[] := ARRAY[
    'departments', 'designations', 'employees', 'employee_documents',
    'salary_components', 'salary_structures', 'salary_structure_items',
    'employee_salary_assignments', 'employee_salary_items', 'leave_types',
    'leave_balances', 'leave_requests', 'salary_advances', 'advance_repayment_logs',
    'payroll_periods', 'payroll_records', 'payroll_items', 'payroll_payments'
  ];
BEGIN
  FOREACH tbl IN ARRAY hr_payroll_tables LOOP
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
